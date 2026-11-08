import type { SettlementAnalysisDefinition, SettlementBand, SettlementTopic } from '../../content/types';
import type { ScaleSystem } from '../scale/ScaleSystem';
import type { ElevationModel } from '../world/Elevation';
import type { TilePoint } from '../world/types';
import type { WorldGrid } from '../world/WorldGrid';

/**
 * วิเคราะห์ความเหมาะสมของ "วงกลมวิเคราะห์" สำหรับการตั้งถิ่นฐานจำลอง — 2 เกณฑ์เท่านั้น (ตรรกะล้วน ทดสอบได้)
 *
 *   เกณฑ์ที่ 1 ระดับความสูง (50)       ระดับความสูงเฉลี่ยในวง − ระดับผิวลำน้ำที่ใกล้ที่สุด = "สูงกว่าลำน้ำ" (ม.)
 *                                     (ลำน้ำไหลลงจากเหนือไปใต้ ระดับผิวน้ำไม่เท่ากันทั้งสาย → ต้องเทียบกับลำน้ำตรงนั้น จึงบอกความเสี่ยงน้ำท่วมได้ถูก)
 *   เกณฑ์ที่ 2 ความใกล้แหล่งน้ำ (50)   ระยะจากศูนย์กลางวงถึงช่องน้ำที่ใกล้ที่สุด (ScaleSystem: 1 ช่อง = 10 ม.)
 *
 *   คะแนนรวม = คะแนนระดับความสูง + คะแนนความใกล้แหล่งน้ำ · ผ่านเมื่อมากกว่า passPercent
 *
 * คะแนนแต่ละเกณฑ์ได้จาก "ช่วงคะแนน" (bands) ในข้อมูลด่าน — ค่าที่วัดได้ตกช่วงไหนได้คะแนนช่วงนั้น
 * ทุกค่ามาจากแบบจำลองความสูง (ElevationModel) และช่องน้ำในโลกเกม (WorldGrid) — ไม่มีการสุ่ม ไม่มีคำตอบตายตัว ไม่ใช้ความลาดชัน
 * คะแนนเป็นความเหมาะสมตามเงื่อนไขจำลอง ไม่ใช่ความน่าจะเป็นที่จะพบเมืองโบราณจริง
 */

export interface SettlementWorld {
  elevation: ElevationModel;
  grid: WorldGrid;
  scale: ScaleSystem;
}

export interface SettlementMeasures {
  /** จำนวนช่องในวง (ใช้หาค่าเฉลี่ย) */
  samples: number;
  /** ระดับความสูงเฉลี่ยในวง (ม. ปัดเป็นจำนวนเต็ม — ค่าเดียวกับที่แสดงผู้เล่น) */
  elevation: number;
  /** ระดับผิวน้ำของช่องน้ำที่ใกล้ที่สุด (ม.) — null = แผนที่ไม่มีน้ำ */
  waterElevation: number | null;
  /** สูงกว่าลำน้ำ (ม.) = elevation − waterElevation */
  heightAboveWater: number | null;
  /** ระยะถึงช่องน้ำที่ใกล้ที่สุด (ม. ปัดเป็นจำนวนเต็ม) */
  waterDistanceMeters: number | null;
  waterTile: TilePoint | null;
}

export interface SettlementPart {
  id: SettlementTopic;
  /** ค่าที่วัดได้ของเกณฑ์นี้ (สูงกว่าลำน้ำ ม. / ระยะถึงน้ำ ม.) */
  value: number | null;
  score: number;
  max: number;
  /** คำอธิบายช่วงที่ค่าตก (จากข้อมูลด่าน เช่น "เหมาะสม") */
  label: string;
}

