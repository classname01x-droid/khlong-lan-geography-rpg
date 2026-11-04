import { khlongNamLaiLevel } from './levels/khlongnamlai';
import { sakNgamLevel } from './levels/sakngam';
import type { ProgressData } from '../core/progress/ProgressStore';
import type { LevelDefinition } from './types';

/**
 * ทะเบียนด่านที่เล่นได้ — เพิ่มตำบลใหม่โดยสร้างโฟลเดอร์ใน content/levels/
 * แล้วนำมาใส่ในอาร์เรย์นี้ (ระบบเกมไม่ต้องแก้)
 */
export const LEVELS: readonly LevelDefinition[] = [sakNgamLevel, khlongNamLaiLevel];

export const DEFAULT_LEVEL_ID = sakNgamLevel.id;

/**
 * ลำดับด่านทั้งเกม (รวมด่านที่ยังไม่สร้าง) — ใช้กับระบบปลดล็อก
 * ด่านที่ status = 'planned' ปลดล็อกได้แต่ยังเข้าเล่นไม่ได้
 */
export interface LevelSlot {
  id: string;
  tambon: string;
  missionTitle: string;
  /** ชื่อเต็มที่ใช้แสดง (เช่น ในหน้าสรุปผล "ปลดล็อก: ...") */
  name: string;
  status: 'available' | 'planned';
  /** ลำดับชิ้นรหัสลับที่ด่านนี้มอบให้ (1–4) */
  codePieceIndex: number;
}

/**
 * 4 ตำบลของอำเภอคลองลาน = 4 ด่าน = รหัสลับ 4 ชิ้น
 * ด่าน 2–4 ยังไม่สร้าง (status 'planned') — id 'level-2'…'level-4' คงไว้เพื่อให้ข้อมูลบันทึกเดิมใช้ได้
 * เมื่อสร้างเนื้อหาแล้ว: เพิ่มด่านใน LEVELS (id เดียวกัน) แล้วเปลี่ยน status เป็น 'available'
 */
const slot = (
  id: string,
  tambon: string,
  missionTitle: string,
  status: LevelSlot['status'],
  codePieceIndex: number,
): LevelSlot => ({
  id,
  tambon,
  missionTitle,
  name: `${tambon}: ${missionTitle}${status === 'planned' ? ' (อยู่ระหว่างพัฒนา)' : ''}`,
  status,
  codePieceIndex,
});

export const LEVEL_SEQUENCE: readonly LevelSlot[] = [
  slot(sakNgamLevel.id, sakNgamLevel.tambon, sakNgamLevel.title, 'available', 1),
  // ด่าน 2 (ต้นแบบ) ธีม "ภารกิจทรัพยากรชุมชน" — เล่นได้เมื่อปลดล็อกจากการจบด่าน 1 เท่านั้น
  slot(khlongNamLaiLevel.id, khlongNamLaiLevel.tambon, khlongNamLaiLevel.title, 'available', 2),
  slot('level-3', 'ตำบลโป่งน้ำร้อน', 'ปริศนาทิศทางและพิกัด', 'planned', 3),
  slot('level-4', 'ตำบลคลองลานพัฒนา', 'ปริศนาบูรณาการภูมิศาสตร์', 'planned', 4),
];

export function getLevel(id: string): LevelDefinition {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`ไม่พบด่าน: ${id}`);
  return level;
}

export function getLevelSlot(id: string): LevelSlot | undefined {
  return LEVEL_SEQUENCE.find((s) => s.id === id);
}

/**
 * ด่านนี้ "มีเนื้อหาให้เล่นจริง" หรือไม่ — ใช้กันไม่ให้เข้าฉากที่ยังไม่สร้าง
 * (ด่านที่ปลดล็อกแล้วแต่ยังไม่มีเนื้อหา จะไม่ผ่านเงื่อนไขนี้)
 */
export function isPlayableLevel(id: string): boolean {
  return getLevelSlot(id)?.status === 'available' && LEVELS.some((l) => l.id === id);
}

/**
 * เข้าด่านนี้ได้หรือไม่: ต้องมีเนื้อหา และปลดล็อกแล้ว (ด่านแรกปลดล็อกเสมอ)
 * — ด่าน 2 จึงเข้าได้หลังจบด่าน 1 เท่านั้น ไม่ว่าจะมาจากปุ่ม URL หรือฉากใด
 */
export function canEnterLevel(id: string, progress: ProgressData): boolean {
  if (!isPlayableLevel(id)) return false;
  return id === LEVEL_SEQUENCE[0].id || progress.unlocked.includes(id);
}
