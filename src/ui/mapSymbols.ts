import type Phaser from 'phaser';
import type { MapSymbol } from '../core/world/types';

/**
 * สัญลักษณ์แผนที่ (วาดด้วย Graphics — เป็น placeholder ที่เปลี่ยนเป็นไอคอนจริงได้ภายหลัง)
 * ใช้ทั้งแผนที่สำรวจและแผนที่เก่า เพื่อให้ผู้เล่นเทียบสัญลักษณ์ชุดเดียวกันได้
 */
export const SYMBOL_LABEL: Record<MapSymbol, string> = {
  school: 'โรงเรียน',
  temple: 'วัด',
  office: 'ศาลา/สำนักงาน',
  village: 'หมู่บ้าน',
  bridge: 'สะพาน',
  weir: 'ฝาย',
  spring: 'ตาน้ำ',
  pond: 'บ่อน้ำ (บ่อขุด)',
  marsh: 'หนองน้ำ',
  stones: 'ก้อนหินใหญ่',
  benchmark: 'หมุดหลักฐานระดับ',
  farm: 'พื้นที่เกษตร',
  hotspring: 'บ่อน้ำร้อน',
};

const BLUE = 0x2f7fd0;

export function drawMapSymbol(g: Phaser.GameObjects.Graphics, symbol: MapSymbol, cx: number, cy: number, ink = 0x2b2118): void {
  switch (symbol) {
    case 'school':
      g.fillStyle(0xffffff, 1).fillRect(cx - 5, cy - 3, 10, 7);
      g.lineStyle(1, ink, 1).strokeRect(cx - 5, cy - 3, 10, 7);
      g.lineBetween(cx + 3, cy - 3, cx + 3, cy - 9);
      g.fillStyle(0xd62f2f, 1).fillRect(cx + 3, cy - 9, 4, 3);
      return;
    case 'temple':
      g.fillStyle(0xe67e22, 1).fillTriangle(cx - 6, cy + 1, cx + 6, cy + 1, cx, cy - 7);
      g.fillStyle(0xffffff, 1).fillRect(cx - 4, cy + 1, 8, 5);
      g.lineStyle(1, ink, 1).strokeRect(cx - 4, cy + 1, 8, 5);
      return;
    case 'office':
      g.fillStyle(0xe8d9a8, 1).fillRect(cx - 5, cy - 5, 10, 10);
      g.lineStyle(2, ink, 1).strokeRect(cx - 5, cy - 5, 10, 10);
      return;
    case 'village':
      g.fillStyle(0xc0392b, 1);
      for (const [dx, dy] of [[-6, 0], [0, -4], [5, 1]]) g.fillRect(cx + dx - 2, cy + dy - 2, 5, 5);
      return;
    case 'bridge':
      g.lineStyle(2, ink, 1);
      g.lineBetween(cx - 6, cy - 3, cx + 6, cy - 3);
      g.lineBetween(cx - 6, cy + 3, cx + 6, cy + 3);
      return;
    case 'weir':
      g.lineStyle(3, ink, 1).lineBetween(cx - 7, cy, cx + 7, cy);
      g.lineStyle(1, BLUE, 1);
      for (const dx of [-5, 0, 5]) g.lineBetween(cx + dx, cy + 2, cx + dx - 2, cy + 6);
      return;
    case 'spring':
      g.lineStyle(2, BLUE, 1).strokeCircle(cx, cy, 6);
      g.fillStyle(BLUE, 1).fillCircle(cx, cy, 2.5);
      return;
    case 'pond':
      g.fillStyle(BLUE, 1).fillRect(cx - 6, cy - 4, 12, 8);
      g.lineStyle(1, ink, 1).strokeRect(cx - 6, cy - 4, 12, 8);
      return;
    case 'marsh':
      g.lineStyle(2, BLUE, 1);
      for (const dx of [-5, 0, 5]) g.lineBetween(cx + dx, cy + 4, cx + dx, cy - 3);
      g.lineBetween(cx - 8, cy + 4, cx + 8, cy + 4);
      return;
    case 'stones':
      g.fillStyle(0x6b6b6b, 1);
      for (const [dx, dy] of [[-4, 2], [3, 2], [0, -3]]) g.fillCircle(cx + dx, cy + dy, 2.6);
      return;
    case 'hotspring':
      g.fillStyle(0x6fb7e0, 1).fillEllipse(cx, cy + 3, 14, 6);
      g.lineStyle(1.5, 0xd94b4b, 1);
      for (const dx of [-4, 0, 4]) {
        g.lineBetween(cx + dx, cy + 1, cx + dx - 1.5, cy - 3);
        g.lineBetween(cx + dx - 1.5, cy - 3, cx + dx, cy - 7);
      }
      return;
    case 'farm':
      g.lineStyle(1.5, 0x4f7a1f, 1);
      for (const dx of [-5, 0, 5]) {
        g.lineBetween(cx + dx, cy + 5, cx + dx, cy - 3);
        g.lineBetween(cx + dx, cy - 1, cx + dx - 2, cy - 4);
        g.lineBetween(cx + dx, cy - 1, cx + dx + 2, cy - 4);
      }
      return;
    case 'benchmark':
      g.fillStyle(0xffffff, 1).fillTriangle(cx - 6, cy + 4, cx + 6, cy + 4, cx, cy - 6);
      g.lineStyle(1, ink, 1).strokeTriangle(cx - 6, cy + 4, cx + 6, cy + 4, cx, cy - 6);
      g.fillStyle(ink, 1).fillCircle(cx, cy + 1, 1.5);
      return;
  }
}
