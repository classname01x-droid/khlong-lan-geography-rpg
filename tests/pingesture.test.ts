import { describe, expect, it } from 'vitest';
import { cssToGame, gameToCss, PIN_HIT_MIN_CSS, PinGesture, pinHitRadius, TAP_SLOP_CSS } from '../src/core/ui/PinGesture';
import { screenToTile } from '../src/core/ui/MapViewport';

describe('ปักหมุดบนแผนที่: แยก แตะ / ลากหมุด / เลื่อนแผนที่ (วัดเป็น CSS px)', () => {
  it('แตะที่นิ้วสั่นเล็กน้อย (ไม่เกิน 14 CSS px) ยังนับเป็น "แตะ" → ย้ายหมุด (ปัญหาเดิม: 12 หน่วยภาพเกม = แค่ 5–8 CSS px บนโทรศัพท์)', () => {
    const g = new PinGesture();
    g.down(1, 100, 100, false);
    expect(g.move(1, 108, 105, true)).toBe('pending');
    expect(g.up(1)).toBe('tap');
    expect(TAP_SLOP_CSS).toBeGreaterThanOrEqual(12);
  });

  it('ลากเกินระยะแตะจากที่ว่าง → เลื่อนแผนที่ (เมื่อแผนที่เลื่อนได้) · ไม่ย้ายหมุด', () => {
    const g = new PinGesture();
    g.down(1, 100, 100, false);
    expect(g.move(1, 140, 100, true)).toBe('pan');
    expect(g.up(1)).toBe('pan');
    // แผนที่เลื่อนไม่ได้ (คอมพิวเตอร์) → ไม่ทำอะไร
    g.down(2, 100, 100, false);
    expect(g.move(2, 140, 100, false)).toBe('idle');
    expect(g.up(2)).toBe('none');
  });

  it('เริ่มแตะบนหมุด → ลากหมุดทันที (ไม่ต้องรอเกินระยะ) และจบด้วยการวางหมุด', () => {
    const g = new PinGesture();
    g.down(1, 50, 50, true);
    expect(g.move(1, 52, 51, true)).toBe('pin');
    expect(g.move(1, 200, 120, true)).toBe('pin');
    expect(g.up(1)).toBe('pin');
  });

  it('แตะโดนหมุดแต่นิ้วแทบไม่ขยับ → นับเป็น "แตะ" (ใช้จุดที่นิ้ววางลง)', () => {
    const g = new PinGesture();
    g.down(1, 50, 50, true);
    g.move(1, 53, 52, true);
    expect(g.up(1)).toBe('tap');
  });

  it('นิ้วที่สองถูกละไว้ · ยกเลิก (pointercancel) ล้างสถานะ แตะครั้งต่อไปใช้ได้เสมอ (ไม่ค้าง)', () => {
    const g = new PinGesture();
    expect(g.down(1, 0, 0, false)).toBe(true);
    expect(g.down(2, 10, 10, true)).toBe(false);
    expect(g.move(2, 50, 50, true)).toBe('idle');
    g.reset();
    expect(g.down(3, 0, 0, true)).toBe(true);
    g.move(3, 40, 0, true);
    expect(g.up(3)).toBe('pin');
  });

  it('แปลง CSS px ↔ ภาพเกม จากตำแหน่ง canvas ปัจจุบัน (ภาพเกมถูกย่อ/เลื่อนบนจอ)', () => {
    const rect = { left: 120, top: 10, width: 480, height: 320 }; // ภาพเกม 960×640 ย่อครึ่ง
    expect(cssToGame(120, 10, rect)).toEqual({ x: 0, y: 0 });
    expect(cssToGame(600, 330, rect)).toEqual({ x: 960, y: 640 });
    expect(cssToGame(360, 170, rect)).toEqual({ x: 480, y: 320 });
    const back = gameToCss(480, 320, rect);
    expect(back).toEqual({ x: 360, y: 170 });
  });

  it('แตะบนแผนที่ที่ขยาย/เลื่อนอยู่ → ช่องที่ถูกต้อง (CSS → ภาพเกม → ช่อง)', () => {
    const rect = { left: 0, top: 0, width: 480, height: 320 };
    // แผนที่ขยาย ช่องละ 24 หน่วยภาพเกม เลื่อนไปทางซ้าย 300 / ขึ้น 200
    const pos = { x: -300, y: -200 };
    const view = { x: 0, y: 60, w: 960, h: 540 };
    const tap = cssToGame(250, 150, rect); // (500, 300)
    expect(screenToTile(tap.x, tap.y, pos, 24, 80, 60, view)).toEqual({ x: Math.floor(800 / 24), y: Math.floor(500 / 24) });
    // นอกพื้นที่แผนที่ (แถบหัวแผนที่) → ไม่ย้ายหมุด
    const bar = cssToGame(250, 10, rect);
    expect(screenToTile(bar.x, bar.y, pos, 24, 80, 60, view)).toBeNull();
  });

  it('รัศมีแตะโดนหมุด: อย่างน้อย 28 CSS px (นิ้ว) หรือ 0.9 ช่องเมื่อช่องใหญ่', () => {
    expect(pinHitRadius(6)).toBe(PIN_HIT_MIN_CSS);
    expect(pinHitRadius(60)).toBe(54);
  });
});
