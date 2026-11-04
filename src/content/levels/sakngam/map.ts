import type { MapDefinition, TileRect } from '../../../core/world/types';

/**
 * แผนที่ต้นแบบ ตำบลสักงาม — 80 × 60 ช่อง = 800 × 600 เมตร (1 ช่อง = 10 ม.)
 * ทิศเหนืออยู่ด้านบน แกน x → ตะวันออก, แกน y → ใต้
 *
 * หมายเหตุ: ผังนี้เป็น placeholder เชิงการออกแบบเกม ยังไม่ใช่ตำแหน่งจริงของสถานที่
 * ต้องปรับให้ตรงกับข้อมูลภาคสนาม/แผนที่จริงของชุมชนในภายหลัง
 *
 * ภูมิศาสตร์ที่เบาะแสอ้างถึง (ตรวจด้วย unit test ใน tests/route.test.ts):
 *   - ลำห้วยใหญ่ไหลเหนือ→ใต้ (x≈31–35) ข้ามได้ที่สะพานบนถนนหลัก
 *   - ห้วยสาขาแยกจากลำห้วยใหญ่ไปทางตะวันออกจนสุดขอบแผนที่ (y≈16–18)
 *     กั้นพื้นที่ทางเหนือไว้ ข้ามได้ที่ "สะพานไม้" แห่งเดียว (x=60–61)
 *   - ศาลาชุมชน (46,45) → บ้านไหนเจียว (70,13): Δ = (24, −32) ช่อง = 40 ช่อง = 400 ม.
 *     = 4 ซม. บนแผนที่ 1:10,000, ทิศตะวันออกเฉียงเหนือ
 *
 * เส้นทางจากศาลาชุมชน (ทุกเส้นใช้ถนนหลักช่วงแรกร่วมกัน):
 *   ก) ถนน x=40 ขึ้นเหนือ → เตาปั้นดินเผา  (ทิศเหนือ, ใกล้เกินไป, ไม่ข้ามห้วย)
 *   ข) ถนน x=60 ผ่านต้นสักใหญ่ ตรงขึ้นเหนือ ข้ามสะพานไม้ → บ้านไหนเจียว  (ถูกต้อง)
 *   ค) ถนน x=60 เลี้ยวตะวันออกที่ต้นสักใหญ่ → ลานจักสาน  (ทิศและระยะเส้นตรงใกล้เคียง
 *      ระยะตามถนนก็ใกล้เคียง แต่ไม่ข้ามห้วย จึงไม่ผ่านสะพานไม้)
 */
export const SCHOOL_GROUNDS: TileRect = { x: 6, y: 30, w: 18, h: 17 };
const NAI_CHIAO_YARD: TileRect = { x: 65, y: 11, w: 12, h: 5 };

