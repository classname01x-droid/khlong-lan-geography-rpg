import type { LevelDefinition } from '../../types';
import { sakNgamMap } from './map';
import {
  sakNgamInspectPoints,
  sakNgamQuests,
  sakNgamClues,
  sakNgamEnding,
  sakNgamEvidence,
  sakNgamPinTask,
  sakNgamQuizzes,
  sakNgamRouteAnalysis,
  sakNgamStory,
  sakNgamTriggers,
  SAKNGAM_PHASES,
} from './mission';
import { sakNgamNpcs } from './npcs';

/**
 * ด่านที่ 1: ปริศนาลวดลายแห่งสักงาม — ตามหารหัสหีบสมบัติชิ้นแรก
 * โฟลเดอร์นี้มีแต่ "เนื้อหา" — ไม่มีโค้ดระบบเกม
 *   map.ts      ผังแผนที่
 *   npcs.ts     ตัวละครและบทพูด
 *   mission.ts  คำถาม เบาะแส เส้นทาง การปักหมุด ตอนจบ และโครงเรื่อง 6 ฉาก
 */
export const sakNgamLevel: LevelDefinition = {
  id: 'sakngam',
  tambon: 'ตำบลสักงาม',
  title: 'ปริศนาลวดลายแห่งสักงาม',
  map: sakNgamMap,
  spawn: { x: 14, y: 43 },
  fog: { revealRadiusTiles: 5 },

  landmarks: [
    { id: 'school', name: 'โรงเรียนสักงาม (เสาธง)', at: { x: 15, y: 40 }, showLabel: true },
    { id: 'bridge', name: 'สะพานข้ามลำห้วยใหญ่', at: { x: 32, y: 48 }, showLabel: true },
    // ครูเนมบอกตำแหน่งแล้ว (หลังรับภารกิจ) → แสดงชื่อบนแผนที่ได้ก่อนเดินไปถึง (ไม่แสดงเส้นทาง)
    { id: 'sala', name: 'ศาลาชุมชน', at: { x: 46, y: 45 }, showLabel: true, knownWhen: { minStep: 2 } },
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 54, y: 43 }, showLabel: true },
    { id: 'big-teak', name: 'ต้นสักใหญ่ (ทางแยก)', at: { x: 59, y: 30 }, showLabel: true },
    { id: 'wood-bridge', name: 'สะพานไม้ข้ามห้วยสาขา', at: { x: 60, y: 17 }, showLabel: true },
    { id: 'pottery', name: 'เตาปั้นดินเผา', at: { x: 40, y: 22 }, showLabel: true },
    { id: 'basketry', name: 'ลานจักสาน', at: { x: 77, y: 21 }, showLabel: true },
    { id: 'nai-chiao', name: 'แหล่งผ้าปักบ้านไหนเจียว', at: { x: 70, y: 13 }, showLabel: true },
    // จุดลับของภารกิจปริศนา — ไม่แสดงป้ายจนกว่าจะตรวจค้นพบ
    {
      id: 'old-banyan',
      name: 'ที่นั่งปักผ้าของบรรพบุรุษ',
      at: { x: 40, y: 13 },
      showLabel: true,
      revealFlag: 'mystery-found',
    },
  ],

  npcs: sakNgamNpcs,
  // หีบไม้เก่าที่ครูเนมพบ (ภาพ placeholder) — เรื่องหีบเป็นเรื่องแต่งในเกม
  decor: [{ id: 'old-chest', kind: 'chest', at: { x: 11, y: 40 } }],
  story: sakNgamStory,
  triggers: sakNgamTriggers,
  quizzes: sakNgamQuizzes,
  clues: sakNgamClues,
  evidence: sakNgamEvidence,
  routeAnalysis: sakNgamRouteAnalysis,
  pinTask: sakNgamPinTask,
  ending: sakNgamEnding,
  quests: sakNgamQuests,
  inspectPoints: sakNgamInspectPoints,
  guidePhases: SAKNGAM_PHASES,
  unlocks: 'level-2',
};
