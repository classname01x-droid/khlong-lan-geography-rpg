import Phaser from 'phaser';
import { CAMERA_ZOOM, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { THAI_DIRECTION } from '../core/direction/Compass';
import type { GameSession } from '../core/session/GameSession';
import { DialogueBox } from '../ui/DialogueBox';
import { fmtDuration, fmtMeters } from '../ui/format';
import { MapOverlay } from '../ui/MapOverlay';
import { NotebookOverlay } from '../ui/NotebookOverlay';
import { SummaryOverlay } from '../ui/SummaryOverlay';
import { COLORS, textStyle } from '../ui/theme';
import { REGISTRY_CODE_PIECES, REGISTRY_SESSION, REGISTRY_UNLOCKED } from './events';
import { getSettings, SCENE } from './navigation';
import { GridSystem } from '../core/world/GridSystem';
import { PAUSE_ITEMS, type WorldScene } from './WorldScene';
import { PauseOverlay } from '../ui/PauseOverlay';
import { CompareOverlay } from '../ui/CompareOverlay';
import type { CodePiece } from '../core/progress/ProgressStore';

/**
 * ชั้น UI ซ้อนบนโลกเกม (กล้องไม่ซูม ตัวอักษรคมชัด)
 * อ่านสถานะจาก GameSession อย่างเดียว — วาด overlay ใหม่เมื่อ session.uiVersion เปลี่ยน
 */
export class UIScene extends Phaser.Scene {
  private hudText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private compassNeedleText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastQueue: string[] = [];
  private toastBusy = false;
  private dialogueBox!: DialogueBox;
  private notebook!: NotebookOverlay;
  private mapOverlay!: MapOverlay;
  private summary!: SummaryOverlay;
  private pause!: PauseOverlay;
  private compare!: CompareOverlay;
  private controlsHint!: Phaser.GameObjects.Text;
  private renderedVersion = -1;

  constructor() {
    super('UIScene');
  }

  private get session(): GameSession {
    return this.registry.get(REGISTRY_SESSION) as GameSession;
  }

  create(): void {
    this.renderedVersion = -1;
    this.toastQueue = [];
    this.toastBusy = false;
    this.createHud();
    this.createScaleBar();
    this.createCompass();
    this.dialogueBox = new DialogueBox(this);
    this.mapOverlay = new MapOverlay(this, this.session);
    this.notebook = new NotebookOverlay(this, this.session.notebookTabs(), this.session.level.tambon);
    this.compare = new CompareOverlay(this);
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
    const explored = Math.round(s.fog.exploredRatio * 100);
    this.hudText.setText(
      [
        s.coords ? `พิกัดกริด: ${GridSystem.format(s.coords.tileToGrid(t))}` : `ตำแหน่ง: ช่อง X ${t.x}, Y ${t.y}`,
        `หันหน้าไป: ${THAI_DIRECTION[s.facing]}`,
        `ระยะทางรวม: ${fmtMeters(s.odometer.totalMeters)}`,
        `ระยะที่วัด (R): ${fmtMeters(s.odometer.tripMeters)}`,
        `สำรวจแล้ว: ${explored}% ของพื้นที่`,
        `เบาะแส: ${s.clues.length}/${s.level.clues?.length ?? 0} · เวลา ${fmtDuration(s.elapsedMs)}`,
      ].join('\n'),
    );
    const step = s.currentStep;
    this.objectiveText.setText(
      step
        ? `ฉาก ${step.order}/${s.level.story.length} · ${step.title}\n${step.objective}`
        : 'ภารกิจสำเร็จแล้ว! สำรวจต่อได้ หรือเปิดสมุดภาคสนาม (N) อ่านสรุป',
    );
    this.compassNeedleText.setText(THAI_DIRECTION[s.facing].replace('ทิศ', ''));

    // แจ้งเตือนแสดงเฉพาะตอนสำรวจ/คุย เพื่อไม่ทับหน้าสมุด แผนที่ หรือหน้าสรุปผล
    // (หน้าเหล่านั้นแสดงผลลัพธ์ของตัวเองอยู่แล้ว) และไม่เก็บข้อความเก่าค้างไว้หลังจบด่าน
    for (const msg of s.drainToasts()) {
      if (this.toastQueue[this.toastQueue.length - 1] !== msg) this.toastQueue.push(msg);
    }
    if (s.mode === 'summary') {
      this.toastQueue = [];
      this.toastText.setAlpha(0);
    }
    const canToast = s.mode === 'explore' || s.mode === 'dialogue';
    if (!canToast && this.toastText.alpha > 0) this.toastText.setAlpha(0);
    if (canToast && !this.toastBusy && this.toastQueue.length > 0) this.showNextToast();

    if (s.uiVersion !== this.renderedVersion) {
      this.renderedVersion = s.uiVersion;
      this.dialogueBox.render(s.mode === 'dialogue' ? s.dialogueView : null);
      this.mapOverlay.render();
      this.notebook.render(s);
      this.compare.render(s);
      this.summary.render(
        s,
        (this.registry.get(REGISTRY_UNLOCKED) as string | undefined) ?? null,
        (this.registry.get(REGISTRY_CODE_PIECES) as CodePiece[] | undefined) ?? [],
      );
      const hintShown = getSettings(this).settings.showControlsHint;
      this.controlsHint.setVisible(hintShown);
      this.pause.render(s, hintShown);
    } else if (s.mode === 'map') {
      this.mapOverlay.updatePlayer();
    }
  }

  /* ---------------- HUD ---------------- */

  private createHud(): void {
    const s = this.session;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.82).fillRoundedRect(12, 12, 330, 236, 8);
    panel.lineStyle(2, COLORS.panelBorder, 0.9).strokeRoundedRect(12, 12, 330, 236, 8);
    this.add.text(24, 18, `${s.level.tambon}\n${s.level.title}`, { ...textStyle(16, COLORS.accent), lineSpacing: 0 });
    this.hudText = this.add.text(24, 70, '', { ...textStyle(15), lineSpacing: 2 });

    // กล่องภารกิจ อยู่ระหว่าง HUD (ซ้าย) กับเข็มทิศ (ขวา)
    const ox = 356;
    const ow = GAME_WIDTH - 124 - ox;
    const op = this.add.graphics();
    op.fillStyle(COLORS.panel, 0.82).fillRoundedRect(ox, 12, ow, 62, 8);
    this.objectiveText = this.add
      .text(ox + ow / 2, 18, '', { ...textStyle(14), align: 'center', wordWrap: { width: ow - 16 } })
      .setOrigin(0.5, 0);

    // ซ่อน/แสดงได้จาก ตั้งค่า (เมนูหลัก) หรือเมนูหยุดเกม (Esc)
    this.controlsHint = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 10,
        'WASD/ลูกศร: เดิน · E: คุย · R: วัดระยะ · G: ตาราง · M: แผนที่ · N: สมุด · Esc: หยุดเกม',
        { ...textStyle(14, COLORS.text), backgroundColor: '#10141fcc', padding: { x: 10, y: 4, top: 6 } },
      )
      .setOrigin(0.5, 1);
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
    const cx = GAME_WIDTH - 62;
    const cy = 66;
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
