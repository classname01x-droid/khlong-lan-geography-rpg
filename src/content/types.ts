import type { MapDefinition, MapSymbol, TilePoint, TileRect } from '../core/world/types';
import type { WaterwayDefinition } from '../core/world/Waterway';
import type { Direction8 } from '../core/direction/Compass';
import type { GridDefinition, GridRef } from '../core/world/GridSystem';

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
  /**
   * (ไม่บังคับ) ผู้เล่น "รู้ตำแหน่ง" แล้วเมื่อเงื่อนไขนี้เป็นจริง (เช่น ครูเนมบอกไว้) — แสดงชื่อบนแผนที่สำรวจได้ก่อนเดินไปถึง
   * ไม่แสดงเส้นทาง · ใช้ไม่ได้กับจุดลับ (revealFlag)
   */
  knownWhen?: Condition;
  /** ตำแหน่งป้ายชื่อบนแผนที่สำรวจ (ค่าเริ่มต้น above) */
  mapLabelAt?: 'above' | 'below' | 'left' | 'right';
  /** สิ่งที่พบได้จากการสำรวจจริง ณ จุดนี้ (เช่น ไอน้ำร้อน หินปูนสีขาว) ใช้ตรวจหลักฐานภาคสนาม */
  features?: string[];
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
  | { type: 'flag'; flag: string }
  /** รางวัลภารกิจ (เหรียญ + พลังศรัทธา) — ได้ครั้งเดียวต่อ id (ทำซ้ำไม่ได้เพิ่ม) */
  | { type: 'reward'; id: string; coins: number; faith: number };

export interface DialogueLine {
  speaker: string;
  text: string;
  /** ผลที่เกิดขึ้นเมื่อบรรทัดนี้แสดง เช่น บันทึกเบาะแสลงสมุด */
  effects?: Effect[];
  /** (ไม่บังคับ) แสดงบรรทัดนี้เฉพาะเมื่อเงื่อนไขตรง ณ ตอนเริ่มคุย — ใช้กับบทเรียนเสริมเฉพาะหัวข้อ */
  when?: Condition;
}

/** แทรกคำถามเลือกตอบในบทสนทนา */
export interface QuizNode {
  quiz: string;
  /** (ไม่บังคับ) ถามเฉพาะเมื่อเงื่อนไขตรง ณ ตอนเริ่มคุย */
  when?: Condition;
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
  /**
   * (ไม่บังคับ) ตรวจเนื้อหา: จุดนี้ต้องเป็นจุดสูงสุดของภูมิประเทศภายในรัศมีนี้ (ช่อง)
   * — ใช้กับปริศนา "หายอดเนิน" เพื่อให้ตำแหน่งสอดคล้องกับเส้นชั้นความสูงเสมอ
   */
  expectHighestWithin?: number;
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
  | { type: 'routesExplored'; count: number }
  /** เดินไปถึงใกล้ NPC แล้ว (ระบบจด flag "near:<npcId>" เมื่อเข้าใกล้ — เก็บในบันทึกเดิม) */
  | { type: 'near'; npcId: string }
  /** ทุกเงื่อนไขเป็นจริง */
  | { type: 'all'; of: ObjectiveCondition[] }
  /** อย่างน้อยหนึ่งเงื่อนไขเป็นจริง */
  | { type: 'any'; of: ObjectiveCondition[] };

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

export type ClueType = 'direction' | 'distance' | 'landmark' | 'elevation' | 'symbol' | 'comparison' | 'coordinate';

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
  /**
   * จุดสังเกตที่ต้องปักหมุด — หรือ 'site-analysis' ให้ระบบใช้สถานที่ที่ผ่านหลักฐานทุกข้อ
   * (คำนวณจากระดับความสูงและแผนที่ฐาน ไม่ได้กำหนดตายตัว)
   */
  targetId: string | 'site-analysis';
  /** (ไม่บังคับ) ผู้เล่นต้องยืนห่างจากตำแหน่งที่ปักไม่เกินค่านี้ (ช่อง) — "ต้องเดินไปถึงจริง" */
  mustStandWithinTiles?: number;
  /** รัศมีที่ยอมรับ (ช่อง) */
  toleranceTiles: number;
  wisdomPrompt: string;
  wisdomChoices: Choice[];
  correctWisdomId: string;
  requiredEvidenceIds: string[];
  /** (ไม่บังคับ) คำใบ้เฉพาะด่านเมื่อปักหมุดไม่ผ่าน แยกตามปัญหา — ไม่กำหนดใช้ข้อความกลาง */
  problemHints?: Partial<Record<'unexplored' | 'location' | 'wisdom' | 'evidence' | 'far', string>>;
  /** เปิดให้ปักหมุดเมื่อเงื่อนไขนี้เป็นจริง */
  availableWhen: Condition;
  successFlag: string;
}

