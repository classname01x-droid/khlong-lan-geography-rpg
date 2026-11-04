import { bearingDeg, bearingToDirection8, THAI_DIRECTION } from '../direction/Compass';
import type { ScaleSystem } from '../scale/ScaleSystem';
import type { TilePoint } from '../world/types';

/**
 * แทนค่าตัวแปรภูมิศาสตร์ในบทพูด/เบาะแส โดยคำนวณจากตำแหน่งจริงในโลกเกม
 * เพื่อไม่ให้ตัวเลขในข้อความขัดกับแผนที่ (แก้แผนที่แล้วข้อความเปลี่ยนตามอัตโนมัติ)
 *
 *   {{dist:a>b}}   ระยะเส้นตรงจากจุดสังเกต a ไป b (เมตร ปัดเป็นหลักสิบ)
 *   {{dist:a>b*10}} ระยะเส้นตรงคูณตัวเลข (ใช้สร้างตัวเลือกหลอกในคำถามมาตราส่วนที่ยังอิงแผนที่จริง)
 *   {{dir:a>b}}    ทิศของ b เมื่อมองจาก a (8 ทิศ ภาษาไทย)
 *   {{mapcm:a>b}}  ระยะเส้นตรงบนแผนที่กระดาษตามมาตราส่วน (ซม. ทศนิยม 1 ตำแหน่ง)
 *   {{route:id}}   ระยะตามเส้นทาง id (เมตร คำนวณจากถนนในแผนที่)
 */
export const GEO_TEMPLATE_PATTERN = /\{\{(dist|dir|mapcm):([\w-]+)>([\w-]+)(?:\*([\d.]+))?\}\}/g;
export const ROUTE_TEMPLATE_PATTERN = /\{\{route:([\w-]+)\}\}/g;

export function straightLineMeters(a: TilePoint, b: TilePoint, scale: ScaleSystem): number {
  return scale.tilesToMeters(Math.hypot(b.x - a.x, b.y - a.y));
}

export function roundMeters(m: number, step = 10): number {
  return Math.round(m / step) * step;
}

/** แสดงเลขทศนิยม 1 ตำแหน่ง ตัด .0 ทิ้ง เช่น 4 → "4", 3.92 → "3.9" */
export function formatCm(cm: number): string {
  const r = Math.round(cm * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function resolveGeoTemplate(
  text: string,
  points: Readonly<Record<string, TilePoint>>,
  scale: ScaleSystem,
  routeMeters: Readonly<Record<string, number>> = {},
): string {
  return text
    .replace(GEO_TEMPLATE_PATTERN, (match, kind: string, from: string, to: string, factor?: string) => {
      const a = points[from];
      const b = points[to];
      if (!a || !b) return match;
      const meters = straightLineMeters(a, b, scale);
      if (kind === 'dist') return (roundMeters(meters) * (factor ? Number(factor) : 1)).toLocaleString('en-US');
      if (kind === 'mapcm') return formatCm(scale.metersToMapCm(meters));
      return THAI_DIRECTION[bearingToDirection8(bearingDeg(b.x - a.x, b.y - a.y))];
    })
    .replace(ROUTE_TEMPLATE_PATTERN, (match, id: string) => {
      const m = routeMeters[id];
      return m === undefined ? match : roundMeters(m).toLocaleString('en-US');
    });
}

/** รายชื่อจุดสังเกตทั้งหมดที่ข้อความอ้างถึง (ใช้ตรวจความถูกต้องของเนื้อหา) */
export function referencedPoints(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(GEO_TEMPLATE_PATTERN)) ids.push(m[2], m[3]);
  return ids;
}

/** รายชื่อเส้นทางที่ข้อความอ้างถึง */
export function referencedRoutes(text: string): string[] {
  return Array.from(text.matchAll(ROUTE_TEMPLATE_PATTERN), (m) => m[1]);
}
