import type { MapDefinition, TilePoint } from '../core/world/types';

/**
 * รูปแบบข้อมูลเนื้อหาด่าน — ด่านใหม่ (ตำบลอื่น) เขียนเป็นข้อมูลตามรูปแบบนี้
 * โดยไม่ต้องแก้โค้ดระบบเกม
 */

/** รูปลักษณ์ตัวละคร (ระบบกราฟิกจะเลือกชุดสีตามค่านี้) */
export type CharacterAppearance = 'student' | 'teacher' | 'headman' | 'villager';

export interface Landmark {
  id: string;
  name: string;
  /** ตำแหน่งอ้างอิงของจุดสังเกต (ช่อง) ใช้คำนวณระยะ/ทิศในบทพูด */
  at: TilePoint;
  /** แสดงป้ายชื่อบนแผนที่เมื่อพื้นที่ถูกเปิดแล้ว */
  showLabel: boolean;
}

export interface DialogueLine {
  speaker: string;
  /** ใช้ตัวแปร {{dist:a>b}} และ {{dir:a>b}} ได้ — ระบบจะคำนวณจากแผนที่จริง */
  text: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  at: TilePoint;
  dialogue: DialogueLine[];
}

export type StoryStepStatus = 'prototype' | 'planned';

/** เงื่อนไขผ่านฉาก (ต้นแบบมีแค่การคุยกับ NPC จนจบ — จะเพิ่มชนิดอื่นภายหลัง) */
export type StepCondition = { type: 'talk'; npcId: string };

/** โครงเรื่อง 6 ฉากของด่าน (ตอนนี้เป็นข้อมูลอ้างอิง ยังไม่ผูกกับระบบภารกิจ) */
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
}
