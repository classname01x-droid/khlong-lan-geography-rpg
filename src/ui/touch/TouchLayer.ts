import type Phaser from 'phaser';
import { CHAPTERS } from '../../content/story/chapters';
import { THAI_DIRECTION } from '../../core/direction/Compass';
import { buildQuestTracker, HintTracker, totalMistakes, type QuestTrackerView } from '../../core/guide/QuestGuide';
import { pickInteraction, type InteractionTarget } from '../../core/input/Interaction';
import { buildTouchContext, joystickVector, TapGuard, type TouchAction, type TouchContext, type TouchContextInput } from '../../core/input/InputMapping';
import type { GameSession } from '../../core/session/GameSession';
import type { MobileLayout } from '../../core/ui/MobileLayout';
import { GridSystem } from '../../core/world/GridSystem';
import { INTERACT_RADIUS_TILES } from '../../config/constants';
import { FONT_FAMILY } from '../theme';
import { fmtMeters } from '../format';
import { TOUCH_CSS } from './touchStyles';

/** ส่วนของ WorldScene ที่ชั้นปุ่มสัมผัสเรียกใช้ */
interface WorldControls {
  dispatchCode(code: string): void;
  setTouchVector(x: number, y: number): void;
}

const ICON: Record<InteractionTarget['kind'], string> = { npc: '💬', inspect: '🔎', verify: '🧪' };

/**
 * ชั้นควบคุมและข้อมูลบนจอ (DOM ซ้อนบน canvas)
 *   - ทุกอุปกรณ์: แถบติดตามภารกิจ (มุมขวาบน) · ข้อความโต้ตอบตามบริบท ("พูดคุยกับ…")
 *   - จอสัมผัส: จอยสติก 8 ทิศ · ปุ่มคำสั่งตามสถานการณ์ · กล่องบทสนทนา/ตัวเลือกตัวอักษรใหญ่ · แถบสถานะ · คำแนะนำให้หมุนจอ
 * ตรรกะการเลือกปุ่ม/เป้าหมาย/ภารกิจอยู่ใน core (ทดสอบได้) — ไฟล์นี้วาดและส่งรหัสปุ่มเข้า WorldScene.dispatchCode() เท่านั้น
 */
export class TouchLayer {
  private readonly root: HTMLDivElement;
  private readonly joyZone: HTMLDivElement;
  private readonly joyBase: HTMLDivElement;
  private readonly joyKnob: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly sheet: HTMLDivElement;
  private readonly tracker: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly rotate: HTMLDivElement;
  private layout: MobileLayout | null = null;
  private readonly guard = new TapGuard(150);
  private readonly hints = new HintTracker();
  private joyPointer: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lastSig = { actions: '', sheet: '', tracker: '', status: '', prompt: '' };
  private trackerCollapsed = false;
  private trackerDetails = false;
  private paused = false;
  /** ข้อมูลล่าสุดสำหรับการทดสอบอัตโนมัติ */
  lastContext: TouchContext | null = null;
  lastTracker: QuestTrackerView | null = null;
  lastTarget: InteractionTarget | null = null;

  constructor(
    private readonly game: Phaser.Game,
    readonly touch: boolean,
  ) {
    const style = document.createElement('style');
    style.textContent = TOUCH_CSS.replaceAll('__FONT__', FONT_FAMILY);
    document.head.appendChild(style);
    const div = (cls: string, parent: HTMLElement) => {
      const d = document.createElement('div');
      d.className = cls;
      parent.appendChild(d);
      return d;
    };
    this.root = div('tl-root', document.body);
    this.root.classList.toggle('tl-touch', touch);
    this.joyZone = div('tl-joyzone', this.root);
    this.joyBase = div('tl-joybase', this.joyZone);
    this.joyKnob = div('tl-joyknob', this.joyBase);
    this.actions = div('tl-actions', this.root);
    this.sheet = div('tl-sheet', this.root);
    this.tracker = div('tl-tracker', this.root);
    this.status = div('tl-status', this.root);
    this.prompt = div('tl-prompt', this.root);
    this.rotate = div('tl-rotate', this.root);
    this.rotate.innerHTML =
      '<div class="tl-rotate-icon">📱↻</div><div class="tl-rotate-title">กรุณาหมุนโทรศัพท์เป็นแนวนอน</div>' +
      '<div class="tl-rotate-sub">เกมหยุดไว้ชั่วคราว ความคืบหน้าทั้งหมดยังอยู่ครบ</div>';

    this.bindJoystick();
    this.bindTaps();
    // สลับแอป / ซ่อนหน้า / เสียโฟกัส → หยุดเดินทันที
    const stop = () => this.resetJoystick();
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', () => document.hidden && stop());
    window.setInterval(() => this.tick(), 100);
  }

