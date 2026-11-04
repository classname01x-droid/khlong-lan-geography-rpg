import type { MapDefinition } from '../../../core/world/types';

/**
 * แผนที่ต้นแบบ ตำบลสักงาม — 80 × 60 ช่อง = 800 × 600 เมตร (1 ช่อง = 10 ม.)
 * ทิศเหนืออยู่ด้านบน แกน x → ตะวันออก, แกน y → ใต้
 *
 * หมายเหตุ: ผังนี้เป็น placeholder เชิงการออกแบบเกม ยังไม่ใช่ตำแหน่งจริงของสถานที่
 * ต้องปรับให้ตรงกับข้อมูลภาคสนาม/แผนที่จริงของชุมชนในภายหลัง
 *
 * เส้นทางจากศาลาชุมชนขึ้นไปทางเหนือมี 3 ทางให้เลือก:
 *   1) ถนน x=40 ขึ้นเหนือ → ตันที่สระน้ำ (ตัวหลอก: ทิศเหนือตรง ๆ แต่ไม่ใช่ทิศที่ถูก)
 *   2) ถนน x=60 แล้วเลี้ยวตะวันออกที่ต้นสักใหญ่ → ตันที่ทุ่งหิน (ตัวหลอก: ไปทางตะวันออกมากเกินไป)
 *   3) ถนน x=60 ตรงขึ้นเหนือต่อ แล้วเยื้องไปตะวันออก → แหล่งผ้าปักบ้านไหนเจียว (ทางที่ถูก)
 */
const SCHOOL_GROUNDS = { x: 6, y: 30, w: 18, h: 17 };

export const sakNgamMap: MapDefinition = {
  widthTiles: 80,
  heightTiles: 60,
  seed: 2026,
  baseTerrain: 'grass',
  features: [
    // ลำห้วย ไหลจากเหนือลงใต้
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
    // สระน้ำ (ปลายทางตันของเส้นทางหลอกที่ 1)
    { kind: 'rect', terrain: 'water', area: { x: 37, y: 13, w: 7, h: 6 } },

    // นาข้าวทางตอนใต้
    { kind: 'rect', terrain: 'rice', area: { x: 4, y: 52, w: 22, h: 5 } },
    { kind: 'rect', terrain: 'rice', area: { x: 36, y: 52, w: 14, h: 6 } },
    { kind: 'rect', terrain: 'rice', area: { x: 54, y: 52, w: 20, h: 6 } },

    // ถนนสายหลัก ตะวันตก–ตะวันออก (ข้ามลำห้วยเป็นสะพาน)
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 0, y: 48 }, { x: 79, y: 48 }] },
    // ถนนจากประตูโรงเรียนลงถนนหลัก
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 14, y: 45 }, { x: 14, y: 48 }] },
    // เส้นทางหลอก 1: ขึ้นเหนือตรง ๆ แล้วตันที่สระน้ำ
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 40, y: 47 }, { x: 40, y: 19 }] },
    // เส้นทางหลัก: ขึ้นเหนือ แล้วเยื้องตะวันออกไปบ้านไหนเจียว
    {
      kind: 'path',
      terrain: 'road',
      width: 2,
      points: [
        { x: 60, y: 47 },
        { x: 60, y: 22 },
        { x: 64, y: 22 },
        { x: 64, y: 17 },
      ],
    },
    // เส้นทางหลอก 2: แยกตะวันออกที่ต้นสักใหญ่ ไปตันที่ทุ่งหิน
    { kind: 'path', terrain: 'road', width: 2, points: [{ x: 61, y: 30 }, { x: 74, y: 30 }] },

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

    // แหล่งผ้าปักบ้านไหนเจียว
    { kind: 'rect', terrain: 'paving', area: { x: 59, y: 14, w: 13, h: 4 } },
    { kind: 'building', area: { x: 60, y: 10, w: 5, h: 4 }, roof: 'roofRed', door: { x: 62, y: 13 } },
    { kind: 'building', area: { x: 67, y: 11, w: 4, h: 3 }, roof: 'roofBlue', door: { x: 68, y: 13 } },

    // ต้นสักใหญ่ (จุดสังเกตที่ทางแยก)
    { kind: 'object', object: 'tree', at: { x: 58, y: 30 } },
    // ทุ่งหิน (ปลายทางตันของเส้นทางหลอกที่ 2)
    { kind: 'scatter', object: 'rock', area: { x: 70, y: 26, w: 9, h: 9 }, density: 0.35 },

    // ป่าทางตะวันตกเฉียงเหนือ และต้นไม้ทั่วพื้นที่
    { kind: 'scatter', object: 'tree', area: { x: 1, y: 1, w: 28, h: 26 }, density: 0.32 },
    { kind: 'scatter', object: 'tree', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.05, exclude: [SCHOOL_GROUNDS] },
    { kind: 'scatter', object: 'rock', area: { x: 0, y: 0, w: 80, h: 60 }, density: 0.008, exclude: [SCHOOL_GROUNDS] },
    { kind: 'border', object: 'tree', thickness: 1 },
  ],
};
