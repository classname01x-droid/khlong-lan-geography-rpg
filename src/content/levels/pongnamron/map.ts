import type { MapDefinition, TileRect } from '../../../core/world/types';

/**
 * แผนที่ต้นแบบ ตำบลโป่งน้ำร้อน — 80 × 60 ช่อง = 800 × 600 เมตร (1 ช่อง = 10 ม., แผนที่ 1:10,000)
 * ใช้ "พิกัดกริดจำลอง" (ดู GRID ใน index.ts): E เพิ่มไปทางตะวันออก · N เพิ่มไปทางเหนือ (ขึ้นด้านบนจอ)
 * จุดกำเนิดกริดอยู่มุมตะวันตกเฉียงใต้ (ล่างซ้ายของจอ) — ไม่ใช่ละติจูด/ลองจิจูดจริง
 *
 * หมายเหตุ: ผังเป็นข้อมูลสมมติเพื่อการออกแบบเกม ยังไม่ใช่ตำแหน่งจริงของสถานที่ในตำบลโป่งน้ำร้อน
 *
 * จุดเป้าหมาย 3 แห่ง (ดู mission.ts → gridSiteAnalysis):
 *   A สระน้ำหลังสวน (66,41)    อยู่ตรงพิกัดในบันทึก "ตามที่เขียน" — แต่บันทึกนับ N จากขอบบน
 *   B บ่อน้ำร้อนเชิงเขา (66,18)  ตรงพิกัดหลังแก้ + ทิศ/ระยะจาก RP-2 + ไอน้ำร้อนและหินปูนขาว
 *   C บ่อแช่เท้าชุมชน (73,28)   ทิศ/ระยะจาก RP-2 ใกล้เคียง และมีไอน้ำ แต่พิกัดไม่ตรงและไม่มีหินปูน
 */
export const SCHOOL_GROUNDS: TileRect = { x: 4, y: 47, w: 16, h: 11 };
const HALL_PLAZA: TileRect = { x: 26, y: 46, w: 8, h: 3 };
const SITE_AREAS: TileRect[] = [
  { x: 62, y: 14, w: 9, h: 8 },
  { x: 62, y: 37, w: 8, h: 7 },
  { x: 70, y: 25, w: 7, h: 6 },
];

