import type {
  ClueDefinition,
  EndingDefinition,
  EvidenceDefinition,
  GridSiteAnalysisDefinition,
  InspectPoint,
  PinTaskDefinition,
  QuestDefinition,
  QuizDefinition,
  StoryStep,
} from '../../types';
import { answerQuiz, hearReport, inspectAt, openTool, pinOnMap, talkTo } from '../../guide/steps';

/**
 * ภารกิจด่านโป่งน้ำร้อน — ทักษะ: พิกัดกริด (E/N) · ทิศทางของแกน · ตำแหน่งสัมพัทธ์ · ตรวจหลักฐานภาคสนาม
 * เล่นได้ครบ 6 ฉาก: รับแผนที่กริด → หมุดอ้างอิง → ผู้เก็บบันทึก → กระดานวิเคราะห์พิกัด (C) → ยืนยันภาคสนาม + ปักหมุด → รายงานครู
 */

export const pongQuizzes: QuizDefinition[] = [
  {
    // ตัวเลือกคำนวณจากตำแหน่งเสาธงจริง: ถูก / นับ N จากขอบบน / สลับ E กับ N
    id: 'grid-axes',
    speaker: 'ครูเนม',
    question: 'ลองอ่านแผนที่กริด: เสาธงโรงเรียนอยู่ที่พิกัดใด?',
    choices: [
      {
        id: 'top',
        label: '{{gridtop:school}}',
        hint: 'ค่า N ต้องนับจากขอบล่าง (ใต้) ขึ้นไปทางเหนือ ไม่ใช่นับจากขอบบนลงมาแบบแกน y ของจอ',
      },
      {
        id: 'swap',
        label: '{{gridswap:school}}',
        hint: 'อ่าน E (ตะวันออก) ก่อน แล้วจึงอ่าน N (เหนือ) — ตัวเลือกนี้สลับกัน',
      },
      { id: 'correct', label: '{{grid:school}}' },
    ],
    correctChoiceId: 'correct',
    fallbackHint: 'E เพิ่มไปทางตะวันออก N เพิ่มไปทางเหนือ',
    correctFeedback: 'ถูกต้อง! เสาธงอยู่ที่ {{grid:school}} — โรงเรียนอยู่ใกล้มุมตะวันตกเฉียงใต้ ค่า E และ N จึงน้อย',
    effects: [{ type: 'flag', flag: 'axes-ok' }],
  },
  {
    id: 'north-100',
    speaker: 'ป้าเรือน (ผู้เก็บบันทึกสำรวจ)',
    question: 'ถ้าเดินจากจุดหนึ่งไปทางทิศเหนือ 100 เมตร พิกัดจะเปลี่ยนอย่างไร?',
    choices: [
      { id: 'n-down', label: 'ค่า N ลดลง 100', hint: 'เดินไปทางเหนือ (ขึ้นด้านบนจอ) ค่า N ต้องเพิ่มขึ้น แม้แกน y ของจอจะลดลง' },
      { id: 'n-up', label: 'ค่า N เพิ่มขึ้น 100' },
      { id: 'e-up', label: 'ค่า E เพิ่มขึ้น 100', hint: 'ค่า E เปลี่ยนเมื่อเดินไปทางตะวันออกหรือตะวันตกเท่านั้น' },
    ],
    correctChoiceId: 'n-up',
    fallbackHint: 'N เพิ่มไปทางเหนือ',
    correctFeedback: 'ถูกต้อง! ทางเหนือ N เพิ่ม · ทางตะวันออก E เพิ่ม — ใช้ข้อนี้ตรวจว่าบันทึกเก่านับ N ถูกหรือไม่',
    effects: [{ type: 'flag', flag: 'record-checked' }],
  },
];

