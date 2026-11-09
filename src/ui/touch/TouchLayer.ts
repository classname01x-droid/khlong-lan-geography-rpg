import type Phaser from 'phaser';
import { CHAPTERS } from '../../content/story/chapters';
import { THAI_DIRECTION } from '../../core/direction/Compass';
import { buildQuestTracker, HintTracker, hintKey, totalMistakes, type QuestTrackerView } from '../../core/guide/QuestGuide';
import { pickInteraction, type InteractionTarget } from '../../core/input/Interaction';
import { buildTouchContext, joystickVector, TapGuard, type ActionId, type TouchAction, type TouchContext, type TouchContextInput } from '../../core/input/InputMapping';
import type { GuideActionId } from '../../content/types';
import { measureDetail, measureHeadline } from '../../core/measure/Measure';
import type { CodePiece, ProgressStore } from '../../core/progress/ProgressStore';
import type { GameSession, NotebookTab } from '../../core/session/GameSession';
import { MAP_ZOOMS, readableZoomIndex } from '../../core/ui/MapViewport';
import { hudWidths, type MobileLayout } from '../../core/ui/MobileLayout';
import { GridSystem } from '../../core/world/GridSystem';
import { CAMERA_ZOOM, GAME_WIDTH, INTERACT_RADIUS_TILES } from '../../config/constants';
import { EVENT_TOUCH_TOAST, REGISTRY_CODE_PIECES, REGISTRY_PROGRESS, REGISTRY_UNLOCKED } from '../../scenes/events';
import { PAUSE_ITEMS } from '../../scenes/WorldScene';
import { FONT_FAMILY } from '../theme';
import { boardTitle, buildBoardView } from '../views/boardView';
import { buildCompareLines, COMPARE_TITLE } from '../views/compareView';
import { mapInfoShort, mapPinLines, mapTitle } from '../views/mapText';
import { buildNotebookView, NOTEBOOK_TAB_LABEL } from '../views/notebookView';
import { buildSummaryView } from '../views/summaryView';
import { touchWording } from '../views/touchWording';
import type { TutorialHighlight, TutorialView } from '../../core/tutorial/Tutorial';
import { boardReader, compareReader, esc, notebookReader, summaryReader, type BoardTab, type ReaderContent } from './readerHtml';
import { TOUCH_CSS } from './touchStyles';
import { setTouchView, touchView } from './touchViewState';
import { setHudObstacles } from '../hudObstacles';
import { cssToGame, gameToCss, PinGesture, pinHitRadius } from '../../core/ui/PinGesture';

/** ส่วนของ WorldScene ที่ชั้นปุ่มสัมผัสเรียกใช้ */
/** ส่วนของ UIScene ที่ชั้นปักหมุดใช้ (พิกัดภาพเกม 960×640) */
interface MapControls {
  mapTileAt(gx: number, gy: number): { x: number; y: number } | null;
  mapTileCenter(t: { x: number; y: number }): { x: number; y: number };
  mapCellPx(): number;
  mapPanPosition(): { x: number; y: number } | null;
  mapPanFrom(from: { x: number; y: number }, dx: number, dy: number): void;
}

interface WorldControls {
  dispatchCode(code: string): void;
  setPinCursor(tile: { x: number; y: number }): boolean;
  setTouchVector(x: number, y: number): void;
  tutorialViewFor(touch: boolean): TutorialView | null;
  tutorialAction(action: 'skip' | 'finish'): void;
  guideAction(id: GuideActionId): void;
  measureAction(action: 'restart' | 'stop'): void;
}

/** ปุ่มลัดของแถบภารกิจ → ปุ่มเครื่องมือที่ไฮไลต์ในคอลัมน์ปุ่ม (จอสัมผัส) */
const GUIDE_TO_BUTTON: Record<GuideActionId, ActionId> = {
  settlement: 'analysis',
  map: 'map',
  pin: 'map',
  target: 'map',
  sheets: 'map',
  clues: 'notebook',
  routes: 'analysis',
  measure: 'measure',
  analysis: 'analysis',
  compare: 'analysis',
};

const ICON: Record<InteractionTarget['kind'], string> = { npc: '💬', inspect: '🔎', verify: '🧪' };
const PAUSE_ICON: Record<string, string> = { เล่นต่อ: '▶', แผนที่การเดินทาง: '🧭', กลับเมนูหลัก: '🏠' };

/** เข็มทิศเล็กในแถบสถานะ (แผนที่และโลกเกมหันทิศเหนือขึ้นด้านบนเสมอ) */
const COMPASS_SVG =
  '<svg class="tl-compass" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#10141f" stroke="#e8d9a8" stroke-width="2"/>' +
  '<path d="M20 6 L25 20 L15 20 Z" fill="#d94b4b"/><path d="M20 34 L25 20 L15 20 Z" fill="#f4efe1"/>' +
  '<text x="20" y="5.5" font-size="7" text-anchor="middle" fill="#ffd84d" dominant-baseline="hanging">N</text></svg>';

type SigKey =
  | 'actions'
  | 'sheet'
  | 'tracker'
  | 'status'
  | 'prompt'
  | 'rdTitle'
  | 'rdTabs'
  | 'rdBody'
  | 'rdFoot'
  | 'mapbar'
  | 'mapinfo'
  | 'legend'
  | 'coach'
  | 'measure';

/**
 * ชั้นควบคุมและข้อมูลบนจอ (DOM ซ้อนบน canvas)
 *   - ทุกอุปกรณ์: แถบติดตามภารกิจ (มุมขวาบน) · ข้อความโต้ตอบตามบริบท ("พูดคุยกับ…")
 *   - จอสัมผัส: จอยสติก 8 ทิศ · ปุ่มคำสั่งตามสถานการณ์ · กล่องบทสนทนา/ตัวเลือกตัวอักษรใหญ่ · แถบสถานะ (เข็มทิศ + แถบมาตราส่วน)
 *     · หน้าอ่านตัวอักษรใหญ่ (สมุด กระดานวิเคราะห์ หลักฐาน หน้าสรุป เมนูหยุดเกม) แบ่งแท็บและเลื่อนอ่านได้
 *     · แถบหัวแผนที่/สถานะหมุด · ข้อความแจ้งเตือน · คำแนะนำให้หมุนจอ
 * ตรรกะการเลือกปุ่ม/เป้าหมาย/ภารกิจ/ข้อความอยู่ใน core และ ui/views (ทดสอบได้)
 * ไฟล์นี้วาดและส่งรหัสปุ่มเข้า WorldScene.dispatchCode() เท่านั้น
 */
export class TouchLayer {
  private readonly root: HTMLDivElement;
  /** ชั้นรับการแตะ/ลากบนแผนที่ (ปักหมุด/เลื่อนแผนที่) — อยู่เหนือ canvas ใต้แถบและปุ่มทั้งหมด */
  private readonly pinpad: HTMLDivElement;
  /** ป้ายพิกัดหมุด (X/Y หรือ E/N) เหนือหมุด อัปเดตทันทีขณะลาก */
  private readonly pinBadge: HTMLDivElement;
  private readonly pinGesture = new PinGesture();
  private panStart: { x: number; y: number } | null = null;
  /** เพื่อการทดสอบ: ผลการแตะ/ลากครั้งล่าสุดบนแผนที่ */
  lastPinGesture: string = '';
  private readonly joyZone: HTMLDivElement;
  private readonly joyBase: HTMLDivElement;
  private readonly joyKnob: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly sheet: HTMLDivElement;
  private readonly tracker: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly rotate: HTMLDivElement;
  private readonly reader: HTMLDivElement;
  private readonly rdTitle: HTMLDivElement;
  private readonly rdTabs: HTMLDivElement;
  private readonly rdBody: HTMLDivElement;
  private readonly rdMore: HTMLDivElement;
  private readonly rdFoot: HTMLDivElement;
  private readonly mapbar: HTMLDivElement;
  private readonly mapinfo: HTMLDivElement;
  private readonly legend: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  /** การ์ดบทแนะนำผู้เล่นใหม่ */
  private readonly coach: HTMLDivElement;
  private readonly measureEl: HTMLDivElement;
  /** ปุ่ม/ส่วนที่บทแนะนำกำลังชี้ (ไฮไลต์) */
  private coachHi: TutorialHighlight | null = null;
  /** แตะ "ข้ามบทแนะนำ" ครั้งแรก = ถามยืนยัน (แตะซ้ำภายในเวลานี้จึงข้าม) */
  private skipArmedUntil = 0;
  private layout: MobileLayout | null = null;
  private readonly guard = new TapGuard(150);
  private readonly hints = new HintTracker();
  private joyPointer: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private readonly lastSig: Record<SigKey, string> = {
    measure: '',
    actions: '',
    sheet: '',
    tracker: '',
    status: '',
    prompt: '',
    rdTitle: '',
    rdTabs: '',
    rdBody: '',
    rdFoot: '',
    mapbar: '',
    mapinfo: '',
    legend: '',
    coach: '',
  };
  private trackerCollapsed = false;
  /** เป้าหมายล่าสุดที่แสดง (ใช้ตรวจว่าเปลี่ยนแล้ว) และเวลาที่ยังแสดง "เป้าหมายใหม่" */
  private trackerKey = '';
  private trackerFlashUntil = 0;
  private trackerFlashText = '✓ สำเร็จ! เป้าหมายใหม่';
  private trackerDetails = false;
  private paused = false;
  private lastMode = '';
  private boardTab: BoardTab = 'evidence';
  private readerPage = '';
  private resultSig = '';
  private compareSig = '';
  private readonly toastQueue: string[] = [];
  private toastTimer: number | null = null;
  /** ข้อมูลล่าสุดสำหรับการทดสอบอัตโนมัติ */
  lastContext: TouchContext | null = null;
  lastTracker: QuestTrackerView | null = null;
  lastTarget: InteractionTarget | null = null;
  lastReader: ReaderContent | null = null;
  lastTutorial: TutorialView | null = null;

