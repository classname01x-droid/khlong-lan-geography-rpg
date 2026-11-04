import type { LevelDefinition } from '../../types';
import { khlongLanPattanaMap, STREAM_POINTS } from './map';
import {
  lanClues,
  lanEnding,
  lanEvidence,
  lanInspectPoints,
  lanIntegratedAnalysis,
  lanPinTask,
  lanQuests,
  lanQuizzes,
  lanStory,
} from './mission';
import { khlongLanPattanaNpcs } from './npcs';

/**
 * ด่านที่ 4 (ด่านสุดท้าย, ต้นแบบ): ปริศนาแผนที่ลับแห่งคลองลานพัฒนา
 * ใช้ id 'level-4' ที่จองไว้ → ปลดล็อกเมื่อจบด่าน 3 (pongNamRonLevel.unlocks = 'level-4' เดิม)
 * รอบนี้เล่นได้ฉาก 1–3 · ฉาก 4–7 มีข้อมูลและตรรกะตรวจ (ยังไปไม่ถึงตอนจบ จึงยังไม่ได้รหัสชิ้นที่ 4)
 */
export const khlongLanPattanaLevel: LevelDefinition = {
  id: 'level-4',
  contentVersion: 1,
  tambon: 'ตำบลคลองลานพัฒนา',
  title: 'ปริศนาแผนที่ลับแห่งคลองลานพัฒนา',
  map: khlongLanPattanaMap,
  spawn: { x: 11, y: 51 },
  fog: { revealRadiusTiles: 5 },
  // พิกัดกริดจำลอง: มุมตะวันตกเฉียงใต้ = E 5,000 · N 2,000 (ไม่ซ้ำกับด่าน 3)
  grid: { falseEasting: 5000, falseNorthing: 2000 },

  landmarks: [
    { id: 'center', name: 'ศูนย์ภาคสนามของครูเนม (จุดเริ่มต้น)', at: { x: 14, y: 50 }, showLabel: true, symbol: 'school' },
    { id: 'village', name: 'ชุมชนคลองลานพัฒนา', at: { x: 28, y: 38 }, showLabel: true, symbol: 'village', mapLabelAt: 'right' },
    { id: 'bridge', name: 'สะพานข้ามลำน้ำ', at: { x: 40, y: 44 }, showLabel: true, symbol: 'bridge' },
    { id: 'junction', name: 'สี่แยกทางขึ้นเนิน', at: { x: 56, y: 44 }, showLabel: true },
    { id: 'farm', name: 'พื้นที่เกษตร', at: { x: 62, y: 52 }, showLabel: true, symbol: 'farm' },
    { id: 'rp-1', name: 'หมุดอ้างอิง RP-1', at: { x: 20, y: 39 }, showLabel: true, symbol: 'refmark', mapLabelAt: 'left' },
    { id: 'rp-2', name: 'หมุดอ้างอิง RP-2', at: { x: 50, y: 49 }, showLabel: true, symbol: 'refmark' },
    { id: 'rp-3', name: 'หมุดอ้างอิง RP-3', at: { x: 70, y: 39 }, showLabel: true, symbol: 'refmark' },
    { id: 'bm-up', name: 'ป้ายวัดระดับทางเหนือ', at: { x: 56, y: 12 }, showLabel: true, symbol: 'benchmark' },
    { id: 'bm-down', name: 'ป้ายวัดระดับทางใต้', at: { x: 40, y: 52 }, showLabel: true, symbol: 'benchmark' },
    { id: 'site-a', name: 'จุด A อาคารบนเนินตะวันตก', at: { x: 24, y: 24 }, showLabel: true, symbol: 'office' },
    { id: 'site-b', name: 'จุด B อาคารบนเนินตะวันออก', at: { x: 64, y: 24 }, showLabel: true, symbol: 'office' },
    { id: 'site-c', name: 'จุด C วัดบนเนินตะวันออก', at: { x: 60, y: 19 }, showLabel: true, symbol: 'temple', mapLabelAt: 'left' },
  ],

  npcs: khlongLanPattanaNpcs,
  story: lanStory,
  quizzes: lanQuizzes,
  clues: lanClues,
  evidence: lanEvidence,
  inspectPoints: lanInspectPoints,
  quests: lanQuests,
  waterways: [{ id: 'stream-main', name: 'ลำน้ำคลองลาน (สมมติ)', points: STREAM_POINTS }],
  spotHeights: [
    { x: 24, y: 20 },
    { x: 67, y: 18 },
    { x: 40, y: 56 },
    { x: 12, y: 30 },
  ],
  integratedSiteAnalysis: lanIntegratedAnalysis,
  pinTask: lanPinTask,
  ending: lanEnding,
  skills: ['scale', 'straight-vs-route', 'direction', 'elevation', 'map-symbols', 'grid-reference', 'relative-position', 'evidence-synthesis'],
};