export interface SettlementReport {
  center: TilePoint;
  radiusTiles: number;
  measures: SettlementMeasures;
  parts: SettlementPart[];
  /** คะแนนรวม = ผลรวมคะแนนทุกเกณฑ์ */
  total: number;
  /** คะแนนรวมคิดเป็นร้อยละของคะแนนเต็ม */
  percent: number;
  passed: boolean;
  /** เกณฑ์ที่ยังไม่ได้คะแนนเต็ม (ต้องทบทวนเมื่อไม่ผ่าน) */
  weakTopics: SettlementTopic[];
}

export const TOPIC_ORDER: readonly SettlementTopic[] = ['height', 'water'];

/** ช่องน้ำทั้งหมดของแผนที่ (คำนวณครั้งเดียวต่อโลก) */
const waterCache = new WeakMap<WorldGrid, TilePoint[]>();
export function waterTiles(grid: WorldGrid): TilePoint[] {
  let list = waterCache.get(grid);
  if (!list) {
    list = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.getTerrain(x, y) === 'water') list.push({ x, y });
    waterCache.set(grid, list);
  }
  return list;
}

/** เขตสำรวจ: ศูนย์กลางวงต้องห่างขอบแผนที่อย่างน้อยรัศมีวง (วงทั้งวงอยู่ในแผนที่) */
export function surveyBounds(grid: WorldGrid, radiusTiles: number): { minX: number; minY: number; maxX: number; maxY: number } {
  return { minX: radiusTiles, minY: radiusTiles, maxX: grid.width - 1 - radiusTiles, maxY: grid.height - 1 - radiusTiles };
}

export function inSurveyArea(grid: WorldGrid, radiusTiles: number, t: TilePoint): boolean {
  const b = surveyBounds(grid, radiusTiles);
  return t.x >= b.minX && t.x <= b.maxX && t.y >= b.minY && t.y <= b.maxY;
}

/** เลื่อนตำแหน่งที่แตะให้อยู่ในเขตสำรวจ (แตะใกล้ขอบ → วงชิดขอบแต่ยังอยู่ในแผนที่ทั้งวง) */
export function clampToSurvey(grid: WorldGrid, radiusTiles: number, t: TilePoint): TilePoint {
  const b = surveyBounds(grid, radiusTiles);
  return { x: Math.min(b.maxX, Math.max(b.minX, Math.round(t.x))), y: Math.min(b.maxY, Math.max(b.minY, Math.round(t.y))) };
}

/** ช่องที่อยู่ในวงกลมวิเคราะห์ (ศูนย์กลางช่องห่างจากศูนย์กลางวงไม่เกินรัศมี) */
export function circleTiles(grid: WorldGrid, center: TilePoint, radiusTiles: number): TilePoint[] {
  const out: TilePoint[] = [];
  const r = Math.ceil(radiusTiles);
  for (let y = center.y - r; y <= center.y + r; y++) {
    for (let x = center.x - r; x <= center.x + r; x++) {
      if (grid.inBounds(x, y) && Math.hypot(x - center.x, y - center.y) <= radiusTiles) out.push({ x, y });
    }
  }
  return out;
}

