import Phaser from 'phaser';
import { TILE_SIZE_PX } from '../../config/constants';
import type { LevelDefinition } from '../../content/types';
import type { WorldGrid } from '../../core/world/WorldGrid';
import type { Character } from '../../entities/Player';

/**
 * แอนิเมชันบรรยากาศในแผนที่ (เบา: ทั้งหมด ≤ ~60 วัตถุ ใช้ tween เท่านั้น ไม่มีระบบอนุภาคหนัก)
 *   น้ำในลำธารระยิบ · ควันจากหลังคาบ้าน · ธงโบก · ใบไม้ปลิว · นกบินผ่าน · ผีเสื้อ
 * ภาพพื้นไทล์เป็นภาพนิ่งจึงทำ "น้ำไหล" ด้วยประกายขาวไล่ตามแนวน้ำ (ไม่ได้ขยับตัวไทล์)
 * วัตถุทั้งหมดไม่มีการชน (ไม่เข้า physics) — การชนยังมีเฉพาะบ้าน ต้นไม้ใหญ่ หิน และพื้นที่ผ่านไม่ได้เหมือนเดิม
 */
export interface AmbientHandle {
  destroy(): void;
}

const S = TILE_SIZE_PX;

export function addOverworldAmbient(scene: Phaser.Scene, level: LevelDefinition, grid: WorldGrid, depthBase: number): AmbientHandle {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => (objs.push(o), o);
  const W = level.map.widthTiles * S;
  const H = level.map.heightTiles * S;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  // น้ำระยิบ: เลือกช่องน้ำสุ่ม ≤ 28 ช่อง
  const water: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < level.map.heightTiles; y++) for (let x = 0; x < level.map.widthTiles; x++) if (grid.getTerrain(x, y) === 'water') water.push({ x, y });
  for (let i = 0; i < Math.min(28, water.length); i++) {
    const t = water[Math.floor(Math.random() * water.length)];
    const g = track(scene.add.rectangle(t.x * S + rnd(2, 12), t.y * S + rnd(2, 12), 4, 1.2, 0xffffff, 0).setDepth(depthBase));
    scene.tweens.add({ targets: g, alpha: { from: 0, to: 0.75 }, x: `+=${rnd(3, 7)}`, duration: rnd(700, 1400), yoyo: true, repeat: -1, delay: rnd(0, 1500) });
  }

  // ควันบ้าน + ธง
  for (const f of level.map.features) {
    if (f.kind === 'building') {
      const cx = (f.area.x + f.area.w * 0.78) * S;
      const cy = f.area.y * S + 2;
      for (let k = 0; k < 2; k++) {
        const p = track(scene.add.circle(cx, cy, 2.2, 0xe8e8ee, 0).setDepth(depthBase + 60));
        scene.tweens.add({ targets: p, y: cy - 20, x: cx + 4, alpha: { from: 0.55, to: 0 }, scale: { from: 0.7, to: 1.8 }, duration: 2600, repeat: -1, delay: k * 1300 });
      }
    } else if (f.kind === 'object' && f.object === 'flagpole') {
      const fx = (f.at.x + 0.5) * S + 1;
      const fy = f.at.y * S - 6;
      const flag = track(scene.add.rectangle(fx, fy, 7, 4, 0xd94b4b, 1).setOrigin(0, 0.5).setDepth(depthBase + 60));
      scene.tweens.add({ targets: flag, scaleX: { from: 1, to: 0.6 }, skewX: 0, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ใบไม้ปลิว (10 ใบ ทั่วแผนที่)
  for (let i = 0; i < 10; i++) {
    const lx = rnd(0, W);
    const l = track(scene.add.rectangle(lx, rnd(0, H), 2.5, 1.6, i % 2 ? 0x7cc24a : 0xb8d85a, 0.9).setDepth(depthBase + 70));
    scene.tweens.add({ targets: l, x: `+=${rnd(-40, 60)}`, y: `+=${rnd(30, 70)}`, angle: 360, alpha: { from: 0.9, to: 0.1 }, duration: rnd(5000, 9000), repeat: -1, delay: rnd(0, 4000), onRepeat: () => l.setPosition(rnd(0, W), rnd(0, H)) });
  }

  // นก 3 ตัว (บินข้ามแผนที่ช้า ๆ กระพือปีก)
  for (let i = 0; i < 3; i++) {
    const y = rnd(20, H * 0.5);
    const bird = track(scene.add.container(-20, y).setDepth(depthBase + 80));
    const wing1 = scene.add.rectangle(-1.5, 0, 3.5, 1, 0x20242c, 1).setAngle(-20);
    const wing2 = scene.add.rectangle(1.5, 0, 3.5, 1, 0x20242c, 1).setAngle(20);
    bird.add([wing1, wing2]);
    scene.tweens.add({ targets: [wing1, wing2], scaleY: { from: 1, to: 2.4 }, duration: 160, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: bird, x: W + 20, y: y + rnd(-14, 14), duration: rnd(26000, 40000), repeat: -1, delay: i * 9000 });
  }

  // ผีเสื้อ 4 ตัวบนพื้นหญ้า
  for (let i = 0; i < 4; i++) {
    const bx = rnd(S * 4, W - S * 4);
    const by = rnd(S * 4, H - S * 4);
    const b = track(scene.add.circle(bx, by, 1.4, i % 2 ? 0xffb347 : 0xffe14d, 1).setDepth(depthBase + 65));
    scene.tweens.add({ targets: b, x: `+=${rnd(-18, 18)}`, y: `+=${rnd(-12, 12)}`, scale: { from: 1, to: 0.5 }, duration: rnd(500, 900), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  return {
    destroy() {
      for (const o of objs) o.destroy();
    },
  };
}

/** NPC: ขยับตัวเบา ๆ (หายใจ) และเดินสั้น ๆ ไป-กลับเมื่อผู้เล่นอยู่ห่าง · ไม่เปลี่ยนตำแหน่งจริงของ NPC (ใช้คุย/ชน/นำทางจากตำแหน่งเดิม) */
export function animateNpc(scene: Phaser.Scene, sprite: Character, texKey: string, getPlayer: () => { x: number; y: number }, isBusy: () => boolean): void {
  const homeX = sprite.x;
  const baseAngle = 0;
  scene.tweens.add({ targets: sprite, angle: { from: -1.6, to: 1.6 }, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 600 });
  const loop = () => {
    scene.time.delayedCall(2500 + Math.random() * 4000, () => {
      if (!sprite.scene) return;
      const p = getPlayer();
      if (isBusy() || Math.hypot(p.x - sprite.x, p.y - sprite.y) < S * 3.2) return loop();
      const dir = sprite.x > homeX + 1 ? -1 : 1;
      sprite.setFlipX(dir < 0);
      sprite.anims.play(`${texKey}-walk-side`, true);
      scene.tweens.add({
        targets: sprite,
        x: homeX + dir * 7,
        duration: 900,
        onComplete: () => {
          sprite.anims.stop();
          sprite.setFrame('side-0');
          // กลับมายืนหันหน้าลง
          scene.time.delayedCall(700, () => {
            if (!sprite.scene) return;
            sprite.setFrame('down-0').setFlipX(false).setAngle(baseAngle);
            scene.tweens.add({ targets: sprite, x: homeX, duration: 900 });
            loop();
          });
        },
      });
    });
  };
  loop();
}
