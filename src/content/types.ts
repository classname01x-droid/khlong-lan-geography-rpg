import type { MapDefinition, MapSymbol, TilePoint, TileRect } from '../core/world/types';
import type { WaterwayDefinition } from '../core/world/Waterway';

/**
 * รูปแบบข้อมูลเนื้อหาด่าน — ด่านใหม่ (ตำบลอื่น) เขียนเป็นข้อมูลตามรูปแบบนี้
 * โดยไม่ต้องแก้โค้ดระบบเกม
 *
 * ข้อความทุกช่อง (บทพูด เบาะแส ข้อความจบ) ใช้ตัวแปรภูมิศาสตร์ได้:
 *   {{dist:a>b}} {{dir:a>b}} {{mapcm:a>b}} {{route:routeId}}
 * ระบบจะคำนวณจากแผนที่จริง (ดู core/text/geoTemplate.ts)
 */

/** รูปลักษณ์ตัวละคร (ระบบกราฟิกจะเลือกชุดสีตามค่านี้) */
export type CharacterAppearance = 'student' | 'teacher' | 'headman' | 'villager';

export interface Landmark {
  id: string;
  name: string;
  /** ตำแหน่งอ้างอิงของจุดสังเกต (ช่อง) ใช้คำนวณระยะ/ทิศ */
  at: TilePoint;
  /** แสดงป้ายชื่อบนแผนที่เมื่อพื้นที่ถูกเปิดแล้ว */
  showLabel: boolean;
  /**
   * จุดสังเกตลับ: ไม่แสดงป้าย/แจ้งเตือนเมื่อเปิดหมอก จนกว่าจะมี flag นี้
   * (ใช้กับปริศนาที่ผู้เล่นต้องวัดระยะหาเอง)
   */
  revealFlag?: string;
  /** สัญลักษณ์บนแผนที่สำรวจ (ไม่ระบุ = จุดธรรมดา) */
  symbol?: MapSymbol;
  /** ตำแหน่งป้ายชื่อบนแผนที่สำรวจ (ค่าเริ่มต้น above) */
  mapLabelAt?: 'above' | 'below' | 'left' | 'right';
}

/* ---------------- เงื่อนไขและผลของบทสนทนา ---------------- */

/** เงื่อนไขตามสถานะภารกิจ (ทุกข้อที่ระบุต้องเป็นจริง) */
export interface Condition {
  /** ลำดับฉากปัจจุบัน (ฉากแรกที่ยังไม่ผ่าน; ผ่านครบ = จำนวนฉาก + 1) */
  minStep?: number;
  maxStep?: number;
  flags?: string[];
  notFlags?: string[];
  /** ต้องได้เบาะแสเหล่านี้แล้ว */
  clues?: string[];
}

export type Effect =
  | { type: 'clue'; clueId: string }
  | { type: 'evidence'; evidenceId: string }
  | { type: 'flag'; flag: string };

export interface DialogueLine {
  speaker: string;
  text: string;
  /** ผลที่เกิดขึ้นเมื่อบรรทัดนี้แสดง เช่น บันทึกเบาะแสลงสมุด */
  effects?: Effect[];
}

/** แทรกคำถามเลือกตอบในบทสนทนา */
export interface QuizNode {
  quiz: string;
}

export type DialogueNode = DialogueLine | QuizNode;

export interface DialogueVariant {
  /** ไม่ระบุ = ใช้ได้เสมอ (ระบบเลือก variant แรกที่เงื่อนไขตรง) */
  when?: Condition;
  nodes: DialogueNode[];
  /** true = บทพูดทั่วไป ไม่แสดงเครื่องหมาย "!" เหนือ NPC */
  ambient?: boolean;
}

export interface NpcDefinition {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  at: TilePoint;
  dialogue: DialogueVariant[];
}

/** เมื่อผู้เล่นเดินเข้าพื้นที่ จะเปิดบทสนทนากับ NPC อัตโนมัติ (ครั้งเดียว) */
export interface TriggerZone {
  id: string;
  area: TileRect;
  npcId: string;
  when: Condition;
}

/** จุดที่ผู้เล่นกด E ตรวจค้นได้ (ไม่ใช่ NPC) เช่น ต้นไม้เก่าในปริศนา */
export interface InspectPoint {
  id: string;
  at: TilePoint;
  /** ระยะที่ตรวจค้นได้ (ช่อง) */
  radiusTiles: number;
  when: Condition;
  nodes: DialogueNode[];
}

