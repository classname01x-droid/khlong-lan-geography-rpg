import type { LevelDefinition } from '../../types';
import { khlongNamLaiMap, STREAM_POINTS } from './map';
import {
  namLaiClues,
  namLaiEvidence,
  namLaiInspectPoints,
  namLaiOldMap,
  namLaiQuests,
  namLaiQuizzes,
  namLaiSiteAnalysis,
  namLaiStory,
} from './mission';
import { khlongNamLaiNpcs } from './npcs';

/**
 * ด่านที่ 2 (ต้นแบบ): ปริศนาสายน้ำแห่งคลองน้ำไหล
 * ใช้ id 'level-2' ที่จองไว้ใน LEVEL_SEQUENCE ตั้งแต่ v0.3 → ข้อมูลบันทึกที่ปลดล็อกด่าน 2 ไว้แล้วใช้ต่อได้
 * โฟลเดอร์นี้มีแต่เนื้อหา (map.ts · npcs.ts · mission.ts) — ระบบเกมใช้ร่วมกับด่านสักงาม
 */
export const khlongNamLaiLevel: LevelDefinition = {
  id: 'level-2',
  tambon: 'ตำบลคลองน้ำไหล',
  title: 'ปริศนาสายน้ำแห่งคลองน้ำไหล',
  map: khlongNamLaiMap,
  spawn: { x: 10, y: 13 },
  fog: { revealRadiusTiles: 5 },

  landmarks: [
    { id: 'school', name: 'โรงเรียนบ้านคลองน้ำไหล', at: { x: 13, y: 11 }, showLabel: true, symbol: 'school' },
    { id: 'village', name: 'หมู่บ้าน', at: { x: 45, y: 33 }, showLabel: true, symbol: 'village' },
    { id: 'water-office', name: 'ศาลาจัดการน้ำชุมชน', at: { x: 45, y: 37 }, showLabel: true, symbol: 'office' },
    { id: 'bridge', name: 'สะพานข้ามลำห้วย', at: { x: 31, y: 34 }, showLabel: true, symbol: 'bridge' },
    { id: 'temple', name: 'วัด', at: { x: 62, y: 32 }, showLabel: true, symbol: 'temple' },
    { id: 'weir', name: 'ฝายกั้นลำห้วย', at: { x: 32, y: 22 }, showLabel: true, symbol: 'weir' },
    { id: 'marsh', name: 'หนองน้ำท้ายหมู่บ้าน', at: { x: 35, y: 5 }, showLabel: true, symbol: 'marsh' },
    { id: 'farm-pond', name: 'บ่อน้ำในไร่', at: { x: 63, y: 48 }, showLabel: true, symbol: 'pond' },
    { id: 'bm-north', name: 'หมุดหลักฐานระดับ (เหนือ)', at: { x: 36, y: 12 }, showLabel: true, symbol: 'benchmark' },
    { id: 'bm-south', name: 'หมุดหลักฐานระดับ (ใต้)', at: { x: 27, y: 46 }, showLabel: true, symbol: 'benchmark' },
    { id: 'three-stones', name: 'หินใหญ่สามก้อน', at: { x: 26, y: 54 }, showLabel: true, symbol: 'stones', mapLabelAt: 'right' },
    { id: 'spring', name: 'แอ่งน้ำใต้เนิน', at: { x: 22, y: 54 }, showLabel: true, symbol: 'spring', mapLabelAt: 'left' },
  ],

  npcs: khlongNamLaiNpcs,
  story: namLaiStory,
  quizzes: namLaiQuizzes,
  clues: namLaiClues,
  evidence: namLaiEvidence,
  inspectPoints: namLaiInspectPoints,
  quests: namLaiQuests,
  waterways: [{ id: 'stream-main', name: 'ลำห้วยคลองน้ำไหล', points: STREAM_POINTS }],
  spotHeights: [
    { x: 20, y: 6 },
    { x: 50, y: 10 },
    { x: 70, y: 20 },
    { x: 40, y: 45 },
    { x: 12, y: 50 },
    { x: 70, y: 48 },
    { x: 50, y: 56 },
  ],
  oldMap: namLaiOldMap,
  siteAnalysis: namLaiSiteAnalysis,
  skills: ['direction', 'elevation', 'map-symbols', 'map-compare', 'odometer', 'grid-coordinates'],
  // ยังไม่มีตอนจบ/รหัสลับชิ้นที่ 2 ในต้นแบบนี้ — เมื่อทำฉาก 6 ให้เพิ่ม ending และ unlocks: 'level-3'
};
