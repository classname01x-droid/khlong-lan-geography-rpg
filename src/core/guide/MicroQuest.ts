import type { MicroStep } from '../../content/types';
import type { GameSession } from '../session/GameSession';

/**
 * ขั้นย่อยของภารกิจ (Micro-Quest) — คำนวณจากสถานะจริงของเกมทุกครั้ง (ไม่มีข้อมูลบันทึกเพิ่ม)
 *
 * ขั้นที่ i ถือว่าสำเร็จเมื่อ:
 *   1) ฉากของขั้นนั้นผ่านไปแล้ว (บันทึกเก่า/ทำไปก่อน → ไม่ต้องย้อนกลับไปทำ)  หรือ
 *   2) เงื่อนไขของขั้นนั้นเป็นจริงแล้ว (ทำก่อนลำดับก็นับ)  หรือ
 *   3) ขั้นนั้นตั้ง impliedByLater และขั้นถัดไปในฉากเดียวกันสำเร็จแล้ว (เช่น เปิดหน้าวิเคราะห์ = อ่านสมุดแล้ว)
 * ขั้นปัจจุบัน = ขั้นแรกของฉากปัจจุบันที่ยังไม่สำเร็จ (ถ้าฉากปัจจุบันไม่มีขั้นค้าง → ขั้นแรกที่ยังไม่สำเร็จถัดไป)
 */
export interface MicroState {
  step: MicroStep;
  /** ลำดับฉากที่ขั้นนี้อยู่ */
  storyOrder: number;
  /** ลำดับขั้นทั้งบท (เริ่ม 0) */
  index: number;
  done: boolean;
  current: boolean;
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
  let current = list.findIndex((x, i) => x.order === cur && !done[i]);
  if (current < 0) current = list.findIndex((x, i) => x.order >= cur && !done[i]);
  return list.map((x, i) => ({ step: x.m, storyOrder: x.order, index: i, done: done[i], current: i === current }));
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