  /* ---------------- การเชื่อมกับเกม ---------------- */

  private world(): WorldControls | null {
    return this.game.scene.isActive('WorldScene') ? (this.game.scene.getScene('WorldScene') as unknown as WorldControls) : null;
  }

  private session(): GameSession | null {
    return this.world() ? ((this.game.registry.get('session') as GameSession | undefined) ?? null) : null;
  }

  private send(code: string): void {
    this.world()?.dispatchCode(code);
  }

  setLayout(l: MobileLayout): void {
    this.layout = l;
    const r = this.root.style;
    r.setProperty('--btn', `${l.button}px`);
    // คอลัมน์ปุ่ม: อยู่ข้างภาพเกม (ไม่ทับฉาก) หรือซ้อนบนขอบภาพเมื่อจอไม่มีที่ว่าง
    const place = (el: HTMLElement, rect: { x: number; y: number; w: number; h: number }) => {
      el.style.left = `${rect.x}px`;
      el.style.top = `${rect.y}px`;
      el.style.width = `${rect.w}px`;
      el.style.height = `${rect.h}px`;
    };
    place(this.joyZone, { ...l.left, y: l.left.y + l.left.h * 0.3, h: l.left.h * 0.7 });
    place(this.actions, l.right);
    this.root.classList.toggle('tl-columns', l.sideColumns);
    this.root.classList.toggle('tl-compact', l.compact);
    const showRotate = this.touch && l.portrait;
    this.rotate.style.display = showRotate ? 'flex' : 'none';
    // แนวตั้ง: หยุดเกมชั่วคราว (สถานะไม่หาย) · กลับแนวนอน: เล่นต่อ
    if (showRotate && !this.paused) {
      this.paused = true;
      this.resetJoystick();
      this.game.loop.sleep();
    } else if (!showRotate && this.paused) {
      this.paused = false;
      this.game.loop.wake();
    }
  }

  /** พื้นที่ของ canvas บนหน้าจอ (ใช้วางแถบภารกิจ/กล่องข้อความให้อยู่บนภาพเกม) */
  private canvasRect(): DOMRect {
    return this.game.canvas.getBoundingClientRect();
  }

  /* ---------------- จอยสติก ---------------- */

