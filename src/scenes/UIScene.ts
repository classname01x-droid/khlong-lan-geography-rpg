import Phaser from 'phaser';
import { CAMERA_ZOOM, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { THAI_DIRECTION } from '../core/direction/Compass';
import type { GameSession } from '../core/session/GameSession';
import { MAP_COLOR_OBJECT, MAP_COLOR_TERRAIN } from '../graphics/tileIndex';
import { wrapThaiText } from '../ui/textWrap';
import { COLORS, FONT_FAMILY, textStyle } from '../ui/theme';
import { GameEvents, REGISTRY_SESSION, type DialoguePayload } from './events';

const fmtMeters = (m: number) => `${Math.round(m).toLocaleString('en-US')} ม.`;

/** ชั้น UI ซ้อนบนโลกเกม (กล้องไม่ซูม ตัวอักษรคมชัด) */
export class UIScene extends Phaser.Scene {
  private hudText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private compassNeedleText!: Phaser.GameObjects.Text;
  private dialogueBox!: Phaser.GameObjects.Container;
  private dialogueSpeaker!: Phaser.GameObjects.Text;
  private dialogueBody!: Phaser.GameObjects.Text;
  private dialogueHint!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private mapLayer!: Phaser.GameObjects.Container;
  private mapGraphics!: Phaser.GameObjects.Graphics;
  private mapPlayerDot!: Phaser.GameObjects.Rectangle;
  private mapLabels!: Phaser.GameObjects.Container;
  private mapGeom = { x: 0, y: 0, cell: 1 };

  constructor() {
    super('UIScene');
  }

  private get session(): GameSession {
    return this.registry.get(REGISTRY_SESSION) as GameSession;
  }

  create(): void {
    this.createHud();
    this.createScaleBar();
    this.createCompass();
    this.createDialogueBox();
    this.createMapOverlay();

    this.toastText = this.add
      .text(GAME_WIDTH / 2, 104, '', { ...textStyle(18, COLORS.accent), stroke: '#10141f', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(15)
      .setAlpha(0);

    const ev = this.game.events;
    const handlers: Array<[string, (...args: never[]) => void]> = [
      [GameEvents.DialogueShow, (p: DialoguePayload) => this.showDialogue(p)],
      [GameEvents.DialogueHide, () => this.dialogueBox.setVisible(false)],
      [GameEvents.Toast, (msg: string) => this.showToast(msg)],
      [GameEvents.MapShow, () => this.openMap()],
      [GameEvents.MapHide, () => this.mapLayer.setVisible(false)],
    ];
    for (const [name, fn] of handlers) ev.on(name, fn);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [name, fn] of handlers) ev.off(name, fn);
    });
  }

  override update(): void {
    const s = this.session;
    if (!s) return;
    const t = s.playerTile;
    const explored = Math.round(s.fog.exploredRatio * 100);
    this.hudText.setText(
      [
        `ตำแหน่ง: ช่อง X ${t.x}, Y ${t.y}`,
        `หันหน้าไป: ${THAI_DIRECTION[s.facing]}`,
        `ระยะทางรวม: ${fmtMeters(s.odometer.totalMeters)}`,
        `ระยะที่วัด (R): ${fmtMeters(s.odometer.tripMeters)}`,
        `สำรวจแล้ว: ${explored}% ของพื้นที่`,
      ].join('\n'),
    );
    const step = s.currentStep;
    this.objectiveText.setText(
      step
        ? `ฉาก ${step.order}/6 · ${step.title}\n${step.status === 'planned' ? '(ยังไม่เปิดในต้นแบบนี้) ' : ''}${step.objective}`
        : 'ผ่านครบทุกฉากแล้ว',
    );
    this.compassNeedleText.setText(THAI_DIRECTION[s.facing].replace('ทิศ', ''));
    if (this.mapLayer.visible) this.updateMapPlayer();
  }

  /* ---------------- HUD ---------------- */

  private createHud(): void {
    const s = this.session;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.82).fillRoundedRect(12, 12, 330, 214, 8);
    panel.lineStyle(2, COLORS.panelBorder, 0.9).strokeRoundedRect(12, 12, 330, 214, 8);
    this.add.text(24, 18, `${s.level.tambon}\n${s.level.title}`, { ...textStyle(16, COLORS.accent), lineSpacing: 0 });
    this.hudText = this.add.text(24, 70, '', { ...textStyle(15), lineSpacing: 2 });

    // กล่องภารกิจ อยู่ระหว่าง HUD (ซ้าย) กับเข็มทิศ (ขวา)
    const ox = 356;
    const ow = GAME_WIDTH - 124 - ox;
    const op = this.add.graphics();
    op.fillStyle(COLORS.panel, 0.82).fillRoundedRect(ox, 12, ow, 62, 8);
    this.objectiveText = this.add
      .text(ox + ow / 2, 18, '', { ...textStyle(14), align: 'center' })
      .setOrigin(0.5, 0);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 10,
        'WASD/ลูกศร: เดิน · E/Space: คุย · R: เริ่มวัดระยะ · G: ตาราง · M: แผนที่',
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
    this.compassNeedleText = this.add
      .text(cx, cy + 74, '', textStyle(13, COLORS.accent))
      .setOrigin(0.5, 0);
  }

  /* ---------------- กล่องบทสนทนา ---------------- */

  private createDialogueBox(): void {
    const w = GAME_WIDTH - 120;
    const h = 130;
    const x = 60;
    const y = GAME_HEIGHT - h - 44;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.panel, 1).fillRoundedRect(0, 0, w, h, 10);
    bg.lineStyle(3, COLORS.panelBorder, 1).strokeRoundedRect(0, 0, w, h, 10);
    this.dialogueSpeaker = this.add.text(20, 10, '', textStyle(18, COLORS.speaker));
    this.dialogueBody = this.add.text(20, 40, '', { ...textStyle(19), lineSpacing: 4 });
    this.dialogueHint = this.add.text(w - 16, h - 10, '', textStyle(13, COLORS.textDim)).setOrigin(1, 1);
    this.dialogueBox = this.add
      .container(x, y, [bg, this.dialogueSpeaker, this.dialogueBody, this.dialogueHint])
      .setVisible(false)
      .setDepth(10);
  }

  private showDialogue(p: DialoguePayload): void {
    const font = `19px ${FONT_FAMILY}`;
    this.dialogueSpeaker.setText(p.speaker);
    this.dialogueBody.setText(wrapThaiText(p.text, GAME_WIDTH - 160, font));
    this.dialogueHint.setText(`${p.index + 1}/${p.total} · กด E หรือ Space เพื่อไปต่อ`);
    this.dialogueBox.setVisible(true);
  }

  private showToast(message: string): void {
    this.toastText.setText(message).setAlpha(1);
    this.toastTimer?.remove();
    this.tweens.killTweensOf(this.toastText);
    this.toastTimer = this.time.delayedCall(2200, () => {
      this.tweens.add({ targets: this.toastText, alpha: 0, duration: 400 });
    });
  }

  /* ---------------- ระบบเปิดแผนที่ (M) ---------------- */

  private createMapOverlay(): void {
    const s = this.session;
    const { width, height } = s.grid;
    const cell = Math.floor(Math.min((GAME_WIDTH - 160) / width, (GAME_HEIGHT - 170) / height));
    const mw = width * cell;
    const mh = height * cell;
    const mx = Math.floor((GAME_WIDTH - mw) / 2);
    const my = 96;
    this.mapGeom = { x: mx, y: my, cell };

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.86).setOrigin(0);
    const title = this.add
      .text(GAME_WIDTH / 2, 20, `แผนที่สำรวจ ${s.level.tambon}`, textStyle(22, COLORS.accent))
      .setOrigin(0.5, 0);
    const info = this.add
      .text(
        GAME_WIDTH / 2,
        56,
        `มาตราส่วน ${s.scale.ratioLabel} · 1 ช่อง = ${s.scale.config.metersPerTile} ม. · ` +
          `1 ซม. บนแผนที่ = ${s.scale.mapCmToMeters(1)} ม. · เส้นตารางหนา = ทุก 100 ม.`,
        textStyle(14, COLORS.text),
      )
      .setOrigin(0.5, 0);
    this.mapGraphics = this.add.graphics();
    this.mapLabels = this.add.container(0, 0);
    this.mapPlayerDot = this.add.rectangle(0, 0, cell + 2, cell + 2, 0xff4d4d).setStrokeStyle(2, 0xffffff);
    this.tweens.add({ targets: this.mapPlayerDot, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });

    // แถบมาตราส่วนของแผนที่: 100 ม. = 10 ช่อง
    const barTiles = s.scale.metersToTiles(100);
    const bar = this.add.graphics();
    const bx = mx;
    const by = my + mh + 16;
    bar.fillStyle(0xf4efe1, 1).fillRect(bx, by, barTiles * cell, 6);
    bar.fillStyle(0xf4efe1, 1).fillRect(bx + barTiles * cell, by, barTiles * cell, 6);
    bar.fillStyle(0x10141f, 1).fillRect(bx + barTiles * cell + 1, by + 1, barTiles * cell - 2, 4);
    const barText = this.add.container(0, 0, [
      this.add.text(bx, by + 8, '0', textStyle(12)).setOrigin(0.5, 0),
      this.add.text(bx + barTiles * cell, by + 8, '100 ม.', textStyle(12)).setOrigin(0.5, 0),
      this.add.text(bx + 2 * barTiles * cell, by + 8, '200 ม.', textStyle(12)).setOrigin(0.5, 0),
    ]);
    const hint = this.add
      .text(mx + mw, by + 4, 'กด M หรือ Esc เพื่อปิด', textStyle(13, COLORS.textDim))
      .setOrigin(1, 0);
    const north = this.add.text(mx + mw + 18, my, '▲\nN\nเหนือ', { ...textStyle(14, COLORS.accent), align: 'center' });

    this.mapLayer = this.add
      .container(0, 0, [dim, title, info, this.mapGraphics, this.mapLabels, this.mapPlayerDot, bar, barText, hint, north])
      .setDepth(20)
      .setVisible(false);
  }

  private openMap(): void {
    const s = this.session;
    const { x: mx, y: my, cell } = this.mapGeom;
    const g = this.mapGraphics;
    const { width, height } = s.grid;
    g.clear();
    g.fillStyle(0x1b2233, 1).fillRect(mx, my, width * cell, height * cell);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!s.fog.isExplored(x, y)) continue;
        const obj = s.grid.getObject(x, y);
        const color = obj ? MAP_COLOR_OBJECT[obj] : MAP_COLOR_TERRAIN[s.grid.getTerrain(x, y)!];
        g.fillStyle(color, 1).fillRect(mx + x * cell, my + y * cell, cell, cell);
      }
    }
    // เส้นตารางทุก 10 ช่อง (100 ม.) พร้อมเลขพิกัด
    g.lineStyle(1, 0xffffff, 0.25);
    this.mapLabels.removeAll(true);
    for (let x = 0; x <= width; x += 10) {
      g.lineBetween(mx + x * cell, my, mx + x * cell, my + height * cell);
      this.mapLabels.add(this.add.text(mx + x * cell, my - 4, `${x}`, textStyle(11, COLORS.textDim)).setOrigin(0.5, 1));
    }
    for (let y = 0; y <= height; y += 10) {
      g.lineBetween(mx, my + y * cell, mx + width * cell, my + y * cell);
      this.mapLabels.add(this.add.text(mx - 6, my + y * cell, `${y}`, textStyle(11, COLORS.textDim)).setOrigin(1, 0.5));
    }
    g.lineStyle(2, COLORS.panelBorder, 1).strokeRect(mx, my, width * cell, height * cell);

    for (const lm of s.level.landmarks) {
      if (!s.discoveredLandmarks.has(lm.id)) continue;
      const lx = mx + (lm.at.x + 0.5) * cell;
      const ly = my + (lm.at.y + 0.5) * cell;
      g.fillStyle(0xffd84d, 1).fillCircle(lx, ly, 4);
      this.mapLabels.add(
        this.add
          .text(lx, ly - 6, lm.name, { ...textStyle(12, '#ffffff'), stroke: '#10141f', strokeThickness: 3 })
          .setOrigin(0.5, 1),
      );
    }
    this.updateMapPlayer();
    this.mapLayer.setVisible(true);
  }

  private updateMapPlayer(): void {
    const { x: mx, y: my, cell } = this.mapGeom;
    const t = this.session.playerTile;
    this.mapPlayerDot.setPosition(mx + (t.x + 0.5) * cell, my + (t.y + 0.5) * cell);
  }
}

