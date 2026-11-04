import type { Direction8 } from '../direction/Compass';

/**
 * ตรวจจุดเป้าหมายด้วยหลักฐานรวม 3 ชนิด (ด่านสุดท้าย — บูรณาการด่าน 1–3):
 *   distance  ทิศ + ระยะเส้นตรง + ระยะตามถนน จากจุดอ้างอิง (ด่าน 1: มาตราส่วน ทิศ ระยะทาง)
 *   terrain   สัญลักษณ์แผนที่ + ระดับความสูง + อยู่ทางต้นน้ำ/ปลายน้ำ (ด่าน 2: สัญลักษณ์ ความสูง ทิศน้ำไหล)
 *   grid      ค่า N จากหมุดอ้างอิง + ค่า E ที่อ่านได้บางหลัก (ด่าน 3: พิกัด E/N และจุดอ้างอิง)
 *
 * ฟังก์ชันนี้ "บริสุทธิ์": รับข้อเท็จจริงของสถานที่ (คำนวณจากโลกเกมโดย GameSession ด้วยระบบเดิม —
 * measureRoute, ElevationModel, analyzeWaterway, GridSystem) แล้วเทียบกับหลักฐาน ไม่มีคำตอบเขียนไว้
 */
export type IntegratedCheck = 'distance' | 'terrain' | 'grid';
export const INTEGRATED_CHECKS: readonly IntegratedCheck[] = ['distance', 'terrain', 'grid'];

/** ข้อเท็จจริงของสถานที่หนึ่งแห่ง (คำนวณจากโลกเกม) */
export interface SiteFacts {
  direction: Direction8;
  /** ระยะเส้นตรงจากจุดอ้างอิงระยะทาง (เมตร) */
  straightMeters: number;
  /** ระยะตามถนนจากจุดอ้างอิงระยะทาง (เมตร) — null = ไม่มีถนนเชื่อม */
  roadMeters: number | null;
  symbol: string | null;
  elevationMeters: number;
  /** ตำแหน่งตามลำน้ำเทียบกับจุดอ้างอิงลำน้ำ */
  waterRelation: 'upstream' | 'downstream' | 'same';
  e: number;
  n: number;
}

export interface IntegratedEvidence {
  distance: { direction: Direction8; straightMeters: number; roadMeters: number; toleranceMeters: number };
  terrain: { symbol: string; minElevationMeters: number; relation: 'upstream' | 'downstream' };
  /** nMeters = ค่า N ที่คำนวณจากหมุดอ้างอิง · eMask = ค่า E ที่อ่านได้บางหลัก ("?" = หลักที่เสียหาย) */
  grid: { nMeters: number; eMask: string; toleranceMeters: number };
}

export interface IntegratedReport {
  failed: IntegratedCheck[];
  /** รายละเอียดข้อที่ไม่ผ่าน (ใช้อธิบายผล/ทดสอบ) */
  reasons: Array<
    | 'direction'
    | 'straight'
    | 'road'
    | 'no-road'
    | 'symbol'
    | 'elevation'
    | 'water-relation'
    | 'n'
    | 'e-mask'
  >;
}

/** ค่า E (เช่น 5640) ตรงกับรูปแบบที่อ่านได้บางหลัก (เช่น "5,?40") หรือไม่ — เทียบทีละหลัก ไม่สนตัวคั่นหลักพัน */
export function matchesDigitMask(value: number, mask: string): boolean {
  const digits = String(Math.round(value));
  const pattern = mask.replace(/[^\d?]/g, '');
  if (digits.length !== pattern.length) return false;
  return [...pattern].every((ch, i) => ch === '?' || ch === digits[i]);
}

export function evaluateIntegratedSite(f: SiteFacts, ev: IntegratedEvidence): IntegratedReport {
  const reasons: IntegratedReport['reasons'] = [];
  const failed: IntegratedCheck[] = [];

  const d = ev.distance;
  const dr: IntegratedReport['reasons'] = [];
  if (f.direction !== d.direction) dr.push('direction');
  if (Math.abs(f.straightMeters - d.straightMeters) > d.toleranceMeters) dr.push('straight');
  if (f.roadMeters === null) dr.push('no-road');
  else if (Math.abs(f.roadMeters - d.roadMeters) > d.toleranceMeters) dr.push('road');
  if (dr.length) failed.push('distance');

  const t = ev.terrain;
  const tr: IntegratedReport['reasons'] = [];
  if (f.symbol !== t.symbol) tr.push('symbol');
  if (f.elevationMeters < t.minElevationMeters) tr.push('elevation');
  if (f.waterRelation !== t.relation) tr.push('water-relation');
  if (tr.length) failed.push('terrain');

  const g = ev.grid;
  const gr: IntegratedReport['reasons'] = [];
  if (Math.abs(f.n - g.nMeters) > g.toleranceMeters) gr.push('n');
  if (!matchesDigitMask(f.e, g.eMask)) gr.push('e-mask');
  if (gr.length) failed.push('grid');

  reasons.push(...dr, ...tr, ...gr);
  return { failed, reasons };
}