export const sakNgamMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 2026,
  baseTerrain: 'grass',
  features: [
    // ลำห้วยใหญ่ ไหลจากเหนือลงใต้
    {
      kind: 'path',
      terrain: 'water',
      width: 2,
      points: [
        { x: 31, y: 0 },
        { x: 31, y: 12 },
        { x: 34, y: 20 },
        { x: 34, y: 34 },
        { x: 32, y: 42 },
        { x: 32, y: 59 },
      ],
    },
    // ห้วยสาขา แยกไปทางตะวันออกจนสุดขอบแผนที่
    {
      kind: 'path',
      terrain: 'water',
      width: 2,
      points: [
        { x: 33, y: 16 },
        { x: 46, y: 16 },
        { x: 50, y: 17 },
        { x: 79, y: 17 },
      ],
    },

    // นาข้าวทางตอนใต้
    { kind: 'rect', terrain: 'rice', area: { x: 4, y: 52, w: 22, h: 5 } },
    { kind: 'rect', terrain: 'rice', area: { x: 36, y: 52, w: 14, h: 6 } },
    { kind: 'rect', terrain: 'rice', area: { x: 54, y: 52, w: 20, h: 6 } },

    // ถนนสายหลัก ตะวันตก–ตะวันออก (ข้ามลำห้วยใหญ่เป็นสะพาน)
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 0, y: 48 }, { x: 79, y: 48 }] },
    // ถนนจากประตูโรงเรียนลงถนนหลัก
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 14, y: 45 }, { x: 14, y: 48 }] },
    // เส้นทาง ก: ขึ้นเหนือ ไปเตาปั้นดินเผา (สิ้นสุดก่อนถึงห้วยสาขา)
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 40, y: 47 }, { x: 40, y: 22 }] },
    // เส้นทาง ข: ขึ้นเหนือผ่านต้นสักใหญ่ ข้ามห้วยสาขา (กลายเป็นสะพานไม้อัตโนมัติ) ไปบ้านไหนเจียว
    {
      kind: 'path',
      terrain: 'road',
      width: 2,
      points: [
        { x: 60, y: 47 },
        { x: 60, y: 14 },
        { x: 69, y: 14 },
      ],
    },
    // เส้นทาง ค: เลี้ยวตะวันออกที่ต้นสักใหญ่ แล้วขึ้นเหนือไปลานจักสาน (สิ้นสุดก่อนถึงห้วยสาขา)
    {
      kind: 'path',
      terrain: 'road',
      width: 2,
      points: [
        { x: 62, y: 30 },
        { x: 77, y: 30 },
        { x: 77, y: 21 },
      ],
    },

    // โรงเรียนสักงาม
    { kind: 'rect', terrain: 'paving', area: { x: 10, y: 37, w: 10, h: 7 } },
    { kind: 'building', area: { x: 9, y: 32, w: 12, h: 4 }, roof: 'roofRed', door: { x: 14, y: 35 } },
    { kind: 'object', object: 'flagpole', at: { x: 15, y: 40 } },
    { kind: 'fence', area: SCHOOL_GROUNDS, gaps: [{ x: 14, y: 46 }, { x: 15, y: 46 }] },

    // ศาลาชุมชน และลานหน้าศาลา
    { kind: 'rect', terrain: 'paving', area: { x: 43, y: 45, w: 8, h: 3 } },
    { kind: 'building', area: { x: 44, y: 41, w: 6, h: 4 }, roof: 'roofOrange', door: { x: 46, y: 44 } },
    // บ้านผู้ใหญ่บ้าน
    { kind: 'building', area: { x: 53, y: 40, w: 4, h: 3 }, roof: 'roofBlue', door: { x: 54, y: 42 } },
    { kind: 'path', terrain: 'paving', width: 1, points: [{ x: 54, y: 43 }, { x: 54, y: 47 }] },

    // เตาปั้นดินเผา (ปลายเส้นทาง ก)
    { kind: 'building', area: { x: 36, y: 21, w: 3, h: 2 }, roof: 'roofOrange', door: { x: 38, y: 22 } },
    // ลานจักสาน (ปลายเส้นทาง ค)
    { kind: 'building', area: { x: 72, y: 21, w: 4, h: 2 }, roof: 'roofBlue', door: { x: 75, y: 22 } },

    // แหล่งผ้าปักบ้านไหนเจียว (ปลายเส้นทาง ข)
    { kind: 'rect', terrain: 'paving', area: NAI_CHIAO_YARD },
    { kind: 'building', area: { x: 66, y: 7, w: 5, h: 4 }, roof: 'roofRed', door: { x: 68, y: 10 } },
    { kind: 'building', area: { x: 72, y: 8, w: 4, h: 3 }, roof: 'roofBlue', door: { x: 73, y: 10 } },

    // ต้นสักใหญ่ (จุดสังเกตที่ทางแยก)
    { kind: 'object', object: 'tree', at: { x: 59, y: 30 } },

    // ป่าทางตะวันตกเฉียงเหนือ และต้นไม้ทั่วพื้นที่
    { kind: 'scatter', object: 'tree', area: { x: 1, y: 1, w: 28, h: 26 }, density: 0.32 },
    {
      kind: 'scatter',
      object: 'tree',
      area: { x: 0, y: 0, w: 80, h: 60 },
      density: 0.05,
      exclude: [SCHOOL_GROUNDS, NAI_CHIAO_YARD],
    },
    { kind: 'scatter', object: 'rock', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.008, exclude: [SCHOOL_GROUNDS] },
    { kind: 'border', object: 'tree', thickness: 1 },
  ],
};
