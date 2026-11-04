import type { TilePoint } from '../world/types';

/**
 * ตรวจสถานที่ผู้ต้องสงสัย (เช่น "ตาน้ำต้นลำห้วย") กับหลักฐาน 3 ข้อ — คำนวณจากข้อมูลแผนที่ทั้งหมด
 *   upstream  อยู่ที่ต้นน้ำของลำน้ำ (จุดสูงสุดตามระดับความสูง)
 *   old-map   ปรากฏบนแผนที่เก่า (มีสัญลักษณ์อยู่ใกล้ตำแหน่งนี้)
 *   symbol    สัญลักษณ์บนแผนที่เก่าตรงกับสิ่งที่ตามหา
 */
export type SiteCheck = 'upstream' | 'old-map' | 'symbol';

export interface MapSymbolMark {
  symbol: string;
  at: TilePoint;
}

export interface SiteEvidence {
  /** ต้นน้ำที่คำนวณได้จากระดับความสูง */
  source: TilePoint;
  oldMapMarks: MapSymbolMark[];
  requiredSymbol: string;
  toleranceTiles: number;
}

const near = (a: TilePoint, b: TilePoint, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;

/** คืนรายการหลักฐานที่ "ไม่ผ่าน" (ว่าง = ตรงกับหลักฐานทุกข้อ) */
export function evaluateSite(site: TilePoint, ev: SiteEvidence): SiteCheck[] {
  const failed: SiteCheck[] = [];
  if (!near(site, ev.source, ev.toleranceTiles)) failed.push('upstream');
  const marks = ev.oldMapMarks.filter((m) => near(site, m.at, ev.toleranceTiles));
  if (marks.length === 0) failed.push('old-map');
  if (!marks.some((m) => m.symbol === ev.requiredSymbol)) failed.push('symbol');
  return failed;
}
