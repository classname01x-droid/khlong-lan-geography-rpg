import { OBJECT_TILE, TERRAIN_TILE } from '../graphics/tileIndex';

/**
 * ตำแหน่งบนแผนที่การเดินทางเป็น "ภาพประกอบ" เท่านั้น (ไม่ใช่มาตราส่วนหรือตำแหน่งจริง)
 * ห้ามใช้คำนวณระยะทาง — แผนที่เพื่อการเรียนรู้อยู่ในแต่ละด่าน (ScaleSystem 1:10,000)
 * เรียงตามลำดับบท: บนซ้าย → บนขวา → ล่างขวา → ล่างซ้าย
 */
export const JOURNEY_LAYOUT = [
  { region: { x: 100, y: 190 }, card: { x: 196, y: 84 }, icon: OBJECT_TILE.roofRed },
  { region: { x: 860, y: 190 }, card: { x: 494, y: 84 }, icon: TERRAIN_TILE.water },
  { region: { x: 860, y: 430 }, card: { x: 494, y: 324 }, icon: OBJECT_TILE.rock },
  { region: { x: 100, y: 430 }, card: { x: 196, y: 324 }, icon: OBJECT_TILE.flagpole },
] as const;

/** จุดหมายของบทสุดท้าย (กลางแผนที่) */
export const FINALE_POINT = { x: 480, y: 320 } as const;
