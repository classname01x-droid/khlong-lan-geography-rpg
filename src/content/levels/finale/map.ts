import type { MapDefinition, TileRect } from '../../../core/world/types';

/**
 * บทที่ 5 (บทสรุป): ลานจัดแสดงแผนที่ของครูเนม ที่โรงเรียนบ้านสักงาม — ไม่ใช่แผนที่ตำบลใหม่
 * 40 × 28 ช่อง (1 ช่อง = 10 ม. ตาม ScaleSystem เดิม) · ผังเป็นข้อมูลจำลอง
 *
 *   ห้องจัดแสดงแผนที่ (ด้านบน) · ป้ายจัดแสดง 4 ตำบลเรียงกลางลาน · ตู้แผนที่ภูมิปัญญา (ล็อกรหัส) · เสาธง/ประตูทางใต้
 */
export const FINALE_GROUNDS: TileRect = { x: 3, y: 3, w: 34, h: 22 };
/** ป้ายจัดแสดง 4 ตำบล (ตามลำดับบท) — ยืนอ่านที่ (x + 1, 15) */
export const BOARD_XS = [7, 14, 23, 30] as const;

export const finaleMap: MapDefinition = {
  widthTiles: 40,
  heightTiles: 28,
  seed: 6060,
  baseTerrain: 'grass',
  features: [
    { kind: 'rect', terrain: 'paving', area: { x: 6, y: 9, w: 28, h: 13 } },
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 19, y: 22 }, { x: 19, y: 27 }] },
    // ห้องจัดแสดงแผนที่ของครูเนม
    { kind: 'building', area: { x: 12, y: 4, w: 16, h: 4 }, roof: 'roofOrange', door: { x: 20, y: 7 } },
    // ป้ายจัดแสดง 4 ตำบล
    ...BOARD_XS.map((x, i) => ({
      kind: 'building' as const,
      area: { x, y: 12, w: 3, h: 2 },
      roof: (['roofRed', 'roofBlue', 'roofOrange', 'roofBlue'] as const)[i],
      door: { x: x + 1, y: 13 },
    })),
    // ตู้แผนที่ภูมิปัญญา (ล็อกด้วยรหัส 4 ช่อง)
    { kind: 'building', area: { x: 18, y: 17, w: 4, h: 2 }, roof: 'roofRed', door: { x: 20, y: 18 } },
    { kind: 'object', object: 'flagpole', at: { x: 24, y: 21 } },
    { kind: 'fence', area: FINALE_GROUNDS, gaps: [{ x: 19, y: 24 }, { x: 20, y: 24 }] },
    { kind: 'scatter', object: 'tree', area: { x: 0, y: 0, w: 40, h: 28 }, density: 0.05, exclude: [{ x: 2, y: 2, w: 36, h: 24 }, { x: 17, y: 24, w: 6, h: 4 }] },
    { kind: 'border', object: 'tree', thickness: 1 },
  ],
};
