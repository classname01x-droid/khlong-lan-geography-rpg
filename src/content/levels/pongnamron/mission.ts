import type {
  ClueDefinition,
  EvidenceDefinition,
  GridSiteAnalysisDefinition,
  InspectPoint,
  PinTaskDefinition,
  QuestDefinition,
  QuizDefinition,
  StoryStep,
} from '../../types';

/**
 * ภารกิจด่านโป่งน้ำร้อน — ทักษะ: พิกัดกริด (E/N) · ทิศทางของแกน · ตำแหน่งสัมพัทธ์ · ตรวจหลักฐานภาคสนาม
 * ต้นแบบนี้เล่นได้ฉาก 1–3 ส่วนฉาก 4–6 วางโครงและตรรกะไว้แล้ว (ยังไม่มีหน้าจอ)
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
  requiredEvidenceIds: [],
  availableWhen: { flags: ['grid-checked'] },
  successFlag: 'pin-verified',
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
      { text: 'เปรียบเทียบพิกัดกับตำแหน่งสัมพัทธ์ (อยู่ระหว่างพัฒนา)', done: { type: 'step', order: 4 } },
      { text: 'สำรวจและปักหมุดตำแหน่งที่ถูกต้อง (อยู่ระหว่างพัฒนา)', done: { type: 'step', order: 5 } },
      { text: 'รับรหัสลับชิ้นที่ 3 (อยู่ระหว่างพัฒนา)', done: { type: 'step', order: 6 } },
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
    objective: '(อยู่ระหว่างพัฒนา) สำรวจจุด A, B, C แล้วตรวจพิกัดกับตำแหน่งสัมพัทธ์',
    landmarkId: 'rp-2',
    status: 'planned',
    completeWhen: { type: 'flag', flag: 'grid-checked' },
  },
  {
    order: 5,
    title: 'สำรวจและปักหมุด',
    objective: '(อยู่ระหว่างพัฒนา)',
    landmarkId: 'site-b',
    status: 'planned',
    completeWhen: { type: 'flag', flag: 'pin-verified' },
  },
  {
    order: 6,
    title: 'รับรหัสลับชิ้นที่ 3',
    objective: '(อยู่ระหว่างพัฒนา)',
    landmarkId: 'school',
    status: 'planned',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];
