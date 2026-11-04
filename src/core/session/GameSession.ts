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
  StoryStep,
  TriggerZone,
} from '../../content/types';
import { DialogueRunner, type DialogueView } from '../dialogue/DialogueRunner';
import { directionFromVector, bearingDeg, bearingToDirection8, type Direction8 } from '../direction/Compass';
import { FogOfWar } from '../fog/FogOfWar';
import type { SkillId } from '../mission/skills';
import { DistanceTracker } from '../movement/DistanceTracker';
import {
  evaluateRoute,
  measureRoute,
  straightMeters,
  type RouteCheck,
  type RouteExpectation,
  type RouteMetrics,
} from '../route/RouteAnalysis';
import type { ScaleSystem } from '../scale/ScaleSystem';
import { resolveGeoTemplate } from '../text/geoTemplate';
import type { TilePoint } from '../world/types';
import type { WorldGrid } from '../world/WorldGrid';
import { ElevationModel } from '../world/Elevation';
import { analyzeWaterway, type WaterwayAnalysis } from '../world/Waterway';
import { evaluateSite, type SiteCheck, type SiteEvidence } from '../site/SiteAnalysis';
import { checkSheet, type SheetReport, type TruthLandmark } from '../map/BaseMapCheck';

export type SessionMode = 'explore' | 'dialogue' | 'map' | 'notebook' | 'summary' | 'pause' | 'compare';
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
}

export const CLUE_TYPE_LABEL: Record<ClueType, string> = {
  direction: 'ทิศทาง',
  distance: 'ระยะทาง',
  landmark: 'จุดสังเกต',
  elevation: 'ระดับความสูง',
  symbol: 'สัญลักษณ์แผนที่',
  comparison: 'เปรียบเทียบแผนที่',
};

const CLUE_SKILL: Record<ClueType, SkillId> = {
  direction: 'direction',
  distance: 'scale',
  landmark: 'landmark',
  elevation: 'elevation',
  symbol: 'map-symbols',
  comparison: 'map-compare',
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
  readonly landmarkPoints: Readonly<Record<string, TilePoint>>;

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
  /** ตัวเลือกที่โฟกัสอยู่ในเมนูหยุดเกม */
  pauseIndex = 0;
  /** แผ่นแผนที่ที่กำลังดู: แผนที่สำรวจ (ปัจจุบัน) หรือแผนที่เก่า */
  mapSheet = 'current';
  /** ผลการเลือกแผนที่ครั้งล่าสุด (ให้ UI แสดงคำอธิบาย) */
  lastCompare: CompareResult | null = null;

  private dialogue: ActiveDialogue | null = null;

  constructor(
    readonly level: LevelDefinition,
    readonly grid: WorldGrid,
    readonly scale: ScaleSystem,
  ) {
    this.fog = new FogOfWar(grid.width, grid.height);
    this.odometer = new DistanceTracker(scale);
    this.playerTile = { ...level.spawn };
    this.landmarkPoints = Object.fromEntries(level.landmarks.map((l) => [l.id, l.at]));
    this.elevation = level.map.elevation ? new ElevationModel(level.map.elevation) : null;
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
    return resolveGeoTemplate(text, this.landmarkPoints, this.scale, this.routeMeters, {
      heightAt: elevation ? (p) => elevation.heightAt(p.x, p.y) : undefined,
      flow: Object.fromEntries([...this.waterways].map(([id, w]) => [id, w.flowDirection])),
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
    const runner = new DialogueRunner(nodes, {
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
    const siteEvidenceId = this.level.siteAnalysis?.candidates.find((c) => c.landmarkId === targetId)?.evidenceId;
    const required = [...p.requiredEvidenceIds, ...(siteEvidenceId ? [siteEvidenceId] : [])];
    const hasEvidence =
      !!targetId && required.every((id) => this.evidence.includes(id)) && this.discoveredLandmarks.has(targetId);
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
    }
  }

  /**
   * อัปเดตสถานะภารกิจ: ล็อก → กำลังทำ (เมื่อเงื่อนไขปลดล็อกเป็นจริง) → สำเร็จ (เมื่อเป้าหมายย่อยครบ)
   * สถานะเดินหน้าอย่างเดียว ไม่ย้อนกลับ; รางวัลของภารกิจทำงานครั้งเดียวตอนสำเร็จ
   */
  updateQuests(silent = false): void {
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

  /** สถานที่เดียวที่ผ่านหลักฐานทุกข้อ (null ถ้าไม่มีหรือมีหลายแห่ง) */
  siteTargetId(): string | null {
    const ok = this.evaluateSites().filter((r) => r.failed.length === 0);
    return ok.length === 1 ? ok[0].landmarkId : null;
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
    this.pinnedAt = snap.pinnedAt ? { ...snap.pinnedAt } : null;
    this.completed = snap.completed;
    this.discoveredLandmarks.clear();
    this.checkLandmarkDiscovery();
    this.updateQuests(true);
    this.pendingToasts.length = 0; // ไม่แจ้งเตือนซ้ำสิ่งที่ค้นพบไปแล้ว
    this.mode = 'explore';
    this.uiVersion++;
    return true;
  }
}
