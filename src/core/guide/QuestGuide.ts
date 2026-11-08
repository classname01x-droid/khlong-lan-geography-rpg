import type { DialogueNode, GuideActionId, LevelDefinition, MicroStep, ObjectiveCondition, StoryStep } from '../../content/types';
import { CLUE_TYPE_LABEL, type GameSession } from '../session/GameSession';
import { guideText } from './GuideText';
import { currentMicro, lastDoneMicro, microStates, phaseProgress } from './MicroQuest';
import { guideTarget, type GuideTarget } from './Navigation';

/**
 * แถบติดตามภารกิจ + คำแนะนำแบบเป็นระดับ — สร้างจากข้อมูลด่านและสถานะ GameSession จริงทุกบท (ไม่เขียนเฉพาะด่าน)
 *
 * คำแนะนำไม่เฉลย: บอก "ทำอะไร · ใช้เครื่องมือใด · ขาดหลักฐานประเภทใด · คุยกับใคร"
 * แต่ไม่บอกตำแหน่งจุดลับ เส้นทางที่ถูก หรือจุด A/B/C ที่เป็นคำตอบ
 *   ระดับ 0  เป้าหมายของฉาก (ข้อความที่ผู้เขียนด่านกำหนด)
 *   ระดับ 1  วิธีคิด (ตามชนิดของปริศนา)
 *   ระดับ 2  เครื่องมือ / ผู้ที่ต้องคุย / หลักฐานที่ยังขาด
 */
export type StepKind = 'talk' | 'quiz' | 'collect' | 'inspect' | 'route' | 'compare' | 'analysis' | 'verify' | 'pin' | 'ending' | 'other';

export interface QuestTrackerView {
  /** เช่น "บทที่ 1: ปริศนาลวดลายแห่งสักงาม" */
  chapterLabel: string;
  /** ชื่อฉาก/ภารกิจปัจจุบัน */
  questTitle: string;
  /** สิ่งที่ต้องทำตอนนี้ (เป้าหมายเดียว) */
  objective: string;
  progress: { done: number; total: number; label: string };
  step: { current: number; total: number };
  kind: StepKind;
  hint: string | null;
  hintTier: number;
  /** เป้าหมายย่อยที่ยังเหลือทั้งหมด (สำหรับหน้ารายละเอียด) */
  remaining: string[];
  /** ภารกิจรอง/ปริศนาที่กำลังทำ */
  sideQuests: string[];
  complete: boolean;
  /** ข้อความเมื่อขั้นก่อนหน้าสำเร็จ เช่น "✓ รับภารกิจสำเร็จ!" (บทที่มีขั้นย่อย) */
  doneText: string | null;
  /** บทนี้แสดงเป็นขั้นย่อย (ภารกิจ · ตอนนี้ · วิธีทำ · ขั้น x/y) */
  micro: boolean;
  /** ช่วงของภารกิจ เช่น "ช่วงที่ 2 · ตามหาแหล่งผ้าปัก" (null = ไม่แบ่งช่วง) */
  phaseTitle: string | null;
  /** เลขขั้นปัจจุบัน (ขั้นย่อย = ส่วนที่ x จาก y) */
  stepNo: { num: number; total: number; part: number; parts: number } | null;
  /** วิธีทำทีละข้อ (แปลงคำบอกปุ่มตามอุปกรณ์แล้ว) */
  steps: string[];
  /** เครื่องมือที่ใช้ */
  tools: string[];
  /** ทำสำเร็จแล้วจะเกิดอะไร */
  result: string | null;
  /** ปุ่มลัดเปิดเครื่องมือ */
  action: { id: GuideActionId; label: string } | null;
  /** เป้าหมายนำทาง (NPC/สถานที่ที่รู้ตำแหน่งแล้ว) */
  target: GuideTarget | null;
}

