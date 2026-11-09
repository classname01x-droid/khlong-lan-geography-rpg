import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CHAPTERS } from '../content/story/chapters';
import { GOLDEN_QUESTIONS } from '../content/rpg/goldenQuestions';
import { GoldenTime, GOLDEN_COINS_PER_ANSWER, GOLDEN_HEARTS } from '../core/rpg/GoldenTime';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { beginChapter, getProgress, SCENE } from './navigation';
import { Btn, drawCoin, drawHeart, floatText, gradientBg, pauseWhenHidden, PAL, panel, sparkle, txt } from './rpg/kit';

const LETTERS = ['A', 'B', 'C'];
const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Golden Time — ก่อนด่านแรกของเกมใหม่ (ครั้งเดียว) ตอบคำถามภูมิศาสตร์ 5 นาที
 * HUD เท่านั้น: นับถอยหลัง · หัวใจ 3 ดวง · เหรียญ · คำถาม · ปุ่ม A/B/C
 * ตอบถูก +100 เหรียญ · ตอบผิดเสียหัวใจ (ไม่เสียเงิน) · หัวใจหมด/หมดเวลา → สรุปเหรียญแล้วกลับไปเล่นด่าน (ไม่มี Game Over)
 * ตรรกะอยู่ที่ core/rpg/GoldenTime.ts
 */
export class GoldenTimeScene extends Phaser.Scene {
  golden!: GoldenTime;
  private timerText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private heartGfx!: Phaser.GameObjects.Graphics;
  private heartsBox!: Phaser.GameObjects.Container;
  private qText!: Phaser.GameObjects.Text;
  private qCount!: Phaser.GameObjects.Text;
  private buttons: Btn[] = [];
  private locked = false;
  private finished = false;
  private lowShown = false;
  private shownCoins = 0;

  constructor() {
    super(SCENE.golden);
  }

