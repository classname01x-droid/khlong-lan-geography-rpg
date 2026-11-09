import { ElevationModel } from '../../../core/world/Elevation';
import { analyzeWaterway } from '../../../core/world/Waterway';
import type { LevelDefinition } from '../../types';
import { buildMissions, extremeOf, flowChoices, type MissionSpec } from '../simple';
import { pongNamRonMap, STREAM } from './map';

/**
 * ด่านที่ 3: ตำบลโป่งน้ำร้อน — ช่วยชาวบ้าน 3 คน (ที่ตั้งหมู่บ้าน · ทิศน้ำไหล · น้ำฝนจากเนินไปรวมที่ใด)
 */
const camp = { id: 'camp', at: { x: 57, y: 29 } };
const hall = { id: 'hall', at: { x: 30, y: 47 } };
const bridge = { id: 'bridge', at: { x: 49, y: 44 } };
const low = extremeOf(pongNamRonMap, [camp, hall, bridge], 'lowest');
const label: Record<string, string> = { camp: 'ค่ายสำรวจ', hall: 'ศาลาประชาคม', bridge: 'สะพานข้ามลำห้วย' };
const flow = analyzeWaterway(STREAM, new ElevationModel(pongNamRonMap.elevation!)).flowDirection;

const specs: MissionSpec[] = [
  {
    id: 'site',
    npc: { id: 'villager-son', name: 'ลุงสอน', appearance: 'villager', at: { x: 35, y: 43 } },
    problem: 'ชุมชนจะขยายบ้านเรือน เราควรเลือกที่ตั้งที่ปลอดภัยและใช้น้ำสะดวก',
    question: 'ควรสร้างบ้านที่ใด?',
    correct: 'สูงกว่าลำห้วยพอสมควร และอยู่ไม่ไกลจากน้ำ',
    wrong: ['ที่ลุ่มติดลำห้วย', 'บนเขาสูงที่ไกลจากน้ำมาก'],
    hint: 'ต้องพ้นน้ำท่วม แต่ก็ต้องใช้น้ำได้สะดวก',
    feedback: 'ถูกต้อง! ที่สูงกว่าลำห้วยแต่ไม่ไกลน้ำ ทั้งปลอดภัยและสะดวก',
    thanks: 'เราจะสร้างบ้านตามนี้ ขอบใจนะผู้นำ',
    landmark: 'village',
    goal: 'ช่วยลุงสอนเลือกที่ตั้งหมู่บ้าน',
  },
  {
    id: 'flow',
    npc: { id: 'water-keeper', name: 'ป้าจันทร์', appearance: 'headman', at: { x: 31, y: 47 } },
    problem: 'ลำห้วยโป่งน้ำร้อนไหลไปทางไหน ป้าจะได้รู้ว่าน้ำเสียจะไปถึงใคร',
    question: 'น้ำในลำห้วยไหลไปทางทิศใด?',
    ...flowChoices(flow),
    hint: 'ดูตัวเลขความสูงบนแผนที่ ทางเหนือสูง ทางใต้ต่ำ น้ำไหลจากสูงไปต่ำ',
    feedback: 'ถูกต้อง! น้ำไหลจากที่สูงไปที่ต่ำ',
    thanks: 'ป้าจะบอกคนปลายน้ำให้ระวัง',
    landmark: 'hall',
    goal: 'ช่วยป้าจันทร์หาทิศน้ำไหล',
  },
  {
    id: 'gather',
    npc: { id: 'explorer-khiao', name: 'พี่เขียว', appearance: 'villager', at: { x: 58, y: 31 } },
    problem: 'ฝนตกหนักบนเนิน น้ำจะไหลลงมาท่วมที่ไหนก่อน',
    question: 'น้ำฝนจะไปรวมที่จุดใดมากที่สุด?',
    correct: label[low.id],
    wrong: [label[low.others[0]], label[low.others[1]]],
    hint: 'น้ำไหลไปที่ต่ำที่สุด ดูตัวเลขความสูงบนแผนที่',
    feedback: `ถูกต้อง! ${label[low.id]} ต่ำที่สุด (${low.meters[low.id]} ม.)`,
    thanks: 'ไว้พี่จะเตือนคนแถบนั้นให้ระวังน้ำหลาก',
    landmark: 'camp',
    goal: 'ช่วยพี่เขียวหาจุดที่น้ำไปรวมกัน',
  },
];

const known = { showLabel: true, knownWhen: {} } as const;

export const pongNamRonLevel: LevelDefinition = {
  id: 'level-3',
  contentVersion: 10,
  tambon: 'ตำบลโป่งน้ำร้อน',
  title: 'ช่วยชาวบ้านโป่งน้ำร้อน',
  map: pongNamRonMap,
  spawn: { x: 11, y: 51 },
  fog: { revealRadiusTiles: 5 },
  contourIntervalMeters: 2,
  landmarks: [
    { id: 'school', name: 'โรงเรียนบ้านโป่งน้ำร้อน', at: { x: 14, y: 50 }, symbol: 'school', ...known },
    { id: 'hall', name: 'ศาลาประชาคม', at: hall.at, symbol: 'office', ...known },
    { id: 'village', name: 'ชุมชนโป่งน้ำร้อน', at: { x: 31, y: 42 }, symbol: 'village', ...known },
    { id: 'bridge', name: 'สะพานข้ามลำห้วย', at: bridge.at, symbol: 'bridge', ...known },
    { id: 'camp', name: 'ค่ายสำรวจ', at: camp.at, symbol: 'office', mapLabelAt: 'right', ...known },
  ],
  ...buildMissions('level-3', specs, { startFlag: 'got-topo-map' }),
  // แผนที่แสดงเส้นชั้นความสูงตั้งแต่เริ่มด่าน (ได้รับเมื่อคุยกับ NPC แรก)
  topoMapFlag: 'got-topo-map',
  spotHeights: [camp.at, hall.at, bridge.at, { x: 30, y: 6 }],
  unlocks: 'level-4',
  skills: ['direction', 'elevation', 'contour-reading'],
};
