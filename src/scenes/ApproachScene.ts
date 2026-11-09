import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { characterTextureKey } from '../graphics/PlaceholderTextures';
import { SCENE } from './navigation';
import { buildArena, EYE, IMG_TOP, loadArena, PLAYER_POINT } from './rpg/arena';
import { banner, Btn, PAL, pauseWhenHidden, txt } from './rpg/kit';

/**
 * ทางเข้าน้ำตก (ก่อนต่อสู้): หมอกน้ำตกบังพญาจระเข้ → จอมืดลง → ตาแดงเรืองขึ้น กล้องสั่น (เสียงคำราม — ยังไม่มีไฟล์เสียง) →
 * ข้อความ "พญาจระเข้ผู้พิทักษ์ปรากฏตัวแล้ว!" → ปุ่มเข้าสู่การต่อสู้
 * ภาพพื้นหลังเป็นภาพนิ่ง → ใช้ เลื่อนช้า ๆ / หมอก / ใบไม้ / ไล่สีมืด เท่านั้น (ไม่แยกส่วนภาพ)
 */
export class ApproachScene extends Phaser.Scene {
  private done = false;

  constructor() {
    super(SCENE.approach);
  }

  preload(): void {
    loadArena(this);
  }

  create(): void {
    this.done = false;
    const a = buildArena(this);
    // ก่อนปรากฏตัว: ซ่อนออร่า/ตาแดง ใช้หมอกบังฝั่งขวา (ที่พญาจระเข้อยู่)
    a.aura.setAlpha(0).setVisible(false);
    a.eye.setVisible(false);
    a.eyeGlow.setVisible(false);
    a.leaves.forEach((l) => l.setAlpha(0.8));
    const hero = this.add.image(PLAYER_POINT.x, PLAYER_POINT.y, characterTextureKey('student'), 'side-0').setScale(7).setDepth(5);
    this.tweens.add({ targets: hero, y: hero.y - 4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // กล้องเลื่อนเข้าหาช้า ๆ
    this.cameras.main.zoomTo(1.06, 5200, 'Sine.easeInOut');

    const fog = this.add.rectangle(GAME_WIDTH / 2 + 140, IMG_TOP + 230, 760, 340, 0xdfe9ec, 0.92).setDepth(8);
    const fogPuffs = [0, 1, 2, 3, 4].map((i) => {
      const p = this.add.ellipse(380 + i * 130, 220 + (i % 2) * 70, 260, 120, 0xeef4f6, 0.7).setDepth(9);
      this.tweens.add({ targets: p, x: p.x + 50, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return p;
    });
    const dark = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x07040f, 0).setOrigin(0).setDepth(20);
    const note = txt(this, GAME_WIDTH / 2, GAME_HEIGHT - 120, 'ลำน้ำเงียบผิดปกติ...', 28, PAL.soft).setOrigin(0.5).setDepth(30);
    pauseWhenHidden(this);

    // ฉากที่ 2 (หลัง 2.4 วินาที): หมอกจาง จอมืด ตาแดงเรือง กล้องสั่น
    this.time.delayedCall(2400, () => {
      this.tweens.add({ targets: [fog, ...fogPuffs], alpha: 0, duration: 1100 });
      this.tweens.add({ targets: dark, alpha: 0.5, duration: 1400 });
      this.tweens.add({ targets: note, alpha: 0, duration: 400 });
      this.time.delayedCall(700, () => {
        a.aura.setVisible(true);
        this.tweens.add({ targets: a.aura, alpha: 0.3, duration: 900 });
        a.eye.setVisible(true).setAlpha(0);
        a.eyeGlow.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: [a.eye, a.eyeGlow], alpha: 1, duration: 220, yoyo: true, repeat: 2, onComplete: () => [a.eye, a.eyeGlow].forEach((o) => o.setAlpha(1)) });
        // คำราม: กล้องสั่นเล็กน้อย (ยังไม่มีไฟล์เสียง — ผูกเสียงเมื่อมีไฟล์)
        this.cameras.main.shake(520, 0.006);
        this.time.delayedCall(420, () => {
          const b = banner(this, 'พญาจระเข้ผู้พิทักษ์ปรากฏตัวแล้ว!', 520, 36);
          b.setAlpha(0);
          this.tweens.add({ targets: b, alpha: 1, duration: 400 });
          const go = new Btn(this, GAME_WIDTH / 2 - 190, GAME_HEIGHT - 110, 380, 72, 'เข้าสู่การต่อสู้ ▶', () => this.go(), { fill: PAL.purple, size: 30 });
          go.setDepth(40).setAlpha(0);
          this.tweens.add({ targets: go, alpha: 1, duration: 400, delay: 500 });
          this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
            if (ev.code === 'Enter' || ev.code === 'Space') this.go();
          });
        });
      });
    });
    void EYE;
    (window as unknown as { __APPROACH__?: ApproachScene }).__APPROACH__ = this;
  }

  go(): void {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENE.boss));
  }
}
