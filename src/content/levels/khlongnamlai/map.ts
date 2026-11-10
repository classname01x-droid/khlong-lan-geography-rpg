import type { MapDefinition, TilePoint, TileRect } from '../../../core/world/types';

/**
 * แผนที่ ตำบลคลองน้ำไหล (ด่านที่ 2 "ปริศนาสารพิษแห่งต้นน้ำ") — 80 × 60 ช่อง = 800 × 600 เมตร (1 ช่อง = 10 ม. · 1:10,000)
 * ทิศเหนืออยู่ด้านบนจอ · แผนที่นี้เป็นข้อมูลสมมติเพื่อการออกแบบเกม
 *
 * ภูมิประเทศ (ดู ELEVATION): แอ่งต่ำ (< 100 ม.) ทางเหนือตรงกลาง · ที่สูงรอบแอ่ง (100–150 ม.) ที่ตั้งบ้านผู้ใหญ่บ้าน/บ้านตาคำ/สถานีป่าไม้
 *   · ภูเขา 2 ลูกทางใต้ (ตะวันตกชัน เส้นชิด · ตะวันออกกว้างลาดน้อย เส้นห่าง) ช่วงต่างระดับ 50 ม. → มีเส้นเพียง 100, 150, 200 ม.
 *   ไม่ขุดร่องลำน้ำ — น้ำไหลลงตามความลาดเอียง ตรวจด้วย tests/khlongnamlai.test.ts (ลำน้ำทั้งสามสายไหลลงทุกช่อง)
 *
 * ลำน้ำ 2 สายไหลลงจากภูเขาไปทางเหนือ (ขึ้นด้านบนจอ) มาบรรจบที่ (34,12) แล้วไหลต่อเป็นลำน้ำสายหลัก:
 *   ลำน้ำ A  ไหล่เขาตะวันตก  (30,33) → (30,24) → (32,17) → (34,12)
 *   ลำน้ำ B  ไหล่เขาตะวันออก (52,38) → (52,28) → (50,21) → (46,17) → (40,14) → (34,12)   ต้นน้ำ B ไม่ใช่ยอดเขา
 *   สายหลัก (34,12) → (34,0)
 *
 * ถนน/ทางเดิน (ทางแยกหลายทิศจากถนนสายหลัก y=10 — ไม่มีเส้นทางเดียวตรงไปเป้าหมาย):
 *   ถนนสายหลัก: บ้านผู้ใหญ่บ้าน (14,10) → สะพานข้ามลำน้ำสายหลัก (x=34) → บ้านตาคำ (54,10) → สถานีป่าไม้ (74,10)
 *   ทางแยก ตะวันตก x=25 (บ้านบนไหล่เขาตะวันตก · ทางเข้าต้นลำน้ำ A) · ทางแยกกลาง x=40 (ข้ามลำน้ำ B ด้วยสะพาน → บ้านบนเชิงเขา)
 *   · ทางแยก x=48 สั้น ๆ ลงแอ่งต่ำ (บ้านนางแป้น) · ทางแยกตะวันออก x=62 (บ้านบนไหล่เขาตะวันออก/ตะวันออกเฉียงใต้)
 *   ทางเชื่อม y=22 (ข้ามลำน้ำ A) · ทางเดินป่าเลียบลำน้ำ B ขึ้นต้นน้ำ (จากทางแยก x=48) และทางลัดจากถนน x=62 ที่ y=35
 */

/** แนวลำน้ำ (ใช้ร่วมกับ index.ts และ test) */
export const A_POINTS: TilePoint[] = [
  { x: 30, y: 33 },
  { x: 30, y: 24 },
  { x: 32, y: 17 },
  { x: 34, y: 12 },
];
export const B_POINTS: TilePoint[] = [
  { x: 52, y: 38 },
  { x: 52, y: 28 },
  { x: 50, y: 21 },
  { x: 46, y: 17 },
  { x: 40, y: 14 },
  { x: 34, y: 12 },
];
export const MAIN_POINTS: TilePoint[] = [
  { x: 34, y: 12 },
  { x: 34, y: 0 },
];

const HEADMAN_YARD: TileRect = { x: 10, y: 4, w: 9, h: 6 };
const KHAM_YARD: TileRect = { x: 50, y: 4, w: 9, h: 6 };
const STATION_YARD: TileRect = { x: 70, y: 4, w: 9, h: 6 };
const PAEN_YARD: TileRect = { x: 43, y: 11, w: 7, h: 6 };
const SITE_CLEARING: TileRect = { x: 53, y: 32, w: 8, h: 7 };
const HOUSE_YARDS: TileRect[] = [
  { x: 25, y: 29, w: 5, h: 4 },
  { x: 62, y: 27, w: 6, h: 5 },
  { x: 43, y: 25, w: 6, h: 5 },
  { x: 62, y: 43, w: 6, h: 5 },
];
const NO_TREES = [HEADMAN_YARD, KHAM_YARD, STATION_YARD, PAEN_YARD, SITE_CLEARING, ...HOUSE_YARDS];

