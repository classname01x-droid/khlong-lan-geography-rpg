import type { Box } from '../core/ui/LabelLayout';

/**
 * พื้นที่ของแถบบนจอ (DOM) ที่ซ้อนอยู่บนภาพเกม — แถบภารกิจ แถบสถานะ การ์ดบทแนะนำ ข้อความโต้ตอบ ปุ่มที่ซ้อนบนภาพ
 * หน่วย: CSS px นับจากมุมซ้ายบนของ canvas · TouchLayer เขียน (ทุก 100 ms) · WorldScene อ่านเพื่อวางป้าย "คุย" ไม่ให้ถูกบัง
 */
export const hudObstacles: { rects: Box[] } = { rects: [] };

export function setHudObstacles(rects: Box[]): void {
  hudObstacles.rects = rects;
}
