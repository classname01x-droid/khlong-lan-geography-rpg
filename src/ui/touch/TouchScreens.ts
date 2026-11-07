import type Phaser from 'phaser';
import { CHAPTERS } from '../../content/story/chapters';
import { IN_DEVELOPMENT_MESSAGE } from '../../core/campaign/Campaign';
import { TapGuard } from '../../core/input/InputMapping';
import type { ProgressStore } from '../../core/progress/ProgressStore';
import type { SettingsStore } from '../../core/settings/SettingsStore';
import type { MobileLayout } from '../../core/ui/MobileLayout';
import { REGISTRY_PROGRESS, REGISTRY_SETTINGS } from '../../scenes/events';
import { SCENE } from '../../scenes/navigation';
import { FONT_FAMILY } from '../theme';
import {
  chapterIntroView,
  endingView,
  GAME_TITLE,
  HOW_TO_GOAL,
  HOW_TO_SCALE,
  HOW_TO_TIPS,
  journeyView,
  KEYBOARD_CONTROLS,
  menuView,
  NEW_GAME_CONFIRM,
  SETTINGS_NOTE,
  TOUCH_CONTROLS,
  type MenuItemId,
} from '../views/screens';
import { chestSlotsHtml, chestSvg } from '../chestArt';
import { esc } from './readerHtml';
import { SCREEN_CSS } from './screenStyles';

/** คำสั่งของแต่ละฉากที่หน้าจอสัมผัสเรียกใช้ (เมธอดเดียวกับที่ปุ่มบน canvas ใช้) */
interface MenuHost {
  hasSave(): boolean;
  startNewGame(confirmed: boolean): boolean;
  continueGame(): void;
  openJourney(): void;
  toggleSound(): boolean;
  toggleControlsHint(): boolean;
}
interface JourneyHost {
  go(): void;
  backToMenu(): void;
}
interface ChapterHost {
  advance(guard?: boolean): boolean;
  back(): void;
  depart(): void;
  toJourney(): void;
  readonly touchState: { chapterId: string; lineIndex: number; total: number; stage: 'dialogue' | 'ready' | 'in-development' };
}
interface EndingHost {
  toJourney(): void;
  toMenu(): void;
}

type ScreenKind = 'menu' | 'journey' | 'chapter' | 'ending';
type MenuPanel = null | 'howto' | 'settings' | 'confirm';
type HowToTab = 'goal' | 'touch' | 'scale' | 'keys';

/** เวลารอก่อนปุ่ม "ออกเดินทาง" กดได้ — กันแตะ "อ่านต่อ" ซ้ำแล้วออกเดินทางทันทีโดยไม่ตั้งใจ */
export const DEPART_ARM_MS = 700;

/**
 * หน้าจอนอกด่านบนจอสัมผัส (DOM ตัวอักษรใหญ่ ปุ่ม ≥ 48 px เว้นขอบรอยบาก)
 * อ่านข้อมูลจาก ui/views/screens.ts (แหล่งเดียวกับหน้าจอบน canvas) และเรียกคำสั่งของฉากนั้น ๆ
 * กติกาลำดับเรื่อง (ห้ามข้ามบท/ย้อนบท) อยู่ที่ core/campaign + scenes/navigation ตามเดิม
 */
export class TouchScreens {
  private readonly root: HTMLDivElement;
  private readonly guard = new TapGuard(250);
  private layout: MobileLayout | null = null;
  private kind: ScreenKind | null = null;
  private lastHtml = '';
  private menuPanel: MenuPanel = null;
  private howTab: HowToTab = 'goal';
  private journeySel: string | null = null;
  private endTab: 'wisdom' | 'learning' = 'wisdom';
  private chapterKey = '';
  private readySince = 0;
  /** สำหรับการทดสอบอัตโนมัติ */
  lastScreen: ScreenKind | null = null;