export const khlongNamLaiMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 3030,
  baseTerrain: 'grass',
  // ระดับความสูง (เมตร): ที่ราบเอียงลงทางเหนือ 0.3 ม./ช่อง + ภูเขาตะวันตก (ชัน) + ไหล่เขาตะวันออก (กว้าง ลาดน้อย)
  // ระดับความสูง (เมตร): ที่ราบเอียงลงเหนือ 0.3 ม./ช่อง + ภูเขาตะวันตก (ชัน) + ไหล่เขาตะวันออก (กว้าง ลาดน้อย) + ที่สูงมุมเหนือซ้าย/ขวา
  elevation: {
    baseMeters: 62,
    slope: { dx: 0, dy: 0.3 },
    hills: [
      { at: { x: 36, y: 40 }, radiusTiles: 17, meters: 100 },
      { at: { x: 54, y: 37 }, radiusTiles: 24, meters: 88 },
      { at: { x: 10, y: 6 }, radiusTiles: 22, meters: 58 },
      { at: { x: 66, y: 8 }, radiusTiles: 24, meters: 60 },
    ],
  },
  features: [
    // ลำน้ำ A, ลำน้ำ B และลำน้ำสายหลักหลังจุดบรรจบ + หนองน้ำปลายน้ำ (ขอบเหนือ)
    { kind: 'path', terrain: 'water', width: 2, points: A_POINTS },
    { kind: 'path', terrain: 'water', width: 2, points: B_POINTS },
    { kind: 'path', terrain: 'water', width: 2, points: MAIN_POINTS },
    { kind: 'rect', terrain: 'water', area: { x: 31, y: 0, w: 7, h: 2 } },

    // ถนนสายหลัก (ข้ามลำน้ำสายหลักเป็นสะพานอัตโนมัติ)
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 10, y: 10 }, { x: 76, y: 10 }] },
    // ทางแยกตะวันตก → บ้านบนไหล่เขา + ทางเดินเข้าต้นลำน้ำ A (ทางตัน)
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 25, y: 12 }, { x: 25, y: 33 }, { x: 29, y: 34 }] },
    // ทางเชื่อมตะวันตก–กลาง (ข้ามลำน้ำ A เป็นสะพาน)
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 26, y: 22 }, { x: 40, y: 22 }] },
    // ทางแยกกลาง (ข้ามลำน้ำ B เป็นสะพาน) → บ้านบนเชิงเขา
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 40, y: 12 }, { x: 40, y: 27 }, { x: 44, y: 27 }] },
    // ทางแยกสั้นลงแอ่งต่ำ → ริมลำน้ำ B → ทางเดินป่าเลียบลำน้ำ B ขึ้นต้นน้ำ
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 48, y: 12 }, { x: 48, y: 16 }] },
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 48, y: 16 }, { x: 51, y: 19 }, { x: 54, y: 24 }, { x: 55, y: 29 }, { x: 55, y: 35 }] },
    // ทางแยกตะวันออก → บ้านบนไหล่เขาตะวันออก/ตะวันออกเฉียงใต้ · ทางลัดไปทางเดินเลียบลำน้ำ B
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 62, y: 12 }, { x: 62, y: 46 }] },
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 62, y: 35 }, { x: 55, y: 35 }] },

    // บ้านผู้ใหญ่บ้าน
    { kind: 'rect', terrain: 'paving', area: { x: 11, y: 8, w: 7, h: 2 } },
    { kind: 'building', area: { x: 12, y: 5, w: 5, h: 3 }, roof: 'roofBlue', door: { x: 14, y: 7 } },
    // บ้านตาคำ
    { kind: 'rect', terrain: 'paving', area: { x: 51, y: 8, w: 7, h: 2 } },
    { kind: 'building', area: { x: 52, y: 5, w: 5, h: 3 }, roof: 'roofRed', door: { x: 54, y: 7 } },
    // สถานีป่าไม้
    { kind: 'rect', terrain: 'paving', area: { x: 71, y: 8, w: 7, h: 2 } },
    { kind: 'building', area: { x: 72, y: 5, w: 5, h: 3 }, roof: 'roofOrange', door: { x: 74, y: 7 } },
    // บ้านชาวบ้าน 5 หลัง (ไม่มีป้ายชื่อบนแผนที่): ไหล่เขาตะวันตก · เชิงเขากลาง · ไหล่เขาตะวันออก · ตะวันออกเฉียงใต้ · แอ่งต่ำริมลำน้ำ B (บ้านนางแป้น)
    { kind: 'building', area: { x: 26, y: 30, w: 3, h: 2 }, roof: 'roofRed', door: { x: 26, y: 31 } },
    { kind: 'building', area: { x: 45, y: 26, w: 3, h: 2 }, roof: 'roofBlue', door: { x: 45, y: 27 } },
    { kind: 'building', area: { x: 63, y: 28, w: 3, h: 2 }, roof: 'roofOrange', door: { x: 63, y: 29 } },
    { kind: 'building', area: { x: 63, y: 45, w: 3, h: 2 }, roof: 'roofRed', door: { x: 63, y: 46 } },
    { kind: 'rect', terrain: 'paving', area: { x: 45, y: 15, w: 3, h: 1 } },
    { kind: 'building', area: { x: 44, y: 12, w: 4, h: 3 }, roof: 'roofBlue', door: { x: 47, y: 14 } },

    // ป่าบนภูเขา และต้นไม้ทั่วพื้นที่ (ถนน/น้ำไม่ถูกทับ · ลานบ้านและพื้นที่ตรวจสอบเว้นไว้)
    { kind: 'scatter', object: 'tree', area: { x: 18, y: 23, w: 58, h: 36 }, density: 0.22, exclude: NO_TREES },
    { kind: 'scatter', object: 'tree', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.04, exclude: NO_TREES },
    { kind: 'scatter', object: 'rock', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.006, exclude: NO_TREES },
    { kind: 'border', object: 'tree', thickness: 1 },
  ],
};
