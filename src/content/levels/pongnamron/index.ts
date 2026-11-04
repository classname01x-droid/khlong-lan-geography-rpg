import type { LevelDefinition } from '../../types';
import { pongNamRonMap } from './map';
import {
  pongClues,
  pongEnding,
  pongEvidence,
  pongGridSiteAnalysis,
  pongInspectPoints,
  pongPinTask,
  pongQuests,
  pongQuizzes,
  pongStory,
} from './mission';
import { pongNamRonNpcs } from './npcs';

/**
 * ด่านที่ 3: ปริศนาพิกัดลับแห่งโป่งน้ำร้อน (เล่นได้ครบ 6 ฉาก · รหัสลับชิ้นที่ 3)
 * ใช้ id 'level-3' ที่จองไว้ใน LEVEL_SEQUENCE → ปลดล็อกเมื่อจบด่าน 2 (ด่าน 2 ตั้ง unlocks: 'level-3' ไว้แล้ว)
 * โฟลเดอร์นี้มีแต่เนื้อหา — ระบบเกมใช้ร่วมกับด่าน 1–2
 */
export const pongNamRonLevel: LevelDefinition = {
  id: 'level-3',
  contentVersion: 1,
  tambon: 'ตำบลโป่งน้ำร้อน',
  title: 'ปริศนาพิกัดลับแห่งโป่งน้ำร้อน',
  map: pongNamRonMap,
  spawn: { x: 11, y: 51 },
  fog: { revealRadiusTiles: 5 },
  // พิกัดกริดจำลอง: มุมตะวันตกเฉียงใต้ของแผนที่ = E 4,000 · N 1,000
  grid: { falseEasting: 4000, falseNorthing: 1000 },

  landmarks: [
    { id: 'school', name: 'โรงเรียนบ้านโป่งน้ำร้อน (เสาธง)', at: { x: 14, y: 50 }, showLabel: true, symbol: 'school' },
    { id: 'hall', name: 'ศาลาประชาคม', at: { x: 30, y: 47 }, showLabel: true, symbol: 'office' },
    { id: 'village', name: 'ชุมชนโป่งน้ำร้อน', at: { x: 31, y: 42 }, showLabel: true, symbol: 'village' },
    { id: 'bridge', name: 'สะพานข้ามลำห้วย', at: { x: 49, y: 44 }, showLabel: true, symbol: 'bridge' },
    { id: 'rp-1', name: 'หมุดอ้างอิง RP-1', at: { x: 20, y: 39 }, showLabel: true, symbol: 'refmark' },
    { id: 'rp-2', name: 'หมุดอ้างอิง RP-2', at: { x: 40, y: 49 }, showLabel: true, symbol: 'refmark' },
    { id: 'rp-3', name: 'หมุดอ้างอิง RP-3', at: { x: 70, y: 39 }, showLabel: true, symbol: 'refmark' },
    { id: 'viewpoint', name: 'จุดชมวิว', at: { x: 30, y: 6 }, showLabel: true },
    // ภารกิจปริศนา: ไม่แสดงป้ายบนแผนที่ (ต้องหาด้วยการคำนวณพิกัด)
    { id: 'old-mark', name: 'หมุดสำรวจเก่า', at: { x: 20, y: 24 }, showLabel: false },
    {
      id: 'site-a',
      name: 'จุด A สระน้ำหลังสวน',
      at: { x: 66, y: 41 },
      showLabel: true,
      symbol: 'pond',
      features: ['pond', 'white-rock'],
    },
    {
      id: 'site-b',
      name: 'จุด B บ่อน้ำเชิงเขา',
      at: { x: 66, y: 18 },
      showLabel: true,
      symbol: 'hotspring',
      features: ['steam', 'white-rock'],
    },
    {
      id: 'site-c',
      name: 'จุด C บ่อแช่เท้าชุมชน',
      at: { x: 73, y: 28 },
      showLabel: true,
      symbol: 'hotspring',
      features: ['steam'],
    },
  ],

  npcs: pongNamRonNpcs,
  story: pongStory,
  quizzes: pongQuizzes,
  clues: pongClues,
  evidence: pongEvidence,
  inspectPoints: pongInspectPoints,
  quests: pongQuests,
  spotHeights: [
    { x: 10, y: 12 },
    { x: 68, y: 10 },
    { x: 40, y: 20 },
    { x: 30, y: 52 },
    { x: 60, y: 36 },
  ],
  gridSiteAnalysis: pongGridSiteAnalysis,
  pinTask: pongPinTask,
  ending: pongEnding,
  unlocks: 'level-4',
  skills: ['grid-reference', 'relative-position', 'direction', 'landmark', 'grid-coordinates', 'odometer'],
};
