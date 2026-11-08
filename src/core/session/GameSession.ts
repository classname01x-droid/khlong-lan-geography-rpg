import type {
  ClueDefinition,
  ClueType,
  Condition,
  DialogueNode,
  DialogueVariant,
  Effect,
  BaseMapDefinition,
  InspectPoint,
  Landmark,
  LevelDefinition,
  NpcDefinition,
  ObjectiveCondition,
  QuestDefinition,
  QuestKind,
  RouteDefinition,
  SettlementTopic,
  StoryStep,
  TriggerZone,
} from '../../content/types';
import { DialogueRunner, type DialogueView } from '../dialogue/DialogueRunner';
import { directionFromVector, bearingDeg, bearingToDirection8, THAI_DIRECTION, type Direction8 } from '../direction/Compass';
import { FogOfWar } from '../fog/FogOfWar';
import type { SkillId } from '../mission/skills';
import { DistanceTracker } from '../movement/DistanceTracker';
import {
  evaluateRoute,
  measureRoute,
  roadMetersBetween,
  straightMeters,
  type RouteCheck,
  type RouteExpectation,
  type RouteMetrics,
} from '../route/RouteAnalysis';
import type { ScaleSystem } from '../scale/ScaleSystem';
import { resolveGeoTemplate, ROAD_TEMPLATE_PATTERN } from '../text/geoTemplate';
import type { TilePoint } from '../world/types';
import type { WorldGrid } from '../world/WorldGrid';
import { ElevationModel } from '../world/Elevation';
import { analyzeWaterway, type WaterwayAnalysis } from '../world/Waterway';
import { evaluateSite, type SiteCheck, type SiteEvidence } from '../site/SiteAnalysis';
import { checkSheet, type SheetReport, type TruthLandmark } from '../map/BaseMapCheck';
import { evaluateGridSite, type GridSiteEvidence, type GridSiteReport } from '../site/GridSiteAnalysis';
import {
  evaluateIntegratedSite,
  type IntegratedCheck,
  type IntegratedEvidence,
  type IntegratedReport,
  type SiteFacts,
} from '../site/IntegratedSiteAnalysis';
import { GridSystem, type GridRef } from '../world/GridSystem';
import { readMeasure, type MeasureReading, type MeasureState } from '../measure/Measure';
import {
  analyzeSettlement,
  explainSettlementPart,
  LANDFORM_LABEL,
  type SettlementReport,
  type SettlementWorld,
} from '../site/SettlementAnalysis';
import { currentMicro } from '../guide/MicroQuest';

export type SessionMode = 'explore' | 'dialogue' | 'map' | 'notebook' | 'summary' | 'pause' | 'compare' | 'gridcheck';
export type NotebookTab = 'quests' | 'clues' | 'routes' | 'records';
export const NOTEBOOK_TABS: readonly NotebookTab[] = ['quests', 'clues', 'routes', 'records'];

export type QuestStatus = 'locked' | 'active' | 'completed';

export const QUEST_KIND_LABEL: Record<QuestKind, string> = {
  main: 'ภารกิจหลัก',
  side: 'ภารกิจรอง',
  mystery: 'ภารกิจปริศนา',
};

export interface QuestView {
  def: QuestDefinition;
  status: QuestStatus;
  objectivesDone: boolean[];
}

export type QuestCounts = Record<QuestKind, { done: number; total: number }>;

/** สถานะที่บันทึกได้ของการเล่นกลางด่าน (JSON) */
export interface SessionSnapshot {
  version: 1;
  levelId: string;
  /** รุ่นเนื้อหาด่านตอนบันทึก (ไม่มี = ด่านที่ไม่เคยกำหนดรุ่น) */
  contentVersion?: number;
  flags: string[];
  clues: string[];
  evidence: string[];
  mistakes: { quiz: number; route: number; pin: number; compare?: number };
  skills: string[];
  firedTriggers: string[];
  seenVariants: string[];
  talkedTo: string[];
  messages: Array<{ speaker: string; text: string }>;
  quests: Record<string, QuestStatus>;
  fog: string;
  totalMeters: number;
  elapsedMs: number;
  player: TilePoint;
  pinnedAt: TilePoint | null;
  completed: boolean;
  /** ประวัติการเลือกจุดในกระดานวิเคราะห์พิกัด (ไม่มี = บันทึกรุ่นก่อน) */
  gridAttempts?: Array<{ landmarkId: string; ok: boolean }>;
  /** การวิเคราะห์พื้นที่ตั้งถิ่นฐาน (บทที่ 3) — ไม่มี = ด่านนี้ไม่ใช้/บันทึกรุ่นก่อน */
  settlement?: { attempts: SettlementAttempt[]; chosen: TilePoint | null };
}

/** ประวัติการวิเคราะห์พื้นที่หนึ่งครั้ง (ข้อมูลเล็ก คำนวณคะแนนใหม่จากแผนที่ได้เสมอ) */
export interface SettlementAttempt {
  x: number;
  y: number;
  percent: number;
  passed: boolean;
  weak: SettlementTopic[];
}

export const CLUE_TYPE_LABEL: Record<ClueType, string> = {
  direction: 'ทิศทาง',
  distance: 'ระยะทาง',
  landmark: 'จุดสังเกต',
  elevation: 'ระดับความสูง',
  symbol: 'สัญลักษณ์แผนที่',
  comparison: 'เปรียบเทียบแผนที่',
  coordinate: 'พิกัดกริด',
};

const CLUE_SKILL: Record<ClueType, SkillId> = {
  direction: 'direction',
  distance: 'scale',
  landmark: 'landmark',
  elevation: 'elevation',
  symbol: 'map-symbols',
  comparison: 'map-compare',
  coordinate: 'grid-reference',
};

export interface RouteRow {
  def: RouteDefinition;
  metrics: RouteMetrics;
  /** ผู้เล่นค้นพบปลายทางแล้วหรือยัง */
  explored: boolean;
  /** จุดสังเกตบนเส้นทางที่ผู้เล่นค้นพบแล้ว */
  seenLandmarks: string[];
}

export interface RouteChoiceResult {
  ok: boolean;
  failed: RouteCheck[];
  blocked?: 'missing-clues' | 'already-solved' | 'no-route';
}

export type PinProblem = 'unexplored' | 'location' | 'wisdom' | 'evidence' | 'far';

export interface GridChoiceResult {
  ok: boolean;
  blocked?: 'not-available' | 'missing-evidence' | 'already-solved';
  chosenId: string | null;
  reports: Record<string, GridSiteReport>;
  missingClues: string[];
  /** จุดที่เลือกแต่ยังไม่ได้ไปสำรวจด้วยตัวเอง */
  notSurveyed: string[];
}

export interface IntegratedChoiceResult {
  ok: boolean;
  blocked?: 'not-available' | 'missing-evidence' | 'already-solved';
  chosenId: string | null;
  reports: Record<string, IntegratedReport>;
  facts: Record<string, SiteFacts>;
  missingClues: string[];
  notSurveyed: string[];
}

export interface CompareResult {
  ok: boolean;
  blocked?: 'not-available' | 'missing-evidence' | 'already-solved';
  chosenId: string | null;
  /** รายงานการตรวจของทุกฉบับ — ใช้อธิบายเหตุผล */
  reports: Record<string, SheetReport>;
  missing: { observations: string[]; clues: string[] };
}

export interface PinResult {
  ok: boolean;
  problems: PinProblem[];
}

export interface LevelSummary {
  distanceMeters: number;
  cluesFound: number;
  cluesTotal: number;
  mistakes: number;
  mistakesBy: { quiz: number; route: number; pin: number; compare: number };
  elapsedMs: number;
  skills: SkillId[];
  quests: QuestCounts;
}

type DialoguePurpose = 'npc' | 'ending';

interface ActiveDialogue {
  runner: DialogueRunner;
  purpose: DialoguePurpose;
  npcId: string | null;
  variantKey: string | null;
}

export type DialogueOutcome = 'continue' | 'ended' | 'mission-complete';

/**
 * สถานะของการเล่นหนึ่งรอบ (ข้อมูลล้วน ไม่มี Phaser)
 * WorldScene เป็นผู้สั่งงาน, UIScene เป็นผู้อ่าน — ตรรกะภารกิจทั้งหมดอยู่ที่นี่จึงทดสอบได้ด้วย unit test
 */
export class GameSession {
  readonly fog: FogOfWar;
  readonly odometer: DistanceTracker;
  readonly discoveredLandmarks = new Set<string>();
  readonly talkedTo = new Set<string>();
  /** ตำแหน่งจุดสังเกตตามข้อมูลด่าน + จุด "chosen" (พื้นที่ที่ผู้เล่นเลือกผ่านการวิเคราะห์) ใช้กับตัวแปรข้อความ {{grid:chosen}} {{dist:a>chosen}} */
  readonly landmarkPoints: Record<string, TilePoint>;

  readonly flags = new Set<string>();
  /** id เบาะแสตามลำดับที่ได้รับ */
  readonly clues: string[] = [];
  readonly evidence: string[] = [];
  readonly mistakes = { quiz: 0, route: 0, pin: 0, compare: 0 };
  readonly skills = new Set<SkillId>();
  readonly firedTriggers = new Set<string>();
  readonly seenVariants = new Set<string>();
  /** ข้อความครูที่ได้รับผ่านสมุดภาคสนาม (อ่านซ้ำได้) */
  readonly messages: Array<{ speaker: string; text: string }> = [];
  /** ข้อความแจ้งเตือนที่รอให้ UI แสดง */
  readonly pendingToasts: string[] = [];

  readonly questStatus = new Map<string, QuestStatus>();
  readonly routeMetrics = new Map<string, RouteMetrics>();
  /** แบบจำลองความสูง (null = ด่านนี้ไม่มีข้อมูลความสูง) */
  readonly elevation: ElevationModel | null;
  /** ระบบพิกัดกริดจำลอง (null = ด่านนี้ไม่ใช้พิกัดกริด) */
  readonly coords: GridSystem | null;
  /** ผลวิเคราะห์ลำน้ำ (ต้นน้ำ/ปลายน้ำ/ทิศน้ำไหล) คำนวณจากระดับความสูง */
  readonly waterways = new Map<string, WaterwayAnalysis>();
  readonly routeMeters: Record<string, number> = {};

