import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { characterTextureKey } from '../graphics/PlaceholderTextures';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { getProgress, goToMainMenu, SCENE } from './navigation';
import { Btn, gradientBg, PAL, panel, pauseWhenHidden, sparkle, txt } from './rpg/kit';

const CROC_LINE = 'ขอบใจเจ้าที่ช่วยปลดปล่อยข้า ข้าจะกลับมาปกป้องผืนป่าและสายน้ำคลองลานอีกครั้ง';
export const ENDING_TITLE = 'ภารกิจสำเร็จ — คลองลานกลับมาสงบสุข';
export const ENDING_SUMMARY = 'เจ้าช่วยปลดปล่อยผู้พิทักษ์ได้สำเร็จ การดูแลป่าและสายน้ำเป็นหน้าที่ของทุกคน';

/**
 * ฉากจบ (หลังชนะพญาจระเข้) — เข้าได้เฉพาะเมื่อชนะบอสแล้ว
 * ภาพพื้นหลังจากภาพที่ผู้ใช้เตรียมไว้ (ตัดส่วนกล่องข้อความที่ติดมากับภาพออก — public/rpg/ending.jpg)
 * ภาพนิ่ง → ใช้ม่วงจางหาย · แสงทอง · ประกายระยิบ · ภาพ "หายใจ" ช้า ๆ (ศีรษะพญาจระเข้ขยับสงบ)
 * ชาวบ้านเฮ = สไปรต์ placeholder ของเกม (กระโดดสลับ) เพราะภาพต้นฉบับไม่มีสไปรต์แยกตัว
 */
export class EndingScene extends Phaser.Scene {
  private line!: Phaser.GameObjects.Text;
  private typed = 0;
  private revealed = false;

  constructor() {
    super(SCENE.ending);
  }

  preload(): void {
    if (!this.textures.exists('ending-bg')) this.load.image('ending-bg', 'rpg/ending.jpg');
  }

  create(): void {
    if (!getProgress(this).rpg.bossDone) {
      // ยังไม่ชนะบอส: ห้ามเข้าฉากจบ
      this.time.delayedCall(0, () => goToMainMenu(this));
      return;
    }
    this.typed = 0;
    this.revealed = false;
    gradientBg(this, 0x1a1030, 0x0a0a18);
    const img = this.add.image(GAME_WIDTH / 2, 0, 'ending-bg');
    img.setScale(GAME_WIDTH / img.width).setY((img.height * img.scaleY) / 2);
    this.tweens.add({ targets: img, scale: img.scaleX * 1.015, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // มลพิษสีม่วงจางหายไป
    const purple = this.add.rectangle(0, 0, GAME_WIDTH, 400, 0x7b3fb5, 0.5).setOrigin(0).setDepth(4);
    this.tweens.add({ targets: purple, alpha: 0, duration: 3600, ease: 'Sine.easeOut' });
    // แสงทองจากด้านบน (ลำแสง 5 แฉกหมุนช้า)
    const rays = this.add.graphics({ x: 585, y: 0 }).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 5; i++) {
      const a = 0.9 + i * 0.35;
      rays.fillStyle(0xffe9a0, 0.1).fillTriangle(0, 0, Math.cos(a - 0.09) * 520, Math.sin(a - 0.09) * 520, Math.cos(a + 0.09) * 520, Math.sin(a + 0.09) * 520);
    }
    rays.setAlpha(0);
    this.tweens.add({ targets: rays, alpha: 1, duration: 2800 });
    this.tweens.add({ targets: rays, angle: 8, duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // ประกายระยิบ (10 ชิ้น วนซ้ำ)
    for (let i = 0; i < 10; i++) {
      const s = this.add.rectangle(430 + Math.random() * 480, 40 + Math.random() * 260, 7, 7, 0xfff3a8, 0).setDepth(6).setRotation(0.78);
      this.tweens.add({ targets: s, alpha: { from: 0, to: 1 }, scale: { from: 0.4, to: 1.5 }, duration: 900, yoyo: true, repeat: -1, delay: Math.random() * 2500, repeatDelay: Math.random() * 1500 });
    }
    // ชาวบ้านเฮ (สไปรต์ placeholder กระโดดสลับกัน)
    (['student', 'villager', 'teacher', 'headman', 'villager'] as const).forEach((who, i) => {
      const c = this.add.image(60 + i * 62, 358, characterTextureKey(who), 'down-0').setScale(4).setDepth(7);
      this.tweens.add({ targets: c, y: 340, duration: 260, yoyo: true, repeat: -1, delay: i * 120, repeatDelay: 220, ease: 'Sine.easeOut' });
    });

    // กล่องข้อความ
    panel(this, 14, 372, GAME_WIDTH - 28, 254, 0.93).setDepth(10);
    txt(this, 34, 380, 'พญาจระเข้ ผู้พิทักษ์คลองลาน', 22, PAL.gold).setDepth(11);
    this.line = txt(this, 34, 412, '', 24, PAL.white, { lineSpacing: 6 }).setDepth(11);
    this.input.on('pointerdown', () => this.revealNow());
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'Enter') this.revealed ? this.toMenu() : this.revealNow();
    });
    this.time.addEvent({ delay: 55, repeat: CROC_LINE.length, callback: () => this.typeStep() });
    pauseWhenHidden(this);
    sparkle(this, 640, 170, 0xffe9a0, 10, 140, 8);
    (window as unknown as { __ENDING_SCENE__?: EndingScene }).__ENDING_SCENE__ = this;
  }

  private typeStep(): void {
    if (this.revealed) return;
    this.typed++;
    this.line.setText(wrapThaiText(CROC_LINE.slice(0, this.typed), GAME_WIDTH - 80, `24px ${FONT_FAMILY}`));
    if (this.typed >= CROC_LINE.length) this.showResult();
  }

  private revealNow(): void {
    if (this.revealed) return;
    this.typed = CROC_LINE.length;
    this.line.setText(wrapThaiText(CROC_LINE, GAME_WIDTH - 80, `24px ${FONT_FAMILY}`));
    this.showResult();
  }

  /** ข้อความภารกิจสำเร็จ + ปุ่มกลับหน้าหลัก */
  private showResult(): void {
    if (this.revealed) return;
    this.revealed = true;
    const t = txt(this, GAME_WIDTH / 2, 506, ENDING_TITLE, 32, PAL.gold).setOrigin(0.5).setDepth(11).setAlpha(0).setWordWrapWidth(GAME_WIDTH - 60, true);
    const s = txt(this, GAME_WIDTH / 2, 532, wrapThaiText(ENDING_SUMMARY, GAME_WIDTH - 80, `20px ${FONT_FAMILY}`), 20, PAL.soft).setOrigin(0.5, 0).setDepth(11).setAlpha(0).setAlign('center');
    this.tweens.add({ targets: [t, s], alpha: 1, duration: 500 });
    const b = new Btn(this, GAME_WIDTH / 2 - 170, 568, 340, 54, 'กลับหน้าหลัก', () => this.toMenu(), { fill: PAL.good, size: 28 });
    b.setDepth(12).setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 500, delay: 400 });
    sparkle(this, GAME_WIDTH / 2, 506, 0xffd84d, 12, 160, 12);
    void GAME_HEIGHT;
  }

  toMenu(): void {
    goToMainMenu(this);
  }

  toJourney(): void {
    goToMainMenu(this);
  }
}
