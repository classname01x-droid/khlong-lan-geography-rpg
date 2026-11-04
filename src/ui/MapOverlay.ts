import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { GameSession } from '../core/session/GameSession';
import { MAP_COLOR_OBJECT, MAP_COLOR_TERRAIN } from '../graphics/tileIndex';
import type { MapSymbol, TilePoint } from '../core/world/types';
import { waterwayTiles } from '../core/world/Waterway';
import { drawMapSymbol, SYMBOL_LABEL } from './mapSymbols';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';

/**
 * ระบบเปิดแผนที่ (M): แสดงเฉพาะพื้นที่ที่สำรวจแล้ว มาตราส่วน 1:10,000
 * และโหมดปักหมุด (เมื่อภารกิจเปิดให้ปัก)
 *
 * ด่านที่มีข้อมูลเพิ่มเติมจะแสดง: เส้นชั้นความสูงทุก 10 ม. + จุดระดับความสูง (▲),
 * สัญลักษณ์แผนที่พร้อมคำอธิบาย และแผ่นที่สอง "แผนที่เก่า" (กด Tab สลับ) — ทั้งหมดใช้พิกัด/มาตราส่วนเดียวกัน
 */
const CONTOUR_INTERVAL_M = 10;
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
  private drawnSheet: 'current' | 'old' = 'current';
  private readonly title: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly s: GameSession) {
    const { width, height } = s.grid;
    const cell = Math.floor(Math.min((GAME_WIDTH - 160) / width, (GAME_HEIGHT - 210) / height));
    const mw = width * cell;
    const mh = height * cell;
    const mx = Math.floor((GAME_WIDTH - mw) / 2);
    const my = 92;
    this.geom = { x: mx, y: my, cell };

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.9).setOrigin(0);
    this.title = scene.add
      .text(GAME_WIDTH / 2, 16, `แผนที่สำรวจ ${s.level.tambon}`, textStyle(22, COLORS.accent))
      .setOrigin(0.5, 0);
    const title = this.title;
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
    if (!this.open || this.drawnSheet !== s.mapSheet) {
      this.drawnSheet = s.mapSheet;
      if (s.mapSheet === 'old' && s.isOldMapAvailable()) this.drawOldMap();
      else this.drawBase();
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
    this.hint.setText(
      s.pinStage === 'wisdom'
        ? 'Esc: กลับไปเลื่อนหมุด'
        : s.isOldMapAvailable()
          ? 'Tab: สลับแผนที่สำรวจ/แผนที่เก่า · M หรือ Esc: ปิด'
          : 'กด M หรือ Esc เพื่อปิด',
    );

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
    this.title.setText(`แผนที่สำรวจ ${s.level.tambon}`);
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

    // เส้นชั้นความสูงทุก 10 ม. (เฉพาะพื้นที่ที่สำรวจแล้ว)
    const elev = s.elevation;
    const legend: Array<MapSymbol | 'contour' | 'spot'> = [];
    if (elev) {
      legend.push('contour', 'spot');
      g.lineStyle(1.5, 0xf0c27a, 0.9);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!s.fog.isExplored(x, y)) continue;
          const b = elev.band(x + 0.5, y + 0.5, CONTOUR_INTERVAL_M);
          if (x + 1 < width && s.fog.isExplored(x + 1, y) && elev.band(x + 1.5, y + 0.5, CONTOUR_INTERVAL_M) !== b) {
            g.lineBetween(mx + (x + 1) * cell, my + y * cell, mx + (x + 1) * cell, my + (y + 1) * cell);
          }
          if (y + 1 < height && s.fog.isExplored(x, y + 1) && elev.band(x + 0.5, y + 1.5, CONTOUR_INTERVAL_M) !== b) {
            g.lineBetween(mx + x * cell, my + (y + 1) * cell, mx + (x + 1) * cell, my + (y + 1) * cell);
          }
        }
      }
      // จุดระดับความสูง (▲ + ค่าความสูงที่คำนวณจากแบบจำลอง)
      for (const p of s.level.spotHeights ?? []) {
        if (!s.fog.isExplored(p.x, p.y)) continue;
        const px = mx + (p.x + 0.5) * cell;
        const py = my + (p.y + 0.5) * cell;
        g.fillStyle(0x10141f, 1).fillTriangle(px - 4, py + 3, px + 4, py + 3, px, py - 4);
        this.labels.add(
          scene.add
            .text(px + 5, py - 2, `${elev.meters(p)}`, { ...textStyle(11, '#fff6d5'), stroke: '#10141f', strokeThickness: 3 })
            .setOrigin(0, 0.5),
        );
      }
    }

    for (const lm of s.level.landmarks) {
      if (!s.isLandmarkVisible(lm)) continue;
      const lx = mx + (lm.at.x + 0.5) * cell;
      const ly = my + (lm.at.y + 0.5) * cell;
      if (lm.symbol) {
        g.fillStyle(0xf4efe1, 0.9).fillCircle(lx, ly, 8);
        drawMapSymbol(g, lm.symbol, lx, ly);
        if (!legend.includes(lm.symbol)) legend.push(lm.symbol);
      } else {
        g.fillStyle(0xffd84d, 1).fillCircle(lx, ly, 4);
      }
      const side = lm.mapLabelAt ?? 'above';
      const [tx, ty, ox, oy] =
        side === 'left' ? [lx - 10, ly, 1, 0.5] : side === 'right' ? [lx + 10, ly, 0, 0.5] : side === 'below' ? [lx, ly + 8, 0.5, 0] : [lx, ly - 6, 0.5, 1];
      this.labels.add(
        scene.add
          .text(tx, ty, lm.name, { ...textStyle(12, '#ffffff'), stroke: '#10141f', strokeThickness: 3 })
          .setOrigin(ox, oy),
      );
    }
    if (s.pinnedAt) {
      g.fillStyle(0xff4dd2, 1).fillCircle(mx + (s.pinnedAt.x + 0.5) * cell, my + (s.pinnedAt.y + 0.5) * cell, 5);
    }
    this.drawLegend(legend);
  }

  /** คำอธิบายสัญลักษณ์ (เฉพาะสัญลักษณ์ที่ปรากฏบนแผ่นนี้) */
  private drawLegend(items: Array<MapSymbol | 'contour' | 'spot'>): void {
    if (items.length === 0) return;
    const scene = this.root.scene;
    const g = this.graphics;
    const { x: mx, y: my, cell } = this.geom;
    const x = mx + this.s.grid.width * cell + 10;
    let y = my + 78;
    this.labels.add(scene.add.text(x, y, 'สัญลักษณ์', textStyle(13, COLORS.accent)));
    y += 24;
    for (const item of items) {
      const cx = x + 9;
      const cy = y + 9;
      if (item === 'contour') {
        g.lineStyle(1.5, 0xf0c27a, 1).lineBetween(x + 1, cy + 3, x + 17, cy - 3);
      } else if (item === 'spot') {
        g.fillStyle(0xf4efe1, 1).fillTriangle(cx - 4, cy + 3, cx + 4, cy + 3, cx, cy - 4);
      } else {
        g.fillStyle(0xf4efe1, 0.9).fillCircle(cx, cy, 8);
        drawMapSymbol(g, item, cx, cy);
      }
      const label = item === 'contour' ? 'เส้นชั้นความสูง 10 ม.' : item === 'spot' ? 'ระดับความสูง (ม.)' : SYMBOL_LABEL[item];
      this.labels.add(scene.add.text(x + 22, y, label, textStyle(11, COLORS.text)));
      y += 21;
    }
  }

  /** แผ่นที่สอง: แผนที่เก่า (วาดมือ) — แสดงทั้งแผ่น ไม่ขึ้นกับหมอก แต่ไม่มีเส้นชั้นความสูง */
  private drawOldMap(): void {
    const s = this.s;
    const old = s.level.oldMap!;
    const scene = this.root.scene;
    const { x: mx, y: my, cell } = this.geom;
    const g = this.graphics;
    const { width, height } = s.grid;
    this.title.setText(old.title);
    g.clear();
    this.labels.removeAll(true);
    g.fillStyle(0xe9dcb8, 1).fillRect(mx, my, width * cell, height * cell);
    for (let i = 0; i < 400; i++) {
      g.fillStyle(0xd6c49a, 0.6).fillRect(mx + ((i * 37) % (width * cell)), my + ((i * 53) % (height * cell)), 2, 2);
    }
    // เส้นตาราง/เลขพิกัดชุดเดียวกับแผนที่สำรวจ — เทียบตำแหน่งได้ตรงกัน
    g.lineStyle(1, 0x8a6d3b, 0.35);
    for (let x = 0; x <= width; x += 10) {
      g.lineBetween(mx + x * cell, my, mx + x * cell, my + height * cell);
      this.labels.add(scene.add.text(mx + x * cell, my - 4, `${x}`, textStyle(11, COLORS.textDim)).setOrigin(0.5, 1));
    }
    for (let y = 0; y <= height; y += 10) {
      g.lineBetween(mx, my + y * cell, mx + width * cell, my + y * cell);
      this.labels.add(scene.add.text(mx - 6, my + y * cell, `${y}`, textStyle(11, COLORS.textDim)).setOrigin(1, 0.5));
    }
    const tileCenter = (p: TilePoint) => [mx + (p.x + 0.5) * cell, my + (p.y + 0.5) * cell] as const;
    for (const line of old.lines) {
      if (line.style === 'stream') {
        g.fillStyle(0x2f7fd0, 1);
        for (const p of waterwayTiles(line.points)) g.fillRect(mx + p.x * cell, my + p.y * cell, cell + 1, cell + 1);
        continue;
      }
      const tiles = waterwayTiles(line.points);
      tiles.forEach((p, i) => {
        if (line.style === 'trail' && i % 3 === 2) return; // ทางเดินเก่า = เส้นประ
        const [cx, cy] = tileCenter(p);
        g.fillStyle(line.style === 'road' ? 0x6b4a2a : 0x8a5a2b, 1).fillRect(cx - 2, cy - 2, line.style === 'road' ? 5 : 3, line.style === 'road' ? 5 : 3);
      });
    }
    const legend: MapSymbol[] = [];
    for (const m of old.marks) {
      const [cx, cy] = tileCenter(m.at);
      drawMapSymbol(g, m.symbol, cx, cy);
      if (!legend.includes(m.symbol)) legend.push(m.symbol);
      const side = m.labelAt ?? 'above';
      const [lx, ly, ox, oy] =
        side === 'left' ? [cx - 10, cy, 1, 0.5] : side === 'right' ? [cx + 10, cy, 0, 0.5] : side === 'below' ? [cx, cy + 10, 0.5, 0] : [cx, cy - 10, 0.5, 1];
      this.labels.add(scene.add.text(lx, ly, m.label, textStyle(12, '#3a2a1a')).setOrigin(ox, oy));
    }
    g.lineStyle(3, 0x5a3a1e, 1).strokeRect(mx, my, width * cell, height * cell);
    this.labels.add(
      scene.add.text(mx + 8, my + height * cell - 22, old.note, textStyle(12, '#5a3a1e')),
    );
    this.drawLegend(legend);
  }

  updatePlayer(): void {
    const { x: mx, y: my, cell } = this.geom;
    const t = this.s.playerTile;
    this.playerDot.setPosition(mx + (t.x + 0.5) * cell, my + (t.y + 0.5) * cell);
  }
}