  mode: SessionMode = 'explore';
  /** เพิ่มค่าทุกครั้งที่สถานะซึ่ง UI แสดงเปลี่ยน (UI จะวาด overlay ใหม่) */
  uiVersion = 0;
  showGrid = false;
  playerTile: TilePoint;
  facing: Direction8 = 'S';
  elapsedMs = 0;
  completed = false;
  notebookTab: NotebookTab = 'quests';
  routeFeedback: string | null = null;
  pinCursor: TilePoint | null = null;
  pinStage: 'none' | 'cursor' | 'wisdom' = 'none';
  pinFeedback: string | null = null;
  pinnedAt: TilePoint | null = null;
  /** หลักฐานที่ยังขาดจากการปักหมุดครั้งล่าสุด (id) — ใช้บอกผู้เล่นเฉพาะส่วนที่ยังไม่มี */
  pinMissingEvidence: string[] = [];
  /** ตัวเลือกที่โฟกัสอยู่ในเมนูหยุดเกม */
  pauseIndex = 0;
  /** แผ่นแผนที่ที่กำลังดู: แผนที่สำรวจ (ปัจจุบัน) หรือแผนที่เก่า */
  mapSheet = 'current';
  /** ผลการเลือกแผนที่ครั้งล่าสุด (ให้ UI แสดงคำอธิบาย) */
  lastCompare: CompareResult | null = null;
  /** ผลการเลือกจุดเป้าหมายในหน้าตรวจพิกัดครั้งล่าสุด */
  lastGridChoice: GridChoiceResult | null = null;
  /** รหัสลับที่เก็บได้จากแต่ละบท (WorldScene ตั้งจาก ProgressStore) — ใช้ในบทสรุป */
  campaignCodes: Record<string, string> = {};
  /** ผลการเลือกจุดในกระดานวิเคราะห์หลักฐานรวมครั้งล่าสุด (ด่านสุดท้าย) */
  lastIntegratedChoice: IntegratedChoiceResult | null = null;
  /** จุดที่เลือกไว้ในกระดานวิเคราะห์พิกัด (ยังไม่ยืนยัน) */
  gridSelection: number | null = null;
  /** ประวัติการยืนยันคำตอบในกระดานวิเคราะห์พิกัด (เปิดอ่านย้อนหลังได้ และบันทึกลงข้อมูลเล่นต่อ) */
  readonly gridAttempts: Array<{ landmarkId: string; ok: boolean }> = [];
  /** ตำแหน่งจริงของผู้เล่น (พิกเซลโลกเกม) — WorldScene ตั้งทุกเฟรม ใช้คำนวณระยะวัดแบบเรียลไทม์ */
  playerPx: { x: number; y: number };
  /** การวัดระยะที่กำลังทำ (null = ไม่ได้วัด) — ภารกิจที่มีจุดอ้างอิงกลับมาวัดต่อเองหลังโหลด (จาก flag "measured:<จุด>") */
  measure: MeasureState | null = null;
  /** เปิดแผนที่ครั้งถัดไปให้เลื่อนไปที่ช่องนี้ (ปุ่ม "ดูตำแหน่งบนแผนที่") */
  mapFocus: TilePoint | null = null;
  /** วิเคราะห์ความเหมาะสมของพื้นที่ (บทที่ 3): ประวัติ · พื้นที่ที่ผ่าน · ผลล่าสุด (สถานะของ UI) */
  readonly settlementAttempts: SettlementAttempt[] = [];
  settlementChosen: TilePoint | null = null;
  lastSettlement: SettlementReport | null = null;
  /** เบาะแสที่เพิ่งอ่านครั้งแรกในการเปิดสมุดครั้งนี้ (ป้าย "ใหม่") — สถานะของ UI ไม่บันทึก */
  readonly newClues: string[] = [];
  /** NPC ที่มีเป้าหมาย "เดินไปพบ" (จด flag near:<id> เมื่อเข้าใกล้) */
  private readonly nearTargets: Set<string>;

  private dialogue: ActiveDialogue | null = null;

  constructor(
    readonly level: LevelDefinition,
    readonly grid: WorldGrid,
    readonly scale: ScaleSystem,
  ) {
    this.fog = new FogOfWar(grid.width, grid.height);
    this.odometer = new DistanceTracker(scale);
    this.playerTile = { ...level.spawn };
    this.playerPx = { x: scale.tileCenterPx(level.spawn.x), y: scale.tileCenterPx(level.spawn.y) };
    this.nearTargets = new Set(
      level.story.flatMap((st) => (st.micro ?? []).flatMap((m) => nearIds(m.done))),
    );
    this.landmarkPoints = Object.fromEntries(level.landmarks.map((l) => [l.id, l.at]));
    this.elevation = level.map.elevation ? new ElevationModel(level.map.elevation) : null;
    this.coords = level.grid ? new GridSystem(level.grid, grid.width, grid.height, scale) : null;
    if (this.elevation) {
      for (const w of level.waterways ?? []) this.waterways.set(w.id, analyzeWaterway(w.points, this.elevation));
    }
    this.measureRoutes();
    this.updateQuests(true);
  }

  /* ---------------- พื้นฐาน ---------------- */

  /** อัปเดตทิศที่หันจากเวกเตอร์ความเร็ว */
  updateFacing(vx: number, vy: number): void {
    this.facing = directionFromVector(vx, vy) ?? this.facing;
  }