export interface EndingDefinition {
  /** ข้อความที่ครูส่งผ่านสมุดภาคสนาม */
  messages: DialogueLine[];
  /** รหัสลับที่ได้จากบทนี้ (บทสรุปไม่มี) */
  codePiece?: { index: number; total: number; value: string };
  /**
   * (ไม่บังคับ) เริ่มตอนจบเองเมื่อจบบทสนทนาและเงื่อนไขนี้เป็นจริง (ใช้กับบทที่ไม่มีการปักหมุด)
   * — ตอนจบเริ่มไม่ได้ถ้าเงื่อนไขยังไม่ครบ
   */
  startWhen?: Condition;
  rewardItem: string;
  completeFlag: string;
}

/* ---------------- แผนที่สองแผ่น และสถานที่ผู้ต้องสงสัย ---------------- */

/**
 * แผนที่ฐาน (แผ่นกระดาษ) ที่ผู้เล่นได้รับ — ใช้พิกัดและมาตราส่วนเดียวกับแผนที่ด่าน (1 ช่อง = 10 ม.)
 * อาจมีข้อมูลผิดโดยตั้งใจ: ระบบตรวจด้วย checkSheet() เทียบกับโลกเกม ไม่ได้กำหนดว่าแผ่นใดถูก
 */
export interface BaseMapDefinition {
  id: string;
  title: string;
  /** หมายเหตุบนแผนที่ */
  note: string;
  /** ต้องมีหลักฐานนี้ก่อนจึงจะเปิดดูแผ่นนี้ได้ */
  requiredEvidenceId: string;
  lines: Array<{ style: 'stream' | 'road' | 'trail'; points: TilePoint[] }>;
  /** labelAt: ตำแหน่งป้ายชื่อ · refersTo: จุดสังเกตที่สัญลักษณ์นี้อ้างถึง (ใช้ตรวจตำแหน่ง) */
  marks: Array<{
    symbol: MapSymbol;
    at: TilePoint;
    label: string;
    labelAt?: 'above' | 'below' | 'left' | 'right';
    refersTo?: string;
  }>;
  /** ลูกศรทิศน้ำไหลที่พิมพ์บนแผนที่ */
  flowArrows?: Array<{ at: TilePoint; toward: Direction8 }>;
}

/** หน้าจอเปรียบเทียบแผนที่ฐาน — ผู้เล่นเลือกแผ่นที่ถูกต้องตามหลักฐาน 3 ชนิด */
export interface MapComparisonDefinition {
  /** ลำน้ำที่ใช้ตรวจลูกศรทิศน้ำไหล */
  waterwayId: string;
  toleranceTiles: number;
  /** จุดสังเกตที่ต้อง "ตรวจพบจริง" (ค้นพบด้วยการเดินไปถึง) ก่อนตัดสิน */
  requiredObservations: string[];
  /** เบาะแสที่ต้องมีก่อนตัดสิน (เช่น ข้อมูลระดับความสูง) */
  requiredClueIds: string[];
  /** เปิดให้ตัดสินเมื่อเงื่อนไขนี้เป็นจริง */
  availableWhen: Condition;
  successFlag: string;
}

