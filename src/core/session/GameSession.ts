import type {
  ClueDefinition,
  ClueType,
  Condition,
  DialogueNode,
  DialogueVariant,
  Effect,
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

export type SessionMode = 'explore' | 'dialogue' | 'map' | 'notebook' | 'summary' | 'pause';
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
  flags: string[];
  clues: string[];
  evidence: string[];
  mistakes: { quiz: number; route: number; pin: number };
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
};

const CLUE_SKILL: Record<ClueType, SkillId> = {
  direction: 'direction',
  distance: 'scale',
  landmark: 'landmark',
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

export type PinProblem = 'unexplored' | 'location' | 'wisdom' | 'evidence';

export interface PinResult {
  ok: boolean;
  problems: PinProblem[];
}

export interface LevelSummary {
  distanceMeters: number;
  cluesFound: number;
  cluesTotal: number;
  mistakes: number;
  mistakesBy: { quiz: number; route: number; pin: number };
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
  readonly mistakes = { quiz: 0, route: 0, pin: 0 };
  readonly skills = new Set<SkillId>();
  readonly firedTriggers = new Set<string>();
  readonly seenVariants = new Set<string>();
  /** ข้อความครูที่ได้รับผ่านสมุดภาคสนาม (อ่านซ้ำได้) */
  readonly messages: Array<{ speaker: string; text: string }> = [];
  /** ข้อความแจ้งเตือนที่รอให้ UI แสดง */
  readonly pendingToasts: string[] = [];

  readonly questStatus = new Map<string, QuestStatus>();
  readonly routeMetrics = new Map<string, RouteMetrics>();
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
    return resolveGeoTemplate(text, this.landmarkPoints, this.scale, this.routeMeters);
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

  /* ---------------- ฉากและเงื่อนไข ---------------- */

  isStepComplete(step: StoryStep): boolean {
    const c = step.completeWhen;
    if (!c) return false;
    if (c.type === 'talk') return this.talkedTo.has(c.npcId);
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
    const target = this.landmarkPoints[p.targetId];
    if (!this.fog.isExplored(tile.x, tile.y)) problems.push('unexplored');
    else if (Math.hypot(tile.x - target.x, tile.y - target.y) > p.toleranceTiles) problems.push('location');
    if (p.wisdomChoices[wisdomIndex]?.id !== p.correctWisdomId) problems.push('wisdom');
    const hasEvidence =
      p.requiredEvidenceIds.every((id) => this.evidence.includes(id)) && this.discoveredLandmarks.has(p.targetId);
    if (!hasEvidence) problems.push('evidence');

    if (problems.some((x) => x !== 'evidence')) this.mistakes.pin++;
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
      mistakes: m.quiz + m.route + m.pin,
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
