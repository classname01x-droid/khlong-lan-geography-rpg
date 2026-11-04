import Phaser from 'phaser';
import { DEFAULT_LEVEL_ID, getLevel } from '../content/registry';
import { validateLevel } from '../content/validateLevel';
import { createCharacterAnimations, generatePlaceholderTextures } from '../graphics/PlaceholderTextures';
import { REGISTRY_LEVEL_ID } from './events';

/** เตรียมทรัพยากร (ตอนนี้สร้างภาพ placeholder ด้วยโค้ด) แล้วเริ่มด่าน */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    generatePlaceholderTextures(this);
    createCharacterAnimations(this);

    const levelId = new URLSearchParams(window.location.search).get('level') ?? DEFAULT_LEVEL_ID;
    const level = getLevel(levelId);
    if (import.meta.env.DEV) {
      const problems = validateLevel(level);
      if (problems.length > 0) console.warn(`[level:${level.id}] พบปัญหาเนื้อหาด่าน`, problems);
    }

    this.registry.set(REGISTRY_LEVEL_ID, level.id);
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }
}
