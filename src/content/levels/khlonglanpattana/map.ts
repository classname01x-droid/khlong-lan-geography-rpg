import type { MapDefinition, TileRect, TilePoint } from '../../../core/world/types';

/**
 * แผนที่ต้นแบบ ตำบลคลองลานพัฒนา (ด่านสุดท้าย) — 80 × 60 ช่อง = 800 × 600 เมตร (1 ช่อง = 10 ม., แผนที่ 1:10,000)
 * พิกัดกริดจำลอง (ดู index.ts): จุดกำเนิดมุมตะวันตกเฉียงใต้ E 5,000 · N 2,000 — ไม่ใช่ละติจูด/ลองจิจูดจริง
 *
 * หมายเหตุ: ผัง ชื่อสถานที่ และแหล่งเรียนรู้ทั้งหมดเป็นข้อมูลจำลองเพื่อการออกแบบเกม
 * ยังไม่ใช่ตำแหน่งหรือข้อเท็จจริงของชุมชนในตำบลคลองลานพัฒนา
 *
 * จุดเป้าหมาย 3 แห่ง (ดู mission.ts → integratedSiteAnalysis) — บนเนินทั้งหมด:
 *   A อาคารบนเนินตะวันตก   (24,24)  ตรงพิกัด + ภูมิประเทศ/สัญลักษณ์ แต่ทิศจากสะพานไม่ตรง
 *   B อาคารบนเนินตะวันออก  (64,24)  ตรงหลักฐานทุกข้อ
 *   C วัดบนเนินตะวันออก     (60,19)  ตรงทิศ/ระยะจากสะพาน แต่สัญลักษณ์และพิกัดไม่ตรง
 */

/** แนวลำน้ำคลองลาน (ทิศน้ำไหลคำนวณจากระดับความสูง ไม่ใช่ลำดับจุด) */
export const STREAM_POINTS: TilePoint[] = [
  { x: 58, y: 0 },
  { x: 54, y: 10 },
  { x: 50, y: 20 },
  { x: 46, y: 30 },
  { x: 42, y: 40 },
  { x: 38, y: 50 },
  { x: 36, y: 59 },
];

export const START_GROUNDS: TileRect = { x: 4, y: 47, w: 16, h: 11 };
const SITE_AREAS: TileRect[] = [
  { x: 20, y: 20, w: 9, h: 7 },
  { x: 60, y: 20, w: 9, h: 7 },
  { x: 57, y: 15, w: 7, h: 5 },
];
const VILLAGE: TileRect = { x: 18, y: 34, w: 18, h: 8 };
/** รอบหมุดอ้างอิง — ไม่โปรยต้นไม้/หินทับ เพื่อให้เดินเข้าไปอ่านหมุดได้และไม่สับสนกับหินอื่น */
const RP_AREAS: TileRect[] = [
  { x: 17, y: 36, w: 7, h: 7 },
  { x: 47, y: 46, w: 7, h: 7 },
  { x: 67, y: 36, w: 7, h: 7 },
];

