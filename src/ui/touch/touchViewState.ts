import { DEFAULT_TOUCH_ZOOM_INDEX } from '../../core/ui/MapViewport';

/**
 * สถานะการแสดงผลบนจอสัมผัสที่ไม่ใช่สถานะเกม (ไม่บันทึก ไม่กระทบภารกิจ)
 * TouchLayer (DOM) เขียน · UIScene/overlay ใน canvas อ่าน — และกลับกันสำหรับขนาดช่องแผนที่ (ใช้วาดแถบมาตราส่วนใน DOM)
 */
export interface TouchViewState {
  /** เพิ่มทุกครั้งที่ค่าเปลี่ยน — UIScene วาดใหม่เมื่อเลขนี้เปลี่ยน */
  version: number;
  mapZoomIndex: number;
  legend: boolean;
  /** หน้าเปรียบเทียบแผนที่: ดูฉบับที่ 1 / 2 หรือหน้าหลักฐานและผล */
  compareTab: 0 | 1 | 'text';
  /** พื้นที่ขอบภาพเกมที่แถบ DOM บังอยู่ (หน่วย canvas 960×640) — แผนที่วางเฉพาะส่วนที่มองเห็น */
  mapInsets: { top: number; right: number; bottom: number; left: number };
  /** ขนาดช่องแผนที่ปัจจุบันบน canvas (หลังขยาย) — 0 = ไม่ได้เปิดแผนที่ */
  mapCellPx: number;
  /** คำอธิบายสัญลักษณ์ของแผ่นที่กำลังดู (ไอคอนเป็น data URL วาดจากโค้ดเดียวกับแผนที่) */
  legendItems: Array<{ label: string; icon: string }>;
}

export const touchView: TouchViewState = {
  version: 0,
  mapZoomIndex: DEFAULT_TOUCH_ZOOM_INDEX,
  legend: false,
  compareTab: 0,
  mapInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  mapCellPx: 0,
  legendItems: [],
};

export function setTouchView(patch: Partial<Omit<TouchViewState, 'version'>>): void {
  let changed = false;
  for (const [k, v] of Object.entries(patch) as Array<[keyof TouchViewState, unknown]>) {
    const cur = touchView[k];
    const same = typeof v === 'object' && v !== null ? JSON.stringify(cur) === JSON.stringify(v) : cur === v;
    if (!same) {
      (touchView as unknown as Record<string, unknown>)[k] = v;
      changed = true;
    }
  }
  if (changed) touchView.version++;
}
