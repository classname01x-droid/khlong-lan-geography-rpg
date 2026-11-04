import { sakNgamLevel } from './levels/sakngam';
import type { LevelDefinition } from './types';

/**
 * ทะเบียนด่านที่เล่นได้ — เพิ่มตำบลใหม่โดยสร้างโฟลเดอร์ใน content/levels/
 * แล้วนำมาใส่ในอาร์เรย์นี้ (ระบบเกมไม่ต้องแก้)
 */
export const LEVELS: readonly LevelDefinition[] = [sakNgamLevel];

export const DEFAULT_LEVEL_ID = sakNgamLevel.id;

/**
 * ลำดับด่านทั้งเกม (รวมด่านที่ยังไม่สร้าง) — ใช้กับระบบปลดล็อก
 * ด่านที่ status = 'planned' ปลดล็อกได้แต่ยังเข้าเล่นไม่ได้
 */
export interface LevelSlot {
  id: string;
  name: string;
  status: 'available' | 'planned';
  /** ลำดับชิ้นรหัสลับที่ด่านนี้มอบให้ (1–4) */
  codePieceIndex: number;
}

/** 4 ตำบล = 4 ด่าน = รหัสลับ 4 ชิ้น (ด่าน 2–4 ยังไม่สร้าง: id/ชื่อเป็นตัวยึดตำแหน่ง) */
export const LEVEL_SEQUENCE: readonly LevelSlot[] = [
  { id: sakNgamLevel.id, name: `${sakNgamLevel.tambon}: ${sakNgamLevel.title}`, status: 'available', codePieceIndex: 1 },
  { id: 'level-2', name: 'ด่านที่ 2 (ตำบลถัดไป — กำลังพัฒนา)', status: 'planned', codePieceIndex: 2 },
  { id: 'level-3', name: 'ด่านที่ 3 (กำลังพัฒนา)', status: 'planned', codePieceIndex: 3 },
  { id: 'level-4', name: 'ด่านที่ 4 (กำลังพัฒนา)', status: 'planned', codePieceIndex: 4 },
];

export function getLevel(id: string): LevelDefinition {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`ไม่พบด่าน: ${id}`);
  return level;
}

export function getLevelSlot(id: string): LevelSlot | undefined {
  return LEVEL_SEQUENCE.find((s) => s.id === id);
}