/** ภารกิจปริศนา: แปลงตำแหน่งสัมพัทธ์ (ทิศ + ระยะจาก RP-1) เป็นพิกัดกริด */
pongQuizzes.push({
  id: 'old-mark-coord',
  speaker: 'หมุดสำรวจเก่า',
  question: 'หมุดนี้อยู่จาก RP-1 ({{grid:rp-1}}) ไปทาง{{dir:rp-1>old-mark}} {{dist:rp-1>old-mark}} เมตร — พิกัดของหมุดนี้คือข้อใด?',
  choices: [
    { id: 'minus', label: '{{gridtop:old-mark}}', hint: 'เดินไปทางเหนือ ค่า N ต้องเพิ่มขึ้น ไม่ใช่ลดลง' },
    { id: 'east', label: 'E 4,350 · N 1,200', hint: 'ไปทางเหนือ ค่า E ไม่เปลี่ยน — ค่าที่เปลี่ยนคือ N' },
    { id: 'correct', label: '{{grid:old-mark}}' },
  ],
  correctChoiceId: 'correct',
  fallbackHint: 'ทางเหนือ N เพิ่ม · ค่า E คงเดิม',
  correctFeedback: 'ถูกต้อง! N ของ RP-1 + {{dist:rp-1>old-mark}} = {{grid:old-mark}} — ตรงกับตัวเลขที่ตอกบนหมุดเก่า',
  effects: [
    { type: 'flag', flag: 'found-old-mark' },
    { type: 'evidence', evidenceId: 'old-mark-plate' },
  ],
});

export const pongClues: ClueDefinition[] = [
  {
    id: 'clue-grid-rule',
    type: 'coordinate',
    source: 'ครูเนม',
    text: 'พิกัดกริดจำลอง: E (เมตร) เพิ่มไปทางตะวันออก · N (เมตร) เพิ่มไปทางเหนือ · จุดกำเนิดอยู่มุมตะวันตกเฉียงใต้ของแผนที่ · 1 ช่อง = 10 ม.',
  },
  {
    id: 'clue-record',
    type: 'coordinate',
    source: 'บันทึกสำรวจเก่า',
    text: 'บ่อน้ำร้อนธรรมชาติอยู่ที่ {{gridrecord}} (ตามที่เขียนไว้ในบันทึก)',
  },
  {
    id: 'clue-rps',
    type: 'landmark',
    source: 'ครูเนม',
    text: 'หมุดอ้างอิง (RP) 3 หมุดในชุมชน มีพิกัดตอกไว้บนหมุด ใช้เทียบกับพิกัดของตัวเองได้',
  },
  { id: 'clue-rp-1', type: 'coordinate', source: 'หมุด RP-1', text: 'พิกัดบนหมุด: {{grid:rp-1}}' },
  { id: 'clue-rp-2', type: 'coordinate', source: 'หมุด RP-2', text: 'พิกัดบนหมุด: {{grid:rp-2}}' },
  { id: 'clue-rp-3', type: 'coordinate', source: 'หมุด RP-3', text: 'พิกัดบนหมุด: {{grid:rp-3}}' },
  {
    id: 'clue-footbath',
    type: 'landmark',
    source: 'ลุงสอน',
    text: 'มีหลายที่ที่คนเรียกว่า "บ่อน้ำร้อน" รวมถึงบ่อแช่เท้าคอนกรีตที่ชุมชนต่อท่อน้ำอุ่นมา ซึ่งมีไอน้ำลอยขึ้น',
  },
  {
    id: 'clue-convention',
    type: 'coordinate',
    source: 'ป้าเรือน',
    text: 'นักสำรวจรุ่นแรกบางคนนับค่า N จากขอบบนของแผนที่ลงมา (ผิดทิศ) — พิกัดในบันทึกจึงอาจต้องอ่านใหม่',
  },
  {
    id: 'clue-relative',
    type: 'direction',
    source: 'ป้าเรือน (จากบันทึก)',
    text: 'จากหมุด RP-2 ไปทาง{{dir:rp-2>site-b}} ราว {{dist:rp-2>site-b}} เมตร',
  },
  {
    id: 'clue-field',
    type: 'landmark',
    source: 'ป้าเรือน (จากบันทึก)',
    text: 'ที่บ่อมีไอน้ำร้อนลอยขึ้น และมีหินปูนสีขาวล้อมรอบ',
  },
  {
    id: 'clue-viewpoint',
    type: 'coordinate',
    source: 'พี่เขียว',
    text: 'จุดชมวิวของตำบลอยู่ที่ {{grid:viewpoint}} (ฝึกเดินตามพิกัด)',
  },
  {
    id: 'clue-old-mark',
    type: 'direction',
    source: 'ลุงสอน',
    text: 'หมุดสำรวจเก่าของปู่: จากหมุด RP-1 ไปทาง{{dir:rp-1>old-mark}} {{dist:rp-1>old-mark}} เมตร (ไม่มีป้ายบอก ต้องคำนวณพิกัดแล้วเดินไปเอง)',
  },
  { id: 'clue-survey-a', type: 'landmark', source: 'สำรวจจุด A', text: 'สระน้ำนิ่ง ไม่มีไอน้ำ มีหินสีขาวก้อนหนึ่งอยู่ริมสระ' },
  { id: 'clue-survey-b', type: 'landmark', source: 'สำรวจจุด B', text: 'บ่อน้ำมีไอน้ำร้อนลอยขึ้น รอบบ่อเป็นหินปูนสีขาว' },
  { id: 'clue-survey-c', type: 'landmark', source: 'สำรวจจุด C', text: 'บ่อคอนกรีตมีไอน้ำอุ่นลอยขึ้น ต่อท่อมาจากที่อื่น ไม่มีหินปูน' },
];