/* ---------------- ระบบภารกิจ (Quest) ---------------- */

export type QuestKind = 'main' | 'side' | 'mystery';

/** เงื่อนไขของเป้าหมายย่อยในภารกิจ */
export type ObjectiveCondition =
  | { type: 'step'; order: number }
  | { type: 'flag'; flag: string }
  | { type: 'discover'; landmarkId: string }
  | { type: 'clue'; clueId: string }
  | { type: 'evidence'; evidenceId: string }
  | { type: 'talk'; npcId: string }
  | { type: 'skill'; skill: string }
  /** ค้นพบปลายทางของเส้นทางในการวิเคราะห์เส้นทางอย่างน้อย count เส้น */
  | { type: 'routesExplored'; count: number };

export interface QuestObjective {
  text: string;
  done: ObjectiveCondition;
}

export interface QuestDefinition {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  /** ไม่ระบุ = เปิดตั้งแต่เริ่มด่าน */
  unlockWhen?: Condition;
  /** ข้อความบอกวิธีปลดล็อก (แสดงในสมุดขณะยังล็อก) */
  lockedHint: string;
  objectives: QuestObjective[];
  /** ข้อความรางวัล และผลที่เกิดเมื่อภารกิจสำเร็จ */
  reward?: { text: string; effects?: Effect[] };
}

/* ---------------- คำถาม เบาะแส หลักฐาน ---------------- */

export interface Choice {
  id: string;
  label: string;
  /** คำใบ้เมื่อเลือกข้อนี้แล้วผิด */
  hint?: string;
}

export interface QuizDefinition {
  id: string;
  speaker: string;
  question: string;
  choices: Choice[];
  correctChoiceId: string;
  /** คำใบ้ทั่วไปเมื่อ choice ที่ผิดไม่มี hint ของตัวเอง */
  fallbackHint: string;
  correctFeedback: string;
  /** ผลเมื่อตอบถูก */
  effects: Effect[];
  /**
   * ตรวจเนื้อหา: คำตอบที่ถูกต้องต้องตรงกับทิศน้ำไหลของลำน้ำนี้ ที่คำนวณจากระดับความสูง
   * (validateLevel จะล้มถ้าแก้แผนที่/ความสูงแล้วคำตอบไม่ตรง)
   */
  verifyFlowOf?: string;
}

export type ClueType = 'direction' | 'distance' | 'landmark' | 'elevation' | 'symbol' | 'comparison';

export interface ClueDefinition {
  id: string;
  type: ClueType;
  /** ชื่อผู้ให้เบาะแส */
  source: string;
  text: string;
}

export interface EvidenceDefinition {
  id: string;
  name: string;
  description: string;
}

/* ---------------- วิเคราะห์เส้นทาง ---------------- */

export interface RouteDefinition {
  id: string;
  /** ป้ายสั้น เช่น "ก" */
  label: string;
  /** คำอธิบายทางแยก โดยไม่บอกปลายทาง */
  description: string;
  /** id จุดสังเกตปลายทาง */
  to: string;
  /** จุดที่ต้องผ่าน (ช่องบนถนน) ถ้าเส้นทางสั้นที่สุดไม่ใช่เส้นที่ต้องการ */
  via?: TilePoint[];
}

export interface RouteAnalysisDefinition {
  /** จุดสังเกตต้นทางของการวิเคราะห์ */
  originId: string;
  /** จุดสังเกตเป้าหมายที่เบาะแสพูดถึง */
  targetId: string;
  routes: RouteDefinition[];
  correctRouteId: string;
  /** เบาะแสที่ต้องมีก่อนตัดสินใจ (ต้องครอบคลุมทั้ง 3 ประเภท) */
  requiredClueIds: string[];
  /** จุดสังเกตที่เส้นทางถูกต้องต้องผ่าน */
  requiredLandmarkId: string;
  /** ความคลาดเคลื่อนที่ยอมรับได้ของการวัดบนแผนที่ (ซม.) */
  distanceToleranceMapCm: number;
  successFlag: string;
}

/* ---------------- ปักหมุด และตอนจบ ---------------- */