export const pongNamRonMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 4040,
  baseTerrain: 'grass',
  // ภูมิประเทศสูงขึ้นไปทางเหนือ (0.4 ม./ช่อง) + เนินป่าตะวันตกเฉียงเหนือ + เขาตะวันออกเฉียงเหนือ
  elevation: {
    baseMeters: 130,
    slope: { dx: 0, dy: -0.4 },
    hills: [
      { at: { x: 8, y: 12 }, radiusTiles: 10, meters: 20 },
      { at: { x: 68, y: 10 }, radiusTiles: 14, meters: 45 },
    ],
  },
  features: [
    // ลำห้วยโป่งน้ำร้อน (ไหลจากเหนือลงใต้)
    {
      kind: 'path',
      terrain: 'water',
      width: 2,
      points: [
        { x: 18, y: 0 },
        { x: 22, y: 8 },
        { x: 28, y: 16 },
        { x: 34, y: 24 },
        { x: 40, y: 32 },
        { x: 46, y: 40 },
        { x: 52, y: 48 },
        { x: 56, y: 59 },
      ],
    },
    // นาทางใต้
    { kind: 'rect', terrain: 'rice', area: { x: 58, y: 48, w: 18, h: 9 } },
    { kind: 'rect', terrain: 'rice', area: { x: 24, y: 52, w: 20, h: 5 } },

    // ถนนหลัก (ข้ามลำห้วยเป็นสะพาน) · ถนนจากโรงเรียน · ถนนขึ้นเขา · ทางแยกไปบ่อแช่เท้า
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 0, y: 44 }, { x: 79, y: 44 }] },
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 11, y: 47 }, { x: 11, y: 44 }] },
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 60, y: 43 }, { x: 60, y: 22 }] },
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 62, y: 32 }, { x: 72, y: 32 }] },

    // โรงเรียนบ้านโป่งน้ำร้อน (จุดเริ่มต้น) — มุมตะวันตกเฉียงใต้ของแผนที่
    { kind: 'rect', terrain: 'paving', area: { x: 7, y: 49, w: 10, h: 4 } },
    { kind: 'building', area: { x: 6, y: 53, w: 10, h: 3 }, roof: 'roofRed', door: { x: 10, y: 53 } },
    { kind: 'object', object: 'flagpole', at: { x: 14, y: 50 } },
    { kind: 'fence', area: SCHOOL_GROUNDS, gaps: [{ x: 11, y: 47 }, { x: 12, y: 47 }] },

    // ชุมชน: บ้านริมถนน และศาลาประชาคม (ที่เก็บบันทึกสำรวจ)
    { kind: 'building', area: { x: 24, y: 38, w: 4, h: 3 }, roof: 'roofRed', door: { x: 25, y: 40 } },
    { kind: 'building', area: { x: 30, y: 38, w: 4, h: 3 }, roof: 'roofBlue', door: { x: 31, y: 40 } },
    { kind: 'building', area: { x: 36, y: 36, w: 4, h: 3 }, roof: 'roofRed', door: { x: 37, y: 38 } },
    { kind: 'rect', terrain: 'paving', area: HALL_PLAZA },
    { kind: 'building', area: { x: 27, y: 49, w: 6, h: 3 }, roof: 'roofOrange', door: { x: 29, y: 49 } },

    // จุดเป้าหมาย: A สระน้ำหลังสวน · B บ่อน้ำร้อนเชิงเขา (มีหินปูนขาว) · C บ่อแช่เท้าคอนกรีตของชุมชน
    { kind: 'rect', terrain: 'water', area: { x: 64, y: 39, w: 3, h: 2 } },
    { kind: 'rect', terrain: 'water', area: { x: 65, y: 16, w: 3, h: 2 } },
    { kind: 'rect', terrain: 'paving', area: { x: 71, y: 26, w: 5, h: 4 } },
    { kind: 'rect', terrain: 'water', area: { x: 72, y: 26, w: 3, h: 2 } },

    // ป่าบนเนินตะวันตกเฉียงเหนือ และต้นไม้ทั่วพื้นที่ / ป่าบนเขาตะวันออกเฉียงเหนือ
    { kind: 'scatter', object: 'tree', area: { x: 1, y: 1, w: 16, h: 30 }, density: 0.3 },
    { kind: 'scatter', object: 'tree', area: { x: 64, y: 1, w: 15, h: 12 }, density: 0.22 },
    {
      kind: 'scatter',
      object: 'tree',
      area: { x: 0, y: 0, w: 80, h: 60 },
      density: 0.04,
      exclude: [SCHOOL_GROUNDS, HALL_PLAZA, ...SITE_AREAS],
    },
    { kind: 'scatter', object: 'rock', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.006, exclude: [SCHOOL_GROUNDS, ...SITE_AREAS] },
    { kind: 'border', object: 'tree', thickness: 1 },

    // หมุดอ้างอิง (RP) 3 หมุด — วางหลังโปรยต้นไม้ ตำแหน่งตรงเส้นกริด 100 ม.
    { kind: 'object', object: 'rock', at: { x: 20, y: 39 } },
    { kind: 'object', object: 'rock', at: { x: 40, y: 49 } },
    { kind: 'object', object: 'rock', at: { x: 70, y: 39 } },
    // หินปูนสีขาวรอบบ่อน้ำร้อน (B) และหินริมสระ (A)
    { kind: 'object', object: 'rock', at: { x: 64, y: 17 } },
    { kind: 'object', object: 'rock', at: { x: 68, y: 16 } },
    { kind: 'object', object: 'rock', at: { x: 67, y: 39 } },
  ],
};