export const pongEvidence: EvidenceDefinition[] = [
  { id: 'grid-map', name: 'แผนที่กริดตำบลโป่งน้ำร้อน', description: 'แผนที่พิกัดกริดจำลอง (E/N เป็นเมตร) มาตราส่วน 1:10,000' },
  { id: 'old-record', name: 'บันทึกสำรวจเก่า', description: 'บันทึกของนักสำรวจรุ่นแรก ระบุพิกัดบ่อน้ำร้อนธรรมชาติ' },
  { id: 'survey-a', name: 'บันทึกสำรวจจุด A', description: 'สิ่งที่พบจริงที่จุด A' },
  { id: 'survey-b', name: 'บันทึกสำรวจจุด B', description: 'สิ่งที่พบจริงที่จุด B' },
  { id: 'survey-c', name: 'บันทึกสำรวจจุด C', description: 'สิ่งที่พบจริงที่จุด C' },
  {
    id: 'field-report',
    name: 'รายงานยืนยันภาคสนาม',
    description: 'ผลตรวจ ณ จุดที่วิเคราะห์ได้: พิกัด E/N · ทิศและระยะจาก RP-2 · ไอน้ำและหินปูนขาว',
  },
  { id: 'old-mark-plate', name: 'แผ่นหมุดสำรวจเก่า', description: 'หมุดสำรวจของนักสำรวจรุ่นแรก พบได้ด้วยการคำนวณพิกัด' },
];

const readRp = (n: 1 | 2 | 3, at: { x: number; y: number }): InspectPoint => ({
  id: `rp-${n}-read`,
  at,
  radiusTiles: 1.6,
  when: { notFlags: [`read-rp-${n}`] },
  nodes: [
    {
      speaker: `หมุดอ้างอิง RP-${n}`,
      text: `ตัวเลขที่ตอกบนหมุด: {{grid:rp-${n}}} — ลองเทียบกับพิกัดของตัวเองที่มุมซ้ายบนจอ`,
      effects: [
        { type: 'clue', clueId: `clue-rp-${n}` },
        { type: 'flag', flag: `read-rp-${n}` },
      ],
    },
  ],
});

const SURVEY_TEXT: Record<'a' | 'b' | 'c', string> = {
  a: 'สระน้ำนิ่ง ไม่มีไอน้ำ มีหินสีขาวก้อนหนึ่งอยู่ริมสระ · พิกัดตรงนี้ {{grid:site-a}}',
  b: 'บ่อน้ำมีไอน้ำร้อนลอยขึ้น รอบบ่อเป็นหินปูนสีขาว · พิกัดตรงนี้ {{grid:site-b}}',
  c: 'บ่อคอนกรีตมีไอน้ำอุ่นลอยขึ้น ต่อท่อมาจากที่อื่น ไม่มีหินปูน · พิกัดตรงนี้ {{grid:site-c}}',
};

const survey = (id: 'a' | 'b' | 'c', at: { x: number; y: number }): InspectPoint => ({
  id: `survey-${id}`,
  at,
  radiusTiles: 2.5,
  when: { flags: ['record-checked'], notFlags: [`surveyed-${id}`] },
  nodes: [
    {
      speaker: `สมุดภาคสนาม — จุด ${id.toUpperCase()}`,
      text: SURVEY_TEXT[id],
      effects: [
        { type: 'clue', clueId: `clue-survey-${id}` },
        { type: 'evidence', evidenceId: `survey-${id}` },
        { type: 'flag', flag: `surveyed-${id}` },
      ],
    },
  ],
});