  /** UI เดียวทุกอุปกรณ์ (แบบมือถือ) — คงชื่อไว้ให้โค้ดที่ส่งต่อค่า touch ใช้ได้ */
  readonly touch = true;

  constructor(private readonly game: Phaser.Game) {
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
    this.root.classList.toggle('tl-touch', true);
    // ลูกแรกของชั้น → อยู่ใต้แถบแผนที่/ปุ่ม/แผ่นตัวเลือก (ที่สร้างทีหลัง) แต่อยู่เหนือ canvas
    this.pinpad = div('tl-pinpad', this.root);
    this.pinBadge = div('tl-pinbadge', this.root);
    this.joyZone = div('tl-joyzone', this.root);
    this.joyBase = div('tl-joybase', this.joyZone);
    this.joyKnob = div('tl-joyknob', this.joyBase);
    this.mapbar = div('tl-mapbar', this.root);
    this.mapinfo = div('tl-mapinfo', this.root);
    this.legend = div('tl-legend', this.root);
    this.reader = div('tl-reader', this.root);
    const head = div('tl-rd-head', this.reader);
    this.rdTitle = div('tl-rd-title', head);
    this.rdTabs = div('tl-rd-tabs', head);
    this.rdBody = div('tl-rd-body', this.reader);
    this.rdMore = div('tl-rd-more', this.reader);
    this.rdMore.textContent = '▼ เลื่อนลงเพื่ออ่านต่อ';
    this.rdFoot = div('tl-rd-foot', this.reader);
    this.actions = div('tl-actions', this.root);
    this.sheet = div('tl-sheet', this.root);
    this.tracker = div('tl-tracker', this.root);
    this.status = div('tl-status', this.root);
    this.prompt = div('tl-prompt', this.root);
    this.toast = div('tl-toast', this.root);
    this.coach = div('tl-coach-card', this.root);
    this.measureEl = div('tl-measure', this.root);
    // ส่วนที่วาดตามสถานะเริ่มแบบซ่อน (ไม่มีกรอบเปล่าค้างที่มุมจอก่อนมีเนื้อหา)
    for (const el of [this.actions, this.sheet, this.tracker, this.status, this.prompt, this.mapbar, this.mapinfo, this.legend, this.coach, this.measureEl])
      el.style.display = 'none';
    this.rotate = div('tl-rotate', this.root);
    this.rotate.innerHTML =
      '<div class="tl-rotate-icon">📱↻</div><div class="tl-rotate-title">กรุณาหมุนโทรศัพท์เป็นแนวนอน</div>' +
      '<div class="tl-rotate-sub">เกมหยุดไว้ชั่วคราว ความคืบหน้าทั้งหมดยังอยู่ครบ</div>';

    this.bindJoystick();
    this.bindTaps();
    this.bindPinPad();
    this.rdBody.addEventListener('scroll', () => this.updateMore(), { passive: true });
    // สลับแอป / ซ่อนหน้า / เสียโฟกัส → หยุดเดินทันที
    const stop = () => this.resetJoystick();
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', () => document.hidden && stop());
    game.events.on(EVENT_TOUCH_TOAST, (msg: string) => this.pushToast(msg));
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
    // จอยสติกไม่กว้างเกินคอลัมน์ซ้าย (ไม่ล้นขอบจอ/รอยบาก)
    r.setProperty('--joy', `${Math.round(Math.min(l.button * 2.3, l.left.w - 10))}px`);
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
    // คอลัมน์ปุ่มแคบ: ไอคอนอยู่เหนือชื่อปุ่ม (ชื่อปุ่มไม่ถูกตัดกลางคำ)
    this.root.classList.toggle('tl-narrowcol', l.right.w < 132);
    const showRotate = l.portrait;
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
    const l = this.layout;
    return l ? Math.min(l.button * 2.3, l.left.w - 10) / 2 : 55;
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

  /* ---------------- แผนที่: แตะเพื่อย้ายหมุด · ลากหมุด · ลากที่อื่นเพื่อเลื่อนแผนที่ ---------------- */

  private mapControls(): MapControls | null {
    return this.game.scene.isActive('UIScene') ? (this.game.scene.getScene('UIScene') as unknown as MapControls) : null;
  }

  /**
   * ใช้ Pointer Events (มือถือทุกยี่ห้อ/แท็บเล็ต/เมาส์) + touch-action: none
   * และกัน touchstart/touchmove ของเบราว์เซอร์ (เลื่อนหน้า/ซูมด้วยการแตะสองครั้ง) ด้วย preventDefault แบบ passive:false
   * พิกัดคำนวณจากตำแหน่ง canvas ณ ตอนแตะทุกครั้ง
   */
  private bindPinPad(): void {
    const pad = this.pinpad;
    const block = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    pad.addEventListener('touchstart', block, { passive: false });
    pad.addEventListener('touchmove', block, { passive: false });
    pad.addEventListener('pointerdown', (e) => {
      const s = this.session();
      const m = this.mapControls();
      if (!s || s.mode !== 'map' || !m) return;
      e.preventDefault();
      const cr = this.canvasRect();
      let onPin = false;
      if (s.pinStage === 'cursor' && s.pinCursor) {
        const c = m.mapTileCenter(s.pinCursor);
        const css = gameToCss(c.x, c.y, cr);
        onPin = Math.hypot(e.clientX - css.x, e.clientY - css.y) <= pinHitRadius((m.mapCellPx() * cr.width) / GAME_WIDTH);
      }
      if (!this.pinGesture.down(e.pointerId, e.clientX, e.clientY, onPin)) return;
      try {
        pad.setPointerCapture(e.pointerId);
      } catch {
        /* บางเบราว์เซอร์จับนิ้วไม่ได้ — ยังทำงานได้จาก pointermove ปกติ */
      }
      this.panStart = m.mapPanPosition();
      if (onPin) this.lastPinGesture = 'pin-start';
    });
    pad.addEventListener('pointermove', (e) => {
      const m = this.mapControls();
      if (!m || e.pointerId !== this.pinGesture.pointerId) return;
      e.preventDefault();
      const mode = this.pinGesture.move(e.pointerId, e.clientX, e.clientY, !!this.panStart);
      if (mode === 'pin') this.movePinTo(e.clientX, e.clientY);
      else if (mode === 'pan' && this.panStart) {
        const k = GAME_WIDTH / this.canvasRect().width;
        const st = this.pinGesture.start;
        m.mapPanFrom(this.panStart, (e.clientX - st.x) * k, (e.clientY - st.y) * k);
        this.placePinBadge();
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pinGesture.pointerId) return;
      const start = { ...this.pinGesture.start };
      const r = this.pinGesture.up(e.pointerId);
      this.lastPinGesture = r;
      // แตะ = ย้ายหมุดไปช่องที่ "นิ้ววางลง" (นิ้วที่สั่นตอนยกไม่ทำให้ไปช่องข้าง ๆ) · ลากหมุด = วางที่ช่องที่ปล่อยนิ้ว
      if (r === 'tap') this.movePinTo(start.x, start.y);
      else if (r === 'pin') this.movePinTo(e.clientX, e.clientY);
      this.panStart = null;
    };
    pad.addEventListener('pointerup', end);
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== this.pinGesture.pointerId) return;
      this.pinGesture.reset();
      this.panStart = null;
      this.lastPinGesture = 'cancel';
    };
    pad.addEventListener('pointercancel', cancel);
    pad.addEventListener('lostpointercapture', (e) => {
      // ปล่อยนิ้วปกติจะได้ pointerup ก่อน — ถ้าไม่มี (เบราว์เซอร์ยกเลิกเอง) ล้างสถานะ ไม่ให้ค้าง
      if (e.pointerId === this.pinGesture.pointerId) cancel(e);
    });
  }

  /** ย้ายหมุดไปช่องใต้นิ้ว แล้วอัปเดตพิกัดบนจอทันที (ไม่รอรอบวาด 100 ms) */
  private movePinTo(clientX: number, clientY: number): void {
    const m = this.mapControls();
    const w = this.world();
    const s = this.session();
    if (!m || !w || !s || s.mode !== 'map' || s.pinStage !== 'cursor') return;
    const g = cssToGame(clientX, clientY, this.canvasRect());
    const tile = m.mapTileAt(g.x, g.y);
    if (!tile) return;
    if (w.setPinCursor(tile)) this.tick();
  }

