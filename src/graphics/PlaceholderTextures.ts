import Phaser from 'phaser';
import { TILE_SIZE_PX } from '../config/constants';
import { createRng } from '../core/world/MapBuilder';
import type { CharacterAppearance } from '../content/types';
import { TILESET_KEY, TILE_COUNT } from './tileIndex';

/**
 * สร้างภาพ Pixel Art placeholder ทั้งหมดด้วยโค้ด (ไม่ใช้ไฟล์ภาพจากภายนอก)
 * เมื่อมีงานศิลป์จริงแล้ว ให้แทนที่ด้วยการโหลด spritesheet ใน BootScene
 * โดยคงชื่อ texture key และลำดับ frame เดิมไว้
 */
const S = TILE_SIZE_PX;

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function noise(ctx: Ctx, ox: number, rng: () => number, base: string, specks: Array<[string, number]>): void {
  px(ctx, ox, 0, base, S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const r = rng();
      let acc = 0;
      for (const [color, p] of specks) {
        acc += p;
        if (r < acc) {
          px(ctx, ox + x, y, color);
          break;
        }
      }
    }
  }
}

function drawGrass(ctx: Ctx, ox: number, rng: () => number): void {
  noise(ctx, ox, rng, '#5aa54a', [
    ['#4e9441', 0.12],
    ['#6cb85a', 0.08],
  ]);
  for (let i = 0; i < 4; i++) {
    const x = ox + 1 + Math.floor(rng() * 13);
    const y = 2 + Math.floor(rng() * 12);
    px(ctx, x, y, '#3f7d35');
    px(ctx, x + 1, y - 1, '#3f7d35');
  }
}

