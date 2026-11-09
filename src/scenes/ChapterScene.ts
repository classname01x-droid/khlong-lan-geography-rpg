import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import { CHAPTERS, getChapter, getChapterIntro, LEGEND_NOTE, type ChapterIntro } from '../content/story/chapters';
import { chapterStates, currentChapter, IN_DEVELOPMENT_MESSAGE, type ChapterSlot } from '../core/campaign/Campaign';
import { drawWorldMapArt } from '../graphics/MenuArt';
import { MenuNavigator } from '../ui/pixel/MenuNavigator';
import { PixelButton } from '../ui/pixel/PixelButton';
import { drawPixelFrame } from '../ui/pixel/PixelFrame';
import { PIXEL } from '../ui/pixel/theme';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { FINALE_POINT, JOURNEY_LAYOUT } from './journeyLayout';
import { REGISTRY_TOUCH_UI } from './events';
import { getProgress, goToWorldMap, SCENE, startLevel, type ChapterStartData } from './navigation';

/** เวลาขั้นต่ำระหว่างบรรทัด (มิลลิวินาที) — แตะรัวจะไม่ข้ามบทสนทนา */
export const MIN_LINE_MS = 350;

// อยู่ระหว่างพื้นที่ตำบลซ้าย–ขวา (x 184–776) เพื่อไม่บังเส้นทางเดินทาง
const PANEL = { x: 196, y: 330, w: 568, h: 280 } as const;

/**
 * ฉากเชื่อมเรื่องระหว่างตำบล (Chapter Transition) — บทสนทนามาจากข้อมูล (content/story/chapters.ts)
 * แสดงการเดินทางบนแผนที่การเดินทาง แล้วพาเข้าสู่พื้นที่ของบทใหม่
 * เปิดได้เฉพาะบทปัจจุบันของภารกิจหลัก · บทที่ยังไม่มีเนื้อหาจะไม่ถูกเปิด (แสดง "ภารกิจถัดไปอยู่ระหว่างพัฒนา")
 */
export class ChapterScene extends Phaser.Scene {
  private chapter!: ChapterSlot;
  private intro!: ChapterIntro;
  private lineIndex = 0;
  private speaker!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private nav: MenuNavigator | null = null;
  private touchUi = false;
  /** เวลาที่เปลี่ยนบรรทัดล่าสุด — กันแตะรัวจนข้ามบทสนทนาโดยไม่ตั้งใจ */
  private lineShownAt = 0;
  /** สถานะ (ใช้โดยหน้าจอสัมผัสและการทดสอบ) */
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
    this.nav = null;
    this.stage = 'dialogue';
    this.touchUi = this.registry.get(REGISTRY_TOUCH_UI) === true;
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
    // จอสัมผัส: ชื่อบท เป้าหมายภารกิจใหม่ บทสนทนา และปุ่ม เป็น DOM ตัวอักษรใหญ่ (TouchScreens) — canvas แสดงเส้นทางเดินทาง
    if (this.touchUi) return;

    // ---- ป้ายบท ----
    const banner = this.add.graphics();
    drawPixelFrame(banner, 180, 20, 600, 92, 'wood');
    this.add
      .text(GAME_WIDTH / 2, 30, `${intro.heading} · ${chapter.tambon}`, this.style(28, PIXEL.light, true))
      .setOrigin(0.5, 0);
    this.add.text(GAME_WIDTH / 2, 72, chapter.title, this.style(18, '#f3ead2')).setOrigin(0.5, 0);

    this.add.text(GAME_WIDTH / 2, 116, LEGEND_NOTE, this.style(14, '#f3ead2', true)).setOrigin(0.5, 0);

