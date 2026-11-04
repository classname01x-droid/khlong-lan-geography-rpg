import type { ScaleSystem } from '../scale/ScaleSystem';

/**
 * เครื่องนับระยะทาง (odometer) — สะสมระยะจาก "การเคลื่อนที่จริง" ของตัวละคร
 * ในแต่ละเฟรม (ตำแหน่งหลังชนสิ่งกีดขวางแล้ว) ไม่ได้ประมาณจากความเร็วหรือเวลา
 * ดังนั้นการเดินชนกำแพงจะไม่เพิ่มระยะทาง
 */
export class DistanceTracker {
  private totalPx = 0;
  private tripPx = 0;
  private lastX: number | null = null;
  private lastY: number | null = null;

  /** การขยับที่น้อยกว่านี้ (พิกเซล) ถือเป็นการสั่นของ physics ไม่นับ */
  static readonly JITTER_PX = 0.01;

  constructor(private readonly scale: ScaleSystem) {}

  /** ตั้งจุดเริ่มต้นโดยไม่นับระยะ (เช่น ตอนเกิด หรือวาร์ปข้ามฉาก) */
  teleport(x: number, y: number): void {
    this.lastX = x;
    this.lastY = y;
  }

  /** บันทึกตำแหน่งปัจจุบัน; คืนค่าระยะที่เพิ่มขึ้นในเฟรมนี้ (พิกเซล) */
  sample(x: number, y: number): number {
    if (this.lastX === null || this.lastY === null) {
      this.teleport(x, y);
      return 0;
    }
    const step = Math.hypot(x - this.lastX, y - this.lastY);
    this.lastX = x;
    this.lastY = y;
    if (step < DistanceTracker.JITTER_PX) return 0;
    this.totalPx += step;
    this.tripPx += step;
    return step;
  }

  /** ระยะทางรวมตั้งแต่เริ่มเกม (เมตร) */
  get totalMeters(): number {
    return this.scale.pxToMeters(this.totalPx);
  }

  /** ระยะทางช่วงที่กำลังวัด (เมตร) — รีเซ็ตได้เพื่อวัดเส้นทางแต่ละเส้น */
  get tripMeters(): number {
    return this.scale.pxToMeters(this.tripPx);
  }

  resetTrip(): void {
    this.tripPx = 0;
  }

  /** คืนค่าระยะทางรวมจากเกมที่บันทึกไว้ (ระยะช่วงที่วัดเริ่มใหม่) */
  restoreTotal(totalMeters: number): void {
    this.totalPx = Math.max(0, this.scale.metersToPx(totalMeters));
    this.tripPx = 0;
  }
}
