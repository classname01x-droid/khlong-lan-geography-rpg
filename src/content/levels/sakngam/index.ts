import type { LevelDefinition } from '../../types';
import { buildMissions, directionChoices, type MissionSpec } from '../simple';
import { sakNgamMap } from './map';

/**
 * ด่านที่ 1: ตำบลสักงาม — ช่วยชาวบ้าน 3 คน (ทิศ · เส้นทางข้ามห้วย · ที่ตั้งบ้าน)
 * โฟลเดอร์นี้มีแต่ข้อมูล: map.ts (ผังแผนที่) + ไฟล์นี้ (ภารกิจแบบ MissionSpec)
 */
const school = { x: 15, y: 40 };
const sala = { x: 46, y: 45 };
const dir = directionChoices(school, sala);

const specs: MissionSpec[] = [
  {
    id: 'direction',
    npc: { id: 'teacher-nem', name: 'ครูเนม', appearance: 'teacher', at: { x: 12, y: 40 } },
    problem: 'เด็ก ๆ อยากรู้ว่าศาลาชุมชนอยู่ทางไหนของโรงเรียน ช่วยดูแผนที่ให้หน่อยนะ',
    question: 'ศาลาชุมชนอยู่ทิศใดของโรงเรียน?',
    ...dir,
    hint: 'บนแผนที่ เหนืออยู่ด้านบน ดูว่าศาลาอยู่ซ้ายหรือขวาของโรงเรียน',
    feedback: 'ถูกต้อง! ศาลาชุมชนอยู่ทางตะวันออกของโรงเรียน',
    thanks: 'ขอบใจมาก เด็ก ๆ จะได้เดินไปถูกทาง',
    landmark: 'school',
    goal: 'ช่วยครูเนมบอกทิศไปศาลาชุมชน',
  },
  {
    id: 'route',
    npc: { id: 'fisher-kham', name: 'ลุงคำ (พ่อค้า)', appearance: 'villager', at: { x: 34, y: 46 } },
    problem: 'ฉันจะส่งผ้าไปแหล่งผ้าปักบ้านไหนเจียวทางเหนือ แต่มีห้วยสาขาขวางอยู่',
    question: 'ต้องข้ามห้วยสาขาตรงไหนจึงไปถึงบ้านไหนเจียว?',
    correct: 'สะพานไม้ข้ามห้วยสาขา',
    wrong: ['สะพานข้ามลำห้วยใหญ่ใกล้โรงเรียน', 'ข้ามตรงไหนก็ได้'],
    hint: 'ดูแผนที่ ห้วยสาขากั้นทางเหนือไว้ มีสะพานแห่งเดียวที่ข้ามได้',
    feedback: 'ถูกต้อง! สะพานไม้เป็นทางเดียวที่ข้ามห้วยสาขาไปทางเหนือ',
    thanks: 'ได้ส่งผ้าถึงมือแล้ว ขอบใจนะผู้นำ',
    landmark: 'wood-bridge',
    goal: 'ช่วยลุงคำเลือกทางส่งผ้าข้ามห้วย',
  },
  {
    id: 'site',
    npc: { id: 'headman', name: 'ผู้ใหญ่บ้าน', appearance: 'headman', at: { x: 48, y: 46 } },
    problem: 'ฝนหลากทุกปี ชาวบ้านอยากย้ายบ้านให้ปลอดภัย แต่ยังต้องใช้น้ำในห้วย',
    question: 'ควรเลือกที่ตั้งบ้านแบบใด?',
    correct: 'สูงกว่าลำห้วย และอยู่ไม่ไกลจากน้ำ',
    wrong: ['ติดริมตลิ่งลำห้วยพอดี', 'บนยอดเนินที่ไกลจากน้ำมาก'],
    hint: 'ต้องรอดจากน้ำหลาก แต่ก็ต้องเดินไปตักน้ำได้ไม่ลำบาก',
    feedback: 'ถูกต้อง! ที่สูงกว่าห้วยพ้นน้ำท่วม และอยู่ใกล้น้ำพอใช้',
    thanks: 'เราจะสร้างบ้านบนที่สูงตามคำแนะนำ',
    landmark: 'headman-house',
    goal: 'ช่วยผู้ใหญ่บ้านเลือกที่ตั้งบ้าน',
  },
];

const known = { showLabel: true, knownWhen: {} } as const;

export const sakNgamLevel: LevelDefinition = {
  id: 'sakngam',
  contentVersion: 10,
  tambon: 'ตำบลสักงาม',
  title: 'ช่วยชาวบ้านสักงาม',
  map: sakNgamMap,
  spawn: { x: 14, y: 43 },
  fog: { revealRadiusTiles: 5 },
  landmarks: [
    { id: 'school', name: 'โรงเรียนสักงาม (เสาธง)', at: school, ...known },
    { id: 'bridge', name: 'สะพานข้ามลำห้วยใหญ่', at: { x: 32, y: 48 }, ...known },
    { id: 'sala', name: 'ศาลาชุมชน', at: sala, ...known },
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 54, y: 43 }, ...known },
    { id: 'wood-bridge', name: 'สะพานไม้ข้ามห้วยสาขา', at: { x: 60, y: 17 }, ...known },
    { id: 'nai-chiao', name: 'แหล่งผ้าปักบ้านไหนเจียว', at: { x: 70, y: 13 }, ...known },
  ],
  ...buildMissions('sakngam', specs),
  // ศาลพญาจระเข้ผู้พิทักษ์ข้างโรงเรียน (ภาพ placeholder)
  decor: [{ id: 'guardian-shrine', kind: 'shrine', at: { x: 11, y: 40 } }],
  unlocks: 'level-2',
  skills: ['direction', 'landmark'],
};
