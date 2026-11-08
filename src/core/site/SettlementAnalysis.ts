import type { SettlementAnalysisDefinition, SettlementTopic } from '../../content/types';
import type { ScaleSystem } from '../scale/ScaleSystem';
import type { ElevationModel } from '../world/Elevation';
import type { TilePoint } from '../world/types';
import type { WorldGrid } from '../world/WorldGrid';

/**
 * วิเคราะห์ความเหมาะสมของ "วงกลมวิเคราะห์" สำหรับการตั้งถิ่นฐานจำลอง (ตรรกะล้วน ทดสอบได้)
 *
 * ทุกค่ามาจากข้อมูลจริงของแผนที่จำลอง — แบบจำลองความสูง (ElevationModel) และน้ำในโลกเกม (WorldGrid):
 *   ความลาดชัน        เฉลี่ยของความชันที่จุดตัวอย่างทุกช่องในวง
 *   ความสูงเหนือน้ำ   ความสูงที่ศูนย์กลาง − ความสูงของผิวน้ำที่ใกล้ที่สุด
 *   ลักษณะพื้นที่     เทียบศูนย์กลางกับบริเวณรอบวง + ความต่างระดับในวง
 *   ความใกล้น้ำ       ระยะถึงช่องน้ำที่ใกล้ที่สุด (ScaleSystem)
 * ไม่มีการสุ่ม ไม่มีคำตอบตายตัว — วงไหนก็ตามที่คำนวณได้มากกว่าเกณฑ์ถือว่าผ่าน
 * คะแนนเป็นความเหมาะสมตามเกณฑ์จำลอง ไม่ใช่ความน่าจะเป็นที่จะพบเมืองโบราณจริง
 */
export type Landform = 'shelf' | 'summit' | 'basin';

export interface SettlementMeasures {
  /** จำนวนช่องตัวอย่างในวง */
  samples: number;
  meanSlopePct: number;
  maxSlopePct: number;
  centerHeight: number;
  /** ความสูงผิวน้ำที่ใกล้ที่สุด (ม.) — null = ไม่มีน้ำในแผนที่ */
  waterHeight: number | null;
  heightAboveWater: number | null;
  /** ความต่างระดับสูงสุด–ต่ำสุดในวง (ม.) */
  reliefMeters: number;
  /** ศูนย์กลางสูงกว่า (+) หรือต่ำกว่า (−) บริเวณรอบวง (ม.) */
  ringDelta: number;
  landform: Landform;
  waterDistanceMeters: number | null;
  /** ช่องน้ำที่ใกล้ที่สุด */
  waterTile: TilePoint | null;
}

export interface SettlementPart {
  id: SettlementTopic;
  score: number;
  max: number;
  /** score / max */
  ratio: number;
  weak: boolean;
}