  private bindJoystick(): void {
    const z = this.joyZone;
    z.addEventListener('pointerdown', (e) => {
      if (this.joyPointer !== null || !this.root.classList.contains('tl-walk')) return;
      e.preventDefault();
      this.joyPointer = e.pointerId;
      z.setPointerCapture(e.pointerId);
      // จอยสติกลอย: จุดกึ่งกลางอยู่ที่นิ้วแตะแรก (ภายในโซนซ้าย)
      const zr = z.getBoundingClientRect();
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.joyBase.style.left = `${e.clientX - zr.left}px`;
      this.joyBase.style.top = `${e.clientY - zr.top}px`;
      this.joyBase.classList.add('tl-active');
      this.moveJoystick(e.clientX, e.clientY);
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      e.preventDefault();
      this.moveJoystick(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.joyPointer) this.resetJoystick();
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
    z.addEventListener('lostpointercapture', end);
  }

  private joyRadius(): number {
    return (this.layout?.button ?? 48) * 1.15;
  }

  private moveJoystick(x: number, y: number): void {
    const r = this.joyRadius();
    const dx = x - this.joyOrigin.x;
    const dy = y - this.joyOrigin.y;
    const v = joystickVector(dx, dy, r);
    const k = Math.min(1, r / Math.max(1, Math.hypot(dx, dy)));
    this.joyKnob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.world()?.setTouchVector(v.x, v.y);
  }

  private resetJoystick(): void {
    this.joyPointer = null;
    this.joyKnob.style.transform = 'translate(0px, 0px)';
    this.joyBase.classList.remove('tl-active');
    this.world()?.setTouchVector(0, 0);
  }

  /* ---------------- ปุ่ม ---------------- */

  /** ปุ่มทุกปุ่มใช้ pointerdown + TapGuard → แตะครั้งเดียวได้คำสั่งเดียว (ตัด click/mouse จำลองทิ้ง) */
  private bindTaps(): void {
    this.root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-code],[data-ui]');
      if (!el || !this.root.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      if (el.hasAttribute('disabled')) return;
      const key = el.dataset.code ?? el.dataset.ui ?? '';
      if (!this.guard.accept(key, performance.now())) return;
      if (el.dataset.code) this.send(el.dataset.code);
      else this.onUi(el.dataset.ui!);
      window.setTimeout(() => this.tick(), 0);
    });
    // กันเมนูกดค้าง/เลือกข้อความ/ซูมสองนิ้วบนชั้นปุ่ม
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('click', (e) => e.preventDefault());
  }

  private onUi(id: string): void {
    if (id === 'tracker-toggle') this.trackerCollapsed = !this.trackerCollapsed;
    if (id === 'tracker-details') this.trackerDetails = !this.trackerDetails;
    if (id === 'tracker-hint') {
      this.hints.requestMore();
      this.trackerDetails = true;
      this.trackerCollapsed = false;
    }
    this.lastSig.tracker = '';
  }

  private button(a: TouchAction, extra = ''): string {
    const cls = ['tl-btn', `tl-a-${a.id}`, a.primary ? 'tl-primary' : '', a.selected ? 'tl-selected' : '', extra].join(' ');
    return (
      `<button class="${cls}" data-code="${a.code}"${a.enabled ? '' : ' disabled'} aria-label="${esc(a.label)}">` +
      `<span class="tl-icon">${esc(a.icon)}</span><span class="tl-label">${esc(a.label)}</span></button>`
    );
  }

  /* ---------------- วาดตามสถานะ ---------------- */

  private contextInput(s: GameSession, target: InteractionTarget | null): TouchContextInput {
    const L = s.level;
    const analysisDef = L.integratedSiteAnalysis ?? L.gridSiteAnalysis;
    const view = s.mode === 'dialogue' ? s.dialogueView : null;
    return {
      mode: s.mode,
      interact: target ? { label: target.label, verb: target.verb } : null,
      analysis: analysisDef
        ? { available: s.isAnalysisOpen() || s.analysisSolved, label: 'วิเคราะห์' }
        : L.mapComparison
          ? { available: s.availableSheets().length >= 2, label: 'เทียบแผนที่' }
          : null,
      dialogue: view ? { kind: view.kind, choices: view.kind === 'quiz' ? view.choices : [] } : null,
      map: {
        pinStage: s.pinStage,
        canSwitchSheet: s.availableSheets().length > 0,
        wisdomChoices: (L.pinTask?.wisdomChoices ?? []).map((c) => s.resolveText(c.label)),
      },
      notebook: {
        routeChoices: s.notebookTab === 'routes' && L.routeAnalysis ? L.routeAnalysis.routes.map((r) => `เส้นทาง ${r.label}`) : [],
      },
      compareChoices: s.availableSheets().map((m) => m.title),
      grid: { choices: (analysisDef?.candidates ?? []).map((c) => c.label), selected: s.gridSelection, solved: s.analysisSolved },
    };
  }

