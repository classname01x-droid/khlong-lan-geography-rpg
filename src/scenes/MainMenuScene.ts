import Phaser from 'phaser';
import { drawMenuBackground } from '../graphics/MenuArt';
import { continueStory, getProgress, getSettings, goToWorldMap, SCENE } from './navigation';

/**
 * หน้าเมนูหลัก — ภาพฉากหลังเท่านั้น · หัวเกม ปุ่ม วิธีเล่น ตั้งค่า เป็น DOM (ui/touch/TouchScreens.ts) ใช้ร่วมทุกอุปกรณ์
 * คำสั่งด้านล่างถูกเรียกจากปุ่ม DOM
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE.menu);
  }

  create(): void {
    drawMenuBackground(this);
  }

    hasSave(): boolean {
    return getProgress(this).hasAnySave();
  }

  /** เริ่มบทที่ 1 — ถ้ามีบันทึก ต้องผ่านการยืนยันก่อน (confirmed = true) */
  startNewGame(confirmed: boolean): boolean {
    const progress = getProgress(this);
    if (progress.hasAnySave() && !confirmed) return false;
    if (progress.hasAnySave()) progress.resetAll();
    // เกมใหม่: Intro ตำนานพญาจระเข้ 3 ฉาก → บทที่ 1 (IntroScene เรียก beginChapter เอง)
    this.scene.start(SCENE.intro);
    return true;
  }

  openJourney(): void {
    goToWorldMap(this);
  }

  toggleSound(): boolean {
    const settings = getSettings(this);
    settings.update({ soundEnabled: !settings.settings.soundEnabled });
    this.sound.mute = !settings.settings.soundEnabled;
    return settings.settings.soundEnabled;
  }

  toggleControlsHint(): boolean {
    const settings = getSettings(this);
    settings.update({ showControlsHint: !settings.settings.showControlsHint });
    return settings.settings.showControlsHint;
  }

  /** เล่นต่อ: กลับไปภารกิจหลักล่าสุด (ตำแหน่งและสถานะเดิม) */
  continueGame(): void {
    if (!getProgress(this).hasAnySave()) return;
    continueStory(this);
  }
}
