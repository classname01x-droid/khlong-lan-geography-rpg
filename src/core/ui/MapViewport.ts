/**
 * มุมมองแผนที่แบบซูม/เลื่อนบนจอสัมผัส (ตรรกะล้วน ทดสอบได้)
 *
 * แผนที่ยังเป็นแผนที่เดิม (มาตราส่วน 1:10,000 · 1 ช่อง = 10 ม. · พิกัดเดิม) — แค่ขยายการแสดงผลบนจอเล็ก
 * เพื่อให้ชื่อสถานที่อ่านได้ แล้วให้ผู้เล่นลากเลื่อนดูส่วนอื่น · แถบมาตราส่วนบนจอคำนวณใหม่ตามการขยาย
 */
export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ระดับการขยายที่เลือกได้ (1 = เห็นทั้งแผนที่) */
export const MAP_ZOOMS = [1, 2, 3] as const;
export const DEFAULT_TOUCH_ZOOM_INDEX = 1;

/**
 * ระดับขยายเริ่มต้นตามขนาดจอจริง: ระดับต่ำสุดที่ทำให้ชื่อสถานที่บนจอสูงอย่างน้อย minCssPx
 * @param labelPx ขนาดตัวอักษรชื่อสถานที่บน canvas ที่ระดับ 1×
 * @param cssPerCanvasPx อัตราส่วนภาพเกมบนจอ (ความกว้าง CSS ÷ 960)
 */
export function readableZoomIndex(labelPx: number, cssPerCanvasPx: number, minCssPx = 13): number {
  const i = MAP_ZOOMS.findIndex((z) => labelPx * z * cssPerCanvasPx >= minCssPx);
  return i < 0 ? MAP_ZOOMS.length - 1 : Math.max(DEFAULT_TOUCH_ZOOM_INDEX, i);
}

/** ขนาดช่องที่ทำให้ทั้งแผนที่พอดีกับพื้นที่แสดงผล (ระดับ 1×) */
export function fitCell(gridW: number, gridH: number, view: ViewRect): number {
  return Math.max(2, Math.floor(Math.min(view.w / gridW, view.h / gridH)));
}

/**
 * จำกัดตำแหน่งการเลื่อน: แผนที่เล็กกว่าพื้นที่ → จัดกึ่งกลาง · ใหญ่กว่า → ห้ามเลื่อนจนเห็นขอบว่าง
 * @param pos ตำแหน่งมุมซ้ายบนของแผนที่ (หน่วยจอ) ที่ต้องการ
 */
export function clampPan(pos: { x: number; y: number }, mapW: number, mapH: number, view: ViewRect): { x: number; y: number } {
  const axis = (p: number, size: number, vStart: number, vSize: number) =>
    size <= vSize ? vStart + (vSize - size) / 2 : Math.min(vStart, Math.max(vStart + vSize - size, p));
  return { x: Math.round(axis(pos.x, mapW, view.x, view.w)), y: Math.round(axis(pos.y, mapH, view.y, view.h)) };
}

/** ตำแหน่งแผนที่ที่ทำให้ช่อง tile อยู่กลางพื้นที่แสดงผล (แล้วจำกัดขอบ) */
export function centerOnTile(
  tile: { x: number; y: number },
  cellPx: number,
  gridW: number,
  gridH: number,
  view: ViewRect,
): { x: number; y: number } {
  const want = { x: view.x + view.w / 2 - (tile.x + 0.5) * cellPx, y: view.y + view.h / 2 - (tile.y + 0.5) * cellPx };
  return clampPan(want, gridW * cellPx, gridH * cellPx, view);
}

/** ช่องแผนที่ ณ จุดบนจอ (คำนึงถึงตำแหน่งเลื่อนและการขยาย) — นอกแผนที่หรือนอกพื้นที่แสดงผล = null */
export function screenToTile(
  px: number,
  py: number,
  origin: { x: number; y: number },
  cellPx: number,
  gridW: number,
  gridH: number,
  view?: ViewRect,
): { x: number; y: number } | null {
  if (view && (px < view.x || py < view.y || px >= view.x + view.w || py >= view.y + view.h)) return null;
  const x = Math.floor((px - origin.x) / cellPx);
  const y = Math.floor((py - origin.y) / cellPx);
  return x >= 0 && y >= 0 && x < gridW && y < gridH ? { x, y } : null;
}

/** ระยะลากขั้นต่ำ (หน่วยจอ) ที่ถือว่าเป็นการเลื่อนแผนที่ ไม่ใช่การแตะเลือกช่อง */
export const DRAG_THRESHOLD = 12;

/** ความยาวแถบมาตราส่วนบนจอ (หน่วยจอ) ของระยะ meters ที่ระดับขยายปัจจุบัน */
export function scaleBarLength(meters: number, metersPerTile: number, cellPx: number): number {
  return (meters / metersPerTile) * cellPx;
}