export interface SiteAnalysisDefinition {
  /** ลำน้ำที่ใช้หาต้นน้ำ */
  waterwayId: string;
  /** สัญลักษณ์บนแผนที่ฐานที่ผ่านการตรวจ ที่เป้าหมายต้องมี */
  requiredSymbol: MapSymbol;
  toleranceTiles: number;
  /** สถานที่ผู้ต้องสงสัยทั้งหมด (รวมเป้าหมายจริง) — evidenceId: หลักฐานที่ได้เมื่อสำรวจถึงจุดนั้น */
  candidates: Array<{ landmarkId: string; label: string; evidenceId?: string }>;
  /**
   * (ไม่บังคับ) เป้าหมายที่ผู้ออกแบบตั้งใจ — ถ้าระบุ validateLevel จะตรวจว่าตรงกับผลคำนวณ
   * ระบบเกมใช้ผลคำนวณเสมอ (สถานที่เดียวที่ผ่านหลักฐานทุกข้อ)
   */
  correctLandmarkId?: string;
}

/**
 * จุดเป้าหมายในด่านพิกัด — ตรวจด้วย พิกัดกริด (หลังแก้ข้อผิดพลาดของบันทึก) + ตำแหน่งสัมพัทธ์ + หลักฐานภาคสนาม
 * ไม่ได้กำหนดคำตอบตายตัว: ระบบคำนวณจุดที่ผ่านทุกข้อ (validateLevel ตรวจว่ามีเพียงจุดเดียว)
 */
export interface GridSiteAnalysisDefinition {
  /** พิกัดที่เขียนในบันทึกสำรวจเก่า (ตามที่เขียนไว้ ซึ่งอาจผิด) */
  record: GridRef;
  /**
   * วิธีที่ผู้บันทึกใช้นับค่า N: 'standard' = จากขอบใต้ขึ้นไป (ถูกต้อง),
   * 'top-counted' = นับจากขอบบนลงมาแบบแกน y ของจอ (ผิด ต้องแปลงกลับ)
   */
  recordConvention: 'standard' | 'top-counted';
  /** คำบรรยายตำแหน่งสัมพัทธ์: ทิศและระยะจากจุดอ้างอิง */
  relative: { fromId: string; direction: Direction8; meters: number; toleranceMeters: number };
  /** สิ่งที่ต้องพบจากการสำรวจจริง (ดู Landmark.features) */
  requiredFeatures: string[];
  /** ชื่อภาษาไทยของ feature (ใช้อธิบายผล) */
  featureLabels: Record<string, string>;
  toleranceTiles: number;
  candidates: Array<{ landmarkId: string; label: string; evidenceId?: string }>;
  correctLandmarkId?: string;
  /** ประเภทสถานที่ที่ถูกต้อง (ใช้ตรวจตอนปักหมุด) */
  placeType: string;
  /** เบาะแสที่ต้องมีก่อนตัดสิน */
  requiredClueIds: string[];
  availableWhen: Condition;
  successFlag: string;
  /**
   * (ไม่บังคับ) การตรวจยืนยันภาคสนามหลังวิเคราะห์ (กด E ที่จุดเป้าหมาย): ระบบคำนวณพิกัด ทิศ/ระยะ
   * และสิ่งที่พบ ณ จุดนั้นให้ดูทีละข้อ — ผ่านครบจึงได้หลักฐาน evidenceId และ flag
   */
  verify?: { radiusTiles: number; when: Condition; evidenceId: string; flag: string };
}

/**
 * จุดเป้าหมายแบบหลักฐานรวม (ด่านสุดท้าย) — ระบบคำนวณข้อเท็จจริงของทุกจุดจากโลกเกม แล้วตรวจด้วย
 * evaluateIntegratedSite (core/site/IntegratedSiteAnalysis.ts) · validateLevel ตรวจว่ามีจุดเดียวที่ผ่านทุกข้อ
 * และหลักฐานแต่ละชนิดเพียงข้อเดียวชี้ได้มากกว่าหนึ่งจุด (ตอบจากหลักฐานข้อเดียวไม่ได้)
 */
