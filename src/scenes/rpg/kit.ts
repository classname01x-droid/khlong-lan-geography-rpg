import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/constants';
import { FONT_FAMILY } from '../../ui/theme';

/**
 * ชุดเครื่องมือเล็ก ๆ สำหรับฉาก RPG (Golden Time · ร้านค้า · น้ำตก · ต่อสู้ · ฉากจบ)
 * ใช้ Phaser tween + วัตถุเรียบง่าย (ไม่มีวิดีโอ ไม่มีระบบอนุภาคหนัก) ให้ลื่นบนโทรศัพท์
 * ปุ่มทุกปุ่มสูง ≥ 56 หน่วยเกม (บนโทรศัพท์แนวนอน ≈ 34 px+) และใช้ได้ทั้งแตะ/เมาส์/คีย์บอร์ด
 */
export const PAL = {
  panel: 0x0f1a2b,
  panelEdge: 0xffd84d,
  gold: '#ffd84d',
  white: '#ffffff',
  soft: '#cfe0f5',
  good: 0x2f9e44,
  bad: 0xc0392b,
  blue: 0x2f6fd0,
  purple: 0x7b3fb5,
} as const;

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size: number,
  color: string = PAL.white,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    stroke: '#0a0f1a',
    strokeThickness: Math.max(2, Math.round(size / 9)),
    padding: { top: 4, bottom: 2 },
    ...extra,
  });
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.9): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(PAL.panel, alpha).fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(3, PAL.panelEdge, 0.95).strokeRoundedRect(x, y, w, h, 10);
  return g;
}

export interface BtnOptions {
  fill?: number;
  size?: number;
  /** ปุ่มกดได้อยู่ใน coordinates ของฉาก (x,y = มุมซ้ายบน) */
  hotkey?: string;
}

/** ปุ่มใหญ่สำหรับจอสัมผัส: กดแล้วย่อเล็กน้อย · ปิดใช้งานแล้วเป็นสีเทา */
export class Btn extends Phaser.GameObjects.Container {
  readonly bw: number;
  readonly bh: number;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly fill: number;
  private active_ = true;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, private readonly onTap: () => void, opts: BtnOptions = {}) {
    super(scene, x + w / 2, y + h / 2);
    this.bw = w;
    this.bh = h;
    this.fill = opts.fill ?? PAL.blue;
    this.bg = scene.add.graphics();
    this.label = txt(scene, 0, 0, text, opts.size ?? 26).setOrigin(0.5);
    this.label.setWordWrapWidth(w - 20, true);
    const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.tap());
    this.add([this.bg, this.label, zone]);
    scene.add.existing(this);
    this.draw(false);
  }

  private draw(hot: boolean): void {
    const c = this.active_ ? this.fill : 0x4a4f59;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.35).fillRoundedRect(-this.bw / 2 + 3, -this.bh / 2 + 5, this.bw, this.bh, 12);
    this.bg.fillStyle(c, 1).fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, 12);
    this.bg.fillStyle(0xffffff, this.active_ ? 0.14 : 0.05).fillRoundedRect(-this.bw / 2 + 4, -this.bh / 2 + 4, this.bw - 8, this.bh / 2 - 4, 9);
    this.bg.lineStyle(3, hot ? 0xffffff : this.active_ ? 0xffd84d : 0x777b84, 1).strokeRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, 12);
    this.label.setAlpha(this.active_ ? 1 : 0.6);
  }

  tap(): void {
    if (!this.active_ || !this.visible) return;
    this.scene.tweens.add({ targets: this, scale: 0.94, duration: 70, yoyo: true });
    this.onTap();
  }

  setText(t: string): this {
    this.label.setText(t);
    return this;
  }

  setEnabled(on: boolean): this {
    this.active_ = on;
    this.draw(false);
    return this;
  }

  setFill(c: number): this {
    (this as unknown as { fill: number }).fill = c;
    this.draw(false);
    return this;
  }

  get enabled(): boolean {
    return this.active_;
  }
}

