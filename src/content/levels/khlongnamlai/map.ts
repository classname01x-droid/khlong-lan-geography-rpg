import type { MapDefinition, TilePoint, TileRect } from '../../../core/world/types';

/**
 * แผนที่ ตำบลคลองน้ำไหล (ด่านที่ 2 "ปริศนาสารพิษแห่งต้นน้ำ") — 80 × 60 ช่อง = 800 × 600 เมตร
 * 1 ช่อง = 10 ม. · แผนที่ 1:10,000 (1 ซม. = 100 ม. = 10 ช่อง) · ทิศเหนืออยู่ด้านบนจอ
 *
 * หมายเหตุ: ผังนี้เป็นข้อมูลสมมติเพื่อการออกแบบเกม ยังไม่ใช่ตำแหน่งจริงของสถานที่ในตำบลคลองน้ำไหล
 *
 * ภูมิประเทศ (ดู ELEVATION): ที่ราบทางเหนือ (74–92 ม.) ลาดขึ้นไปทางใต้เป็นภูเขา 2 ลูกติดกัน
 *   - ภูเขาตะวันตก: ชันและเล็ก (เส้นชั้นความสูงชิดกัน)   - ไหล่เขาตะวันออก: กว้างและลาดน้อย (เส้นชั้นความสูงห่างกัน)
 *   ช่วงต่างระดับ 50 ม. → มีเส้นชั้นความสูงเพียง 3 เส้น: 100, 150 และ 200 ม. (ยอดสูงสุดราว 238 ม. ไม่ถึง 250)
 *   แผนที่นี้ไม่มีลำน้ำถูกขุดเป็นร่อง — น้ำไหลลงตามความลาดเอียงของพื้นที่ (ตรวจด้วย tests/khlongnamlai.test.ts)
 *
 * ลำน้ำ 2 สายไหลลงจากภูเขาไปทางเหนือ (ขึ้นด้านบนจอ) มาบรรจบกันที่ (40,14) แล้วไหลต่อเป็นลำน้ำสายหลักไปปลายน้ำ:
 *   ลำน้ำ A  (30,33) → (30,24) → (36,18) → (40,14)    ไหล่เขาตะวันตก · จุดตรวจ A (30,29) สูง ≈128 ม. (ระหว่างเส้น 100–150)
 *   ลำน้ำ B  (56,38) → (56,27) → (50,22) → (43,16) → (40,14)   ไหล่เขาตะวันออก · จุดตรวจ B (56,34) สูง ≈170 ม. (ระหว่างเส้น 150–200)
 *   ลำน้ำสายหลัก (40,14) → (40,0)               จุด C (40,6) สูง ≈76 ม. (ต่ำกว่าเส้น 100) — อยู่ด้านบนจอแต่เป็นปลายน้ำ
 *   ต้นน้ำ B (56,38) ไม่ใช่ยอดเขา (ยอดสูงสุดอยู่ที่ราว (42,39) ทางตะวันตกของลำน้ำ B)
 *
 * เส้นทางหลัก (ถนนดินกว้าง 2 ช่อง): บ้านผู้ใหญ่บ้าน (14,10) → ตะวันออก 4 ซม. (สะพานข้ามลำน้ำสายหลักที่ x=40) → บ้านตาคำ (54,10)
 *   → ตะวันออก 2 ซม. → สถานีป่าไม้ (74,10) → ใต้ 3 ซม. → กระท่อมเฝ้าป่า (74,40) → ตะวันตก 2 ซม. → จุดตรวจสอบต้นน้ำ B (54,40)
 */

/** จุดที่ต้องตรวจในเนื้อหาด่าน (ใช้ร่วมกับ index.ts และ test) */
export const A_POINTS: TilePoint[] = [
  { x: 30, y: 33 },
  { x: 30, y: 24 },
  { x: 36, y: 18 },
  { x: 40, y: 14 },
];
export const B_POINTS: TilePoint[] = [
  { x: 56, y: 38 },
  { x: 56, y: 27 },
  { x: 50, y: 22 },
  { x: 43, y: 16 },
  { x: 40, y: 14 },
];
export const MAIN_POINTS: TilePoint[] = [
  { x: 40, y: 14 },
  { x: 40, y: 0 },
];

