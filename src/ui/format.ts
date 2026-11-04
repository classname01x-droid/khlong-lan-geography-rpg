import { THAI_DIRECTION, type Direction8 } from '../core/direction/Compass';
import type { RouteCheck } from '../core/route/RouteAnalysis';
import type { PinProblem } from '../core/session/GameSession';
import type { SheetCheck, SheetProblem } from '../core/map/BaseMapCheck';
import { SYMBOL_LABEL } from './mapSymbols';

export const fmtMeters = (m: number) => `${Math.round(m).toLocaleString('en-US')} ม.`;

/** ปัดเป็นหลักสิบเมตร (ความละเอียด 1 ช่อง) */
export const fmtMeters10 = (m: number) => `${(Math.round(m / 10) * 10).toLocaleString('en-US')} ม.`;

export function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} นาที ${String(s).padStart(2, '0')} วินาที`;
}

export const dirName = (d: Direction8) => THAI_DIRECTION[d];

export const ROUTE_CHECK_TEXT: Record<RouteCheck, string> = {
  direction: 'ทิศของปลายทางไม่ตรงกับเบาะแสทิศทาง',
  distance: 'ระยะเส้นตรงไม่ตรงกับระยะบนแผนที่ในเบาะแสระยะทาง',
  landmark: 'เส้นทางนี้ไม่ผ่านจุดสังเกตตามเบาะแส',
};

export const PIN_PROBLEM_TEXT: Record<PinProblem, string> = {
  unexplored: 'ตำแหน่งที่ปักยังไม่ได้สำรวจ ต้องเดินไปสำรวจพื้นที่ก่อน',
  location: 'พิกัดยังไม่ตรงกับตำแหน่งที่พบภูมิปัญญา ตรวจทิศและระยะอีกครั้ง',
  wisdom: 'ประเภทภูมิปัญญายังไม่ถูกต้อง',
  evidence: 'ยังไม่มีหลักฐานการสำรวจของจุดนี้ ต้องไปถึงจุดนั้นและสำรวจ (กด E) ก่อน',
  far: 'ต้องเดินไปให้ถึงจุดที่จะปักหมุดก่อน (ยืนใกล้ตำแหน่งที่ปัก)',
};

/* ---------------- อธิบายผลการเปรียบเทียบแผนที่ ---------------- */

export const SHEET_CHECK_LABEL: Record<SheetCheck, string> = {
  symbol: 'สัญลักษณ์แผนที่',
  flow: 'ระดับความสูง/ทิศน้ำไหล',
  landmark: 'จุดสังเกตที่ตรวจพบจริง',
};

export function describeSheetProblem(p: SheetProblem): string {
  switch (p.check) {
    case 'symbol':
      return `"${p.label}" ใช้สัญลักษณ์${SYMBOL_LABEL[p.drawn]} แต่ ณ ตำแหน่งนั้นคือ${p.actualName} (${SYMBOL_LABEL[p.actual]})`;
    case 'flow':
      return `ลูกศรชี้ว่าน้ำไหลไป${THAI_DIRECTION[p.drawn]} แต่ระดับความสูงบอกว่าน้ำไหลไป${THAI_DIRECTION[p.actual]}`;
    case 'landmark':
      return `"${p.label}" อยู่คลาดจากตำแหน่งที่ตรวจพบจริงประมาณ ${Math.round(p.offsetTiles) * 10} ม.`;
  }
}
