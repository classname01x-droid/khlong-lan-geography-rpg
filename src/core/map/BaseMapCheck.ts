import type { Direction8 } from '../direction/Compass';
import type { WaterwayAnalysis } from '../world/Waterway';
import type { MapSymbol, TilePoint } from '../world/types';

/**
 * ตรวจแผนที่ฐานหนึ่งฉบับกับ "ความจริงของโลกเกม" ด้วยหลักฐาน 3 ชนิด
 *   symbol    สัญลักษณ์บนแผนที่ตรงกับสิ่งที่อยู่ ณ ตำแหน่งนั้นจริงหรือไม่
 *   flow      ลูกศรทิศน้ำไหลบนแผนที่สอดคล้องกับระดับความสูง (ต้นน้ำ→ปลายน้ำ) หรือไม่
 *   landmark  จุดสังเกตที่แผนที่อ้างถึง อยู่ตรงตำแหน่งที่ตรวจพบจริงหรือไม่
 * ทั้งหมดคำนวณจากข้อมูลแผนที่และระดับความสูง — ไม่มีการกำหนดคำตอบตายตัว
 */
export type SheetCheck = 'symbol' | 'flow' | 'landmark';
export const SHEET_CHECKS: readonly SheetCheck[] = ['symbol', 'flow', 'landmark'];

export interface SheetMark {
  symbol: MapSymbol;
  at: TilePoint;
  label: string;
  /** แผนที่อ้างว่าสัญลักษณ์นี้คือจุดสังเกตใด (ใช้ตรวจตำแหน่ง) */
  refersTo?: string;
}

export interface SheetFlowArrow {
  /** ตำแหน่งลูกศรบนลำน้ำ */
  at: TilePoint;
  toward: Direction8;
}

export interface TruthLandmark {
  id: string;
  name: string;
  at: TilePoint;
  symbol?: MapSymbol;
}

export type SheetProblem =
  | { check: 'symbol'; label: string; at: TilePoint; drawn: MapSymbol; actual: MapSymbol; actualName: string }
  | { check: 'flow'; at: TilePoint; drawn: Direction8; actual: Direction8 }
  | { check: 'landmark'; label: string; landmarkId: string; offsetTiles: number };

export interface SheetReport {
  problems: SheetProblem[];
  failed: SheetCheck[];
}

const DIR_VEC: Record<Direction8, [number, number]> = {
  N: [0, -1],
  NE: [1, -1],
  E: [1, 0],
  SE: [1, 1],
  S: [0, 1],
  SW: [-1, 1],
  W: [-1, 0],
  NW: [-1, -1],
};

const dist = (a: TilePoint, b: TilePoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** ทิศทางท้ายน้ำ ณ ตำแหน่งบนลำน้ำ (เวกเตอร์จากช่องนี้ไปอีกไม่กี่ช่องทางปลายน้ำ) */
export function downstreamVector(w: WaterwayAnalysis, at: TilePoint): [number, number] {
  let best = 0;
  w.tiles.forEach((t, i) => {
    if (dist(t, at) < dist(w.tiles[best], at)) best = i;
  });
  const from = w.tiles[Math.max(0, Math.min(best, w.tiles.length - 4))];
  const to = w.tiles[Math.min(w.tiles.length - 1, Math.max(best, 0) + 3)];
  return [to.x - from.x, to.y - from.y];
}

export interface SheetTruth {
  landmarks: TruthLandmark[];
  /** ลำน้ำที่วิเคราะห์ทิศน้ำไหลแล้ว (ต้นน้ำ→ปลายน้ำ) พร้อมช่องเรียงตามทิศน้ำไหล */
  waterway: WaterwayAnalysis | null;
  toleranceTiles: number;
}

export function checkSheet(marks: SheetMark[], arrows: SheetFlowArrow[], truth: SheetTruth): SheetReport {
  const problems: SheetProblem[] = [];
  const tol = truth.toleranceTiles;

  // 1) สัญลักษณ์: เทียบกับจุดสังเกตจริงที่ใกล้ที่สุด (ที่มีสัญลักษณ์) ในรัศมีที่ยอมรับ
  for (const m of marks) {
    const near = truth.landmarks
      .filter((l) => l.symbol && dist(l.at, m.at) <= tol)
      .sort((a, b) => dist(a.at, m.at) - dist(b.at, m.at))[0];
    if (near && near.symbol !== m.symbol) {
      problems.push({ check: 'symbol', label: m.label, at: m.at, drawn: m.symbol, actual: near.symbol!, actualName: near.name });
    }
  }

  // 2) ทิศน้ำไหล: ลูกศรต้องชี้ไปทางท้ายน้ำ (ผลคูณจุดกับเวกเตอร์ท้ายน้ำ > 0)
  if (truth.waterway) {
    for (const a of arrows) {
      const [dx, dy] = downstreamVector(truth.waterway, a.at);
      const [ax, ay] = DIR_VEC[a.toward];
      if (ax * dx + ay * dy <= 0) problems.push({ check: 'flow', at: a.at, drawn: a.toward, actual: truth.waterway.flowDirection });
    }
  }

  // 3) จุดสังเกต: ตำแหน่งที่แผนที่อ้างถึงต้องตรงกับตำแหน่งจริง
  for (const m of marks) {
    if (!m.refersTo) continue;
    const lm = truth.landmarks.find((l) => l.id === m.refersTo);
    if (!lm) continue;
    const off = dist(lm.at, m.at);
    if (off > tol) problems.push({ check: 'landmark', label: m.label, landmarkId: lm.id, offsetTiles: off });
  }

  const failed = SHEET_CHECKS.filter((c) => problems.some((p) => p.check === c));
  return { problems, failed };
}
