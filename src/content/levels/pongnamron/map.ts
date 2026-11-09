import type { ElevationDefinition } from '../../../core/world/Elevation';
import type { MapDefinition, TileRect } from '../../../core/world/types';

/**
 * แผนที่ต้นแบบ ตำบลโป่งน้ำร้อน — 80 × 60 ช่อง = 800 × 600 เมตร (1 ช่อง = 10 ม., แผนที่ 1:10,000)
 * บทที่ 3 "ปริศนาเมืองโบราณใต้ผืนดิน": ใช้เส้นชั้นความสูงวิเคราะห์ว่าพื้นที่ใดอาจเหมาะกับการตั้งถิ่นฐาน
 * ใช้พิกัดกริดจำลอง (ดู grid ใน index.ts): E เพิ่มไปทางตะวันออก · N เพิ่มไปทางเหนือ — ไม่ใช่ละติจูด/ลองจิจูดจริง
 *
 * หมายเหตุ: ภูมิประเทศและเรื่องเมืองโบราณเป็นสถานการณ์จำลองเพื่อการเรียนรู้ ไม่ใช่ข้อมูลหรือประวัติศาสตร์จริงของตำบลโป่งน้ำร้อน
 *
 * ภูมิประเทศ (แบบจำลองความสูง): พื้นสูงขึ้นไปทางเหนือ + หุบลำห้วยโป่งน้ำร้อน (ผิวน้ำ ~127 ม. ทางเหนือ → ~85 ม. ทางใต้)
 * + เนินริมห้วยฝั่งตะวันออก + ที่ราบต่ำฝั่งตะวันตก + เนิน/เขาทางเหนือ
 * คะแนนบทที่ 3 ใช้เพียงระดับความสูง (สูงกว่าลำน้ำ) และระยะจากลำน้ำ คำนวณจากแบบจำลองนี้โดยตรง (core/site/SettlementAnalysis.ts)
 * ไม่มีตำแหน่งคำตอบเขียนไว้ในเนื้อหา — tests/settlement.test.ts ตรวจว่ามีพื้นที่ที่ผ่านจริง และพื้นที่ที่ไม่ผ่านด้วยเหตุผลแต่ละเกณฑ์
 */
export const SCHOOL_GROUNDS: TileRect = { x: 4, y: 47, w: 16, h: 11 };
const HALL_PLAZA: TileRect = { x: 26, y: 46, w: 8, h: 3 };

/** ลำห้วยโป่งน้ำร้อน (ไหลจากเหนือลงใต้) — ใช้ทั้งวาดน้ำและขุดหุบในแบบจำลองความสูง */
export const STREAM = [
  { x: 18, y: 0 },
  { x: 22, y: 8 },
  { x: 28, y: 16 },
  { x: 34, y: 24 },
  { x: 40, y: 32 },
  { x: 46, y: 40 },
  { x: 52, y: 48 },
  { x: 56, y: 59 },
];

/** แบบจำลองความสูง (เมตร จากระดับทะเลปานกลาง) */
export const ELEVATION: ElevationDefinition = {
  baseMeters: 135,
  // พื้นสูงขึ้นไปทางเหนือ (ลำห้วยจึงไหลจากเหนือลงใต้)
  slope: { dx: 0, dy: -0.7 },
  hills: [
    // เนินกว้างเตี้ยริมห้วยฝั่งตะวันออก (สูงกว่าลำน้ำพอประมาณ)
    { at: { x: 46, y: 31.2 }, radiusTiles: 16, meters: 8 },
    // ที่ราบต่ำทางตะวันตกเฉียงใต้ (ต่ำใกล้ระดับลำน้ำ — เสี่ยงน้ำท่วม)
    { at: { x: 14, y: 57 }, radiusTiles: 16, meters: 8 },
    // เนินป่าตะวันตกเฉียงเหนือ และเขาตะวันออกเฉียงเหนือ
    { at: { x: 10, y: 12 }, radiusTiles: 10, meters: 20 },
    { at: { x: 68, y: 10 }, radiusTiles: 14, meters: 45 },
  ],
  channels: [{ points: STREAM, widthTiles: 11, depthMeters: 8 }],
};

export const pongNamRonMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 4040,
  baseTerrain: 'grass',
  elevation: ELEVATION,
  features: [
    // ลำห้วยโป่งน้ำร้อน
    { kind: 'path', terrain: 'water', width: 2, points: STREAM },
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

    // ป่าบนเนินตะวันตกเฉียงเหนือ และต้นไม้ทั่วพื้นที่ / ป่าบนเขาตะวันออกเฉียงเหนือ
    { kind: 'scatter', object: 'tree', area: { x: 1, y: 1, w: 16, h: 30 }, density: 0.3 },
    { kind: 'scatter', object: 'tree', area: { x: 64, y: 1, w: 15, h: 12 }, density: 0.22 },
    {
      kind: 'scatter',
      object: 'tree',
      area: { x: 0, y: 0, w: 80, h: 60 },
      density: 0.04,
      exclude: [SCHOOL_GROUNDS, HALL_PLAZA],
    },
    { kind: 'scatter', object: 'rock', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.006, exclude: [SCHOOL_GROUNDS] },
    { kind: 'border', object: 'tree', thickness: 1 },

    // ค่ายสำรวจของนักสำรวจภาคสนาม (ข้างถนนขึ้นเขา)
    { kind: 'building', area: { x: 55, y: 27, w: 4, h: 3 }, roof: 'roofOrange', door: { x: 56, y: 29 } },
    { kind: 'rect', terrain: 'paving', area: { x: 55, y: 30, w: 5, h: 2 } },
  ],
};