/** ชื่อมาตรฐานของปุ่มลัดบนแถบภารกิจ */
export const GUIDE_ACTION_LABEL: Record<GuideActionId, string> = {
  settlement: '🔍 วิเคราะห์พื้นที่',
  map: '🗺️ เปิดแผนที่',
  clues: '📒 เปิดสมุด หน้าเบาะแส',
  routes: '🔍 เปิดกระดานวิเคราะห์เส้นทาง',
  measure: '📏 เริ่มวัดระยะ',
  analysis: '🔍 เปิดกระดานวิเคราะห์',
  compare: '🔍 เปิดหน้าเทียบแผนที่',
  pin: '📍 ไปปักหมุด',
  sheets: '🗺️ เปิดแผนที่ฐาน',
  target: '🗺️ ดูตำแหน่งบนแผนที่',
};

/** ชื่อปุ่มลัดของขั้น (ขั้นที่มีเป้าหมายนำทางแต่ไม่ระบุปุ่ม → "ดูตำแหน่ง…บนแผนที่") */
export function guideActionOf(m: MicroStep, target: GuideTarget | null): { id: GuideActionId; label: string } | null {
  if (m.action) return { id: m.action, label: m.actionLabel ?? GUIDE_ACTION_LABEL[m.action] };
  if (target) return { id: 'target', label: '🗺️ ดูบนแผนที่' };
  return null;
}

/** กุญแจของ "ขั้นที่กำลังทำ" — ระดับคำแนะนำเริ่มใหม่ทุกครั้งที่ขั้นเปลี่ยน */
export function hintKey(s: GameSession): number {
  const m = currentMicro(s);
  return s.currentStepOrder * 100 + (m ? m.index + 1 : 0);
}

type FlagSource = { kind: 'npc'; name: string } | { kind: 'inspect'; name: string };

function nodesSetFlag(level: LevelDefinition, nodes: DialogueNode[], flag: string): boolean {
  return nodes.some((n) => {
    if ('quiz' in n) return !!level.quizzes?.find((q) => q.id === n.quiz)?.effects?.some((e) => e.type === 'flag' && e.flag === flag);
    return !!n.effects?.some((e) => e.type === 'flag' && e.flag === flag);
  });
}

/** ใคร/อะไรทำให้ flag นี้เป็นจริง (ค้นจากบทสนทนา คำถาม และจุดสำรวจในข้อมูลด่าน) */
export function flagSource(level: LevelDefinition, flag: string): FlagSource | null {
  for (const npc of level.npcs) {
    if (npc.dialogue.some((v) => nodesSetFlag(level, v.nodes, flag))) return { kind: 'npc', name: npc.name };
  }
  for (const p of level.inspectPoints ?? []) {
    if (nodesSetFlag(level, p.nodes, flag)) {
      const first = p.nodes.find((n): n is { speaker: string; text: string } => 'speaker' in n);
      return { kind: 'inspect', name: (first?.speaker ?? 'จุดสำรวจ').replace(/^สมุดภาคสนาม\s*—\s*/, '') };
    }
  }
  return null;
}

/** ชนิดของฉาก (ใช้เลือกวิธีคิด/เครื่องมือ) — ดูจาก flag ที่ทำให้ฉากผ่าน */
export function stepKind(level: LevelDefinition, step: StoryStep): StepKind {
  const c = step.completeWhen;
  if (!c) return 'other';
  if (c.type === 'talk') return 'talk';
  if (c.type === 'all') return 'collect';
  const f = c.flag;
  if (level.ending?.completeFlag === f) return 'ending';
  if (level.pinTask?.successFlag === f) return 'pin';
  if (level.settlementAnalysis && (level.settlementAnalysis.successFlag === f || level.settlementAnalysis.attemptFlag === f)) return 'analysis';
  if (level.settlementAnalysis?.fieldCheck.flag === f) return 'verify';
  if (level.routeAnalysis?.successFlag === f) return 'route';
  if (level.mapComparison?.successFlag === f) return 'compare';
  if (level.gridSiteAnalysis?.successFlag === f || level.integratedSiteAnalysis?.successFlag === f) return 'analysis';
  if (level.gridSiteAnalysis?.verify?.flag === f || level.integratedSiteAnalysis?.verify?.flag === f) return 'verify';
  const src = flagSource(level, f);
  if (src?.kind === 'inspect') return 'inspect';
  if (src?.kind === 'npc') {
    const quizFlag = level.quizzes?.some((q) => q.effects?.some((e) => e.type === 'flag' && e.flag === f));
    return quizFlag ? 'quiz' : 'talk';
  }
  return 'other';
}

