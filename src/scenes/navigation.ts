import type Phaser from 'phaser';
import { isPlayableLevel } from '../content/registry';
import type { ProgressStore } from '../core/progress/ProgressStore';
import type { SettingsStore } from '../core/settings/SettingsStore';
import { REGISTRY_PROGRESS, REGISTRY_SETTINGS } from './events';

/**
 * การเปลี่ยนหน้าระหว่าง เมนูหลัก ↔ หน้าเลือกด่าน ↔ ด่าน
 * ทุกทางเข้าด่านผ่าน startLevel() ซึ่งกันไม่ให้เข้าด่านที่ยังไม่มีเนื้อหา
 */
export type LevelStartMode = 'resume' | 'fresh';

export interface LevelStartData {
  levelId: string;
  mode: LevelStartMode;
}

export const SCENE = {
  boot: 'BootScene',
  menu: 'MainMenuScene',
  worldMap: 'WorldMapScene',
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

/** เข้าด่าน — คืน false (และไม่เปลี่ยนหน้า) ถ้าด่านยังไม่มีเนื้อหาให้เล่น */
export function startLevel(scene: Phaser.Scene, levelId: string, mode: LevelStartMode): boolean {
  if (!isPlayableLevel(levelId)) return false;
  stopGameplayUi(scene);
  const data: LevelStartData = { levelId, mode };
  scene.scene.start(SCENE.level, data);
  return true;
}

export function goToMainMenu(scene: Phaser.Scene): void {
  stopGameplayUi(scene);
  scene.scene.start(SCENE.menu);
}

export function goToWorldMap(scene: Phaser.Scene): void {
  stopGameplayUi(scene);
  scene.scene.start(SCENE.worldMap);
}