  /** ป้ายพิกัดเหนือหมุด (ขั้นเลือกตำแหน่ง) */
  private placePinBadge(): void {
    const s = this.session();
    const m = this.mapControls();
    const show = !!s && !!m && s.mode === 'map' && s.pinStage === 'cursor' && !!s.pinCursor;
    if (!show) {
      this.pinBadge.style.display = 'none';
      return;
    }
    const t = s!.pinCursor!;
    const icon = s!.mapTool === 'settlement' ? '🔍' : '📍';
    const sa = s!.mapTool === 'settlement' ? s!.level.settlementAnalysis : undefined;
    const ring = sa ? ` · วงกลม ${s!.scale.tilesToMeters(sa.radiusTiles)} ม.` : '';
    const text = (s!.coords ? `${icon} ${GridSystem.format(s!.coords.tileToGrid(t))}` : `${icon} X ${t.x} · Y ${t.y}`) + ring;
    if (this.pinBadge.textContent !== text) this.pinBadge.textContent = text;
    const cr = this.canvasRect();
    const c = m!.mapTileCenter(t);
    const css = gameToCss(c.x, c.y, cr);
    const cell = (m!.mapCellPx() * cr.width) / GAME_WIDTH;
    this.pinBadge.style.display = 'block';
    this.pinBadge.style.left = `${css.x}px`;
    this.pinBadge.style.top = `${css.y - Math.max(cell * 1.5, 18)}px`;
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
      const key = el.dataset.code || el.dataset.ui || '';
      if (!this.guard.accept(key, performance.now())) return;
      if (el.dataset.code) this.send(el.dataset.code);
      else this.onUi(el.dataset.ui!);
      window.setTimeout(() => this.tick(), 0);
    });
    // กันเมนูกดค้าง/เลือกข้อความ/ซูมสองนิ้วบนชั้นปุ่ม
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('click', (e) => e.preventDefault());
  }

  /** คำสั่งเฉพาะการแสดงผล (ไม่ใช่คำสั่งเกม) */
  private onUi(id: string): void {
    const [name, arg] = id.split(':');
    if (name === 'tracker-toggle') {
      this.trackerCollapsed = !this.trackerCollapsed;
    }
    if (name === 'tracker-details') this.trackerDetails = !this.trackerDetails;
    if (name === 'guide-action') {
      if (arg === 'talk') this.send('KeyE');
      else this.world()?.guideAction(arg as GuideActionId);
    }
    if (name === 'measure-restart') this.world()?.measureAction('restart');
    if (name === 'measure-stop') this.world()?.measureAction('stop');
    if (name === 'tut-skip') {
      // ข้ามบทแนะนำ: แตะ 2 ครั้ง (กันแตะโดนโดยไม่ตั้งใจ) — ภารกิจหลักไม่ถูกข้าม
      const now = performance.now();
      if (now < this.skipArmedUntil) {
        this.skipArmedUntil = 0;
        this.world()?.tutorialAction('skip');
      } else this.skipArmedUntil = now + 3000;
    }
    if (name === 'tut-finish') this.world()?.tutorialAction('finish');
    if (name === 'tracker-hint') {
      this.hints.requestMore();
      // ไม่เปิด "รายละเอียด" (แถบจะยาวจนปุ่มเลื่อนพ้นจอ) — คำแนะนำที่ขอแสดงเต็มอยู่แล้ว
      this.trackerCollapsed = false;
    }
    if (name === 'map-zoom-in') setTouchView({ mapZoomIndex: Math.min(MAP_ZOOMS.length - 1, touchView.mapZoomIndex + 1) });
    if (name === 'map-zoom-out') setTouchView({ mapZoomIndex: Math.max(0, touchView.mapZoomIndex - 1) });
    if (name === 'map-legend') setTouchView({ legend: !touchView.legend });
    if (name === 'compare-tab') setTouchView({ compareTab: arg === 'text' ? 'text' : arg === '1' ? 1 : 0 });
    if (name === 'board-tab') this.boardTab = arg as BoardTab;
    if (name === 'nb-tab') this.gotoNotebookTab(arg as NotebookTab);
    // บังคับวาดแถบภารกิจใหม่ในเฟรมถัดไป — ใช้ค่าเฉพาะที่ไม่เท่ากับ HTML ใด ๆ (ถ้าใช้ '' แล้วเฟรมถัดไปต้องการล้างแถบ จะถูกมองว่าไม่เปลี่ยน
    // และแถบเก่าค้างทับแผนที่ เช่น กดปุ่มลัดแล้วเปิดแผนที่)
    this.lastSig.tracker = '\u0000';
  }

  /** แท็บสมุด: ใช้คำสั่งเปลี่ยนหน้าเดิม (ลูกศรขวา) ทีละหน้าจนถึงแท็บที่แตะ — เส้นทางคำสั่งเดียวกับคีย์บอร์ด */
  private gotoNotebookTab(tab: NotebookTab): void {
    const s = this.session();
    if (!s || s.mode !== 'notebook') return;
    const tabs = s.notebookTabs();
    const steps = (tabs.indexOf(tab) - tabs.indexOf(s.notebookTab) + tabs.length) % tabs.length;
    for (let i = 0; i < steps; i++) this.send('ArrowRight');
  }

  private button(a: TouchAction, extra = ''): string {
    const coach = this.coachHi !== null && this.coachHi === a.id ? 'tl-coach' : '';
    const cls = ['tl-btn', `tl-a-${a.id}`, a.primary ? 'tl-primary' : '', a.selected ? 'tl-selected' : '', a.half ? 'tl-half' : '', coach, extra]
      .filter(Boolean)
      .join(' ');
    const data = a.ui ? `data-ui="${esc(a.ui)}"` : `data-code="${a.code}"`;
    return (
      `<button class="${cls}" ${data}${a.enabled ? '' : ' disabled'} aria-label="${esc(a.label)}">` +
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
          : L.routeAnalysis || L.settlementAnalysis
            ? { available: true, label: 'วิเคราะห์' }
            : null,
      dialogue: view ? { kind: view.kind, choices: view.kind === 'quiz' ? view.choices : [] } : null,
      map: {
        pinStage: s.pinStage,
        tool: s.mapTool,
        canSwitchSheet: s.availableSheets().length > 0,
        wisdomChoices: (L.pinTask?.wisdomChoices ?? []).map((c) => s.resolveText(c.label)),
      },
      notebook: {
        routeChoices: s.notebookTab === 'routes' && L.routeAnalysis ? L.routeAnalysis.routes.map((r) => `เส้นทาง ${r.label}`) : [],
      },
      compareChoices: s.availableSheets().map((m) => m.title),
      grid: { choices: (analysisDef?.candidates ?? []).map((c) => c.label), selected: s.gridSelection, solved: s.analysisSolved },
      view: this.touch
        ? { zoomIndex: touchView.mapZoomIndex, zoomLevels: MAP_ZOOMS.length, legend: touchView.legend, compareTab: touchView.compareTab }
        : undefined,
      pauseItems: this.touch
        ? PAUSE_ITEMS.map((label, index) => ({ index, label, icon: PAUSE_ICON[label] ?? '' })).filter((p) => p.icon)
        : undefined,
    };
  }

  private wording(s: GameSession): (t: string) => string {
    if (!this.touch) return (t) => t;
    const analysisLabel = s.level.mapComparison && !s.level.gridSiteAnalysis && !s.level.integratedSiteAnalysis ? 'เทียบแผนที่' : 'วิเคราะห์';
    return (t) => touchWording(t, { analysisLabel });
  }

  private tick(): void {
    const s = this.session();
    const show = !!s && !this.paused;
    this.root.classList.toggle('tl-ingame', show);
    if (!s || !show) {
      this.pinpad.style.display = 'none';
      this.pinBadge.style.display = 'none';
      if (this.joyPointer !== null) this.resetJoystick();
      for (const [k, el] of [
        ['actions', this.actions],
        ['sheet', this.sheet],
        ['tracker', this.tracker],
        ['status', this.status],
        ['prompt', this.prompt],
        ['mapbar', this.mapbar],
        ['mapinfo', this.mapinfo],
        ['legend', this.legend],
        ['coach', this.coach],
        ['measure', this.measureEl],
      ] as Array<[SigKey, HTMLElement]>)
        this.setHtml(k, el, '');
      this.renderReader(null, this.canvasRect());
      if (!s) this.clearToast();
      return;
    }
    const w = this.wording(s);
    if (s.mode !== this.lastMode) this.onModeChange(s);
    const cr = this.canvasRect();
    // ชั้นแตะแผนที่: เฉพาะตอนเปิดแผนที่ ครอบพื้นที่ภาพเกม
    const padOn = s.mode === 'map';
    this.pinpad.style.display = padOn ? 'block' : 'none';
    if (padOn) Object.assign(this.pinpad.style, { left: `${cr.left}px`, top: `${cr.top}px`, width: `${cr.width}px`, height: `${cr.height}px` });
    else if (this.pinGesture.pointerId !== null) this.pinGesture.reset();
    this.placePinBadge();
    const target = s.mode === 'explore' ? pickInteraction(s, INTERACT_RADIUS_TILES) : null;
    this.lastTarget = target;
    const ctx = buildTouchContext(this.contextInput(s, target));
    this.lastContext = ctx;
    // ---- บทแนะนำ: ขั้นปัจจุบัน + ส่วนที่ต้องไฮไลต์ ----
    const tv = this.world()?.tutorialViewFor(this.touch) ?? null;
    this.lastTutorial = tv;
    this.coachHi = tv?.highlight ?? null;
    this.joyZone.classList.toggle('tl-coach', this.coachHi === 'joystick');
    this.status.classList.toggle('tl-coach', this.coachHi === 'status');
    this.tracker.classList.toggle('tl-coach', this.coachHi === 'tracker');
    this.root.classList.toggle('tl-walk', ctx.joystick);
    if (!ctx.joystick && this.joyPointer !== null) this.resetJoystick();

    // ---- ปุ่มคำสั่ง (จอสัมผัส) ----
    // ปุ่มเครื่องมือที่ขั้นปัจจุบันต้องใช้ → กะพริบ (ผู้เล่นเห็นว่าต้องแตะปุ่มไหน)
    const guideAct = this.lastTracker?.action?.id;
    const guideHi = s.mode === 'explore' && guideAct ? GUIDE_TO_BUTTON[guideAct] : null;
    this.setHtml('actions', this.actions, this.touch ? ctx.actions.map((a) => this.button(a, a.id === guideHi ? 'tl-guide' : '')).join('') : '');
    this.actions.classList.toggle('tl-explore', s.mode === 'explore');

    // ---- แถบหัวแผนที่ / สถานะหมุด (จอสัมผัส) ----
    const barH = this.renderMapBars(s, cr, w);

    // ---- หน้าอ่านตัวอักษรใหญ่ (จอสัมผัส) ----
    const reader = this.touch ? this.readerContent(s, ctx, cr, w) : null;
    this.lastReader = reader;
    this.renderReader(reader, cr, barH);

    // ---- กล่องบทสนทนา / แผ่นตัวเลือก (จอสัมผัส) ----
    this.renderSheet(s, reader ? null : ctx, cr, w);

    // ---- แถบติดตามภารกิจ (ทุกอุปกรณ์ ขณะสำรวจ) ----
    const chapter = CHAPTERS.find((c) => c.levelId === s.level.id);
    // ระดับคำแนะนำเริ่มใหม่ทุกครั้งที่ "ขั้น" เปลี่ยน (บทที่มีขั้นย่อย) หรือฉากเปลี่ยน
    const tier = this.hints.update(hintKey(s), s.elapsedMs, totalMistakes(s));
    const tr = buildQuestTracker(s, { chapterOrder: chapter?.order, hintTier: tier, touch: this.touch });
    this.lastTracker = tr;
    // จอแคบที่ปุ่มซ้อนบนภาพเกม: แถบด้านบนใช้เฉพาะส่วนที่ไม่ถูกคอลัมน์ปุ่มบัง
    const hudInset = this.touch ? this.overlayInset(cr) : 0;
    const widths = hudWidths(cr.width - hudInset, this.layout?.compact ?? false);
    // จอเตี้ยมาก: เริ่มแบบย่อ (ยังเห็นเป้าหมายบรรทัดเดียว) — ผู้เล่นแตะขยายได้
    // v0.17: ไม่ย่อแถบภารกิจเองแล้ว (จอเตี้ยก็ต้องเห็น "ตอนนี้ · วิธีทำ · ขอคำแนะนำ") — ผู้เล่นแตะย่อเองได้
    // ป้าย "คุย" และป้ายชื่อในโลกเกมหลบแถบนี้เอง (v0.16)
    this.exploreMode = s.level.exploreMode === true;
    this.renderTracker(s.mode === 'explore' ? tr : null, cr, w, this.touch ? widths.tracker : Math.min(340, cr.width * 0.42), hudInset);

    // ---- แถบสถานะ (จอสัมผัส) และข้อความโต้ตอบ ----
    if (s.mode === 'explore') this.renderStatus(s, cr, widths);
    else this.setHtml('status', this.status, '');
    this.renderMeasure(s, cr, widths);
    const coachTop = this.renderCoach(tv, s, cr);
    // จอเตี้ย: แถบภารกิจ (ขวาบน) ไม่ยาวลงไปทับการ์ดบทแนะนำ (ล่าง) — เนื้อหาเลื่อนในแถบ ปุ่มติดขอบล่าง
    if (coachTop !== null && this.tracker.style.display !== 'none') {
      const room = Math.floor(coachTop - (cr.top + 8) - 6);
      if (room > 0 && this.tracker.getBoundingClientRect().bottom > coachTop - 6) this.tracker.style.maxHeight = `${room}px`;
    }
    if (target) {
      const key = this.touch ? '' : ' <span class="tl-key">E</span>';
      this.setHtml('prompt', this.prompt, `${ICON[target.kind]} ${esc(target.label)}${key}`);
      this.prompt.style.left = `${cr.left + cr.width / 2}px`;
      // การ์ดบทแนะนำอยู่ด้านล่าง → ข้อความโต้ตอบขึ้นไปอยู่เหนือการ์ด
      this.prompt.style.top = `${coachTop !== null ? coachTop - 6 : cr.bottom - (this.touch ? 12 : 56)}px`;
      this.prompt.style.maxWidth = `${Math.max(160, cr.width - 2 * this.overlayInset(cr) - 24)}px`;
    } else this.setHtml('prompt', this.prompt, '');
    this.placeToast(cr, s.mode === 'explore');
    this.publishObstacles(cr);
  }

  /** เปลี่ยนโหมด: เริ่มหน้าอ่านใหม่จากแท็บแรก */
  private onModeChange(s: GameSession): void {
    this.lastMode = s.mode;
    this.boardTab = 'evidence';
    this.resultSig = '';
    this.compareSig = '';
    if (s.mode === 'compare') setTouchView({ compareTab: 0 });
    // เปิดแผนที่: เริ่มที่ระดับขยายที่อ่านชื่อสถานที่ได้บนจอนี้ (ชื่อสถานที่บนแผนที่จอสัมผัส = 14 px ที่ 1×)
    if ((s.mode === 'map' || s.mode === 'compare')) {
      setTouchView({ mapZoomIndex: readableZoomIndex(14, this.canvasRect().width / GAME_WIDTH) });
    }
    if (s.mode !== 'map' && s.mode !== 'compare') setTouchView({ legend: false });
  }

  /** ความกว้างของคอลัมน์ปุ่มที่ซ้อนบนภาพเกม (จอแคบ) — 0 เมื่อปุ่มอยู่ข้างภาพเกม */
  private overlayInset(cr: DOMRect): number {
    if (this.layout?.sideColumns || !this.actions.childElementCount) return 0;
    return Math.max(0, cr.right - this.actions.getBoundingClientRect().left);
  }

  /* ---------------- หน้าอ่าน (จอสัมผัส) ---------------- */

  private readerContent(s: GameSession, ctx: TouchContext, cr: DOMRect, w: (t: string) => string): ReaderContent | null {
    switch (s.mode) {
      case 'notebook': {
        const r = notebookReader(buildNotebookView(s, { touch: true }), s.notebookTabs(), NOTEBOOK_TAB_LABEL, s.level.tambon, w);
        // ตัวเลือกเส้นทาง (หน้า วิเคราะห์เส้นทาง) อยู่ท้ายหน้าอ่าน ไม่บังเนื้อหา
        if (ctx.sheet?.options.length) {
          // ตัวเลือกอยู่บนสุดของท้ายหน้า (เห็นเสมอแม้จอเตี้ย) · คำอธิบายเมื่อตอบผิดอยู่ใต้ตัวเลือก เลื่อนอ่านได้
          r.foot = `<div class="tl-rd-choices">${ctx.sheet.options.map((o) => this.button(o, 'tl-option')).join('')}</div>` + r.foot;
        }
        return r;
      }
      case 'gridcheck': {
        const view = buildBoardView(s);
        if (!view) return null;
        const sig = view.result.join('|');
        if (sig !== this.resultSig) {
          // เพิ่งยืนยันคำตอบ → เปิดแท็บผลการตรวจให้เห็นคำอธิบายทันที
          if (sig) this.boardTab = 'result';
          this.resultSig = sig;
        }
        const width = cr.width - this.overlayInset(cr);
        return boardReader(boardTitle(s), view, this.boardTab, width >= 640, w);
      }
      case 'compare': {
        const sig = s.lastCompare ? JSON.stringify(s.lastCompare) : '';
        if (sig !== this.compareSig) {
          if (sig) setTouchView({ compareTab: 'text' });
          this.compareSig = sig;
        }
        return touchView.compareTab === 'text' ? compareReader('หลักฐานและผลการเปรียบเทียบ', buildCompareLines(s), w) : null;
      }
      case 'summary':
        return summaryReader(
          buildSummaryView(
            s,
            (this.game.registry.get(REGISTRY_UNLOCKED) as string | undefined) ?? null,
            (this.game.registry.get(REGISTRY_CODE_PIECES) as CodePiece[] | undefined) ?? [],
          ),
        );
      case 'pause':
        return ctx.sheet
          ? {
              theme: 'dark',
              pageKey: 'pause',
              title: '⏸ หยุดเกม',
              tabs: [],
              body: `<div class="tl-rd-choices tl-pause">${ctx.sheet.options.map((o) => this.button(o, 'tl-option')).join('')}</div>`,
              foot: '<p class="tl-ln tl-muted">ความคืบหน้าบันทึกอัตโนมัติ</p>',
              narrow: true,
            }
          : null;
      default:
        return null;
    }
  }

  private renderReader(r: ReaderContent | null, cr: DOMRect, topInset = 0): void {
    if (!r) {
      this.reader.style.display = 'none';
      this.readerPage = '';
      // ล้างค่าที่จำไว้ให้ต่างจากทุกเนื้อหา → เปิดครั้งถัดไปวาดใหม่ทุกส่วน (กันแท็บเก่าค้าง)
      for (const k of ['rdTitle', 'rdTabs', 'rdBody', 'rdFoot'] as const) this.lastSig[k] = '\u0000';
      return;
    }
    this.reader.style.display = 'flex';
    this.reader.className = `tl-reader tl-${r.theme}${r.narrow ? ' tl-narrow' : ''}`;
    const pageChanged = r.pageKey !== this.readerPage;
    this.readerPage = r.pageKey;
    const keepScroll = this.rdBody.scrollTop;
    this.setHtml('rdTitle', this.rdTitle, esc(r.title));
    this.setHtml(
      'rdTabs',
      this.rdTabs,
      r.tabs
        .map((t) => `<button class="tl-tab${t.active ? ' tl-tab-on' : ''}" data-ui="${esc(t.ui)}" aria-pressed="${t.active}">${esc(t.label)}</button>`)
        .join(''),
    );
    const bodyChanged = this.setHtml('rdBody', this.rdBody, r.body);
    this.setHtml('rdFoot', this.rdFoot, r.foot);
    if (pageChanged) this.rdBody.scrollTop = 0;
    else if (bodyChanged) {
      // เนื้อหาเดิมอัปเดต: คงตำแหน่งที่อ่านอยู่ · ถ้ามีผลการตรวจใหม่ เลื่อนไปให้เห็น
      this.rdBody.scrollTop = keepScroll;
      const anchor = r.focusAnchor ? this.rdBody.querySelector<HTMLElement>(`[data-anchor="${r.focusAnchor}"]`) : null;
      if (anchor) this.rdBody.scrollTop = anchor.offsetTop - this.rdBody.offsetTop - 4;
    }
    // วางบนภาพเกม (ไม่ทับคอลัมน์ปุ่ม) — ไม่ย่อตัวอักษร ถ้าเนื้อหายาวให้เลื่อนอ่าน
    const right = cr.right - this.overlayInset(cr);
    const top = cr.top + Math.max(6, topInset + 4);
    let left = cr.left + 6;
    let width = right - 6 - left;
    if (r.narrow) {
      const nw = Math.min(width, 440);
      left += (width - nw) / 2;
      width = nw;
    }
    Object.assign(this.reader.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      [r.narrow ? 'maxHeight' : 'height']: `${cr.bottom - 6 - top}px`,
      [r.narrow ? 'height' : 'maxHeight']: '',
    });
    this.updateMore();
  }

  /** แสดง "เลื่อนลงเพื่ออ่านต่อ" เมื่อยังมีเนื้อหาด้านล่าง */
  private updateMore(): void {
    const b = this.rdBody;
    const more = b.scrollHeight - b.clientHeight - b.scrollTop > 6;
    this.rdMore.style.display = more ? 'block' : 'none';
  }

  /* ---------------- แผนที่ (จอสัมผัส) ---------------- */

  /** แถบหัวแผนที่และแถบสถานะหมุด — คืนความสูงแถบหัว (CSS px) และแจ้งพื้นที่ที่ถูกบังให้ canvas วางแผนที่ */
  private renderMapBars(s: GameSession, cr: DOMRect, w: (t: string) => string): number {
    const isMap = s.mode === 'map';
    const isCompare = s.mode === 'compare';
    if (!isMap && !isCompare) {
      this.setHtml('mapbar', this.mapbar, '');
      this.setHtml('mapinfo', this.mapinfo, '');
      this.setHtml('legend', this.legend, '');
      return 0;
    }
    const inset = this.overlayInset(cr);
    const toCanvas = GAME_WIDTH / cr.width;
    let bar = '';
    if (isMap) {
      const tiles100 = s.scale.metersToTiles(100);
      const len = Math.round(touchView.mapCellPx * tiles100 * (cr.width / GAME_WIDTH));
      bar =
        `<div class="tl-mb-main"><div class="tl-mb-title">🗺️ ${esc(mapTitle(s))}</div>` +
        `<div class="tl-mb-info">${esc(mapInfoShort(s))}${
          s.coords ? ' · E เพิ่มไปทางตะวันออก · N เพิ่มไปทางเหนือ' : ''
        }</div></div>` +
        (len > 0 ? `<div class="tl-mb-scale"><span class="tl-sb" style="width:${len}px"></span><span>100 ม.</span></div>` : '') +
        '<div class="tl-mb-north">▲<br>เหนือ</div>';
    } else {
      const sheets = s.availableSheets().slice(0, 2);
      const tab = touchView.compareTab;
      const tabBtn = (id: string, label: string, on: boolean) =>
        `<button class="tl-tab${on ? ' tl-tab-on' : ''}" data-ui="compare-tab:${id}" aria-pressed="${on}">${esc(label)}</button>`;
      bar =
        `<div class="tl-mb-main"><div class="tl-mb-title">${esc(COMPARE_TITLE)}</div><div class="tl-rd-tabs">` +
        sheets.map((m, i) => tabBtn(String(i), `📄 ${i + 1}) ${m.title}`, tab === i)).join('') +
        tabBtn('text', s.lastCompare ? '📋 หลักฐาน/ผล ●' : '📋 หลักฐาน/ผล', tab === 'text') +
        '</div></div>';
    }
    this.setHtml('mapbar', this.mapbar, bar);
    Object.assign(this.mapbar.style, { left: `${cr.left}px`, top: `${cr.top}px`, width: `${cr.width - inset}px` });

    // สถานะหมุด/ผลการปัก — ขั้นเลือกประเภทภูมิปัญญาใช้แผ่นตัวเลือกด้านล่างแทน
    const pin = isMap && s.pinStage !== 'wisdom' ? mapPinLines(s, { touch: true }) : { lines: [], problem: false };
    const info = pin.lines.length
      ? `<div class="${pin.problem ? 'tl-bad' : ''}">${pin.lines.map((l) => esc(w(l))).join('<br>')}</div>`
      : '';
    this.setHtml('mapinfo', this.mapinfo, info);
    Object.assign(this.mapinfo.style, { left: `${cr.left}px`, bottom: `${window.innerHeight - cr.bottom}px`, width: `${cr.width - inset}px` });

    const barH = this.mapbar.offsetHeight;

    // แผงคำอธิบายสัญลักษณ์ (เปิด/ปิดจากปุ่ม "สัญลักษณ์") — ตัวอักษรใหญ่ เลื่อนดูได้ ไม่ทับคอลัมน์ปุ่ม
    const showLegend = touchView.legend && touchView.legendItems.length > 0 && !(isCompare && touchView.compareTab === 'text');
    this.setHtml(
      'legend',
      this.legend,
      showLegend
        ? '<div class="tl-lg-title">📖 สัญลักษณ์</div>' +
            touchView.legendItems.map((it) => `<div class="tl-lg-row"><img src="${it.icon}" alt=""><span>${esc(it.label)}</span></div>`).join('')
        : '',
    );
    Object.assign(this.legend.style, {
      right: `${window.innerWidth - cr.right + inset + 6}px`,
      top: `${cr.top + barH + 6}px`,
      // ไม่ทับแถบสถานะหมุดด้านล่าง
      maxHeight: `${Math.max(120, cr.height - barH - (info ? this.mapinfo.offsetHeight : 0) - 12)}px`,
    });
    const infoH = info ? this.mapinfo.offsetHeight : 0;
    setTouchView({
      mapInsets: {
        top: Math.ceil(barH * toCanvas),
        bottom: Math.ceil(infoH * toCanvas),
        right: Math.ceil(inset * toCanvas),
        left: 0,
      },
    });
    return barH;
  }

  /* ---------------- บทสนทนา / ตัวเลือก ---------------- */

  private renderSheet(s: GameSession, ctx: TouchContext | null, cr: DOMRect, w: (t: string) => string): void {
    if (!ctx) {
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
      html += `<div class="tl-text">${esc(w(body))}</div>`;
      if (view.kind === 'quiz' && view.feedback) html += `<div class="tl-feedback">${esc(w(view.feedback))}</div>`;
      html += '</div>';
    } else if (ctx.sheet?.title) {
      html += `<div class="tl-sheet-title">${esc(ctx.sheet.title)}</div>`;
    }
    if (ctx.sheet) html += `<div class="tl-options">${ctx.sheet.options.map((o) => this.button(o, 'tl-option')).join('')}</div>`;
    this.setHtml('sheet', this.sheet, html);
    // ระหว่างคุย/เลือกคำตอบไม่มีจอยสติก จึงใช้ความกว้างภาพเกมได้เต็ม (เว้นคอลัมน์ปุ่มที่ซ้อนอยู่ถ้ามี)
    // เนื้อหายาวบนจอเตี้ย → เลื่อนอ่านในแผ่นนี้ได้ (ไม่ย่อตัวอักษร)
    const inset = this.overlayInset(cr);
    this.sheet.style.left = `${cr.left + 6}px`;
    this.sheet.style.width = `${Math.max(240, cr.width - inset - 12)}px`;
    this.sheet.style.bottom = `${window.innerHeight - cr.bottom + 6}px`;
    this.sheet.style.maxHeight = `${cr.height - 12}px`;
  }

  /* ---------------- บทแนะนำผู้เล่นใหม่ ---------------- */

  /**
   * การ์ดบทแนะนำ: ทีละขั้น ข้อความสั้น ชื่อปุ่มเป็นป้ายสีเหลือง (ปุ่มจริงกะพริบ) · ปุ่มข้าม (แตะ 2 ครั้ง)
   * สำรวจ/แผนที่/สมุด: ขอบล่างของภาพเกม · บทสนทนา: ขอบบน (กล่องบทสนทนาอยู่ด้านล่าง)
   * คืนตำแหน่งขอบบนของการ์ดเมื่ออยู่ด้านล่าง (ใช้วางข้อความโต้ตอบไว้เหนือการ์ด)
   */
  private renderCoach(tv: TutorialView | null, s: GameSession, cr: DOMRect): number | null {
    if (!tv) {
      this.setHtml('coach', this.coach, '');
      return null;
    }
    const explore = s.mode === 'explore';
    const armed = performance.now() < this.skipArmedUntil;
    const keys = (t: string) => esc(t).replace(/\[([^\]]+)\]/g, '<span class="tl-co-k">$1</span>');
    // เปิดแผนที่/สมุดอยู่: ย่อเป็นแถบคำแนะนำสั้น วางในที่ว่างที่ไม่บังเนื้อหาและปุ่ม
    if (tv.short && (s.mode === 'map' || s.mode === 'notebook')) {
      this.renderCoachStrip(tv, keys(tv.short), cr);
      return null;
    }
    this.coach.classList.remove('tl-co-strip', 'tl-co-col', 'tl-co-bar');
    this.coach.style.maxWidth = '';
    const text = keys(tv.text);
    let html = '<div class="tl-co-head">' + `<span class="tl-co-step">บทแนะนำ ${tv.index}/${tv.total}</span><b class="tl-co-title">${esc(tv.title)}</b>`;
    if (explore && !tv.finishButton)
      html += `<button class="tl-co-skip${armed ? ' tl-armed' : ''}" data-ui="tut-skip">${armed ? 'แตะอีกครั้งเพื่อข้าม' : 'ข้ามบทแนะนำ'}</button>`;
    html += `</div><div class="tl-co-text">${text}</div>`;
    if (tv.progress) html += `<div class="tl-co-prog">📏 ${esc(tv.progress)}</div>`;
    if (tv.finishButton) html += '<button class="tl-co-go" data-ui="tut-finish">เริ่มภารกิจ ▶</button>';
    this.setHtml('coach', this.coach, html);
    this.coach.classList.toggle('tl-co-compact', !explore);
    // ไม่ทับคอลัมน์ปุ่ม/จอยสติกที่ซ้อนบนภาพเกม (จอแคบ)
    const leftIn = this.layout && !this.layout.sideColumns ? Math.max(0, this.layout.left.x + this.layout.left.w - cr.left) : 0;
    const rightIn = this.layout && !this.layout.sideColumns ? Math.max(0, cr.right - this.layout.right.x) : 0;
    const avail = cr.width - leftIn - rightIn - 16;
    const width = Math.max(220, Math.min(520, avail));
    this.coach.style.width = `${width}px`;
    this.coach.style.left = `${cr.left + leftIn + 8 + Math.max(0, (avail - width) / 2)}px`;
    this.coach.style.maxHeight = `${Math.round(cr.height * (explore ? 0.5 : 0.4))}px`;
    if (s.mode === 'dialogue') {
      // บทสนทนาอยู่ด้านล่าง → การ์ดขึ้นด้านบน
      this.coach.style.top = `${cr.top + 8}px`;
      this.coach.style.bottom = '';
      if (!this.touch) {
        // คอมพิวเตอร์: แผงข้อมูลซ้ายบนของภาพเกม (กว้าง 342 จาก 960) — การ์ดอยู่ทางขวาของแผง
        const hudRight = cr.left + 350 * (cr.width / GAME_WIDTH);
        const w = Math.min(width, cr.right - hudRight - 8);
        this.coach.style.width = `${w}px`;
        this.coach.style.left = `${Math.max(hudRight, cr.left + (cr.width - w) / 2)}px`;
      }
      return null;
    }
    if (!this.touch) {
      // คอมพิวเตอร์: อยู่ระหว่างแถบมาตราส่วน (ซ้ายล่าง ถึง x ≈ 290) และเข็มทิศ (ขวาล่าง คำอธิบายเริ่มที่ x ≈ 833) ของภาพเกม
      const k = cr.width / GAME_WIDTH;
      const x0 = cr.left + 296 * k;
      const room = (826 - 296) * k;
      const w = Math.min(width, room);
      this.coach.style.width = `${w}px`;
      this.coach.style.left = `${x0 + (room - w) / 2}px`;
    }
    // คอมพิวเตอร์: เว้นแถบคำแนะนำปุ่มด้านล่างของภาพเกม
    const below = this.touch ? 8 : Math.round(40 * (cr.height / 640));
    this.coach.style.top = '';
    this.coach.style.bottom = `${window.innerHeight - cr.bottom + below}px`;
    return explore ? this.coach.getBoundingClientRect().top : null;
  }

  /**
   * แถบคำแนะนำสั้น (ขณะเปิดแผนที่/สมุด)
   *   จอสัมผัส: ส่วนบนของคอลัมน์ปุ่มขวา (เหนือปุ่ม — แผนที่/สมุดไม่ใช้พื้นที่นี้)
   *   คอมพิวเตอร์: บรรทัดเดียวที่ขอบล่างของภาพเกม (ใต้กรอบสมุด/แผนที่)
   */
  private renderCoachStrip(tv: TutorialView, text: string, cr: DOMRect): void {
    const head = `<span class="tl-co-step">บทแนะนำ ${tv.index}/${tv.total}</span>`;
    this.setHtml('coach', this.coach, `${head}<span class="tl-co-text">${text}</span>`);
    this.coach.classList.remove('tl-co-compact');
    this.coach.classList.add('tl-co-strip');
    const l = this.layout;
    if (l) {
      this.coach.classList.add('tl-co-col');
      this.coach.classList.remove('tl-co-bar');
      const btnTops = [...this.actions.querySelectorAll<HTMLElement>('.tl-btn')].map((b) => b.getBoundingClientRect().top).filter((t) => t > 0);
      const top = l.right.y + 6;
      const bottom = (btnTops.length ? Math.min(...btnTops) : l.right.y + l.right.h) - 16; // เว้นที่ให้ป้าย "แตะ" บนปุ่ม
      Object.assign(this.coach.style, {
        left: `${l.right.x + 6}px`,
        width: `${l.right.w - 12}px`,
        maxWidth: '',
        top: `${top}px`,
        bottom: '',
        maxHeight: `${Math.max(48, bottom - top)}px`,
      });
      return;
    }
    this.coach.classList.add('tl-co-bar');
    this.coach.classList.remove('tl-co-col');
    // แถบกรอบสมุด/แผนที่บนคอมพิวเตอร์จบที่ y = 610 จาก 640 → ใช้แถบล่าง 30 หน่วย
    const w = Math.min(cr.width - 16, 820);
    Object.assign(this.coach.style, {
      left: `${cr.left + (cr.width - w) / 2}px`,
      width: `${w}px`,
      maxWidth: `${w}px`,
      top: '',
      bottom: `${window.innerHeight - cr.bottom + 2}px`,
      maxHeight: `${Math.floor(28 * (cr.height / 640))}px`,
    });
  }

  /** พื้นที่ของแถบบนจอที่ซ้อนบนภาพเกม (ส่งให้ WorldScene วางป้าย "คุย" ไม่ให้ถูกบัง) */
  private publishObstacles(cr: DOMRect): void {
    const els: HTMLElement[] = [this.tracker, this.status, this.prompt, this.coach, this.measureEl];
    els.push(...this.actions.querySelectorAll<HTMLElement>('.tl-btn'));
    if (this.root.classList.contains('tl-walk')) els.push(this.joyBase);
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const soft: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const el of els) {
      if (el.style.display === 'none' || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // เฉพาะส่วนที่ทับภาพเกม (คอลัมน์ปุ่มข้างภาพเกมไม่บัง)
      const x0 = Math.max(r.left, cr.left);
      const y0 = Math.max(r.top, cr.top);
      const x1 = Math.min(r.right, cr.right);
      const y1 = Math.min(r.bottom, cr.bottom);
      if (x1 <= x0 || y1 <= y0) continue;
      (el === this.prompt ? soft : rects).push({ x: x0 - cr.left, y: y0 - cr.top, w: x1 - x0, h: y1 - y0 });
    }
    setHudObstacles(rects, soft);
  }

  /* ---------------- แถบสถานะ / แถบภารกิจ ---------------- */

  private renderStatus(s: GameSession, cr: DOMRect, widths: ReturnType<typeof hudWidths>): void {
    const pos = s.coords ? GridSystem.format(s.coords.tileToGrid(s.playerTile)) : `ช่อง X ${s.playerTile.x}, Y ${s.playerTile.y}`;
    // แถบมาตราส่วน 50 ม. — ความยาวบนจอคำนวณจากมาตราส่วนโลกเกม × การซูมกล้อง × ขนาดภาพเกมบนจอ
    const sbLen = Math.round(s.scale.metersToPx(50) * CAMERA_ZOOM * (cr.width / GAME_WIDTH));
    const tiles = s.scale.metersToTiles(50);
    const rpg = (this.game.registry.get(REGISTRY_PROGRESS) as ProgressStore).rpg;
    const html =
      COMPASS_SVG +
      '<div class="tl-st-lines">' +
      `<div class="tl-coins">🪙 ${rpg.coins} · ✨ ${rpg.faith}</div>` +
      // พิกัดแสดงเฉพาะบทที่ใช้พิกัดกริด (ต้องใช้ระหว่างเดิน) · ระยะเดินสะสม/พื้นที่สำรวจ/เวลา อยู่ในสมุด หน้าหลักฐาน (สถิติ)
      // ระยะวัดแสดงแยกในแถบวัดระยะ (เฉพาะตอนกำลังวัด)
      (s.coords ? `<div>📍 ${esc(pos)}</div>` : '') +
      `<div>🧭 หันไป${esc(THAI_DIRECTION[s.facing])}<span class="tl-st-extra"> · เหนืออยู่ด้านบน</span></div>` +
      `<div class="tl-scalebar"><span class="tl-sb" style="width:${sbLen}px"></span><span>50 ม. (${tiles} ช่อง)</span></div>` +
      '</div>';
    this.setHtml('status', this.status, html);
    this.status.classList.toggle('tl-tight', widths.tightStatus);
    this.status.style.left = `${cr.left + 8}px`;
    this.status.style.top = `${cr.top + 8}px`;
    this.status.style.maxWidth = `${widths.status}px`;
  }

  /** แถบวัดระยะ: ระยะจากจุดเริ่มวัด (เรียลไทม์) · ช่อง/ซม.บนแผนที่ · เดินจริง · เริ่มวัดใหม่ (ถ้าภารกิจอนุญาต) · หยุดวัด */
  private renderMeasure(s: GameSession, cr: DOMRect, widths: ReturnType<typeof hudWidths>): void {
    const r = s.mode === 'explore' ? s.measureReading() : null;
    if (!r) {
      this.setHtml('measure', this.measureEl, '');
      return;
    }
    // จอสัมผัส: บรรทัดรองสั้น (แผงไม่สูงจนบังฉาก) — มาตราส่วน 1:10,000 แสดงที่แถบมาตราส่วนและแผนที่อยู่แล้ว
    const sub = `${r.tiles} ช่อง = ${r.mapCm.toFixed(1)} ซม. บนแผนที่ · เดินจริง ${r.walkedMeters.toLocaleString('en-US')} ม.`;
    const html =
      '<div class="tl-ms-row"><div class="tl-ms-text">' +
      `<div class="tl-ms-head">📏 ${esc(measureHeadline(r))}</div>` +
      `<div class="tl-ms-sub">${esc(this.touch ? sub : measureDetail(r, s.scale.ratioLabel))}</div></div>` +
      '<div class="tl-ms-btns">' +
      (r.allowReset ? '<button class="tl-tr-mini" data-ui="measure-restart" aria-label="เริ่มวัดใหม่จากตรงนี้">↺ วัดใหม่</button>' : '') +
      '<button class="tl-tr-mini" data-ui="measure-stop" aria-label="หยุดวัด">✕ หยุด</button></div></div>';
    this.setHtml('measure', this.measureEl, html);
    // ใต้แถบสถานะ (มุมซ้ายบน) · คอมพิวเตอร์: ใต้กรอบทิศในภาพเกม — ไม่ทับแถบภารกิจ และไม่เกินครึ่งซ้ายของภาพ (ไม่บังตัวผู้เล่น)
    const top = this.status.style.display !== 'none' ? this.status.getBoundingClientRect().bottom + 6 : cr.top + 124 * (cr.width / GAME_WIDTH);
    const trLeft = this.tracker.style.display !== 'none' ? this.tracker.getBoundingClientRect().left : cr.right;
    const maxW = Math.max(200, Math.min(cr.width / 2 - 16, trLeft - cr.left - 16, this.touch ? widths.status + 60 : 420));
    this.measureEl.style.left = `${cr.left + 8}px`;
    this.measureEl.style.top = `${top}px`;
    this.measureEl.style.maxWidth = `${maxW}px`;
  }

  private exploreMode = false;
  private renderTracker(t: QuestTrackerView | null, cr: DOMRect, wd: (t: string) => string, width: number, inset = 0): void {
    if (!t) {
      this.setHtml('tracker', this.tracker, '');
      return;
    }
    const compact = this.layout?.compact ?? false;
    const prog = t.micro ? `${t.progress.done}/${t.progress.total} ขั้น` : `${t.progress.done}/${t.progress.total}`;
    const objective = wd(t.objective);
    // เป้าหมายเปลี่ยน (ทำสำเร็จ) → แจ้ง "เป้าหมายใหม่" สั้น ๆ ให้เด็กรู้ว่าภารกิจขยับแล้ว
    const key = `${t.chapterLabel}|${t.questTitle}|${t.objective}`;
    const now = performance.now();
    if (this.trackerKey && key !== this.trackerKey) {
      this.trackerFlashUntil = now + 2600;
      this.trackerFlashText = t.doneText ?? '✓ สำเร็จ! เป้าหมายใหม่';
    }
    this.trackerKey = key;
    const flash = now < this.trackerFlashUntil;
    this.tracker.classList.toggle('tl-tr-flash', flash);
    // ปุ่มลัด: เข้าใกล้เป้าหมายแล้ว → "คุย/สำรวจ" · นอกนั้นเปิดเครื่องมือของขั้นนี้
    const near = this.lastTarget;
    const act =
      near && t.micro && (t.target?.id === near.id || (near.id === 'field-check' && t.target?.id === 'chosen') || (!t.target && !t.action))
        ? { ui: 'guide-action:talk', label: `✋ ${near.verb}${near.kind === 'npc' ? near.label.replace(/^พูดคุยกับ/, 'กับ') : ''}` }
        : t.action
          ? { ui: `guide-action:${t.action.id}`, label: t.action.label }
          : null;
    let html = '';
    // จอเตี้ยและอยู่ในระยะคุย/สำรวจเป้าหมายแล้ว: แถบเหลือแถวเดียว "เป้าหมาย + ✋ ปุ่มลัด" (ไม่บัง NPC ที่ยืนข้างผู้เล่น)
    // ด่านสำรวจ (exploreMode): แสดงโจทย์/คำบอกทางครบเสมอ ไม่ย่อเหลือแถวเดียว
    const nearAct = compact && t.micro && act?.ui === 'guide-action:talk' && !this.trackerCollapsed && !this.exploreMode;
    if (nearAct) {
      html =
        `<div class="tl-tr-near"><span class="tl-tr-near-o">🎯 ${esc(objective)}</span>` +
        `<button class="tl-tr-mini tl-tr-go" data-ui="${esc(act!.ui)}">${esc(act!.label)}</button></div>`;
    } else if (this.trackerCollapsed) {
      // ย่อแล้วยังเห็นเป้าหมายปัจจุบัน (บรรทัดเดียว)
      html =
        `<button class="tl-tr-pill" data-ui="tracker-toggle" aria-label="ขยายแถบภารกิจ">` +
        `<span class="tl-tr-pill-k">${flash ? '✓ ใหม่' : '📜'} ${esc(prog)}</span> <span class="tl-tr-pill-o">${esc(objective)}</span> ▾</button>`;
    } else {
      const collapseBtn = '<button class="tl-tr-mini" data-ui="tracker-toggle" aria-label="ย่อแถบภารกิจ">▴ ย่อ</button>';
      if (flash) html += `<div class="tl-tr-new">${esc(this.trackerFlashText)}</div>`;
      if (!compact || this.trackerDetails) {
        html += `<div class="tl-tr-head"><span class="tl-tr-chapter">${esc(t.chapterLabel)}</span>${compact ? '' : collapseBtn}</div>`;
      }
      if (t.micro) {
        // นำทางด้วยการกระทำ: ภารกิจหลัก · เป้าหมายปัจจุบัน · เครื่องมือ · วิธีทำ (กด/แตะอะไร) · เมื่อสำเร็จ · ความคืบหน้า
        // จอเตี้ย: ภารกิจหลัก+ช่วงอยู่บรรทัดเดียว · ความคืบหน้าต่อท้ายเป้าหมาย · วิธีทำไม่มีบรรทัดหัวข้อแยก (ประหยัดความสูง)
        if (compact) html += `<div class="tl-tr-quest">📜 ภารกิจหลัก: ${esc(t.questTitle)}${t.phaseTitle ? ` · ${esc(t.phaseTitle)}` : ''}</div>`;
        else {
          html += `<div class="tl-tr-quest">📜 ภารกิจหลัก: ${esc(t.questTitle)}</div>`;
          if (t.phaseTitle) html += `<div class="tl-tr-phase">${esc(t.phaseTitle)}</div>`;
        }
        const part = t.stepNo && t.stepNo.parts > 1 ? ` (ส่วน ${t.stepNo.part}/${t.stepNo.parts})` : '';
        html += `<div class="tl-tr-obj">🎯 <span class="tl-tr-label">เป้าหมายปัจจุบัน:</span> ${esc(objective)}${esc(part)}${compact ? ` <span class="tl-tr-prog">${esc(prog)}</span>` : ''}</div>`;
        if (!compact) html += `<div class="tl-tr-prog-row">ความคืบหน้า <span class="tl-tr-prog">${esc(prog)}</span></div>`;
        const steps = t.steps;
        if (t.tools.length) html += `<div class="tl-tr-tools">🧰 <span class="tl-tr-label">เครื่องมือ:</span> ${esc(t.tools.join(' · '))}</div>`;
        if (steps.length) {
          html += `<div class="tl-tr-how">${compact ? '' : '<span class="tl-tr-label">👉 วิธีทำ:</span>'}<ol>${steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`;
        }
        if (t.result) html += `<div class="tl-tr-result">✅ <span class="tl-tr-label">เมื่อสำเร็จ:</span> ${esc(t.result)}</div>`;
        if (t.hint) html += `<div class="tl-tr-hint tl-tr-hint-more">💡 คำแนะนำ ${t.hintTier + 1}/3: ${esc(t.hint)}</div>`;
      } else {
        html += `<div class="tl-tr-quest">📜 ภารกิจ: ${esc(t.questTitle)}</div>`;
        html += `<div class="tl-tr-obj">🎯 <span class="tl-tr-label">เป้าหมาย:</span> ${esc(objective)} <span class="tl-tr-prog">${esc(prog)}</span></div>`;
        if (t.hint) {
          const label = t.hintTier === 0 ? '💡 ' : `💡 คำแนะนำ ${t.hintTier + 1}/3: `;
          html += `<div class="tl-tr-hint${t.hintTier > 0 ? ' tl-tr-hint-more' : ''}">${label}${esc(wd(t.hint))}</div>`;
        }
      }
      if (this.trackerDetails) {
        if (t.remaining.length > 1) html += `<div class="tl-tr-list">ยังเหลือ: ${t.remaining.map((r) => esc(wd(r))).join(' · ')}</div>`;
        if (t.sideQuests.length) html += `<div class="tl-tr-list">ภารกิจรอง/ปริศนา: ${t.sideQuests.map((q) => esc(wd(q))).join(' · ')}</div>`;
        html += `<div class="tl-tr-list">ฉาก ${t.step.current}/${t.step.total}</div>`;
      }
      html += '<div class="tl-tr-btns">';
      // ปุ่มลัดไปยังเครื่องมือมาก่อน (เด่นที่สุด) · ขอคำแนะนำ · ย่อ
      if (act) html += `<button class="tl-tr-mini tl-tr-go" data-ui="${esc(act.ui)}">${esc(act.label)}</button>`;
      if (!t.complete && t.hintTier < 2)
        html += `<button class="tl-tr-mini tl-tr-help" data-ui="tracker-hint" aria-label="ขอคำแนะนำ">💡${compact && act ? '' : t.hintTier === 0 ? ' ขอคำแนะนำ' : ' ขอคำแนะนำเพิ่ม'}</button>`;
      if (compact && !t.micro) html += `<button class="tl-tr-mini" data-ui="tracker-details">${this.trackerDetails ? 'ซ่อน' : 'รายละเอียด'}</button>`;
      if (compact) html += t.micro ? '<button class="tl-tr-mini" data-ui="tracker-toggle" aria-label="ย่อแถบภารกิจ">▴</button>' : collapseBtn;
      html += '</div>';
    }
    this.setHtml('tracker', this.tracker, html);
    this.tracker.classList.toggle('tl-tr-open', this.trackerDetails);
    this.tracker.style.width = this.trackerCollapsed || nearAct ? 'auto' : `${width}px`;
    this.tracker.style.maxWidth = `${width}px`;
    // จอเตี้ยที่มีขั้นย่อย: แถบอยู่ครึ่งขวาของภาพ (ไม่บังตัวผู้เล่น) จึงสูงได้มากกว่า เพื่อให้เห็นวิธีทำครบ
    this.tracker.style.maxHeight = `${cr.height * (this.trackerDetails ? 0.8 : compact && t.micro ? 0.88 : 0.62)}px`;
    // เนื้อหายาว (คำแนะนำระดับ 2–3 / รายละเอียด) → เลื่อนอ่านในแถบได้ · แถวปุ่มติดขอบล่างเสมอ (แตะได้ตลอด)
    this.tracker.style.overflowY = 'auto';
    this.tracker.style.right = `${window.innerWidth - cr.right + inset + 8}px`;
    this.tracker.style.top = `${cr.top + 8}px`;
  }

  /* ---------------- ข้อความแจ้งเตือน (จอสัมผัส) ---------------- */

  private pushToast(msg: string): void {
    const s = this.session();
    const text = s ? this.wording(s)(msg) : msg;
    if (this.toastQueue[this.toastQueue.length - 1] !== text) this.toastQueue.push(text);
    if (this.toastTimer === null) this.nextToast();
  }

  private nextToast(): void {
    const msg = this.toastQueue.shift();
    if (msg === undefined) {
      this.toastTimer = null;
      this.toast.classList.remove('tl-show');
      return;
    }
    this.toast.textContent = msg;
    this.toast.classList.add('tl-show');
    this.toastTimer = window.setTimeout(() => this.nextToast(), 2600);
  }

  private clearToast(): void {
    this.toastQueue.length = 0;
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toast.classList.remove('tl-show');
  }

  /** สำรวจ: กลางจอ (เหนือตัวละคร) · หน้าอื่น: ขอบบน (ไม่บังตัวเลือก/เนื้อหาที่กำลังอ่าน และหายเองใน 2.6 วินาที) */
  private placeToast(cr: DOMRect, explore: boolean): void {
    const inset = this.overlayInset(cr);
    // จอเตี้ยระหว่างสำรวจ: แถบภารกิจใช้ครึ่งขวา → แจ้งเตือนอยู่ครึ่งซ้ายล่าง (ไม่ทับวิธีทำ)
    const tr = this.tracker.style.display !== 'none' ? this.tracker.getBoundingClientRect() : null;
    if (explore && this.layout?.compact && tr && tr.height > cr.height * 0.45) {
      const right = Math.max(cr.left + 160, tr.left - 8);
      this.toast.style.left = `${(cr.left + right) / 2}px`;
      this.toast.style.top = `${cr.top + cr.height * 0.62}px`;
      this.toast.style.maxWidth = `${Math.max(160, right - cr.left - 16)}px`;
      return;
    }
    this.toast.style.left = `${cr.left + (cr.width - inset) / 2}px`;
    this.toast.style.top = `${cr.top + (explore ? cr.height * 0.36 : 4)}px`;
    this.toast.style.maxWidth = `${Math.max(200, (cr.width - inset) * 0.8)}px`;
  }

  /** อัปเดต DOM เฉพาะเมื่อเนื้อหาเปลี่ยน — คืน true เมื่อมีการเปลี่ยน */
  private setHtml(key: SigKey, el: HTMLElement, html: string): boolean {
    if (this.lastSig[key] === html) return false;
    this.lastSig[key] = html;
    el.innerHTML = html;
    el.style.display = html ? '' : 'none';
    return true;
  }
}
