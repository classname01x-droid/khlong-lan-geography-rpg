import { THAI_DIRECTION } from '../../../core/direction/Compass';
import { defaultScale } from '../../../core/scale/ScaleSystem';
import { GameSession } from '../../../core/session/GameSession';
import { INTEGRATED_CHECKS } from '../../../core/site/IntegratedSiteAnalysis';
import { ElevationModel } from '../../../core/world/Elevation';
import { buildWorld } from '../../../core/world/MapBuilder';
import type {
  ClueDefinition,
  EndingDefinition,
  EvidenceDefinition,
  InspectPoint,
  LevelDefinition,
  NpcDefinition,
  QuestDefinition,
  QuizDefinition,
  StoryStep,
} from '../../types';
import { answerQuiz, hearReport, talkTo } from '../../guide/steps';
import { khlongNamLaiLevel as L2 } from '../khlongnamlai';
import { khlongLanPattanaLevel as L4 } from '../khlonglanpattana';
import { pongNamRonLevel as L3 } from '../pongnamron';
import { sakNgamLevel as L1 } from '../sakngam';
import { BOARD_XS, finaleMap } from './map';

/**
 * บทที่ 5: ปริศนาสุดท้าย — แผนที่ภูมิปัญญาอำเภอคลองลานฉบับสมบูรณ์ (โรงเรียนบ้านสักงาม)
 *
 *   ฉาก 1  ครูเนมตรวจผลการเดินทาง 4 ตำบล และรหัส 4 ชิ้น
 *   ฉาก 2  ป้ายจัดแสดง 4 ตำบล: ตอบคำถามจาก "หลักฐานที่ผู้เล่นเก็บมา" (ตัวเลขคำนวณจากข้อมูลบทก่อนหน้า) → ติดรหัสลงแผนที่
 *   ฉาก 3  หีบไม้เก่า (ตู้แผนที่ภูมิปัญญาเดิม) ล็อกด้วยรหัส 4 ช่อง เรียงตาม "ทักษะ" (ไม่ใช่ลำดับที่เกมเรียงให้) — ผู้เล่นต้องจับคู่เอง
 *   ฉาก 4  คำถามสรุปความรู้กับครูเนม → ฉากจบเนื้อเรื่อง
 *
 * เข้าได้เฉพาะเมื่อจบบท 1–4 และมีรหัสครบ 4 ชิ้น (core/campaign/Campaign.ts) · สถานที่และเรื่องราวเป็นข้อมูลจำลอง
 */
const NEM = 'ครูเนม';
const BOARD = 'ป้ายจัดแสดง';

/* ---------------- หลักฐานจากบทก่อนหน้า (คำนวณจากข้อมูลด่าน ไม่เขียนตัวเลขเอง) ---------------- */

const at = (level: LevelDefinition, id: string) => level.landmarks.find((l) => l.id === id)!.at;
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US');
const m10 = (m: number) => Math.round(m / 10) * 10;

// บท 1: ระยะเส้นตรงจากเสาธงถึงแหล่งผ้าปักที่ปักหมุด → แปลงเป็น ซม. บนแผนที่ 1:10,000
const l1Target = L1.pinTask!.targetId;
const l1Meters = m10(defaultScale.tilesToMeters(Math.hypot(at(L1, 'school').x - at(L1, l1Target).x, at(L1, 'school').y - at(L1, l1Target).y)));
const l1TargetName = L1.landmarks.find((l) => l.id === l1Target)!.name;

// บท 2: ความสูงของจุด A/B/C ตามแบบจำลองความสูง — จุดที่สูงที่สุด = ต้นน้ำ · จุดที่อยู่บนสุดของจอ = ตัวลวง
const l2Elev = new ElevationModel(L2.map.elevation!);
const l2Sites = (['site-a', 'site-b', 'site-c'] as const).map((id) => ({
  id,
  label: `จุด ${id.slice(-1).toUpperCase()}`,
  meters: l2Elev.meters(at(L2, id)),
  y: at(L2, id).y,
}));
const l2Highest = [...l2Sites].sort((a, b) => b.meters - a.meters)[0];
const l2Topmost = [...l2Sites].sort((a, b) => a.y - b.y)[0];

// บท 3: น้ำหนักเกณฑ์วิเคราะห์ที่ตั้งชุมชน (อ่านจากข้อมูลด่านจริง ไม่เขียนตัวเลขซ้ำ)
const l3A = L3.settlementAnalysis!;
const l3Elev = l3A.height.max;
const l3Water = l3A.water.max;

