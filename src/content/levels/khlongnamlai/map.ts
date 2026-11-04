import type { MapDefinition, TilePoint, TileRect } from '../../../core/world/types';

/**
 * แผนที่ต้นแบบ ตำบลคลองน้ำไหล — 80 × 60 ช่อง = 800 × 600 เมตร (1 ช่อง = 10 ม., แผนที่ 1:10,000)
 * ทิศเหนืออยู่ด้านบนจอ — แต่ "ด้านบนจอ" ไม่ได้แปลว่า "สูงกว่า"
 *
 * หมายเหตุ: ผังนี้เป็นข้อมูลสมมติเพื่อการออกแบบเกม ยังไม่ใช่ตำแหน่งจริงของสถานที่ในตำบลคลองน้ำไหล
 *
 * ภูมิประเทศ (ดู ELEVATION): พื้นที่ทางใต้เป็นเนินป่าสูง ลาดลงไปทางเหนือ
 *   → ลำห้วยไหลจาก "ตาน้ำ" ทางใต้ ขึ้นไปทางเหนือ (ขึ้นด้านบนจอ) ไปลงหนองท้ายน้ำ
 *   ผู้เล่นที่เดาว่าน้ำไหล "จากบนลงล่างของจอ" จะเข้าใจผิดว่าหนองทางเหนือคือต้นน้ำ
 *
 * แหล่งน้ำที่ดูคล้ายเป้าหมาย (สถานที่ผู้ต้องสงสัย):
 *   ตาน้ำ (22,52)       ต้นน้ำจริง — มีบนแผนที่เก่าด้วยสัญลักษณ์ตาน้ำ ใกล้หินสามก้อน
 *   ฝาย (y=22)          อยู่กลางลำห้วย — มีบนแผนที่เก่าแต่เป็นสัญลักษณ์ฝาย
 *   หนองท้ายน้ำ (ทางเหนือ)  ปลายน้ำ (ต่ำสุด) — มีบนแผนที่เก่าแต่เป็นสัญลักษณ์หนองน้ำ
 *   บ่อในไร่ (ตะวันออก)     ไม่ได้อยู่บนลำห้วย และเพิ่งขุด จึงไม่มีบนแผนที่เก่า
 */

/** แนวลำห้วย — ลำดับจุดไม่ได้กำหนดทิศน้ำไหล (ระบบคำนวณจากระดับความสูง) */
export const STREAM_POINTS: TilePoint[] = [
  { x: 22, y: 52 },
  { x: 24, y: 46 },
  { x: 28, y: 40 },
  { x: 31, y: 33 },
  { x: 30, y: 26 },
  { x: 33, y: 18 },
  { x: 31, y: 10 },
  { x: 33, y: 0 },
];

export const SCHOOL_GROUNDS: TileRect = { x: 4, y: 4, w: 15, h: 12 };
const SPRING_AREA: TileRect = { x: 17, y: 48, w: 13, h: 10 };
const OFFICE_PLAZA: TileRect = { x: 42, y: 36, w: 8, h: 3 };