/** อธิบายเป้าหมายย่อยเป็นภาษาคน (ไม่บอกตำแหน่งของคำตอบ) */
export function describeObjective(s: GameSession, o: ObjectiveCondition): string {
  const L = s.level;
  const lm = (id: string) => L.landmarks.find((l) => l.id === id)?.name ?? id;
  switch (o.type) {
    case 'talk':
      return `คุยกับ${L.npcs.find((n) => n.id === o.npcId)?.name ?? o.npcId}`;
    case 'discover':
      return `เดินไปให้ถึง${lm(o.landmarkId)}`;
    case 'clue': {
      const c = s.getClue(o.clueId);
      return c ? `หาเบาะแส${CLUE_TYPE_LABEL[c.type]}จาก${c.source}` : 'หาเบาะแส';
    }
    case 'evidence':
      return `เก็บหลักฐาน: ${L.evidence?.find((e) => e.id === o.evidenceId)?.name ?? o.evidenceId}`;
    case 'step':
      return L.story.find((st) => st.order === o.order)?.title ?? `ฉาก ${o.order}`;
    case 'skill':
      return 'ฝึกใช้ทักษะภูมิศาสตร์';
    case 'routesExplored':
      return `เปิดดูเส้นทางในสมุดให้ได้ ${o.count} เส้น`;
    case 'flag': {
      const src = flagSource(L, o.flag);
      if (src?.kind === 'npc') return `คุยกับ${src.name}`;
      if (src?.kind === 'inspect') return `สำรวจ${src.name}`;
      return 'ทำภารกิจย่อยให้สำเร็จ';
    }
    case 'near':
      return `เดินไปพบ${L.npcs.find((n) => n.id === o.npcId)?.name ?? o.npcId}`;
    case 'all':
      return o.of.map((x) => describeObjective(s, x)).join(' และ ');
    case 'any':
      return o.of.map((x) => describeObjective(s, x)).join(' หรือ ');
  }
}

/** ระดับคำแนะนำตามเวลาที่อยู่ในฉากนี้และจำนวนครั้งที่ผิดในฉากนี้ (หรือผู้เล่นขอเพิ่มเอง) */
export function hintTierFor(msOnStep: number, mistakesOnStep: number, requested = 0): number {
  let tier = 0;
  if (msOnStep >= 60_000 || mistakesOnStep >= 1) tier = 1;
  if (msOnStep >= 150_000 || mistakesOnStep >= 3) tier = 2;
  return Math.min(2, Math.max(tier, requested));
}

/** จำว่าเข้าฉากปัจจุบันเมื่อไรและผิดไปกี่ครั้งแล้ว (สถานะของ UI ไม่ต้องบันทึก) */
export class HintTracker {
  private stepOrder = -1;
  private startedMs = 0;
  private mistakesAtStart = 0;
  private lastTier = 0;
  requested = 0;

  update(stepOrder: number, elapsedMs: number, totalMistakes: number): number {
    if (stepOrder !== this.stepOrder) {
      this.stepOrder = stepOrder;
      this.startedMs = elapsedMs;
      this.mistakesAtStart = totalMistakes;
      this.requested = 0;
    }
    this.lastTier = hintTierFor(elapsedMs - this.startedMs, totalMistakes - this.mistakesAtStart, this.requested);
    return this.lastTier;
  }

  /** ผู้เล่นกด "ขอคำแนะนำเพิ่ม" → เลื่อนขึ้นจากระดับที่เห็นอยู่ 1 ระดับ */
  requestMore(): void {
    this.requested = Math.min(2, Math.max(this.requested, this.lastTier) + 1);
  }
}

const totalMistakes = (s: GameSession) => {
  const m = s.mistakes;
  return m.quiz + m.route + m.pin + m.compare;
};
export { totalMistakes };

