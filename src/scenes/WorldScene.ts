import Phaser from 'phaser';
import { CAMERA_ZOOM, INTERACT_RADIUS_TILES, TILE_SIZE_PX } from '../config/constants';
import { DEFAULT_LEVEL_ID, getLevel, getLevelSlot } from '../content/registry';
import { IN_DEVELOPMENT_MESSAGE, isCampaignComplete } from '../core/campaign/Campaign';
import { CHAPTERS, getChapter } from '../content/story/chapters';
import type { NpcDefinition } from '../content/types';
import type { ProgressStore } from '../core/progress/ProgressStore';
import { defaultScale } from '../core/scale/ScaleSystem';
import { GameSession, type SessionSnapshot } from '../core/session/GameSession';
import { buildWorld } from '../core/world/MapBuilder';
import { findPath } from '../core/world/pathfinding';
import type { TilePoint } from '../core/world/types';
import { Character, Player } from '../entities/Player';
import { FOG_EDGE_TILE, FOG_SOLID_TILE, OBJECT_TILE, TERRAIN_TILE, TILESET_KEY } from '../graphics/tileIndex';
import { pinProblemText, ROUTE_CHECK_TEXT } from '../ui/format';
import { pickInteraction } from '../core/input/Interaction';
import { FONT_FAMILY } from '../ui/theme';
import { newTutorialSave, shouldRunTutorial, TUTORIAL_NPC_ID, TutorialRun, tutorialView, type TutorialInput, type TutorialView } from '../core/tutorial/Tutorial';
import { labelSizes } from '../core/ui/WorldLabels';
import { layoutLabels, placeCue, union, type Box, type CueSide, type LabelRequest } from '../core/ui/LabelLayout';
import { hudObstacles } from '../ui/hudObstacles';
import { currentMicro } from '../core/guide/MicroQuest';
import { REGISTRY_CODE_PIECES, REGISTRY_LEVEL_ID, REGISTRY_SESSION, REGISTRY_TOUCH_UI, REGISTRY_UNLOCKED } from './events';
import { canStartLevel, continueStory, getSettings, getProgress, goToEnding, goToMainMenu, goToWorldMap, SCENE, type LevelStartData } from './navigation';

/** ตัวเลือกในเมนูหยุดเกม (Esc) — ลำดับต้องตรงกับ PauseOverlay */
export const PAUSE_ITEMS = ['เล่นต่อ', 'คำแนะนำการควบคุม', 'แผนที่การเดินทาง', 'กลับเมนูหลัก'] as const;

const S = TILE_SIZE_PX;
const DEPTH = { characters: 20, labels: 40, grid: 60, cue: 95, fog: 100 } as const;

interface NpcInstance {
  def: NpcDefinition;
  sprite: Character;
  marker: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  /** ตำแหน่ง y ปกติของป้ายชื่อ (ระบบจัดป้ายเลื่อนจากค่านี้) */
  labelY: number;
}

/** พื้นที่ของข้อความในโลกเกม (คิดจุดยึด origin) ที่ตำแหน่ง y ที่กำหนด */
function textBox(t: Phaser.GameObjects.Text, y = t.y): Box {
  return { x: t.x - t.displayWidth * t.originX, y: y - t.displayHeight * t.originY, w: t.displayWidth, h: t.displayHeight };
}

/** การเดินอัตโนมัติสำหรับการทดสอบ (โหมด dev เท่านั้น) */
interface ScriptedWalk {
  path: TilePoint[];
  index: number;
  resolve: (arrived: boolean) => void;
  /** ตรวจว่าติดค้าง: ตำแหน่งล่าสุดที่ขยับ และเวลาที่ไม่ขยับสะสม (ms) */
  lastX: number;
  lastY: number;
  stuckMs: number;
}

/**
 * ฉากโลกเกม: แผนที่ ตัวละคร การชน กล้อง Fog of War
 * และเป็นผู้รับ input ทั้งหมด แล้วสั่งงาน GameSession (UIScene อ่านสถานะไปแสดง)
 */
export class WorldScene extends Phaser.Scene {
  private session!: GameSession;
  private player!: Player;
  private npcs: NpcInstance[] = [];
  private fogLayer!: Phaser.Tilemaps.TilemapLayer;
  private gridOverlay!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private lastTileKey = '';
  private walk: ScriptedWalk | null = null;
  private progress!: ProgressStore;
  private resetArmedAt = 0;
  private startData: Partial<LevelStartData> = {};
  /** ทิศเดินจากจอยสติกสัมผัส */
  private readonly touchVector = new Phaser.Math.Vector2(0, 0);
  /** false ระหว่างที่ create ยังไม่เสร็จ หรือเมื่อถูกส่งกลับหน้าเลือกด่าน */
  private ready = false;
  /** บทแนะนำผู้เล่นใหม่ (null = ไม่มีในด่านนี้ / ผ่านหรือข้ามแล้ว) */
  private tutorial: TutorialRun | null = null;
  private tutorialInput: TutorialInput | null = null;
  /** ป้ายบอก "คุย/สำรวจ" เหนือเป้าหมายที่อยู่ในระยะโต้ตอบ + วงแหวนใต้เท้า */
  private cue!: Phaser.GameObjects.Container;
  private cueText!: Phaser.GameObjects.Text;
  private cueBox!: Phaser.GameObjects.Graphics;
  private cueRing!: Phaser.GameObjects.Graphics;
  private cueKey = '';
  /** NPC ที่ป้าย "คุย" แทนเครื่องหมาย "!" อยู่ (คืนเครื่องหมายเมื่อเดินออกจากระยะ) */
  private cueNpc: NpcInstance | null = null;
  /** ตำแหน่งปัจจุบันของป้าย "คุย" (พิกัดโลกเกม) และด้านที่วาง */
  private cueRect: Box | null = null;
  private cueSide: CueSide = 'above';
  /** (dev) ข้อมูลการวางป้ายล่าสุด สำหรับตรวจในการทดสอบ */
  private cueDebug: unknown = null;
  /** ตำแหน่ง y ปกติของป้ายชื่อสถานที่ */
  private readonly labelBaseY = new Map<string, number>();
  /** จัดป้ายชื่อใหม่ทุก ~120 ms หรือทันทีเมื่อมีการเปลี่ยนแปลง */
  private layoutInMs = 0;
  private layoutDirty = true;
  /** ขนาดภาพเกมบนจอที่ใช้คำนวณขนาดป้ายล่าสุด (จอ CSS px ต่อพิกเซลโลกเกม) */
  private labelFit = 0;
  private touchUi = false;