export interface IntegratedSiteAnalysisDefinition {
  /** ทิศและระยะจากจุดอ้างอิง — แยกระยะเส้นตรงกับระยะตามถนน */
  distance: { fromId: string; direction: Direction8; straightMeters: number; roadMeters: number; toleranceMeters: number };
  /** สัญลักษณ์แผนที่ + สูงกว่า minElevationMeters + อยู่ทางต้นน้ำ/ปลายน้ำของจุด ofId บนลำน้ำ waterwayId */
  terrain: { symbol: MapSymbol; minElevationMeters: number; waterwayId: string; relation: 'upstream' | 'downstream'; ofId: string };
  /** N = N ของหมุด fromId + dN · ค่า E อ่านได้บางหลัก (eMask เช่น "5,?40") */
  grid: { fromId: string; dN: number; eMask: string; toleranceMeters: number };
  /** ชื่อภาษาไทยของสัญลักษณ์แผนที่ที่ใช้ในปริศนา (ใช้อธิบายผล) */
  symbolLabels: Record<string, string>;
  /**
   * (ไม่บังคับ) ตรวจยืนยันภาคสนามหลังวิเคราะห์ (กด E ที่จุดเป้าหมาย): ระบบคำนวณหลักฐาน 3 ชนิด ณ จุดนั้นให้ดูทีละข้อ
   * ผ่านครบจึงได้หลักฐาน evidenceId + flag และบันทึกข้อมูลภูมิปัญญา (recordText — ข้อมูลจำลอง)
   */
  verify?: { radiusTiles: number; when: Condition; evidenceId: string; flag: string; recordText: string };
  candidates: Array<{ landmarkId: string; label: string; evidenceId?: string }>;
  correctLandmarkId?: string;
  placeType: string;
  requiredClueIds: string[];
  availableWhen: Condition;
  successFlag: string;
}

/* ---------------- โครงเรื่อง ---------------- */

export type StoryStepStatus = 'prototype' | 'planned' | 'playable';

/** เงื่อนไขผ่านฉาก */
export type StepCondition =
  | { type: 'talk'; npcId: string }
  | { type: 'flag'; flag: string }
  /** ผ่านเมื่อเป้าหมายย่อยทุกข้อเป็นจริง (ใช้เงื่อนไขชุดเดียวกับภารกิจ) */
  | { type: 'all'; of: ObjectiveCondition[] };

/** ปุ่มลัดบนแถบภารกิจ — แตะแล้วเปิดเครื่องมือที่ขั้นนั้นต้องใช้ทันที */
export type GuideActionId =
  | 'settlement'
  | 'map'
  | 'clues'
  | 'routes'
  | 'measure'
  | 'analysis'
  | 'compare'
  | 'pin'
  | 'sheets'
  | 'target';

/**
 * ขั้นย่อยของฉาก (Micro-Quest) — แถบภารกิจแสดงทีละขั้น และบอก "การกระทำ" ไม่ใช่แค่เป้าหมาย:
 *   1) ตอนนี้ต้องทำอะไร (goal)  2) ใช้เครื่องมืออะไร (tools)  3) กด/แตะตรงไหน (steps + ปุ่มลัด action)
 *   4) ทำสำเร็จแล้วจะเกิดอะไร (result)
 * สำเร็จตามสถานะจริงของเกม จึงไม่มีข้อมูลบันทึกเพิ่ม และขั้นที่ทำไปก่อนลำดับจะถูกนับว่าสำเร็จเอง
 *
 * ข้อความใน steps/tool/think ใช้ตัวแปรปุ่ม {tap:<ปุ่ม>} ซึ่งแปลงเป็นคำของอุปกรณ์นั้น
 * (จอสัมผัส: "แตะปุ่ม 🗺️ แผนที่" · คอมพิวเตอร์: "กด M (แผนที่)") — ดู core/guide/GuideText.ts
 */
