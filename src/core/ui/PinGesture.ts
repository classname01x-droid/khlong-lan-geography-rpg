/**
 * การแตะ/ลากบนแผนที่ตอนปักหมุด (ตรรกะล้วน ทดสอบได้) — ใช้ร่วมกันทุกอุปกรณ์ (มือถือทุกยี่ห้อ แท็บเล็ต คอมพิวเตอร์)
 *
 * สาเหตุของปัญหาเดิม ("เข้าโหมดปักหมุดแล้วขยับหมุดไม่ได้" บนโทรศัพท์):
 *   ตัวแยกการแตะกับการลากใช้ระยะ 12 "หน่วยภาพเกม" (960×640) ซึ่งบนโทรศัพท์ที่ภาพเกมถูกย่อ 0.4–0.65 เท่า
 *   เท่ากับนิ้วขยับเพียง 5–8 CSS px — การแตะปกติของนิ้วสั่นเกินนั้นบ่อย จึงถูกนับเป็น "เลื่อนแผนที่" แทน "ย้ายหมุด"
 *   และการลากทุกครั้งเลื่อนแผนที่ (ลากหมุดไม่ได้)
 *
 * วิธีใหม่: วัดระยะเป็น CSS px ของจอจริง · เริ่มลากบนหมุด = ลากหมุด · เริ่มลากที่อื่น = เลื่อนแผนที่ · แตะ = ย้ายหมุดไปช่องนั้น
 * พิกัดภาพเกมคำนวณจาก getBoundingClientRect() ของ canvas ณ ตอนที่แตะทุกครั้ง (ไม่ใช้ค่าที่จำไว้ ซึ่งคลาดได้เมื่อแถบที่อยู่ของเบราว์เซอร์ยุบ/ขยาย)
 */

/** การขยับนิ้วไม่เกินนี้ (CSS px) ถือว่าเป็น "การแตะ" */
export const TAP_SLOP_CSS = 14;
/** รัศมีขั้นต่ำ (CSS px) รอบหมุดที่นับว่า "แตะโดนหมุด" (เริ่มลากหมุด) — นิ้วกว้างราว 40–48 px */
export const PIN_HIT_MIN_CSS = 28;

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** CSS px บนหน้าเว็บ → พิกัดภาพเกม (960×640) จากตำแหน่ง canvas ปัจจุบัน */
export function cssToGame(clientX: number, clientY: number, rect: RectLike, gameW = 960, gameH = 640): { x: number; y: number } {
  return { x: ((clientX - rect.left) * gameW) / rect.width, y: ((clientY - rect.top) * gameH) / rect.height };
}

/** พิกัดภาพเกม → CSS px */
export function gameToCss(gx: number, gy: number, rect: RectLike, gameW = 960, gameH = 640): { x: number; y: number } {
  return { x: rect.left + (gx * rect.width) / gameW, y: rect.top + (gy * rect.height) / gameH };
}

/** รัศมีแตะโดนหมุด (CSS px): อย่างน้อย PIN_HIT_MIN_CSS หรือ 0.9 ช่องเมื่อแผนที่ขยายจนช่องใหญ่ */
export function pinHitRadius(cellCss: number): number {
  return Math.max(PIN_HIT_MIN_CSS, cellCss * 0.9);
}

export type PinGestureMode = 'idle' | 'pending' | 'pin' | 'pan';

/**
 * สถานะของนิ้วเดียว (นิ้วอื่นถูกละไว้ — ไม่มีการซูมสองนิ้ว)
 *   down(onPin)  เริ่มแตะ: บนหมุด → ลากหมุดทันที · ที่อื่น → รอดูว่าจะเป็นแตะหรือลาก
 *   move()       เกิน TAP_SLOP_CSS → เลื่อนแผนที่ (canPan) · ลากหมุดอยู่ → ยังเป็นลากหมุด
 *   up()         คืนผล: 'tap' (ย้ายหมุดไปช่องที่แตะ) · 'pin' (จบการลากหมุด) · 'pan' · 'none'
 */
export class PinGesture {
  mode: PinGestureMode = 'idle';
  pointerId: number | null = null;
  start = { x: 0, y: 0 };
  /** ระยะสูงสุดที่นิ้วขยับจากจุดเริ่ม (CSS px) */
  travel = 0;

  down(pointerId: number, x: number, y: number, onPin: boolean): boolean {
    if (this.pointerId !== null) return false;
    this.pointerId = pointerId;
    this.start = { x, y };
    this.travel = 0;
    this.mode = onPin ? 'pin' : 'pending';
    return true;
  }

  move(pointerId: number, x: number, y: number, canPan: boolean): PinGestureMode {
    if (pointerId !== this.pointerId) return 'idle';
    this.travel = Math.max(this.travel, Math.hypot(x - this.start.x, y - this.start.y));
    if (this.mode === 'pending' && this.travel > TAP_SLOP_CSS) this.mode = canPan ? 'pan' : 'idle';
    return this.mode;
  }

  up(pointerId: number): 'tap' | 'pin' | 'pan' | 'none' {
    if (pointerId !== this.pointerId) return 'none';
    const m = this.mode;
    const small = this.travel <= TAP_SLOP_CSS;
    this.reset();
    // นิ้วแทบไม่ขยับ = "แตะ" เสมอ (แม้แตะโดนหมุด) → ใช้ตำแหน่งที่นิ้ววางลง ไม่ให้นิ้วสั่นตอนยกพาไปช่องข้าง ๆ
    if (m === 'pending' || (m === 'pin' && small)) return 'tap';
    if (m === 'pin') return 'pin';
    if (m === 'pan') return 'pan';
    return 'none';
  }

  /** ยกเลิก (pointercancel / เสียการจับนิ้ว / สลับแอป) — ไม่ค้างสถานะ แตะครั้งต่อไปใช้ได้เสมอ */
  reset(): void {
    this.mode = 'idle';
    this.pointerId = null;
    this.travel = 0;
  }
}
