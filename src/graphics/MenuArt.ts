import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { PIXEL } from '../ui/pixel/theme';
import { characterTextureKey } from './PlaceholderTextures';
import { OBJECT_TILE, TERRAIN_TILE, TILESET_KEY } from './tileIndex';

/**
 * ภาพประกอบหน้าเมนูและแผนที่โลก (placeholder ที่วาดด้วยโค้ด + tile เดิม)
 * แยกจาก logic ของ scene: เปลี่ยนเป็นภาพจริงได้โดยแก้เฉพาะไฟล์นี้
 */
const SCALE = 3; // ขยาย tile 16px → 48px

function tile(scene: Phaser.Scene, x: number, y: number, index: number, scale = SCALE): Phaser.GameObjects.Image {
  return scene.add.image(x, y, TILESET_KEY, `t${index}`).setOrigin(0).setScale(scale);
}

/** ฉากหลังเมนูหลัก: ท้องฟ้า ภูเขาเป็นขั้น ทุ่งหญ้า ต้นไม้ ถนน และตัวละคร */
export function drawMenuBackground(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const sky = [0x9fd4e6, 0xb3dde9, 0xc8e6ea, 0xdcefe6];
  sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 70, GAME_WIDTH, 70));
  // ภูเขาเป็นขั้นแบบพิกเซล 2 ชั้น
  const hills = (base: number, color: number, amp: number, period: number, phase: number) => {
    g.fillStyle(color, 1);
    for (let x = 0; x < GAME_WIDTH; x += 8) {
      const top = base - Math.round((Math.sin((x + phase) / period) * 0.5 + 0.5) * amp / 8) * 8;
      g.fillRect(x, top, 8, GAME_HEIGHT - top);
    }
  };
  hills(330, 0x7fae6a, 90, 90, 40);
  hills(380, PIXEL.green, 70, 60, 300);

  // ทุ่งหญ้าด้วย tile จริงของเกม
  const groundY = 440;
  for (let x = 0; x < GAME_WIDTH; x += 16 * SCALE) {
    for (let y = groundY; y < GAME_HEIGHT; y += 16 * SCALE) {
      const onRoad = y === groundY + 16 * SCALE;
      tile(scene, x, y, onRoad ? TERRAIN_TILE.road : (x / 48 + y / 48) % 5 === 0 ? TERRAIN_TILE.flowers : TERRAIN_TILE.grass);
    }
  }
  for (const [x, y] of [
    [24, 392],
    [80, 404],
    [840, 392],
    [896, 410],
    [760, 420],
  ]) {
    tile(scene, x, y, OBJECT_TILE.tree);
  }
  // ตัวละคร: นักเรียน และครูเนม
  scene.add.image(160, 520, characterTextureKey('student'), 'side-0').setScale(4);
  scene.add.image(800, 520, characterTextureKey('teacher'), 'side-0').setScale(4).setFlipX(true);
}

export interface WorldRegionArt {
  x: number;
  y: number;
  /** ไอคอน tile ประจำพื้นที่ */
  icon: number;
  locked: boolean;
}

/**
 * แผนที่โลก (ภาพประกอบ): กระดาษเก่า ลำน้ำ เส้นทางประ และพื้นที่ 4 ตำบล
 * ไม่ใช้มาตราส่วนหรือตำแหน่งจริง — ห้ามใช้คำนวณระยะทาง
 */
export function drawWorldMapArt(scene: Phaser.Scene, regions: WorldRegionArt[]): void {
  const g = scene.add.graphics();
  g.fillStyle(PIXEL.creamDark, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  g.fillStyle(PIXEL.cream, 1).fillRect(12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24);
  // ลายกระดาษ
  for (let i = 0; i < 260; i++) {
    const x = (i * 97) % GAME_WIDTH;
    const y = (i * 53) % GAME_HEIGHT;
    g.fillStyle(PIXEL.creamDark, 0.5).fillRect(x, y, 4, 4);
  }
  // ลำน้ำคดเคี้ยว (ภาพประกอบ)
  g.fillStyle(0x6aa6d8, 1);
  for (let y = 0; y < GAME_HEIGHT; y += 8) {
    const x = 470 + Math.round(Math.sin(y / 70) * 40 / 8) * 8;
    g.fillRect(x, y, 16, 8);
  }
  // เส้นทางประเชื่อมพื้นที่ตามลำดับด่าน
  for (let i = 0; i < regions.length - 1; i++) {
    const a = regions[i];
    const b = regions[i + 1];
    const steps = Math.floor(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 16);
    for (let s = 1; s < steps; s += 2) {
      const t = s / steps;
      g.fillStyle(PIXEL.wood, 1).fillRect(Math.round((a.x + (b.x - a.x) * t) / 4) * 4, Math.round((a.y + (b.y - a.y) * t) / 4) * 4, 8, 8);
    }
  }
  // พื้นที่แต่ละตำบล: เกาะหญ้าแบบขั้นบันได + ไอคอน
  for (const r of regions) {
    const color = r.locked ? 0xa9a38f : PIXEL.green;
    const dark = r.locked ? 0x7d7866 : PIXEL.greenDark;
    for (const [dx, dy, w, h] of [
      [-64, -40, 128, 80],
      [-80, -24, 160, 48],
      [-48, -52, 96, 104],
    ]) {
      g.fillStyle(dark, 1).fillRect(r.x + dx - 4, r.y + dy - 4, w + 8, h + 8);
    }
    for (const [dx, dy, w, h] of [
      [-64, -40, 128, 80],
      [-80, -24, 160, 48],
      [-48, -52, 96, 104],
    ]) {
      g.fillStyle(color, 1).fillRect(r.x + dx, r.y + dy, w, h);
    }
    const icon = tile(scene, r.x - 24, r.y - 30, r.icon);
    if (r.locked) icon.setTint(0x999999);
  }
}