export interface MicroStep {
  id: string;
  /** ช่วงของภารกิจ (id ใน LevelDefinition.guidePhases) — นับความคืบหน้าแยกช่วง */
  phase?: string;
  /** เป็นขั้นย่อยของขั้นก่อนหน้า (นับรวมเป็นขั้นเดียวกัน) */
  joinPrev?: boolean;
  /** "เป้าหมายปัจจุบัน" — การกระทำเดียวที่ต้องทำ */
  goal: string;
  /** "วิธีทำ" ทีละข้อ — กด/แตะอะไร เปิดหน้าไหน (แสดงตลอด) */
  steps: string[];
  /** "เมื่อสำเร็จ" — ผลที่จะเกิดขึ้น */
  result: string;
  /** เครื่องมือที่ใช้ในขั้นนี้ */
  tools: string[];
  /** คำแนะนำระดับ 2: ควรใช้เครื่องมือใด อย่างไร */
  tool: string;
  /** คำแนะนำระดับ 3: คำถามช่วยคิด (ไม่เฉลย) */
  think: string;
  /** ข้อความเมื่อทำสำเร็จ เช่น "✓ รับภารกิจสำเร็จ!" */
  doneText?: string;
  done: ObjectiveCondition;
  /** นับว่าสำเร็จเมื่อขั้นใดขั้นหนึ่งที่อยู่ถัดไปในฉากเดียวกันสำเร็จแล้ว (เช่น อ่านสมุด → เปิดหน้าวิเคราะห์แล้ว) */
  impliedByLater?: boolean;
  /** นับว่าสำเร็จเมื่อ "ขั้นถัดไปทันที" สำเร็จแล้ว (เช่น ไปพบป้าศรี → คุยกับป้าศรีแล้ว แต่ไม่ใช่เพราะคุยกับคนอื่น) */
  impliedByNext?: boolean;
  /** เปิดสมุดระหว่างขั้นนี้ → เปิดที่หน้านี้ให้เลย */
  notebookTab?: 'clues' | 'routes';
  /** ปุ่มลัดบนแถบภารกิจ (และไฮไลต์ปุ่มเครื่องมือนั้น) */
  action?: GuideActionId;
  /** ชื่อปุ่มลัด (ไม่ใส่ = ชื่อมาตรฐานของเครื่องมือ) */
  actionLabel?: string;
  /**
   * เป้าหมายนำทาง: NPC หรือสถานที่ "ที่รู้ตำแหน่งแล้ว" เท่านั้น (เครื่องหมาย ! · ลูกศรขอบจอ · จุดบนแผนที่)
   * ห้ามใช้กับสถานที่ลับ/คำตอบ — when = เงื่อนไขเพิ่มเติมก่อนแสดง (เช่น ค้นพบบ้านผ้าปักแล้ว)
   */
  target?: { npcId?: string; landmarkId?: string; /** พื้นที่ที่ผู้เล่นเลือกเองจากการวิเคราะห์ (ไม่ใช่เฉลย) */ area?: 'chosen'; /** ผู้สอนคนแรกที่ยังมีบทเรียนเสริมรออยู่ (หลังวิเคราะห์ไม่ผ่าน) */ pendingTeacher?: boolean; when?: ObjectiveCondition };
  /** การวัดระยะของขั้นนี้: เริ่มวัดจากจุดอ้างอิงของภารกิจ (id สถานที่) · allowReset = ให้กด "เริ่มวัดใหม่จากตรงนี้" ได้ */
  measure?: { from: string; allowReset?: boolean };
}

export interface StoryStep {
  order: number;
  title: string;
  objective: string;
  /** id ของจุดสังเกตที่เป็นสถานที่หลักของฉาก */
  landmarkId: string;
  status: StoryStepStatus;
  completeWhen?: StepCondition;
  /** ขั้นย่อยของฉาก (ไม่บังคับ — ด่านที่ไม่มีใช้เป้าหมายของฉากเดิม) */
  micro?: MicroStep[];
}

/** ของตกแต่งในฉาก (ภาพ placeholder ไม่มีการชน ไม่มีผลต่อภารกิจ) เช่น ศาลพญาจระเข้ข้างครูเนม */
export interface DecorDefinition {
  id: string;
  kind: 'shrine';
  at: TilePoint;
}

/* ---------------- วิเคราะห์ความเหมาะสมของพื้นที่ตั้งถิ่นฐาน (บทที่ 3: เมืองโบราณใต้ผืนดิน) ---------------- */

/** หัวข้อที่ใช้ตัดสินคะแนน (และเป็นหัวข้อบทเรียนเสริมเมื่อคะแนนไม่ผ่าน) */
export type SettlementTopic = 'height' | 'water';

