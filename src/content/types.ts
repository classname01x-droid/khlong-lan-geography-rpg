import type { MapDefinition, TilePoint, TileRect } from '../core/world/types';

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
}

/* ---------------- เงื่อนไขและผลของบทสนทนา ---------------- */

/** เงื่อนไขตามสถานะภารกิจ (ทุกข้อที่ระบุต้องเป็นจริง) */
export interface Condition {
  /** ลำดับฉากปัจจุบัน (ฉากแรกที่ยังไม่ผ่าน; ผ่านครบ = จำนวนฉาก + 1) */
  minStep?: number;
  maxStep?: number;
  flags?: string[];
  notFlags?: string[];
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
}

export type ClueType = 'direction' | 'distance' | 'landmark';

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
  /** id ด่านที่ปลดล็อกเมื่อผ่านด่านนี้ */
  unlocks?: string;
}
