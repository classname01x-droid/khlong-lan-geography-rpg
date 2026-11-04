import Phaser from 'phaser';
import { PLAYER_SPEED_TILES_PER_SEC, TILE_SIZE_PX } from '../config/constants';
import type { CharacterAppearance } from '../content/types';
import { characterTextureKey } from '../graphics/PlaceholderTextures';

export interface MoveKeys {
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
}

/** ตัวละครทั่วไป (ผู้เล่นและ NPC) — hitbox เล็กกว่าภาพ อยู่ที่เท้า เพื่อเดินเฉียดสิ่งกีดขวางได้ */
export class Character extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  protected readonly texKey: string;

  constructor(scene: Phaser.Scene, x: number, y: number, appearance: CharacterAppearance) {
    const key = characterTextureKey(appearance);
    super(scene, x, y, key, 'down-0');
    this.texKey = key;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(10, 6).setOffset(3, 10);
  }

  /** จุดเท้า (ใช้คำนวณช่องที่ยืนอยู่) */
  get feet(): Phaser.Math.Vector2 {
    return this.body.center;
  }

  /** ยืนนิ่งหันหน้าเข้าหาจุด */
  faceTowards(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.setFrame('side-0').setFlipX(dx < 0);
    } else {
      this.setFrame(dy < 0 ? 'up-0' : 'down-0').setFlipX(false);
    }
  }
}

export class Player extends Character {
  private readonly speed = PLAYER_SPEED_TILES_PER_SEC * TILE_SIZE_PX;
  private lastAnimDir: 'down' | 'up' | 'side' = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly keys: MoveKeys) {
    super(scene, x, y, 'student');
    this.setCollideWorldBounds(true);
  }

  /**
   * อ่านปุ่มและตั้งความเร็ว; คืนเวกเตอร์ทิศที่กด
   * @param override ทิศที่สั่งจากสคริปต์ทดสอบอัตโนมัติ (ใช้แทนคีย์บอร์ด) — ยังผ่าน physics และการชนตามปกติ
   */
  handleInput(enabled: boolean, override: Phaser.Math.Vector2 | null = null): Phaser.Math.Vector2 {
    const held = (ks: Phaser.Input.Keyboard.Key[]) => enabled && ks.some((k) => k.isDown);
    const dir =
      enabled && override
        ? override.clone()
        : new Phaser.Math.Vector2(
            (held(this.keys.right) ? 1 : 0) - (held(this.keys.left) ? 1 : 0),
            (held(this.keys.down) ? 1 : 0) - (held(this.keys.up) ? 1 : 0),
          );
    if (dir.lengthSq() === 0) {
      this.setVelocity(0, 0);
      this.anims.stop();
      this.setFrame(`${this.lastAnimDir}-0`);
      return dir;
    }
    dir.normalize(); // เดินทแยงความเร็วเท่าเดิม
    this.setVelocity(dir.x * this.speed, dir.y * this.speed);

    const animDir = Math.abs(dir.x) > Math.abs(dir.y) ? 'side' : dir.y < 0 ? 'up' : 'down';
    if (animDir === 'side') this.setFlipX(dir.x < 0);
    else this.setFlipX(false);
    this.lastAnimDir = animDir;
    this.anims.play(`${this.texKey}-walk-${animDir}`, true);
    return dir;
  }
}