/** ช่วงคะแนน: ค่าที่วัดได้ "น้อยกว่า below" ได้ score (เรียงจากน้อยไปมาก · below = null คือช่วงสุดท้าย) */
export interface SettlementBand {
  below: number | null;
  score: number;
  /** คำอธิบายสั้นที่แสดงผู้เล่น เช่น "เหมาะสม" "ต่ำเกินไป เสี่ยงน้ำท่วม" */
  label: string;
}

/**
 * เกณฑ์ความเหมาะสมแบบ "จำลอง" 2 เรื่องเท่านั้น — คำนวณจากแบบจำลองความสูงและน้ำในแผนที่จริงของด่าน (ไม่สุ่ม ไม่มีคำตอบตายตัว)
 * คะแนนบอกความเหมาะสมตามเงื่อนไขในเกม ไม่ใช่ความน่าจะเป็นที่จะพบเมืองโบราณจริง
 *   ระดับความสูง (height)  สูงกว่าลำน้ำที่ใกล้ที่สุดกี่เมตร — ไม่ต่ำจนน้ำท่วมถึง ไม่สูงจนใช้น้ำลำบาก
 *   แหล่งน้ำ (water)       ระยะถึงลำน้ำ — ใกล้พอใช้น้ำ แต่ไม่ติดลำน้ำจนน้ำท่วมถึง
 *   คะแนนรวม = height + water (เต็ม 100) · ผ่านเมื่อมากกว่า passPercent
 */
