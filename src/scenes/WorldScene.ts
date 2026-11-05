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
import { REGISTRY_CODE_PIECES, REGISTRY_LEVEL_ID, REGISTRY_SESSION, REGISTRY_UNLOCKED } from './events';
import { canStartLevel, continueStory, getSettings, getProgress, goToEnding, goToMainMenu, goToWorldMap, SCENE, type LevelStartData } from './navigation';

/** ตัวเลือกในเมนูหยุดเกม (Esc) — ลำดับต้องตรงกับ PauseOverlay */
export const PAUSE_ITEMS = ['เล่นต่อ', 'คำแนะนำการควบคุม', 'แผนที่การเดินทาง', 'กลับเมนูหลัก'] as const;

const S = TILE_SIZE_PX;
const DEPTH = { characters: 20, labels: 40, grid: 60, fog: 100 } as const;

interface NpcInstance {
  def: NpcDefinition;
  sprite: Character;
  marker: Phaser.GameObjects.Image;
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
    kb.addCapture([K.SPACE, K.TAB, K.UP, K.DOWN, K.LEFT, K.RIGHT]);

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

    kb.on('keydown', (ev: KeyboardEvent) => this.handleCode(ev.code));

    // ---- ความคืบหน้า: เล่นต่อจากที่บันทึกไว้ (เพิ่ม ?new=1 ใน URL เพื่อเริ่มใหม่) ----
    this.progress = getProgress(this);
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
  }

  /* ---------------- สมุดภาคสนาม ---------------- */

  private openNotebook(): void {
    this.session.routeFeedback = null;
    this.setMode('notebook');
    if (this.session.notebookTab === 'routes') this.session.noteSkill('straight-vs-route');
  }

  private switchTab(delta: number): void {
    const s = this.session;
    const tabs = s.notebookTabs();
    const i = Math.max(0, tabs.indexOf(s.notebookTab));
    s.notebookTab = tabs[(i + delta + tabs.length) % tabs.length];
    if (s.notebookTab === 'routes') s.noteSkill('straight-vs-route');
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
      s.toast('บันทึกตำแหน่งเข้าสมุดภาคสนามแล้ว — ครูเนมกำลังติดต่อมา');
      this.withStepToasts(() => s.startEnding());
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