  private tick(): void {
    const s = this.session();
    const show = !!s && !this.paused;
    this.root.classList.toggle('tl-ingame', show);
    if (!s || !show) {
      if (this.joyPointer !== null) this.resetJoystick();
      this.setHtml('actions', this.actions, '');
      this.setHtml('sheet', this.sheet, '');
      this.setHtml('tracker', this.tracker, '');
      this.setHtml('status', this.status, '');
      this.setHtml('prompt', this.prompt, '');
      return;
    }
    const cr = this.canvasRect();
    const target = s.mode === 'explore' ? pickInteraction(s, INTERACT_RADIUS_TILES) : null;
    this.lastTarget = target;
    const ctx = buildTouchContext(this.contextInput(s, target));
    this.lastContext = ctx;
    this.root.classList.toggle('tl-walk', this.touch && ctx.joystick);
    if (!ctx.joystick && this.joyPointer !== null) this.resetJoystick();

    // ---- ปุ่มคำสั่ง (จอสัมผัส) ----
    this.setHtml('actions', this.actions, this.touch ? ctx.actions.map((a) => this.button(a)).join('') : '');
    this.actions.classList.toggle('tl-explore', s.mode === 'explore');

    // ---- กล่องบทสนทนา / แผ่นตัวเลือก (จอสัมผัส) ----
    this.renderSheet(s, ctx, cr);

    // ---- แถบติดตามภารกิจ (ทุกอุปกรณ์ ขณะสำรวจ) ----
    const chapter = CHAPTERS.find((c) => c.levelId === s.level.id);
    const tier = this.hints.update(s.currentStepOrder, s.elapsedMs, totalMistakes(s));
    const tr = buildQuestTracker(s, { chapterOrder: chapter?.order, hintTier: tier });
    this.lastTracker = tr;
    this.renderTracker(s.mode === 'explore' ? tr : null, cr);

    // ---- แถบสถานะ (จอสัมผัส) และข้อความโต้ตอบ ----
    if (this.touch && s.mode === 'explore') {
      const pos = s.coords ? GridSystem.format(s.coords.tileToGrid(s.playerTile)) : `ช่อง X ${s.playerTile.x}, Y ${s.playerTile.y}`;
      const html =
        `<div>📍 ${esc(pos)}</div><div>🧭 หันไป${esc(THAI_DIRECTION[s.facing])} · เหนืออยู่ด้านบน</div>` +
        `<div>📏 วัดระยะ ${esc(fmtMeters(s.odometer.tripMeters))} · รวม ${esc(fmtMeters(s.odometer.totalMeters))}</div>`;
      this.setHtml('status', this.status, html);
      this.status.style.left = `${cr.left + 8}px`;
      this.status.style.top = `${cr.top + 8}px`;
    } else this.setHtml('status', this.status, '');
    if (target) {
      const key = this.touch ? '' : ' <span class="tl-key">E</span>';
      this.setHtml('prompt', this.prompt, `${ICON[target.kind]} ${esc(target.label)}${key}`);
      this.prompt.style.left = `${cr.left + cr.width / 2}px`;
      this.prompt.style.top = `${cr.bottom - (this.touch ? 12 : 56)}px`;
    } else this.setHtml('prompt', this.prompt, '');
  }

