import type { LevelDefinition } from '../../types';
import { pongNamRonMap } from './map';
import {
  PONG_PHASES,
  pongClues,
  pongEnding,
  pongEvidence,
  pongQuests,
  pongQuizzes,
  pongSettlement,
  pongStory,
} from './mission';
import { pongNamRonNpcs } from './npcs';

/**
 * ด่านที่ 3: ปริศนาเมืองโบราณใต้ผืนดิน (ตำบลโป่งน้ำร้อน · 6 ฉาก · รหัสลับชิ้นที่ 3 = "พิกัด")
 * ใช้ id 'level-3' ที่จองไว้ใน LEVEL_SEQUENCE → ปลดล็อกเมื่อจบด่าน 2 และปลดล็อกบทที่ 4 เมื่อจบ
 * โฟลเดอร์นี้มีแต่เนื้อหา — ระบบวิเคราะห์พื้นที่อยู่ที่ core/site/SettlementAnalysis.ts
 *
 * contentVersion 2: เนื้อหาบทนี้ถูกรื้อใหม่ทั้งบท — บันทึกกลางด่านรุ่นเดิม (รุ่น 1: ปริศนาพิกัด RP/A-B-C) ใช้ต่อไม่ได้
 * ระบบจะรีเซ็ตเฉพาะการเล่นกลางบทที่ 3 พร้อมแจ้งผู้เล่น · บทที่ 1–2 · รหัสที่ได้รับ · การปลดล็อกบท ไม่ถูกแตะต้อง
 *
 * เรื่องเมืองโบราณเป็นสถานการณ์จำลองเพื่อการเรียนรู้ ไม่ใช่ประวัติศาสตร์จริงของตำบลโป่งน้ำร้อน
 */
export const pongNamRonLevel: LevelDefinition = {
  id: 'level-3',
  contentVersion: 2,
  tambon: 'ตำบลโป่งน้ำร้อน',
  title: 'ปริศนาเมืองโบราณใต้ผืนดิน',
  map: pongNamRonMap,
  spawn: { x: 11, y: 51 },
  fog: { revealRadiusTiles: 5 },
  // พิกัดกริดจำลอง: มุมตะวันตกเฉียงใต้ของแผนที่ = E 4,000 · N 1,000 (ใช้บอกที่ตั้งพื้นที่ที่เลือกในรายงาน)
  grid: { falseEasting: 4000, falseNorthing: 1000 },
  // แผนที่ภูมิประเทศ: เส้นชั้นความสูงทุก 2 ม. (เส้นหนาทุก 10 ม.) แสดงทั้งตำบลเมื่อได้รับจากครูเนม
  contourIntervalMeters: 2,
  topoMapFlag: 'got-topo-map',

  landmarks: [
    { id: 'school', name: 'โรงเรียนบ้านโป่งน้ำร้อน (เสาธง)', at: { x: 14, y: 50 }, showLabel: true, symbol: 'school' },
    { id: 'hall', name: 'ศาลาประชาคม', at: { x: 30, y: 47 }, showLabel: true, symbol: 'office' },
    { id: 'village', name: 'ชุมชนโป่งน้ำร้อน', at: { x: 31, y: 42 }, showLabel: true, symbol: 'village' },
    { id: 'bridge', name: 'สะพานข้ามลำห้วย', at: { x: 49, y: 44 }, showLabel: true, symbol: 'bridge' },
    { id: 'camp', name: 'ค่ายสำรวจภาคสนาม', at: { x: 57, y: 29 }, showLabel: true, symbol: 'office', mapLabelAt: 'right' },
    { id: 'viewpoint', name: 'จุดชมวิว', at: { x: 30, y: 6 }, showLabel: true },
  ],

  npcs: pongNamRonNpcs,
  story: pongStory,
  guidePhases: PONG_PHASES,
  quizzes: pongQuizzes,
  clues: pongClues,
  evidence: pongEvidence,
  quests: pongQuests,
  // จุดระดับความสูงบนแผนที่ (ค่าคำนวณจากแบบจำลองความสูง) — ไม่ชี้พื้นที่ที่ผ่านเกณฑ์
  spotHeights: [
    { x: 68, y: 10 },
    { x: 10, y: 12 },
    { x: 30, y: 6 },
    { x: 14, y: 50 },
    { x: 31, y: 47 },
    { x: 57, y: 29 },
    { x: 55, y: 56 },
  ],
  settlementAnalysis: pongSettlement,
  ending: pongEnding,
  unlocks: 'level-4',
  skills: ['contour-reading', 'slope-analysis', 'site-suitability', 'grid-reference', 'scale', 'direction'],
};
