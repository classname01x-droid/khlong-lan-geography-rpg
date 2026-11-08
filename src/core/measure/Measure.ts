import type { ScaleSystem } from '../scale/ScaleSystem';
import type { TilePoint } from '../world/types';

/**
 * เครื่องมือวัดระยะแบบมี "จุดเริ่มวัด" ชัดเจน (v0.19) — ตรรกะล้วน ทดสอบได้
 *
 * แยกระยะ 4 ชนิดไม่ให้ปนกัน:
 *   1) ระยะเดินสะสมทั้งเกม       → DistanceTracker.totalMeters (แสดงในสมุด หน้าสถิติ เท่านั้น)
 *   2) ระยะเส้นตรงระหว่างสองสถานที่ → ScaleSystem/Compass (เบาะแส {{dist:a>b}})
 *   3) ระยะตามเส้นทาง/ถนน           → RouteAnalysis (หน้าวิเคราะห์เส้นทาง)
 *   4) ระยะวัดจากจุดอ้างอิง         → ที่นี่: เส้นตรงจากจุดเริ่มวัดถึงตำแหน่งจริงของผู้เล่นตอนนี้
 * พร้อม "เดินจริงตั้งแต่เริ่มวัด" (odometer ช่วงนี้) ไว้เทียบว่าทางเดินยาวกว่าเส้นตรง
 *
 * ทุกการแปลงหน่วยผ่าน ScaleSystem (1 ช่อง = 10 ม. · 1:10,000 → 1 ซม. = 100 ม.)
 */
export interface MeasureState {
  /** id สถานที่ที่เป็นจุดอ้างอิงของภารกิจ (null = จุดที่ผู้เล่นกดเริ่มวัดเอง) */
  originId: string | null;
  /** ช่องของจุดเริ่มวัด */
  origin: TilePoint;
  /** ชื่อจุดเริ่มวัด เช่น "ศาลาชุมชน" หรือ "จุดที่เริ่มวัด" */
  label: string;
  /** ระยะเดินสะสม (ม.) ตอนเริ่มวัด — ใช้คำนวณ "เดินจริงตั้งแต่เริ่มวัด" */
  walkedAtStart: number;
  /** ให้กด "เริ่มวัดใหม่จากตรงนี้" ได้หรือไม่ (ภารกิจกำหนด) */
  allowReset: boolean;
}

export interface MeasureReading {
  label: string;
  originId: string | null;
  origin: TilePoint;
  /** ระยะเส้นตรงจากจุดเริ่มวัดถึงผู้เล่น (ม. ไม่ปัด) */
  straightMeters: number;
  /** ปัดเป็นหลักสิบเมตร (ความละเอียด 1 ช่อง) — ตัวเลขที่แสดง */
  roundedMeters: number;
  /** = กี่ช่อง (ปัดเป็นจำนวนเต็ม) */
  tiles: number;
  /** = กี่ซม. บนแผนที่ (ทศนิยม 1 ตำแหน่ง) */
  mapCm: number;
  /** เดินจริงตั้งแต่เริ่มวัด (ม. ปัดหลักสิบ) */
  walkedMeters: number;
  allowReset: boolean;
}

/** จุดกึ่งกลางของช่อง (พิกเซลโลกเกม) */
export function tileCenterPx(t: TilePoint, scale: ScaleSystem): { x: number; y: number } {
  return { x: scale.tileCenterPx(t.x), y: scale.tileCenterPx(t.y) };
}

/** อ่านค่าวัด ณ ตำแหน่งผู้เล่น (พิกเซลโลกเกม — ตำแหน่งจริง ไม่ใช่ช่องที่ปัดแล้ว) */
export function readMeasure(
  m: MeasureState,
  playerPx: { x: number; y: number },
  totalWalkedMeters: number,
  scale: ScaleSystem,
): MeasureReading {
  const o = tileCenterPx(m.origin, scale);
  const straight = scale.pxToMeters(Math.hypot(playerPx.x - o.x, playerPx.y - o.y));
  const tilesExact = scale.metersToTiles(straight);
  const rounded = Math.round(tilesExact) * scale.config.metersPerTile;
  return {
    label: m.label,
    originId: m.originId,
    origin: { ...m.origin },
    straightMeters: straight,
    roundedMeters: rounded,
    tiles: Math.round(tilesExact),
    mapCm: Math.round(scale.metersToMapCm(rounded) * 10) / 10,
    walkedMeters: Math.max(0, Math.round((totalWalkedMeters - m.walkedAtStart) / 10) * 10),
    allowReset: m.allowReset,
  };
}

/** ข้อความหลักของแถบวัดระยะ เช่น "ระยะจากศาลาชุมชน: 120 เมตร" */
export function measureHeadline(r: MeasureReading): string {
  return `ระยะจาก${r.label}: ${r.roundedMeters.toLocaleString('en-US')} เมตร`;
}

/** บรรทัดรอง: ช่อง · ซม.บนแผนที่ · เดินจริง */
export function measureDetail(r: MeasureReading, ratioLabel = '1:10,000'): string {
  return `เส้นตรง ${r.tiles} ช่อง = ${r.mapCm.toFixed(1)} ซม. บนแผนที่ ${ratioLabel} · เดินจริงตั้งแต่เริ่มวัด ${r.walkedMeters.toLocaleString('en-US')} ม.`;
}
