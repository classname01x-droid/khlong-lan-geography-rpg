import { bearingDeg, bearingToDirection8, type Direction8 } from '../direction/Compass';
import { lineTiles } from './MapBuilder';
import type { ElevationModel } from './Elevation';
import type { TilePoint } from './types';

export interface WaterwayDefinition {
  id: string;
  name: string;
  /** แนวลำน้ำ (ลำดับจุดไม่ได้บอกทิศน้ำไหล — ทิศคำนวณจากระดับความสูง) */
  points: TilePoint[];
  /** แสดงชื่อลำน้ำบนแผนที่สำรวจ (เมื่อได้รับแผนที่ภูมิประเทศ) */
  showName?: boolean;
}

export interface WaterwayAnalysis {
  /** ช่องตามแนวลำน้ำ เรียงจากต้นน้ำไปปลายน้ำ */
  tiles: TilePoint[];
  /** ต้นน้ำ = ปลายที่สูงกว่า */
  source: TilePoint;
  /** ปลายน้ำ = ปลายที่ต่ำกว่า */
  mouth: TilePoint;
  sourceMeters: number;
  mouthMeters: number;
  /** ทิศที่น้ำไหลโดยรวม (จากต้นน้ำไปปลายน้ำ) */
  flowDirection: Direction8;
  /** ระดับความสูงตามแนวลำน้ำ เรียงจากต้นน้ำไปปลายน้ำ */
  profile: number[];
  /** ระดับความสูงลดลงตลอดแนว (ไม่มีช่วงที่น้ำต้องไหลขึ้นเนิน) */
  monotonic: boolean;
}

/** ช่องทั้งหมดตามแนวลำน้ำ (ตามลำดับจุดที่ให้มา) */
export function waterwayTiles(points: TilePoint[]): TilePoint[] {
  const out: TilePoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = lineTiles(points[i], points[i + 1]);
    out.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return out;
}

/**
 * วิเคราะห์ทิศทางน้ำไหลจากระดับความสูงเท่านั้น
 * (ไม่ใช้ตำแหน่งบนจอ: ลำน้ำที่อยู่ด้านบนจออาจเป็นปลายน้ำก็ได้)
 */
export function analyzeWaterway(points: TilePoint[], elevation: ElevationModel): WaterwayAnalysis {
  let tiles = waterwayTiles(points);
  let profile = tiles.map((p) => elevation.heightAt(p.x, p.y));
  if (profile[0] < profile[profile.length - 1]) {
    tiles = [...tiles].reverse();
    profile = [...profile].reverse();
  }
  const source = tiles[0];
  const mouth = tiles[tiles.length - 1];
  const monotonic = profile.every((h, i) => i === 0 || h <= profile[i - 1] + 1e-9);
  return {
    tiles,
    source,
    mouth,
    sourceMeters: profile[0],
    mouthMeters: profile[profile.length - 1],
    flowDirection: bearingToDirection8(bearingDeg(mouth.x - source.x, mouth.y - source.y)),
    profile,
    monotonic,
  };
}
