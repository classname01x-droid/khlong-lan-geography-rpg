/**
 * ค่าคงที่ระดับระบบเกม (ไม่ขึ้นกับเนื้อหาด่าน)
 *
 * กฎมาตราส่วนของโลกเกม (ต้องสอดคล้องกันทุกส่วน):
 *   1 ช่องแผนที่ (tile)  = 10 เมตรในโลกจริง
 *   แผนที่กระดาษ 1:10,000 → 1 ซม. บนแผนที่ = 100 เมตร = 10 ช่อง
 *   ดังนั้น 1 ช่อง = 1 มม. บนแผนที่กระดาษ
 */
export const TILE_SIZE_PX = 16;
export const METERS_PER_TILE = 10;
export const MAP_SCALE_DENOMINATOR = 10_000;

/** ขนาดหน้าจอเกม (พิกเซลจริงบนจอ) */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

/** กล้องขยาย 3 เท่า → มองเห็นประมาณ 20 × 13 ช่อง (200 × 133 เมตร) */
export const CAMERA_ZOOM = 3;

/** ความเร็วเดิน (ช่องต่อวินาที) — ระยะทางที่แสดงคำนวณจากการเคลื่อนที่จริง ไม่ใช่จากค่านี้ */
export const PLAYER_SPEED_TILES_PER_SEC = 5;

/** ระยะที่ผู้เล่นคุยกับ NPC ได้ (ช่อง) */
export const INTERACT_RADIUS_TILES = 2;