/** หัวใจพิกเซล (วาดด้วย Graphics ไม่พึ่งฟอนต์อีโมจิ) */
export function drawHeart(g: Phaser.GameObjects.Graphics, x: number, y: number, px: number, filled: boolean): void {
  const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'X') continue;
      g.fillStyle(filled ? 0xe63946 : 0x3a2f3a, 1).fillRect(x + c * px, y + r * px, px, px);
      if (filled && r === 1 && c === 1) g.fillStyle(0xffb3b8, 1).fillRect(x + c * px, y + r * px, px, px);
    }
  });
}

/** เหรียญทอง (วงกลม + ขอบ) */
export function drawCoin(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(0xb8860b, 1).fillCircle(x, y, r);
  g.fillStyle(0xffd84d, 1).fillCircle(x, y, r - 2);
  g.fillStyle(0xfff3a8, 1).fillCircle(x - r * 0.25, y - r * 0.25, r * 0.35);
}

/** ข้อความลอยขึ้นแล้วจาง (เหรียญ +100 / ความเสียหาย) */
export function floatText(scene: Phaser.Scene, x: number, y: number, s: string, color: string, size = 34, depth = 50): Phaser.GameObjects.Text {
  const t = txt(scene, x, y, s, size, color).setOrigin(0.5).setDepth(depth).setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1.15, duration: 160, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 350, duration: 900, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  return t;
}

/** ประกายเล็ก ๆ กระจายออก (n ชิ้นเท่านั้น — เบาต่อเครื่อง) */
export function sparkle(scene: Phaser.Scene, x: number, y: number, color: number, n = 8, spread = 60, depth = 50): void {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const d = spread * (0.5 + Math.random() * 0.7);
    const s = scene.add.rectangle(x, y, 8, 8, color, 1).setDepth(depth).setRotation(Math.random());
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d - 10,
      alpha: 0,
      scale: 0.2,
      duration: 520 + Math.random() * 280,
      ease: 'Cubic.easeOut',
      onComplete: () => s.destroy(),
    });
  }
}

/** พื้นหลังไล่สี (ใช้เมื่อไม่มีภาพ) */
export function gradientBg(scene: Phaser.Scene, top: number, bottom: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  return g;
}

/** ภาพพื้นหลังเต็มจอแบบ cover — คืนฟังก์ชันแปลงพิกัดภาพ → พิกัดจอ */
export function coverImage(scene: Phaser.Scene, key: string, x = GAME_WIDTH / 2, y = GAME_HEIGHT / 2, boxW = GAME_WIDTH, boxH = GAME_HEIGHT) {
  const img = scene.add.image(x, y, key);
  const scale = Math.max(boxW / img.width, boxH / img.height);
  img.setScale(scale);
  const at = (px: number, py: number) => ({ x: img.x - (img.width * scale) / 2 + px * scale, y: img.y - (img.height * scale) / 2 + py * scale });
  return { img, scale, at };
}

/** ตรวจว่าแท็บถูกซ่อน (หยุดแอนิเมชันที่ไม่เห็น — ประหยัดแบตมือถือ) */
export function pauseWhenHidden(scene: Phaser.Scene): void {
  const onVis = () => {
    if (document.hidden) scene.tweens.pauseAll();
    else scene.tweens.resumeAll();
  };
  document.addEventListener('visibilitychange', onVis);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', onVis));
}

/** แสดงข้อความสั้นกลางจอ (ข้อความสำคัญ เช่น "พญาจระเข้ปรากฏตัวแล้ว!") */
export function banner(scene: Phaser.Scene, s: string, y: number, size = 40, color: string = PAL.gold): Phaser.GameObjects.Container {
  const t = txt(scene, 0, 0, s, size, color).setOrigin(0.5);
  t.setWordWrapWidth(GAME_WIDTH - 80, true);
  const bg = scene.add.rectangle(0, 0, Math.min(GAME_WIDTH - 20, t.width + 60), t.height + 24, 0x05070d, 0.7);
  return scene.add.container(GAME_WIDTH / 2, y, [bg, t]).setDepth(60);
}