export const pongInspectPoints: InspectPoint[] = [
  readRp(1, { x: 20, y: 39 }),
  readRp(2, { x: 40, y: 49 }),
  readRp(3, { x: 70, y: 39 }),
  survey('a', { x: 66, y: 41 }),
  survey('b', { x: 66, y: 18 }),
  survey('c', { x: 73, y: 28 }),
  {
    // ภารกิจปริศนา — ไม่มีป้ายบนแผนที่ ต้องเดินตามพิกัดที่คำนวณเอง
    id: 'old-mark',
    at: { x: 20, y: 24 },
    radiusTiles: 1.5,
    when: { clues: ['clue-old-mark'], notFlags: ['found-old-mark'] },
    nodes: [
      { speaker: 'หมุดสำรวจเก่า', text: 'พบหมุดคอนกรีตเก่าจมดินอยู่ครึ่งหนึ่ง ตัวเลขบนหมุดลบเลือน ต้องคำนวณพิกัดเอง' },
      { quiz: 'old-mark-coord' },
    ],
  },
];

/**
 * จุดเป้าหมาย 3 แห่ง — บันทึกเขียนพิกัดแบบ "นับ N จากขอบบน" (ผิด)
 *   อ่านตามที่เขียน → จุด A · อ่านแบบแก้แล้ว → จุด B
 * ระบบคำนวณเองว่าจุดใดผ่าน พิกัด + ตำแหน่งสัมพัทธ์ + หลักฐานภาคสนาม (validateLevel ตรวจว่ามีจุดเดียว)
 */
export const pongGridSiteAnalysis: GridSiteAnalysisDefinition = {
  record: { e: 4660, n: 1180 },
  recordConvention: 'top-counted',
  relative: { fromId: 'rp-2', direction: 'NE', meters: 400, toleranceMeters: 30 },
  requiredFeatures: ['steam', 'white-rock'],
  featureLabels: { steam: 'ไอน้ำร้อน', 'white-rock': 'หินปูนสีขาว', pond: 'สระน้ำนิ่ง' },
  toleranceTiles: 3,
  candidates: [
    { landmarkId: 'site-a', label: 'จุด A', evidenceId: 'survey-a' },
    { landmarkId: 'site-b', label: 'จุด B', evidenceId: 'survey-b' },
    { landmarkId: 'site-c', label: 'จุด C', evidenceId: 'survey-c' },
  ],
  correctLandmarkId: 'site-b',
  placeType: 'natural-hot-spring',
  requiredClueIds: ['clue-convention', 'clue-relative', 'clue-field'],
  availableWhen: { minStep: 4 },
  successFlag: 'grid-checked',
  // ฉาก 5: กด E ที่จุดเป้าหมาย → ระบบตรวจพิกัด/ทิศ-ระยะ/สิ่งที่พบให้ดูทีละข้อ
  verify: { radiusTiles: 3, when: { flags: ['grid-checked'] }, evidenceId: 'field-report', flag: 'site-verified' },
};

export const pongPinTask: PinTaskDefinition = {
  targetId: 'site-analysis',
  toleranceTiles: 2,
  mustStandWithinTiles: 5,
  wisdomPrompt: 'สถานที่ที่ปักหมุดคืออะไร',
  wisdomChoices: [
    { id: 'pond', label: 'สระน้ำ' },
    { id: 'natural-hot-spring', label: 'บ่อน้ำร้อนธรรมชาติ' },
    { id: 'foot-bath', label: 'บ่อแช่เท้าของชุมชน' },
  ],
  correctWisdomId: 'natural-hot-spring',
  // ต้องมีรายงานยืนยันภาคสนาม — เดินไปถึงอย่างเดียวปักไม่ผ่าน
  requiredEvidenceIds: ['field-report'],
  problemHints: {
    far: 'ต้องยืนใกล้ตำแหน่งที่จะปัก (ไม่เกิน 50 ม.) — เดินไปที่จุดนั้นก่อน',
    unexplored: 'ตำแหน่งที่ปักยังอยู่ในหมอก ต้องเดินไปสำรวจบริเวณนั้นก่อน',
    location: 'ตำแหน่งที่ปักยังไม่ตรงกับจุดที่วิเคราะห์ได้ — เทียบพิกัด E/N ของหมุดกับพิกัดที่แก้ไขแล้ว',
    wisdom: 'ประเภทสถานที่ยังไม่ถูก — ทบทวนหลักฐานภาคสนาม (ไอน้ำร้อน หินปูนขาว) ว่าเป็นสถานที่แบบใด',
    evidence: 'ยังขาดหลักฐาน',
  },
  availableWhen: { flags: ['grid-checked'] },
  successFlag: 'pin-verified',
};

