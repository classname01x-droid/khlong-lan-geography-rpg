import { bearingDeg, bearingToDirection8, THAI_DIRECTION } from '../direction/Compass';
import type { ScaleSystem } from '../scale/ScaleSystem';
import type { TilePoint } from '../world/types';

/**
 * แทนค่าตัวแปรภูมิศาสตร์ในบทพูด NPC โดยคำนวณจากตำแหน่งจริงในโลกเกม
 * เพื่อไม่ให้ตัวเลขในบทพูดขัดกับแผนที่ (แก้แผนที่แล้วบทพูดเปลี่ยนตามอัตโนมัติ)
 *
 *   {{dist:a>b}}  ระยะเส้นตรงจากจุดสังเกต a ไป b (เมตร ปัดเป็นหลักสิบ)
 *   {{dir:a>b}}   ทิศของ b เมื่อมองจาก a (8 ทิศ ภาษาไทย)
 */
export const GEO_TEMPLATE_PATTERN = /\{\{(dist|dir):([\w-]+)>([\w-]+)\}\}/g;

export function straightLineMeters(a: TilePoint, b: TilePoint, scale: ScaleSystem): number {
  return scale.tilesToMeters(Math.hypot(b.x - a.x, b.y - a.y));
}

export function roundMeters(m: number, step = 10): number {
  return Math.round(m / step) * step;
}

export function resolveGeoTemplate(
  text: string,
  points: Readonly<Record<string, TilePoint>>,
  scale: ScaleSystem,
): string {
  return text.replace(GEO_TEMPLATE_PATTERN, (match, kind: string, from: string, to: string) => {
    const a = points[from];
    const b = points[to];
    if (!a || !b) return match;
    if (kind === 'dist') {
      return roundMeters(straightLineMeters(a, b, scale)).toLocaleString('en-US');
    }
    return THAI_DIRECTION[bearingToDirection8(bearingDeg(b.x - a.x, b.y - a.y))];
  });
}

/** รายชื่อจุดสังเกตทั้งหมดที่ข้อความอ้างถึง (ใช้ตรวจความถูกต้องของเนื้อหา) */
export function referencedPoints(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(GEO_TEMPLATE_PATTERN)) ids.push(m[2], m[3]);
  return ids;
}