export interface SettlementAnalysisDefinition {
  /** รัศมีวงกลมวิเคราะห์ (ช่อง) */
  radiusTiles: number;
  /** ผ่านเมื่อคะแนนรวม "มากกว่า" ค่านี้ (เปอร์เซ็นต์) */
  passPercent: number;
  /** เกณฑ์ที่ 1: สูงกว่าลำน้ำ (ม.) → คะแนน (เต็ม max) */
  height: { max: number; bands: SettlementBand[] };
  /** เกณฑ์ที่ 2: ระยะถึงลำน้ำ (ม.) → คะแนน (เต็ม max) */
  water: { max: number; bands: SettlementBand[] };
  /** หัวข้อ → ชื่อเรียกและผู้ที่สอนเสริม (id ของ NPC) */
  topics: Record<SettlementTopic, { label: string; teacherId: string }>;
  /** เปิดให้วิเคราะห์เมื่อ */
  availableWhen?: Condition;
  /** flag เมื่อวิเคราะห์ครั้งแรก (ไม่ว่าผ่านหรือไม่) · flag เมื่อวิเคราะห์ผ่าน */
  attemptFlag: string;
  successFlag: string;
  /** ตรวจสอบภาคสนามที่พื้นที่ที่เลือก (ต้องผ่านการวิเคราะห์ก่อน) */
  fieldCheck: {
    radiusTiles: number;
    when?: Condition;
    /** flag เมื่อตรวจครบ · หลักฐานที่ได้ */
    flag: string;
    evidenceId: string;
    nodes: DialogueNode[];
  };
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
  /** ของตกแต่งในฉาก (ไม่บังคับ) */
  decor?: DecorDefinition[];
  triggers?: TriggerZone[];
  quizzes?: QuizDefinition[];
  clues?: ClueDefinition[];
  evidence?: EvidenceDefinition[];
  routeAnalysis?: RouteAnalysisDefinition;
  pinTask?: PinTaskDefinition;
  ending?: EndingDefinition;
  quests?: QuestDefinition[];
  inspectPoints?: InspectPoint[];
  /** วิเคราะห์ความเหมาะสมของพื้นที่ตั้งถิ่นฐาน (บทที่ 3) */
  settlementAnalysis?: SettlementAnalysisDefinition;
  /** ระยะห่างเส้นชั้นความสูงบนแผนที่สำรวจ (ม.) — ไม่ระบุ = 10 */
  contourIntervalMeters?: number;
  /** แผนที่ภูมิประเทศที่ได้รับ: เมื่อมี flag นี้ แผนที่สำรวจแสดงเส้นชั้นความสูงทั้งแผ่น (ไม่ต้องเดินสำรวจก่อน) */
  topoMapFlag?: string;
  /** ช่วงของภารกิจหลัก (ขั้นย่อยที่มี phase นับความคืบหน้าแยกตามช่วง) เช่น รับภารกิจ → ตามหาแหล่งผ้าปัก */
  guidePhases?: Array<{ id: string; title: string }>;
  /** ลำน้ำที่ใช้วิเคราะห์ทิศน้ำไหล (แนวเดียวกับ feature ในแผนที่) */
  waterways?: WaterwayDefinition[];
  /** จุดระดับความสูงที่พิมพ์บนแผนที่สำรวจ (ค่าความสูงคำนวณจาก elevation) */
  spotHeights?: TilePoint[];
  /** ลำดับจุดบนลำน้ำที่เนื้อหาอธิบายว่า "ต่อเนื่องกัน" (ตรวจว่าเรียงตามทิศน้ำไหลที่คำนวณได้) */
  flowSequence?: { waterwayId: string; landmarkIds: string[] };
  /** แผนที่ฐาน (กระดาษ) ที่ผู้เล่นเปิดดูสลับกับแผนที่สำรวจได้ */
  baseMaps?: BaseMapDefinition[];
  /** หน้าจอเปรียบเทียบแผนที่ฐาน */
  mapComparison?: MapComparisonDefinition;
  /** สถานที่ผู้ต้องสงสัย (เป้าหมายจริง + สถานที่หลอก) */
  siteAnalysis?: SiteAnalysisDefinition;
  /** ระบบพิกัดกริดจำลอง (E/N เป็นเมตร, N เพิ่มไปทางเหนือ) — ไม่ระบุ = แสดงตำแหน่งเป็นช่องแบบเดิม */
  grid?: GridDefinition;
  /** จุดเป้าหมายที่ตรวจด้วยพิกัดกริด + ตำแหน่งสัมพัทธ์ + หลักฐานภาคสนาม */
  gridSiteAnalysis?: GridSiteAnalysisDefinition;
  /** จุดเป้าหมายที่ตรวจด้วยหลักฐานรวม: ทิศ/ระยะ (เส้นตรง+ถนน) · ภูมิประเทศ/สัญลักษณ์/ทิศน้ำไหล · พิกัด E/N จากหมุดอ้างอิง */
  integratedSiteAnalysis?: IntegratedSiteAnalysisDefinition;
  /** ทักษะที่แสดงในหน้าสรุปผล (ไม่ระบุ = ชุดทักษะของด่าน 1) */
  skills?: string[];
  /** id ด่านที่ปลดล็อกเมื่อผ่านด่านนี้ */
  unlocks?: string;
  /**
   * รุ่นของเนื้อหาด่าน — เพิ่มเมื่อโครงเรื่องเปลี่ยนจนบันทึกกลางด่านรุ่นเก่าใช้ไม่ได้
   * (บันทึกรุ่นไม่ตรงจะไม่ถูกโหลด และเริ่มด่านใหม่แทน · ไม่กระทบผลการผ่านด่าน)
   */
  contentVersion?: number;
  /**
   * โหมดสำรวจด้วยตนเอง: ไม่มีลูกศร/หมุด/เส้นนำทาง/วงแหวนไฮไลต์ NPC/เครื่องหมาย ✓ — ผู้เล่นหาทางจากคำบอกทิศ+ระยะ (มาตราส่วน) เอง
   * (ด่านที่ไม่ระบุ = ทำงานเหมือนเดิม)
   */
  exploreMode?: boolean;
  /** จุดที่ "เดินไปถึงเอง" แล้วจดเหตุการณ์ (flag + ข้อความสั้น) — ไม่มีหมุด/ป้ายบอกตำแหน่งล่วงหน้า */
  arrivals?: ArrivalDefinition[];
}

/** จุดที่ผู้เล่นเดินไปถึงเอง (เช่น จุดที่ต้องไปตรวจสอบ) — เปิดใช้เมื่อเงื่อนไข when เป็นจริง */
export interface ArrivalDefinition {
  id: string;
  at: TilePoint;
  radiusTiles: number;
  when?: Condition;
  flag: string;
  toast: string;
}
