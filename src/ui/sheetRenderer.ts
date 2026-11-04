import type Phaser from 'phaser';
import type { BaseMapDefinition } from '../content/types';
import type { Direction8 } from '../core/direction/Compass';
import { waterwayTiles } from '../core/world/Waterway';
import type { MapSymbol, TilePoint } from '../core/world/types';
import { drawMapSymbol } from './mapSymbols';
import { COLORS, textStyle } from './theme';

export interface SheetGeom {
  x: number;
  y: number;
  cell: number;
  width: number;
  height: number;
}

const ARROW: Record<Direction8, [number, number]> = {
  N: [0, -1],
  NE: [0.7, -0.7],
  E: [1, 0],
  SE: [0.7, 0.7],
  S: [0, 1],
  SW: [-0.7, 0.7],
  W: [-1, 0],
  NW: [-0.7, -0.7],
};

/** ลูกศรทิศน้ำไหลที่พิมพ์บนแผนที่ */
export function drawFlowArrow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, toward: Direction8, len = 12): void {
  const [dx, dy] = ARROW[toward];
  const tx = cx + dx * len;
  const ty = cy + dy * len;
  g.lineStyle(2, 0x0b3d7a, 1).lineBetween(cx - dx * len * 0.4, cy - dy * len * 0.4, tx, ty);
  const px = -dy;
  const py = dx;
  g.fillStyle(0x0b3d7a, 1).fillTriangle(tx + dx * 4, ty + dy * 4, tx + px * 5, ty + py * 5, tx - px * 5, ty - py * 5);
}

/**
 * วาดแผนที่ฐาน (กระดาษ) หนึ่งฉบับ — ใช้ทั้งในหน้าแผนที่ (M) และหน้าเปรียบเทียบ (C)
 * ใช้พิกัดช่องเดียวกับแผนที่สำรวจ จึงวางเทียบกันได้ตรงตำแหน่ง
 * @returns สัญลักษณ์ที่ปรากฏ (ใช้ทำคำอธิบายสัญลักษณ์)
 */
export function drawBaseSheet(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  labels: Phaser.GameObjects.Container,
  sheet: BaseMapDefinition,
  geom: SheetGeom,
  opts: { labelSize?: number; showGridNumbers?: boolean; showNote?: boolean } = {},
): MapSymbol[] {
  const { x: mx, y: my, cell, width, height } = geom;
  const labelSize = opts.labelSize ?? 12;
  g.fillStyle(0xe9dcb8, 1).fillRect(mx, my, width * cell, height * cell);
  for (let i = 0; i < 400; i++) {
    g.fillStyle(0xd6c49a, 0.6).fillRect(mx + ((i * 37) % (width * cell)), my + ((i * 53) % (height * cell)), 2, 2);
  }
  // เส้นตาราง/เลขพิกัดชุดเดียวกับแผนที่สำรวจ — เทียบตำแหน่งได้ตรงกัน
  g.lineStyle(1, 0x8a6d3b, 0.35);
  for (let x = 0; x <= width; x += 10) {
    g.lineBetween(mx + x * cell, my, mx + x * cell, my + height * cell);
    if (opts.showGridNumbers !== false) {
      labels.add(scene.add.text(mx + x * cell, my - 4, `${x}`, textStyle(11, COLORS.textDim)).setOrigin(0.5, 1));
    }
  }
  for (let y = 0; y <= height; y += 10) {
    g.lineBetween(mx, my + y * cell, mx + width * cell, my + y * cell);
    if (opts.showGridNumbers !== false) {
      labels.add(scene.add.text(mx - 6, my + y * cell, `${y}`, textStyle(11, COLORS.textDim)).setOrigin(1, 0.5));
    }
  }
  const tileCenter = (p: TilePoint) => [mx + (p.x + 0.5) * cell, my + (p.y + 0.5) * cell] as const;
  for (const line of sheet.lines) {
    const tiles = waterwayTiles(line.points);
    if (line.style === 'stream') {
      g.fillStyle(0x2f7fd0, 1);
      for (const p of tiles) g.fillRect(mx + p.x * cell, my + p.y * cell, cell + 1, cell + 1);
      continue;
    }
    const size = line.style === 'road' ? Math.max(3, cell - 2) : Math.max(2, cell - 4);
    tiles.forEach((p, i) => {
      if (line.style === 'trail' && i % 3 === 2) return; // ทางเดิน = เส้นประ
      const [cx, cy] = tileCenter(p);
      g.fillStyle(line.style === 'road' ? 0x6b4a2a : 0x8a5a2b, 1).fillRect(cx - size / 2, cy - size / 2, size, size);
    });
  }
  for (const a of sheet.flowArrows ?? []) {
    const [cx, cy] = tileCenter(a.at);
    drawFlowArrow(g, cx + cell * 2.5, cy, a.toward, Math.max(8, cell * 1.8));
  }
  const legend: MapSymbol[] = [];
  for (const m of sheet.marks) {
    const [cx, cy] = tileCenter(m.at);
    drawMapSymbol(g, m.symbol, cx, cy);
    if (!legend.includes(m.symbol)) legend.push(m.symbol);
    const side = m.labelAt ?? 'above';
    const [lx, ly, ox, oy] =
      side === 'left'
        ? [cx - 10, cy, 1, 0.5]
        : side === 'right'
          ? [cx + 10, cy, 0, 0.5]
          : side === 'below'
            ? [cx, cy + 10, 0.5, 0]
            : [cx, cy - 10, 0.5, 1];
    labels.add(scene.add.text(lx, ly, m.label, textStyle(labelSize, '#3a2a1a')).setOrigin(ox, oy));
  }
  g.lineStyle(3, 0x5a3a1e, 1).strokeRect(mx, my, width * cell, height * cell);
  if (opts.showNote !== false) {
    labels.add(scene.add.text(mx + 8, my + height * cell - 22, sheet.note, textStyle(12, '#5a3a1e')));
  }
  return legend;
}