/**
 * ระดับ 0 (แสดงตั้งแต่เริ่มฉาก): บอก "ทำอะไร/ใช้เครื่องมือไหน" สั้น ๆ ให้เด็กรู้ว่าต้องเริ่มอย่างไร
 * ไม่บอกตำแหน่งลับ เส้นทางที่ถูก หรือคำตอบ · ตัวอักษรในวงเล็บเป็นปุ่มคีย์บอร์ด (จอสัมผัสแปลงเป็นชื่อปุ่มบนจอ)
 */
function starterHint(s: GameSession, step: StoryStep, kind: StepKind): string {
  const c = step.completeWhen;
  switch (kind) {
    case 'talk': {
      const name = c?.type === 'talk' ? s.level.npcs.find((n) => n.id === c.npcId)?.name : null;
      return name ? `มองหา${name} (มีเครื่องหมาย ! เหนือหัว) เดินไปใกล้ ๆ แล้วกดคุย (E)` : 'เดินไปใกล้ตัวละครที่มีเครื่องหมาย ! แล้วกดคุย (E)';
    }
    case 'quiz':
      return 'คุยกับตัวละครเพื่อรับคำถาม · ใช้มาตราส่วน 1 ช่อง = 10 ม. ช่วยคิด';
    case 'collect':
      return 'ทำเป้าหมายย่อยทีละข้อ · เปิดแผนที่ (M) ดูทิศทาง';
    case 'inspect':
      return 'เปิดแผนที่ (M) ดูทิศทาง แล้วเดินไปสำรวจ';
    case 'route':
      return 'เปิดสมุด (N) หน้าวิเคราะห์เส้นทาง';
    case 'compare':
      return 'เปิดหน้าเปรียบเทียบแผนที่ (C) แล้วตรวจทีละข้อ';
    case 'analysis':
      return 'เปิดกระดานวิเคราะห์ (C) แล้วเทียบหลักฐานทีละชนิด';
    case 'verify':
      return 'เดินไปยังจุดที่เลือก แล้วกดตรวจสอบ (E)';
    case 'pin':
      return 'เปิดแผนที่ (M) แล้วปักหมุดตรงจุดที่ยืนยันแล้ว';
    case 'ending':
      return 'ฟังครูเนมสรุปผลให้จบ';
    default:
      return 'เปิดแผนที่ (M) ดูทิศทาง และสมุด (N) ดูเบาะแส';
  }
}

function methodHint(kind: StepKind): string {
  switch (kind) {
    case 'quiz':
      return 'อ่านคำถามให้ครบ แล้วใช้เบาะแสในสมุดภาคสนามคิด — ตอบผิดจะได้คำใบ้และตอบใหม่ได้';
    case 'talk':
      return 'ฟังบทสนทนาให้จบ ข้อมูลสำคัญจะถูกบันทึกลงสมุดภาคสนามเอง';
    case 'collect':
      return 'ทำเป้าหมายย่อยให้ครบทุกข้อ ทำข้อไหนก่อนก็ได้';
    case 'inspect':
      return 'เดินสำรวจบริเวณที่ภารกิจบอก เมื่อมีข้อความ "สำรวจ…" ขึ้น ให้กดสำรวจ';
    case 'route':
      return 'เทียบเส้นทางกับเบาะแสทีละอย่าง: ทิศ ระยะบนแผนที่ (มาตราส่วน) และจุดสังเกตที่ต้องผ่าน';
    case 'compare':
      return 'แผนที่ที่เชื่อได้ต้องตรงทั้งสัญลักษณ์ ระดับความสูง และสิ่งที่เห็นจริง — ตรวจทีละข้อ';
    case 'analysis':
      return 'หลักฐานแต่ละชนิดอาจตรงได้หลายจุด จุดที่ถูกต้องต้องตรงทุกชนิดพร้อมกัน — เทียบทีละชนิด';
    case 'verify':
      return 'ไปที่จุดที่วิเคราะห์แล้วด้วยตัวเอง แล้วตรวจยืนยันว่าหลักฐานตรงจริง';
    case 'pin':
      return 'หมุดต้องตรงทั้งตำแหน่ง ประเภทสถานที่ และหลักฐานที่เก็บมา — ต้องยืนใกล้จุดที่จะปัก';
    case 'ending':
      return 'ฟังครูเนมสรุปผลให้จบ';
    default:
      return 'อ่านเป้าหมายของฉากแล้วลองสำรวจรอบ ๆ';
  }
}

