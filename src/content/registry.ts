import { sakNgamLevel } from './levels/sakngam';
import type { LevelDefinition } from './types';

/**
 * ทะเบียนด่านทั้งหมด — เพิ่มตำบลใหม่โดยสร้างโฟลเดอร์ใน content/levels/
 * แล้วนำมาใส่ในอาร์เรย์นี้ (ระบบเกมไม่ต้องแก้)
 */
export const LEVELS: readonly LevelDefinition[] = [sakNgamLevel];

export const DEFAULT_LEVEL_ID = sakNgamLevel.id;

export function getLevel(id: string): LevelDefinition {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`ไม่พบด่าน: ${id}`);
  return level;
}
