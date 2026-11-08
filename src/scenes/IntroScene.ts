import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CHAPTERS, INTRO_FICTION_NOTE, INTRO_SCENES } from '../content/story/chapters';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { beginChapter, SCENE } from './navigation';

/** เวลาขั้นต่ำก่อนแตะไปฉากถัดไปได้ (กันแตะรัวจนข้ามเรื่อง) */
const MIN_SCENE_MS = 400;
const TEXT_X = 420;
const TEXT_W = 510;

/**
 * Intro ตำนานพญาจระเข้ผู้พิทักษ์คลองลาน (3 ฉาก) — แสดงเมื่อเริ่มเกมใหม่ แล้วเข้าสู่บทที่ 1 ตามเดิม
 * แตะ/คลิกที่ใดก็ได้ หรือ Space/Enter = ไปต่อ · ปุ่ม "ข้าม" หรือ Esc = เข้าเกมทันที
 * ภาพอยู่ใน public/intro/ (โหลดเฉพาะตอนเปิดฉากนี้) · ข้อความมาจากข้อมูล (content/story/chapters.ts)
 */
export class IntroScene extends Phaser.Scene {
  index = 0;
  private shownAt = 0;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super(SCENE.intro);
  }

  preload(): void {
    INTRO_SCENES.forEach((s, i) => this.load.image(`intro-${i + 1}`, s.image));
  }

  create(): void {
    this.index = 0;
    this.layer = this.add.container(0, 0);
    // ปุ่มข้าม (มุมขวาบน) — ทำงานก่อน "แตะเพื่อไปต่อ"
    const skip = this.add
      .text(GAME_WIDTH - 16, 14, 'ข้าม ▶▶', this.style(20, '#f3ead2'))
      .setOrigin(1, 0)
      .setDepth(10)
      .setPadding(10, 6, 10, 6)
      .setBackgroundColor('#00000088')
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', (_p: unknown, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.finish();
    });
    this.input.on('pointerdown', () => this.next());
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'Enter') this.next();
      else if (ev.code === 'Escape') this.finish();
    });
    (window as unknown as { __INTRO__?: IntroScene }).__INTRO__ = this;
    this.show();
  }

  private style(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, stroke: '#10141f', strokeThickness: 4, lineSpacing: 8 };
  }

  private show(): void {
    const scene = INTRO_SCENES[this.index];
    const key = `intro-${this.index + 1}`;
    this.layer.removeAll(true);
    this.shownAt = this.time.now;
    // พื้นหลัง: ภาพเดียวกันขยายเต็มจอแล้วหรี่ลง · ภาพเต็มอยู่ด้านซ้าย (ภาพแนวตั้ง)
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key);
    bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height));
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.72).setOrigin(0);
    const pic = this.add.image(200, GAME_HEIGHT / 2, key);
    pic.setScale(GAME_HEIGHT / pic.height);
    const step = this.add.text(TEXT_X, 40, `ตำนานพญาจระเข้ผู้พิทักษ์คลองลาน · ${this.index + 1}/${INTRO_SCENES.length}`, this.style(18, '#ffd84d'));
    const title = this.add.text(TEXT_X, 76, scene.title, this.style(30, '#ffffff'));
    const body = this.add.text(TEXT_X, 136, wrapThaiText(scene.text, TEXT_W, `24px ${FONT_FAMILY}`), this.style(24, '#f3ead2'));
    const last = this.index === INTRO_SCENES.length - 1;
    const note = this.add.text(TEXT_X, GAME_HEIGHT - 128, wrapThaiText(INTRO_FICTION_NOTE, TEXT_W, `15px ${FONT_FAMILY}`), this.style(15, '#c9bfa6'));
    const btn = this.add
      .text(GAME_WIDTH - 30, GAME_HEIGHT - 30, last ? 'เริ่มการผจญภัย ▶' : 'แตะเพื่อไปต่อ ▼', this.style(last ? 26 : 22, last ? '#2b2118' : '#ffffff'))
      .setOrigin(1, 1)
      .setPadding(16, 10, 16, 10);
    if (last) btn.setBackgroundColor('#ffd84d').setStroke('#ffd84d', 0);
    this.layer.add([bg, dim, pic, step, title, body, note, btn]);
  }

  /** ฉากถัดไป — ฉากสุดท้ายแล้วเข้าเกม */
  next(): void {
    if (this.time.now - this.shownAt < MIN_SCENE_MS) return;
    if (this.index < INTRO_SCENES.length - 1) {
      this.index++;
      this.show();
    } else this.finish();
  }

  finish(): void {
    beginChapter(this, CHAPTERS[0].id);
  }
}
