import { THAI_DIRECTION, type Direction8 } from '../core/direction/Compass';
import type { RouteCheck } from '../core/route/RouteAnalysis';
import type { PinProblem } from '../core/session/GameSession';

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
  evidence: 'ยังไม่มีหลักฐานการสำรวจ ต้องพูดคุยกับผู้รู้ในพื้นที่ก่อน',
};