  constructor() {
    super('WorldScene');
  }

  create(data?: Partial<LevelStartData>): void {
    this.ready = false;
    this.startData = data ?? {};
    const levelId = this.startData.levelId ?? (this.registry.get(REGISTRY_LEVEL_ID) as string | undefined) ?? DEFAULT_LEVEL_ID;
    // ภารกิจหลักต่อเนื่อง: เข้าได้เฉพาะด่านของบทปัจจุบัน (กันข้ามบท/ย้อนบท/ด่านที่ยังไม่มีเนื้อหา)
    if (!canStartLevel(this, levelId)) {
      this.time.delayedCall(0, () => goToWorldMap(this));
      return;
    }
    this.registry.set(REGISTRY_LEVEL_ID, levelId);
    const level = getLevel(levelId);
    const grid = buildWorld(level.map);
    this.session = new GameSession(level, grid, defaultScale);
    // รหัสลับที่เก็บได้จริงจากบันทึก (ใช้ในบทสรุป {{code:...}})
    this.session.campaignCodes = Object.fromEntries(
      Object.entries(getProgress(this).data.codePieces).map(([id, c]) => [id, c.value]),
    );
    this.registry.set(REGISTRY_SESSION, this.session);
    this.registry.remove(REGISTRY_UNLOCKED);
    this.npcs = [];
    this.labels.clear();
    this.labelFit = 0;
    this.cueKey = '';
    this.cueNpc = null;
    this.cueRect = null;
    this.labelBaseY.clear();
    this.layoutDirty = true;
    this.tutorial = null;
    this.tutorialInput = null;
    this.touchUi = this.registry.get(REGISTRY_TOUCH_UI) === true;
    this.lastTileKey = '';
    this.walk = null;

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
        // ชื่อสถานที่อยู่ใต้ชื่อ NPC และเครื่องหมาย "!" (ไม่บังผู้ที่ต้องไปคุยด้วย)
        .setDepth(DEPTH.labels - 1)
        .setVisible(false);
      this.labels.set(lm.id, label);
      this.labelBaseY.set(lm.id, label.y);
    }

    // ---- ของตกแต่ง (เช่น หีบไม้เก่า) — ภาพอย่างเดียว ไม่มีการชน ไม่มีผลต่อภารกิจ ----
    for (const d of level.decor ?? []) {
      this.add.image((d.at.x + 0.5) * S, (d.at.y + 0.5) * S, d.kind).setDepth(DEPTH.characters - 1);
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
    kb.addCapture([K.SPACE, K.TAB, K.UP, K.DOWN, K.LEFT, K.RIGHT]);

    for (const def of level.npcs) {
      const sprite = new Character(this, (def.at.x + 0.5) * S, (def.at.y + 0.5) * S - 4, def.appearance);
      sprite.body.setImmovable(true);
      sprite.body.pushable = false;
      sprite.setDepth(this.depthForY(sprite.y));
      const marker = this.add.image(sprite.x, sprite.y - 12, 'marker').setDepth(DEPTH.labels);
      this.tweens.add({ targets: marker, y: marker.y - 2, duration: 500, yoyo: true, repeat: -1 });
      const label = this.add
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
      this.npcs.push({ def, sprite, marker, label, labelY: label.y });
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

    // ---- ป้ายโต้ตอบ (แสดงเมื่อเข้าใกล้ NPC/จุดสำรวจ) ----
    this.cueRing = this.add.graphics().setDepth(DEPTH.characters - 0.5).setVisible(false);
    this.cueBox = this.add.graphics();
    this.cueText = this.add
      .text(0, 0, '', { fontFamily: FONT_FAMILY, fontSize: '6px', color: '#2b2118', padding: { top: 2 } })
      .setResolution(CAMERA_ZOOM * 2)
      .setOrigin(0.5, 0.5);
    this.cue = this.add.container(0, 0, [this.cueBox, this.cueText]).setDepth(DEPTH.cue).setVisible(false);
    this.tweens.add({ targets: this.cueRing, alpha: 0.35, duration: 520, yoyo: true, repeat: -1 });

    kb.on('keydown', (ev: KeyboardEvent) => this.handleCode(ev.code));

    // ---- ความคืบหน้า: เล่นต่อจากที่บันทึกไว้ (เพิ่ม ?new=1 ใน URL เพื่อเริ่มใหม่) ----
    this.progress = getProgress(this);
    // บทแนะนำ: ผู้เล่นใหม่ (ไม่มีบันทึก) หรือบทแนะนำที่ยังเล่นค้าง — ตรวจก่อนบันทึกอัตโนมัติครั้งแรก
    const savedTutorial = this.progress.tutorialSave();
    if (shouldRunTutorial(level.id, savedTutorial, this.progress.hasAnySave())) {
      this.tutorial = new TutorialRun(savedTutorial ?? newTutorialSave());
      if (!savedTutorial) this.progress.saveTutorial(this.tutorial.save);
    }
    this.tryResume();

    this.updateFog(true);
    this.syncFogLayer();
    this.refreshLabels();
    this.refreshMarkers();
    this.installTestHooks();

    // บันทึกอัตโนมัติทุก 5 วินาที และตอนปิด/ซ่อนหน้าเว็บ
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.autosave() });
    const onHide = () => this.autosave();
    window.addEventListener('pagehide', onHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('pagehide', onHide));

