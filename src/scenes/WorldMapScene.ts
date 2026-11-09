import Phaser from 'phaser';
import { CHAPTERS } from '../content/story/chapters';
import { chapterStates } from '../core/campaign/Campaign';
import { drawWorldMapArt } from '../graphics/MenuArt';
import { journeyView } from '../ui/views/screens';
import { JOURNEY_LAYOUT } from './journeyLayout';
import { continueStory, getProgress, goToMainMenu, SCENE } from './navigation';

/**
 * แผนที่การเดินทาง — ภาพฉากหลังเท่านั้น · ปุ่ม/ข้อความทั้งหมดเป็น DOM (ui/touch/TouchScreens.ts) ใช้ร่วมทุกอุปกรณ์
 * ไม่ใช่หน้าเลือกด่านอิสระ: มีปุ่มเดียว "เดินทางต่อ" ที่พาไปภารกิจหลักปัจจุบัน
 */
export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super(SCENE.worldMap);
  }

  create(): void {
    const states = chapterStates(CHAPTERS, getProgress(this).data);
    drawWorldMapArt(
      this,
      JOURNEY_LAYOUT.map((l, i) => ({ ...l.region, icon: l.icon, locked: states[CHAPTERS[i].id] === 'locked' || states[CHAPTERS[i].id] === 'next' })),
    );
  }

  /** ปุ่มหลักปุ่มเดียว: ไปภารกิจหลักปัจจุบัน (เล่นต่อ / เริ่มบท) */
  go(): void {
    if (!journeyView(getProgress(this).data).primary.enabled) return;
    continueStory(this);
  }

  backToMenu(): void {
    goToMainMenu(this);
  }
}
