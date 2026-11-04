import type { LevelDefinition } from '../../types';
import { khlongNamLaiMap, STREAM_POINTS } from './map';
import {
  namLaiBaseMaps,
  namLaiClues,
  namLaiEnding,
  namLaiEvidence,
  namLaiInspectPoints,
  namLaiMapComparison,
  namLaiPinTask,
  namLaiQuests,
  namLaiQuizzes,
  namLaiSiteAnalysis,
  namLaiStory,
} from './mission';
import { khlongNamLaiNpcs } from './npcs';

/**
 * ด่านที่ 2: ปริศนาสายน้ำแห่งคลองน้ำไหล (6 ฉาก)
 * ใช้ id 'level-2' ที่จองไว้ใน LEVEL_SEQUENCE → ข้อมูลบันทึกที่ปลดล็อกด่าน 2 ไว้แล้วใช้ต่อได้
 * โฟลเดอร์นี้มีแต่เนื้อหา (map.ts · npcs.ts · mission.ts) — ระบบเกมใช้ร่วมกับด่านสักงาม
 */
export const khlongNamLaiLevel: LevelDefinition = {
  id: 'level-2',
  // รุ่น 2: โครงเรื่อง 6 ฉาก (รุ่น 1 = ต้นแบบ v0.5) — บันทึกกลางด่านของต้นแบบจะไม่ถูกโหลด
  contentVersion: 2,
  tambon: 'ตำบลคลองน้ำไหล',
  title: 'ปริศนาสายน้ำแห่งคลองน้ำไหล',
  map: khlongNamLaiMap,
  spawn: { x: 10, y: 13 },
  fog: { revealRadiusTiles: 5 },

  landmarks: [
    { id: 'school', name: 'โรงเรียนบ้านคลองน้ำไหล', at: { x: 13, y: 11 }, showLabel: true, symbol: 'school' },
    { id: 'village', name: 'หมู่บ้าน', at: { x: 45, y: 33 }, showLabel: true, symbol: 'village' },
    { id: 'water-office', name: 'ศาลาจัดการน้ำชุมชน', at: { x: 45, y: 37 }, showLabel: true, symbol: 'office', mapLabelAt: 'below' },
    { id: 'bridge', name: 'สะพานข้ามลำห้วย', at: { x: 31, y: 34 }, showLabel: true, symbol: 'bridge' },
    { id: 'temple', name: 'วัด', at: { x: 62, y: 32 }, showLabel: true, symbol: 'temple' },
    { id: 'farmland', name: 'พื้นที่เกษตร', at: { x: 58, y: 42 }, showLabel: true, symbol: 'farm' },
    { id: 'farm-pond', name: 'บ่อน้ำในไร่', at: { x: 63, y: 48 }, showLabel: true, symbol: 'pond' },
    { id: 'bm-north', name: 'หมุดหลักฐานระดับ (เหนือ)', at: { x: 36, y: 12 }, showLabel: true, symbol: 'benchmark' },
    { id: 'bm-south', name: 'หมุดหลักฐานระดับ (ใต้)', at: { x: 27, y: 46 }, showLabel: true, symbol: 'benchmark' },
    { id: 'site-a', name: 'จุด A แอ่งน้ำใต้เนิน', at: { x: 22, y: 52 }, showLabel: true, symbol: 'spring', mapLabelAt: 'left' },
    { id: 'site-b', name: 'จุด B ฝายกั้นลำห้วย', at: { x: 30, y: 27 }, showLabel: true, symbol: 'weir', mapLabelAt: 'right' },
    { id: 'site-c', name: 'จุด C หนองน้ำท้ายหมู่บ้าน', at: { x: 33, y: 2 }, showLabel: true, symbol: 'marsh', mapLabelAt: 'below' },
    { id: 'three-stones', name: 'หินใหญ่สามก้อน', at: { x: 26, y: 54 }, showLabel: true, symbol: 'stones', mapLabelAt: 'right' },
    // ภารกิจปริศนา: ยอดเนิน — ไม่แสดงป้ายจนกว่าจะพบไห
    { id: 'hill-summit', name: 'ยอดเนินตะวันออก', at: { x: 70, y: 51 }, showLabel: true, revealFlag: 'jar-found' },
  ],

  npcs: khlongNamLaiNpcs,
  story: namLaiStory,
  quizzes: namLaiQuizzes,
  clues: namLaiClues,
  evidence: namLaiEvidence,
  inspectPoints: namLaiInspectPoints,
  quests: namLaiQuests,
  waterways: [{ id: 'stream-main', name: 'ลำห้วยคลองน้ำไหล', points: STREAM_POINTS }],
  // ลำดับจุดบนลำห้วยที่ผู้ดูแลแหล่งน้ำอธิบาย — validateLevel ตรวจว่าเรียงตามทิศน้ำไหลจริงและความสูงลดลง
  flowSequence: { waterwayId: 'stream-main', landmarkIds: ['site-a', 'site-b', 'site-c'] },
  spotHeights: [
    { x: 20, y: 6 },
    { x: 50, y: 10 },
    { x: 70, y: 20 },
    { x: 40, y: 45 },
    { x: 12, y: 50 },
    { x: 50, y: 56 },
  ],
  baseMaps: namLaiBaseMaps,
  mapComparison: namLaiMapComparison,
  siteAnalysis: namLaiSiteAnalysis,
  pinTask: namLaiPinTask,
  ending: namLaiEnding,
  unlocks: 'level-3',
  skills: ['map-symbols', 'elevation', 'map-compare', 'direction', 'grid-coordinates', 'odometer'],
};
