import { ElevationModel } from '../../../core/world/Elevation';
import { analyzeWaterway } from '../../../core/world/Waterway';
import type { LevelDefinition } from '../../types';
import { buildMissions, extremeOf, flowChoices, type MissionSpec } from '../simple';
import { khlongNamLaiMap, STREAM_POINTS } from './map';

/**
 * ด่านที่ 2: ตำบลคลองน้ำไหล — ช่วยชาวบ้าน 3 คน (ที่ตั้งบ้านปลอดภัย · ทิศน้ำไหล · น้ำไปรวมที่ไหน)
 * ความสูง/ทิศน้ำไหลคำนวณจากแบบจำลองความสูงของแผนที่ (ดู ../simple.ts)
 */
const A = { id: 'site-a', at: { x: 22, y: 52 } };
const B = { id: 'site-b', at: { x: 30, y: 27 } };
const C = { id: 'site-c', at: { x: 33, y: 2 } };
const label: Record<string, string> = { 'site-a': 'จุด A', 'site-b': 'จุด B', 'site-c': 'จุด C' };
const high = extremeOf(khlongNamLaiMap, [A, B, C], 'highest');
const low = extremeOf(khlongNamLaiMap, [A, B, C], 'lowest');
const flow = analyzeWaterway(STREAM_POINTS, new ElevationModel(khlongNamLaiMap.elevation!)).flowDirection;

const specs: MissionSpec[] = [
  {
    id: 'house',
    npc: { id: 'villager-hom', name: 'ยายคำ', appearance: 'villager', at: { x: 47, y: 33 } },
    problem: 'ยายจะสร้างบ้านหลังใหม่ ปีก่อนน้ำหลากท่วมบ้านเก่าจนเสียหาย',
    question: 'จุด A, B, C จุดใดสูงที่สุด จึงปลอดภัยจากน้ำท่วมที่สุด?',
    correct: label[high.id],
    wrong: [label[high.others[0]], label[high.others[1]]],
    hint: 'เปิดแผนที่ ดูตัวเลขความสูงของแต่ละจุด ที่สูงกว่าน้ำจะไม่ท่วม',
    feedback: `ถูกต้อง! ${label[high.id]} สูงที่สุด (${high.meters[high.id]} ม.)`,
    thanks: 'ยายจะสร้างบ้านบนที่สูง ขอบใจมากนะ',
    landmark: 'village',
    goal: 'ช่วยยายคำเลือกที่สร้างบ้านที่ปลอดภัย',
  },
  {
    id: 'flow',
    npc: { id: 'surveyor-phum', name: 'ลุงมี', appearance: 'villager', at: { x: 28, y: 36 } },
    problem: 'ฝนตกหนักทีไร ฉันอยากรู้ว่าน้ำในลำห้วยจะไหลไปทางไหน',
    question: 'น้ำในลำห้วยไหลไปทางทิศใด?',
    ...flowChoices(flow),
    hint: 'น้ำไหลจากที่สูงไปที่ต่ำ ดูตัวเลขความสูงจุด A, B, C',
    feedback: 'ถูกต้อง! น้ำไหลจากที่สูงไปที่ต่ำเสมอ',
    thanks: 'เข้าใจแล้ว จะเตรียมรับน้ำปลายลำห้วย',
    landmark: 'bridge',
    goal: 'ช่วยลุงมีหาทิศที่น้ำฝนไหล',
  },
  {
    id: 'gather',
    npc: { id: 'water-keeper', name: 'ป้าจันทร์', appearance: 'headman', at: { x: 47, y: 37 } },
    problem: 'หลังฝนตกหนัก น้ำจากที่สูงไหลลงมารวมกันจนท่วมบางจุด',
    question: 'น้ำจะไปรวมกันมากที่สุดที่จุดใด?',
    correct: label[low.id],
    wrong: [label[low.others[0]], label[low.others[1]]],
    hint: 'น้ำไหลลงสู่ที่ต่ำที่สุด ดูตัวเลขความสูงบนแผนที่',
    feedback: `ถูกต้อง! ${label[low.id]} ต่ำที่สุด (${low.meters[low.id]} ม.) น้ำจึงมารวมที่นั่น`,
    thanks: 'เราจะเตรียมระบายน้ำที่จุดต่ำนั้น',
    landmark: 'water-office',
    goal: 'ช่วยป้าจันทร์หาที่น้ำท่วมขัง',
  },
];

const known = { showLabel: true, knownWhen: {} } as const;

export const khlongNamLaiLevel: LevelDefinition = {
  id: 'level-2',
  contentVersion: 10,
  tambon: 'ตำบลคลองน้ำไหล',
  title: 'ช่วยชาวบ้านคลองน้ำไหล',
  map: khlongNamLaiMap,
  spawn: { x: 10, y: 13 },
  fog: { revealRadiusTiles: 5 },
  landmarks: [
    { id: 'school', name: 'โรงเรียนบ้านคลองน้ำไหล', at: { x: 13, y: 11 }, symbol: 'school', ...known },
    { id: 'village', name: 'หมู่บ้าน', at: { x: 45, y: 33 }, symbol: 'village', ...known },
    { id: 'water-office', name: 'ศาลาจัดการน้ำชุมชน', at: { x: 45, y: 37 }, symbol: 'office', mapLabelAt: 'below', ...known },
    { id: 'bridge', name: 'สะพานข้ามลำห้วย', at: { x: 31, y: 34 }, symbol: 'bridge', ...known },
    { id: 'site-a', name: 'จุด A (บนเนิน)', at: A.at, symbol: 'spring', mapLabelAt: 'left', ...known },
    { id: 'site-b', name: 'จุด B (ฝายกั้นลำห้วย)', at: B.at, symbol: 'weir', mapLabelAt: 'right', ...known },
    { id: 'site-c', name: 'จุด C (หนองน้ำ)', at: C.at, symbol: 'marsh', mapLabelAt: 'below', ...known },
  ],
  ...buildMissions('level-2', specs),
  waterways: [{ id: 'stream-main', name: 'ลำห้วยคลองน้ำไหล', points: STREAM_POINTS }],
  // ตัวเลขความสูงที่พิมพ์บนแผนที่ = จุดที่คำถามอ้างถึง (ผู้เล่นอ่านค่าได้เอง)
  spotHeights: [A.at, B.at, C.at],
  unlocks: 'level-3',
  skills: ['direction', 'elevation'],
};