const HEADMAN_YARD: TileRect = { x: 10, y: 4, w: 9, h: 6 };
const KHAM_YARD: TileRect = { x: 50, y: 4, w: 9, h: 6 };
const STATION_YARD: TileRect = { x: 70, y: 4, w: 9, h: 6 };
const SITE_CLEARING: TileRect = { x: 49, y: 34, w: 10, h: 9 };
const HUT_YARD: TileRect = { x: 72, y: 37, w: 7, h: 7 };

export const khlongNamLaiMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 3030,
  baseTerrain: 'grass',
  // ระดับความสูง (เมตร): ที่ราบเอียงลงทางเหนือ 0.3 ม./ช่อง + ภูเขาตะวันตก (ชัน) + ไหล่เขาตะวันออก (กว้าง ลาดน้อย)
  elevation: {
    baseMeters: 74,
    slope: { dx: 0, dy: 0.3 },
    hills: [
      { at: { x: 36, y: 40 }, radiusTiles: 17, meters: 100 },
      { at: { x: 54, y: 37 }, radiusTiles: 24, meters: 88 },
    ],
  },
  features: [
    // ลำน้ำ A, ลำน้ำ B และลำน้ำสายหลักหลังจุดบรรจบ
    { kind: 'path', terrain: 'water', width: 2, points: A_POINTS },
    { kind: 'path', terrain: 'water', width: 2, points: B_POINTS },
    { kind: 'path', terrain: 'water', width: 2, points: MAIN_POINTS },
    // หนองน้ำปลายน้ำ (ริมขอบเหนือของแผนที่)
    { kind: 'rect', terrain: 'water', area: { x: 37, y: 0, w: 7, h: 2 } },

    // ถนนดินสายหลัก: บ้านผู้ใหญ่บ้าน → บ้านตาคำ → สถานีป่าไม้ (ข้ามลำน้ำสายหลักเป็นสะพานอัตโนมัติ)
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 10, y: 10 }, { x: 76, y: 10 }] },
    // สถานีป่าไม้ → ลงใต้ → กระท่อมเฝ้าป่า → เลี้ยวตะวันตกไปทางต้นน้ำ B
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 74, y: 10 }, { x: 74, y: 40 }, { x: 54, y: 40 }] },

    // บ้านผู้ใหญ่บ้าน
    { kind: 'rect', terrain: 'paving', area: { x: 11, y: 8, w: 7, h: 2 } },
    { kind: 'building', area: { x: 12, y: 5, w: 5, h: 3 }, roof: 'roofBlue', door: { x: 14, y: 7 } },
    // บ้านตาคำ
    { kind: 'rect', terrain: 'paving', area: { x: 51, y: 8, w: 7, h: 2 } },
    { kind: 'building', area: { x: 52, y: 5, w: 5, h: 3 }, roof: 'roofRed', door: { x: 54, y: 7 } },
    // สถานีป่าไม้
    { kind: 'rect', terrain: 'paving', area: { x: 71, y: 8, w: 7, h: 2 } },
    { kind: 'building', area: { x: 72, y: 5, w: 5, h: 3 }, roof: 'roofOrange', door: { x: 74, y: 7 } },
    // กระท่อมเฝ้าป่า (จุดเลี้ยว)
    { kind: 'building', area: { x: 76, y: 40, w: 3, h: 3 }, roof: 'roofOrange', door: { x: 76, y: 41 } },

    // ป่าบนภูเขา และต้นไม้ทั่วพื้นที่ (ถนน/น้ำไม่ถูกทับ · ลานบ้านและพื้นที่ตรวจสอบเว้นไว้)
    {
      kind: 'scatter',
      object: 'tree',
      area: { x: 18, y: 23, w: 58, h: 36 },
      density: 0.22,
      exclude: [SITE_CLEARING, HUT_YARD],
    },
    {
      kind: 'scatter',
      object: 'tree',
      area: { x: 0, y: 0, w: 80, h: 60 },
      density: 0.04,
      exclude: [HEADMAN_YARD, KHAM_YARD, STATION_YARD, SITE_CLEARING, HUT_YARD],
    },
    { kind: 'scatter', object: 'rock', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.006, exclude: [HEADMAN_YARD, KHAM_YARD, STATION_YARD, SITE_CLEARING, HUT_YARD] },
    { kind: 'border', object: 'tree', thickness: 1 },
  ],
};
