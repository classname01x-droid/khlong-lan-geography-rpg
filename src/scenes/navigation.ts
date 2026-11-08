import type Phaser from 'phaser';
import { ALL_LEVELS, canEnterLevel, getLevelSlot } from '../content/registry';
import { CHAPTERS, getChapter } from '../content/story/chapters';
import { canPlayLevel, continueTarget, currentChapter } from '../core/campaign/Campaign';
import type { ProgressStore } from '../core/progress/ProgressStore';
import type { SettingsStore } from '../core/settings/SettingsStore';
import { REGISTRY_PROGRESS, REGISTRY_SETTINGS } from './events';

/**
 * การเปลี่ยนหน้าระหว่าง เมนูหลัก ↔ แผนที่การเดินทาง ↔ ฉากเชื่อมเรื่อง ↔ ด่าน
 * ทุกทางเข้าด่านผ่าน startLevel() ซึ่งอนุญาตเฉพาะด่านของ "บทปัจจุบัน" ในภารกิจหลัก
 * (ข้ามบท ย้อนบทที่ผ่านแล้ว หรือเข้าด่านที่ยังไม่มีเนื้อหา ไม่ได้ ทั้งจากเมนูและ URL)
 */
export type LevelStartMode = 'resume' | 'fresh';

export interface LevelStartData {
  levelId: string;
  mode: LevelStartMode;
}

export interface ChapterStartData {
  chapterId: string;
}

export const SCENE = {
  boot: 'BootScene',
  menu: 'MainMenuScene',
  intro: 'IntroScene',
  worldMap: 'WorldMapScene',
  chapter: 'ChapterScene',
  ending: 'EndingScene',
  level: 'WorldScene',
  ui: 'UIScene',
} as const;

export function getProgress(scene: Phaser.Scene): ProgressStore {
  return scene.registry.get(REGISTRY_PROGRESS) as ProgressStore;
}

export function getSettings(scene: Phaser.Scene): SettingsStore {
  return scene.registry.get(REGISTRY_SETTINGS) as SettingsStore;
}

function stopGameplayUi(scene: Phaser.Scene): void {
  if (scene.scene.isActive(SCENE.ui) || scene.scene.isPaused(SCENE.ui)) scene.scene.stop(SCENE.ui);
}

/** เข้าด่านนี้ได้หรือไม่: ปลดล็อกแล้ว มีเนื้อหา และเป็นด่านของบทปัจจุบันในภารกิจหลัก */
export function canStartLevel(scene: Phaser.Scene, levelId: string): boolean {
  const data = getProgress(scene).data;
  // ตำบลต้องผ่านกติกาปลดล็อกเดิมด้วย · บทสรุปไม่มีช่องตำบล — ใช้กติกาภารกิจหลัก (จบบท 1–4 + รหัสครบ)
  const base = getLevelSlot(levelId) ? canEnterLevel(levelId, data) : ALL_LEVELS.some((l) => l.id === levelId);
  return base && canPlayLevel(CHAPTERS, data, levelId);
}

/** เข้าด่าน — คืน false (และไม่เปลี่ยนหน้า) ถ้าไม่ใช่ด่านของบทปัจจุบัน ยังไม่มีเนื้อหา หรือยังไม่ปลดล็อก */
export function startLevel(scene: Phaser.Scene, levelId: string, mode: LevelStartMode): boolean {
  if (!canStartLevel(scene, levelId)) return false;
  stopGameplayUi(scene);
  const data: LevelStartData = { levelId, mode };
  scene.scene.start(SCENE.level, data);
  return true;
}

export function goToMainMenu(scene: Phaser.Scene): void {
  stopGameplayUi(scene);
  scene.scene.start(SCENE.menu);
}

/** แผนที่การเดินทาง (ดูความคืบหน้า — ไม่ใช่หน้าเลือกด่านอิสระ) */
export function goToWorldMap(scene: Phaser.Scene): void {
  stopGameplayUi(scene);
  scene.scene.start(SCENE.worldMap);
}

/** สรุปการเดินทาง (จบเกม) — EndingScene ตรวจเองว่าจบเกมแล้วจริง */
export function goToEnding(scene: Phaser.Scene): void {
  stopGameplayUi(scene);
  scene.scene.start(SCENE.ending);
}

/** ฉากเชื่อมเรื่องก่อนเริ่มบท — เปิดได้เฉพาะบทปัจจุบัน (คืน false ถ้าไม่ใช่) */
export function beginChapter(scene: Phaser.Scene, chapterId: string): boolean {
  const target = continueTarget(CHAPTERS, getProgress(scene).data);
  // เปิดได้เฉพาะบทปัจจุบันที่ยังไม่เริ่ม และเงื่อนไขครบ (จบเกมแล้ว/รหัสไม่ครบ/ยังไม่มีเนื้อหา → ไม่เปิด)
  if (!getChapter(chapterId) || target.kind === 'complete' || target.kind === 'blocked') return false;
  if (currentChapter(CHAPTERS, getProgress(scene).data).id !== chapterId) return false;
  stopGameplayUi(scene);
  const data: ChapterStartData = { chapterId };
  scene.scene.start(SCENE.chapter, data);
  return true;
}

/**
 * ดำเนินภารกิจหลักต่อ: มีบันทึกกลางบท → กลับไปตำแหน่งและสถานะปริศนาเดิม ·
 * ยังไม่เริ่มบท → ฉากเชื่อมเรื่องแล้วเริ่มบท · บทยังไม่มีเนื้อหา → แผนที่การเดินทาง (แสดง "อยู่ระหว่างพัฒนา")
 */
export function continueStory(scene: Phaser.Scene): void {
  const target = continueTarget(CHAPTERS, getProgress(scene).data);
  if (target.kind === 'complete') {
    goToEnding(scene);
    return;
  }
  if (target.kind === 'resume' && startLevel(scene, target.levelId, 'resume')) return;
  if (target.kind === 'begin' && beginChapter(scene, target.chapter.id)) return;
  goToWorldMap(scene);
}
