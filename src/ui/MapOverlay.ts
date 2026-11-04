import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { GameSession } from '../core/session/GameSession';
import { MAP_COLOR_OBJECT, MAP_COLOR_TERRAIN } from '../graphics/tileIndex';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';

/**
 * ระบบเปิดแผนที่ (M): แสดงเฉพาะพื้นที่ที่สำรวจแล้ว มาตราส่วน 1:10,000
 * และโหมดปักหมุด (เมื่อภารกิจเปิดให้ปัก)
 */
export class MapOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Container;
  private readonly playerDot: Phaser.GameObjects.Rectangle;
  private readonly cursor: Phaser.GameObjects.Rectangle;
  private readonly pinPanel: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly geom: { x: number; y: number; cell: number };
  private open = false;

  constructor(scene: Phaser.Scene, private readonly s: GameSession) {
    const { width, height } = s.grid;
    const cell = Math.floor(Math.min((GAME_WIDTH - 160) / width, (GAME_HEIGHT - 210) / height));
    const mw = width * cell;
    const mh = height * cell;
    const mx = Math.floor((GAME_WIDTH - mw) / 2);
    const my = 92;
    this.geom = { x: mx, y: my, cell };

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.9).setOrigin(0);
    const title = scene.add
      .text(GAME_WIDTH / 2, 16, `แผนที่สำรวจ ${s.level.tambon}`, textStyle(22, COLORS.accent))
      .setOrigin(0.5, 0);
    const info = scene.add
      .text(
        GAME_WIDTH / 2,
        52,
        `มาตราส่วน ${s.scale.ratioLabel} · 1 ช่อง = ${s.scale.config.metersPerTile} ม. · ` +
          `1 ซม. บนแผนที่ = ${s.scale.mapCmToMeters(1)} ม. · เส้นตารางหนา = ทุก 100 ม.`,
        textStyle(14, COLORS.text),
      )
      .setOrigin(0.5, 0);
    this.graphics = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.playerDot = scene.add.rectangle(0, 0, cell + 2, cell + 2, 0xff4d4d).setStrokeStyle(2, 0xffffff);
    scene.tweens.add({ targets: this.playerDot, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
    this.cursor = scene.add
      .rectangle(0, 0, cell * 3, cell * 3)
      .setStrokeStyle(2, 0xffd84d)
      .setFillStyle(0xffd84d, 0.25)
      .setVisible(false);

    // แถบมาตราส่วน: 100 ม. = 10 ช่อง (คำนวณจาก ScaleSystem)
    const barTiles = s.scale.metersToTiles(100);
    const bx = mx;
    const by = my + mh + 14;
    const bar = scene.add.graphics();
    bar.fillStyle(0xf4efe1, 1).fillRect(bx, by, barTiles * cell * 2, 6);
    bar.fillStyle(0x10141f, 1).fillRect(bx + barTiles * cell + 1, by + 1, barTiles * cell - 2, 4);
    const barText = scene.add.container(0, 0, [
      scene.add.text(bx, by + 8, '0', textStyle(12)).setOrigin(0.5, 0),
      scene.add.text(bx + barTiles * cell, by + 8, '100 ม.', textStyle(12)).setOrigin(0.5, 0),
      scene.add.text(bx + 2 * barTiles * cell, by + 8, '200 ม.', textStyle(12)).setOrigin(0.5, 0),
    ]);
    this.hint = scene.add.text(mx + mw, by + 4, '', textStyle(13, COLORS.textDim)).setOrigin(1, 0);
    const north = scene.add.text(mx + mw + 18, my, '▲\nN\nเหนือ', { ...textStyle(14, COLORS.accent), align: 'center' });
    this.pinPanel = scene.add.text(40, by + 28, '', { ...textStyle(15), lineSpacing: 2 });

    this.root = scene.add
      .container(0, 0, [
        dim,
        title,
        info,
        this.graphics,
        this.labels,
        this.playerDot,
        this.cursor,
        bar,
        barText,
        this.hint,
        north,
        this.pinPanel,
      ])
      .setDepth(20)
      .setVisible(false);
  }

  render(): void {
    const s = this.s;
    if (s.mode !== 'map') {
      this.open = false;
      this.root.setVisible(false);
      return;
    }
    if (!this.open) {
      this.drawBase();
      this.open = true;
    }
    this.root.setVisible(true);
    this.updatePlayer();
    const { x: mx, y: my, cell } = this.geom;

    const pinning = s.pinStage !== 'none' && s.pinCursor;
    this.cursor.setVisible(!!pinning);
    if (s.pinCursor) {
      this.cursor.setPosition(mx + (s.pinCursor.x + 0.5) * cell, my + (s.pinCursor.y + 0.5) * cell);
    }
    this.hint.setText(s.pinStage === 'wisdom' ? 'Esc: กลับไปเลื่อนหมุด' : 'กด M หรือ Esc เพื่อปิด');

    const lines: string[] = [];
    if (pinning && s.pinCursor) {
      const pin = s.level.pinTask!;
      const where = `ตำแหน่งหมุด: ช่อง X ${s.pinCursor.x}, Y ${s.pinCursor.y}`;
      if (s.pinStage === 'cursor') {
        lines.push(`โหมดปักหมุด · ${where} · WASD/ลูกศร: เลื่อน · Space: ปักหมุด`);
      } else {
        lines.push(`โหมดปักหมุด · ${where}`);
        lines.push(`${pin.wisdomPrompt}:  ${pin.wisdomChoices.map((c, i) => `${i + 1}) ${c.label}`).join('    ')}`);
      }
    }
    if (s.pinFeedback) lines.push(s.pinFeedback);
    this.pinPanel.setText(wrapThaiText(lines.join('\n'), GAME_WIDTH - 80, `15px ${FONT_FAMILY}`));
    this.pinPanel.setColor(s.pinFeedback && s.pinStage === 'cursor' ? '#ffb4a3' : COLORS.text);
  }

  /** วาดแผนที่จากข้อมูลหมอก (เฉพาะตอนเปิด) */
  private drawBase(): void {
    const s = this.s;
    const { x: mx, y: my, cell } = this.geom;
    const g = this.graphics;
    const { width, height } = s.grid;
    const scene = this.root.scene;
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
    this.labels.removeAll(true);
    for (let x = 0; x <= width; x += 10) {
      g.lineBetween(mx + x * cell, my, mx + x * cell, my + height * cell);
      this.labels.add(scene.add.text(mx + x * cell, my - 4, `${x}`, textStyle(11, COLORS.textDim)).setOrigin(0.5, 1));
    }
    for (let y = 0; y <= height; y += 10) {
      g.lineBetween(mx, my + y * cell, mx + width * cell, my + y * cell);
      this.labels.add(scene.add.text(mx - 6, my + y * cell, `${y}`, textStyle(11, COLORS.textDim)).setOrigin(1, 0.5));
    }
    g.lineStyle(2, COLORS.panelBorder, 1).strokeRect(mx, my, width * cell, height * cell);

    for (const lm of s.level.landmarks) {
      if (!s.isLandmarkVisible(lm)) continue;
      const lx = mx + (lm.at.x + 0.5) * cell;
      const ly = my + (lm.at.y + 0.5) * cell;
      g.fillStyle(0xffd84d, 1).fillCircle(lx, ly, 4);
      this.labels.add(
        scene.add
          .text(lx, ly - 6, lm.name, { ...textStyle(12, '#ffffff'), stroke: '#10141f', strokeThickness: 3 })
          .setOrigin(0.5, 1),
      );
    }
    if (s.pinnedAt) {
      g.fillStyle(0xff4dd2, 1).fillCircle(mx + (s.pinnedAt.x + 0.5) * cell, my + (s.pinnedAt.y + 0.5) * cell, 5);
    }
  }

  updatePlayer(): void {
    const { x: mx, y: my, cell } = this.geom;
    const t = this.s.playerTile;
    this.playerDot.setPosition(mx + (t.x + 0.5) * cell, my + (t.y + 0.5) * cell);
  }
}