function drawTiles(ctx: Ctx): void {
  const rng = createRng(7);
  const at = (i: number) => i * S;

  // 0 หญ้า
  drawGrass(ctx, at(0), rng);
  // 1 หญ้ามีดอกไม้
  drawGrass(ctx, at(1), rng);
  for (const [x, y, c] of [
    [3, 4, '#f4e04d'],
    [11, 6, '#f28fb0'],
    [6, 11, '#ffffff'],
    [13, 13, '#f4e04d'],
  ] as const) {
    px(ctx, at(1) + x, y, c);
    px(ctx, at(1) + x - 1, y, '#e8f5c8');
  }
  // 2 ถนนลูกรัง
  noise(ctx, at(2), rng, '#c9a26b', [
    ['#b88f59', 0.14],
    ['#d8b47e', 0.1],
    ['#a07a48', 0.02],
  ]);
  // 3 น้ำ
  px(ctx, at(3), 0, '#3b7dd8', S, S);
  for (let y = 0; y < S; y += 4) {
    const shift = (y / 4) % 2 === 0 ? 2 : 9;
    px(ctx, at(3) + shift, y + 1, '#6aa6f0', 4, 1);
    px(ctx, at(3) + ((shift + 7) % 12), y + 3, '#2f68b8', 3, 1);
  }
  // 4 สะพานไม้ (แผ่นไม้ตั้งฉากกับทางเดินตะวันออก–ตะวันตก)
  px(ctx, at(4), 0, '#9c6b3c', S, S);
  for (let x = 0; x < S; x += 4) px(ctx, at(4) + x, 0, '#6e4a28', 1, S);
  px(ctx, at(4), 0, '#5a3a1e', S, 2);
  px(ctx, at(4), S - 2, '#5a3a1e', S, 2);
  // 5 นาข้าว
  px(ctx, at(5), 0, '#7fb24a', S, S);
  for (let y = 1; y < S; y += 3) {
    for (let x = (y % 2) * 2; x < S; x += 4) {
      px(ctx, at(5) + x, y, '#a6d05e');
      px(ctx, at(5) + x, y + 1, '#5e8f2f');
    }
  }
  px(ctx, at(5), 15, '#8a7a4a', S, 1); // คันนา
  // 6 ลานปูน
  px(ctx, at(6), 0, '#cfc8b8', S, S);
  px(ctx, at(6), 7, '#b5ad9b', S, 1);
  px(ctx, at(6) + 7, 0, '#b5ad9b', 1, 7);
  px(ctx, at(6) + 3, 8, '#b5ad9b', 1, 8);
  px(ctx, at(6) + 12, 8, '#b5ad9b', 1, 8);
  px(ctx, at(6), 15, '#b5ad9b', S, 1);

  // 7 ต้นไม้ (พื้นหลังโปร่งใส)
  {
    const o = at(7);
    px(ctx, o + 7, 11, '#6d4c2f', 2, 5);
    px(ctx, o + 6, 15, '#4a321e', 4, 1);
    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - 7.5, y - 6.5);
        if (d > 6.8) continue;
        let c = '#2f7d32';
        if (d > 5.9) c = '#173d19';
        else if (x + y < 10) c = '#4caf50';
        else if (x + y > 17) c = '#1f5a23';
        px(ctx, o + x, y, c);
      }
    }
    px(ctx, o + 4, 4, '#7bd17e');
  }
  // 8 หิน
  {
    const o = at(8);
    for (let y = 4; y < 15; y++) {
      for (let x = 1; x < 15; x++) {
        const d = Math.hypot((x - 7.5) / 1.2, y - 9.5);
        if (d > 5.6) continue;
        let c = '#8d8d8d';
        if (d > 4.7) c = '#444444';
        else if (x + y < 13) c = '#b0b0b0';
        else if (x + y > 20) c = '#666666';
        px(ctx, o + x, y, c);
      }
    }
  }
  // 9 กำแพงรั้วอิฐ
  {
    const o = at(9);
    px(ctx, o, 0, '#e0c9a6', S, S);
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      const off = row % 2 === 0 ? 0 : 4;
      for (let x = -off; x < S; x += 8) px(ctx, o + Math.max(0, x), y, '#b85c3c', Math.min(7, 7 + Math.min(0, x)), 3);
    }
    px(ctx, o, 0, '#d9785a', S, 1);
  }
  // 10–12 หลังคา (แดง น้ำเงิน ส้ม)
  const roof = (o: number, base: string, dark: string, light: string) => {
    px(ctx, o, 0, base, S, S);
    for (let y = 3; y < S; y += 4) px(ctx, o, y, dark, S, 1);
    for (let y = 0; y < S; y += 4) {
      for (let x = (y / 4) % 2 === 0 ? 1 : 5; x < S; x += 8) px(ctx, o + x, y + 1, light, 2, 1);
    }
  };
  roof(at(10), '#c0392b', '#96281b', '#e05a4a');
  roof(at(11), '#2c6fb3', '#1d4f84', '#5591d1');
  roof(at(12), '#e67e22', '#b5611a', '#f5a35a');
  // 13 ประตู (ผนังด้านหน้า)
  {
    const o = at(13);
    px(ctx, o, 0, '#eadbb8', S, S);
    px(ctx, o, 0, '#8a6d3b', S, 2);
    px(ctx, o + 4, 3, '#4a2c14', 8, 13);
    px(ctx, o + 5, 4, '#7a4b26', 6, 12);
    px(ctx, o + 9, 10, '#f1c40f');
  }
  // 14 เสาธง (ธงชาติไทย แดง-ขาว-น้ำเงิน-ขาว-แดง)
  {
    const o = at(14);
    px(ctx, o + 5, 12, '#7f8c8d', 6, 4);
    px(ctx, o + 7, 0, '#d0d6da', 2, 13);
    const stripes = ['#d62f2f', '#ffffff', '#2a3a8c', '#2a3a8c', '#ffffff', '#d62f2f'];
    stripes.forEach((c, i) => px(ctx, o + 9, 1 + i, c, 6, 1));
  }
  // 15 หมอกทึบ
  px(ctx, at(15), 0, '#0d1220', S, S);
  // 16 ขอบหมอกแบบโปร่ง (dither)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if ((x + y) % 2 === 0 || (x % 4 === 1 && y % 4 === 1)) px(ctx, at(16) + x, y, '#0d1220');
    }
  }
}

/* ---------- ตัวละคร (16×16 วาดด้วยตัวอักษร) ---------- */

type Palette = Record<string, string>;

