import { ElevationModel } from '../../../core/world/Elevation';
import { analyzeWaterway } from '../../../core/world/Waterway';
import type { LevelDefinition } from '../../types';
import { buildMissions, extremeOf, flowChoices, type MissionSpec } from '../simple';
import { khlongLanPattanaMap, STREAM_POINTS } from './map';

/**
 * ด่านที่ 4: ตำบลคลองลานพัฒนา — ช่วยชาวบ้าน 3 คน (เส้นทางขนผลผลิต · ทิศน้ำไหล · ที่หลบน้ำท่วม)
 */
const A = { id: 'site-a', at: { x: 24, y: 24 } };
const B = { id: 'site-b', at: { x: 64, y: 24 } };
const C = { id: 'site-c', at: { x: 60, y: 19 } };
const label: Record<string, string> = { 'site-a': 'จุด A', 'site-b': 'จุด B', 'site-c': 'จุด C' };
const high = extremeOf(khlongLanPattanaMap, [A, B, C], 'highest');
const flow = analyzeWaterway(STREAM_POINTS, new ElevationModel(khlongLanPattanaMap.elevation!)).flowDirection;

const specs: MissionSpec[] = [
  {
    id: 'route',
    npc: { id: 'surveyor-tonkla', name: 'พ่อค้าต้นกล้า', appearance: 'villager', at: { x: 46, y: 46 } },
    problem: 'ผมต้องขนผักจากพื้นที่เกษตรไปขายที่ชุมชน ขอให้เลือกเส้นทางที่ไปได้จริง',
    question: 'ควรไปทางใด?',
    correct: 'ถนนผ่านสี่แยก แล้วข้ามสะพานลำน้ำ',
    wrong: ['ขึ้นเนินทางเหนือแล้วอ้อมกลับ', 'ลุยข้ามลำน้ำตรง ๆ'],
    hint: 'ดูแผนที่ ถนนสายหลักข้ามลำน้ำที่สะพานแห่งเดียว',
    feedback: 'ถูกต้อง! ถนนผ่านสี่แยกและสะพานเป็นเส้นทางที่ไปถึงชุมชน',
    thanks: 'ผักถึงตลาดแล้ว ขอบคุณมาก',
    landmark: 'junction',
    goal: 'ช่วยพ่อค้าต้นกล้าเลือกเส้นทางขนผัก',
  },
  {
    id: 'flow',
    npc: { id: 'water-keeper', name: 'ป้าบัวลอย', appearance: 'headman', at: { x: 44, y: 40 } },
    problem: 'ป้าอยากรู้ว่าน้ำในลำน้ำคลองลานไหลไปทางไหน เพื่อเตือนหมู่บ้านปลายน้ำ',
    question: 'น้ำในลำน้ำไหลไปทางทิศใด?',
    ...flowChoices(flow),
    hint: 'ดูตัวเลขความสูงของป้ายวัดระดับ น้ำไหลจากสูงไปต่ำ',
    feedback: 'ถูกต้อง! น้ำไหลจากที่สูงไปที่ต่ำ',
    thanks: 'ป้าจะแจ้งหมู่บ้านปลายน้ำ ขอบใจจ้ะ',
    landmark: 'bridge',
    goal: 'ช่วยป้าบัวลอยหาทิศน้ำไหล',
  },
  {
    id: 'shelter',
    npc: { id: 'record-keeper', name: 'ลุงจำรัส', appearance: 'villager', at: { x: 25, y: 41 } },
    problem: 'ถ้าฝนตกหนักจนน้ำท่วมใหญ่ ชาวบ้านจะได้หนีไปหลบ',
    question: 'จุด A, B, C จุดใดสูงที่สุด เหมาะเป็นที่หลบน้ำท่วม?',
    correct: label[high.id],
    wrong: [label[high.others[0]], label[high.others[1]]],
    hint: 'เปิดแผนที่ ดูตัวเลขความสูงของแต่ละจุด',
    feedback: `ถูกต้อง! ${label[high.id]} สูงที่สุด (${high.meters[high.id]} ม.)`,
    thanks: 'เราจะซ้อมอพยพขึ้นที่สูงตามที่บอก',
    landmark: 'site-a',
    goal: 'ช่วยลุงจำรัสหาที่หลบน้ำท่วม',
  },
];

const known = { showLabel: true, knownWhen: {} } as const;

export const khlongLanPattanaLevel: LevelDefinition = {
  id: 'level-4',
  contentVersion: 10,
  tambon: 'ตำบลคลองลานพัฒนา',
  title: 'ช่วยชาวบ้านคลองลานพัฒนา',
  map: khlongLanPattanaMap,
  spawn: { x: 11, y: 51 },
  fog: { revealRadiusTiles: 5 },
  landmarks: [
    { id: 'center', name: 'จุดเริ่มต้น', at: { x: 14, y: 50 }, symbol: 'office', ...known },
    { id: 'village', name: 'ชุมชนคลองลานพัฒนา', at: { x: 28, y: 38 }, symbol: 'village', mapLabelAt: 'right', ...known },
    { id: 'bridge', name: 'สะพานข้ามลำน้ำ', at: { x: 40, y: 44 }, symbol: 'bridge', ...known },
    { id: 'junction', name: 'สี่แยกทางขึ้นเนิน', at: { x: 56, y: 44 }, ...known },
    { id: 'farm', name: 'พื้นที่เกษตร', at: { x: 62, y: 52 }, symbol: 'farm', ...known },
    { id: 'site-a', name: 'จุด A (เนินตะวันตก)', at: A.at, symbol: 'office', ...known },
    { id: 'site-b', name: 'จุด B (เนินตะวันออก)', at: B.at, symbol: 'office', ...known },
    { id: 'site-c', name: 'จุด C (วัดบนเนิน)', at: C.at, symbol: 'temple', mapLabelAt: 'left', ...known },
  ],
  ...buildMissions('level-4', specs),
  waterways: [{ id: 'stream-main', name: 'ลำน้ำคลองลาน', points: STREAM_POINTS }],
  spotHeights: [A.at, B.at, C.at, { x: 56, y: 12 }, { x: 40, y: 52 }],
  // จบด่านสุดท้าย → ร้านค้า (บทที่ 5) → พญาจระเข้ (บทที่ 6)
  unlocks: 'shop',
  skills: ['direction', 'elevation', 'landmark'],
};
