import Phaser from 'phaser';
import { CAMERA_ZOOM, INTERACT_RADIUS_TILES, TILE_SIZE_PX } from '../config/constants';
import { getLevel } from '../content/registry';
import type { NpcDefinition } from '../content/types';
import { defaultScale } from '../core/scale/ScaleSystem';
import { GameSession } from '../core/session/GameSession';
import { buildWorld } from '../core/world/MapBuilder';
import { Character, Player } from '../entities/Player';
import { FOG_EDGE_TILE, FOG_SOLID_TILE, OBJECT_TILE, TERRAIN_TILE, TILESET_KEY } from '../graphics/tileIndex';
import { FONT_FAMILY } from '../ui/theme';
import { GameEvents, REGISTRY_LEVEL_ID, REGISTRY_SESSION, type DialoguePayload } from './events';

const S = TILE_SIZE_PX;
const DEPTH = { characters: 20, labels: 40, grid: 60, fog: 100 } as const;

interface NpcInstance {
  def: NpcDefinition;
  sprite: Character;
  marker: Phaser.GameObjects.Image;
}

interface ActiveDialogue {
  npc: NpcInstance;
  index: number;
}

/** ฉากโลกเกม: แผนที่ ตัวละคร การชน กล้อง และ Fog of War */
export class WorldScene extends Phaser.Scene {
  private session!: GameSession;
  private player!: Player;
  private npcs: NpcInstance[] = [];
  private fogLayer!: Phaser.Tilemaps.TilemapLayer;
  private gridOverlay!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private dialogue: ActiveDialogue | null = null;
  private lastTileKey = '';

  constructor() {
    super('WorldScene');
  }