export function measureSettlement(world: SettlementWorld, center: TilePoint, radiusTiles: number): SettlementMeasures {
  const { elevation, grid, scale } = world;
  const tiles = circleTiles(grid, center, radiusTiles);
  const mean = tiles.reduce((a, t) => a + elevation.heightAt(t.x + 0.5, t.y + 0.5), 0) / Math.max(1, tiles.length);
  let best: TilePoint | null = null;
  let bestD = Infinity;
  for (const w of waterTiles(grid)) {
    const d = Math.hypot(w.x - center.x, w.y - center.y);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  const elev = Math.round(mean);
  const waterElev = best ? Math.round(elevation.heightAt(best.x + 0.5, best.y + 0.5)) : null;
  return {
    samples: tiles.length,
    elevation: elev,
    waterElevation: waterElev,
    heightAboveWater: waterElev === null ? null : elev - waterElev,
    waterDistanceMeters: best ? Math.round(scale.tilesToMeters(bestD)) : null,
    waterTile: best,
  };
}

/** ช่วงคะแนนที่ค่าตก: ช่วงแรกที่ value < below (below = null คือช่วงสุดท้าย) · ไม่มีค่า = ช่วงสุดท้าย */
export function bandFor(bands: readonly SettlementBand[], value: number | null): SettlementBand {
  if (value !== null) for (const b of bands) if (b.below === null || value < b.below) return b;
  return bands[bands.length - 1];
}

/** ช่วงที่ได้คะแนนเต็ม (ใช้เขียนข้อความเกณฑ์) — [ต่ำสุด, ไม่ถึง) */
export function idealRange(bands: readonly SettlementBand[], max: number): { from: number | null; below: number | null } {
  const i = bands.findIndex((b) => b.score === max);
  return { from: i > 0 ? bands[i - 1].below : null, below: i >= 0 ? bands[i].below : null };
}

/** คำนวณคะแนนตามเกณฑ์ของด่าน (ไม่สุ่ม ไม่ hardcode ตำแหน่ง) */
export function analyzeSettlement(world: SettlementWorld, def: SettlementAnalysisDefinition, center: TilePoint): SettlementReport {
  const m = measureSettlement(world, center, def.radiusTiles);
  const values: Record<SettlementTopic, number | null> = { height: m.heightAboveWater, water: m.waterDistanceMeters };
  const parts: SettlementPart[] = TOPIC_ORDER.map((id) => {
    const band = bandFor(def[id].bands, values[id]);
    return { id, value: values[id], score: band.score, max: def[id].max, label: band.label };
  });
  const total = parts.reduce((a, p) => a + p.score, 0);
  const full = parts.reduce((a, p) => a + p.max, 0);
  const percent = Math.round((total / full) * 1000) / 10;
  return {
    center: { x: center.x, y: center.y },
    radiusTiles: def.radiusTiles,
    measures: m,
    parts,
    total,
    percent,
    passed: percent > def.passPercent,
    weakTopics: parts.filter((p) => p.score < p.max).map((p) => p.id),
  };
}

/** วิเคราะห์ทุกตำแหน่งในเขตสำรวจ (ใช้ตรวจเนื้อหาด่านและทดสอบ — ไม่ใช้ในเกมเพื่อเลือกคำตอบแทนผู้เล่น) */
export function scanSettlement(world: SettlementWorld, def: SettlementAnalysisDefinition, step = 1): SettlementReport[] {
  const b = surveyBounds(world.grid, def.radiusTiles);
  const out: SettlementReport[] = [];
  for (let y = b.minY; y <= b.maxY; y += step) for (let x = b.minX; x <= b.maxX; x += step) out.push(analyzeSettlement(world, def, { x, y }));
  return out;
}

/** ข้อความผลของแต่ละเกณฑ์ (บอกค่าที่วัดได้และช่วงคะแนน ไม่เฉลยตำแหน่ง) */
export function explainSettlementPart(r: SettlementReport, _def: SettlementAnalysisDefinition, id: SettlementTopic): string {
  const m = r.measures;
  const p = r.parts.find((x) => x.id === id)!;
  const fmt = (v: number) => v.toLocaleString('en-US');
  if (id === 'height') {
    if (m.heightAboveWater === null || m.waterElevation === null) return `ระดับความสูง ${fmt(m.elevation)} ม. — ${p.label}`;
    return `${fmt(m.elevation)} ม. (สูงกว่าลำน้ำ ${fmt(m.heightAboveWater)} ม.) — ${p.label}`;
  }
  return m.waterDistanceMeters === null ? `ไม่มีแหล่งน้ำ — ${p.label}` : `~${fmt(m.waterDistanceMeters)} ม. — ${p.label}`;
}

/** ชื่อเกณฑ์สำหรับแสดงผล */
export const PART_TITLE: Record<SettlementTopic, string> = {
  height: 'ระดับความสูง',
  water: 'ระยะจากแหล่งน้ำ',
};