    // เริ่มด่านใหม่ (restart) → ให้ UI สร้างใหม่ตาม session ใหม่ด้วย
    if (this.scene.isActive(SCENE.ui)) this.scene.get(SCENE.ui).scene.restart();
    else this.scene.launch(SCENE.ui);
    this.ready = true;
  }

  /* =========================================================
   * บันทึก / โหลดความคืบหน้า
   * ========================================================= */

  private tryResume(): void {
    const s = this.session;
    if (this.startData.mode === 'fresh') {
      this.progress.clearInProgress(s.level.id);
      return;
    }
    const snap = this.progress.loadInProgress(s.level.id) as SessionSnapshot | null;
    if (!snap || !s.restore(snap)) return;
    const x = (s.playerTile.x + 0.5) * S;
    const y = (s.playerTile.y + 0.5) * S - 4;
    this.player.setPosition(x, y);
    this.player.body.reset(x, y);
    s.odometer.teleport(x, y);
    this.cameras.main.centerOn(x, y);
    s.toast('เล่นต่อจากความคืบหน้าที่บันทึกไว้');
  }

  /** บันทึกเฉพาะตอนไม่ได้อยู่กลางบทสนทนา เพื่อให้สถานะที่บันทึกสอดคล้องกันเสมอ */
  private autosave(): void {
    const s = this.session;
    if (!s || s.completed || s.inDialogue) return;
    this.progress.saveInProgress(s.level.id, s.toSnapshot());
  }

  /** วาดชั้นหมอกให้ตรงกับสถานะ (ใช้หลังโหลดเกม) */
  private syncFogLayer(): void {
    const s = this.session;
    for (let y = 0; y < s.grid.height; y++) {
      for (let x = 0; x < s.grid.width; x++) {
        if (s.fog.isExplored(x, y)) this.fogLayer.removeTileAt(x, y);
        else if (s.fog.isFrontier(x, y)) this.fogLayer.putTileAt(FOG_EDGE_TILE, x, y);
      }
    }
  }

  private refreshLabels(): void {
    for (const lm of this.session.level.landmarks) this.labels.get(lm.id)?.setVisible(this.session.isLandmarkVisible(lm));
    this.layoutDirty = true;
  }

  /** เริ่มด่านนี้ใหม่ (ลบความคืบหน้ากลางด่าน) — กด Delete 2 ครั้งในหน้า หลักฐาน/ข้อความ */
  private requestReset(): void {
    const now = this.time.now;
    if (now - this.resetArmedAt < 2500) {
      this.progress.clearInProgress(this.session.level.id);
      this.cancelWalk();
      this.scene.restart({ levelId: this.session.level.id, mode: 'fresh' } satisfies LevelStartData);
      return;
    }
    this.resetArmedAt = now;
    this.session.routeFeedback = null;
    this.session.toast('กด Delete อีกครั้งเพื่อเริ่มด่านนี้ใหม่');
  }

  override update(_time: number, delta: number): void {
    if (!this.ready) return;
    const s = this.session;
    if (!s.completed && s.mode !== 'pause') s.elapsedMs += delta;

    const scripted = this.scriptedDirection(delta);
    const touch = this.touchVector.lengthSq() > 0 ? this.touchVector : null;
    const v = this.player.handleInput(s.mode === 'explore', scripted ?? touch);
    if (v.lengthSq() > 0) s.updateFacing(v.x, v.y);

    // ระยะทางจากตำแหน่งจริงหลังชน (ไม่ใช่จากความเร็ว)
    s.odometer.sample(this.player.x, this.player.y);
    this.player.setDepth(this.depthForY(this.player.y));
    this.updateFog(false);
    // เป้าหมายโต้ตอบ (เกณฑ์เดียวกับปุ่ม "คุย" และข้อความบนจอ) — คำนวณครั้งเดียวต่อเฟรม
    const target = s.mode === 'explore' ? pickInteraction(s, INTERACT_RADIUS_TILES) : null;
    this.fitLabels();
    this.updateCue(target);
    this.layoutInMs -= delta;
    if (this.layoutDirty || this.layoutInMs <= 0) this.layoutWorldLabels();
    this.updateTutorial(target);
  }

  /* =========================================================
   * บทแนะนำผู้เล่นใหม่ (ไม่กั้นเนื้อเรื่อง — ทำอะไรก่อนก็ได้)
   * ========================================================= */

  private updateTutorial(target: ReturnType<typeof pickInteraction>): void {
    const t = this.tutorial;
    if (!t?.active) return;
    const s = this.session;
    const input: TutorialInput = {
      mode: s.mode,
      totalMeters: s.odometer.totalMeters,
      tripMeters: s.odometer.tripMeters,
      nearNpc: target?.kind === 'npc' && target.id === TUTORIAL_NPC_ID,
      // ฉากที่ 1 ของบทที่ 1 = คุยกับครูเนมรับภารกิจ
      talked: s.currentStepOrder > 1,
      measured: s.skills.has('odometer'),
    };
    this.tutorialInput = input;
    if (t.update(input)) this.saveTutorial();
  }

  private saveTutorial(): void {
    const t = this.tutorial;
    if (!t) return;
    this.progress.saveTutorial(t.save);
    if (t.save.status === 'done') this.session.toast('ผ่านบทแนะนำแล้ว! ดูเป้าหมายต่อไปที่แถบภารกิจ');
    if (!t.active) this.tutorial = null;
  }

  /** ข้อความบทแนะนำขั้นปัจจุบัน (ชั้นปุ่มสัมผัส/แถบบนจอเรียกอ่าน) */
  tutorialViewFor(touch: boolean): TutorialView | null {
    if (!this.ready || !this.tutorial?.active || !this.tutorialInput) return null;
    return tutorialView(this.tutorial, this.tutorialInput, touch);
  }

  /** ปุ่มของบทแนะนำ: ข้าม (ภารกิจหลักไม่ถูกข้าม) · เริ่มภารกิจ (ขั้นสุดท้าย) */
  tutorialAction(action: 'skip' | 'finish'): void {
    const t = this.tutorial;
    if (!this.ready || !t?.active) return;
    if (action === 'skip') {
      if (!t.skip()) return;
      this.session.toast('ข้ามบทแนะนำแล้ว — ภารกิจหลักยังอยู่ครบ ดูเป้าหมายที่แถบภารกิจ');
      this.saveTutorial();
      return;
    }
    if (t.step === 'finish' && this.tutorialInput && t.event('finish', this.tutorialInput)) this.saveTutorial();
  }

  /* =========================================================
   * ป้ายชื่อและป้ายโต้ตอบ: ขนาดบนจออ่านได้ทุกขนาดหน้าจอ
   * ========================================================= */

  /** จอเล็ก (ภาพเกมถูกย่อ) → ขยายตัวอักษรป้ายในโลกเกมให้ขนาดบนจอยังอ่านได้ · คอมพิวเตอร์ขนาดเดิม */
  private fitLabels(): void {
    const screenPerWorld = CAMERA_ZOOM / Math.max(0.01, this.scale.displayScale.x);
    if (Math.abs(screenPerWorld - this.labelFit) < 0.01) return;
    this.labelFit = screenPerWorld;
    const z = labelSizes(screenPerWorld);
    // พื้นหลังทึบช่วยให้อ่านง่ายบนจอเล็ก (เฉพาะจอสัมผัส — คอมพิวเตอร์คงหน้าตาเดิม)
    const bg = this.touchUi ? '#10141fb8' : null;
    for (const n of this.npcs) {
      n.label.setFontSize(z.npc);
      if (bg) n.label.setBackgroundColor(bg).setPadding(1.5, 2, 1.5, 0.5);
      n.marker.setScale(z.marker);
    }
    for (const t of this.labels.values()) {
      t.setFontSize(z.landmark);
      if (bg) t.setBackgroundColor(bg).setPadding(1.5, 2, 1.5, 0.5);
    }
    this.cueText.setFontSize(z.cue);
    this.cueKey = '';
    this.layoutDirty = true;
  }

  /** แถบบนจอ (DOM) ที่ซ้อนบนภาพเกม แปลงเป็นพิกัดโลกเกม */
  private hudObstaclesWorld(): Box[] {
    const cam = this.cameras.main;
    const k = this.scale.displayScale.x / cam.zoom; // พิกเซลโลกเกมต่อ CSS px
    const v = cam.worldView;
    return hudObstacles.rects.map((r) => ({ x: v.x + r.x * k, y: v.y + r.y * k, w: r.w * k, h: r.h * k }));
  }

  /** พิกัดโลกเกม → CSS px บนหน้าเว็บ (ใช้กับ hook ทดสอบ) */
  private worldToCss(b: Box): Box {
    const cam = this.cameras.main;
    const k = cam.zoom / this.scale.displayScale.x;
    const c = this.game.canvas.getBoundingClientRect();
    return { x: c.left + (b.x - cam.worldView.x) * k, y: c.top + (b.y - cam.worldView.y) * k, w: b.w * k, h: b.h * k };
  }

  /**
   * จัดป้ายชื่อไม่ให้ทับกัน: เป้าหมายที่คุยได้ → NPC ใกล้ผู้เล่น → สถานที่ใกล้ผู้เล่น
   * ป้ายที่ชนเลื่อนขึ้น/ลง หรือซ่อนชั่วคราว (alpha 0) — ไม่เคยแสดงป้ายที่ระบบค้นพบยังไม่อนุญาต (visible = false)
   */
  private layoutWorldLabels(): void {
    this.layoutDirty = false;
    this.layoutInMs = 120;
    const s = this.session;
    const p = s.playerTile;
    const reqs: LabelRequest[] = [];
    const blockers: Box[] = [];
    const npcByKey = new Map<string, NpcInstance>();
    for (const n of this.npcs) {
      // NPC ที่ยังอยู่ใต้หมอก: ป้ายถูกหมอกบังอยู่แล้ว ไม่ต้องจัด
      if (!s.fog.isExplored(n.def.at.x, n.def.at.y)) {
        n.label.setY(n.labelY).setAlpha(1);
        continue;
      }
      blockers.push({ x: n.sprite.x - 8, y: n.sprite.y - 8, w: 16, h: 16 });
      if (n.marker.visible && n.marker.alpha > 0) {
        const m = n.marker.getBounds();
        blockers.push({ x: m.x, y: m.y, w: m.width, h: m.height });
      }
      const h = n.label.displayHeight;
      const key = `npc:${n.def.id}`;
      npcByKey.set(key, n);
      reqs.push({
        id: key,
        box: textBox(n.label, n.labelY),
        priority: (n === this.cueNpc ? -100 : 0) + Math.hypot(n.def.at.x - p.x, n.def.at.y - p.y),
        // ชื่อ NPC อยู่ใต้ตัวละครเสมอ — เลื่อนลงได้ (เลื่อนขึ้นจะทับตัวละคร)
        shifts: [h + 1, 2 * (h + 1)],
      });
    }
    if (this.cue.visible && this.cueRect) blockers.push(this.cueRect);
    // ป้ายที่ถูกแถบบนจอบังครึ่ง ๆ อ่านไม่ได้ → เลื่อนไปที่ว่าง หรือซ่อนไว้จนกว่ากล้องจะเลื่อนพ้น
    blockers.push(...this.hudObstaclesWorld());
    for (const lm of s.level.landmarks) {
      const t = this.labels.get(lm.id);
      // เฉพาะป้ายที่ค้นพบแล้วและไม่ใช่จุดลับที่ยังไม่เปิดเผย (refreshLabels ตั้ง visible ตาม isLandmarkVisible)
      if (!t?.visible) continue;
      const h = t.displayHeight;
      reqs.push({
        id: `lm:${lm.id}`,
        box: textBox(t, this.labelBaseY.get(lm.id) ?? t.y),
        priority: 1000 + Math.hypot(lm.at.x - p.x, lm.at.y - p.y),
        shifts: [-(h + 1), h + 1, -2 * (h + 1), 2 * (h + 1)],
      });
    }
    for (const r of layoutLabels(reqs, blockers)) {
      const n = npcByKey.get(r.id);
      const t = n ? n.label : this.labels.get(r.id.slice(3));
      const base = n ? n.labelY : (this.labelBaseY.get(r.id.slice(3)) ?? 0);
      t?.setY(base + r.dy).setAlpha(r.shown ? 1 : 0);
    }
  }

  /** เข้าใกล้ NPC/จุดสำรวจ → ป้าย "คุย/สำรวจ" เหนือเป้าหมาย + วงแหวนกะพริบ (เป้าหมายเดียวกับปุ่มโต้ตอบ) */
  private updateCue(target: ReturnType<typeof pickInteraction>): void {
    const s = this.session;
    const npc = target?.kind === 'npc' ? this.npcs.find((n) => n.def.id === target.id) : undefined;
    // ป้าย "คุย" ใช้แทนเครื่องหมาย "!" ของ NPC นั้น (ซ่อนเครื่องหมายชั่วคราว คืนเมื่อเดินออกจากระยะ)
    if (this.cueNpc && this.cueNpc !== npc) this.cueNpc.marker.setAlpha(1);
    if (this.cueNpc !== (npc ?? null)) this.layoutDirty = true;
    this.cueNpc = npc ?? null;
    if (!target) {
      if (this.cue.visible) {
        this.cue.setVisible(false);
        this.cueRing.setVisible(false);
        this.cueKey = '';
        this.cueRect = null;
        this.layoutDirty = true;
      }
      return;
    }
    let tbox: Box;
    let x: number;
    let feetY: number;
    if (npc) {
      x = npc.sprite.x;
      feetY = npc.sprite.y + 7;
      // ตัวละคร + ชื่อ (ตำแหน่งปกติ) — ป้ายวางชิดกลุ่มนี้
      tbox = union({ x: npc.sprite.x - 8, y: npc.sprite.y - 9, w: 16, h: 17 }, textBox(npc.label, npc.labelY));
      npc.marker.setAlpha(0);
    } else {
      const at =
        target.kind === 'inspect' ? s.level.inspectPoints?.find((p) => p.id === target.id)?.at : s.landmarkPoints[target.id];
      if (!at) return;
      x = (at.x + 0.5) * S;
      feetY = (at.y + 0.5) * S + 4;
      tbox = { x: at.x * S, y: at.y * S - 2, w: S, h: S + 2 };
    }
    // วางป้ายตามที่ว่าง: เหนือ → ขวา → ซ้าย → ใต้ ไม่ให้ถูกแถบภารกิจ/แถบสถานะ/การ์ดบทแนะนำบัง และเลี่ยงตัวผู้เล่น
    const size = { w: this.cueText.width + 6, h: this.cueText.height + 2 };
    const v = this.cameras.main.worldView;
    const cueInput = {
      target: tbox,
      size,
      gap: 1.5,
      view: { x: v.x + 1, y: v.y + 1, w: v.width - 2, h: v.height - 2 },
      obstacles: this.hudObstaclesWorld(),
      avoid: [{ x: this.player.x - 7, y: this.player.y - 8, w: 14, h: 16 }],
    };
    const place = placeCue(cueInput);
    if (import.meta.env.DEV) this.cueDebug = { input: cueInput, place };
    const key = `${target.kind}:${target.id}:${this.labelFit}:${place.side}`;
    if (key !== this.cueKey) {
      this.cueKey = key;
      // ข้อความเป็นคำกริยาเท่านั้น (คุย/สำรวจ/ตรวจสอบ) — ไม่บอกชื่อสถานที่ลับ · ลูกศรชี้ไปที่เป้าหมาย
      const arrow: Record<CueSide, [string, string]> = { above: ['▼ ', ''], below: ['▲ ', ''], right: ['◀ ', ''], left: ['', ' ▶'] };
      const [pre, post] = arrow[place.side];
      this.cueText.setText(this.touchUi ? `${pre}${target.verb}${post}` : `[E] ${target.verb}`);
      const w = this.cueText.width + 6;
      const h = this.cueText.height + 2;
      this.cueBox.clear();
      this.cueBox.fillStyle(0xffd84d, 1).fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(4, h / 2));
      this.cueBox.lineStyle(1, 0x4a2f16, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(4, h / 2));
      this.cueRing.clear();
      this.cueRing.lineStyle(1.5, 0xffd84d, 1).strokeEllipse(0, 0, 18, 8);
      this.layoutDirty = true;
    }
    const w = this.cueText.width + 6;
    const h = this.cueText.height + 2;
    const cx = place.box.x + place.box.w / 2;
    const cy = place.box.y + place.box.h / 2;
    this.cueSide = place.side;
    this.cueRect = { x: cx - w / 2, y: cy - h / 2, w, h };
    this.cue.setPosition(cx, cy).setVisible(true);
    this.cueRing.setPosition(x, feetY).setVisible(true);
  }

  /* =========================================================
   * Input — ทุกปุ่มผ่านจุดเดียว แยกตามโหมด
   * ========================================================= */

  /**
   * จุดรับคำสั่งเดียวของเกม: คีย์บอร์ดและปุ่มสัมผัส (TouchLayer) ส่งรหัสปุ่มเดียวกันเข้ามาที่นี่
   * กติกาของแต่ละโหมดจึงไม่ถูกเขียนซ้ำ
   */
  dispatchCode(code: string): void {
    if (!this.ready || !this.session) return;
    this.handleCode(code);
  }

  /** ทิศเดินจากจอยสติกสัมผัส (0,0 = หยุด) — ใช้เมื่อไม่มีการเดินอัตโนมัติ */
  setTouchVector(x: number, y: number): void {
    this.touchVector.set(x, y);
  }

  private handleCode(code: string): void {
    const s = this.session;
    const digit = /^(Digit|Numpad)([1-9])$/.exec(code);
    const choice = digit ? Number(digit[2]) - 1 : -1;
    const confirm = code === 'Space' || code === 'Enter' || code === 'NumpadEnter' || code === 'KeyE';

    switch (s.mode) {
      case 'explore':
        if (confirm) this.interact();
        else if (code === 'KeyR') {
          s.odometer.resetTrip();
          s.noteSkill('odometer');
          s.toast('เริ่มวัดระยะใหม่จากจุดนี้');
        } else if (code === 'KeyG') {
          s.showGrid = !s.showGrid;
          this.gridOverlay.setVisible(s.showGrid);
        } else if (code === 'KeyM') this.openMap();
        else if (code === 'KeyN') this.openNotebook();
        else if (code === 'KeyC') this.openCompare();
        else if (code === 'Escape') this.openPause();
        return;

      case 'gridcheck': {
        // กระดานวิเคราะห์ (บท 3: พิกัด · บท 4: หลักฐานรวม) — เลือกก่อน ยังไม่ตัดสิน ต้องกด Enter ยืนยัน
        const count = (s.level.integratedSiteAnalysis ?? s.level.gridSiteAnalysis)?.candidates.length ?? 0;
        if (code === 'Escape' || code === 'KeyC') {
          s.clearAnalysisChoice();
          this.setMode('explore');
        } else if (choice >= 0 && choice < count) {
          if (!s.analysisSolved) {
            s.clearAnalysisChoice();
            s.gridSelection = choice;
            this.bumpUi();
          }
        } else if ((code === 'Enter' || code === 'NumpadEnter' || code === 'Space') && s.gridSelection !== null && !s.analysisSolved) {
          const pick = s.gridSelection;
          let ok = false;
          this.withStepToasts(() => {
            ok = s.chooseAnalysisSite(pick).ok;
          });
          if (ok) s.gridSelection = pick;
          this.bumpUi();
        }
        return;
      }

      case 'compare':
        if (code === 'Escape' || code === 'KeyC') {
          s.lastCompare = null;
          this.setMode('explore');
        } else if (choice >= 0) this.withStepToasts(() => s.chooseSheet(choice));
        return;

      case 'pause':
        if (code === 'Escape') this.pauseAction(0);
        else if (code === 'ArrowUp' || code === 'KeyW') this.movePause(-1);
        else if (code === 'ArrowDown' || code === 'KeyS' || code === 'Tab') this.movePause(1);
        else if (confirm) this.pauseAction(s.pauseIndex);
        // เลือกรายการโดยตรง: ปุ่มตัวเลข 1–4 (ปุ่มเมนูขนาดใหญ่บนจอสัมผัสส่งรหัสนี้)
        else if (choice >= 0 && choice < PAUSE_ITEMS.length) this.pauseAction(choice);
        return;

      case 'dialogue': {
        const view = s.dialogueView;
        if (view?.kind === 'quiz') {
          if (choice >= 0) this.withStepToasts(() => s.answerQuiz(choice));
        } else if (confirm) {
          this.withStepToasts(() => {
            const outcome = s.advanceDialogue();
            if (outcome === 'mission-complete') this.onMissionComplete();
          });
        }
        return;
      }

      case 'notebook':
        if (code === 'Delete' && s.notebookTab === 'records') this.requestReset();
        else if (code === 'KeyN' || code === 'Escape') this.setMode('explore');
        else if (code === 'ArrowRight' || code === 'KeyD' || code === 'Tab') this.switchTab(1);
        else if (code === 'ArrowLeft' || code === 'KeyA') this.switchTab(-1);
        else if (choice >= 0 && s.notebookTab === 'routes') this.chooseRoute(choice);
        return;

      case 'map':
        this.onMapKey(code, choice, confirm);
        return;

      case 'summary':
        // จบบท → ครูเนมมอบภารกิจบทถัดไป (ฉากเชื่อมเรื่อง) · Esc → แผนที่การเดินทาง
        if (confirm) continueStory(this);
        else if (code === 'Escape') this.leave('worldMap');
        return;
    }
  }

  /* ---------------- เปรียบเทียบแผนที่ฐาน (C) ---------------- */

  private openCompare(): void {
    const s = this.session;
    // ด่านที่ใช้พิกัดกริด: C = กระดานวิเคราะห์พิกัด (ด่านที่มีแผนที่ฐานยังใช้หน้าเปรียบเทียบเดิม)
    if (s.level.gridSiteAnalysis || s.level.integratedSiteAnalysis) {
      // บท 3 เปิดตั้งแต่ฉาก 4 · บท 4 เปิดตั้งแต่ฉาก 5 (ตาม availableWhen ของข้อมูลด่าน)
      if (!s.isAnalysisOpen() && !s.analysisSolved) {
        s.toast(
          s.level.integratedSiteAnalysis
            ? 'กระดานวิเคราะห์หลักฐานจะเปิดหลังได้หลักฐานพิกัดจากลุงจำรัส'
            : 'กระดานวิเคราะห์พิกัดจะเปิดหลังฟังเบาะแสจากผู้เก็บบันทึก',
        );
        return;
      }
      s.pinStage = 'none';
      s.clearAnalysisChoice();
      this.setMode('gridcheck');
      return;
    }
    if (s.availableSheets().length < 2) {
      if (s.level.mapComparison) s.toast('ยังไม่มีแผนที่ฐานครบสองฉบับ');
      return;
    }
    s.pinStage = 'none';
    s.lastCompare = null;
    this.setMode('compare');
  }

  /* ---------------- เมนูหยุดเกม (Esc) ---------------- */

  private openPause(): void {
    this.session.pauseIndex = 0;
    this.cancelWalk();
    this.player.setVelocity(0, 0);
    this.setMode('pause');
  }

  private movePause(delta: number): void {
    const n = PAUSE_ITEMS.length;
    this.session.pauseIndex = (this.session.pauseIndex + delta + n) % n;
    this.bumpUi();
  }

  /** เรียกจากคีย์บอร์ด หรือจากการคลิกปุ่มใน UIScene */
  pauseAction(index: number): void {
    if (this.session.mode !== 'pause') return;
    this.session.pauseIndex = index;
    switch (PAUSE_ITEMS[index]) {
      case 'เล่นต่อ':
        this.setMode('explore');
        return;
      case 'คำแนะนำการควบคุม': {
        const settings = getSettings(this);
        settings.update({ showControlsHint: !settings.settings.showControlsHint });
        this.bumpUi();
        return;
      }
      case 'แผนที่การเดินทาง':
        this.leave('worldMap');
        return;
      case 'กลับเมนูหลัก':
        this.leave('menu');
        return;
    }
  }

  /** ออกจากด่าน: บันทึกก่อน แล้วไปหน้าที่เลือก (บันทึกค้างไว้เล่นต่อได้) */
  private leave(to: 'menu' | 'worldMap'): void {
    this.cancelWalk();
    if (this.session.mode === 'pause') this.session.mode = 'explore';
    this.autosave();
    if (to === 'menu') goToMainMenu(this);
    else goToWorldMap(this);
  }

  private setMode(mode: GameSession['mode']): void {
    this.session.mode = mode;
    this.bumpUi();
    if (mode === 'explore') this.autosave();
  }

  private bumpUi(): void {
    this.session.uiVersion++;
  }

  /** ทำงานแล้วแจ้งเตือนฉากที่เพิ่งผ่าน */
  private withStepToasts(fn: () => void): void {
    const s = this.session;
    const before = s.currentStepOrder;
    fn();
    const after = s.currentStepOrder;
    for (const step of s.level.story) {
      if (step.order >= before && step.order < after) s.toast(`ผ่านฉากที่ ${step.order}: ${step.title}`);
    }
    // ฉากถัดไปของบทยังไม่ถูกสร้าง → แจ้ง และเก็บสถานะไว้ (บันทึกอัตโนมัติด้านล่าง)
    if (after !== before && s.currentStep?.status === 'planned') s.toast(`${IN_DEVELOPMENT_MESSAGE} — ความคืบหน้าถูกบันทึกไว้แล้ว`);
    this.refreshMarkers();
    this.refreshLabels();
    this.bumpUi();
    this.autosave();
  }

  /* ---------------- บทสนทนา ---------------- */

  /**
   * โต้ตอบกับเป้าหมายที่เลือกโดย pickInteraction (เกณฑ์เดียวกับข้อความ "พูดคุยกับ…/สำรวจ…" บนจอ)
   * ใช้ทั้งปุ่ม E และปุ่มสัมผัส — ไม่มีอะไรในระยะ = ไม่ทำอะไร
   */
  private interact(): void {
    const s = this.session;
    const target = pickInteraction(s, INTERACT_RADIUS_TILES);
    if (!target) return;
    this.cancelWalk();
    this.player.setVelocity(0, 0);
    if (target.kind === 'npc') {
      const npc = this.npcs.find((n) => n.def.id === target.id);
      if (npc) this.startTalk(npc);
      return;
    }
    if (target.kind === 'inspect') {
      const point = s.level.inspectPoints?.find((p) => p.id === target.id);
      if (point) this.withStepToasts(() => s.inspect(point));
      return;
    }
    // ตรวจยืนยันภาคสนาม (บท 3 ด่านพิกัด / บท 4 หลักฐานรวม)
    this.withStepToasts(() => (s.level.gridSiteAnalysis ? s.startGridVerify(target.id) : s.startIntegratedVerify(target.id)));
  }

  private startTalk(npc: NpcInstance): void {
    this.cancelWalk();
    this.player.setVelocity(0, 0);
    npc.sprite.faceTowards(this.player.x, this.player.y);
    this.withStepToasts(() => this.session.talkTo(npc.def));
  }

  private refreshMarkers(): void {
    for (const n of this.npcs) n.marker.setVisible(this.session.hasNewDialogue(n.def));
    this.layoutDirty = true;
  }

  /* ---------------- สมุดภาคสนาม ---------------- */

  private openNotebook(): void {
    const s = this.session;
    s.routeFeedback = null;
    // ขั้นย่อยที่ต้อง "อ่าน" (เช่น อ่านข้อมูลจากชาวบ้าน) → เปิดที่หน้านั้นให้เลย
    const micro = currentMicro(s);
    if (micro?.step.notebookTab && s.notebookTabs().includes(micro.step.notebookTab)) s.notebookTab = micro.step.notebookTab;
    this.setMode('notebook');
    if (s.notebookTab === 'routes') s.noteSkill('straight-vs-route');
    s.markNotebookViewed();
  }

  private switchTab(delta: number): void {
    const s = this.session;
    const tabs = s.notebookTabs();
    const i = Math.max(0, tabs.indexOf(s.notebookTab));
    s.notebookTab = tabs[(i + delta + tabs.length) % tabs.length];
    if (s.notebookTab === 'routes') s.noteSkill('straight-vs-route');
    s.markNotebookViewed();
    this.bumpUi();
  }

  private chooseRoute(index: number): void {
    const s = this.session;
    const route = s.level.routeAnalysis?.routes[index];
    if (!route) return;
    this.withStepToasts(() => {
      const r = s.chooseRoute(index);
      if (r.blocked === 'missing-clues') {
        s.routeFeedback = 'ต้องมีเบาะแสครบ 3 ประเภทก่อนจึงจะเลือกเส้นทางได้';
      } else if (r.ok) {
        s.routeFeedback = null;
        s.toast(`เส้นทาง ${route.label} สอดคล้องกับหลักฐานทั้งหมด!`);
      } else if (!r.blocked) {
        const why = r.failed.length > 0 ? r.failed.map((f) => ROUTE_CHECK_TEXT[f]).join(' · ') : 'ยังไม่สอดคล้องกับหลักฐาน';
        s.routeFeedback = `เส้นทาง ${route.label} ยังไม่ใช่: ${why} — ลองตรวจเบาะแสอีกครั้ง`;
      }
    });
  }

  /* ---------------- แผนที่และการปักหมุด ---------------- */

  private openMap(): void {
    const s = this.session;
    s.pinFeedback = null;
    if (s.isPinAvailable()) {
      s.pinStage = 'cursor';
      s.pinCursor = s.pinCursor ?? { ...s.playerTile };
    } else {
      s.pinStage = 'none';
    }
    this.setMode('map');
  }

  private onMapKey(code: string, choice: number, confirm: boolean): void {
    const s = this.session;
    // Tab: สลับแผนที่สำรวจ → แผนที่ฐานแต่ละฉบับ (เมื่อมีแผนที่ฐานแล้ว)
    if (code === 'Tab' && s.availableSheets().length > 0 && s.pinStage !== 'wisdom') {
      this.withStepToasts(() => s.cycleSheet());
      return;
    }
    if (code === 'KeyC' && s.pinStage !== 'wisdom') {
      this.openCompare();
      return;
    }
    if (s.pinStage === 'wisdom') {
      if (code === 'Escape') {
        s.pinStage = 'cursor';
        this.bumpUi();
      } else if (choice >= 0 && choice < (s.level.pinTask?.wisdomChoices.length ?? 0)) {
        this.submitPin(choice);
      }
      return;
    }
    if (code === 'KeyM' || code === 'Escape') {
      s.pinStage = 'none';
      this.setMode('explore');
      return;
    }
    if (s.pinStage !== 'cursor' || !s.pinCursor) return;
    const move: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      KeyW: [0, -1],
      ArrowDown: [0, 1],
      KeyS: [0, 1],
      ArrowLeft: [-1, 0],
      KeyA: [-1, 0],
      ArrowRight: [1, 0],
      KeyD: [1, 0],
    };
    const m = move[code];
    if (m) {
      s.pinCursor = {
        x: Phaser.Math.Clamp(s.pinCursor.x + m[0], 0, s.grid.width - 1),
        y: Phaser.Math.Clamp(s.pinCursor.y + m[1], 0, s.grid.height - 1),
      };
      this.bumpUi();
    } else if (confirm) {
      s.pinStage = 'wisdom';
      s.pinFeedback = null;
      this.bumpUi();
    }
  }

  private submitPin(choice: number): void {
    const s = this.session;
    const result = s.submitPin(s.pinCursor!, choice);
    if (result.ok) {
      s.pinStage = 'none';
      s.pinFeedback = null;
      let ending = false;
      this.withStepToasts(() => {
        ending = s.startEnding();
      });
      // ตอนจบ (รับรหัส) ต้องไขปริศนาของบทให้ครบก่อน — ถ้ายังไม่ครบ บอกขั้นต่อไป
      s.toast(ending ? 'บันทึกตำแหน่งเข้าสมุดภาคสนามแล้ว — ครูเนมกำลังติดต่อมา' : 'ปักหมุดสำเร็จ! ต่อไป: ไขปริศนาเพื่อรับรหัส (ดูแถบภารกิจ)');
      // ยังไม่จบบท → ปิดแผนที่กลับไปเดิน (แถบภารกิจแสดงขั้นต่อไปทันที)
      if (!ending) this.setMode('explore');
      return;
    }
    s.pinStage = 'cursor';
    s.pinFeedback = `ยังบันทึกไม่ได้: ${pinProblemText(s, result.problems)}`;
    this.bumpUi();
  }

  /* ---------------- จบภารกิจ ---------------- */

  private onMissionComplete(): void {
    const s = this.session;
    const sum = s.summary();
    const ending = s.level.ending;
    this.progress.completeLevel(
      {
        levelId: s.level.id,
        completedAt: new Date().toISOString(),
        distanceMeters: Math.round(sum.distanceMeters),
        cluesFound: sum.cluesFound,
        cluesTotal: sum.cluesTotal,
        mistakes: sum.mistakes,
        elapsedMs: Math.round(sum.elapsedMs),
        skills: sum.skills,
        quests: sum.quests,
        evidenceFound: s.evidence.length,
        evidenceTotal: s.level.evidence?.length ?? 0,
        codePiece: ending?.codePiece ?? null,
      },
      s.level.unlocks,
    );
    const slot = s.level.unlocks ? getLevelSlot(s.level.unlocks) : undefined;
    const chapter = s.level.unlocks ? getChapter(s.level.unlocks) : undefined;
    this.registry.set(REGISTRY_UNLOCKED, slot?.name ?? (chapter ? `บทที่ ${chapter.order}: ${chapter.title}` : null));
    this.registry.set(REGISTRY_CODE_PIECES, this.progress.collectedCodePieces());
    s.toast('บันทึกการผ่านด่านแล้ว');
    // จบบทสรุป = จบเกม → ฉากสรุปการเดินทาง
    if (isCampaignComplete(CHAPTERS, this.progress.data)) this.time.delayedCall(400, () => goToEnding(this));
  }

  /* =========================================================
   * หมอก และการค้นพบ
   * ========================================================= */

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

    const found = s.checkLandmarkDiscovery();
    for (const id of found) {
      const lm = s.level.landmarks.find((l) => l.id === id)!;
      // จุดลับ (revealFlag) ไม่แจ้งเตือน เพื่อไม่ให้เฉลยปริศนา
      if (!force && s.isLandmarkVisible(lm)) s.toast(`ค้นพบจุดสังเกต: ${lm.name}`);
    }
    if (found.length > 0) {
      this.refreshLabels();
      this.refreshMarkers();
      this.bumpUi();
    }

    // พื้นที่ที่เรียกบทสนทนาอัตโนมัติ (เช่น มาถึงศาลาชุมชน)
    if (s.mode === 'explore') {
      const trigger = s.triggerAt(s.playerTile);
      const npc = trigger && this.npcs.find((n) => n.def.id === trigger.npcId);
      if (trigger && npc) {
        s.firedTriggers.add(trigger.id);
        this.startTalk(npc);
      }
    }
  }

  /** เรียงลำดับการวาดตามแกน y: ตัวที่อยู่ใต้กว่า (ใกล้กล้องกว่า) วาดทับ */
  private depthForY(y: number): number {
    return DEPTH.characters + y / (this.session.grid.height * S);
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

  /* =========================================================
   * Hook สำหรับทดสอบอัตโนมัติ (เฉพาะ npm run dev)
   * เดินด้วย physics จริง → ระยะทางที่นับได้เป็นของจริง ไม่มีการวาร์ป
   * ========================================================= */

  private installTestHooks(): void {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __TEST__: unknown }).__TEST__ = {
      session: this.session,
      walkTo: (x: number, y: number) => this.walkTo({ x, y }),
      tutorial: () => this.tutorial?.save ?? this.progress.tutorialSave(),
      cueDebug: () => this.cueDebug,
      cue: () =>
        this.cue.visible && this.cueRect
          ? { text: this.cueText.text, x: this.cue.x, y: this.cue.y, side: this.cueSide, css: this.worldToCss(this.cueRect) }
          : null,
      labels: () => ({
        fit: this.labelFit,
        npc: this.npcs.map((n) => ({
          name: n.def.name,
          size: n.label.style.fontSize,
          visible: n.label.visible,
          // แสดงจริง = มองเห็น ไม่ถูกซ่อนเพราะชน และไม่อยู่ใต้หมอก
          shown: n.label.visible && n.label.alpha > 0 && this.session.fog.isExplored(n.def.at.x, n.def.at.y),
          css: this.worldToCss(textBox(n.label)),
        })),
        landmarks: [...this.labels.entries()].map(([id, t]) => ({
          id,
          text: t.text,
          visible: t.visible,
          shown: t.visible && t.alpha > 0,
          size: t.style.fontSize,
          css: this.worldToCss(textBox(t)),
        })),
      }),
    };
  }

  private walkTo(target: TilePoint): Promise<boolean> {
    this.cancelWalk();
    const grid = this.session.grid;
    // NPC ไม่อยู่ใน WorldGrid แต่ชนได้ จึงต้องหลบช่องที่ NPC ยืน
    const npcTiles = new Set(this.npcs.map((n) => `${n.def.at.x},${n.def.at.y}`));
    const passable = (x: number, y: number) => !grid.isBlocked(x, y) && !npcTiles.has(`${x},${y}`);
    const path = findPath(grid, this.session.playerTile, target, passable);
    if (!path) return Promise.resolve(false);
    return new Promise((resolve) => {
      this.walk = { path, index: 1, resolve, lastX: this.player.x, lastY: this.player.y, stuckMs: 0 };
    });
  }

  private cancelWalk(): void {
    if (this.walk) {
      this.walk.resolve(false);
      this.walk = null;
    }
  }

  private scriptedDirection(delta: number): Phaser.Math.Vector2 | null {
    const w = this.walk;
    if (!w) return null;
    if (this.session.mode !== 'explore') {
      this.cancelWalk();
      return null;
    }
    if (Math.hypot(this.player.x - w.lastX, this.player.y - w.lastY) > 0.5) {
      w.lastX = this.player.x;
      w.lastY = this.player.y;
      w.stuckMs = 0;
    } else if ((w.stuckMs += delta) > 1500) {
      this.cancelWalk();
      return null;
    }
    if (w.index >= w.path.length) {
      this.walk = null;
      w.resolve(true);
      return null;
    }
    const tile = w.path[w.index];
    const feet = this.player.feet;
    const dx = (tile.x + 0.5) * S - feet.x;
    const dy = (tile.y + 0.5) * S - feet.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      w.index++;
      return this.scriptedDirection(0);
    }
    return new Phaser.Math.Vector2(Math.abs(dx) < 1 ? 0 : Math.sign(dx), Math.abs(dy) < 1 ? 0 : Math.sign(dy));
  }
}