  constructor(private readonly game: Phaser.Game) {
    const style = document.createElement('style');
    style.textContent = SCREEN_CSS.replaceAll('__FONT__', FONT_FAMILY);
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.className = 'ts-root';
    document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!el || !this.root.contains(el)) return;
      // ปุ่มอยู่ในพื้นที่เลื่อนได้: ใช้ click (ไม่ทำงานเมื่อผู้เล่นลากเลื่อน) · ปุ่มอื่นตอบสนองทันที
      if (el.closest('.ts-scroll, .ts-route')) return;
      e.preventDefault();
      this.activate(el);
    });
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (el && this.root.contains(el) && el.closest('.ts-scroll, .ts-route')) this.activate(el);
    });
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.setInterval(() => this.tick(), 100);
  }

  setLayout(l: MobileLayout): void {
    this.layout = l;
    const s = this.root.style;
    s.setProperty('--sa-t', `${l.insets.top}px`);
    s.setProperty('--sa-r', `${l.insets.right}px`);
    s.setProperty('--sa-b', `${l.insets.bottom}px`);
    s.setProperty('--sa-l', `${l.insets.left}px`);
    this.lastHtml = '';
  }

  private activate(el: HTMLElement): void {
    if (el.hasAttribute('disabled')) return;
    const act = el.dataset.act!;
    if (!this.guard.accept(act, performance.now())) return;
    this.onAct(act);
    this.lastHtml = '';
    window.setTimeout(() => this.tick(), 0);
  }

  /* ---------------- ฉากที่เปิดอยู่ ---------------- */

  private activeKind(): ScreenKind | null {
    const sm = this.game.scene;
    if (sm.isActive(SCENE.menu)) return 'menu';
    if (sm.isActive(SCENE.worldMap)) return 'journey';
    if (sm.isActive(SCENE.chapter)) return 'chapter';
    if (sm.isActive(SCENE.ending)) return 'ending';
    return null;
  }

  private host<T>(key: string): T {
    return this.game.scene.getScene(key) as unknown as T;
  }

  private progress(): ProgressStore {
    return this.game.registry.get(REGISTRY_PROGRESS) as ProgressStore;
  }

  private settings(): SettingsStore {
    return this.game.registry.get(REGISTRY_SETTINGS) as SettingsStore;
  }

  /* ---------------- คำสั่งจากปุ่ม ---------------- */

  private onAct(act: string): void {
    const [screen, cmd, arg] = act.split(':');
    if (screen === 'menu') {
      const m = this.host<MenuHost>(SCENE.menu);
      const id = cmd as MenuItemId | 'close' | 'confirm' | 'sound' | 'hint' | 'tab';
      if (id === 'new') {
        if (!m.startNewGame(false)) this.menuPanel = 'confirm';
      } else if (id === 'confirm') {
        this.menuPanel = null;
        m.startNewGame(true);
      } else if (id === 'continue') m.continueGame();
      else if (id === 'journey') m.openJourney();
      else if (id === 'howto') this.menuPanel = 'howto';
      else if (id === 'settings') this.menuPanel = 'settings';
      else if (id === 'close') this.menuPanel = null;
      else if (id === 'sound') m.toggleSound();
      else if (id === 'hint') m.toggleControlsHint();
      else if (id === 'tab') this.howTab = arg as HowToTab;
    } else if (screen === 'journey') {
      const j = this.host<JourneyHost>(SCENE.worldMap);
      if (cmd === 'go') j.go();
      else if (cmd === 'menu') j.backToMenu();
      else if (cmd === 'select') this.journeySel = arg; // ดูรายละเอียดเท่านั้น ไม่เข้าเล่นบทนั้น
    } else if (screen === 'chapter') {
      const c = this.host<ChapterHost>(SCENE.chapter);
      if (cmd === 'next') c.advance(true);
      else if (cmd === 'back') c.back();
      else if (cmd === 'depart' && performance.now() - this.readySince >= DEPART_ARM_MS) c.depart();
      else if (cmd === 'journey') c.toJourney();
    } else if (screen === 'ending') {
      const e = this.host<EndingHost>(SCENE.ending);
      if (cmd === 'journey') e.toJourney();
      else if (cmd === 'menu') e.toMenu();
      else if (cmd === 'tab') this.endTab = arg as 'wisdom' | 'learning';
    }
  }

  /* ---------------- วาด ---------------- */

  private tick(): void {
    const kind = this.activeKind();
    if (kind !== this.kind) {
      // เปลี่ยนหน้า: เริ่มสถานะของหน้าใหม่
      this.kind = kind;
      this.menuPanel = null;
      this.howTab = 'goal';
      this.journeySel = null;
      this.endTab = 'wisdom';
      this.chapterKey = '';
    }
    this.lastScreen = kind;
    this.root.classList.toggle('ts-on', !!kind);
    if (!kind) {
      if (this.lastHtml) {
        this.root.innerHTML = '';
        this.lastHtml = '';
      }
      return;
    }
    const ins = this.layout?.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const w = this.root.clientWidth - ins.left - ins.right;
    const h = this.root.clientHeight - ins.top - ins.bottom;
    // จอเตี้ย (แนวนอนบนโทรศัพท์เล็ก): จัดวางให้ปุ่มหลักเห็นครบโดยไม่ลดตัวอักษรเนื้อหา
    this.root.classList.toggle('ts-short', h < 380);
    const html = kind === 'menu' ? this.menuHtml(w) : kind === 'journey' ? this.journeyHtml(w) : kind === 'chapter' ? this.chapterHtml(w) : this.endingHtml(w, h);
    if (html === this.lastHtml) return;
    // คงตำแหน่งที่เลื่อนอ่านอยู่ เมื่อเนื้อหาเดิมอัปเดต
    const scrolls = new Map<string, number>();
    this.root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => scrolls.set(el.dataset.scroll!, el.scrollTop));
    this.root.innerHTML = html;
    this.lastHtml = html;
    this.root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => {
      const top = scrolls.get(el.dataset.scroll!);
      if (top) el.scrollTop = top;
    });
  }

  private btn(act: string, label: string, opts: { icon?: string; primary?: boolean; disabled?: boolean; cls?: string; sub?: string } = {}): string {
    const cls = ['ts-btn', opts.primary ? 'ts-primary' : '', opts.cls ?? ''].filter(Boolean).join(' ');
    const sub = opts.sub ? `<span class="ts-btn-sub">${esc(opts.sub)}</span>` : '';
    return (
      `<button class="${cls}" data-act="${esc(act)}"${opts.disabled ? ' disabled' : ''}>` +
      `${opts.icon ? `<span class="ts-ico">${esc(opts.icon)}</span>` : ''}<span>${esc(label)}${sub}</span></button>`
    );
  }

  /* ----- เมนูหลัก ----- */

  private menuHtml(w: number): string {
    const m = this.host<MenuHost>(SCENE.menu);
    const view = menuView(this.progress().data, m.hasSave());
    const title =
      `<div class="ts-title ts-wood"><div class="ts-kicker">${esc(GAME_TITLE.kicker)}</div>` +
      `<h1 class="ts-h1">${esc(GAME_TITLE.title)}</h1><div class="ts-sub">${esc(GAME_TITLE.subtitle)}</div>` +
      `<div class="ts-save">${view.continueText ? `💾 เล่นต่อได้ที่: ${esc(view.continueText)}` : '🌱 ครั้งแรก? แตะ "เริ่มเกมใหม่" · ถือโทรศัพท์แนวนอน'}</div></div>`;
    const buttons = view.items
      .map((it) =>
        this.btn(`menu:${it.id}`, it.label, {
          icon: it.icon,
          primary: it.primary,
          disabled: !it.enabled,
          cls: 'ts-menu-btn',
          sub: it.id === 'continue' && view.continueText ? view.continueText : undefined,
        }),
      )
      .join('');
    let html = `<div class="ts-screen ts-menu${w >= 520 ? ' ts-wide' : ''}"><div class="ts-menu-grid">${title}<nav class="ts-menu-btns ts-scroll" data-scroll="menu">${buttons}</nav></div>`;
    if (this.menuPanel) html += this.menuPanelHtml();
    return html + '</div>';
  }

  private panel(title: string, body: string, foot: string, opts: { tabs?: string; narrow?: boolean } = {}): string {
    return (
      `<div class="ts-modal"><div class="ts-panel ts-paper${opts.narrow ? ' ts-narrowpanel' : ''}">` +
      `<div class="ts-panel-head"><h2 class="ts-h3">${esc(title)}</h2>${opts.tabs ?? ''}</div>` +
      `<div class="ts-panel-body ts-scroll" data-scroll="panel">${body}</div>` +
      `<div class="ts-panel-foot">${foot}</div></div></div>`
    );
  }

  private menuPanelHtml(): string {
    const back = this.btn('menu:close', 'กลับ', { icon: '↩', primary: true });
    if (this.menuPanel === 'confirm') {
      return this.panel(
        NEW_GAME_CONFIRM.title,
        `<p class="ts-p">${esc(NEW_GAME_CONFIRM.message)}</p>`,
        this.btn('menu:confirm', NEW_GAME_CONFIRM.confirm, { cls: 'ts-danger' }) + this.btn('menu:close', NEW_GAME_CONFIRM.cancel, { primary: true }),
        { narrow: true },
      );
    }
    if (this.menuPanel === 'settings') {
      const st = this.settings().settings;
      const body =
        this.btn('menu:sound', `เสียง: ${st.soundEnabled ? 'เปิด' : 'ปิด'}`, { icon: st.soundEnabled ? '🔊' : '🔇', cls: 'ts-toggle' }) +
        this.btn('menu:hint', `คำแนะนำปุ่มคีย์บอร์ดในเกม: ${st.showControlsHint ? 'แสดง' : 'ซ่อน'}`, { icon: '⌨️', cls: 'ts-toggle' }) +
        `<p class="ts-small">${esc(SETTINGS_NOTE)}</p><p class="ts-small">บนโทรศัพท์ใช้ปุ่มบนจอเสมอ — คำแนะนำปุ่มคีย์บอร์ดมีผลเฉพาะคอมพิวเตอร์</p>`;
      return this.panel('ตั้งค่า', body, back, { narrow: true });
    }
    const tabs: Array<[HowToTab, string]> = [
      ['goal', '🎯 เป้าหมาย'],
      ['touch', '📱 ปุ่มบนจอ'],
      ['scale', '📏 มาตราส่วน'],
      ['keys', '⌨️ คีย์บอร์ด'],
    ];
    const tabHtml = `<div class="ts-tabs">${tabs
      .map(([id, label]) => `<button class="ts-tab${this.howTab === id ? ' ts-on' : ''}" data-act="menu:tab:${id}">${esc(label)}</button>`)
      .join('')}</div>`;
    const table = (rows: ReadonlyArray<[string, string]>) => `<dl class="ts-ctl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    const body =
      this.howTab === 'goal'
        ? `<p class="ts-p">${esc(HOW_TO_GOAL)}</p><p class="ts-p">${esc(HOW_TO_TIPS)}</p>` +
          '<p class="ts-p ts-ok">ไม่รู้ต้องทำอะไร? ดูแถบภารกิจมุมขวาบน — บอกภารกิจ เป้าหมาย และคำแนะนำเสมอ</p>'
        : this.howTab === 'touch'
          ? table(TOUCH_CONTROLS)
          : this.howTab === 'scale'
            ? `<p class="ts-p ts-ok">${esc(HOW_TO_SCALE)}</p><p class="ts-p">แถบมาตราส่วนในแถบสถานะ (มุมซ้ายบน) ยาว 50 ม. = 5 ช่อง · ปุ่ม 📏 วัดระยะ เริ่มวัดจากจุดที่ยืน</p>`
            : table(KEYBOARD_CONTROLS);
    return this.panel('วิธีเล่น', body, back, { tabs: tabHtml });
  }

  /* ----- แผนที่การเดินทาง ----- */

  private journeyHtml(w: number): string {
    const v = journeyView(this.progress().data);
    const sel = v.nodes.find((n) => n.id === this.journeySel) ?? v.nodes.find((n) => n.state === 'current') ?? v.nodes[v.nodes.length - 1];
    const icon = { explored: '✓', current: '▶', next: '⭐', locked: '🔒' } as const;
    const codes = v.codes.map((c) => `<span class="ts-chip${c === '?' ? ' ts-missing' : ''}">${esc(c)}</span>`).join('');
    // ลำดับเรื่องจากบนลงล่าง (สักงาม → … → ปริศนาสุดท้าย) — แตะเพื่อดูข้อมูลเท่านั้น ไม่เข้าเล่นบทนั้น
    const nodes = v.nodes
      .map(
        (n) =>
          `<button class="ts-btn ts-node ts-${n.state}${n.id === sel.id ? ' ts-sel' : ''}" data-act="journey:select:${esc(n.id)}" aria-label="ดูข้อมูลบทที่ ${n.order}">` +
          `<span class="ts-node-i">${icon[n.state]}</span><span class="ts-node-t"><b>บทที่ ${n.order} · ${esc(n.tambon)}</b>` +
          `<span class="ts-node-s">${esc(n.stateLabel)}${n.inProgress ? ' · มีบันทึกค้าง' : ''}</span></span></button>`,
      )
      .join('');
    const tone = { normal: '', warn: ' ts-warn', bad: ' ts-bad' }[v.notice.tone];
    const detail =
      `<h3 class="ts-h3">บทที่ ${sel.order} · ${esc(sel.tambon)}</h3><p class="ts-p"><b>${esc(sel.title)}</b></p>` +
      `<p class="ts-p"><b>สถานะ:</b> ${esc(sel.stateLabel)}${sel.inProgress ? ' · มีบันทึกค้างอยู่' : ''}</p>` +
      (sel.inDevelopment ? `<p class="ts-p ts-bad">${esc(IN_DEVELOPMENT_MESSAGE)}</p>` : '') +
      sel.details.map((d) => `<p class="ts-p">${esc(d)}</p>`).join('') +
      `<p class="ts-small${tone}">${esc(v.notice.text)}</p>` +
      `<p class="ts-small">${
        sel.state === 'current'
          ? 'นี่คือภารกิจปัจจุบัน — แตะปุ่มสีเหลืองด้านล่างเพื่อเดินทางต่อ'
          : 'แผนที่นี้แสดงความคืบหน้าของเรื่อง · เดินทางได้ตามลำดับบทเท่านั้น (ไม่ข้ามบท/ไม่ย้อนบทที่ผ่านแล้ว)'
      }</p>`;
    const title = w < 700 ? '🧭 แผนที่การเดินทาง' : `🧭 ${v.title}`;
    return (
      '<div class="ts-screen ts-journey">' +
      `<header class="ts-bar ts-wood"><h1 class="ts-h2">${esc(title)}${v.complete && w < 700 ? ' ✓' : ''}</h1><div class="ts-codes">🔑 รหัสลับ ${codes}</div></header>` +
      '<div class="ts-jmain">' +
      `<nav class="ts-route ts-scroll" data-scroll="route">${nodes}</nav>` +
      '<div class="ts-jside">' +
      `<section class="ts-detail ts-paper ts-scroll" data-scroll="detail">${detail}</section>` +
      '<footer class="ts-foot">' +
      this.btn('journey:menu', 'เมนูหลัก', { icon: '🏠' }) +
      this.btn('journey:go', v.primary.label, { icon: '▶', primary: true, disabled: !v.primary.enabled, cls: 'ts-go' }) +
      '</footer></div></div></div>'
    );
  }

  /* ----- ฉากเชื่อมบท ----- */

  private chapterHtml(w: number): string {
    const host = this.host<ChapterHost>(SCENE.chapter);
    let st: ChapterHost['touchState'];
    try {
      st = host.touchState;
    } catch {
      return ''; // ฉากกำลังเปลี่ยน (บทไม่ถูกต้อง → กลับแผนที่การเดินทาง)
    }
    const v = chapterIntroView(st.chapterId, this.progress().data);
    if (!v) return '';
    const key = `${st.chapterId}|${st.stage}`;
    if (key !== this.chapterKey) {
      this.chapterKey = key;
      this.readySince = performance.now();
    }
    const armed = performance.now() - this.readySince >= DEPART_ARM_MS;
    const chapter = CHAPTERS.find((c) => c.id === st.chapterId)!;
    let speaker: string;
    let text: string;
    let counter = '';
    let foot: string;
    if (st.stage === 'dialogue') {
      const line = v.lines[st.lineIndex];
      speaker = line.speaker;
      text = line.text;
      counter = `${st.lineIndex + 1}/${st.total}`;
      foot =
        this.btn('chapter:journey', 'แผนที่การเดินทาง', { icon: '🧭' }) +
        this.btn('chapter:back', 'ย้อน', { icon: '◀', disabled: st.lineIndex === 0 }) +
        this.btn('chapter:next', st.lineIndex === st.total - 1 ? 'อ่านจบแล้ว' : 'อ่านต่อ', { icon: '▶', primary: true, cls: 'ts-go' });
    } else if (st.stage === 'ready') {
      speaker = 'พร้อมออกเดินทาง';
      text = `${v.heading}: ${v.tambon} — ${v.title}`;
      foot =
        this.btn('chapter:journey', 'แผนที่การเดินทาง', { icon: '🧭' }) +
        this.btn('chapter:depart', `ออกเดินทางไป${chapter.tambon}`, { icon: '▶', primary: true, disabled: !armed, cls: 'ts-go' });
    } else {
      speaker = IN_DEVELOPMENT_MESSAGE;
      text = 'ความคืบหน้าและรหัสลับทั้งหมดถูกบันทึกไว้แล้ว จะเล่นต่อได้เมื่อภารกิจนี้พัฒนาเสร็จ';
      foot = this.btn('chapter:journey', 'กลับแผนที่การเดินทาง', { icon: '🧭', primary: true, cls: 'ts-go' });
    }
    return (
      `<div class="ts-screen ts-chapter${w < 480 ? ' ts-narrow' : ''}">` +
      `<header class="ts-bar ts-wood"><h1 class="ts-h2">${esc(v.heading)} · ${esc(v.tambon)}</h1><div class="ts-sub">${esc(v.title)}</div></header>` +
      '<div class="ts-chap-main">' +
      `<aside class="ts-goal ts-paper ts-scroll" data-scroll="goal"><div class="ts-goal-k">🎯 ภารกิจใหม่</div><p class="ts-p">${esc(v.goal)}</p>` +
      (v.chest ? `<div class="ts-chest">${chestSvg()}<div><div class="ts-chest-k">🔒 ช่องรหัสบนหีบ</div>${chestSlotsHtml(v.chest.slots)}</div></div><p class="ts-small">${esc(v.chest.note)}</p>` : '') +
      '</aside>' +
      `<section class="ts-dlg ts-paper"><div class="ts-speaker"><span>${esc(speaker)}</span><small>${esc(counter)}</small></div>` +
      `<div class="ts-dlg-text ts-scroll" data-scroll="dlg-${st.lineIndex}-${st.stage}">${esc(text)}</div></section>` +
      `</div><footer class="ts-foot">${foot}</footer></div>`
    );
  }

  /* ----- ฉากจบ ----- */

  private endingHtml(w: number, h: number): string {
    const v = endingView(this.progress().data);
    const wide = w >= 760 && h >= 380;
    const codes = `<div class="ts-codes-row">🔑 รหัสลับครบ 4 ชิ้น: ${v.codes.map((c) => `<span class="ts-chip">${esc(c)}</span>`).join('')}</div>`;
    const wisdom =
      `<section>${wide ? '' : `<p class="ts-p ts-ok"><b>✓ ${esc(v.title)}</b> · ${esc(v.subtitle)}</p>${codes}`}<h3 class="ts-h3">🗺️ แผนที่ภูมิปัญญา 4 ตำบล</h3><div class="ts-wisdom">` +
      v.wisdom
        .map(
          (x) =>
            `<div class="ts-wcard"><b>📍 ${x.index}. ${esc(x.tambon)}</b><p class="ts-p">${esc(x.site)}</p>` +
            `<p class="ts-small">ทักษะ: ${esc(x.learning)}</p><p class="ts-small ts-ok">รหัสลับชิ้นที่ ${x.index}: "${esc(x.code)}"${x.evidence ? ` · ${esc(x.evidence)}` : ''}</p></div>`,
        )
        .join('') +
      `</div><p class="ts-small">${esc(v.note)}</p></section>`;
    const learning =
      '<section><h3 class="ts-h3">📊 ผลการเรียนรู้ทั้งการเดินทาง</h3>' +
      v.stats.map((s2) => `<p class="ts-p">${esc(s2)}</p>`).join('') +
      '<h3 class="ts-h3">🧠 ทักษะภูมิศาสตร์ที่ได้ใช้</h3>' +
      (v.skills.length ? `<div class="ts-skills">${v.skills.map((k) => `<span class="ts-skill">${esc(k)}</span>`).join('')}</div>` : '<p class="ts-p">ไม่มีข้อมูลในบันทึก</p>') +
      '</section>';
    // จอเล็ก: แบ่งแท็บ (แผนที่ภูมิปัญญา + รหัสลับ / ผลการเรียนรู้) และเลื่อนอ่าน · จอใหญ่: วางคู่กัน
    const tabs = wide
      ? ''
      : `<div class="ts-tabs">${[
          ['wisdom', '🗺️ แผนที่ภูมิปัญญา'],
          ['learning', '📊 ผลการเรียนรู้'],
        ]
          .map(([id, label]) => `<button class="ts-tab${this.endTab === id ? ' ts-on' : ''}" data-act="ending:tab:${id}">${esc(label)}</button>`)
          .join('')}</div>`;
    const body = wide ? `${codes}<div class="ts-end-cols">${wisdom}${learning}</div>` : this.endTab === 'wisdom' ? wisdom : learning;
    return (
      '<div class="ts-screen ts-ending">' +
      // จอเล็ก: หัวเรื่องสั้นให้แท็บอยู่แถวเดียวกัน (ชื่อเต็มอยู่บรรทัดแรกของเนื้อหา)
      `<header class="ts-bar ts-wood"><div><h1 class="ts-h2">🏆 ${esc(wide ? v.title : 'จบการเดินทาง')}</h1>${wide ? `<div class="ts-sub">${esc(v.subtitle)}</div>` : ''}</div>${tabs}</header>` +
      `<div class="ts-end-body ts-paper ts-scroll" data-scroll="end-${wide ? 'w' : this.endTab}">${body}</div>` +
      `<footer class="ts-foot">${this.btn('ending:journey', 'แผนที่การเดินทาง', { icon: '🧭' })}${this.btn('ending:menu', 'เมนูหลัก', { icon: '🏠', primary: true })}</footer></div>`
    );
  }
}