const HEAD_DOWN = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khsssshk....',
  '....ksessesk....',
  '....kssssssk....',
  '.....kssssk.....',
];
const HEAD_UP = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '....khhhhhhk....',
  '.....kssssk.....',
];
const HEAD_SIDE = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '....khhhhhhhk...',
  '....khhhhsssk...',
  '....khhsssesk...',
  '....khssssssk...',
  '.....kssssk.....',
];
const BODY_FRONT = [
  '....kcccccck....',
  '...ksccccccsk...',
  '...ksccccccsk...',
  '....kcccccck....',
  '....kppppppk....',
];
const BODY_SIDE = [
  '.....kcccck.....',
  '.....kccsck.....',
  '.....kccsck.....',
  '.....kcccck.....',
  '.....kppppk.....',
];
const LEGS_APART = ['....kpk..kpk....', '....kbk..kbk....', '................'];
const LEGS_TOGETHER = ['.....kpkkpk.....', '.....kbkkbk.....', '................'];
const LEGS_SIDE_A = ['....kpk..kpk....', '....kbk..kbk....', '................'];
const LEGS_SIDE_B = ['.....kppppk.....', '.....kbbbbk.....', '................'];

export const CHARACTER_FRAMES = ['down-0', 'down-1', 'up-0', 'up-1', 'side-0', 'side-1'] as const;

const FRAME_ROWS: Record<(typeof CHARACTER_FRAMES)[number], string[]> = {
  'down-0': [...HEAD_DOWN, ...BODY_FRONT, ...LEGS_APART],
  'down-1': [...HEAD_DOWN, ...BODY_FRONT, ...LEGS_TOGETHER],
  'up-0': [...HEAD_UP, ...BODY_FRONT, ...LEGS_APART],
  'up-1': [...HEAD_UP, ...BODY_FRONT, ...LEGS_TOGETHER],
  'side-0': [...HEAD_SIDE, ...BODY_SIDE, ...LEGS_SIDE_A],
  'side-1': [...HEAD_SIDE, ...BODY_SIDE, ...LEGS_SIDE_B],
};

const BASE_PALETTE: Palette = { k: '#1b1b24', s: '#f1c27d', e: '#1b1b24', b: '#3b2a1e' };

const APPEARANCE_PALETTE: Record<CharacterAppearance, Palette> = {
  student: { ...BASE_PALETTE, h: '#3b2416', c: '#f5f5f5', p: '#1f2f5c' },
  teacher: { ...BASE_PALETTE, h: '#141414', c: '#b5579b', p: '#2b2b3a' },
  headman: { ...BASE_PALETTE, h: '#9a9a9a', c: '#a8925c', p: '#4a3b28', s: '#d9a066' },
  villager: { ...BASE_PALETTE, h: '#141414', c: '#2e3f8f', p: '#2e3f8f' },
  // พระสงฆ์: ศีรษะโล้น (สีผิว) จีวรสีเหลืองส้ม
  monk: { ...BASE_PALETTE, h: '#f1c27d', c: '#e3891b', p: '#c46a12' },
  // ตาคำ (ผู้เฒ่า): ผมขาว เสื้อน้ำตาล · เจ้าหน้าที่ป่าไม้: เครื่องแบบเขียว
  elder: { ...BASE_PALETTE, h: '#e6e6e6', c: '#8a6a43', p: '#4a3f2e', s: '#d9a066' },
  ranger: { ...BASE_PALETTE, h: '#4a3020', c: '#3f7a46', p: '#2f4a33' },
};

export function characterTextureKey(a: CharacterAppearance): string {
  return `char-${a}`;
}

function drawRows(ctx: Ctx, rows: string[], palette: Palette, ox: number): void {
  rows.forEach((row, y) => {
    if (row.length !== S) throw new Error(`sprite row ${y} ต้องยาว ${S} ตัวอักษร: "${row}"`);
    for (let x = 0; x < S; x++) {
      const color = palette[row[x]];
      if (color) px(ctx, ox + x, y, color);
    }
  });
}