/** ระดับ 2: เครื่องมือ ผู้ที่ต้องคุย และหลักฐานที่ยังขาด — ไม่ระบุคำตอบ */
function toolHint(s: GameSession, step: StoryStep, kind: StepKind, remaining: string[]): string {
  const L = s.level;
  const c = step.completeWhen;
  const flag = c && c.type === 'flag' ? c.flag : null;
  const src = flag ? flagSource(L, flag) : null;
  const missingTypes = (ids: string[]) => {
    const types = [...new Set(ids.filter((id) => !s.clues.includes(id)).map((id) => s.getClue(id)?.type).filter(Boolean))];
    return types.map((t) => CLUE_TYPE_LABEL[t!]).join(', ');
  };
  switch (kind) {
    case 'quiz':
    case 'talk':
      if (c?.type === 'talk') return `ไปคุยกับ${L.npcs.find((n) => n.id === c.npcId)?.name ?? ''} (ปุ่มคุย / E)`;
      return src ? `ไปคุยกับ${src.name} (ปุ่มคุย / E) ถ้าลืมเบาะแส เปิดสมุด (N) ทบทวน` : 'เปิดสมุด (N) ทบทวนเบาะแส';
    case 'inspect':
      return src ? `หา${src.name} แล้วกดสำรวจ (E) · ใช้พิกัดหรือแผนที่ (M) ช่วยหาทาง` : 'เปิดแผนที่ (M) ดูบริเวณที่ยังไม่ได้สำรวจ';
    case 'collect':
      return remaining.length ? `ยังเหลือ: ${remaining.join(' · ')}` : 'ใกล้ครบแล้ว';
    case 'route': {
      const miss = L.routeAnalysis ? missingTypes(L.routeAnalysis.requiredClueIds) : '';
      return `เปิดสมุด (N) หน้าวิเคราะห์เส้นทาง · ใช้วัดระยะ (R) เดินเทียบ${miss ? ` · ยังขาดเบาะแส: ${miss}` : ''}`;
    }
    case 'compare': {
      const missing = s.comparisonMissing();
      const need = missing.observations.length ? ` · ต้องไปดูด้วยตัวเองอีก ${missing.observations.length} แห่ง` : '';
      return `เปิดหน้าเปรียบเทียบแผนที่ (ปุ่มวิเคราะห์ / C)${need}`;
    }
    case 'analysis': {
      const def = L.integratedSiteAnalysis ?? L.gridSiteAnalysis;
      const unsurveyed = (def?.candidates ?? []).filter((c2) => c2.evidenceId && !s.evidence.includes(c2.evidenceId)).map((c2) => c2.label);
      const miss = def ? missingTypes(def.requiredClueIds) : '';
      const parts = ['เปิดกระดานวิเคราะห์ (ปุ่มวิเคราะห์ / C)'];
      if (unsurveyed.length) parts.push(`ยังไม่ได้สำรวจ: ${unsurveyed.join(', ')}`);
      if (miss) parts.push(`ยังขาดหลักฐานประเภท: ${miss}`);
      return parts.join(' · ');
    }
    case 'verify':
      return 'เดินไปที่จุดที่เลือกบนกระดานวิเคราะห์ แล้วกดตรวจสอบ (E)';
    case 'pin':
      return 'เปิดแผนที่ (M) แตะหรือเลื่อนหมุดไปตำแหน่งที่วิเคราะห์ได้ แล้วกดปักหมุด — ถ้าไม่ผ่าน ระบบจะบอกสิ่งที่ยังขาด';
    case 'ending':
      return 'กดไปต่อเพื่อฟังสรุป';
    default:
      return 'เปิดสมุด (N) ดูภารกิจและเบาะแสที่มี';
  }
}

