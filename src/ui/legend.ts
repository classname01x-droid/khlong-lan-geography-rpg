import Phaser from 'phaser';
import type { MapSymbol } from '../core/world/types';
import { drawMapSymbol, SYMBOL_LABEL } from './mapSymbols';
import { drawFlowArrow } from './sheetRenderer';

/** รายการในคำอธิบายสัญลักษณ์แผนที่ ('you' 'dot' 'pinned' ใช้เฉพาะแผงคำอธิบายบนจอสัมผัส) */
export type LegendItem = MapSymbol | 'contour' | 'spot' | 'flow' | 'you' | 'dot' | 'pinned';

export function legendLabel(item: LegendItem): string {
  switch (item) {
    case 'you':
      return 'ตำแหน่งของคุณ';
    case 'dot':
      return 'จุดสังเกต';
    case 'pinned':
      return 'หมุดที่ปักแล้ว';
    case 'contour':
      return 'เส้นชั้นความสูง 10 ม.';
    case 'spot':
      return 'ระดับความสูง (ม.)';
    case 'flow':
      return 'ทิศน้ำไหล (ตามแผนที่)';
    default:
      return SYMBOL_LABEL[item];
  }
}

/** วาดไอคอนคำอธิบาย 1 รายการ (จุดกึ่งกลาง cx, cy · x = ขอบซ้ายของไอคอน) — แบบเดียวกับที่วาดบนแผนที่ */
export function drawLegendIcon(g: Phaser.GameObjects.Graphics, item: LegendItem, cx: number, cy: number, x = cx - 9): void {
  if (item === 'you') {
    g.fillStyle(0xff4d4d, 1).fillRect(cx - 5, cy - 5, 10, 10);
    g.lineStyle(2, 0xffffff, 1).strokeRect(cx - 5, cy - 5, 10, 10);
  } else if (item === 'dot') {
    g.fillStyle(0xffd84d, 1).fillCircle(cx, cy, 4);
  } else if (item === 'pinned') {
    g.fillStyle(0xff4dd2, 1).fillCircle(cx, cy, 5);
  } else if (item === 'contour') {
    g.lineStyle(1.5, 0xf0c27a, 1).lineBetween(x + 1, cy + 3, x + 17, cy - 3);
  } else if (item === 'spot') {
    g.fillStyle(0xf4efe1, 1).fillTriangle(cx - 4, cy + 3, cx + 4, cy + 3, cx, cy - 4);
  } else if (item === 'flow') {
    g.fillStyle(0xf4efe1, 0.9).fillCircle(cx, cy, 8);
    drawFlowArrow(g, cx, cy + 3, 'N', 6);
  } else {
    g.fillStyle(0xf4efe1, 0.9).fillCircle(cx, cy, 8);
    drawMapSymbol(g, item, cx, cy);
  }
}

/**
 * ไอคอนคำอธิบายเป็นรูปภาพ (data URL) สำหรับแผงคำอธิบาย DOM บนจอสัมผัส
 * วาดด้วยโค้ดชุดเดียวกับบนแผนที่ จึงหน้าตาตรงกันทุกประการ (สำคัญกับปริศนาอ่านสัญลักษณ์แผนที่)
 */
export function legendIconUrl(scene: Phaser.Scene, item: LegendItem): string {
  const key = `legend-icon-${item}`;
  if (!scene.textures.exists(key)) {
    const g = new Phaser.GameObjects.Graphics(scene);
    g.fillStyle(0x10141f, 1).fillRect(0, 0, 24, 24);
    drawLegendIcon(g, item, 12, 12, 3);
    g.generateTexture(key, 24, 24);
    g.destroy();
  }
  return scene.textures.getBase64(key) as string;
}

export function legendEntries(scene: Phaser.Scene, items: LegendItem[]): Array<{ label: string; icon: string }> {
  return items.map((i) => ({ label: legendLabel(i), icon: legendIconUrl(scene, i) }));
}
