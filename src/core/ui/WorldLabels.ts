/**
 * ขนาดตัวอักษรของป้ายในโลกเกม (ชื่อ NPC · ชื่อจุดสังเกต · ป้าย "คุย/สำรวจ") — ตรรกะล้วน ทดสอบได้
 *
 * ป้ายอยู่ในโลกเกม (ขยับตามกล้อง ไม่หลุดตำแหน่ง) แต่ภาพเกมถูกย่อตามขนาดจอ
 * จึงคำนวณขนาดตัวอักษรในโลกเกมจาก "พิกเซลบนจอต่อพิกเซลโลกเกม" ให้ขนาดบนจอไม่ต่ำกว่าเป้าหมาย
 *   คอมพิวเตอร์ (ภาพเกม 960 px ขึ้นไป) = ขนาดเดิม (NPC 5 px × กล้อง 3 = 15 px บนจอ)
 *   โทรศัพท์ = ขยายจนอ่านได้ ~14–15 px บนจอ แต่ไม่ใหญ่เกินจนบังฉาก (มีเพดาน)
 */
export const LABEL_BASE = { npc: 5, landmark: 6, cue: 6 } as const;
/** ขนาดเป้าหมายบนจอ (CSS px) */
export const LABEL_TARGET_PX = { npc: 14, landmark: 14, cue: 15 } as const;
/** เพดานขนาดในโลกเกม (px) — 1 ช่อง = 16 px */
export const LABEL_MAX_WORLD = { npc: 12, landmark: 12, cue: 13 } as const;

export interface LabelSizes {
  npc: number;
  landmark: number;
  cue: number;
  /** ตัวคูณขนาดเครื่องหมาย "!" เหนือหัว NPC */
  marker: number;
}

const fit = (base: number, target: number, max: number, screenPerWorld: number) =>
  Math.ceil(Math.min(max, Math.max(base, target / screenPerWorld)) * 2) / 2;

export function labelSizes(screenPerWorld: number): LabelSizes {
  const spw = Math.max(0.1, screenPerWorld);
  return {
    npc: fit(LABEL_BASE.npc, LABEL_TARGET_PX.npc, LABEL_MAX_WORLD.npc, spw),
    landmark: fit(LABEL_BASE.landmark, LABEL_TARGET_PX.landmark, LABEL_MAX_WORLD.landmark, spw),
    cue: fit(LABEL_BASE.cue, LABEL_TARGET_PX.cue, LABEL_MAX_WORLD.cue, spw),
    // "!" เดิมสูง 8 px × 3 = 24 px บนจอ → คงขนาดบนจอไว้ใกล้เดิม (ไม่เกิน 2 เท่า)
    marker: Math.round(Math.min(2, Math.max(1, 3 / spw)) * 4) / 4,
  };
}
