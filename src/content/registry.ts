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
}

export const LEVEL_SEQUENCE: readonly LevelSlot[] = [
  { id: sakNgamLevel.id, name: `${sakNgamLevel.tambon}: ${sakNgamLevel.title}`, status: 'available' },
  { id: 'level-2', name: 'ด่านที่ 2 (ตำบลถัดไป — กำลังพัฒนา)', status: 'planned' },
];

export function getLevel(id: string): LevelDefinition {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`ไม่พบด่าน: ${id}`);
  return level;
}

export function getLevelSlot(id: string): LevelSlot | undefined {
  return LEVEL_SEQUENCE.find((s) => s.id === id);
}