export const pongEnding: EndingDefinition = {
  messages: [
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ครูได้รับรายงานแล้ว! บ่อน้ำร้อนธรรมชาติอยู่ที่ {{grid:site-analysis}} ถูกต้องทั้งพิกัด ทิศ/ระยะ และหลักฐานภาคสนาม',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ทบทวนแกนพิกัด: ค่า E เพิ่มเมื่อไปทางตะวันออก ค่า N เพิ่มเมื่อไปทางเหนือ',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'บนจอเกม แกน Y ของ Phaser นับเพิ่มลงด้านล่าง ซึ่งตรงข้ามกับ N — บันทึกเก่า {{gridrecord}} นับ N จากขอบบนแบบแกน Y ถ้าอ่านตามที่เขียนจึงได้ตำแหน่งผิด',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'การอ่านพิกัดต้องรู้จุดกำเนิดที่กำหนด: แผนที่นี้เริ่มที่ E 4,000 · N 1,000 มุมตะวันตกเฉียงใต้',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'และการยืนยันตำแหน่งต้องใช้หลักฐานประกอบ: พิกัด + ทิศและระยะจากจุดอ้างอิง + สิ่งที่พบจริง ไม่ใช่ตัวเลขอย่างเดียว',
    },
    { speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)', text: 'ครูมอบรหัสลับชิ้นที่ 3 และแผนที่กริดตำบลโป่งน้ำร้อนให้ เก็บไว้รวมกับสองชิ้นแรกนะ' },
  ],
  // รหัสชั่วคราว — เปลี่ยนได้ที่นี่ภายหลัง
  codePiece: { index: 3, total: 4, value: 'พิกัด' },
  rewardItem: 'แผนที่กริดตำบลโป่งน้ำร้อน',
  completeFlag: 'mission-complete',
};

export const pongQuests: QuestDefinition[] = [
  {
    id: 'main-pong',
    kind: 'main',
    title: 'ปริศนาพิกัดลับแห่งโป่งน้ำร้อน',
    description: 'ตรวจสอบบันทึกสำรวจเก่า แล้วระบุตำแหน่งบ่อน้ำร้อนธรรมชาติด้วยพิกัด ตำแหน่งสัมพัทธ์ และหลักฐานภาคสนาม',
    lockedHint: '',
    objectives: [
      { text: 'รับแผนที่กริดและบันทึกสำรวจจากครูเนม', done: { type: 'step', order: 1 } },
      { text: 'ตรวจหมุดอ้างอิงในชุมชน', done: { type: 'step', order: 2 } },
      { text: 'ฟังเบาะแสจากผู้เก็บบันทึก', done: { type: 'step', order: 3 } },
      { text: 'วิเคราะห์พิกัดบนกระดาน (C) เลือกจุดที่ตรงหลักฐานครบ', done: { type: 'step', order: 4 } },
      { text: 'ยืนยันภาคสนามและปักหมุดตำแหน่งที่ถูกต้อง', done: { type: 'step', order: 5 } },
      { text: 'ส่งรายงานและรับรหัสลับชิ้นที่ 3', done: { type: 'step', order: 6 } },
    ],
  },
  {
    id: 'side-viewpoint',
    kind: 'side',
    title: 'เดินตามพิกัด',
    description: 'พี่เขียวบอกพิกัดจุดชมวิวมา ลองเดินไปให้ถึงโดยดูพิกัดของตัวเองบนจอ',
    unlockWhen: { clues: ['clue-viewpoint'] },
    lockedHint: 'คุยกับเจ้าหน้าที่ป่าไม้ใกล้ถนนขึ้นเขา',
    objectives: [{ text: 'เดินไปถึงจุดชมวิว', done: { type: 'discover', landmarkId: 'viewpoint' } }],
    reward: { text: 'บันทึกในสมุด: เดินตามพิกัดกริดได้สำเร็จ' },
  },
  {
    id: 'mystery-old-mark',
    kind: 'mystery',
    title: 'หมุดสำรวจที่หายไป',
    description: 'ลุงสอนเล่าว่าปู่ฝังหมุดสำรวจไว้ ห่างจาก RP-1 ตามทิศและระยะที่บอก — คำนวณพิกัดเองแล้วเดินไปให้ถึง',
    unlockWhen: { clues: ['clue-old-mark'] },
    lockedHint: 'คุยกับลุงสอนอีกครั้งหลังฟังผู้เก็บบันทึก',
    objectives: [{ text: 'หาหมุดสำรวจเก่าและตอบพิกัดให้ถูก', done: { type: 'flag', flag: 'found-old-mark' } }],
    reward: { text: 'หลักฐาน: แผ่นหมุดสำรวจเก่า' },
  },
];

