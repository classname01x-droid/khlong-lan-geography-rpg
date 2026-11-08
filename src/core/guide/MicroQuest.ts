import type { MicroStep } from '../../content/types';
import type { GameSession } from '../session/GameSession';

/**
 * ขั้นย่อยของภารกิจ (Micro-Quest) — คำนวณจากสถานะจริงของเกมทุกครั้ง (ไม่มีข้อมูลบันทึกเพิ่ม)
 *
 * ขั้นที่ i ถือว่าสำเร็จเมื่อ:
 *   1) ฉากของขั้นนั้นผ่านไปแล้ว (บันทึกเก่า/ทำไปก่อน → ไม่ต้องย้อนกลับไปทำ)  หรือ
 *   2) เงื่อนไขของขั้นนั้นเป็นจริงแล้ว (ทำก่อนลำดับก็นับ)  หรือ
 *   3) ขั้นนั้นตั้ง impliedByLater และขั้นถัดไปในฉากเดียวกันสำเร็จแล้ว (เช่น คุยกับป้าศรีแล้ว = ไปถึงป้าศรีแล้ว)
 * ขั้นปัจจุบัน = ขั้นแรกของฉากปัจจุบันที่ยังไม่สำเร็จ (ถ้าฉากปัจจุบันไม่มีขั้นค้าง → ขั้นแรกที่ยังไม่สำเร็จถัดไป)
 *
 * เลขขั้น: ขั้นที่ตั้ง joinPrev เป็นขั้นย่อยของขั้นก่อนหน้า (นับเป็นขั้นเดียว) · นับแยกตามช่วง (phase) ของภารกิจ
 */
export interface MicroState {
  step: MicroStep;
  /** ลำดับฉากที่ขั้นนี้อยู่ */
  storyOrder: number;
  /** ลำดับขั้นทั้งบท (เริ่ม 0) */
  index: number;
  done: boolean;
  current: boolean;
  /** ช่วงของภารกิจ ('' = ไม่แบ่งช่วง) */
  phase: string;
  /** เลขขั้นในช่วง (เริ่ม 1) — ขั้นย่อยใช้เลขเดียวกับขั้นหลัก */
  num: number;
  /** ลำดับขั้นย่อยภายในเลขขั้นเดียวกัน (เริ่ม 1) และจำนวนขั้นย่อยทั้งหมด */
  part: number;
  parts: number;
}

export function hasMicroSteps(s: GameSession): boolean {
  return s.level.story.some((st) => (st.micro?.length ?? 0) > 0);
}

export function microStates(s: GameSession): MicroState[] {
  const list = s.level.story.flatMap((st) => (st.micro ?? []).map((m) => ({ m, order: st.order })));
  if (list.length === 0) return [];
  const cur = s.currentStepOrder;
  const own = list.map((x) => s.objectiveDone(x.m.done));
  const done = list.map(
    (x, i) => x.order < cur || own[i] || (!!x.m.impliedByLater && list.some((y, j) => j > i && y.order === x.order && own[j])),
  );
  // impliedByNext: ขั้นถัดไปทันที (ในฉากเดียวกัน) สำเร็จแล้ว — ไล่จากท้ายเพื่อให้ต่อกันเป็นทอด ๆ ได้
  for (let i = list.length - 2; i >= 0; i--) {
    if (!done[i] && list[i].m.impliedByNext && list[i + 1].order === list[i].order && done[i + 1]) done[i] = true;
  }
  let current = list.findIndex((x, i) => x.order === cur && !done[i]);
  if (current < 0) current = list.findIndex((x, i) => x.order >= cur && !done[i]);
  // เลขขั้นในแต่ละช่วง
  const nums: number[] = [];
  const counter = new Map<string, number>();
  list.forEach((x, i) => {
    const ph = x.m.phase ?? '';
    const joined = i > 0 && x.m.joinPrev && (list[i - 1].m.phase ?? '') === ph;
    const n = joined ? nums[i - 1] : (counter.get(ph) ?? 0) + 1;
    counter.set(ph, n);
    nums.push(n);
  });
  return list.map((x, i) => {
    const ph = x.m.phase ?? '';
    const same = list.map((_y, j) => j).filter((j) => (list[j].m.phase ?? '') === ph && nums[j] === nums[i]);
    return {
      step: x.m,
      storyOrder: x.order,
      index: i,
      done: done[i],
      current: i === current,
      phase: ph,
      num: nums[i],
      part: same.indexOf(i) + 1,
      parts: same.length,
    };
  });
}

export function currentMicro(s: GameSession): MicroState | null {
  return microStates(s).find((m) => m.current) ?? null;
}

/** ขั้นที่เพิ่งสำเร็จล่าสุด (ก่อนขั้นปัจจุบัน) — ใช้ข้อความ "✓ ..." บนแถบภารกิจ */
export function lastDoneMicro(states: MicroState[]): MicroState | null {
  const cur = states.find((m) => m.current);
  const before = states.filter((m) => m.done && (!cur || m.index < cur.index));
  return before[before.length - 1] ?? null;
}

/**
 * ความคืบหน้าของช่วงที่กำลังทำ: จำนวน "ขั้น" (เลขขั้น) ที่ทำครบทุกขั้นย่อยแล้ว / จำนวนขั้นทั้งหมดในช่วง
 * ภารกิจจบแล้ว (ไม่มีขั้นปัจจุบัน) → ช่วงสุดท้าย
 */
export function phaseProgress(states: MicroState[]): { phase: string; done: number; total: number } {
  const cur = states.find((m) => m.current) ?? states[states.length - 1];
  if (!cur) return { phase: '', done: 0, total: 0 };
  const inPhase = states.filter((m) => m.phase === cur.phase);
  const total = Math.max(0, ...inPhase.map((m) => m.num));
  let done = 0;
  for (let n = 1; n <= total; n++) if (inPhase.filter((m) => m.num === n).every((m) => m.done)) done++;
  return { phase: cur.phase, done, total };
}
