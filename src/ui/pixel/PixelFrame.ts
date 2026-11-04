import type Phaser from 'phaser';
import { PIXEL, type FrameVariant } from './theme';

interface FrameColors {
  outline: number;
  border: number;
  highlight: number;
  shadow: number;
  fill: number;
}

const COLORS: Record<FrameVariant, FrameColors> = {
  paper: { outline: PIXEL.woodDark, border: PIXEL.wood, highlight: PIXEL.woodLight, shadow: PIXEL.woodDark, fill: PIXEL.cream },
  wood: { outline: 0x2a1a0c, border: PIXEL.woodDark, highlight: PIXEL.woodLight, shadow: 0x2a1a0c, fill: PIXEL.wood },
  green: { outline: 0x1a3314, border: PIXEL.greenDark, highlight: PIXEL.greenLight, shadow: 0x1a3314, fill: PIXEL.green },
  stone: { outline: 0x333333, border: PIXEL.stoneDark, highlight: 0xb0b0b0, shadow: 0x333333, fill: 0x7a7a7a },
};

/**
 * วาดกรอบหน้าต่างแบบ Pixel Art (มุมบาก ขอบไม้ เงาแสง) ด้วย fillRect ล้วน
 * — เป็น placeholder ที่เปลี่ยนเป็นภาพ 9-slice จริงได้ภายหลัง
 */
export function drawPixelFrame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: FrameVariant = 'paper',
  fillOverride?: number,
): void {
  const p = PIXEL.px;
  const c = COLORS[variant];
  // เงาตกกระทบ
  g.fillStyle(0x000000, 0.25).fillRect(x + p, y + h, w - p, p).fillRect(x + w, y + p, p, h - p);
  // ขอบนอก (มุมบาก)
  g.fillStyle(c.outline, 1).fillRect(x + p, y, w - 2 * p, h).fillRect(x, y + p, w, h - 2 * p);
  // ขอบไม้
  g.fillStyle(c.border, 1).fillRect(x + 2 * p, y + p, w - 4 * p, h - 2 * p).fillRect(x + p, y + 2 * p, w - 2 * p, h - 4 * p);
  // แสงด้านบน/ซ้าย และเงาด้านล่าง/ขวาของขอบ
  g.fillStyle(c.highlight, 1).fillRect(x + 2 * p, y + p, w - 4 * p, p).fillRect(x + p, y + 2 * p, p, h - 4 * p);
  g.fillStyle(c.shadow, 1).fillRect(x + 2 * p, y + h - 2 * p, w - 4 * p, p).fillRect(x + w - 2 * p, y + 2 * p, p, h - 4 * p);
  // พื้นใน
  g.fillStyle(fillOverride ?? c.fill, 1).fillRect(x + 2 * p, y + 2 * p, w - 4 * p, h - 4 * p);
}

/** ขนาดขอบด้านใน (ใช้จัดตำแหน่งข้อความในกรอบ) */
export const FRAME_INSET = PIXEL.px * 3;