function createCanvas(scene: Phaser.Scene, key: string, w: number, h: number) {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`สร้าง texture ${key} ไม่สำเร็จ`);
  return tex;
}

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const tiles = createCanvas(scene, TILESET_KEY, S * TILE_COUNT, S);
  drawTiles(tiles.context);
  // เฟรมรายช่อง 't0'…'t16' ให้ฉากอื่น (เช่น เมนู) หยิบ tile ไปใช้เป็นภาพประกอบได้
  for (let i = 0; i < TILE_COUNT; i++) tiles.add(`t${i}`, 0, i * S, 0, S, S);
  tiles.refresh();

  for (const appearance of Object.keys(APPEARANCE_PALETTE) as CharacterAppearance[]) {
    const key = characterTextureKey(appearance);
    const tex = createCanvas(scene, key, S * CHARACTER_FRAMES.length, S);
    CHARACTER_FRAMES.forEach((frame, i) => {
      drawRows(tex.context, FRAME_ROWS[frame], APPEARANCE_PALETTE[appearance], i * S);
      tex.add(frame, 0, i * S, 0, S, S);
    });
    tex.refresh();
  }

  // เครื่องหมาย "!" เหนือ NPC ที่ยังไม่ได้คุย
  const mark = createCanvas(scene, 'marker', 5, 8);
  px(mark.context, 0, 0, '#1b1b24', 5, 8);
  px(mark.context, 1, 1, '#ffd84d', 3, 4);
  px(mark.context, 1, 6, '#ffd84d', 3, 1);
  mark.refresh();

  // ศาลพญาจระเข้ผู้พิทักษ์ (placeholder) · 12×12 px — หลังคาแดง เสาไม้ รูปจระเข้สีเขียวกลางศาล
  const shrine = createCanvas(scene, 'shrine', 12, 12);
  const c = shrine.context;
  px(c, 5, 0, '#d9a441', 2, 1); // ยอด
  px(c, 2, 1, '#8b2a1e', 8, 1); // หลังคา
  px(c, 0, 2, '#b8402a', 12, 2);
  px(c, 1, 4, '#f4efe1', 10, 4); // ตัวศาล
  px(c, 1, 4, '#5a3a1e', 1, 4); // เสา
  px(c, 10, 4, '#5a3a1e', 1, 4);
  px(c, 3, 5, '#3f8f3a', 6, 2); // จระเข้
  px(c, 8, 5, '#ffd84d', 1, 1); // ตา
  px(c, 3, 8, '#8a7a64', 6, 4); // ฐาน
  px(c, 4, 9, '#b9ab90', 4, 2);
  shrine.refresh();

  // กองขยะ (ถุงขยะ ขวด กล่อง) — ภารกิจสักงาม
  const trash = createCanvas(scene, 'trash', 12, 12);
  const t = trash.context;
  px(t, 1, 7, '#2b2f36', 5, 4); // ถุงดำ
  px(t, 2, 6, '#2b2f36', 3, 1);
  px(t, 6, 8, '#4f7ac7', 4, 3); // ถุงฟ้า
  px(t, 7, 7, '#4f7ac7', 2, 1);
  px(t, 4, 4, '#b8873c', 3, 3); // กล่องกระดาษ
  px(t, 8, 5, '#d8d8d8', 1, 3); // ขวด
  px(t, 9, 4, '#7fd0ff', 1, 1);
  px(t, 0, 10, '#6b6b5a', 12, 2); // พื้นเปียก
  px(t, 3, 3, '#e8e2c8', 1, 1);
  trash.refresh();

  // ถังสารเคมี (ถังเหล็กสีน้ำเงิน ฝาเหลือง สัญลักษณ์อันตราย) ที่ถูกทิ้งริมลำธาร — 12×12 px
  const barrel = createCanvas(scene, 'barrel', 12, 12);
  const q = barrel.context;
  px(q, 0, 10, '#4a5a3a', 12, 2); // พื้นเปียก
  px(q, 1, 3, '#2f5fa8', 5, 8); // ถังตั้ง
  px(q, 1, 2, '#d9c13a', 5, 1); // ฝา
  px(q, 1, 6, '#1f3f78', 5, 1); // แถบ
  px(q, 3, 4, '#ffd84d', 1, 1); // ป้ายอันตราย
  px(q, 6, 6, '#2f5fa8', 5, 4); // ถังล้ม
  px(q, 6, 5, '#d9c13a', 1, 4);
  px(q, 7, 8, '#1f3f78', 4, 1);
  px(q, 10, 9, '#7ee07a', 2, 2); // ของเหลวรั่ว
  barrel.refresh();
}

/** สร้าง animation เดินของตัวละครทุกแบบ */
export function createCharacterAnimations(scene: Phaser.Scene): void {
  for (const appearance of Object.keys(APPEARANCE_PALETTE) as CharacterAppearance[]) {
    const key = characterTextureKey(appearance);
    for (const dir of ['down', 'up', 'side'] as const) {
      scene.anims.create({
        key: `${key}-walk-${dir}`,
        frames: [
          { key, frame: `${dir}-0` },
          { key, frame: `${dir}-1` },
        ],
        frameRate: 7,
        repeat: -1,
      });
    }
  }
}
