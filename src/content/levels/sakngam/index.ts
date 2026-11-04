import type { LevelDefinition } from '../../types';
import { sakNgamMap } from './map';
import {
  sakNgamClues,
  sakNgamEnding,
  sakNgamEvidence,
  sakNgamPinTask,
  sakNgamQuizzes,
  sakNgamRouteAnalysis,
  sakNgamStory,
  sakNgamTriggers,
} from './mission';
import { sakNgamNpcs } from './npcs';

/**
 * ด่านที่ 1: ปริศนาลวดลายแห่งสักงาม
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
    { id: 'sala', name: 'ศาลาชุมชน', at: { x: 46, y: 45 }, showLabel: true },
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 54, y: 43 }, showLabel: true },
    { id: 'big-teak', name: 'ต้นสักใหญ่ (ทางแยก)', at: { x: 59, y: 30 }, showLabel: true },
    { id: 'wood-bridge', name: 'สะพานไม้ข้ามห้วยสาขา', at: { x: 60, y: 17 }, showLabel: true },
    { id: 'pottery', name: 'เตาปั้นดินเผา', at: { x: 40, y: 22 }, showLabel: true },
    { id: 'basketry', name: 'ลานจักสาน', at: { x: 77, y: 21 }, showLabel: true },
    { id: 'nai-chiao', name: 'แหล่งผ้าปักบ้านไหนเจียว', at: { x: 70, y: 13 }, showLabel: true },
  ],

  npcs: sakNgamNpcs,
  story: sakNgamStory,
  triggers: sakNgamTriggers,
  quizzes: sakNgamQuizzes,
  clues: sakNgamClues,
  evidence: sakNgamEvidence,
  routeAnalysis: sakNgamRouteAnalysis,
  pinTask: sakNgamPinTask,
  ending: sakNgamEnding,
  unlocks: 'level-2',
};
