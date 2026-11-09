import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/constants';
import { gradientBg } from './kit';

/**
 * ฉากน้ำตก/สระของพญาจระเข้ — ใช้ร่วมกันระหว่างฉากทางเข้าและฉากต่อสู้
 * ภาพพื้นหลัง public/rpg/battle.jpg (ตัดจากภาพที่ผู้ใช้เตรียมไว้ ลบ UI ที่ติดมากับภาพออกแล้ว) ภาพนี้มีพญาจระเข้อยู่ในภาพเดียวกัน
 * จึงทำแอนิเมชันกับ "ทั้งภาพ" ได้ (สั่น ซูม เลื่อน ไล่สี) — ยังแยกส่วนตัว/ปาก/ตา ไม่ได้จนกว่าจะมีสไปรต์พญาจระเข้แยกชิ้น
 */
export const ARENA_KEY = 'arena-bg';
export const IMG_TOP = 20;
export const EYE = { x: 477, y: 236 } as const;
export const BOSS_POINT = { x: 560, y: 252 } as const;
export const PLAYER_POINT = { x: 150, y: 400 } as const;

export function loadArena(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ARENA_KEY)) scene.load.image(ARENA_KEY, 'rpg/battle.jpg');
}

export interface Arena {
  img: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Rectangle;
  eye: Phaser.GameObjects.Arc;
  eyeGlow: Phaser.GameObjects.Arc;
  leaves: Phaser.GameObjects.Rectangle[];
  mist: Phaser.GameObjects.Ellipse[];
}

/** วาดฉาก: พื้น/ภาพ/ออร่าม่วง/ตาแดง/ละอองน้ำ/ใบไม้ปลิว — ทุกอย่างเป็น tween เบา ๆ */
export function buildArena(scene: Phaser.Scene): Arena {
  gradientBg(scene, 0x0e1a14, 0x07100c);
  const img = scene.add.image(GAME_WIDTH / 2, 0, ARENA_KEY);
  img.setScale(GAME_WIDTH / img.width);
  img.setY(IMG_TOP + (img.height * img.scaleY) / 2);
  const aura = scene.add.rectangle(GAME_WIDTH / 2 + 120, IMG_TOP + 230, 700, 300, 0x7b3fb5, 0.3).setBlendMode(Phaser.BlendModes.NORMAL);
  scene.tweens.add({ targets: aura, alpha: { from: 0.18, to: 0.34 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const eyeGlow = scene.add.circle(EYE.x, EYE.y, 20, 0xff2020, 0.25);
  const eye = scene.add.circle(EYE.x, EYE.y, 7, 0xff4040, 1);
  scene.tweens.add({ targets: [eye, eyeGlow], alpha: { from: 0.5, to: 1 }, scale: { from: 0.85, to: 1.2 }, duration: 700, yoyo: true, repeat: -1 });
  // ละอองน้ำตก (วงรีขาวจาง ลอยขึ้นช้า ๆ)
  const mist: Phaser.GameObjects.Ellipse[] = [];
  for (let i = 0; i < 6; i++) {
    const m = scene.add.ellipse(250 + i * 110, 330 + (i % 2) * 40, 180, 60, 0xffffff, 0.12);
    scene.tweens.add({ targets: m, x: m.x + (i % 2 ? 40 : -40), alpha: { from: 0.06, to: 0.2 }, duration: 3000 + i * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    mist.push(m);
  }
  // ใบไม้ร่วงโบก (8 ชิ้น)
  const leaves: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < 8; i++) {
    const l = scene.add.rectangle(Math.random() * GAME_WIDTH, -10, 8, 5, i % 2 ? 0x6fbf4a : 0x9bd45f, 0.85);
    scene.tweens.add({
      targets: l,
      y: IMG_TOP + 400,
      x: { value: `+=${(Math.random() - 0.5) * 160}`, ease: 'Sine.easeInOut' },
      rotation: 6,
      duration: 6500 + Math.random() * 4000,
      delay: Math.random() * 5000,
      repeat: -1,
    });
    leaves.push(l);
  }
  return { img, aura, eye, eyeGlow, leaves, mist };
}

export const ARENA_BOTTOM = GAME_HEIGHT;