export const pongStory: StoryStep[] = [
  {
    order: 1,
    title: 'ครูเนมมอบแผนที่กริด',
    objective: 'คุยกับครูเนม รับแผนที่กริดและบันทึกสำรวจเก่า และฝึกอ่านพิกัด',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'axes-ok' },
  },
  {
    order: 2,
    title: 'สำรวจจุดอ้างอิงในชุมชน',
    objective: 'ตรวจหมุดอ้างอิง RP-1, RP-2, RP-3 (กด E ที่หมุด) และคุยกับลุงสอน',
    landmarkId: 'rp-2',
    status: 'playable',
    completeWhen: {
      type: 'all',
      of: [
        { type: 'flag', flag: 'read-rp-1' },
        { type: 'flag', flag: 'read-rp-2' },
        { type: 'flag', flag: 'read-rp-3' },
        { type: 'talk', npcId: 'villager-son' },
      ],
    },
  },
  {
    order: 3,
    title: 'ผู้เก็บบันทึก',
    objective: 'คุยกับป้าเรือนที่ศาลาประชาคม ฟังเบาะแสเรื่องพิกัดที่อาจบันทึกผิด',
    landmarkId: 'hall',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'record-checked' },
  },
  {
    order: 4,
    title: 'เปรียบเทียบพิกัดและตำแหน่งสัมพัทธ์',
    objective: 'สำรวจจุด A, B, C (กด E) แล้วกด C เปิดกระดานวิเคราะห์พิกัด เลือกจุดที่ตรงหลักฐานครบ 3 ชนิด',
    landmarkId: 'rp-2',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'grid-checked' },
  },
  {
    order: 5,
    title: 'สำรวจและยืนยันตำแหน่ง',
    objective: 'เดินไปจุดที่วิเคราะห์ได้ กด E ตรวจยืนยัน แล้วเปิดแผนที่ (M) ปักหมุดและเลือกประเภทสถานที่',
    landmarkId: 'site-b',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'pin-verified' },
  },
  {
    order: 6,
    title: 'ส่งรายงานและรับรหัส',
    objective: 'ครูเนมสรุปผลผ่านสมุดภาคสนาม',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];

/* ---------------- ขั้นย่อย (v0.19: นำทางด้วย "การกระทำ") ----------------
 * นำทางไป NPC และหมุดอ้างอิง RP (ครูเนมบอกไว้แล้ว — ฝึกอ่านพิกัดจากแผ่นป้าย)
 * ไม่นำทางไปจุด A/B/C (ต้องหาจากพิกัด E/N เอง) และไม่บอกว่าจุดไหนถูก
 */
const rpStep = (n: 1 | 2 | 3): NonNullable<StoryStep['micro']>[number] =>
  inspectAt({
    id: `read-rp-${n}`,
    goal: `อ่านพิกัดที่หมุดอ้างอิง RP-${n}`,
    find: `หมุด RP-${n} อยู่ทาง{{dir:school>rp-${n}}}ของโรงเรียน — ดูลูกศรสีเหลืองที่ขอบจอ`,
    result: `พิกัด E/N ของ RP-${n} ถูกจดลงสมุด`,
    tool: 'แผ่นป้ายบนหมุดบอกพิกัด E/N — เทียบกับพิกัดของเราที่แถบสถานะ (มุมซ้ายบน)',
    think: `พิกัดของ RP-${n} คือ E เท่าไร N เท่าไร? ตอนยืนที่หมุด พิกัดของเราตรงกันไหม`,
    target: { landmarkId: `rp-${n}` },
    done: { type: 'flag', flag: `read-rp-${n}` },
  });