export interface SettlementReport {
  center: TilePoint;
  radiusTiles: number;
  measures: SettlementMeasures;
  parts: SettlementPart[];
  /** คะแนนรวม (ปัด 1 ตำแหน่ง) จากคะแนนเต็ม 100 */
  total: number;
  percent: number;
  passed: boolean;
  /** หัวข้อที่ยังไม่เข้าใจ เรียงตามคะแนนที่เสียมากสุดก่อน */
  weakTopics: SettlementTopic[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

export interface SettlementWorld {
  elevation: ElevationModel;
  grid: WorldGrid;
  scale: ScaleSystem;
}

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

/** ความลาดชัน (%) ที่จุดหนึ่ง: ขนาดเกรเดียนต์จากผลต่างกึ่งกลางของแบบจำลองความสูง */
export function slopePctAt(world: SettlementWorld, x: number, y: number): number {
  const e = world.elevation;
  const dhx = (e.heightAt(x + 0.5, y) - e.heightAt(x - 0.5, y)) / 1; // ม./ช่อง
  const dhy = (e.heightAt(x, y + 0.5) - e.heightAt(x, y - 0.5)) / 1;
  return (Math.hypot(dhx, dhy) / world.scale.config.metersPerTile) * 100;
}

export function measureSettlement(world: SettlementWorld, center: TilePoint, radiusTiles: number): SettlementMeasures {
  const { elevation, grid, scale } = world;
  const cx = center.x + 0.5;
  const cy = center.y + 0.5;
  const inRing = (d: number) => d >= radiusTiles * 1.5 && d <= radiusTiles * 2.5;
  let n = 0;
  let sumSlope = 0;
  let maxSlope = 0;
  let minH = Infinity;
  let maxH = -Infinity;
  let ringSum = 0;
  let ringN = 0;
  const reach = Math.ceil(radiusTiles * 2.5);
  for (let y = center.y - reach; y <= center.y + reach; y++) {
    for (let x = center.x - reach; x <= center.x + reach; x++) {
      if (!grid.inBounds(x, y)) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= radiusTiles) {
        const s = slopePctAt(world, x + 0.5, y + 0.5);
        const h = elevation.heightAt(x + 0.5, y + 0.5);
        n++;
        sumSlope += s;
        maxSlope = Math.max(maxSlope, s);
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      } else if (inRing(d)) {
        ringSum += elevation.heightAt(x + 0.5, y + 0.5);
        ringN++;
      }
    }
  }
  const centerH = elevation.heightAt(cx, cy);
  const ringDelta = ringN > 0 ? centerH - ringSum / ringN : 0;
  // น้ำที่ใกล้ที่สุด (ระยะจากศูนย์กลาง)
  let best: TilePoint | null = null;
  let bestD = Infinity;
  for (const w of waterTiles(grid)) {
    const d = Math.hypot(w.x + 0.5 - cx, w.y + 0.5 - cy);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  const waterH = best ? elevation.heightAt(best.x + 0.5, best.y + 0.5) : null;
  return {
    samples: n,
    meanSlopePct: n ? sumSlope / n : 0,
    maxSlopePct: maxSlope,
    centerHeight: centerH,
    waterHeight: waterH,
    heightAboveWater: waterH === null ? null : centerH - waterH,
    reliefMeters: n ? maxH - minH : 0,
    ringDelta,
    landform: 'shelf', // ตั้งตามเกณฑ์ใน scoreSettlement
    waterDistanceMeters: best ? scale.tilesToMeters(bestD) : null,
    waterTile: best,
  };
}

/** คำนวณคะแนนตามเกณฑ์ของด่าน (ไม่สุ่ม ไม่ hardcode ตำแหน่ง) */
export function analyzeSettlement(world: SettlementWorld, def: SettlementAnalysisDefinition, center: TilePoint): SettlementReport {
  const m = measureSettlement(world, center, def.radiusTiles);
  const w = def.weights;

  // ความลาดชัน: ลาดเล็กน้อยดีที่สุด · ราบสนิทระบายน้ำไม่ดี · ชันมากไม่เหมาะ
  const sl = def.slope;
  let slopeF: number;
  if (m.meanSlopePct < sl.idealMinPct) slopeF = sl.flatFactor + (1 - sl.flatFactor) * (m.meanSlopePct / sl.idealMinPct);
  else if (m.meanSlopePct <= sl.idealMaxPct) slopeF = 1;
  else slopeF = 1 - clamp01((m.meanSlopePct - sl.idealMaxPct) / (sl.zeroAtPct - sl.idealMaxPct));

  // ความสูงเหนือน้ำ: ต้องพ้นระดับน้ำท่วม + ระยะปลอดภัย · สูงเกินไปใช้น้ำลำบาก
  const ht = def.height;
  let heightF = 0;
  if (m.heightAboveWater !== null) {
    const a = m.heightAboveWater;
    heightF = clamp01((a - ht.floodLevelMeters) / ht.safeMarginMeters);
    if (a > ht.tooHighMeters) heightF = Math.min(heightF, 1 - (1 - ht.tooHighFactor) * clamp01((a - ht.tooHighMeters) / ht.tooHighMeters));
  }

  // ลักษณะพื้นที่: ชานเนิน/ลานราบเรียบ (shelf) ดีที่สุด · ยอดเนินโล่ง/แอ่งรับน้ำลดคะแนน · ต่างระดับในวงมากลดคะแนน
  const lf = def.landform;
  const landform: Landform = m.ringDelta > lf.summitMarginMeters ? 'summit' : m.ringDelta < -lf.basinMarginMeters ? 'basin' : 'shelf';
  const classF = landform === 'summit' ? lf.summitFactor : landform === 'basin' ? lf.basinFactor : 1;
  const reliefF = 1 - clamp01((m.reliefMeters - lf.reliefFullMeters) / (lf.reliefZeroMeters - lf.reliefFullMeters));
  const landformF = classF * reliefF;

  // ความใกล้น้ำ
  const wt = def.water;
  let waterF = 0;
  if (m.waterDistanceMeters !== null) {
    const d = m.waterDistanceMeters;
    waterF = d < wt.tooCloseMeters ? wt.tooCloseFactor : d <= wt.idealMaxMeters ? 1 : 1 - clamp01((d - wt.idealMaxMeters) / (wt.zeroAtMeters - wt.idealMaxMeters));
  }

  const ratios: Record<SettlementTopic, number> = { slope: slopeF, height: heightF, landform: landformF, water: waterF };
  const topics = Object.keys(ratios) as SettlementTopic[];
  const parts: SettlementPart[] = topics.map((id) => ({
    id,
    score: r1(w[id] * ratios[id]),
    max: w[id],
    ratio: ratios[id],
    weak: ratios[id] < def.weakBelow,
  }));
  const maxTotal = topics.reduce((a, t) => a + w[t], 0);
  const total = r1(parts.reduce((a, p) => a + p.score, 0));
  const percent = r1((total / maxTotal) * 100);
  const weakTopics = parts
    .filter((p) => p.weak)
    .sort((a, b) => b.max - b.score - (a.max - a.score))
    .map((p) => p.id);
  return {
    center: { ...center },
    radiusTiles: def.radiusTiles,
    measures: { ...m, landform },
    parts,
    total,
    percent,
    passed: percent > def.passPercent,
    weakTopics,
  };
}

/** วิเคราะห์ทุกช่องของแผนที่ (ใช้ตรวจเนื้อหาด่านและทดสอบ — ไม่ใช้ในเกมเพื่อเลือกคำตอบแทนผู้เล่น) */
export function scanSettlement(world: SettlementWorld, def: SettlementAnalysisDefinition, step = 1): SettlementReport[] {
  const out: SettlementReport[] = [];
  for (let y = 0; y < world.grid.height; y += step) {
    for (let x = 0; x < world.grid.width; x += step) {
      // วงต้องอยู่ในแผนที่ทั้งวง และไม่ทับน้ำ/สิ่งกีดขวางที่ศูนย์กลาง
      if (x - def.radiusTiles < 0 || y - def.radiusTiles < 0 || x + def.radiusTiles >= world.grid.width || y + def.radiusTiles >= world.grid.height) continue;
      if (world.grid.getTerrain(x, y) === 'water') continue;
      out.push(analyzeSettlement(world, def, { x, y }));
    }
  }
  return out;
}

/** ข้อความอธิบายผลของแต่ละเกณฑ์ (ไม่เฉลยตำแหน่ง — บอกค่าที่วัดได้และเหตุผล) */
export const PART_LABEL: Record<SettlementTopic, string> = {
  slope: 'ความลาดชัน',
  height: 'ความสูงเหนือระดับน้ำ',
  landform: 'ลักษณะพื้นที่',
  water: 'ความใกล้แหล่งน้ำ',
};
export const LANDFORM_LABEL: Record<Landform, string> = {
  shelf: 'ชานเนิน/ลานราบเรียบ',
  summit: 'ยอดเนินโล่ง',
  basin: 'แอ่งรับน้ำ',
};

export function explainSettlementPart(r: SettlementReport, def: SettlementAnalysisDefinition, id: SettlementTopic): string {
  const m = r.measures;
  const f1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US');
  switch (id) {
    case 'slope': {
      const s = def.slope;
      const v = `ลาดเฉลี่ย ${f1(m.meanSlopePct)}%`;
      return m.meanSlopePct > s.idealMaxPct ? `${v} — ชันเกินไป (ที่เหมาะ ${s.idealMinPct}–${s.idealMaxPct}%)` : m.meanSlopePct < s.idealMinPct ? `${v} — ราบเกินไป ระบายน้ำไม่ดี (ที่เหมาะ ${s.idealMinPct}–${s.idealMaxPct}%)` : `${v} — กำลังเหมาะ`;
    }
    case 'height': {
      if (m.heightAboveWater === null) return 'ไม่มีแหล่งน้ำให้เทียบ';
      const h = def.height;
      const v = `สูงกว่าผิวน้ำ ${f1(m.heightAboveWater)} ม.`;
      return m.heightAboveWater <= h.floodLevelMeters
        ? `${v} — น้ำท่วมถึง (ระดับน้ำท่วมสูงสุด ${h.floodLevelMeters} ม.)`
        : m.heightAboveWater < h.floodLevelMeters + h.safeMarginMeters
          ? `${v} — พ้นน้ำท่วมแต่ยังใกล้ระดับน้ำ`
          : m.heightAboveWater > h.tooHighMeters
            ? `${v} — สูงจนใช้น้ำลำบาก`
            : `${v} — พ้นระดับน้ำท่วม`;
    }
    case 'landform':
      return `${LANDFORM_LABEL[m.landform]} · ต่างระดับในวง ${f1(m.reliefMeters)} ม.`;
    case 'water': {
      if (m.waterDistanceMeters === null) return 'ไม่มีแหล่งน้ำในแผนที่';
      const w = def.water;
      const d = Math.round(m.waterDistanceMeters / 10) * 10;
      const v = `ห่างลำห้วย ~${d.toLocaleString('en-US')} ม.`;
      return m.waterDistanceMeters < w.tooCloseMeters ? `${v} — ติดลำห้วยเกินไป` : m.waterDistanceMeters <= w.idealMaxMeters ? `${v} — ใกล้พอใช้น้ำ` : `${v} — ไกลเกินไป`;
    }
  }
}