export const khlongLanPattanaMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 5050,
  baseTerrain: 'grass',
  // สูงขึ้นไปทางเหนือ (0.5 ม./ช่อง) + เนินตะวันตก + เนินตะวันออก → ลำน้ำไหลจากเหนือลงใต้
  elevation: {
    baseMeters: 150,
    slope: { dx: 0, dy: -0.5 },
    hills: [
      { at: { x: 24, y: 20 }, radiusTiles: 12, meters: 40 },
      { at: { x: 67, y: 18 }, radiusTiles: 14, meters: 40 },
    ],
  },
  features: [
    // ลำน้ำคลองลาน
    { kind: 'path', terrain: 'water', width: 2, points: STREAM_POINTS },
    // พื้นที่เกษตร (นา) ทางใต้ทั้งสองฝั่งลำน้ำ
    { kind: 'rect', terrain: 'rice', area: { x: 52, y: 48, w: 24, h: 9 } },
    { kind: 'rect', terrain: 'rice', area: { x: 20, y: 50, w: 14, h: 6 } },

    // ถนนสายหลัก ตะวันตก–ตะวันออก (ข้ามลำน้ำที่สะพาน)
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 0, y: 44 }, { x: 79, y: 44 }] },
    // ทางเข้าศูนย์เริ่มต้น
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 11, y: 47 }, { x: 11, y: 44 }] },
    // ทางแยกขึ้นเนินตะวันตก (ผ่านชุมชน) → A
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 28, y: 43 }, { x: 28, y: 30 }, { x: 24, y: 30 }, { x: 24, y: 25 }] },
    // ทางแยกขึ้นเนินตะวันออก (สี่แยกที่ x 56) → C (ปลายถนนด้านเหนือ)
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 56, y: 43 }, { x: 56, y: 20 }] },
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 57, y: 20 }, { x: 60, y: 20 }] },
    // ทางแยกย่อยไป B
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 58, y: 32 }, { x: 64, y: 32 }, { x: 64, y: 25 }] },
    // ถนนเลียบนาทางใต้ (ทางแยกจากถนนหลัก)
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 66, y: 46 }, { x: 66, y: 56 }] },

    // ศูนย์เริ่มต้น (ห้องเรียนสนามของครูเนม) มุมตะวันตกเฉียงใต้
    { kind: 'rect', terrain: 'paving', area: { x: 7, y: 49, w: 10, h: 4 } },
    { kind: 'building', area: { x: 6, y: 53, w: 10, h: 3 }, roof: 'roofRed', door: { x: 10, y: 53 } },
    { kind: 'object', object: 'flagpole', at: { x: 14, y: 50 } },
    { kind: 'fence', area: START_GROUNDS, gaps: [{ x: 11, y: 47 }, { x: 12, y: 47 }] },

    // ชุมชน
    { kind: 'building', area: { x: 14, y: 36, w: 4, h: 3 }, roof: 'roofBlue', door: { x: 15, y: 38 } },
    { kind: 'building', area: { x: 31, y: 37, w: 4, h: 3 }, roof: 'roofRed', door: { x: 32, y: 39 } },
    { kind: 'building', area: { x: 31, y: 32, w: 4, h: 3 }, roof: 'roofOrange', door: { x: 32, y: 34 } },
    { kind: 'rect', terrain: 'paving', area: { x: 22, y: 40, w: 5, h: 2 } },
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 24, y: 42 }, { x: 24, y: 43 }] },

    // จุดเป้าหมาย (อาคารบนเนิน) — A และ B เป็นอาคารแบบเดียวกัน, C เป็นวัด
    { kind: 'building', area: { x: 22, y: 21, w: 5, h: 3 }, roof: 'roofOrange', door: { x: 24, y: 23 } },
    { kind: 'building', area: { x: 62, y: 21, w: 5, h: 3 }, roof: 'roofOrange', door: { x: 64, y: 23 } },
    { kind: 'building', area: { x: 58, y: 16, w: 5, h: 2 }, roof: 'roofRed', door: { x: 60, y: 17 } },

    // ป่าบนเนินทั้งสอง และต้นไม้ทั่วพื้นที่
    { kind: 'scatter', object: 'tree', area: { x: 10, y: 4, w: 26, h: 26 }, density: 0.16, exclude: [...SITE_AREAS, { x: 22, y: 24, w: 8, h: 8 }] },
    { kind: 'scatter', object: 'tree', area: { x: 60, y: 4, w: 18, h: 26 }, density: 0.14, exclude: SITE_AREAS },
    {
      kind: 'scatter',
      object: 'tree',
      area: { x: 0, y: 0, w: 80, h: 60 },
      density: 0.035,
      exclude: [START_GROUNDS, VILLAGE, ...SITE_AREAS, ...RP_AREAS],
    },
    {
      kind: 'scatter',
      object: 'rock',
      area: { x: 0, y: 0, w: 80, h: 60 },
      density: 0.005,
      exclude: [START_GROUNDS, VILLAGE, ...SITE_AREAS, ...RP_AREAS],
    },
    { kind: 'border', object: 'tree', thickness: 1 },

    // หมุดอ้างอิงพิกัด (RP) 3 หมุด — ตรงเส้นกริด 100 ม.
    { kind: 'object', object: 'rock', at: { x: 20, y: 39 } },
    { kind: 'object', object: 'rock', at: { x: 50, y: 49 } },
    { kind: 'object', object: 'rock', at: { x: 70, y: 39 } },
  ],
};
