import type { Box } from '../core/ui/LabelLayout';

/**
 * พื้นที่ของแถบบนจอ (DOM) ที่ซ้อนอยู่บนภาพเกม — แถบภารกิจ แถบสถานะ การ์ดบทแนะนำ ข้อความโต้ตอบ ปุ่มที่ซ้อนบนภาพ
 * หน่วย: CSS px นับจากมุมซ้ายบนของ canvas · TouchLayer เขียน (ทุก 100 ms) · WorldScene อ่านเพื่อวางป้าย "คุย" ไม่ให้ถูกบัง
 */
export const hudObstacles: { rects: Box[]; soft: Box[] } = { rects: [], soft: [] };

/** rects = ห้ามทับ · soft = เลี่ยงถ้าทำได้ (เช่น ข้อความโต้ตอบ "พูดคุยกับ…" ที่บอกเรื่องเดียวกับป้าย) */
export function setHudObstacles(rects: Box[], soft: Box[] = []): void {
  hudObstacles.rects = rects;
  hudObstacles.soft = soft;
}