  create(): void {
    const level = getLevel(this.registry.get(REGISTRY_LEVEL_ID));
    const grid = buildWorld(level.map);
    this.session = new GameSession(level, grid, defaultScale);
    this.registry.set(REGISTRY_SESSION, this.session);
    this.npcs = [];
    this.labels.clear();
    this.dialogue = null;
    this.lastTileKey = '';

    const widthPx = grid.width * S;
    const heightPx = grid.height * S;

    // ---- แผนที่ (tilemap 3 ชั้น: พื้น / วัตถุ / หมอก) ----
    const map = this.make.tilemap({ tileWidth: S, tileHeight: S, width: grid.width, height: grid.height });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, S, S, 0, 0);
    if (!tileset) throw new Error('โหลด tileset ไม่สำเร็จ');
    const ground = map.createBlankLayer('ground', tileset)!;
    const objects = map.createBlankLayer('objects', tileset)!;
    this.fogLayer = map.createBlankLayer('fog', tileset)!;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        ground.putTileAt(TERRAIN_TILE[grid.getTerrain(x, y)!], x, y);
        const obj = grid.getObject(x, y);
        if (obj) objects.putTileAt(OBJECT_TILE[obj], x, y);
      }
    }
    this.fogLayer.fill(FOG_SOLID_TILE).setDepth(DEPTH.fog);
    ground.setCollision([TERRAIN_TILE.water]);
    objects.setCollisionByExclusion([-1]);

    // ---- ป้ายจุดสังเกต (แสดงเมื่อค้นพบ) ----
    for (const lm of level.landmarks) {
      if (!lm.showLabel) continue;
      const label = this.add
        .text((lm.at.x + 0.5) * S, lm.at.y * S - 2, lm.name, {
          fontFamily: FONT_FAMILY,
          fontSize: '6px',
          color: '#fff6d5',
          stroke: '#1b1b24',
          strokeThickness: 2,
          padding: { top: 2 },
        })
        .setResolution(CAMERA_ZOOM * 2)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.labels)
        .setVisible(false);
      this.labels.set(lm.id, label);
    }

    // ---- ตัวละคร ----
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.player = new Player(this, (level.spawn.x + 0.5) * S, (level.spawn.y + 0.5) * S - 4, {
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
    });
    this.session.odometer.teleport(this.player.x, this.player.y);

    for (const def of level.npcs) {
      const sprite = new Character(this, (def.at.x + 0.5) * S, (def.at.y + 0.5) * S - 4, def.appearance);
      sprite.body.setImmovable(true);
      sprite.body.pushable = false;
      sprite.setDepth(this.depthForY(sprite.y));
      const marker = this.add.image(sprite.x, sprite.y - 12, 'marker').setDepth(DEPTH.labels);
      this.tweens.add({ targets: marker, y: marker.y - 2, duration: 500, yoyo: true, repeat: -1 });
      this.add
        .text(sprite.x, sprite.y + 9, def.name, {
          fontFamily: FONT_FAMILY,
          fontSize: '5px',
          color: '#ffffff',
          stroke: '#1b1b24',
          strokeThickness: 2,
          padding: { top: 2 },
        })
        .setResolution(CAMERA_ZOOM * 2)
        .setOrigin(0.5, 0)
        .setDepth(DEPTH.labels);
      this.npcs.push({ def, sprite, marker });
    }

    // ---- การชน ----
    this.physics.world.setBounds(0, 0, widthPx, heightPx);
    this.physics.add.collider(this.player, ground);
    this.physics.add.collider(this.player, objects);
    this.physics.add.collider(
      this.player,
      this.npcs.map((n) => n.sprite),
    );

    // ---- กล้องติดตามตัวละคร ----
    const cam = this.cameras.main;
    cam.setBounds(0, 0, widthPx, heightPx);
    cam.setZoom(CAMERA_ZOOM);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setBackgroundColor('#0d1220');

    // ---- ตารางช่อง (G) ----
    this.gridOverlay = this.add.graphics().setDepth(DEPTH.grid).setVisible(false);
    this.drawGrid(grid.width, grid.height);

    // ---- ปุ่มคำสั่ง ----
    kb.on('keydown-E', () => this.onAction());
    kb.on('keydown-SPACE', () => this.onAction());
    kb.on('keydown-ENTER', () => this.onAction());
    kb.on('keydown-R', () => {
      if (this.session.mode !== 'explore') return;
      this.session.odometer.resetTrip();
      this.toast('เริ่มวัดระยะใหม่จากจุดนี้');
    });
    kb.on('keydown-G', () => {
      this.session.showGrid = !this.session.showGrid;
      this.gridOverlay.setVisible(this.session.showGrid);
    });
    kb.on('keydown-M', () => this.toggleMap());
    kb.on('keydown-ESC', () => {
      if (this.session.mode === 'map') this.toggleMap();
    });

    this.updateFog(true);
  }

  override update(): void {
    const s = this.session;
    const v = this.player.handleInput(s.mode === 'explore');
    if (v.lengthSq() > 0) s.updateFacing(v.x, v.y);

    // ระยะทางจากตำแหน่งจริงหลังชน (ไม่ใช่จากความเร็ว)
    s.odometer.sample(this.player.x, this.player.y);
    this.player.setDepth(this.depthForY(this.player.y));
    this.updateFog(false);
  }

  /** เรียงลำดับการวาดตามแกน y: ตัวที่อยู่ใต้กว่า (ใกล้กล้องกว่า) วาดทับ */
  private depthForY(y: number): number {
    return DEPTH.characters + y / (this.session.grid.height * S);
  }

  /** เปิดหมอกเมื่อผู้เล่นเปลี่ยนช่อง */
  private updateFog(force: boolean): void {
    const s = this.session;
    const feet = this.player.feet;
    const tx = s.scale.pxToTile(feet.x);
    const ty = s.scale.pxToTile(feet.y);
    const key = `${tx},${ty}`;
    if (!force && key === this.lastTileKey) return;
    this.lastTileKey = key;
    s.playerTile = { x: tx, y: ty };

    const revealed = s.fog.reveal(tx, ty, s.level.fog.revealRadiusTiles);
    for (const t of revealed) this.fogLayer.removeTileAt(t.x, t.y);
    for (const t of revealed) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = t.x + dx;
          const ny = t.y + dy;
          if (s.fog.isFrontier(nx, ny)) this.fogLayer.putTileAt(FOG_EDGE_TILE, nx, ny);
        }
      }
    }

    for (const id of s.checkLandmarkDiscovery()) {
      this.labels.get(id)?.setVisible(true);
      const lm = s.level.landmarks.find((l) => l.id === id)!;
      if (!force) this.toast(`ค้นพบจุดสังเกต: ${lm.name}`);
    }
  }

  private onAction(): void {
    const s = this.session;
    if (s.mode === 'dialogue') {
      this.advanceDialogue();
      return;
    }
    if (s.mode !== 'explore') return;
    const npc = this.findNearbyNpc();
    if (!npc) return;
    this.player.setVelocity(0, 0);
    npc.sprite.faceTowards(this.player.x, this.player.y);
    s.mode = 'dialogue';
    this.dialogue = { npc, index: 0 };
    this.showDialogueLine();
  }

  private findNearbyNpc(): NpcInstance | undefined {
    const maxDist = INTERACT_RADIUS_TILES * S;
    let best: NpcInstance | undefined;
    let bestDist = Infinity;
    for (const n of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      if (d <= maxDist && d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    return best;
  }

  private showDialogueLine(): void {
    if (!this.dialogue) return;
    const { npc, index } = this.dialogue;
    const line = npc.def.dialogue[index];
    const payload: DialoguePayload = {
      speaker: line.speaker,
      text: this.session.resolveText(line.text),
      index,
      total: npc.def.dialogue.length,
    };
    this.game.events.emit(GameEvents.DialogueShow, payload);
  }

  private advanceDialogue(): void {
    if (!this.dialogue) return;
    this.dialogue.index++;
    if (this.dialogue.index < this.dialogue.npc.def.dialogue.length) {
      this.showDialogueLine();
      return;
    }
    const { npc } = this.dialogue;
    const s = this.session;
    const stepBefore = s.currentStep;
    s.talkedTo.add(npc.def.id);
    npc.marker.setVisible(false);
    this.dialogue = null;
    s.mode = 'explore';
    this.game.events.emit(GameEvents.DialogueHide);
    if (stepBefore && s.isStepComplete(stepBefore)) {
      this.toast(`ผ่านฉากที่ ${stepBefore.order}: ${stepBefore.title}`);
    }
  }

  private toggleMap(): void {
    const s = this.session;
    if (s.mode === 'explore') {
      s.mode = 'map';
      this.game.events.emit(GameEvents.MapShow);
    } else if (s.mode === 'map') {
      s.mode = 'explore';
      this.game.events.emit(GameEvents.MapHide);
    }
  }

  private toast(message: string): void {
    this.game.events.emit(GameEvents.Toast, message);
  }

  /** เส้นตาราง: เส้นบางทุก 1 ช่อง (10 ม.) เส้นหนาทุก 10 ช่อง (100 ม.) */
  private drawGrid(w: number, h: number): void {
    const g = this.gridOverlay;
    for (let x = 0; x <= w; x++) {
      const major = x % 10 === 0;
      g.lineStyle(major ? 0.7 : 0.5, 0xffffff, major ? 0.6 : 0.3);
      g.lineBetween(x * S, 0, x * S, h * S);
    }
    for (let y = 0; y <= h; y++) {
      const major = y % 10 === 0;
      g.lineStyle(major ? 0.7 : 0.5, 0xffffff, major ? 0.6 : 0.3);
      g.lineBetween(0, y * S, w * S, y * S);
    }
  }
}