  private renderSheet(s: GameSession, ctx: TouchContext, cr: DOMRect): void {
    if (!this.touch) {
      this.setHtml('sheet', this.sheet, '');
      return;
    }
    let html = '';
    const view = s.mode === 'dialogue' ? s.dialogueView : null;
    if (view) {
      // บทสนทนาตัวอักษรใหญ่ แทนกล่องใน canvas (อ่านง่ายบนจอเล็ก)
      const body = view.kind === 'quiz' ? view.question : view.text;
      html += `<div class="tl-dlg${ctx.tapToAdvance ? ' tl-tap' : ''}"${ctx.tapToAdvance ? ' data-code="Space"' : ''}>`;
      html += `<div class="tl-speaker">${esc(view.speaker)} <span class="tl-step">${view.step}/${view.total}</span></div>`;
      html += `<div class="tl-text">${esc(body)}</div>`;
      if (view.kind === 'quiz' && view.feedback) html += `<div class="tl-feedback">${esc(view.feedback)}</div>`;
      html += '</div>';
    } else if (ctx.sheet?.title) {
      html += `<div class="tl-sheet-title">${esc(ctx.sheet.title)}</div>`;
    }
    if (ctx.sheet) html += `<div class="tl-options">${ctx.sheet.options.map((o) => this.button(o, 'tl-option')).join('')}</div>`;
    this.setHtml('sheet', this.sheet, html);
    const margin = this.layout?.sideColumns ? 6 : (this.layout?.button ?? 48) * 2 + 20;
    this.sheet.style.left = `${cr.left + margin}px`;
    this.sheet.style.width = `${Math.max(240, cr.width - margin * 2)}px`;
    this.sheet.style.bottom = `${window.innerHeight - cr.bottom + 6}px`;
    this.sheet.style.maxHeight = `${cr.height * 0.72}px`;
  }

  private renderTracker(t: QuestTrackerView | null, cr: DOMRect): void {
    if (!t) {
      this.setHtml('tracker', this.tracker, '');
      return;
    }
    const compact = this.layout?.compact ?? false;
    const prog = `${t.progress.done}/${t.progress.total}`;
    let html = '';
    if (this.trackerCollapsed) {
      html = `<button class="tl-tr-pill" data-ui="tracker-toggle">📜 ภารกิจ ${esc(prog)} ▾</button>`;
    } else {
      html += `<div class="tl-tr-head"><span class="tl-tr-chapter">${esc(t.chapterLabel)}</span>`;
      html += `<button class="tl-tr-mini" data-ui="tracker-toggle" aria-label="ย่อแถบภารกิจ">▴ ย่อ</button></div>`;
      html += `<div class="tl-tr-quest">ภารกิจ: ${esc(t.questTitle)}</div>`;
      html += `<div class="tl-tr-obj"><span class="tl-tr-label">เป้าหมาย:</span> ${esc(t.objective)} <span class="tl-tr-prog">${esc(prog)}</span></div>`;
      const showDetails = this.trackerDetails || !compact;
      if (t.hint && showDetails) html += `<div class="tl-tr-hint">💡 คำแนะนำ: ${esc(t.hint)}</div>`;
      if (this.trackerDetails) {
        if (t.remaining.length > 1) html += `<div class="tl-tr-list">ยังเหลือ: ${t.remaining.map(esc).join(' · ')}</div>`;
        if (t.sideQuests.length) html += `<div class="tl-tr-list">ภารกิจรอง/ปริศนา: ${t.sideQuests.map(esc).join(' · ')}</div>`;
        html += `<div class="tl-tr-list">ฉาก ${t.step.current}/${t.step.total}</div>`;
      }
      html += '<div class="tl-tr-btns">';
      if (compact) html += `<button class="tl-tr-mini" data-ui="tracker-details">${this.trackerDetails ? 'ซ่อนรายละเอียด' : 'รายละเอียด'}</button>`;
      if (!t.complete && t.hintTier < 2) html += `<button class="tl-tr-mini" data-ui="tracker-hint">💡 ${t.hintTier === 0 ? 'ขอคำแนะนำ' : 'คำแนะนำเพิ่ม'}</button>`;
      html += '</div>';
    }
    this.setHtml('tracker', this.tracker, html);
    const w = Math.min(compact ? 290 : 340, cr.width * (compact ? 0.5 : 0.42));
    this.tracker.style.width = this.trackerCollapsed ? 'auto' : `${w}px`;
    this.tracker.style.right = `${window.innerWidth - cr.right + 8}px`;
    this.tracker.style.top = `${cr.top + 8}px`;
  }

  private setHtml(key: keyof TouchLayer['lastSig'], el: HTMLElement, html: string): void {
    if (this.lastSig[key] === html) return;
    this.lastSig[key] = html;
    el.innerHTML = html;
    el.style.display = html ? '' : 'none';
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