  /** แปลงตัวแปรในข้อความเป็นตัวเลข/ทิศที่คำนวณจากแผนที่ */
  resolveText(text: string): string {
    const elevation = this.elevation;
    // {{gridrecord}} = พิกัดตามที่เขียนในบันทึกสำรวจของด่าน (ข้อมูลเดียวกับที่ใช้ตรวจจุดเป้าหมาย)
    const record = this.level.gridSiteAnalysis?.record;
    if (record) text = text.replaceAll('{{gridrecord}}', GridSystem.format(record));
    // {{code:<levelId>}} = รหัสลับที่ผู้เล่นเก็บได้จริงจากบทนั้น (ตั้งจากข้อมูลบันทึก — ยังไม่ได้ = "?")
    text = text.replace(/\{\{code:([\w-]+)\}\}/g, (_m, id: string) => this.campaignCodes[id] ?? '?');
    // {{road:a>b}} = ระยะตามถนน (คำนวณจากถนนในโลกเกม) · {{ia:...}} = ค่าจากหลักฐานรวมของด่าน
    text = text.replace(ROAD_TEMPLATE_PATTERN, (match, a: string, b: string) => {
      const m = this.roadMetersBetweenLandmarks(a, b);
      return m === null ? match : (Math.round(m / 10) * 10).toLocaleString('en-US');
    });
    text = this.resolveIntegratedText(text);
    text = this.resolveSettlementText(text);
    // "site-analysis" ในตัวแปรข้อความ = จุดที่ระบบวิเคราะห์ว่าผ่านหลักฐานทุกข้อ (ไม่เขียนชื่อจุดคำตอบในเนื้อหา)
    if (text.includes('site-analysis}}')) {
      const target = this.siteTargetId();
      if (target) text = text.replace(/([:>])site-analysis\}\}/g, `$1${target}}}`);
    }
    return resolveGeoTemplate(text, this.landmarkPoints, this.scale, this.routeMeters, {
      heightAt: elevation ? (p) => elevation.heightAt(p.x, p.y) : undefined,
      flow: Object.fromEntries([...this.waterways].map(([id, w]) => [id, w.flowDirection])),
      grid: this.coords,
    });
  }

  /** ตรวจว่าจุดสังเกตใดเพิ่งถูกเปิดหมอก; คืนรายการที่เพิ่งค้นพบ */
  checkLandmarkDiscovery(): string[] {
    const found: string[] = [];
    for (const lm of this.level.landmarks) {
      if (!this.discoveredLandmarks.has(lm.id) && this.fog.isExplored(lm.at.x, lm.at.y)) {
        this.discoveredLandmarks.add(lm.id);
        found.push(lm.id);
      }
    }
    if (found.length > 0) this.updateQuests();
    return found;
  }

  /** จุดสังเกตนี้แสดงป้าย/บนแผนที่ได้หรือยัง (ค้นพบแล้ว และไม่ใช่จุดลับที่ยังไม่เปิดเผย) */
  isLandmarkVisible(lm: Landmark): boolean {
    return (
      this.discoveredLandmarks.has(lm.id) && lm.showLabel && (!lm.revealFlag || this.flags.has(lm.revealFlag))
    );
  }

  /**
   * แสดงบนแผนที่สำรวจได้หรือไม่: ค้นพบแล้ว หรือมีคนบอกตำแหน่งแล้ว (knownWhen)
   * จุดลับ (revealFlag) ต้องค้นพบและเปิดเผยแล้วเท่านั้น
   */
  isLandmarkOnMap(lm: Landmark): boolean {
    if (this.isLandmarkVisible(lm)) return true;
    return !lm.revealFlag && lm.showLabel && !!lm.knownWhen && this.matches(lm.knownWhen);
  }

  /**
   * ผู้เล่นเปิดดูสมุดภาคสนามหน้าปัจจุบัน — หน้าเบาะแส: จดว่าได้อ่านเบาะแสที่มีอยู่แล้ว (flag "read:<เบาะแส>")
   * เก็บใน flags เดิม (อยู่ในบันทึกกลางด่านอยู่แล้ว) จึงไม่ต้องเพิ่มข้อมูลบันทึก
   */
  markNotebookViewed(): void {
    if (this.notebookTab !== 'clues') return;
    let changed = false;
    for (const id of this.clues) {
      if (!this.flags.has(`read:${id}`)) {
        this.flags.add(`read:${id}`);
        // เบาะแสที่เพิ่งได้อ่านครั้งแรก → ติดป้าย "ใหม่" ในสมุดจนกว่าจะเปิดสมุดครั้งถัดไป
        if (!this.newClues.includes(id)) this.newClues.push(id);
        changed = true;
      }
    }
    if (changed) this.updateQuests();
  }

  noteSkill(skill: SkillId): void {
    if (this.skills.has(skill)) return;
    this.skills.add(skill);
    this.updateQuests();
  }

  toast(message: string): void {
    this.pendingToasts.push(message);
  }

  drainToasts(): string[] {
    return this.pendingToasts.splice(0, this.pendingToasts.length);
  }

  /** หน้าในสมุดภาคสนามของด่านนี้ (หน้าวิเคราะห์เส้นทางมีเฉพาะด่านที่มีการวิเคราะห์เส้นทาง) */
  notebookTabs(): NotebookTab[] {
    return NOTEBOOK_TABS.filter((t) => t !== 'routes' || !!this.level.routeAnalysis);
  }

  /* ---------------- ฉากและเงื่อนไข ---------------- */

  isStepComplete(step: StoryStep): boolean {
    const c = step.completeWhen;
    if (!c) return false;
    if (c.type === 'talk') return this.talkedTo.has(c.npcId);
    if (c.type === 'all') return c.of.every((o) => this.objectiveDone(o));
    return this.flags.has(c.flag);
  }

  /** ฉากปัจจุบัน = ฉากแรกที่ยังไม่ผ่าน */
  get currentStep(): StoryStep | undefined {
    return this.level.story.find((s) => !this.isStepComplete(s));
  }

  /** ลำดับฉากปัจจุบัน (ผ่านครบแล้ว = จำนวนฉาก + 1) */
  get currentStepOrder(): number {
    return this.currentStep?.order ?? this.level.story.length + 1;
  }

  matches(cond: Condition | undefined): boolean {
    if (!cond) return true;
    const step = this.currentStepOrder;
    if (cond.minStep !== undefined && step < cond.minStep) return false;
    if (cond.maxStep !== undefined && step > cond.maxStep) return false;
    if (cond.flags?.some((f) => !this.flags.has(f))) return false;
    if (cond.notFlags?.some((f) => this.flags.has(f))) return false;
    if (cond.clues?.some((c) => !this.clues.includes(c))) return false;
    return true;
  }

  /* ---------------- บทสนทนา ---------------- */

  pickDialogue(npc: NpcDefinition): { key: string; variant: DialogueVariant } | null {
    const index = npc.dialogue.findIndex((v) => this.matches(v.when));
    if (index < 0) return null;
    return { key: `${npc.id}#${index}`, variant: npc.dialogue[index] };
  }

  /** NPC มีเรื่องใหม่ที่ยังไม่ได้ฟังหรือไม่ (ใช้แสดงเครื่องหมาย "!") */
  hasNewDialogue(npc: NpcDefinition): boolean {
    const pick = this.pickDialogue(npc);
    return !!pick && !pick.variant.ambient && !this.seenVariants.has(pick.key);
  }

  get dialogueView(): DialogueView | null {
    return this.dialogue?.runner.view ?? null;
  }

  get inDialogue(): boolean {
    return this.dialogue !== null;
  }

  talkTo(npc: NpcDefinition): boolean {
    const pick = this.pickDialogue(npc);
    if (!pick) return false;
    this.startDialogue(pick.variant.nodes, 'npc', npc.id, pick.key);
    return true;
  }

  /** ครูติดต่อผ่านสมุดภาคสนามเพื่อสรุปภารกิจ */
  startEnding(): boolean {
    const ending = this.level.ending;
    if (!ending || this.completed) return false;
    // ห้ามข้ามเงื่อนไขจบด่าน: ด่านที่มีการปักหมุดต้องปักหมุดผ่านก่อน (รหัสลับได้จากตอนจบเท่านั้น)
    if (this.level.pinTask && !this.pinSolved) return false;
    if (ending.startWhen && !this.matches(ending.startWhen)) return false;
    for (const m of ending.messages) this.messages.push({ speaker: m.speaker, text: this.resolveText(m.text) });
    this.startDialogue(ending.messages, 'ending', null, null);
    return true;
  }

  private startDialogue(
    nodes: DialogueNode[],
    purpose: DialoguePurpose,
    npcId: string | null,
    key: string | null,
  ): DialogueOutcome {
    const runner = new DialogueRunner(nodes.filter((n) => !n.when || this.matches(n.when)), {
      resolveText: (t) => this.resolveText(t),
      getQuiz: (id) => this.level.quizzes?.find((q) => q.id === id),
      applyEffect: (e) => this.applyEffect(e),
      onQuizAnswer: (_id, correct) => {
        if (!correct) this.mistakes.quiz++;
      },
    });
    this.dialogue = { runner, purpose, npcId, variantKey: key };
    this.mode = 'dialogue';
    if (runner.done) return this.finishDialogue();
    return 'continue';
  }

  advanceDialogue(): DialogueOutcome {
    if (!this.dialogue) return 'ended';
    this.dialogue.runner.advance();
    return this.dialogue.runner.done ? this.finishDialogue() : 'continue';
  }

  answerQuiz(choiceIndex: number): boolean | null {
    if (!this.dialogue) return null;
    return this.dialogue.runner.answer(choiceIndex);
  }

  private finishDialogue(): DialogueOutcome {
    const d = this.dialogue!;
    this.dialogue = null;
    if (d.npcId) this.talkedTo.add(d.npcId);
    if (d.variantKey) this.seenVariants.add(d.variantKey);
    this.updateQuests();
    if (d.purpose === 'ending') {
      this.completeMission();
      this.mode = 'summary';
      return 'mission-complete';
    }
    // บทที่จบด้วยบทสนทนา (ไม่มีปักหมุด): ครบเงื่อนไขแล้วต่อเข้าตอนจบทันที
    const ending = this.level.ending;
    if (ending?.startWhen && !this.completed && this.matches(ending.startWhen) && this.startEnding()) return 'continue';
    this.mode = 'explore';
    return 'ended';
  }

  applyEffect(effect: Effect): void {
    switch (effect.type) {
      case 'flag':
        this.flags.add(effect.flag);
        return;
      case 'clue': {
        const clue = this.getClue(effect.clueId);
        if (!clue || this.clues.includes(clue.id)) return;
        this.clues.push(clue.id);
        this.skills.add(CLUE_SKILL[clue.type]);
        this.pendingToasts.push(`บันทึกเบาะแส [${CLUE_TYPE_LABEL[clue.type]}] ลงสมุดภาคสนามแล้ว (กด N)`);
        return;
      }
      case 'evidence': {
        const ev = this.level.evidence?.find((e) => e.id === effect.evidenceId);
        if (!ev || this.evidence.includes(ev.id)) return;
        this.evidence.push(ev.id);
        this.pendingToasts.push(`ได้รับหลักฐาน: ${ev.name}`);
        return;
      }
    }
  }

  getClue(id: string): ClueDefinition | undefined {
    return this.level.clues?.find((c) => c.id === id);
  }

  /* ---------------- พื้นที่เรียกบทสนทนาอัตโนมัติ ---------------- */

  /** trigger ที่ควรทำงานเมื่อยืนที่ช่องนี้ (ยังไม่เคยทำงาน และเงื่อนไขตรง) */
  triggerAt(tile: TilePoint): TriggerZone | undefined {
    return this.level.triggers?.find(
      (t) =>
        !this.firedTriggers.has(t.id) &&
        tile.x >= t.area.x &&
        tile.y >= t.area.y &&
        tile.x < t.area.x + t.area.w &&
        tile.y < t.area.y + t.area.h &&
        this.matches(t.when),
    );
  }

  /* ---------------- วิเคราะห์เส้นทาง ---------------- */

  private measureRoutes(): void {
    const ra = this.level.routeAnalysis;
    if (!ra) return;
    const origin = this.landmarkPoints[ra.originId];
    const landmarks = this.level.landmarks.map((l) => ({ id: l.id, at: l.at }));
    for (const r of ra.routes) {
      const dest = this.landmarkPoints[r.to];
      if (!origin || !dest) continue;
      const m = measureRoute(this.grid, this.scale, origin, dest, r.via ?? [], landmarks, [ra.originId, r.to]);
      this.routeMetrics.set(r.id, m);
      this.routeMeters[r.id] = m.roadMeters;
    }
  }

  /** สิ่งที่เบาะแสบอก (คำนวณจากตำแหน่งเป้าหมายจริง) */
  routeExpectation(): RouteExpectation | null {
    const ra = this.level.routeAnalysis;
    if (!ra) return null;
    const a = this.landmarkPoints[ra.originId];
    const b = this.landmarkPoints[ra.targetId];
    return {
      direction: bearingToDirection8(bearingDeg(b.x - a.x, b.y - a.y)),
      straightMeters: straightMeters(a, b, this.scale),
      toleranceMeters: this.scale.mapCmToMeters(ra.distanceToleranceMapCm),
      landmarkId: ra.requiredLandmarkId,
    };
  }

  routeRows(): RouteRow[] {
    const ra = this.level.routeAnalysis;
    if (!ra) return [];
    return ra.routes.map((def) => {
      const metrics = this.routeMetrics.get(def.id)!;
      return {
        def,
        metrics,
        explored: this.discoveredLandmarks.has(def.to),
        seenLandmarks: metrics.passes.filter((id) => this.discoveredLandmarks.has(id)),
      };
    });
  }

  /** สถานะเบาะแสที่จำเป็น แยกตามประเภท */
  requiredClueStatus(): Array<{ clue: ClueDefinition; collected: boolean }> {
    const ra = this.level.routeAnalysis;
    if (!ra) return [];
    return ra.requiredClueIds
      .map((id) => this.getClue(id))
      .filter((c): c is ClueDefinition => !!c)
      .map((clue) => ({ clue, collected: this.clues.includes(clue.id) }));
  }

  get routeSolved(): boolean {
    const ra = this.level.routeAnalysis;
    return !!ra && this.flags.has(ra.successFlag);
  }

  canChooseRoute(): boolean {
    return !!this.level.routeAnalysis && !this.routeSolved && this.requiredClueStatus().every((s) => s.collected);
  }

  chooseRoute(index: number): RouteChoiceResult {
    const ra = this.level.routeAnalysis;
    const route = ra?.routes[index];
    if (!ra || !route) return { ok: false, failed: [], blocked: 'no-route' };
    if (this.routeSolved) return { ok: false, failed: [], blocked: 'already-solved' };
    if (!this.canChooseRoute()) return { ok: false, failed: [], blocked: 'missing-clues' };
    this.skills.add('straight-vs-route');
    const failed = evaluateRoute(this.routeMetrics.get(route.id)!, this.routeExpectation()!);
    const ok = failed.length === 0 && route.id === ra.correctRouteId;
    if (ok) this.flags.add(ra.successFlag);
    else this.mistakes.route++;
    this.updateQuests();
    return { ok, failed };
  }

  /* ---------------- ปักหมุด ---------------- */

  get pinSolved(): boolean {
    const p = this.level.pinTask;
    return !!p && this.flags.has(p.successFlag);
  }

  isPinAvailable(): boolean {
    const p = this.level.pinTask;
    return !!p && !this.pinSolved && this.matches(p.availableWhen);
  }

  /**
   * ตรวจหมุดที่ผู้เล่นปัก: พิกัด (ต้องสำรวจแล้ว และอยู่ในรัศมีที่ยอมรับ),
   * ประเภทภูมิปัญญา, และหลักฐานการสำรวจ
   * นับเป็นการตอบผิดเมื่อพิกัดหรือประเภทภูมิปัญญาผิด (ขาดหลักฐานอย่างเดียวไม่นับ)
   */
  submitPin(tile: TilePoint, wisdomIndex: number): PinResult {
    const p = this.level.pinTask;
    if (!p || !this.isPinAvailable()) return { ok: false, problems: [] };
    const problems: PinProblem[] = [];
    const targetId = this.pinTargetId();
    const target = targetId ? this.landmarkPoints[targetId] : null;
    if (p.mustStandWithinTiles !== undefined && Math.hypot(tile.x - this.playerTile.x, tile.y - this.playerTile.y) > p.mustStandWithinTiles) {
      problems.push('far');
    }
    if (!this.fog.isExplored(tile.x, tile.y)) problems.push('unexplored');
    else if (!target || Math.hypot(tile.x - target.x, tile.y - target.y) > p.toleranceTiles) problems.push('location');
    if (p.wisdomChoices[wisdomIndex]?.id !== p.correctWisdomId) problems.push('wisdom');
    const siteEvidenceId = (this.level.siteAnalysis ?? this.level.gridSiteAnalysis ?? this.level.integratedSiteAnalysis)?.candidates.find(
      (c) => c.landmarkId === targetId,
    )?.evidenceId;
    const required = [...p.requiredEvidenceIds, ...(siteEvidenceId ? [siteEvidenceId] : [])];
    const missingEvidence = required.filter((id) => !this.evidence.includes(id));
    const hasEvidence = !!targetId && missingEvidence.length === 0 && this.discoveredLandmarks.has(targetId);
    if (!hasEvidence) problems.push('evidence');

    // นับเป็นการตอบผิดเฉพาะความเข้าใจผิด (พิกัด/ประเภท) — ยังไม่ได้ไปสำรวจหรือยืนไกลเกินไม่นับ
    if (problems.some((x) => x === 'unexplored' || x === 'location' || x === 'wisdom')) this.mistakes.pin++;
    const ok = problems.length === 0;
    if (ok) {
      this.flags.add(p.successFlag);
      this.pinnedAt = { ...tile };
      this.skills.add('grid-coordinates');
      this.updateQuests();
    }
    this.pinMissingEvidence = missingEvidence;
    return { ok, problems };
  }

  /* ---------------- จบภารกิจ ---------------- */

  completeMission(): LevelSummary {
    const ending = this.level.ending;
    if (ending) this.flags.add(ending.completeFlag);
    this.completed = true;
    this.updateQuests();
    return this.summary();
  }

  summary(): LevelSummary {
    const m = this.mistakes;
    return {
      distanceMeters: this.odometer.totalMeters,
      cluesFound: this.clues.length,
      cluesTotal: this.level.clues?.length ?? 0,
      mistakes: m.quiz + m.route + m.pin + m.compare,
      mistakesBy: { ...m },
      elapsedMs: this.elapsedMs,
      skills: [...this.skills],
      quests: this.questCounts(),
    };
  }

  /* ---------------- ระบบภารกิจ: หลัก / รอง / ปริศนา ---------------- */

  objectiveDone(c: ObjectiveCondition): boolean {
    switch (c.type) {
      case 'step': {
        const step = this.level.story.find((st) => st.order === c.order);
        return !!step && this.isStepComplete(step);
      }
      case 'flag':
        return this.flags.has(c.flag);
      case 'discover':
        return this.discoveredLandmarks.has(c.landmarkId);
      case 'clue':
        return this.clues.includes(c.clueId);
      case 'evidence':
        return this.evidence.includes(c.evidenceId);
      case 'talk':
        return this.talkedTo.has(c.npcId);
      case 'skill':
        return this.skills.has(c.skill as SkillId);
      case 'routesExplored':
        return this.routeRows().filter((r) => r.explored).length >= c.count;
      case 'near':
        return this.flags.has(`near:${c.npcId}`);
      case 'all':
        return c.of.every((o) => this.objectiveDone(o));
      case 'any':
        return c.of.some((o) => this.objectiveDone(o));
    }
  }

  /**
   * อัปเดตสถานะภารกิจ: ล็อก → กำลังทำ (เมื่อเงื่อนไขปลดล็อกเป็นจริง) → สำเร็จ (เมื่อเป้าหมายย่อยครบ)
   * สถานะเดินหน้าอย่างเดียว ไม่ย้อนกลับ; รางวัลของภารกิจทำงานครั้งเดียวตอนสำเร็จ
   */
  updateQuests(silent = false): void {
    this.syncSettlementFlags();
    const quests = this.level.quests ?? [];
    for (let changed = true, guard = 0; changed && guard < 10; guard++) {
      changed = false;
      for (const q of quests) {
        const status = this.questStatus.get(q.id) ?? 'locked';
        if (status === 'locked' && this.matches(q.unlockWhen)) {
          this.questStatus.set(q.id, 'active');
          if (!silent) this.toast(`${QUEST_KIND_LABEL[q.kind]}ใหม่: ${q.title}`);
          changed = true;
        } else if (status === 'active' && q.objectives.every((o) => this.objectiveDone(o.done))) {
          this.questStatus.set(q.id, 'completed');
          for (const e of q.reward?.effects ?? []) this.applyEffect(e);
          if (!silent) this.toast(`${QUEST_KIND_LABEL[q.kind]}สำเร็จ: ${q.title}`);
          changed = true;
        } else if (!this.questStatus.has(q.id)) {
          this.questStatus.set(q.id, status);
        }
      }
    }
  }

  quests(): QuestView[] {
    return (this.level.quests ?? []).map((def) => ({
      def,
      status: this.questStatus.get(def.id) ?? 'locked',
      objectivesDone: def.objectives.map((o) => this.objectiveDone(o.done)),
    }));
  }

  questCounts(): QuestCounts {
    const counts: QuestCounts = {
      main: { done: 0, total: 0 },
      side: { done: 0, total: 0 },
      mystery: { done: 0, total: 0 },
    };
    for (const q of this.quests()) {
      counts[q.def.kind].total++;
      if (q.status === 'completed') counts[q.def.kind].done++;
    }
    return counts;
  }

  /* ---------------- แผนที่ฐาน (หลายฉบับ) และการเปรียบเทียบ ---------------- */

  /** แผนที่ฐานที่ผู้เล่นมีแล้ว (ได้หลักฐานแผนที่แล้ว) */
  availableSheets(): BaseMapDefinition[] {
    return (this.level.baseMaps ?? []).filter((m) => this.evidence.includes(m.requiredEvidenceId));
  }

  /** สลับแผ่นที่กำลังดู: แผนที่สำรวจ → แผนที่ฐานแต่ละฉบับ → กลับแผนที่สำรวจ */
  cycleSheet(): void {
    const order = ['current', ...this.availableSheets().map((m) => m.id)];
    this.mapSheet = order[(order.indexOf(this.mapSheet) + 1) % order.length] ?? 'current';
    if (this.mapSheet !== 'current') {
      this.flags.add(`viewed-sheet-${this.mapSheet}`);
      this.skills.add('map-symbols');
      if (this.availableSheets().every((m) => this.flags.has(`viewed-sheet-${m.id}`)) && this.availableSheets().length > 1) {
        this.skills.add('map-compare');
      }
      this.updateQuests();
    }
  }

  /** จุดสังเกตจริงของโลกเกม (ใช้เป็น "ความจริง" ในการตรวจแผนที่ฐาน) */
  private truthLandmarks(): TruthLandmark[] {
    return this.level.landmarks.map((l) => ({ id: l.id, name: l.name, at: l.at, symbol: l.symbol }));
  }

  /** ตรวจแผนที่ฐานหนึ่งฉบับด้วยหลักฐาน 3 ชนิด (คำนวณจากโลกเกม) */
  sheetReport(sheetId: string): SheetReport | null {
    const sheet = this.level.baseMaps?.find((m) => m.id === sheetId);
    if (!sheet) return null;
    const mc = this.level.mapComparison;
    const waterwayId = mc?.waterwayId ?? this.level.siteAnalysis?.waterwayId;
    return checkSheet(sheet.marks, sheet.flowArrows ?? [], {
      landmarks: this.truthLandmarks(),
      waterway: (waterwayId && this.waterways.get(waterwayId)) || null,
      toleranceTiles: mc?.toleranceTiles ?? 3,
    });
  }

  /** แผนที่ฐานฉบับเดียวที่ผ่านหลักฐานทุกข้อ (null = ไม่มี หรือมีมากกว่าหนึ่ง) */
  verifiedSheetId(): string | null {
    const ok = (this.level.baseMaps ?? []).filter((m) => this.sheetReport(m.id)!.failed.length === 0);
    return ok.length === 1 ? ok[0].id : null;
  }

  /** หลักฐานที่ยังขาดก่อนตัดสินเปรียบเทียบแผนที่ */
  comparisonMissing(): { observations: string[]; clues: string[] } {
    const mc = this.level.mapComparison;
    if (!mc) return { observations: [], clues: [] };
    return {
      observations: mc.requiredObservations.filter((id) => !this.discoveredLandmarks.has(id)),
      clues: mc.requiredClueIds.filter((id) => !this.clues.includes(id)),
    };
  }

  get comparisonSolved(): boolean {
    const mc = this.level.mapComparison;
    return !!mc && this.flags.has(mc.successFlag);
  }

  isComparisonOpen(): boolean {
    const mc = this.level.mapComparison;
    return !!mc && this.availableSheets().length >= 2 && this.matches(mc.availableWhen);
  }

  /**
   * ผู้เล่นเลือกแผนที่ฐานที่คิดว่าถูกต้อง — ตัดสินจาก sheetReport ของทุกฉบับ (ไม่ได้กำหนดคำตอบตายตัว)
   * คืนรายงานทุกฉบับไว้ให้ UI อธิบายเหตุผลทั้งกรณีถูกและผิด
   */
  chooseSheet(index: number): CompareResult {
    const sheets = this.availableSheets();
    const chosen = sheets[index];
    const reports = Object.fromEntries(sheets.map((m) => [m.id, this.sheetReport(m.id)!]));
    const missing = this.comparisonMissing();
    const base = { chosenId: chosen?.id ?? null, reports, missing };
    let result: CompareResult;
    if (!chosen || !this.isComparisonOpen()) result = { ok: false, blocked: 'not-available', ...base };
    else if (this.comparisonSolved) result = { ok: true, blocked: 'already-solved', ...base };
    else if (missing.observations.length > 0 || missing.clues.length > 0) result = { ok: false, blocked: 'missing-evidence', ...base };
    else {
      const ok = chosen.id === this.verifiedSheetId();
      if (ok) {
        this.flags.add(this.level.mapComparison!.successFlag);
        this.skills.add('map-compare');
      } else this.mistakes.compare++;
      result = { ok, ...base };
      this.updateQuests();
    }
    this.lastCompare = result;
    return result;
  }

  /* ---------------- สถานที่ผู้ต้องสงสัย ---------------- */

  /** หลักฐานสำหรับตรวจสถานที่ — ระดับความสูง + แผนที่ฐานฉบับที่ผ่านการตรวจ */
  siteEvidence(): SiteEvidence | null {
    const sa = this.level.siteAnalysis;
    const w = sa && this.waterways.get(sa.waterwayId);
    const sheet = this.level.baseMaps?.find((m) => m.id === this.verifiedSheetId());
    if (!sa || !w || !sheet) return null;
    return {
      source: w.source,
      oldMapMarks: sheet.marks.map((m) => ({ symbol: m.symbol, at: m.at })),
      requiredSymbol: sa.requiredSymbol,
      toleranceTiles: sa.toleranceTiles,
    };
  }

  evaluateSites(): Array<{ landmarkId: string; label: string; failed: SiteCheck[] }> {
    const ev = this.siteEvidence();
    const sa = this.level.siteAnalysis;
    if (!ev || !sa) return [];
    return sa.candidates.map((c) => ({
      landmarkId: c.landmarkId,
      label: c.label,
      failed: evaluateSite(this.landmarkPoints[c.landmarkId], ev),
    }));
  }

  /** สถานที่เดียวที่ผ่านหลักฐานทุกข้อ (null ถ้าไม่มีหรือมีหลายแห่ง) — ใช้ได้ทั้งแบบลำน้ำและแบบพิกัดกริด */
  siteTargetId(): string | null {
    const rows = this.level.siteAnalysis
      ? this.evaluateSites()
      : this.level.integratedSiteAnalysis
        ? this.evaluateIntegratedSites()
        : this.evaluateGridSites();
    const ok = rows.filter((r) => r.failed.length === 0);
    return ok.length === 1 ? ok[0].landmarkId : null;
  }

  /* ---------------- จุดเป้าหมายแบบหลักฐานรวม (ด่านสุดท้าย) ---------------- */

  /** ระยะตามถนนระหว่างจุดสังเกตสองแห่ง (เมตร) — null ถ้าไม่มีถนนเชื่อม */
  roadMetersBetweenLandmarks(a: string, b: string): number | null {
    const pa = this.landmarkPoints[a];
    const pb = this.landmarkPoints[b];
    return pa && pb ? roadMetersBetween(this.grid, this.scale, pa, pb) : null;
  }

  /** ค่า N ที่หลักฐานพิกัดชี้ (N ของหมุดอ้างอิง + dN) */
  integratedTargetN(): number | null {
    const g = this.level.integratedSiteAnalysis?.grid;
    const rp = g ? this.landmarkPoints[g.fromId] : undefined;
    return g && rp && this.coords ? this.coords.tileToGrid(rp).n + g.dN : null;
  }

  integratedEvidence(): IntegratedEvidence | null {
    const ia = this.level.integratedSiteAnalysis;
    const n = this.integratedTargetN();
    if (!ia || n === null) return null;
    return {
      distance: { ...ia.distance },
      terrain: { symbol: ia.terrain.symbol, minElevationMeters: ia.terrain.minElevationMeters, relation: ia.terrain.relation },
      grid: { nMeters: n, eMask: ia.grid.eMask, toleranceMeters: ia.grid.toleranceMeters },
    };
  }

  /**
   * ข้อเท็จจริงของสถานที่ คำนวณจากโลกเกมด้วยระบบเดิมทั้งหมด:
   * ทิศ/ระยะเส้นตรง (Compass, ScaleSystem) · ระยะตามถนน (measureRoute) · ความสูง (ElevationModel)
   * · ต้นน้ำ/ปลายน้ำ (analyzeWaterway: ลำดับช่องจากต้นน้ำ) · พิกัด (GridSystem)
   */
  integratedFacts(landmarkId: string): SiteFacts | null {
    const ia = this.level.integratedSiteAnalysis;
    const lm = this.level.landmarks.find((l) => l.id === landmarkId);
    const from = ia ? this.landmarkPoints[ia.distance.fromId] : undefined;
    const ww = ia ? this.waterways.get(ia.terrain.waterwayId) : undefined;
    const ref = ia ? this.landmarkPoints[ia.terrain.ofId] : undefined;
    if (!ia || !lm || !from || !ww || !ref || !this.coords || !this.elevation) return null;
    const idx = (p: TilePoint) => {
      let best = 0;
      let bestD = Infinity;
      ww.tiles.forEach((t, i) => {
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    };
    const si = idx(lm.at);
    const ri = idx(ref);
    const g = this.coords.tileToGrid(lm.at);
    return {
      direction: bearingToDirection8(bearingDeg(lm.at.x - from.x, lm.at.y - from.y)),
      straightMeters: straightMeters(from, lm.at, this.scale),
      roadMeters: roadMetersBetween(this.grid, this.scale, from, lm.at),
      symbol: lm.symbol ?? null,
      elevationMeters: this.elevation.heightAt(lm.at.x, lm.at.y),
      waterRelation: si < ri ? 'upstream' : si > ri ? 'downstream' : 'same',
      e: g.e,
      n: g.n,
    };
  }

  evaluateIntegratedSites(): Array<{ landmarkId: string; label: string; failed: IntegratedCheck[]; report: IntegratedReport; facts: SiteFacts }> {
    const ia = this.level.integratedSiteAnalysis;
    const ev = this.integratedEvidence();
    if (!ia || !ev) return [];
    return ia.candidates.flatMap((c) => {
      const facts = this.integratedFacts(c.landmarkId);
      if (!facts) return [];
      const report = evaluateIntegratedSite(facts, ev);
      return [{ landmarkId: c.landmarkId, label: c.label, failed: report.failed, report, facts }];
    });
  }

  private resolveIntegratedText(text: string): string {
    const ia = this.level.integratedSiteAnalysis;
    if (!ia || !text.includes('{{ia:')) return text;
    const n = this.integratedTargetN();
    const values: Record<string, string> = {
      dir: THAI_DIRECTION[ia.distance.direction],
      straight: ia.distance.straightMeters.toLocaleString('en-US'),
      road: ia.distance.roadMeters.toLocaleString('en-US'),
      minelev: String(ia.terrain.minElevationMeters),
      dn: ia.grid.dN.toLocaleString('en-US'),
      emask: `E ${ia.grid.eMask}`,
      n: n === null ? '?' : `N ${n.toLocaleString('en-US')}`,
      // ตัวเลือกลวงของคำถามฉาก 4: ลบแทนบวก / ไปบวกที่ค่า E แทน N
      nminus: n === null ? '?' : `N ${(n - 2 * ia.grid.dN).toLocaleString('en-US')}`,
      eplus: (() => {
        const rp = this.landmarkPoints[ia.grid.fromId];
        if (!rp || !this.coords) return '?';
        const g = this.coords.tileToGrid(rp);
        return GridSystem.format({ e: g.e + ia.grid.dN, n: g.n });
      })(),
    };
    return text.replace(/\{\{ia:(\w+)\}\}/g, (m, k: string) => values[k] ?? m);
  }

  /* ---------------- จุดเป้าหมายแบบพิกัดกริด ---------------- */

  /** หลักฐานสำหรับตรวจจุดเป้าหมาย — แปลงพิกัดในบันทึกตามวิธีนับที่ผู้บันทึกใช้ */
  gridSiteEvidence(): GridSiteEvidence | null {
    const ga = this.level.gridSiteAnalysis;
    const g = this.coords;
    const from = ga && this.landmarkPoints[ga.relative.fromId];
    if (!ga || !g || !from) return null;
    const recordTile = ga.recordConvention === 'top-counted' ? g.topCountedGridToTile(ga.record) : g.gridToTile(ga.record);
    return {
      recordTile,
      toleranceTiles: ga.toleranceTiles,
      relative: { from, direction: ga.relative.direction, meters: ga.relative.meters, toleranceMeters: ga.relative.toleranceMeters },
      requiredFeatures: ga.requiredFeatures,
    };
  }

  evaluateGridSites(): Array<{ landmarkId: string; label: string; failed: GridSiteReport['failed']; report: GridSiteReport }> {
    const ga = this.level.gridSiteAnalysis;
    const ev = this.gridSiteEvidence();
    if (!ga || !ev) return [];
    return ga.candidates.map((c) => {
      const lm = this.level.landmarks.find((l) => l.id === c.landmarkId)!;
      const report = evaluateGridSite(lm.at, lm.features ?? [], ev, this.scale);
      return { landmarkId: c.landmarkId, label: c.label, failed: report.failed, report };
    });
  }

  get gridCheckSolved(): boolean {
    const ga = this.level.gridSiteAnalysis;
    return !!ga && this.flags.has(ga.successFlag);
  }

  isGridCheckOpen(): boolean {
    const ga = this.level.gridSiteAnalysis;
    return !!ga && this.matches(ga.availableWhen);
  }

  /**
   * ผู้เล่นเลือกจุดเป้าหมายในหน้าตรวจพิกัด — ตัดสินจากการตรวจหลักฐาน 3 ชนิดของทุกจุด (ไม่ได้กำหนดคำตอบตายตัว)
   * ต้องสำรวจจุดที่เลือกด้วยตัวเองก่อน (มีหลักฐานการสำรวจ) จึงจะตัดสินได้
   */
  /**
   * เงื่อนไขร่วมของการเลือกจุดเป้าหมาย (ใช้ทั้งด่านพิกัดและด่านหลักฐานรวม):
   * ต้องเปิดแล้ว · ยังไม่ผ่าน · มีเบาะแสครบ · ได้สำรวจจุดที่เลือกด้วยตัวเอง (ไม่นับผิดถ้ายังไม่ครบ)
   */
  private siteChoiceGate(
    def: { candidates: Array<{ landmarkId: string; evidenceId?: string }>; requiredClueIds: string[]; availableWhen: Condition; successFlag: string } | undefined,
    index: number,
  ): { chosen: { landmarkId: string; evidenceId?: string } | undefined; missingClues: string[]; notSurveyed: string[]; blocked?: GridChoiceResult['blocked'] } {
    const chosen = def?.candidates[index];
    const missingClues = (def?.requiredClueIds ?? []).filter((id) => !this.clues.includes(id));
    const notSurveyed = chosen?.evidenceId && !this.evidence.includes(chosen.evidenceId) ? [chosen.landmarkId] : [];
    let blocked: GridChoiceResult['blocked'];
    if (!def || !chosen || !this.matches(def.availableWhen)) blocked = 'not-available';
    else if (this.flags.has(def.successFlag)) blocked = 'already-solved';
    else if (missingClues.length > 0 || notSurveyed.length > 0) blocked = 'missing-evidence';
    return { chosen, missingClues, notSurveyed, blocked };
  }

  chooseGridSite(index: number): GridChoiceResult {
    const ga = this.level.gridSiteAnalysis;
    const rows = this.evaluateGridSites();
    const reports = Object.fromEntries(rows.map((r) => [r.landmarkId, r.report]));
    const gate = this.siteChoiceGate(ga, index);
    const chosen = gate.chosen;
    const base = { chosenId: chosen?.landmarkId ?? null, reports, missingClues: gate.missingClues, notSurveyed: gate.notSurveyed };
    if (gate.blocked) return (this.lastGridChoice = { ok: gate.blocked === 'already-solved', blocked: gate.blocked, ...base });
    if (!ga || !chosen) return (this.lastGridChoice = { ok: false, blocked: 'not-available', ...base });
    const ok = chosen.landmarkId === this.siteTargetId();
    if (ok) {
      this.flags.add(ga.successFlag);
      this.skills.add('grid-reference');
      this.skills.add('relative-position');
    } else this.mistakes.compare++;
    this.gridAttempts.push({ landmarkId: chosen.landmarkId, ok });
    this.updateQuests();
    return (this.lastGridChoice = { ok, ...base });
  }

  /**
   * ผู้เล่นเลือกจุดในกระดานวิเคราะห์หลักฐานรวม (ด่านสุดท้าย) — ตัดสินด้วย evaluateIntegratedSite ของทุกจุด
   * ไม่ได้กำหนดคำตอบตายตัว · เงื่อนไขเดียวกับด่านพิกัด (siteChoiceGate)
   */
  chooseIntegratedSite(index: number): IntegratedChoiceResult {
    const ia = this.level.integratedSiteAnalysis;
    const rows = this.evaluateIntegratedSites();
    const reports = Object.fromEntries(rows.map((r) => [r.landmarkId, r.report]));
    const facts = Object.fromEntries(rows.map((r) => [r.landmarkId, r.facts]));
    const gate = this.siteChoiceGate(ia, index);
    const chosen = gate.chosen;
    const base = { chosenId: chosen?.landmarkId ?? null, reports, facts, missingClues: gate.missingClues, notSurveyed: gate.notSurveyed };
    if (gate.blocked) return (this.lastIntegratedChoice = { ok: gate.blocked === 'already-solved', blocked: gate.blocked, ...base });
    if (!ia || !chosen) return (this.lastIntegratedChoice = { ok: false, blocked: 'not-available', ...base });
    const ok = chosen.landmarkId === this.siteTargetId();
    if (ok) {
      this.flags.add(ia.successFlag);
      this.skills.add('evidence-synthesis');
    } else this.mistakes.compare++;
    this.gridAttempts.push({ landmarkId: chosen.landmarkId, ok });
    this.updateQuests();
    return (this.lastIntegratedChoice = { ok, ...base });
  }

  /** การวิเคราะห์จุดเป้าหมายของด่านนี้ (พิกัด หรือ หลักฐานรวม) — ใช้กับกระดานวิเคราะห์ (C) */
  get analysisSolved(): boolean {
    const def = this.level.integratedSiteAnalysis ?? this.level.gridSiteAnalysis;
    return !!def && this.flags.has(def.successFlag);
  }

  isAnalysisOpen(): boolean {
    const def = this.level.integratedSiteAnalysis ?? this.level.gridSiteAnalysis;
    return !!def && this.matches(def.availableWhen);
  }

  chooseAnalysisSite(index: number): { ok: boolean; blocked?: GridChoiceResult['blocked'] } {
    return this.level.integratedSiteAnalysis ? this.chooseIntegratedSite(index) : this.chooseGridSite(index);
  }

  clearAnalysisChoice(): void {
    this.lastGridChoice = null;
    this.lastIntegratedChoice = null;
    this.gridSelection = null;
  }

  /** จุดเป้าหมายที่ตรวจยืนยันภาคสนามได้จากช่องนี้ (ด่านหลักฐานรวม ฉาก 6) */
  integratedVerifyAt(tile: TilePoint): string | null {
    const ia = this.level.integratedSiteAnalysis;
    const v = ia?.verify;
    if (!ia || !v || this.flags.has(v.flag) || !this.matches(v.when)) return null;
    for (const c of ia.candidates) {
      const at = this.landmarkPoints[c.landmarkId];
      if (at && Math.hypot(at.x - tile.x, at.y - tile.y) <= v.radiusTiles) return c.landmarkId;
    }
    return null;
  }

  /**
   * ตรวจยืนยันภาคสนามด้วยหลักฐานรวม: ① ระยะทาง (เส้นตรง/ตามถนน) ② ภูมิประเทศ/สัญลักษณ์ ③ พิกัด
   * คำนวณจากโลกเกม ณ จุดนั้น · ผ่านครบจึงบันทึกข้อมูลภูมิปัญญา (หลักฐาน + flag) — ไม่ผ่านบอกเฉพาะข้อที่ไม่ตรง
   */
  startIntegratedVerify(landmarkId: string): boolean {
    const ia = this.level.integratedSiteAnalysis;
    const v = ia?.verify;
    const cand = ia?.candidates.find((c) => c.landmarkId === landmarkId);
    const row = this.evaluateIntegratedSites().find((r) => r.landmarkId === landmarkId);
    const ev = this.integratedEvidence();
    if (!ia || !v || !cand || !row || !ev || !this.coords) return false;
    const f = row.facts;
    const r = row.report.reasons;
    const m10 = (m: number) => (Math.round(m / 10) * 10).toLocaleString('en-US');
    const mark = (ok: boolean) => (ok ? '✓ ตรง' : '✗ ไม่ตรง');
    const name = (id: string) => this.level.landmarks.find((l) => l.id === id)?.name ?? id;
    const sym = (s: string | null) => (s ? (ia.symbolLabels[s] ?? s) : 'ไม่มีสัญลักษณ์');
    const speaker = `สมุดภาคสนาม — ตรวจยืนยัน${cand.label}`;
    const allOk = row.failed.length === 0;
    const nodes: DialogueNode[] = [
      {
        speaker,
        text: `① ระยะทาง: จาก${name(ia.distance.fromId)} จุดนี้อยู่ทาง${THAI_DIRECTION[f.direction]} เส้นตรง ~${m10(f.straightMeters)} ม. · ตามถนน ${f.roadMeters === null ? 'ไม่มีถนนเชื่อม' : `~${m10(f.roadMeters)} ม.`} · บันทึก: ทาง${THAI_DIRECTION[ev.distance.direction]} ~${ev.distance.straightMeters} / ~${ev.distance.roadMeters} ม. → ${mark(!row.failed.includes('distance'))}`,
      },
      {
        speaker,
        text: `② ภูมิประเทศ: สัญลักษณ์${sym(f.symbol)} · สูง ${Math.round(f.elevationMeters)} ม. · อยู่ทาง${f.waterRelation === 'upstream' ? 'ต้นน้ำ' : f.waterRelation === 'downstream' ? 'ปลายน้ำ' : 'ระดับเดียวกับ'}${name(ia.terrain.ofId)} · บันทึก: ${sym(ev.terrain.symbol)} สูงกว่า ${ev.terrain.minElevationMeters} ม. ทาง${ev.terrain.relation === 'upstream' ? 'ต้นน้ำ' : 'ปลายน้ำ'} → ${mark(!row.failed.includes('terrain'))}`,
      },
      {
        speaker,
        text: `③ พิกัด: ตรงนี้คือ ${GridSystem.format({ e: f.e, n: f.n })} (คุณยืนที่ ${GridSystem.format(this.coords.tileToGrid(this.playerTile))}) · บันทึก: N ${ev.grid.nMeters.toLocaleString('en-US')} · E ${ev.grid.eMask} → ${mark(!r.includes('n') && !r.includes('e-mask'))}`,
      },
      allOk
        ? {
            speaker,
            text: `ยืนยันแล้ว: ตรงหลักฐานครบทั้ง 3 ชนิด · บันทึกข้อมูลภูมิปัญญา: ${v.recordText} — เปิดแผนที่ (M) แล้วปักหมุดที่จุดนี้`,
            effects: [
              { type: 'evidence', evidenceId: v.evidenceId },
              { type: 'flag', flag: v.flag },
            ],
          }
        : { speaker, text: `${cand.label} ยังไม่ตรงหลักฐานทุกข้อ (ดูข้อที่มีเครื่องหมาย ✗) — กลับไปดูกระดานวิเคราะห์หลักฐาน (C)` },
    ];
    this.startDialogue(nodes, 'npc', null, null);
    return true;
  }

  /** พิกัดในบันทึกหลังแปลงตามวิธีนับของผู้บันทึก (พิกัดที่ "แก้ไขแล้ว") */
  gridCorrectedRecord(): GridRef | null {
    const ev = this.gridSiteEvidence();
    return ev && this.coords ? this.coords.tileToGrid(ev.recordTile) : null;
  }

  /** จุดเป้าหมายที่ตรวจยืนยันภาคสนามได้จากช่องนี้ (ฉาก 5) */
  gridVerifyAt(tile: TilePoint): string | null {
    const ga = this.level.gridSiteAnalysis;
    const v = ga?.verify;
    if (!ga || !v || this.flags.has(v.flag) || !this.matches(v.when)) return null;
    for (const c of ga.candidates) {
      const at = this.landmarkPoints[c.landmarkId];
      if (at && Math.hypot(at.x - tile.x, at.y - tile.y) <= v.radiusTiles) return c.landmarkId;
    }
    return null;
  }

  /**
   * ตรวจยืนยันภาคสนามที่จุดเป้าหมาย: แสดงผลตรวจ พิกัด · ทิศ/ระยะ · สิ่งที่พบ ทีละข้อ (คำนวณจากแผนที่จริง)
   * ผ่านครบ 3 ข้อจึงได้หลักฐานและ flag — ไม่ผ่านจะบอกเฉพาะข้อที่ไม่ตรง
   */
  startGridVerify(landmarkId: string): boolean {
    const ga = this.level.gridSiteAnalysis;
    const v = ga?.verify;
    const cand = ga?.candidates.find((c) => c.landmarkId === landmarkId);
    const row = this.evaluateGridSites().find((r) => r.landmarkId === landmarkId);
    const corrected = this.gridCorrectedRecord();
    const at = this.landmarkPoints[landmarkId];
    if (!ga || !v || !cand || !row || !corrected || !at || !this.coords) return false;
    const fmt = GridSystem.format;
    const rep = row.report;
    const fromName = this.level.landmarks.find((l) => l.id === ga.relative.fromId)?.name ?? ga.relative.fromId;
    const mark = (ok: boolean) => (ok ? '✓ ตรง' : '✗ ไม่ตรง');
    const feats = this.level.landmarks.find((l) => l.id === landmarkId)?.features ?? [];
    const speaker = `สมุดภาคสนาม — ตรวจยืนยัน${cand.label}`;
    const allOk = rep.failed.length === 0;
    const nodes: DialogueNode[] = [
      {
        speaker,
        text: `① พิกัด: ตรงนี้คือ ${fmt(this.coords.tileToGrid(at))} (คุณยืนที่ ${fmt(this.coords.tileToGrid(this.playerTile))}) · บันทึกที่แก้ไขแล้ว ${fmt(corrected)} → ${mark(!rep.failed.includes('grid'))}`,
      },
      {
        speaker,
        text: `② ทิศและระยะ: จาก${fromName} จุดนี้อยู่ทาง${THAI_DIRECTION[rep.actualDirection]} ประมาณ ${Math.round(rep.actualMeters / 10) * 10} ม. · บันทึกบอกทาง${THAI_DIRECTION[ga.relative.direction]} ราว ${ga.relative.meters} ม. → ${mark(!rep.failed.includes('relative'))}`,
      },
      {
        speaker,
        text: `③ หลักฐานภาคสนาม: ${ga.requiredFeatures.map((f) => `${ga.featureLabels[f] ?? f} ${feats.includes(f) ? '✓ พบ' : '✗ ไม่พบ'}`).join(' · ')}`,
      },
      allOk
        ? {
            speaker,
            text: `ยืนยันแล้ว: ${cand.label} ตรงกับหลักฐานครบทั้ง 3 ชนิด บันทึกรายงานลงสมุดแล้ว — เปิดแผนที่ (M) แล้วปักหมุดที่จุดนี้`,
            effects: [
              { type: 'evidence', evidenceId: v.evidenceId },
              { type: 'flag', flag: v.flag },
            ],
          }
        : { speaker, text: `${cand.label} ยังไม่ตรงหลักฐานทุกข้อ (ดูข้อที่มีเครื่องหมาย ✗) — ตรวจกระดานวิเคราะห์พิกัด (C) อีกครั้ง` },
    ];
    this.startDialogue(nodes, 'npc', null, null);
    return true;
  }

  /** เป้าหมายการปักหมุด: กำหนดในเนื้อหา หรือคำนวณจากการวิเคราะห์สถานที่ */
  pinTargetId(): string | null {
    const p = this.level.pinTask;
    if (!p) return null;
    return p.targetId === 'site-analysis' ? this.siteTargetId() : p.targetId;
  }

  /* ---------------- จุดตรวจค้น ---------------- */

  /** จุดตรวจค้นที่อยู่ในระยะของช่องนี้ และเงื่อนไขตรง */
  inspectPointAt(tile: TilePoint): InspectPoint | undefined {
    return this.level.inspectPoints?.find(
      (p) => Math.hypot(p.at.x - tile.x, p.at.y - tile.y) <= p.radiusTiles && this.matches(p.when),
    );
  }

  inspect(point: InspectPoint): void {
    this.startDialogue(point.nodes, 'npc', null, null);
  }

  /* ---------------- บันทึก / โหลดการเล่นกลางด่าน ---------------- */

  /* ---------------- วิเคราะห์ความเหมาะสมของพื้นที่ตั้งถิ่นฐาน (บทที่ 3) ---------------- */

  /** โลกสำหรับคำนวณคะแนน (ต้องมีแบบจำลองความสูง) */
  settlementWorld(): SettlementWorld | null {
    return this.elevation ? { elevation: this.elevation, grid: this.grid, scale: this.scale } : null;
  }

  get settlementSolved(): boolean {
    const d = this.level.settlementAnalysis;
    return !!d && this.flags.has(d.successFlag);
  }

  /** หัวข้อที่ยังต้องกลับไปเรียนเสริม (วิเคราะห์ไม่ผ่านเพราะหัวข้อนี้ และยังไม่ได้ฟังบทเรียน) */
  settlementPending(): SettlementTopic[] {
    const d = this.level.settlementAnalysis;
    if (!d || this.settlementSolved) return [];
    return (Object.keys(d.topics) as SettlementTopic[]).filter((t) => this.flags.has(`weak:${t}`) && !this.flags.has(`relearned:${t}`));
  }

  /** เครื่องมือที่แผนที่ใช้อยู่ตอนนี้: ปักหมุด · วิเคราะห์พื้นที่ · ไม่มี */
  get mapTool(): 'pin' | 'settlement' | null {
    return this.isPinAvailable() ? 'pin' : this.isSettlementAvailable() ? 'settlement' : null;
  }

  /** เครื่องมือวิเคราะห์เปิดให้ใช้ได้หรือไม่ (ต้องผ่านเงื่อนไขของฉาก และไม่ค้างบทเรียนเสริม) */
  isSettlementAvailable(): boolean {
    const d = this.level.settlementAnalysis;
    return !!d && !this.settlementSolved && this.matches(d.availableWhen) && this.settlementPending().length === 0 && !!this.elevation;
  }

  /** เหตุที่ยังวิเคราะห์ไม่ได้ (null = ใช้ได้ หรือด่านนี้ไม่มี) */
  settlementLock(): { kind: 'lessons'; topics: SettlementTopic[] } | { kind: 'early' } | null {
    const d = this.level.settlementAnalysis;
    if (!d || this.settlementSolved) return null;
    if (!this.matches(d.availableWhen)) return { kind: 'early' };
    const pending = this.settlementPending();
    return pending.length ? { kind: 'lessons', topics: pending } : null;
  }

  /**
   * วิเคราะห์วงกลมที่ศูนย์กลางช่องนี้: คำนวณคะแนนจากแผนที่จริง → บันทึกผล
   *   ผ่าน (มากกว่าเกณฑ์) → จำพื้นที่ที่เลือก (chosen) · ไม่ผ่าน → จดหัวข้อที่ยังไม่เข้าใจ ต้องไปเรียนเสริมก่อนวิเคราะห์ใหม่
   */
  analyzeSettlementAt(tile: TilePoint): SettlementReport | null {
    const d = this.level.settlementAnalysis;
    const world = this.settlementWorld();
    if (!d || !world || !this.isSettlementAvailable()) return null;
    const rep = analyzeSettlement(world, d, tile);
    this.lastSettlement = rep;
    this.settlementAttempts.push({ x: tile.x, y: tile.y, percent: rep.percent, passed: rep.passed, weak: [...rep.weakTopics] });
    this.flags.add(d.attemptFlag);
    this.skills.add('contour-reading');
    this.skills.add('slope-analysis');
    if (rep.passed) {
      this.flags.add(d.successFlag);
      this.settlementChosen = { ...tile };
      this.landmarkPoints.chosen = { ...tile };
      this.skills.add('site-suitability');
    } else {
      this.mistakes.compare++;
      for (const t of rep.weakTopics) {
        this.flags.add(`weak:${t}`);
        this.flags.delete(`relearned:${t}`);
      }
    }
    this.updateQuests();
    this.uiVersion++;
    return rep;
  }

  /** ผลวิเคราะห์ครั้งล่าสุด (หลังโหลดเกมคำนวณใหม่จากประวัติ — คำนวณจากแผนที่เหมือนเดิมทุกครั้ง) */
  latestSettlementReport(): SettlementReport | null {
    if (this.lastSettlement) return this.lastSettlement;
    const d = this.level.settlementAnalysis;
    const world = this.settlementWorld();
    const a = this.settlementAttempts[this.settlementAttempts.length - 1];
    return d && world && a ? analyzeSettlement(world, d, { x: a.x, y: a.y }) : null;
  }

  /** รายงานของพื้นที่ที่ผู้เล่นเลือก (คำนวณใหม่จากแผนที่เสมอ ไม่ต้องบันทึกตัวเลข) */
  chosenReport(): SettlementReport | null {
    const d = this.level.settlementAnalysis;
    const world = this.settlementWorld();
    return d && world && this.settlementChosen ? analyzeSettlement(world, d, this.settlementChosen) : null;
  }

  /** flag "pending:<ผู้สอน>" = ผู้สอนคนนี้มีบทเรียนเสริมรออยู่ (ใช้เลือกบทพูด) */
  private syncSettlementFlags(): void {
    const d = this.level.settlementAnalysis;
    if (!d) return;
    const teachers = new Set(Object.values(d.topics).map((t) => t.teacherId));
    const pending = this.settlementPending();
    for (const id of teachers) {
      const need = pending.some((t) => d.topics[t].teacherId === id);
      if (need) this.flags.add(`pending:${id}`);
      else this.flags.delete(`pending:${id}`);
    }
    // วิเคราะห์ไม่ผ่านแล้ว และฟังบทเรียนเสริมครบทุกหัวข้อแล้ว → พร้อมวิเคราะห์ใหม่ ("lessons-done")
    if (this.flags.has(d.attemptFlag) && !this.settlementSolved && pending.length === 0) this.flags.add('lessons-done');
    else this.flags.delete('lessons-done');
  }

  /** ผู้เล่นยืนในพื้นที่ที่เลือก และยังไม่ได้ตรวจสอบภาคสนาม */
  fieldCheckAvailable(tile: TilePoint): boolean {
    const d = this.level.settlementAnalysis;
    const c = this.settlementChosen;
    if (!d || !c || !this.settlementSolved || this.flags.has(d.fieldCheck.flag) || !this.matches(d.fieldCheck.when)) return false;
    return Math.hypot(c.x - tile.x, c.y - tile.y) <= d.fieldCheck.radiusTiles;
  }

  /** ตรวจสอบภาคสนาม: บทพูด/ผลตรวจใช้ตัวแปร {{site:...}} จากพื้นที่ที่เลือก (คำนวณจากแผนที่) */
  startFieldCheck(): boolean {
    const d = this.level.settlementAnalysis;
    if (!d || !this.fieldCheckAvailable(this.playerTile)) return false;
    this.startDialogue(d.fieldCheck.nodes, 'npc', null, null);
    return true;
  }

  /** ตัวแปรข้อความ {{site:ค่า}} = พื้นที่ที่เลือก · {{try:ค่า}} = การวิเคราะห์ครั้งล่าสุด */
  private resolveSettlementText(text: string): string {
    const d = this.level.settlementAnalysis;
    if (!d || !text.includes('{{')) return text;
    const f1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US');
    const value = (r: SettlementReport | null, key: string): string => {
      if (!r) return '?';
      const m = r.measures;
      const part = (id: SettlementTopic) => r.parts.find((p) => p.id === id)!;
      switch (key) {
        case 'percent': return f1(r.percent);
        case 'total': return f1(r.total);
        case 'slope': return f1(m.meanSlopePct);
        case 'above': return m.heightAboveWater === null ? '?' : f1(m.heightAboveWater);
        case 'relief': return f1(m.reliefMeters);
        case 'landform': return LANDFORM_LABEL[m.landform];
        case 'water': return m.waterDistanceMeters === null ? '?' : (Math.round(m.waterDistanceMeters / 10) * 10).toLocaleString('en-US');
        case 'radius': return String(this.scale.tilesToMeters(r.radiusTiles));
        case 'height': return f1(m.centerHeight);
        case 'slopeScore': return f1(part('slope').score);
        case 'heightScore': return f1(part('height').score);
        case 'landformScore': return f1(part('landform').score);
        case 'waterScore': return f1(part('water').score);
        case 'flood': return String(d.height.floodLevelMeters);
        case 'weak': return r.weakTopics.map((t) => d.topics[t].label).join(' · ') || 'ไม่มี';
        case 'explainSlope': return explainSettlementPart(r, d, 'slope');
        case 'explainHeight': return explainSettlementPart(r, d, 'height');
        case 'explainLandform': return explainSettlementPart(r, d, 'landform');
        case 'explainWater': return explainSettlementPart(r, d, 'water');
        default: return '?';
      }
    };
    // {{cfg:ค่า}} = เกณฑ์ของด่าน (เขียนในเนื้อหาด้วยตัวแปรเพื่อให้ข้อความตรงกับข้อมูลที่ใช้คำนวณเสมอ)
    const cfg = (k: string): string => {
      const n = (v: number) => String(Math.round(v * 100) / 100);
      switch (k) {
        case 'slopeMin': return n(d.slope.idealMinPct);
        case 'slopeMax': return n(d.slope.idealMaxPct);
        case 'slopeZero': return n(d.slope.zeroAtPct);
        case 'flood': return n(d.height.floodLevelMeters);
        case 'safe': return n(d.height.floodLevelMeters + d.height.safeMarginMeters);
        case 'tooHigh': return n(d.height.tooHighMeters);
        case 'wClose': return n(d.water.tooCloseMeters);
        case 'wIdeal': return n(d.water.idealMaxMeters);
        case 'wZero': return n(d.water.zeroAtMeters);
        case 'pass': return n(d.passPercent);
        case 'radiusTiles': return n(d.radiusTiles);
        case 'radius': return n(this.scale.tilesToMeters(d.radiusTiles));
        case 'wSlope': return n(d.weights.slope);
        case 'wHeight': return n(d.weights.height);
        case 'wLandform': return n(d.weights.landform);
        case 'wWater': return n(d.weights.water);
        case 'wElev': return n(d.weights.height + d.weights.landform);
        case 'interval': return n(this.level.contourIntervalMeters ?? 10);
        case 'reliefFull': return n(d.landform.reliefFullMeters);
        case 'reliefZero': return n(d.landform.reliefZeroMeters);
        default: return '?';
      }
    };
    return text
      .replace(/\{\{cfg:(\w+)\}\}/g, (_m, k: string) => cfg(k))
      .replace(/\{\{site:(\w+)\}\}/g, (_m, k: string) => value(this.chosenReport(), k))
      .replace(/\{\{try:(\w+)\}\}/g, (_m, k: string) => value(this.lastSettlement, k));
  }

  /* ---------------- นำทาง: เข้าใกล้ NPC เป้าหมาย ---------------- */

  /** ระยะ (ช่อง) ที่นับว่า "ไปถึง NPC แล้ว" */
  static readonly NEAR_TILES = 4;

  /**
   * จด flag "near:<npc>" เมื่อผู้เล่นเข้าใกล้ NPC ที่มีเป้าหมาย "ไปพบ" (ทำก่อนลำดับก็นับ)
   * คืน true เมื่อมีการเปลี่ยนแปลง (UI วาดใหม่)
   */
  notePlayerNear(tile: TilePoint): boolean {
    let changed = false;
    for (const id of this.nearTargets) {
      if (this.flags.has(`near:${id}`)) continue;
      const npc = this.level.npcs.find((n) => n.id === id);
      if (npc && Math.hypot(npc.at.x - tile.x, npc.at.y - tile.y) <= GameSession.NEAR_TILES) {
        this.flags.add(`near:${id}`);
        changed = true;
      }
    }
    if (changed) this.updateQuests();
    return changed;
  }

  /* ---------------- วัดระยะจากจุดอ้างอิง ---------------- */

  /** จุดอ้างอิงการวัดของขั้นปัจจุบัน (ข้อมูลภารกิจ) — null = วัดจากจุดที่ผู้เล่นกดเอง */
  questMeasureSpec(): { from: string; allowReset: boolean; label: string; at: TilePoint } | null {
    const m = currentMicro(this)?.step.measure;
    if (!m) return null;
    const lm = this.level.landmarks.find((l) => l.id === m.from);
    if (!lm) return null;
    return { from: lm.id, allowReset: !!m.allowReset, label: shortPlaceName(lm.name), at: lm.at };
  }

  /**
   * เริ่มวัด (ปุ่มวัดระยะ / R):
   *   - ขั้นที่ภารกิจกำหนดจุดอ้างอิง → วัดจากจุดนั้น (เช่น ศาลาชุมชน) และจด flag "measured:<จุด>"
   *   - นอกนั้น → วัดจากตำแหน่งที่ยืนอยู่
   */
  startMeasure(): MeasureState {
    const spec = this.questMeasureSpec();
    this.odometer.resetTrip();
    this.skills.add('odometer');
    if (spec) {
      this.measure = { originId: spec.from, origin: { ...spec.at }, label: spec.label, walkedAtStart: this.odometer.totalMeters, allowReset: spec.allowReset };
      this.flags.add(`measured:${spec.from}`);
    } else {
      this.measure = { originId: null, origin: { ...this.playerTile }, label: 'จุดที่เริ่มวัด', walkedAtStart: this.odometer.totalMeters, allowReset: true };
    }
    this.updateQuests();
    this.uiVersion++;
    return this.measure;
  }

  /** "เริ่มวัดใหม่จากตรงนี้" — เฉพาะเมื่อภารกิจอนุญาต (หรือการวัดอิสระ) */
  restartMeasureHere(): boolean {
    if (!this.measure?.allowReset) return false;
    this.odometer.resetTrip();
    this.measure = { originId: null, origin: { ...this.playerTile }, label: 'จุดที่เริ่มวัด', walkedAtStart: this.odometer.totalMeters, allowReset: true };
    this.uiVersion++;
    return true;
  }

  /** จดว่าผู้เล่นเปิดเครื่องมือนี้แล้ว (flag "opened:<เครื่องมือ>" — ใช้กับขั้น "เปิดกระดาน…") */
  noteOpened(tool: string): void {
    if (this.flags.has(`opened:${tool}`)) return;
    this.flags.add(`opened:${tool}`);
    this.updateQuests();
  }

  stopMeasure(): void {
    this.measure = null;
    this.uiVersion++;
  }

  /**
   * ขั้นที่มีจุดอ้างอิงและผู้เล่นเคยเริ่มวัดจากจุดนั้นแล้ว → แสดงการวัดจากจุดนั้นต่อ (หลังโหลดเกม / เปลี่ยนขั้น)
   * ไม่สลับทับการวัดที่ผู้เล่นตั้งใจเริ่มใหม่เอง
   */
  syncQuestMeasure(): void {
    const spec = this.questMeasureSpec();
    if (!spec || !this.flags.has(`measured:${spec.from}`)) return;
    if (this.measure && (this.measure.originId === spec.from || this.measure.originId === null)) return;
    this.measure = { originId: spec.from, origin: { ...spec.at }, label: spec.label, walkedAtStart: this.odometer.totalMeters, allowReset: spec.allowReset };
    this.uiVersion++;
  }

  /** ค่าวัด ณ ตำแหน่งจริงของผู้เล่นตอนนี้ (null = ไม่ได้วัด) */
  measureReading(): MeasureReading | null {
    return this.measure ? readMeasure(this.measure, this.playerPx, this.odometer.totalMeters, this.scale) : null;
  }

  toSnapshot(): SessionSnapshot {
    return {
      version: 1,
      levelId: this.level.id,
      contentVersion: this.level.contentVersion,
      flags: [...this.flags],
      clues: [...this.clues],
      evidence: [...this.evidence],
      mistakes: { ...this.mistakes },
      skills: [...this.skills],
      firedTriggers: [...this.firedTriggers],
      seenVariants: [...this.seenVariants],
      talkedTo: [...this.talkedTo],
      messages: this.messages.map((m) => ({ ...m })),
      quests: Object.fromEntries(this.questStatus),
      fog: this.fog.exportBits(),
      totalMeters: this.odometer.totalMeters,
      elapsedMs: this.elapsedMs,
      player: { ...this.playerTile },
      pinnedAt: this.pinnedAt ? { ...this.pinnedAt } : null,
      completed: this.completed,
      gridAttempts: this.gridAttempts.map((a) => ({ ...a })),
      ...(this.level.settlementAnalysis
        ? { settlement: { attempts: this.settlementAttempts.map((a) => ({ ...a, weak: [...a.weak] })), chosen: this.settlementChosen ? { ...this.settlementChosen } : null } }
        : {}),
    };
  }

  /**
   * โหลดสถานะที่บันทึกไว้ (ใช้กับ session ใหม่ที่ยังไม่ได้เล่น)
   * คืน false ถ้าข้อมูลไม่ใช่ของด่านนี้หรือรูปแบบไม่ถูกต้อง — กรณีนี้ session ไม่ถูกแก้ไข
   */
  restore(snap: SessionSnapshot): boolean {
    if (!snap || snap.version !== 1 || snap.levelId !== this.level.id) return false;
    // เนื้อหาด่านเปลี่ยนรุ่น → บันทึกกลางด่านเดิมใช้ไม่ได้ (เริ่มด่านใหม่แทน)
    if (snap.contentVersion !== this.level.contentVersion) return false;
    if (!this.grid.inBounds(snap.player?.x ?? -1, snap.player?.y ?? -1)) return false;
    const fog = new FogOfWar(this.grid.width, this.grid.height);
    if (!fog.importBits(snap.fog)) return false;
    this.fog.importBits(snap.fog);
    const fill = <T>(target: Set<T>, items: T[]) => {
      target.clear();
      for (const i of items) target.add(i);
    };
    fill(this.flags, snap.flags);
    fill(this.skills, snap.skills as SkillId[]);
    fill(this.firedTriggers, snap.firedTriggers);
    fill(this.seenVariants, snap.seenVariants);
    fill(this.talkedTo, snap.talkedTo);
    this.clues.splice(0, this.clues.length, ...snap.clues);
    this.evidence.splice(0, this.evidence.length, ...snap.evidence);
    this.messages.splice(0, this.messages.length, ...snap.messages);
    Object.assign(this.mistakes, snap.mistakes);
    this.questStatus.clear();
    for (const [id, st] of Object.entries(snap.quests)) this.questStatus.set(id, st);
    this.odometer.restoreTotal(snap.totalMeters);
    this.elapsedMs = snap.elapsedMs;
    this.playerTile = { ...snap.player };
    this.playerPx = { x: this.scale.tileCenterPx(snap.player.x), y: this.scale.tileCenterPx(snap.player.y) };
    this.pinnedAt = snap.pinnedAt ? { ...snap.pinnedAt } : null;
    this.completed = snap.completed;
    this.gridAttempts.splice(0, this.gridAttempts.length, ...(snap.gridAttempts ?? []).map((a) => ({ ...a })));
    this.lastGridChoice = null;
    this.gridSelection = null;
    this.settlementAttempts.splice(0, this.settlementAttempts.length, ...(snap.settlement?.attempts ?? []).map((a) => ({ ...a, weak: [...a.weak] })));
    this.settlementChosen = snap.settlement?.chosen ? { ...snap.settlement.chosen } : null;
    this.lastSettlement = null;
    if (this.settlementChosen) this.landmarkPoints.chosen = { ...this.settlementChosen };
    else delete this.landmarkPoints.chosen;
    this.discoveredLandmarks.clear();
    this.checkLandmarkDiscovery();
    this.updateQuests(true);
    this.measure = null;
    this.syncQuestMeasure();
    this.pendingToasts.length = 0; // ไม่แจ้งเตือนซ้ำสิ่งที่ค้นพบไปแล้ว
    this.mode = 'explore';
    this.uiVersion++;
    return true;
  }
}

/** id ของ NPC ในเงื่อนไข "เดินไปพบ" (รวมในเงื่อนไขซ้อน) */
function nearIds(c: ObjectiveCondition): string[] {
  if (c.type === 'near') return [c.npcId];
  if (c.type === 'all' || c.type === 'any') return c.of.flatMap(nearIds);
  return [];
}

/** ชื่อสถานที่แบบสั้น (ตัดคำอธิบายในวงเล็บ) เช่น "โรงเรียนสักงาม (เสาธง)" → "โรงเรียนสักงาม" */
export function shortPlaceName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '');
}