export const khlongNamLaiMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 3030,
  baseTerrain: 'grass',
  // ระดับความสูง (เมตร จากระดับทะเลปานกลาง): สูงขึ้นไปทางใต้ 0.6 ม./ช่อง + เนินป่าตะวันตกเฉียงใต้ + เนินตะวันออก
  elevation: {
    baseMeters: 95,
    slope: { dx: -0.05, dy: 0.6 },
    hills: [
      { at: { x: 12, y: 52 }, radiusTiles: 14, meters: 12 },
      { at: { x: 70, y: 48 }, radiusTiles: 12, meters: 15 },
    ],
  },
  features: [
    // ลำห้วยคลองน้ำไหล และตาน้ำต้นลำห้วย
    { kind: 'path', terrain: 'water', width: 2, points: STREAM_POINTS },
    { kind: 'rect', terrain: 'water', area: { x: 21, y: 52, w: 3, h: 2 } },
    // หนองท้ายน้ำ (ทางเหนือ)
    { kind: 'rect', terrain: 'water', area: { x: 28, y: 1, w: 10, h: 3 } },

    // พื้นที่เกษตร: ไร่ทางตะวันออกเฉียงใต้ และนาทางตะวันตก
    { kind: 'rect', terrain: 'rice', area: { x: 54, y: 40, w: 20, h: 12 } },
    { kind: 'rect', terrain: 'rice', area: { x: 2, y: 22, w: 6, h: 10 } },
    // บ่อน้ำในไร่ (เพิ่งขุด)
    { kind: 'rect', terrain: 'water', area: { x: 61, y: 44, w: 4, h: 3 } },

    // ถนน: ถนนหลักตะวันตก–ตะวันออก (ข้ามลำห้วยเป็นสะพาน) และถนนจากโรงเรียน
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 0, y: 34 }, { x: 79, y: 34 }] },
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 10, y: 15 }, { x: 10, y: 34 }] },
    // ทางแยกเข้าไร่
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 57, y: 36 }, { x: 57, y: 48 }] },
    // ทางแยกขึ้นเหนือไปวัด
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 62, y: 33 }, { x: 62, y: 31 }] },
    // สันฝายข้ามลำห้วย (ถนนทับน้ำ → กลายเป็นทางข้ามอัตโนมัติ)
    { kind: 'path', terrain: 'road', width: 1, points: [{ x: 28, y: 22 }, { x: 36, y: 22 }] },

    // โรงเรียนบ้านคลองน้ำไหล (จุดเริ่มต้น)
    { kind: 'rect', terrain: 'paving', area: { x: 7, y: 10, w: 9, h: 4 } },
    { kind: 'building', area: { x: 6, y: 6, w: 10, h: 3 }, roof: 'roofRed', door: { x: 10, y: 8 } },
    { kind: 'object', object: 'flagpole', at: { x: 13, y: 11 } },
    { kind: 'fence', area: SCHOOL_GROUNDS, gaps: [{ x: 10, y: 15 }, { x: 11, y: 15 }] },

    // ชุมชน: บ้านเรือนริมถนน
    { kind: 'building', area: { x: 38, y: 29, w: 4, h: 3 }, roof: 'roofRed', door: { x: 39, y: 31 } },
    { kind: 'building', area: { x: 44, y: 29, w: 4, h: 3 }, roof: 'roofBlue', door: { x: 45, y: 31 } },
    { kind: 'building', area: { x: 50, y: 29, w: 4, h: 3 }, roof: 'roofRed', door: { x: 51, y: 31 } },
    // ศาลาจัดการน้ำชุมชน
    { kind: 'rect', terrain: 'paving', area: OFFICE_PLAZA },
    { kind: 'building', area: { x: 43, y: 39, w: 6, h: 3 }, roof: 'roofOrange', door: { x: 45, y: 39 } },
    // วัด
    { kind: 'rect', terrain: 'paving', area: { x: 59, y: 31, w: 7, h: 2 } },
    { kind: 'building', area: { x: 60, y: 27, w: 5, h: 4 }, roof: 'roofOrange', door: { x: 62, y: 30 } },

    // หมุดหลักฐานระดับ (BM) 2 หมุด
    { kind: 'object', object: 'rock', at: { x: 36, y: 12 } },
    { kind: 'object', object: 'rock', at: { x: 27, y: 46 } },

    // ป่าบนเนินตะวันตกเฉียงใต้ และต้นไม้ทั่วพื้นที่
    { kind: 'scatter', object: 'tree', area: { x: 1, y: 38, w: 22, h: 21 }, density: 0.28, exclude: [SPRING_AREA] },
    {
      kind: 'scatter',
      object: 'tree',
      area: { x: 0, y: 0, w: 80, h: 60 },
      density: 0.04,
      exclude: [SCHOOL_GROUNDS, SPRING_AREA, OFFICE_PLAZA],
    },
    { kind: 'scatter', object: 'rock', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.006, exclude: [SCHOOL_GROUNDS, SPRING_AREA] },
    { kind: 'border', object: 'tree', thickness: 1 },

    // หินสามก้อน ใกล้ตาน้ำ (วางหลังโปรยต้นไม้ เพื่อให้ตำแหน่งแน่นอน)
    { kind: 'object', object: 'rock', at: { x: 25, y: 53 } },
    { kind: 'object', object: 'rock', at: { x: 26, y: 53 } },
    { kind: 'object', object: 'rock', at: { x: 25, y: 54 } },
  ],
};