export interface PinTaskDefinition {
  /** จุดสังเกตที่ต้องปักหมุด */
  targetId: string;
  /** รัศมีที่ยอมรับ (ช่อง) */
  toleranceTiles: number;
  wisdomPrompt: string;
  wisdomChoices: Choice[];
  correctWisdomId: string;
  requiredEvidenceIds: string[];
  /** เปิดให้ปักหมุดเมื่อเงื่อนไขนี้เป็นจริง */
  availableWhen: Condition;
  successFlag: string;
}

export interface EndingDefinition {
  /** ข้อความที่ครูส่งผ่านสมุดภาคสนาม */
  messages: DialogueLine[];
  codePiece: { index: number; total: number; value: string };
  rewardItem: string;
  completeFlag: string;
}

/* ---------------- แผนที่สองแผ่น และสถานที่ผู้ต้องสงสัย ---------------- */

export interface OldMapDefinition {
  title: string;
  /** หมายเหตุบนแผนที่ (เช่น วาดมือ ไม่มีเส้นชั้นความสูง) */
  note: string;
  /** ต้องมีหลักฐานนี้ก่อนจึงจะเปิดดูแผนที่เก่าได้ */
  requiredEvidenceId: string;
  /** ใช้ระบบพิกัดและมาตราส่วนเดียวกับแผนที่ด่าน (1 ช่อง = 10 ม.) */
  lines: Array<{ style: 'stream' | 'road' | 'trail'; points: TilePoint[] }>;
  /** labelAt: ตำแหน่งป้ายชื่อเทียบกับสัญลักษณ์ (ค่าเริ่มต้น above) — กันป้ายทับกันเมื่อของอยู่ใกล้กัน */
  marks: Array<{ symbol: MapSymbol; at: TilePoint; label: string; labelAt?: 'above' | 'below' | 'left' | 'right' }>;
}

export interface SiteAnalysisDefinition {
  /** ลำน้ำที่ใช้หาต้นน้ำ */
  waterwayId: string;
  /** สัญลักษณ์บนแผนที่เก่าที่เป้าหมายต้องมี */
  requiredSymbol: MapSymbol;
  toleranceTiles: number;
  /** id จุดสังเกตของสถานที่ผู้ต้องสงสัยทั้งหมด (รวมเป้าหมายจริง) */
  candidates: string[];
  correctLandmarkId: string;
}

/* ---------------- โครงเรื่อง ---------------- */

export type StoryStepStatus = 'prototype' | 'planned' | 'playable';

/** เงื่อนไขผ่านฉาก */
export type StepCondition = { type: 'talk'; npcId: string } | { type: 'flag'; flag: string };

export interface StoryStep {
  order: number;
  title: string;
  objective: string;
  /** id ของจุดสังเกตที่เป็นสถานที่หลักของฉาก */
  landmarkId: string;
  status: StoryStepStatus;
  completeWhen?: StepCondition;
}

export interface LevelDefinition {
  id: string;
  tambon: string;
  title: string;
  map: MapDefinition;
  spawn: TilePoint;
  fog: { revealRadiusTiles: number };
  landmarks: Landmark[];
  npcs: NpcDefinition[];
  story: StoryStep[];
  triggers?: TriggerZone[];
  quizzes?: QuizDefinition[];
  clues?: ClueDefinition[];
  evidence?: EvidenceDefinition[];
  routeAnalysis?: RouteAnalysisDefinition;
  pinTask?: PinTaskDefinition;
  ending?: EndingDefinition;
  quests?: QuestDefinition[];
  inspectPoints?: InspectPoint[];
  /** ลำน้ำที่ใช้วิเคราะห์ทิศน้ำไหล (แนวเดียวกับ feature ในแผนที่) */
  waterways?: WaterwayDefinition[];
  /** จุดระดับความสูงที่พิมพ์บนแผนที่สำรวจ (ค่าความสูงคำนวณจาก elevation) */
  spotHeights?: TilePoint[];
  /** แผนที่แผ่นที่สอง (เช่น แผนที่เก่าของชุมชน) สำหรับเปรียบเทียบ */
  oldMap?: OldMapDefinition;
  /** สถานที่ผู้ต้องสงสัย (เป้าหมายจริง + สถานที่หลอก) */
  siteAnalysis?: SiteAnalysisDefinition;
  /** ทักษะที่แสดงในหน้าสรุปผล (ไม่ระบุ = ชุดทักษะของด่าน 1) */
  skills?: string[];
  /** id ด่านที่ปลดล็อกเมื่อผ่านด่านนี้ */
  unlocks?: string;
}
