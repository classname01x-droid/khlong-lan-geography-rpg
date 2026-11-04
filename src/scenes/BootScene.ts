import Phaser from 'phaser';
import { DEFAULT_LEVEL_ID, isPlayableLevel, LEVELS } from '../content/registry';
import { validateLevel } from '../content/validateLevel';
import { browserStorage, ProgressStore } from '../core/progress/ProgressStore';
import { SettingsStore } from '../core/settings/SettingsStore';
import { createCharacterAnimations, generatePlaceholderTextures } from '../graphics/PlaceholderTextures';
import { REGISTRY_PROGRESS, REGISTRY_SETTINGS } from './events';
import { goToMainMenu, goToWorldMap, startLevel } from './navigation';

/** เตรียมทรัพยากร (ภาพ placeholder ที่วาดด้วยโค้ด) ระบบบันทึก และการตั้งค่า แล้วไปหน้าเมนูหลัก */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    generatePlaceholderTextures(this);
    createCharacterAnimations(this);

    if (import.meta.env.DEV) {
      for (const level of LEVELS) {
        const problems = validateLevel(level);
        if (problems.length > 0) console.warn(`[level:${level.id}] พบปัญหาเนื้อหาด่าน`, problems);
      }
    }

    const storage = browserStorage();
    const settings = new SettingsStore(storage);
    this.registry.set(REGISTRY_PROGRESS, new ProgressStore(storage, DEFAULT_LEVEL_ID));
    this.registry.set(REGISTRY_SETTINGS, settings);
    this.sound.mute = !settings.settings.soundEnabled;

    // ทางลัดสำหรับนักพัฒนา/การทดสอบ: ?level=<id> เข้าด่านทันที (เล่นต่อ), ?new=1 เริ่มด่านใหม่
    const params = new URLSearchParams(window.location.search);
    if (params.has('level') || params.has('new')) {
      const levelId = params.get('level') ?? DEFAULT_LEVEL_ID;
      if (!startLevel(this, levelId, params.has('new') ? 'fresh' : 'resume')) goToWorldMap(this);
      return;
    }
    // ด่านที่ยังไม่มีเนื้อหาจะเข้าไม่ได้ทุกทาง (ตรวจซ้ำที่นี่เผื่อ DEFAULT_LEVEL_ID ถูกแก้ผิด)
    if (!isPlayableLevel(DEFAULT_LEVEL_ID)) console.warn('ด่านเริ่มต้นยังไม่มีเนื้อหา');
    goToMainMenu(this);
  }
}
