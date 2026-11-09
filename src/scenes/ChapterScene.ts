import Phaser from 'phaser';
import { CHAPTERS, getChapter, getChapterIntro, type ChapterIntro } from '../content/story/chapters';
import { chapterStates, currentChapter, type ChapterSlot } from '../core/campaign/Campaign';
import { drawWorldMapArt } from '../graphics/MenuArt';
import { FINALE_POINT, JOURNEY_LAYOUT } from './journeyLayout';
import { getProgress, goToWorldMap, SCENE, startLevel, type ChapterStartData } from './navigation';

/** เวลาขั้นต่ำระหว่างบรรทัด (มิลลิวินาที) — แตะรัวจนข้ามบทไม่ได้ */
export const MIN_LINE_MS = 350;

/**
 * ฉากเชื่อมเรื่องระหว่างตำบล (Chapter Transition) — บทสนทนามาจากข้อมูล (content/story/chapters.ts)
 * ฉากนี้วาดเฉพาะแผนที่การเดินทางและเส้นทางที่เดินทางไป · ชื่อบท เป้าหมาย บทสนทนา ปุ่ม เป็น DOM (ui/touch/TouchScreens.ts) ใช้ร่วมทุกอุปกรณ์
 * เปิดได้เฉพาะบทปัจจุบันของภารกิจหลัก · บทที่ยังไม่มีเนื้อหา → "ภารกิจถัดไปอยู่ระหว่างพัฒนา"
 */
export class ChapterScene extends Phaser.Scene {
  private chapter!: ChapterSlot;
  private intro!: ChapterIntro;
  private lineIndex = 0;
  /** เวลาที่เปลี่ยนบรรทัดล่าสุด — กันแตะรัวจนข้ามบท */
  private lineShownAt = 0;
  /** สถานะ (ใช้โดยหน้าจอ DOM และการทดสอบ) */
  stage: 'dialogue' | 'ready' | 'in-development' = 'dialogue';

  constructor() {
    super(SCENE.chapter);
  }

  create(data?: Partial<ChapterStartData>): void {
    const progress = getProgress(this).data;
    const chapter = data?.chapterId ? getChapter(data.chapterId) : undefined;
    const intro = data?.chapterId ? getChapterIntro(data.chapterId) : undefined;
    // กันการเปิดบทที่ไม่ใช่บทปัจจุบัน (ข้ามบท/ย้อนบท)
    if (!chapter || !intro || currentChapter(CHAPTERS, progress).id !== chapter.id) {
      this.time.delayedCall(0, () => goToWorldMap(this));
      return;
    }
    this.chapter = chapter;
    this.intro = intro;
    this.lineIndex = 0;
    this.stage = 'dialogue';
    this.lineShownAt = this.time.now;

    // ---- แผนที่การเดินทาง + เส้นทางจากตำบลเดิมไปตำบลใหม่ ----
    const states = chapterStates(CHAPTERS, progress);
    drawWorldMapArt(
      this,
      JOURNEY_LAYOUT.map((l, i) => ({ ...l.region, icon: l.icon, locked: states[CHAPTERS[i].id] === 'locked' || states[CHAPTERS[i].id] === 'next' })),
    );
    const point = (id: string | null) => {
      const i = CHAPTERS.findIndex((c) => c.id === id);
      return i >= 0 && i < JOURNEY_LAYOUT.length ? JOURNEY_LAYOUT[i].region : FINALE_POINT;
    };
    const to = point(chapter.id);
    const from = intro.fromChapterId ? point(intro.fromChapterId) : { x: to.x, y: to.y - 120 };
    const g = this.add.graphics();
    g.fillStyle(0xb8402a, 1);
    const steps = 18;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      g.fillRect(from.x + (to.x - from.x) * t - 3, from.y + (to.y - from.y) * t - 3, 6, 6);
    }
    const marker = this.add.container(from.x, from.y, [
      this.add.rectangle(0, 0, 18, 18, 0xffd84d).setStrokeStyle(3, 0x2a1a0c),
      this.add.rectangle(0, -14, 4, 10, 0x2a1a0c),
    ]);
    this.tweens.add({ targets: marker, x: to.x, y: to.y, duration: 1600, ease: 'Sine.easeInOut' });
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => this.onKey(ev.code));
    this.installTestHooks();
  }

  private onKey(code: string): void {
    if (code === 'Escape') {
      goToWorldMap(this);
      return;
    }
    if (code !== 'Space' && code !== 'Enter' && code !== 'NumpadEnter' && code !== 'KeyE') return;
    this.advance(false);
  }

  /* ---------- คำสั่งที่หน้าจอสัมผัสเรียกใช้ (ตรรกะเดียวกับคีย์บอร์ด) ---------- */

  /**
   * อ่านบรรทัดถัดไป / จบบทสนทนา
   * @param guard แตะ/คลิก: ไม่รับคำสั่งที่มาเร็วเกินไป (กันแตะรัวจนข้ามบทสนทนาโดยไม่ตั้งใจ) · คีย์บอร์ดกดทีละครั้งอยู่แล้ว
   */
  advance(guard = true): boolean {
    if (this.stage !== 'dialogue' || (guard && this.time.now - this.lineShownAt < MIN_LINE_MS)) return false;
    if (this.lineIndex < this.intro.lines.length - 1) {
      this.lineIndex++;
      this.lineShownAt = this.time.now;
      return true;
    }
    this.finishDialogue();
    return true;
  }

  /** ย้อนอ่านบรรทัดก่อนหน้า (จอสัมผัส) */
  back(): void {
    if (this.stage !== 'dialogue' || this.lineIndex === 0) return;
    this.lineIndex--;
    this.lineShownAt = this.time.now;
  }

  /** ข้อมูลสำหรับหน้าจอสัมผัส */
  get touchState(): { chapterId: string; lineIndex: number; total: number; stage: ChapterScene['stage']; readyAt: number } {
    return { chapterId: this.chapter.id, lineIndex: this.lineIndex, total: this.intro.lines.length, stage: this.stage, readyAt: this.lineShownAt };
  }

  toJourney(): void {
    goToWorldMap(this);
  }

  /** จบบทสนทนา: บทที่มีเนื้อหา → พร้อมออกเดินทาง · ยังไม่มีเนื้อหา → อยู่ระหว่างพัฒนา */
  private finishDialogue(): void {
    const playable = this.chapter.playable && !!this.chapter.levelId;
    this.stage = playable ? 'ready' : 'in-development';
    this.lineShownAt = this.time.now;
  }

  depart(): void {
    if (this.stage === 'ready' && this.chapter.levelId && startLevel(this, this.chapter.levelId, 'fresh')) return;
    goToWorldMap(this);
  }

  private installTestHooks(): void {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __CHAPTER__: unknown }).__CHAPTER__ = this;
  }
}