const PONG_MICRO: Record<number, NonNullable<StoryStep['micro']>> = {
  1: [
    talkTo({
      id: 'talk-nem',
      npcId: 'teacher-nem',
      name: 'ครูเนม',
      goal: 'ไปคุยกับครูเนม รับแผนที่กริด',
      where: 'ที่โรงเรียน',
      result: 'ได้แผนที่กริด บันทึกสำรวจเก่า และคำถามฝึกอ่านพิกัด',
      think: 'พิกัดกริดบอกตำแหน่งด้วยตัวเลขสองตัว — ตัวไหนบอกแนวตะวันออก ตัวไหนบอกแนวเหนือ?',
      done: { type: 'clue', clueId: 'clue-grid-rule' },
      impliedByLater: true,
    }),
    answerQuiz({
      id: 'quiz-axes',
      npcId: 'teacher-nem',
      name: 'ครูเนม',
      goal: 'ตอบคำถามเรื่องการอ่านพิกัด E/N',
      result: 'ได้เบาะแสตำแหน่งหมุดอ้างอิง RP-1, RP-2, RP-3 — ต่อไปออกไปอ่านพิกัดที่หมุด',
      tool: 'อ่าน E (ตะวันออก) ก่อน แล้วค่อยอ่าน N (เหนือ) · เปิด{tap:map} ดูเลข E/N ที่ขอบแผนที่',
      think: 'ถ้าเดินไปทางตะวันออก ตัวเลขไหนเพิ่มขึ้น?',
      done: { type: 'flag', flag: 'axes-ok' },
    }),
  ],
  2: [
    rpStep(1),
    rpStep(2),
    rpStep(3),
    talkTo({
      id: 'talk-son',
      npcId: 'villager-son',
      name: 'ลุงสอน',
      where: 'ในชุมชนโป่งน้ำร้อน',
      result: 'ได้เรื่องเล่าของชุมชนเกี่ยวกับบ่อน้ำร้อน',
      think: 'ชาวบ้านใช้อะไรเป็นจุดสังเกตของบ่อน้ำร้อน?',
      done: { type: 'talk', npcId: 'villager-son' },
    }),
  ],
  3: [
    talkTo({
      id: 'talk-ruean',
      npcId: 'record-keeper',
      name: 'ป้าเรือน',
      goal: 'ไปพบป้าเรือนที่ศาลาประชาคม',
      where: 'ที่ศาลาประชาคม',
      result: 'ได้เบาะแสเรื่องพิกัดที่อาจบันทึกผิด แล้วป้าเรือนจะถามคำถาม',
      think: 'ถ้าบันทึกพิกัดผิดไป ตำแหน่งบนแผนที่จะคลาดไปทางไหน?',
      done: { type: 'clue', clueId: 'clue-convention' },
      impliedByLater: true,
    }),
    answerQuiz({
      id: 'quiz-north',
      npcId: 'record-keeper',
      name: 'ป้าเรือน',
      goal: 'ตอบคำถามเรื่องพิกัดเมื่อเดินไปทางเหนือ',
      result: 'รู้วิธีตรวจพิกัดในบันทึกเก่า — ต่อไปสำรวจจุด A B C',
      tool: '{tap:map} ดูเลขพิกัดที่ขอบแผนที่ — เทียบเลขด้านบน (เหนือ) กับด้านล่าง (ใต้)',
      think: 'เมื่อเดินไปทางเหนือ ค่า E หรือค่า N ที่เปลี่ยน และเปลี่ยนอย่างไร?',
      done: { type: 'flag', flag: 'record-checked' },
    }),
  ],
  4: [
    {
      id: 'survey-abc',
      goal: 'สำรวจจุด A, B และ C',
      tools: ['กระดานวิเคราะห์', 'แผนที่', 'ปุ่มสำรวจ'],
      steps: ['{tap:guide} ดูพิกัด E/N ของจุด A B C', '{tap:map} หาช่องที่พิกัดตรงกัน แล้ว{walk}ไป', 'ที่แต่ละจุด {tap:inspect}'],
      result: 'บันทึกสิ่งที่พบจริงของจุดที่สำรวจ — ครบสามจุดแล้วไปเปิดกระดานวิเคราะห์',
      tool: 'แถบสถานะ (มุมซ้ายบน) บอกพิกัดที่เรายืน — เดินจนพิกัดตรงกับจุดที่ต้องการ',
      think: 'เลข E เพิ่มเมื่อเดินไปทางไหน และเลข N เพิ่มเมื่อเดินไปทางไหน?',
      doneText: '✓ สำรวจครบสามจุดแล้ว!',
      action: 'analysis',
      actionLabel: '🔍 ดูพิกัดบนกระดาน',
      done: { type: 'all', of: [{ type: 'flag', flag: 'surveyed-a' }, { type: 'flag', flag: 'surveyed-b' }, { type: 'flag', flag: 'surveyed-c' }] },
    },
    openTool({
      id: 'open-board',
      goal: 'เปิดกระดานวิเคราะห์พิกัด',
      button: 'analysis',
      look: ['ดูหลักฐานของแต่ละจุด: พิกัด · ตำแหน่งสัมพัทธ์ · สิ่งที่พบจริง'],
      result: 'เมื่อเปิดแล้ว ขั้นต่อไปคือเลือกจุดที่ตรงกับหลักฐาน',
      tool: 'กระดานเปิดได้ตั้งแต่ขั้นนี้ ถ้าปุ่มยังกดไม่ได้ ให้ฟังเบาะแสจากป้าเรือนก่อน',
      think: 'หลักฐานแต่ละชนิดชี้ไปที่จุดเดียวกันหรือไม่?',
      done: { type: 'flag', flag: 'opened:gridcheck' },
      doneText: '✓ เปิดกระดานวิเคราะห์แล้ว!',
      impliedByLater: true,
    }),
    {
      id: 'choose-site',
      goal: 'เลือกจุดที่ตรงกับหลักฐานทุกข้อ',
      tools: ['กระดานวิเคราะห์'],
      steps: ['{tap:guide}', 'เทียบแต่ละจุดกับพิกัดที่แก้แล้ว ตำแหน่งสัมพัทธ์ และสิ่งที่พบจริง', '{choose}จุด แล้ว{tap:confirm}'],
      result: 'ถ้าตรงทุกข้อ ไปขั้นตรวจยืนยันในพื้นที่ · ถ้ายังไม่ตรง กระดานบอกว่าหลักฐานใดขัดแย้ง',
      tool: 'ยังไม่ต้องรีบยืนยัน — เลือกจุดแล้วอ่านผลเทียบหลักฐานก่อน',
      think: 'จุดไหนตรงทั้งพิกัดที่แก้แล้ว และสิ่งที่ชาวบ้านเล่า?',
      doneText: '✓ วิเคราะห์พิกัดสำเร็จ!',
      action: 'analysis',
      actionLabel: '🔍 เลือกจุด',
      done: { type: 'flag', flag: 'grid-checked' },
    },
  ],
  5: [
    {
      id: 'verify',
      goal: 'ไปตรวจยืนยันจุดที่เลือก',
      tools: ['แผนที่', 'ปุ่มตรวจสอบ'],
      steps: ['{tap:map} หาจุดที่เลือกบนกระดาน (ดูพิกัดในสมุด)', '{walk} ไปที่จุดนั้น', 'เมื่อปุ่ม "ตรวจสอบ" ขึ้น {tap:check}'],
      result: 'ได้รายงานภาคสนาม — ต่อไปปักหมุด',
      tool: 'ต้องยืนใกล้จุดที่เลือกไม่เกิน 3 ช่อง ปุ่มตรวจสอบจึงจะขึ้น',
      think: 'สิ่งที่เห็นจริงตรงกับหลักฐานบนกระดานหรือไม่?',
      doneText: '✓ ตรวจยืนยันแล้ว!',
      action: 'map',
      done: { type: 'flag', flag: 'site-verified' },
    },
    pinOnMap({
      id: 'pin',
      place: 'จุดที่ตรวจยืนยัน',
      kind: 'ประเภทสถานที่',
      think: 'สถานที่ที่ตรวจยืนยันแล้วเป็นภูมิปัญญาหรือแหล่งธรรมชาติประเภทใด?',
      done: { type: 'flag', flag: 'pin-verified' },
    }),
  ],
  6: [hearReport({ id: 'report', code: 'รหัสลับชิ้นที่ 3', done: { type: 'flag', flag: 'mission-complete' } })],
};
for (const st of pongStory) if (PONG_MICRO[st.order]) st.micro = PONG_MICRO[st.order];
