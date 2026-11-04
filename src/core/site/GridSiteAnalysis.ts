import { bearingDeg, bearingToDirection8, type Direction8 } from '../direction/Compass';
import type { ScaleSystem } from '../scale/ScaleSystem';
import type { TilePoint } from '../world/types';

/**
 * ตรวจจุดเป้าหมายด้วยหลักฐาน 3 ชนิด (ด่านพิกัด):
 *   grid      อยู่ที่พิกัดในบันทึก "หลังแก้ข้อผิดพลาดของการบันทึก" แล้ว
 *   relative  ทิศและระยะจากจุดอ้างอิงตรงกับคำบรรยายตำแหน่งสัมพัทธ์
 *   field     มีสิ่งที่ต้องพบจากการสำรวจจริงครบ
 * ต้องผ่านทั้ง 3 ข้อ — การคำนวณพิกัดอย่างเดียวไม่พอ
 */
export type GridSiteCheck = 'grid' | 'relative' | 'field';
export const GRID_SITE_CHECKS: readonly GridSiteCheck[] = ['grid', 'relative', 'field'];

export interface GridSiteEvidence {
  /** ช่องที่บันทึกชี้ถึง หลังแก้ข้อผิดพลาดแล้ว */
  recordTile: TilePoint;
  toleranceTiles: number;
  relative: { from: TilePoint; direction: Direction8; meters: number; toleranceMeters: number };
  requiredFeatures: string[];
}

export interface GridSiteReport {
  failed: GridSiteCheck[];
  /** ทิศและระยะจริงจากจุดอ้างอิง (ใช้อธิบายผล) */
  actualDirection: Direction8;
  actualMeters: number;
  missingFeatures: string[];
}

export function evaluateGridSite(
  site: TilePoint,
  features: readonly string[],
  ev: GridSiteEvidence,
  scale: ScaleSystem,
): GridSiteReport {
  const failed: GridSiteCheck[] = [];
  if (Math.hypot(site.x - ev.recordTile.x, site.y - ev.recordTile.y) > ev.toleranceTiles) failed.push('grid');
  const dx = site.x - ev.relative.from.x;
  const dy = site.y - ev.relative.from.y;
  const actualDirection = bearingToDirection8(bearingDeg(dx, dy));
  const actualMeters = scale.tilesToMeters(Math.hypot(dx, dy));
  if (actualDirection !== ev.relative.direction || Math.abs(actualMeters - ev.relative.meters) > ev.relative.toleranceMeters) {
    failed.push('relative');
  }
  const missingFeatures = ev.requiredFeatures.filter((f) => !features.includes(f));
  if (missingFeatures.length > 0) failed.push('field');
  return { failed, actualDirection, actualMeters, missingFeatures };
}