// บท 4: หลักฐานแต่ละชนิดชี้ได้กี่จุด (ใช้ตรรกะเดียวกับในเกม)
const l4Rows = new GameSession(L4, buildWorld(L4.map), defaultScale).evaluateIntegratedSites();
const l4Count = Object.fromEntries(INTEGRATED_CHECKS.map((c) => [c, l4Rows.filter((r) => !r.failed.includes(c)).length]));
const l4Dist = L4.integratedSiteAnalysis!.distance;

/* ---------------- คำถามป้ายจัดแสดง (ฉาก 2) ---------------- */

const quizzes: QuizDefinition[] = [
  {
    id: 'board-1',
    speaker: `${BOARD}: ตำบลสักงาม`,
    question: `หลักฐานบท 1: ${l1TargetName} ห่างจากเสาธงโรงเรียนเป็นเส้นตรง ${l1Meters.toLocaleString('en-US')} ม. บนแผนที่ 1:10,000 จะวัดได้ยาวเท่าไร?`,
    choices: [
      { id: 'x10', label: `${fmt1(l1Meters / 10)} ซม.`, hint: '1 ซม. บนแผนที่ 1:10,000 = 100 ม. (ไม่ใช่ 10 ม.)' },
      { id: 'ok', label: `${fmt1(defaultScale.metersToMapCm(l1Meters))} ซม.` },
      { id: 'x1000', label: `${fmt1(l1Meters / 1000)} ซม.`, hint: '1,000 ม. = 1 กม. — แต่บนแผนที่ 1:10,000 ต้องหารด้วย 100 เพราะ 1 ซม. = 100 ม.' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: 'ระยะจริง (ม.) ÷ 100 = ระยะบนแผนที่ (ซม.)',
    correctFeedback: 'ถูกต้อง! ติดรหัส "{{code:sakngam}}" ลงช่องตำบลสักงามบนแผนที่ภูมิปัญญาแล้ว',
    effects: [{ type: 'flag', flag: 'board-1' }],
  },
  {
    id: 'board-2',
    speaker: `${BOARD}: ตำบลคลองน้ำไหล`,
    question: `หลักฐานบท 2: ${l2Sites.map((s) => `${s.label} สูง ${s.meters} ม.`).join(' · ')} (บนลำห้วยเดียวกัน) ตาน้ำต้นลำห้วยคือจุดใด?`,
    choices: l2Sites.map((s) => ({
      id: s.id,
      label: s.label,
      hint:
        s.id === l2Highest.id
          ? undefined
          : s.id === l2Topmost.id
            ? 'จุดนี้อยู่ด้านบนของแผนที่ แต่ตำแหน่งบนจอไม่ได้บอกความสูง — น้ำไหลจากที่สูงไปที่ต่ำ'
            : 'จุดนี้ไม่ใช่จุดที่สูงที่สุด ต้นน้ำต้องอยู่สูงกว่าจุดอื่นบนลำน้ำเดียวกัน',
    })),
    correctChoiceId: l2Highest.id,
    fallbackHint: 'ต้นน้ำคือปลายที่สูงที่สุด',
    correctFeedback: `ถูกต้อง! ${l2Highest.label} สูงที่สุด น้ำจึงไหลออกจากจุดนี้ — ติดรหัส "{{code:level-2}}" ลงช่องตำบลคลองน้ำไหล`,
    effects: [{ type: 'flag', flag: 'board-2' }],
  },
  {
    id: 'board-3',
    speaker: `${BOARD}: ตำบลโป่งน้ำร้อน`,
    question: `หลักฐานบท 3: เกณฑ์เลือกพื้นที่ (เต็ม 100) = ระดับความสูง ${l3Elev} + ระยะจากแหล่งน้ำ ${l3Water} ผ่านเมื่อมากกว่า ${l3A.passPercent} ถ้าพื้นที่หนึ่งได้คะแนนผ่าน สรุปได้อย่างไร?`,
    choices: [
      { id: 'real', label: 'มีเมืองโบราณอยู่ที่นั่นจริงแน่นอน', hint: 'คะแนนคือความเหมาะสมตามเงื่อนไขจำลอง ไม่ใช่ความน่าจะเป็นที่จะพบเมืองจริง — ต้องมีหลักฐานภาคสนาม' },
      { id: 'one', label: `ดูแค่ระดับความสูง (${l3Elev} คะแนน) ก็พอ`, hint: `ต้องดูทั้งระดับความสูงและระยะจากแหล่งน้ำ (${l3Water} คะแนน) ร่วมกัน` },
      { id: 'ok', label: 'เป็นพื้นที่ที่เหมาะสมตามเกณฑ์จำลอง ต้องออกสำรวจหาหลักฐานก่อนสรุป' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: 'คะแนนความเหมาะสม ≠ หลักฐานว่ามีเมืองโบราณจริง',
    correctFeedback: 'ถูกต้อง! ติดรหัส "{{code:level-3}}" ลงช่องตำบลโป่งน้ำร้อน',
    effects: [{ type: 'flag', flag: 'board-3' }],
  },
  {
    id: 'board-4',
    speaker: `${BOARD}: ตำบลคลองลานพัฒนา`,
    question: `หลักฐานบท 4: ระยะทางชี้ได้ ${l4Count.distance} จุด · ภูมิประเทศชี้ได้ ${l4Count.terrain} จุด · พิกัดชี้ได้ ${l4Count.grid} จุด แล้วระบุแหล่งเรียนรู้ได้อย่างไร?`,
    choices: [
      { id: 'grid', label: 'ใช้พิกัดอย่างเดียวก็พอ', hint: `พิกัดที่เสียหายบางส่วนชี้ได้ถึง ${l4Count.grid} จุด จึงยังแยกไม่ออก` },
      {
        id: 'nearest',
        label: `เลือกจุดที่ใกล้สะพานที่สุดเป็นเส้นตรง`,
        hint: `บันทึกบอกทาง${THAI_DIRECTION[l4Dist.direction]} และระยะเส้นตรงกับตามถนนคู่กัน — จุดที่ใกล้ที่สุดไม่ใช่หลักฐาน`,
      },
      { id: 'all', label: 'ใช้หลักฐานทั้ง 3 ชนิดร่วมกัน จุดที่ตรงครบมีเพียงจุดเดียว' },
    ],
    correctChoiceId: 'all',
    fallbackHint: 'หลักฐานแต่ละชนิดชี้ได้หลายจุด',
    correctFeedback: 'ถูกต้อง! ติดรหัส "{{code:level-4}}" ลงช่องตำบลคลองลานพัฒนา',
    effects: [{ type: 'flag', flag: 'board-4' }],
  },
];

/* ---------------- ตู้แผนที่: ล็อกรหัส 4 ช่อง เรียงตามทักษะ (ฉาก 3) ---------------- */

/** ตัวเลือกของทุกช่อง = รหัสที่ผู้เล่นเก็บได้จริงทั้ง 4 ชิ้น (ลำดับคงที่ ไม่บอกใบ้) */
const CODE_CHOICES = [
  { id: 'level-3', label: '"{{code:level-3}}"' },
  { id: 'sakngam', label: '"{{code:sakngam}}"' },
  { id: 'level-4', label: '"{{code:level-4}}"' },
  { id: 'level-2', label: '"{{code:level-2}}"' },
];
/** ช่องของตู้ (ลำดับไม่ตรงกับลำดับการเดินทาง) : ทักษะ → บทที่ใช้ทักษะนั้น */
const LOCK_SLOTS = [
  { skill: 'ความสูงและทิศทางน้ำไหล', levelId: 'level-2', where: 'หาตาน้ำต้นลำห้วยที่ตำบลคลองน้ำไหล (บทที่ 2)' },
  { skill: 'บูรณาการหลักฐาน ระยะทาง–ภูมิประเทศ–พิกัด', levelId: 'level-4', where: 'หาแหล่งเรียนรู้ที่ตำบลคลองลานพัฒนา (บทที่ 4)' },
  { skill: 'มาตราส่วน ทิศ และระยะทาง', levelId: 'sakngam', where: 'วิเคราะห์เส้นทางไปแหล่งผ้าปักที่ตำบลสักงาม (บทที่ 1)' },
  { skill: 'ระดับความสูงจากเส้นชั้นความสูง และระยะจากแหล่งน้ำ', levelId: 'level-3', where: 'เลือกพื้นที่ชุมชนโบราณจำลองที่ตำบลโป่งน้ำร้อน (บทที่ 3)' },
];
LOCK_SLOTS.forEach((slot, i) =>
  quizzes.push({
    id: `lock-${i + 1}`,
    speaker: 'หีบไม้เก่า',
    question: `ช่องที่ ${i + 1} — ทักษะ "${slot.skill}" ใส่รหัสชิ้นใด?`,
    choices: CODE_CHOICES.map((c) => ({
      ...c,
      hint: c.id === slot.levelId ? undefined : `ทักษะนี้ใช้ตอน${slot.where} — ดูป้ายจัดแสดงว่ารหัสชิ้นใดติดอยู่ที่ตำบลนั้น`,
    })),
    correctChoiceId: slot.levelId,
    fallbackHint: 'จับคู่ทักษะกับตำบลที่ใช้ทักษะนั้น',
    correctFeedback: `ช่องที่ ${i + 1} ไขแล้ว`,
    effects: i === LOCK_SLOTS.length - 1 ? [{ type: 'flag', flag: 'cabinet-open' }] : [],
  }),
);

/* ---------------- คำถามสรุปความรู้ (ฉาก 4) ---------------- */

quizzes.push({
  id: 'final-synthesis',
  speaker: NEM,
  question: 'ถ้าจะบอกตำแหน่งแหล่งเรียนรู้ในแผนที่ภูมิปัญญาให้คนอื่นหาเจอได้แน่นอน ควรระบุอย่างไร?',
  choices: [
    { id: 'name', label: 'บอกชื่อสถานที่อย่างเดียว', hint: 'ชื่อซ้ำหรือคลาดเคลื่อนได้ (เหมือนบ่อน้ำร้อนหลายแห่งในบท 3) ต้องมีตำแหน่งที่ตรวจสอบได้' },
    { id: 'screen', label: 'บอกว่าอยู่ด้านบน/ล่าง/ซ้าย/ขวาของจอ', hint: 'ตำแหน่งบนจอไม่ใช่ทิศจริง และแกน Y ของจอตรงข้ามกับค่า N' },
    { id: 'all', label: 'พิกัด E/N + ทิศและระยะจากจุดอ้างอิง + สัญลักษณ์/ภูมิประเทศ บนแผนที่ที่มีมาตราส่วน' },
  ],
  correctChoiceId: 'all',
  fallbackHint: 'ใช้ทุกทักษะร่วมกัน',
  correctFeedback: 'ถูกต้อง! นี่คือสิ่งที่ทำให้แผนที่ภูมิปัญญาเชื่อถือได้',
  effects: [{ type: 'flag', flag: 'map-complete' }],
});

/* ---------------- NPC / หลักฐาน / จุดตรวจ ---------------- */

const npcs: NpcDefinition[] = [
  {
    id: 'teacher-nem',
    name: 'ครูเนม',
    appearance: 'teacher',
    at: { x: 21, y: 9 },
    dialogue: [
      {
        when: { notFlags: ['finale-started'] },
        nodes: [
          { speaker: NEM, text: 'กลับมาถึงโรงเรียนบ้านสักงามแล้ว! หีบไม้เก่ารอเราอยู่ที่ลานนี้' },
          {
            speaker: NEM,
            text: 'ครูตรวจสมุดภาคสนามแล้ว: สำรวจครบ 4 ตำบล และมีรหัสครบ 4 ชิ้น — "{{code:sakngam}}" "{{code:level-2}}" "{{code:level-3}}" "{{code:level-4}}"',
            effects: [
              { type: 'evidence', evidenceId: 'journey-record' },
              { type: 'clue', clueId: 'clue-finale' },
            ],
          },
          {
            speaker: NEM,
            text: 'ก่อนเปิดหีบ ไปที่ป้ายจัดแสดงทั้ง 4 ป้าย ตอบคำถามจากหลักฐานที่เธอเก็บมา แล้วติดรหัสลงช่องของแต่ละตำบล',
            effects: [{ type: 'flag', flag: 'finale-started' }],
          },
        ],
      },
      {
        when: { minStep: 4, notFlags: ['map-complete'] },
        nodes: [
          { speaker: NEM, text: 'เปิดหีบได้แล้ว! ข้างในคือแผนที่ภูมิปัญญาฉบับเก่า เราเติมข้อมูลจาก 4 ตำบลได้ครบพอดี เหลือคำถามสุดท้ายข้อเดียว' },
          { quiz: 'final-synthesis' },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: NEM, text: 'ป้ายจัดแสดงเรียงตามลำดับการเดินทาง ส่วนหีบไม้เก่าล็อกด้วยรหัส 4 ช่องเรียงตามทักษะ ต้องจับคู่เองนะ' }],
      },
    ],
  },
];

const evidence: EvidenceDefinition[] = [
  { id: 'journey-record', name: 'สมุดภาคสนาม 4 ตำบล', description: 'ผลการสำรวจ หลักฐาน และรหัสลับจากบท 1–4' },
  { id: 'wisdom-map', name: 'แผนที่ภูมิปัญญาอำเภอคลองลานฉบับสมบูรณ์', description: 'แผนที่รวม 4 ตำบล (ข้อมูลจำลองเพื่อการเรียนรู้)' },
];

const clues: ClueDefinition[] = [
  { id: 'clue-finale', type: 'landmark', source: 'ครูเนม', text: 'ป้ายจัดแสดง 4 ป้าย → ติดรหัสลงช่องตำบล · หีบไม้เก่าล็อกรหัส 4 ช่องเรียงตามทักษะ' },
];

const TAMBON_NAMES = ['ตำบลสักงาม', 'ตำบลคลองน้ำไหล', 'ตำบลโป่งน้ำร้อน', 'ตำบลคลองลานพัฒนา'];
const BOARD_NOTES = [
  'ทักษะ: มาตราส่วน ทิศ ระยะเส้นตรง/ตามเส้นทาง · สถานที่: แหล่งผ้าปัก (ข้อมูลจำลอง)',
  'ทักษะ: สัญลักษณ์แผนที่ ความสูง ทิศทางน้ำไหล · สถานที่: ตาน้ำต้นลำห้วย (ข้อมูลจำลอง)',
  'ทักษะ: อ่านระดับความสูงจากเส้นชั้นความสูง · ระยะจากแหล่งน้ำ · สถานที่: ชุมชนโบราณใต้ผืนดิน (สถานการณ์จำลอง)',
  'ทักษะ: บูรณาการหลักฐาน ระยะทาง–ภูมิประเทศ–พิกัด · สถานที่: ศูนย์เรียนรู้ชุมชน (ข้อมูลจำลอง)',
];

const inspectPoints: InspectPoint[] = [
  ...BOARD_XS.map(
    (x, i): InspectPoint => ({
      id: `board-${i + 1}-read`,
      at: { x: x + 1, y: 15 },
      radiusTiles: 1.6,
      when: { flags: ['finale-started'], notFlags: [`board-${i + 1}`] },
      nodes: [
        { speaker: `${BOARD}: ${TAMBON_NAMES[i]}`, text: BOARD_NOTES[i] },
        { quiz: `board-${i + 1}` },
      ],
    }),
  ),
  {
    id: 'cabinet',
    at: { x: 20, y: 20 },
    radiusTiles: 1.6,
    when: { minStep: 3, notFlags: ['cabinet-open'] },
    nodes: [
      { speaker: 'หีบไม้เก่า', text: 'หีบที่ครูเนมพบในบทที่ 1 มีช่องรหัส 4 ช่อง แต่ละช่องเขียนชื่อทักษะภูมิศาสตร์ไว้ (ไม่ได้เรียงตามลำดับการเดินทาง)' },
      ...LOCK_SLOTS.map((_s, i) => ({ quiz: `lock-${i + 1}` })),
      {
        speaker: 'หีบไม้เก่า',
        text: 'กริ๊ก! หีบไม้เก่าเปิดออก ข้างในคือแผนที่ภูมิปัญญาอำเภอคลองลานฉบับเก่าที่ยังเว้นช่องว่างไว้ — นำไปให้ครูเนมดู',
        effects: [{ type: 'evidence', evidenceId: 'wisdom-map' }],
      },
    ],
  },
];

const story: StoryStep[] = [
  {
    order: 1,
    title: 'ครูเนมตรวจผลการเดินทาง',
    objective: 'คุยกับครูเนมหน้าห้องจัดแสดงแผนที่',
    landmarkId: 'hall',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'finale-started' },
  },
  {
    order: 2,
    title: 'ทบทวนหลักฐาน 4 ตำบล',
    objective: 'ไปที่ป้ายจัดแสดงทั้ง 4 ป้าย (กด E) ตอบคำถามจากหลักฐานของแต่ละตำบล แล้วติดรหัสลงแผนที่',
    landmarkId: 'board-1',
    status: 'playable',
    completeWhen: {
      type: 'all',
      of: [1, 2, 3, 4].map((i) => ({ type: 'flag' as const, flag: `board-${i}` })),
    },
  },
  {
    order: 3,
    title: 'ไขรหัสเปิดหีบไม้เก่า',
    objective: 'ไปที่หีบไม้เก่า (กด E) ใส่รหัสให้ตรงกับทักษะของแต่ละช่อง',
    landmarkId: 'cabinet',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'cabinet-open' },
  },
  {
    order: 4,
    title: 'แผนที่ภูมิปัญญาฉบับสมบูรณ์',
    objective: 'นำแผนที่ไปให้ครูเนม แล้วตอบคำถามสรุปความรู้',
    landmarkId: 'hall',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'map-complete' },
  },
  {
    order: 5,
    title: 'จบการเดินทาง',
    objective: 'ครูเนมสรุปการเดินทางทั้งหมด',
    landmarkId: 'hall',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];

/* ---------------- ขั้นย่อย (v0.19: นำทางด้วย "การกระทำ") ---------------- */
const boardStep = (i: number): NonNullable<StoryStep['micro']>[number] => ({
  id: `board-${i}`,
  goal: `ตอบคำถามที่ป้าย${TAMBON_NAMES[i - 1]}`,
  tools: ['ลูกศรนำทาง', 'ปุ่มสำรวจ', 'กล่องคำถาม'],
  steps: [`ป้าย${TAMBON_NAMES[i - 1]}อยู่ในห้องจัดแสดง — ดูลูกศรสีเหลือง`, '{walk} ไปหน้าป้าย แล้ว{tap:inspect}', 'อ่านหลักฐาน แล้ว{choose}คำตอบ'],
  result: `ติดรหัสของ${TAMBON_NAMES[i - 1]}ลงแผนที่ภูมิปัญญา`,
  tool: '{tap:notebook} ทบทวนข้อความจากครูเนมในหน้า "หลักฐาน/ข้อความ"',
  think: 'ตอนอยู่ตำบลนั้น เราใช้ทักษะภูมิศาสตร์อะไร?',
  doneText: `✓ ติดรหัส${TAMBON_NAMES[i - 1]}แล้ว!`,
  target: { landmarkId: `board-${i}` },
  done: { type: 'flag', flag: `board-${i}` },
});
const FINALE_MICRO: Record<number, NonNullable<StoryStep['micro']>> = {
  1: [
    talkTo({
      id: 'talk-nem',
      npcId: 'teacher-nem',
      name: 'ครูเนม',
      where: 'หน้าห้องจัดแสดงแผนที่',
      result: 'ครูเนมตรวจสมุดภาคสนาม แล้วให้ไปตอบคำถามที่ป้ายจัดแสดง 4 ป้าย',
      think: 'รหัสทั้ง 4 ชิ้นได้มาจากตำบลใดบ้าง?',
      done: { type: 'flag', flag: 'finale-started' },
    }),
  ],
  2: [boardStep(1), boardStep(2), boardStep(3), boardStep(4)],
  3: [
    {
      id: 'open-chest',
      goal: 'ใส่รหัสเปิดหีบไม้เก่า',
      tools: ['ปุ่มสำรวจ', 'กล่องคำถาม'],
      steps: ['หีบไม้เก่าอยู่กลางห้อง — ดูลูกศรสีเหลือง', '{walk} ไปที่หีบ แล้ว{tap:inspect}', 'แต่ละช่องบอกทักษะ — {choose}รหัสของตำบลที่ใช้ทักษะนั้น'],
      result: 'หีบเปิดออก ได้แผนที่ภูมิปัญญาฉบับสมบูรณ์',
      tool: 'ป้ายจัดแสดงแต่ละป้ายบอกว่าตำบลนั้นใช้ทักษะอะไร — เดินกลับไปอ่านได้',
      think: 'ทักษะในช่องนี้ เราใช้ตอนอยู่ตำบลไหน?',
      doneText: '✓ หีบเปิดแล้ว!',
      target: { landmarkId: 'cabinet' },
      done: { type: 'flag', flag: 'cabinet-open' },
    },
  ],
  4: [
    answerQuiz({
      id: 'final-quiz',
      npcId: 'teacher-nem',
      name: 'ครูเนม',
      goal: 'นำแผนที่ไปให้ครูเนม แล้วตอบคำถามสรุป',
      result: 'แผนที่ภูมิปัญญาสมบูรณ์ — ครูเนมสรุปการเดินทาง',
      tool: 'ครูเนมอยู่หน้าห้องจัดแสดง — ดูลูกศรสีเหลืองที่ขอบจอ',
      think: 'ถ้าจะบอกตำแหน่งสถานที่ให้คนอื่นหาเจอแน่นอน ต้องบอกข้อมูลอะไรบ้าง?',
      done: { type: 'flag', flag: 'map-complete' },
    }),
  ],
  5: [
    hearReport({
      id: 'report',
      code: 'คำชมจากครูเนม',
      goal: 'ฟังครูเนมสรุปการเดินทางทั้งหมด',
      result: 'จบการเดินทาง — ดูสรุปผลทั้ง 4 ตำบล',
      done: { type: 'flag', flag: 'mission-complete' },
    }),
  ],
};
for (const st of story) if (FINALE_MICRO[st.order]) st.micro = FINALE_MICRO[st.order];

const quests: QuestDefinition[] = [
  {
    id: 'main-finale',
    kind: 'main',
    title: 'ปริศนาสุดท้าย: แผนที่ภูมิปัญญาฉบับสมบูรณ์',
    description: 'ประกอบแผนที่ภูมิปัญญาอำเภอคลองลานจากหลักฐานและรหัสของทั้ง 4 ตำบล',
    lockedHint: '',
    objectives: story.map((st) => ({ text: st.title, done: { type: 'step' as const, order: st.order } })),
  },
];

const ending: EndingDefinition = {
  messages: [
    { speaker: NEM, text: 'หีบไม้เก่าเปิดแล้ว และแผนที่ภูมิปัญญาอำเภอคลองลานก็สมบูรณ์! รหัสทั้ง 4 ชิ้นอยู่ในช่องที่ถูกต้องทั้งหมด' },
    { speaker: NEM, text: 'ตลอดการเดินทาง เธอใช้มาตราส่วนและระยะทาง สัญลักษณ์และความสูง พิกัด E/N และสุดท้ายนำทุกหลักฐานมารวมกัน' },
    { speaker: NEM, text: 'สิ่งสำคัญที่สุดคือ ตัวเลขบนแผนที่ต้องตรวจกับสิ่งที่เห็นจริงเสมอ — นั่นคือหัวใจของนักสำรวจ' },
    { speaker: NEM, text: 'ขอบคุณนักสำรวจของครู การเดินทางครั้งนี้สำเร็จแล้ว! (สถานที่และภูมิปัญญาในเกมเป็นข้อมูลจำลองเพื่อการเรียนรู้ เรื่องหีบสมบัติเป็นเรื่องแต่ง)' },
  ],
  rewardItem: 'แผนที่ภูมิปัญญาอำเภอคลองลานฉบับสมบูรณ์ (จากหีบไม้เก่า)',
  completeFlag: 'mission-complete',
  // จบด้วยบทสนทนา: เริ่มตอนจบเมื่อตอบคำถามสรุปความรู้ถูกเท่านั้น
  startWhen: { flags: ['map-complete'] },
};

export const finaleLevel: LevelDefinition = {
  id: 'finale',
  contentVersion: 1,
  tambon: 'โรงเรียนบ้านสักงาม',
  title: 'ปริศนาสุดท้าย: แผนที่ภูมิปัญญาฉบับสมบูรณ์',
  map: finaleMap,
  spawn: { x: 20, y: 23 },
  fog: { revealRadiusTiles: 8 },
  landmarks: [
    { id: 'hall', name: 'ห้องจัดแสดงแผนที่ของครูเนม', at: { x: 20, y: 8 }, showLabel: true },
    ...BOARD_XS.map((x, i) => ({ id: `board-${i + 1}`, name: `ป้าย: ${TAMBON_NAMES[i]}`, at: { x: x + 1, y: 14 }, showLabel: true })),
    { id: 'cabinet', name: 'หีบไม้เก่า', at: { x: 20, y: 19 }, showLabel: true },
  ],
  npcs,
  story,
  quizzes,
  clues,
  evidence,
  inspectPoints,
  quests,
  ending,
  // หีบไม้เก่าใบเดียวกับที่ครูเนมพบในบทที่ 1 (ภาพ placeholder)
  decor: [{ id: 'old-chest', kind: 'chest', at: { x: 20, y: 19 } }],
  skills: ['scale', 'straight-vs-route', 'direction', 'elevation', 'map-symbols', 'grid-reference', 'relative-position', 'evidence-synthesis'],
};