  create(): void {
    this.golden = new GoldenTime(GOLDEN_QUESTIONS);
    this.locked = false;
    this.finished = false;
    this.lowShown = false;
    this.shownCoins = 0;
    this.left = false;
    this.buttons = [];
    gradientBg(this, 0x13233f, 0x0a1020);
    this.drawDrift();
    this.buildHud();
    this.qText = txt(this, GAME_WIDTH / 2, 235, '', 34).setOrigin(0.5).setAlign('center');
    this.qCount = txt(this, GAME_WIDTH / 2, 160, '', 20, PAL.soft).setOrigin(0.5);
    panel(this, 60, 176, GAME_WIDTH - 120, 128, 0.6).setDepth(-1);
    [0, 1, 2].forEach((i) => {
      const b = new Btn(this, 90, 330 + i * 94, GAME_WIDTH - 180, 80, '', () => this.pick(i), { size: 30, fill: 0x274a8a });
      this.buttons.push(b);
    });
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const k = ['Digit1', 'Digit2', 'Digit3', 'KeyA', 'KeyB', 'KeyC'].indexOf(ev.code);
      if (k >= 0) this.pick(k % 3);
    });
    pauseWhenHidden(this);
    (window as unknown as { __GOLDEN__?: GoldenTimeScene }).__GOLDEN__ = this;
    this.showQuestion();
  }

  /** ประกายทองลอยช้า ๆ เบื้องหลัง (12 ชิ้น) */
  private drawDrift(): void {
    for (let i = 0; i < 12; i++) {
      const s = this.add.rectangle(Math.random() * GAME_WIDTH, GAME_HEIGHT + 10, 6, 6, 0xffd84d, 0.5);
      this.tweens.add({ targets: s, y: -20, x: s.x + (Math.random() - 0.5) * 80, alpha: 0.05, duration: 7000 + Math.random() * 5000, delay: Math.random() * 6000, repeat: -1 });
    }
  }

  private buildHud(): void {
    panel(this, 14, 18, 3 * 62 + 24, 62, 0.8);
    this.heartGfx = this.add.graphics();
    this.heartsBox = this.add.container(0, 0, [this.heartGfx]);
    this.drawHearts();
    // เวลา (กลาง)
    panel(this, GAME_WIDTH / 2 - 110, 14, 220, 70, 0.8);
    this.timerText = txt(this, GAME_WIDTH / 2, 49, fmt(this.golden.timeLeftMs), 50, PAL.white).setOrigin(0.5);
    // เหรียญ (ขวา)
    panel(this, GAME_WIDTH - 230, 18, 212, 62, 0.8);
    const g = this.add.graphics();
    drawCoin(g, GAME_WIDTH - 200, 49, 18);
    this.coinText = txt(this, GAME_WIDTH - 170, 49, '0', 38, PAL.gold).setOrigin(0, 0.5);
    void g;
  }

  private drawHearts(): void {
    this.heartGfx.clear();
    for (let i = 0; i < GOLDEN_HEARTS; i++) drawHeart(this.heartGfx, 30 + i * 62, 30, 6, i < this.golden.hearts);
  }

  override update(_t: number, dt: number): void {
    if (this.finished) return;
    if (!this.finished) this.golden.tick(dt);
    this.timerText.setText(fmt(this.golden.timeLeftMs));
    if (this.golden.lowTime) {
      this.timerText.setColor('#ff5a5a');
      if (!this.lowShown) {
        this.lowShown = true;
        this.tweens.add({ targets: this.timerText, scale: 1.25, duration: 220, yoyo: true, repeat: 2 });
      }
      // เต้นเบา ๆ ทุกวินาทีเมื่อเหลือน้อย
      const frac = (this.golden.timeLeftMs % 1000) / 1000;
      this.timerText.setScale(1 + (frac > 0.85 ? 0.08 : 0));
    }
    if (this.golden.over) this.finish();
  }

  private showQuestion(): void {
    const q = this.golden.current;
    if (!q) return this.finish();
    this.locked = false;
    this.qCount.setText(`ข้อที่ ${this.golden.answered + 1}`);
    this.qText.setText(wrapThaiText(q.q, GAME_WIDTH - 180, `34px ${FONT_FAMILY}`));
    this.buttons.forEach((b, i) => {
      b.setText(`${LETTERS[i]}.  ${q.choices[i]}`).setFill(0x274a8a).setEnabled(true).setScale(1);
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 160, delay: i * 50 });
    });
  }

  /** ตอบข้อปัจจุบัน — ผลทันที ไม่มีคำอธิบายยาว */
  pick(i: number): void {
    if (this.locked || this.finished) return;
    const r = this.golden.answer(i);
    if (!r) return;
    this.locked = true;
    this.buttons[i].setFill(r.correct ? PAL.good : PAL.bad);
    if (!r.correct) this.buttons[r.correctIndex].setFill(PAL.good);
    if (r.correct) {
      floatText(this, GAME_WIDTH - 130, 110, `+${GOLDEN_COINS_PER_ANSWER}`, PAL.gold);
      sparkle(this, GAME_WIDTH - 200, 49, 0xffd84d, 8, 50);
      this.tweens.addCounter({
        from: this.shownCoins,
        to: this.golden.coins,
        duration: 350,
        onUpdate: (t) => this.coinText.setText(String(Math.round(t.getValue() ?? 0))),
      });
      this.shownCoins = this.golden.coins;
      this.tweens.add({ targets: this.coinText, scale: 1.3, duration: 120, yoyo: true });
    } else {
      this.drawHearts();
      // หัวใจสั่นเมื่อตอบผิด
      this.tweens.add({ targets: this.heartsBox, x: 8, duration: 45, yoyo: true, repeat: 4, onComplete: () => this.heartsBox.setX(0) });
      this.cameras.main.shake(180, 0.004);
      floatText(this, 110, 110, '−1', '#ff6b6b');
    }
    this.time.delayedCall(r.correct ? 650 : 900, () => {
      if (this.finished) return;
      this.golden.next();
      if (this.golden.over) this.finish();
      else this.showQuestion();
    });
  }

  /** จบ Golden Time (หัวใจหมด · หมดเวลา · คำถามหมดคลัง) → สรุปเหรียญ แล้วกลับไปเล่นด่านแรก */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.locked = true;
    getProgress(this).finishGolden(this.golden.coins);
    const why = { hearts: 'หัวใจหมดแล้ว', time: 'หมดเวลา', bank: 'ตอบครบทุกข้อแล้ว', null: '' }[String(this.golden.over) as 'hearts'];
    this.buttons.forEach((b) => b.setVisible(false));
    this.qText.setVisible(false);
    this.qCount.setVisible(false);
    const box = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
    const g = panel(this, -300, -170, 600, 340, 0.95);
    const title = txt(this, 0, -130, 'Golden Time จบแล้ว', 38, PAL.gold).setOrigin(0.5);
    const why2 = txt(this, 0, -80, why, 26, PAL.soft).setOrigin(0.5);
    const coins = txt(this, 0, -10, `ได้เหรียญ ${this.golden.coins}`, 54, PAL.gold).setOrigin(0.5);
    const stat = txt(this, 0, 50, `ตอบถูก ${this.golden.right} จาก ${this.golden.answered} ข้อ`, 24, PAL.soft).setOrigin(0.5);
    box.add([g, title, why2, coins, stat]);
    box.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    sparkle(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 0xffd84d, 12, 120);
    const go = new Btn(this, GAME_WIDTH / 2 - 190, GAME_HEIGHT / 2 + 110, 380, 72, 'ไปเล่นต่อ ▶', () => this.leave(), { fill: PAL.good, size: 30 });
    go.setDepth(20);
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Enter' || ev.code === 'Space') this.leave();
    });
  }

  private left = false;
  leave(): void {
    if (this.left) return;
    this.left = true;
    beginChapter(this, CHAPTERS[0].id);
  }
}