    // ---- กล่องบทสนทนา ----
    const box = this.add.graphics();
    drawPixelFrame(box, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 'paper');
    this.speaker = this.add.text(PANEL.x + 28, PANEL.y + 20, '', this.style(19, PIXEL.warn));
    this.body = this.add.text(PANEL.x + 28, PANEL.y + 54, '', { ...this.style(19, PIXEL.ink), lineSpacing: 6 });
    this.hint = this.add
      .text(PANEL.x + PANEL.w - 24, PANEL.y + PANEL.h - 16, '', this.style(14, PIXEL.inkMuted))
      .setOrigin(1, 1);
    this.showLine();

    // เมาส์: คลิกที่ใดก็ได้เพื่ออ่านบรรทัดถัดไป (หลังอ่านจบใช้ปุ่ม "ออกเดินทาง")
    this.input.on('pointerdown', () => {
      if (this.stage === 'dialogue' && !this.nav) this.advance(true);
    });
  }

  private style(size: number, color: string, stroke = false): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      color,
      padding: { top: 6 },
      ...(stroke ? { stroke: '#2a1a0c', strokeThickness: 5 } : {}),
    };
  }

  private showLine(): void {
    this.lineShownAt = this.time.now;
    if (this.touchUi) return;
    const line = this.intro.lines[this.lineIndex];
    const text = line.text;
    this.speaker.setText(line.speaker);
    this.body.setText(wrapThaiText(text, PANEL.w - 56, `19px ${FONT_FAMILY}`));
    this.hint.setText(`${this.lineIndex + 1}/${this.intro.lines.length} · แตะหรือกด Space เพื่ออ่านต่อ`);
  }

  private onKey(code: string): void {
    if (code === 'Escape') {
      goToWorldMap(this);
      return;
    }
    if (this.nav) {
      this.nav.handleKey(code);
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
      this.showLine();
      return true;
    }
    this.finishDialogue();
    return true;
  }

  /** ย้อนอ่านบรรทัดก่อนหน้า (จอสัมผัส) */
  back(): void {
    if (this.stage !== 'dialogue' || this.lineIndex === 0) return;
    this.lineIndex--;
    this.showLine();
  }

  /** ข้อมูลสำหรับหน้าจอสัมผัส */
  get touchState(): { chapterId: string; lineIndex: number; total: number; stage: ChapterScene['stage']; readyAt: number } {
    return { chapterId: this.chapter.id, lineIndex: this.lineIndex, total: this.intro.lines.length, stage: this.stage, readyAt: this.lineShownAt };
  }

  toJourney(): void {
    goToWorldMap(this);
  }

  /** จบบทสนทนา: บทที่มีเนื้อหา → ปุ่มออกเดินทาง · ยังไม่มีเนื้อหา → แจ้งและกลับแผนที่การเดินทาง (ความคืบหน้าคงอยู่) */
  private finishDialogue(): void {
    const playable = this.chapter.playable && !!this.chapter.levelId;
    this.stage = playable ? 'ready' : 'in-development';
    this.lineShownAt = this.time.now;
    if (this.touchUi) return;
    this.speaker.setText(playable ? 'พร้อมออกเดินทาง' : IN_DEVELOPMENT_MESSAGE);
    this.body.setText(
      wrapThaiText(
        playable
          ? `${this.intro.heading}: ${this.chapter.tambon} — ${this.chapter.title}`
          : 'ความคืบหน้าทั้งหมดถูกบันทึกไว้แล้ว จะเล่นต่อได้เมื่อภารกิจนี้พัฒนาเสร็จ',
        PANEL.w - 56,
        `19px ${FONT_FAMILY}`,
      ),
    );
    this.hint.setText('');
    const label = playable ? `ออกเดินทางไป${this.chapter.tambon}` : 'กลับแผนที่การเดินทาง';
    const button = new PixelButton(this, GAME_WIDTH / 2 - 190, PANEL.y + PANEL.h - 72, label, {
      width: 380,
      height: 50,
      fontSize: 18,
      onClick: () => this.depart(),
    });
    this.nav = new MenuNavigator([button], () => goToWorldMap(this));
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