export function buildQuestTracker(
  s: GameSession,
  opts: { chapterOrder?: number; hintTier?: number; touch?: boolean } = {},
): QuestTrackerView {
  const L = s.level;
  const step = s.currentStep;
  const main = (L.quests ?? []).find((q) => q.kind === 'main');
  const chapterLabel = `${opts.chapterOrder ? `บทที่ ${opts.chapterOrder}: ` : ''}${main?.title ?? L.title}`;
  const sideQuests = s
    .quests()
    .filter((q) => q.def.kind !== 'main' && q.status === 'active')
    .map((q) => q.def.title);
  const totalSteps = L.story.length;
  if (!step) {
    return {
      chapterLabel,
      questTitle: 'ภารกิจสำเร็จแล้ว',
      objective: 'สำรวจต่อได้ หรือไปยังบทถัดไป',
      progress: { done: totalSteps, total: totalSteps, label: 'ฉาก' },
      step: { current: totalSteps, total: totalSteps },
      kind: 'other',
      hint: null,
      hintTier: 0,
      remaining: [],
      sideQuests,
      complete: true,
      doneText: null,
      micro: false,
      phaseTitle: null,
      stepNo: null,
      steps: [],
      tools: [],
      result: null,
      action: null,
      target: null,
    };
  }
  const tierOf = Math.max(0, Math.min(2, opts.hintTier ?? 0));
  // บทที่มีขั้นย่อย: ภารกิจหลัก · เป้าหมายเดียว · วิธีทำ · ความคืบหน้าเป็นขั้น · คำแนะนำ 3 ระดับจากข้อมูลบท
  const ms = microStates(s);
  const cur = ms.find((m) => m.current);
  if (cur) {
    const m = cur.step;
    const target = guideTarget(s);
    const action = guideActionOf(m, target);
    const gt = (t: string) => guideText(s.resolveText(t), { touch: !!opts.touch, guideLabel: action?.label });
    const prog = phaseProgress(ms);
    const phase = L.guidePhases?.find((p) => p.id === cur.phase) ?? null;
    return {
      chapterLabel,
      questTitle: main?.title ?? step.title,
      objective: m.goal,
      progress: { done: prog.done, total: prog.total, label: 'ขั้น' },
      step: { current: step.order, total: totalSteps },
      kind: stepKind(L, step),
      // ระดับ 1 = วิธีทำ (แสดงตลอด) · ขอคำแนะนำ → ระดับ 2 เครื่องมือ · ระดับ 3 คำถามช่วยคิด (ไม่เฉลย)
      hint: tierOf === 0 ? null : gt(tierOf === 1 ? m.tool : m.think),
      hintTier: tierOf,
      remaining: ms.filter((x) => !x.done && !x.current && x.storyOrder === cur.storyOrder).map((x) => x.step.goal),
      sideQuests,
      complete: false,
      doneText: lastDoneMicro(ms)?.step.doneText ?? null,
      micro: true,
      phaseTitle: phase?.title ?? null,
      stepNo: { num: cur.num, total: prog.total, part: cur.part, parts: cur.parts },
      steps: m.steps.map(gt),
      tools: m.tools,
      result: gt(m.result),
      action,
      target,
    };
  }
  const kind = stepKind(L, step);
  const c = step.completeWhen;
  let remaining: string[] = [];
  let progress = { done: step.order - 1, total: totalSteps, label: 'ฉาก' };
  let objective = step.objective;
  if (c?.type === 'all') {
    const done = c.of.map((o) => s.objectiveDone(o));
    remaining = [...new Set(c.of.filter((_o, i) => !done[i]).map((o) => describeObjective(s, o)))];
    progress = { done: done.filter(Boolean).length, total: c.of.length, label: 'เป้าหมายย่อย' };
    if (remaining.length) objective = remaining[0];
  }
  const tier = Math.max(0, Math.min(2, opts.hintTier ?? 0));
  const hint = tier === 0 ? starterHint(s, step, kind) : tier === 1 ? methodHint(kind) : toolHint(s, step, kind, remaining);
  return {
    chapterLabel,
    questTitle: step.title,
    objective,
    progress,
    step: { current: step.order, total: totalSteps },
    kind,
    hint,
    hintTier: tier,
    remaining,
    sideQuests,
    complete: false,
    doneText: null,
    micro: false,
    phaseTitle: null,
    stepNo: null,
    steps: [],
    tools: [],
    result: null,
    action: null,
    target: null,
  };
}
