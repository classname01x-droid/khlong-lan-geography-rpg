import Phaser from 'phaser';
import { CAMERA_ZOOM, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { THAI_DIRECTION } from '../core/direction/Compass';
import type { GameSession } from '../core/session/GameSession';
import { DialogueBox } from '../ui/DialogueBox';
import { MapOverlay } from '../ui/MapOverlay';
import { NotebookOverlay } from '../ui/NotebookOverlay';
import { SummaryOverlay } from '../ui/SummaryOverlay';
import { COLORS, textStyle } from '../ui/theme';
import { EVENT_TOUCH_TOAST, REGISTRY_CODE_PIECES, REGISTRY_SESSION, REGISTRY_TOUCH_UI, REGISTRY_UNLOCKED } from './events';
import { getProgress, getSettings, SCENE } from './navigation';
import { GridSystem } from '../core/world/GridSystem';
import { PAUSE_ITEMS, type WorldScene } from './WorldScene';
import { PauseOverlay } from '../ui/PauseOverlay';
import { CompareOverlay } from '../ui/CompareOverlay';
import { GridBoardOverlay } from '../ui/GridBoardOverlay';
import { IN_DEVELOPMENT_MESSAGE } from '../core/campaign/Campaign';
import type { CodePiece } from '../core/progress/ProgressStore';
import { DRAG_THRESHOLD } from '../core/ui/MapViewport';
import { touchView } from '../ui/touch/touchViewState';

/**
 * ชั้น UI ซ้อนบนโลกเกม (กล้องไม่ซูม ตัวอักษรคมชัด)
 * อ่านสถานะจาก GameSession อย่างเดียว — วาด overlay ใหม่เมื่อ session.uiVersion เปลี่ยน
 */
export class UIScene extends Phaser.Scene {
  private hudText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private compassNeedleText: Phaser.GameObjects.Text | null = null;
  private toastText!: Phaser.GameObjects.Text;
  private toastQueue: string[] = [];
  private toastBusy = false;
  private dialogueBox!: DialogueBox;
  private notebook!: NotebookOverlay;
  private mapOverlay!: MapOverlay;
  private summary!: SummaryOverlay;
  private pause!: PauseOverlay;
  private compare!: CompareOverlay;
  private gridBoard!: GridBoardOverlay;
  private controlsHint!: Phaser.GameObjects.Text;
  /** เล่นบนจอสัมผัส: ข้อความสำคัญแสดงด้วย TouchLayer (DOM ตัวอักษรใหญ่) แทนบางส่วนของ HUD */
  private touchUi = false;
  private hudParts: Phaser.GameObjects.GameObject[] = [];
  private renderedVersion = -1;
  private renderedTouchVersion = -1;
  /** นิ้ว/เมาส์ที่กำลังลากแผนที่ (จอสัมผัส) — ไม่ขยับเกิน DRAG_THRESHOLD = แตะเลือกช่อง */
  private drag: { id: number; x: number; y: number; from: { x: number; y: number } | null; moved: boolean } | null = null;

  constructor() {
    super('UIScene');
  }

  private get session(): GameSession {
    return this.registry.get(REGISTRY_SESSION) as GameSession;
  }

  create(): void {
    this.renderedVersion = -1;
    this.renderedTouchVersion = -1;
    this.drag = null;
    this.toastQueue = [];
    this.toastBusy = false;
    this.touchUi = this.registry.get(REGISTRY_TOUCH_UI) === true;
    this.createHud();
    // จอสัมผัส: แถบมาตราส่วนและเข็มทิศอยู่ในแถบสถานะ DOM (ตัวอักษรใหญ่ ไม่ทับจอยสติก/ปุ่ม)
    if (!this.touchUi) {
      this.createScaleBar();
      this.createCompass();
    }
    this.dialogueBox = new DialogueBox(this);
    this.bindMapPointer();
    this.mapOverlay = new MapOverlay(this, this.session, this.touchUi);
    this.notebook = new NotebookOverlay(this, this.session.notebookTabs(), this.session.level.tambon);
    this.compare = new CompareOverlay(this, this.touchUi);
    this.gridBoard = new GridBoardOverlay(this);
    this.summary = new SummaryOverlay(this);
    this.pause = new PauseOverlay(this, PAUSE_ITEMS, (i) => (this.scene.get(SCENE.level) as WorldScene).pauseAction(i));
    this.toastText = this.add
      .text(GAME_WIDTH / 2, 104, '', { ...textStyle(18, COLORS.accent), stroke: '#10141f', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0);
  }

  override update(): void {
    const s = this.session;
    if (!s) return;
    const t = s.playerTile;
    // ระหว่างเล่นแสดงเฉพาะที่ต้องใช้: ทิศที่หัน (+ พิกัดในบทที่ใช้พิกัดกริด)
    // ระยะเดินสะสม/พื้นที่สำรวจ/เวลา อยู่ในสมุด หน้าหลักฐาน (สถิติ) · ระยะวัดอยู่ในแถบวัดระยะ (เฉพาะตอนวัด)
    this.hudText.setText(
      [`🪙 ${getProgress(this).rpg.coins}   ✨ ${getProgress(this).rpg.faith}`, s.coords ? `พิกัดกริด: ${GridSystem.format(s.coords.tileToGrid(t))}` : null, `หันหน้าไป: ${THAI_DIRECTION[s.facing]}`]
        .filter(Boolean)
        .join('\n'),
    );
    const step = s.currentStep;
    this.objectiveText.setText(
      step
        ? step.status === 'planned'
          ? `ฉาก ${step.order}/${s.level.story.length} · ${step.title}\n${IN_DEVELOPMENT_MESSAGE} (ความคืบหน้าถูกบันทึกไว้แล้ว)`
          : `ฉาก ${step.order}/${s.level.story.length} · ${step.title}\n${step.objective}`
        : 'ภารกิจสำเร็จแล้ว! สำรวจต่อได้ หรือเปิดสมุดภาคสนาม (N) อ่านสรุป',
    );
    this.compassNeedleText?.setText(THAI_DIRECTION[s.facing].replace('ทิศ', ''));

    // แจ้งเตือนแสดงเฉพาะตอนสำรวจ/คุย เพื่อไม่ทับหน้าสมุด แผนที่ หรือหน้าสรุปผล
    // (หน้าเหล่านั้นแสดงผลลัพธ์ของตัวเองอยู่แล้ว) และไม่เก็บข้อความเก่าค้างไว้หลังจบด่าน
    for (const msg of s.drainToasts()) {
      // จอสัมผัส: แสดงเป็นข้อความ DOM ตัวอักษรใหญ่ (TouchLayer) แทนข้อความใน canvas
      if (this.touchUi) this.game.events.emit(EVENT_TOUCH_TOAST, msg);
      else if (this.toastQueue[this.toastQueue.length - 1] !== msg) this.toastQueue.push(msg);
    }
    if (s.mode === 'summary') {
      this.toastQueue = [];
      this.toastText.setAlpha(0);
    }
    const canToast = s.mode === 'explore' || s.mode === 'dialogue';
    if (!canToast && this.toastText.alpha > 0) this.toastText.setAlpha(0);
    if (canToast && !this.toastBusy && this.toastQueue.length > 0) this.showNextToast();

    if (s.uiVersion !== this.renderedVersion || touchView.version !== this.renderedTouchVersion) {
      this.renderedVersion = s.uiVersion;
      this.renderedTouchVersion = touchView.version;
      // จอสัมผัส: บทสนทนาแสดงในกล่อง DOM ตัวอักษรใหญ่พร้อมปุ่มตัวเลือก (TouchLayer)
      this.dialogueBox.render(s.mode === 'dialogue' && !this.touchUi ? s.dialogueView : null);
      this.mapOverlay.render();
      this.compare.render(s);
      const hintShown = getSettings(this).settings.showControlsHint;
      this.controlsHint.setVisible(hintShown && !this.touchUi);
      if (this.touchUi) {
        // จอสัมผัส: สมุด กระดานวิเคราะห์ หน้าสรุป และเมนูหยุดเกม แสดงเป็นหน้าอ่าน DOM ตัวอักษรใหญ่ (TouchLayer)
        for (const o of [this.notebook, this.gridBoard, this.summary, this.pause]) o.root.setVisible(false);
      } else {
        this.notebook.render(s);
        this.gridBoard.render(s);
        this.summary.render(
          s,
          (this.registry.get(REGISTRY_UNLOCKED) as string | undefined) ?? null,
          (this.registry.get(REGISTRY_CODE_PIECES) as CodePiece[] | undefined) ?? [],
        );
        this.pause.render(s, hintShown);
      }
    } else if (s.mode === 'map') {
      this.mapOverlay.updatePlayer();
    }
  }

  /* ---------- สำหรับชั้น DOM (TouchLayer): ปักหมุด/เลื่อนแผนที่ ด้วยพิกัดภาพเกม ---------- */

  mapTileAt(gx: number, gy: number): { x: number; y: number } | null {
    return this.session?.mode === 'map' ? this.mapOverlay.tileAt(gx, gy) : null;
  }

  mapTileCenter(t: { x: number; y: number }): { x: number; y: number } {
    return this.mapOverlay.tileCenter(t);
  }

  mapCellPx(): number {
    return this.mapOverlay.cellOnScreen;
  }

  mapPanPosition(): { x: number; y: number } | null {
    return this.mapOverlay.panPosition;
  }

  mapPanFrom(from: { x: number; y: number }, dx: number, dy: number): void {
    this.mapOverlay.panFrom(from, dx, dy);
  }

  /**
   * หน้าเปรียบเทียบแผนที่ (จอสัมผัส): ลากนิ้ว = เลื่อนแผนที่ฐานที่ขยายอยู่
   * หน้าแผนที่ (ปักหมุด/เลื่อน) ใช้ชั้น DOM ของ TouchLayer แทน (core/ui/PinGesture — วัดระยะเป็น CSS px)
   * แยกการแตะกับการลากด้วยระยะ DRAG_THRESHOLD และใช้เฉพาะนิ้วแรก — คีย์ลูกศรเดิมยังใช้ได้
   */
  private bindMapPointer(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const s = this.session;
      // หน้าแผนที่: ชั้น DOM (PinGesture) รับการแตะ/ลากแทน · เหลือเฉพาะหน้าเปรียบเทียบแผนที่ที่ใช้ทางนี้
      if (!s || s.mode !== 'compare' || (this.drag && p.id === this.drag.id && p.isDown)) return;
      const from = this.compare.panPosition;
      this.drag = { id: p.id, x: p.x, y: p.y, from, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || p.id !== d.id || !p.isDown) return;
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      // ระยะลากวัดเป็น CSS px ของจอจริง (เดิมวัดเป็นหน่วยภาพเกม ทำให้บนโทรศัพท์นิ้วสั่นเล็กน้อยก็นับเป็นการลาก)
      const cssPerGame = this.game.canvas.getBoundingClientRect().width / GAME_WIDTH;
      if (!d.moved && Math.hypot(dx, dy) * cssPerGame < DRAG_THRESHOLD) return;
      d.moved = true;
      if (!d.from) return;
      if (this.session.mode === 'compare') this.compare.panFrom(d.from, dx, dy);
    });
    const end = (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || p.id !== d.id) return;
      this.drag = null;
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);
    this.input.on('gameout', () => (this.drag = null));
  }

  /* ---------------- HUD ---------------- */

  private createHud(): void {
    const s = this.session;
    const panel = this.add.graphics();
    const hudH = s.coords ? 134 : 114;
    panel.fillStyle(COLORS.panel, 0.82).fillRoundedRect(12, 12, 330, hudH, 8);
    panel.lineStyle(2, COLORS.panelBorder, 0.9).strokeRoundedRect(12, 12, 330, hudH, 8);
    const title = this.add.text(24, 18, `${s.level.tambon}\n${s.level.title}`, { ...textStyle(16, COLORS.accent), lineSpacing: 0 });
    this.hudText = this.add.text(24, 70, '', { ...textStyle(15), lineSpacing: 2 });
    this.hudParts = [panel, title, this.hudText];

    // เป้าหมายของฉากแสดงที่แถบติดตามภารกิจ (TouchLayer — มุมขวาบน) แทนกล่องเดิม
    this.objectiveText = this.add.text(0, 0, '').setVisible(false);

    // ซ่อน/แสดงได้จาก ตั้งค่า (เมนูหลัก) หรือเมนูหยุดเกม (Esc)
    this.controlsHint = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 10,
        'WASD/ลูกศร: เดิน · E: คุย · R: วัดระยะ · C: วิเคราะห์ · M: แผนที่ · N: สมุด · G: ตาราง · Esc: หยุดเกม',
        { ...textStyle(14, COLORS.text), backgroundColor: '#10141fcc', padding: { x: 10, y: 4, top: 6 } },
      )
      .setOrigin(0.5, 1);
    // จอสัมผัส: ตำแหน่ง/ระยะแสดงที่แถบสถานะ DOM (อ่านง่ายบนจอเล็ก) และไม่มีคำแนะนำปุ่มคีย์บอร์ด
    if (this.touchUi) {
      for (const o of this.hudParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      this.controlsHint.setVisible(false);
    }
  }

  /** แถบมาตราส่วนบนจอ — ความยาวคำนวณจากมาตราส่วนโลกเกม × การซูมกล้อง */
  private createScaleBar(): void {
    const s = this.session;
    const meters = 50;
    const lengthPx = s.scale.metersToPx(meters) * CAMERA_ZOOM;
    const tiles = s.scale.metersToTiles(meters);
    const x = 24;
    const y = GAME_HEIGHT - 70;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.82).fillRoundedRect(x - 12, y - 30, lengthPx + 24, 62, 8);
    for (let i = 0; i < tiles; i++) {
      g.fillStyle(i % 2 === 0 ? 0xf4efe1 : 0x10141f, 1);
      g.fillRect(x + (lengthPx / tiles) * i, y, lengthPx / tiles, 8);
    }
    g.lineStyle(2, 0xf4efe1, 1).strokeRect(x, y, lengthPx, 8);
    this.add.text(x, y - 26, `แถบมาตราส่วน (1 ช่อง = ${s.scale.config.metersPerTile} ม.)`, textStyle(13, COLORS.textDim));
    this.add.text(x, y + 10, '0', textStyle(13));
    this.add.text(x + lengthPx, y + 10, `${meters} ม. (${tiles} ช่อง)`, textStyle(13)).setOrigin(1, 0);
  }

  private createCompass(): void {
    // มุมขวาล่าง (มุมขวาบนเป็นแถบติดตามภารกิจ) — จอสัมผัสใช้เข็มทิศในแถบสถานะ DOM แทน
    const cx = GAME_WIDTH - 62;
    const cy = GAME_HEIGHT - 132;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.82).fillCircle(cx, cy, 48);
    g.lineStyle(2, COLORS.panelBorder, 0.9).strokeCircle(cx, cy, 48);
    g.fillStyle(0xd94b4b, 1).fillTriangle(cx, cy - 34, cx - 8, cy, cx + 8, cy);
    g.fillStyle(0xf4efe1, 1).fillTriangle(cx, cy + 34, cx - 8, cy, cx + 8, cy);
    const label = (t: string, x: number, y: number) =>
      this.add.text(x, y, t, textStyle(13, COLORS.text)).setOrigin(0.5);
    label('เหนือ', cx, cy - 38);
    label('ใต้', cx, cy + 38);
    label('ออก', cx + 34, cy);
    label('ตก', cx - 35, cy);
    this.add.text(cx, cy + 56, 'เหนืออยู่ด้านบนเสมอ', textStyle(12, COLORS.textDim)).setOrigin(0.5, 0);
    this.compassNeedleText = this.add.text(cx, cy + 74, '', textStyle(13, COLORS.accent)).setOrigin(0.5, 0);
  }

  private showNextToast(): void {
    const msg = this.toastQueue.shift();
    if (msg === undefined) return;
    this.toastBusy = true;
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(msg).setAlpha(1);
    // ถ้ามีข้อความรอคิว แสดงสั้นลง เพื่อไม่ให้ข้อความเก่าค้างนาน
    const hold = this.toastQueue.length > 0 ? 1000 : 1900;
    this.time.delayedCall(hold, () => {
      this.tweens.add({
        targets: this.toastText,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.toastBusy = false;
        },
      });
    });
  }
}
