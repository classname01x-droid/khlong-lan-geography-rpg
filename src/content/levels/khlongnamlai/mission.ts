import type {
  BaseMapDefinition,
  ClueDefinition,
  EndingDefinition,
  EvidenceDefinition,
  InspectPoint,
  MapComparisonDefinition,
  PinTaskDefinition,
  QuestDefinition,
  QuizDefinition,
  SiteAnalysisDefinition,
  StoryStep,
} from '../../types';
import { STREAM_POINTS } from './map';

/**
 * ภารกิจด่านคลองน้ำไหล (6 ฉาก) — ทักษะใหม่ต่างจากด่าน 1:
 * สัญลักษณ์แผนที่ · ทิศทางน้ำไหลจากระดับความสูง · การเปรียบเทียบแผนที่สองฉบับกับหลักฐานจริง
 * ตัวเลขความสูง/ระยะ/ทิศทั้งหมดใช้ตัวแปร {{...}} ที่คำนวณจากแผนที่
 */

export const namLaiQuizzes: QuizDefinition[] = [
  {
    id: 'flow',
    speaker: 'ป้าจันทร์ (ผู้ดูแลแหล่งน้ำ)',
    question:
      'จุด A สูง {{elev:site-a}} ม. · จุด B สูง {{elev:site-b}} ม. · จุด C สูง {{elev:site-c}} ม. และทั้งสามจุดอยู่บนลำห้วยเดียวกันต่อเนื่องกัน น้ำในลำห้วยไหลอย่างไร?',
    choices: [
      {
        id: 'south',
        label: 'ไหลจาก C → B → A (ไปทางทิศใต้)',
        hint: 'น้ำไหลจากที่สูงไปที่ต่ำ ลองเทียบตัวเลขอีกครั้งว่าจุดไหนสูงที่สุด (จุดที่อยู่ด้านบนของแผนที่ไม่ได้แปลว่าสูงกว่า)',
      },
      { id: 'north', label: 'ไหลจาก A → B → C (ไปทางทิศเหนือ)' },
      {
        id: 'east',
        label: 'ไหลออกจาก B ไปทางทิศตะวันออก',
        hint: 'ทั้งสามจุดอยู่บนลำห้วยสายเดียวกัน น้ำต้องไหลตามลำห้วยจากจุดที่สูงไปจุดที่ต่ำ',
      },
    ],
    correctChoiceId: 'north',
    fallbackHint: 'น้ำไหลจากที่สูงไปที่ต่ำเสมอ',
    correctFeedback:
      'ถูกต้อง! A ({{elev:site-a}} ม.) สูงกว่า B ({{elev:site-b}} ม.) และ C ({{elev:site-c}} ม.) น้ำจึงไหล A → B → C ไปทาง{{flow:stream-main}}',
    effects: [{ type: 'flag', flag: 'flow-known' }],
    verifyFlowOf: 'stream-main',
  },
];

export const namLaiClues: ClueDefinition[] = [
  {
    id: 'clue-conflict',
    type: 'comparison',
    source: 'ครูเนม',
    text: 'ข้อมูลแหล่งน้ำของตำบลขัดแย้งกัน: แผนที่ฐานฉบับ A และ B ระบุตาน้ำ ทิศน้ำไหล และบางจุดสังเกตไม่ตรงกัน ต้องตรวจด้วยหลักฐานจริง',
  },
  {
    id: 'clue-symbols',
    type: 'symbol',
    source: 'ครูเนม',
    text: 'สัญลักษณ์แผนที่: เส้นน้ำเงิน = ลำน้ำ · เส้นน้ำตาล = ถนน · เส้นคู่ = สะพาน · ต้นข้าว = พื้นที่เกษตร · สามเหลี่ยม = หมุดหลักฐานระดับ · ◎ = ตาน้ำ · ขีดขวางลำน้ำ = ฝาย',
  },
  {
    id: 'clue-village',
    type: 'direction',
    source: 'ครูเนม',
    text: 'ชุมชนริมคลองอยู่ทาง{{dir:school>village}}ของโรงเรียน ห่างเป็นเส้นตรงประมาณ {{dist:school>village}} เมตร',
  },
  {
    id: 'clue-stones',
    type: 'landmark',
    source: 'ยายหอม',
    text: 'สะพานกลางหมู่บ้านข้ามลำห้วยสายเดียวของตำบล · ผู้ใหญ่สมัยก่อนเล่าว่าตาน้ำอยู่ใกล้ก้อนหินใหญ่สามก้อน',
  },
  {
    id: 'clue-weir',
    type: 'landmark',
    source: 'ลุงเพชร',
    text: 'ชาวบ้านเรียกฝายว่า "ต้นน้ำของนา" เพราะน้ำทุกหยดที่เข้านาต้องผ่านฝายนี้ · บ่อในไร่ขุดใหม่ เก็บน้ำฝน ไม่ได้รับน้ำจากลำห้วย',
  },
  {
    id: 'clue-elev-rule',
    type: 'elevation',
    source: 'พี่ภูมิ',
    text: 'น้ำไหลจากที่สูงไปที่ต่ำเสมอ ต้องดูระดับความสูง ไม่ใช่ดูว่าอยู่ด้านบนหรือล่างของแผนที่ · เส้นชั้นความสูงวงปิดซ้อนกัน = เนิน วงในสุด = ยอดเนิน',
  },
  {
    id: 'clue-elev-abc',
    type: 'elevation',
    source: 'ป้าจันทร์',
    text: 'ระดับความสูงบนลำห้วย (รทก.): จุด A {{elev:site-a}} ม. · จุด B {{elev:site-b}} ม. · จุด C {{elev:site-c}} ม.',
  },
  {
    id: 'clue-connect',
    type: 'elevation',
    source: 'ป้าจันทร์',
    text: 'จุด A, B และ C อยู่บนลำห้วยสายเดียวกัน ต่อเนื่องกันตามลำดับ A – B – C',
  },
  {
    id: 'clue-bm-north',
    type: 'elevation',
    source: 'หมุดหลักฐานระดับฝั่งเหนือ',
    text: 'ระดับความสูง {{elev:bm-north}} เมตร (รทก.)',
  },
  {
    id: 'clue-bm-south',
    type: 'elevation',
    source: 'หมุดหลักฐานระดับฝั่งใต้',
    text: 'ระดับความสูง {{elev:bm-south}} เมตร (รทก.)',
  },
  {
    id: 'clue-survey-a',
    type: 'landmark',
    source: 'สำรวจจุด A',
    text: 'แอ่งน้ำใสใต้เนิน มีก้อนหินใหญ่สามก้อนอยู่ใกล้ ๆ · ป้ายวัดระดับ {{elev:site-a}} ม.',
  },
  {
    id: 'clue-survey-b',
    type: 'landmark',
    source: 'สำรวจจุด B',
    text: 'ฝายคอนกรีตกั้นลำห้วย มีประตูน้ำส่งน้ำเข้านา · ป้ายวัดระดับ {{elev:site-b}} ม.',
  },
  {
    id: 'clue-survey-c',
    type: 'landmark',
    source: 'สำรวจจุด C',
    text: 'หนองน้ำกว้าง น้ำเต็มตลอดปี มีต้นกกขึ้นรอบ ๆ · ป้ายวัดระดับ {{elev:site-c}} ม.',
  },
  {
    id: 'clue-jar',
    type: 'elevation',
    source: 'ยายหอม',
    text: 'ปู่ทวดฝังไหดินเผาไว้ตรง "จุดที่สูงที่สุดของเนินทางตะวันออกของหมู่บ้าน" (ใช้เส้นชั้นความสูงบนแผนที่หา)',
  },
];

export const namLaiEvidence: EvidenceDefinition[] = [
  { id: 'map-a', name: 'แผนที่ฐานฉบับ A', description: 'แผนที่ฐานจากครูเนม (มาตราส่วน 1:10,000)' },
  { id: 'map-b', name: 'แผนที่ฐานฉบับ B', description: 'แผนที่ฐานอีกฉบับจากครูเนม (มาตราส่วน 1:10,000)' },
  { id: 'survey-a', name: 'บันทึกสำรวจจุด A', description: 'สิ่งที่พบและค่าระดับความสูงที่จุด A' },
  { id: 'survey-b', name: 'บันทึกสำรวจจุด B', description: 'สิ่งที่พบและค่าระดับความสูงที่จุด B' },
  { id: 'survey-c', name: 'บันทึกสำรวจจุด C', description: 'สิ่งที่พบและค่าระดับความสูงที่จุด C' },
  { id: 'old-jar', name: 'ไหดินเผาโบราณ', description: 'พบบนยอดเนินทางตะวันออก ตามเรื่องเล่าของยายหอม' },
];

const SURVEY_TEXT: Record<'a' | 'b' | 'c', string> = {
  a: 'แอ่งน้ำใสใต้เนิน มีก้อนหินใหญ่สามก้อนอยู่ใกล้ ๆ · ป้ายวัดระดับเขียนว่า {{elev:site-a}} ม.',
  b: 'ฝายคอนกรีตกั้นลำห้วย มีประตูน้ำส่งน้ำเข้านา · ป้ายวัดระดับเขียนว่า {{elev:site-b}} ม.',
  c: 'หนองน้ำกว้าง น้ำเต็มตลอดปี มีต้นกกขึ้นรอบ ๆ · ป้ายวัดระดับเขียนว่า {{elev:site-c}} ม.',
};

/** สำรวจจุด A/B/C (กด E ในรัศมี 3 ช่อง) — บันทึกสิ่งที่พบและค่าระดับความสูงลงสมุด */
const survey = (id: 'a' | 'b' | 'c', at: { x: number; y: number }): InspectPoint => ({
  id: `survey-${id}`,
  at,
  radiusTiles: 3,
  when: { flags: ['flow-known'], notFlags: [`surveyed-${id}`] },
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

/** จุดตรวจค้น (กด E): หมุดหลักฐานระดับ 2 หมุด · จุดสำรวจ A/B/C · ยอดเนิน (ภารกิจปริศนา) */
export const namLaiInspectPoints: InspectPoint[] = [
  {
    id: 'bm-north-read',
    at: { x: 36, y: 12 },
    radiusTiles: 1.6,
    when: { notFlags: ['read-bm-north'] },
    nodes: [
      {
        speaker: 'หมุดหลักฐานระดับ (BM) ฝั่งเหนือ',
        text: 'แผ่นโลหะบนหมุดเขียนว่า: ระดับความสูง {{elev:bm-north}} เมตร (รทก.)',
        effects: [
          { type: 'clue', clueId: 'clue-bm-north' },
          { type: 'flag', flag: 'read-bm-north' },
        ],
      },
    ],
  },
  {
    id: 'bm-south-read',
    at: { x: 27, y: 46 },
    radiusTiles: 1.6,
    when: { notFlags: ['read-bm-south'] },
    nodes: [
      {
        speaker: 'หมุดหลักฐานระดับ (BM) ฝั่งใต้',
        text: 'แผ่นโลหะบนหมุดเขียนว่า: ระดับความสูง {{elev:bm-south}} เมตร (รทก.)',
        effects: [
          { type: 'clue', clueId: 'clue-bm-south' },
          { type: 'flag', flag: 'read-bm-south' },
        ],
      },
    ],
  },
  survey('a', { x: 22, y: 52 }),
  survey('b', { x: 30, y: 27 }),
  survey('c', { x: 33, y: 2 }),
  {
    id: 'hill-jar',
    at: { x: 70, y: 51 },
    radiusTiles: 1.6,
    when: { clues: ['clue-jar'], notFlags: ['jar-found'] },
    expectHighestWithin: 12,
    nodes: [
      {
        speaker: 'สมุดภาคสนาม',
        text: 'ตรงยอดเนินสูง {{elev:hill-summit}} ม. มีไหดินเผาเก่าโผล่พ้นดินขึ้นมา! ตรงกับเรื่องเล่าของยายหอม',
        effects: [
          { type: 'evidence', evidenceId: 'old-jar' },
          { type: 'flag', flag: 'jar-found' },
        ],
      },
    ],
  },
];

/* ---------------- แผนที่ฐานสองฉบับ ---------------- */

const COMMON_LINES: BaseMapDefinition['lines'] = [
  { style: 'stream', points: STREAM_POINTS },
  { style: 'road', points: [{ x: 0, y: 34 }, { x: 79, y: 34 }] },
  { style: 'road', points: [{ x: 10, y: 15 }, { x: 10, y: 34 }] },
  { style: 'road', points: [{ x: 57, y: 36 }, { x: 57, y: 48 }] },
];

/** สัญลักษณ์ที่ทั้งสองฉบับเขียนตรงกัน (ใช้ฝึกอ่านสัญลักษณ์) */
const COMMON_MARKS: BaseMapDefinition['marks'] = [
  { symbol: 'school', at: { x: 13, y: 11 }, label: 'โรงเรียน', refersTo: 'school' },
  { symbol: 'village', at: { x: 45, y: 33 }, label: 'หมู่บ้าน', refersTo: 'village', labelAt: 'above' },
  { symbol: 'office', at: { x: 45, y: 37 }, label: 'ศาลาจัดการน้ำ', refersTo: 'water-office', labelAt: 'below' },
  { symbol: 'temple', at: { x: 62, y: 32 }, label: 'วัด', refersTo: 'temple' },
  { symbol: 'bridge', at: { x: 31, y: 34 }, label: 'สะพาน', refersTo: 'bridge', labelAt: 'left' },
  { symbol: 'farm', at: { x: 58, y: 42 }, label: 'พื้นที่เกษตร', refersTo: 'farmland', labelAt: 'right' },
  { symbol: 'benchmark', at: { x: 36, y: 12 }, label: 'BM', refersTo: 'bm-north', labelAt: 'right' },
  { symbol: 'benchmark', at: { x: 27, y: 46 }, label: 'BM', refersTo: 'bm-south', labelAt: 'right' },
  { symbol: 'weir', at: { x: 30, y: 27 }, label: 'B ฝาย', refersTo: 'site-b', labelAt: 'right' },
];

/**
 * ฉบับ A และ B ต่างกันที่: สัญลักษณ์ตาน้ำ/หนองน้ำ ตำแหน่งหินสามก้อน และลูกศรทิศน้ำไหล
 * ระบบไม่ได้บอกว่าฉบับใดถูก — checkSheet() เทียบกับโลกเกม (validateLevel ตรวจว่ามีฉบับเดียวที่ผ่านทุกข้อ)
 */
export const namLaiBaseMaps: BaseMapDefinition[] = [
  {
    id: 'A',
    title: 'แผนที่ฐานฉบับ A',
    note: 'มาตราส่วน 1:10,000 · ไม่มีเส้นชั้นความสูง',
    requiredEvidenceId: 'map-a',
    lines: COMMON_LINES,
    marks: [
      ...COMMON_MARKS,
      { symbol: 'spring', at: { x: 22, y: 52 }, label: 'A ตาน้ำ', refersTo: 'site-a', labelAt: 'left' },
      { symbol: 'stones', at: { x: 26, y: 54 }, label: 'หินสามก้อน', refersTo: 'three-stones', labelAt: 'right' },
      { symbol: 'marsh', at: { x: 33, y: 2 }, label: 'C หนองน้ำ', refersTo: 'site-c', labelAt: 'right' },
    ],
    flowArrows: [
      { at: { x: 28, y: 40 }, toward: 'N' },
      { at: { x: 31, y: 12 }, toward: 'N' },
    ],
  },
  {
    id: 'B',
    title: 'แผนที่ฐานฉบับ B',
    note: 'มาตราส่วน 1:10,000 · ไม่มีเส้นชั้นความสูง',
    requiredEvidenceId: 'map-b',
    lines: COMMON_LINES,
    marks: [
      ...COMMON_MARKS,
      { symbol: 'marsh', at: { x: 22, y: 52 }, label: 'A หนองน้ำ', refersTo: 'site-a', labelAt: 'left' },
      { symbol: 'spring', at: { x: 33, y: 2 }, label: 'C ตาน้ำ', refersTo: 'site-c', labelAt: 'right' },
      { symbol: 'stones', at: { x: 36, y: 5 }, label: 'หินสามก้อน', refersTo: 'three-stones', labelAt: 'right' },
    ],
    flowArrows: [
      { at: { x: 28, y: 40 }, toward: 'S' },
      { at: { x: 31, y: 12 }, toward: 'S' },
    ],
  },
];

export const namLaiMapComparison: MapComparisonDefinition = {
  waterwayId: 'stream-main',
  toleranceTiles: 3,
  // ต้องเดินไปเห็นจริงก่อน: หินสามก้อน และหนองน้ำที่จุด C (สองจุดที่แผนที่ทั้งสองขัดกัน)
  requiredObservations: ['three-stones', 'site-c'],
  requiredClueIds: ['clue-elev-abc'],
  availableWhen: { minStep: 4 },
  successFlag: 'maps-compared',
};

/**
 * จุดสำรวจ A/B/C — ระบบหาเป้าหมายเองจาก: ต้นน้ำ (ระดับความสูง) + แผนที่ฐานฉบับที่ผ่านการตรวจ + สัญลักษณ์ตาน้ำ
 */
export const namLaiSiteAnalysis: SiteAnalysisDefinition = {
  waterwayId: 'stream-main',
  requiredSymbol: 'spring',
  toleranceTiles: 3,
  candidates: [
    { landmarkId: 'site-a', label: 'จุด A', evidenceId: 'survey-a' },
    { landmarkId: 'site-b', label: 'จุด B', evidenceId: 'survey-b' },
    { landmarkId: 'site-c', label: 'จุด C', evidenceId: 'survey-c' },
  ],
  correctLandmarkId: 'site-a',
};

export const namLaiPinTask: PinTaskDefinition = {
  targetId: 'site-analysis',
  toleranceTiles: 3,
  mustStandWithinTiles: 5,
  wisdomPrompt: 'สถานที่ที่ปักหมุดคือแหล่งน้ำประเภทใด',
  wisdomChoices: [
    { id: 'spring', label: 'ตาน้ำ (ต้นน้ำ)' },
    { id: 'weir', label: 'ฝาย' },
    { id: 'marsh', label: 'หนองน้ำ' },
  ],
  correctWisdomId: 'spring',
  requiredEvidenceIds: [],
  availableWhen: { flags: ['maps-compared'] },
  successFlag: 'pin-verified',
};

export const namLaiEnding: EndingDefinition = {
  messages: [
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ครูได้รับหมุดตำแหน่งตาน้ำต้นลำห้วยแล้ว ถูกต้องทั้งพิกัด ประเภทสถานที่ และหลักฐานการสำรวจ!',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'สัญลักษณ์แผนที่ช่วยให้อ่านพื้นที่ได้โดยไม่ต้องเห็นของจริง แต่สัญลักษณ์อาจเขียนผิดได้ จึงต้องตรวจกับสิ่งที่พบจริงเสมอ',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ทิศทางน้ำไหล: A {{elev:site-a}} ม. → B {{elev:site-b}} ม. → C {{elev:site-c}} ม. น้ำจึงไหลไปทาง{{flow:stream-main}} แม้จุด C จะอยู่ด้านบนของแผนที่',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'การเปรียบเทียบหลักฐาน: แผนที่ที่เชื่อถือได้ต้องสอดคล้องทั้งสัญลักษณ์ ระดับความสูง และจุดสังเกตที่เราไปตรวจด้วยตัวเอง',
    },
    { speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)', text: 'ครูมอบรหัสลับชิ้นที่ 2 และแผนที่ตำบลคลองน้ำไหลให้ เก็บไว้รวมกับชิ้นแรกนะ' },
  ],
  // รหัสชั่วคราว — เปลี่ยนได้ที่นี่ภายหลัง
  codePiece: { index: 2, total: 4, value: 'น้ำ' },
  rewardItem: 'แผนที่ตำบลคลองน้ำไหล',
  completeFlag: 'mission-complete',
};

export const namLaiQuests: QuestDefinition[] = [
  {
    id: 'main-namlai',
    kind: 'main',
    title: 'ปริศนาสายน้ำแห่งคลองน้ำไหล',
    description: 'ตรวจสอบข้อมูลแหล่งน้ำที่ขัดแย้งกัน แล้วระบุตำแหน่งตาน้ำต้นลำห้วยด้วยหลักฐาน',
    lockedHint: '',
    objectives: [
      { text: 'รับแผนที่ฐานสองฉบับจากครูเนม และฝึกอ่านสัญลักษณ์', done: { type: 'step', order: 1 } },
      { text: 'สำรวจชุมชนริมคลอง', done: { type: 'step', order: 2 } },
      { text: 'รับข้อมูลระดับความสูงจากผู้ดูแลแหล่งน้ำ', done: { type: 'step', order: 3 } },
      { text: 'วิเคราะห์แผนที่สองฉบับ', done: { type: 'step', order: 4 } },
      { text: 'ค้นหาจุดสำรวจที่ตรงกับหลักฐาน และปักหมุด', done: { type: 'step', order: 5 } },
      { text: 'ส่งผลและรับรหัสลับชิ้นที่ 2', done: { type: 'step', order: 6 } },
    ],
  },
  {
    id: 'side-gauges',
    kind: 'side',
    title: 'อ่านป้ายวัดระดับครบสามจุด',
    description: 'ป้าจันทร์ให้ข้อมูลระดับความสูงมาแล้ว ลองไปอ่านป้ายวัดระดับที่จุด A, B, C ด้วยตาตัวเอง',
    unlockWhen: { flags: ['flow-known'] },
    lockedHint: 'รับข้อมูลระดับความสูงจากผู้ดูแลแหล่งน้ำ',
    objectives: [
      { text: 'สำรวจจุด A', done: { type: 'flag', flag: 'surveyed-a' } },
      { text: 'สำรวจจุด B', done: { type: 'flag', flag: 'surveyed-b' } },
      { text: 'สำรวจจุด C', done: { type: 'flag', flag: 'surveyed-c' } },
    ],
    reward: { text: 'บันทึกในสมุด: ค่าที่อ่านได้จริงตรงกับข้อมูลของป้าจันทร์' },
  },
  {
    id: 'side-symbols',
    kind: 'side',
    title: 'นักอ่านสัญลักษณ์แผนที่',
    description: 'หาสถานที่จริงที่ตรงกับสัญลักษณ์บนแผนที่ฐาน',
    unlockWhen: { flags: ['got-base-maps'] },
    lockedHint: 'รับแผนที่ฐานจากครูเนม',
    objectives: [
      { text: 'สำรวจพื้นที่เกษตร', done: { type: 'discover', landmarkId: 'farmland' } },
      { text: 'สำรวจวัด', done: { type: 'discover', landmarkId: 'temple' } },
      { text: 'อ่านหมุดหลักฐานระดับ (BM) อย่างน้อย 1 หมุด', done: { type: 'clue', clueId: 'clue-bm-north' } },
    ],
    reward: { text: 'บันทึกในสมุด: สัญลักษณ์ที่ทั้งสองฉบับเขียนตรงกันใช้ยืนยันตำแหน่งได้' },
  },
  {
    id: 'mystery-jar',
    kind: 'mystery',
    title: 'ไหโบราณบนยอดเนิน',
    description: 'ใช้เส้นชั้นความสูงหา "จุดที่สูงที่สุด" ของเนินทางตะวันออก ตามเรื่องเล่าของยายหอม',
    unlockWhen: { clues: ['clue-jar'] },
    lockedHint: '??? — ฟังเรื่องเล่าของชาวบ้านหลังรู้ทิศทางน้ำไหลแล้ว',
    objectives: [{ text: 'หายอดเนินด้วยเส้นชั้นความสูง แล้วกด E ตรวจค้น', done: { type: 'flag', flag: 'jar-found' } }],
    reward: { text: 'ได้หลักฐานพิเศษ: ไหดินเผาโบราณ' },
  },
];

export const namLaiStory: StoryStep[] = [
  {
    order: 1,
    title: 'ครูเนมมอบภารกิจ',
    objective: 'คุยกับครูเนม แล้วเปิดแผนที่ (M) กด Tab ดูแผนที่ฐานฉบับ A และ B',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: {
      type: 'all',
      of: [
        { type: 'talk', npcId: 'teacher-nem' },
        { type: 'flag', flag: 'viewed-sheet-A' },
        { type: 'flag', flag: 'viewed-sheet-B' },
      ],
    },
  },
  {
    order: 2,
    title: 'สำรวจชุมชน',
    objective: 'คุยกับยายหอมและลุงเพชร แล้วเดินไปดูสะพานและฝายด้วยตัวเอง',
    landmarkId: 'village',
    status: 'playable',
    completeWhen: {
      type: 'all',
      of: [
        { type: 'talk', npcId: 'villager-hom' },
        { type: 'talk', npcId: 'farmer-phet' },
        { type: 'discover', landmarkId: 'bridge' },
        { type: 'discover', landmarkId: 'site-b' },
      ],
    },
  },
  {
    order: 3,
    title: 'พบผู้ดูแลแหล่งน้ำ',
    objective: 'คุยกับป้าจันทร์ที่ศาลาจัดการน้ำ รับข้อมูลระดับความสูง แล้วตอบว่าน้ำไหลอย่างไร',
    landmarkId: 'water-office',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'flow-known' },
  },
  {
    order: 4,
    title: 'วิเคราะห์แผนที่สองฉบับ',
    objective: 'ไปดูหินสามก้อนและจุด C ด้วยตัวเอง แล้วกด C เปรียบเทียบแผนที่ A กับ B',
    landmarkId: 'water-office',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'maps-compared' },
  },
  {
    order: 5,
    title: 'ค้นหาจุดสำรวจ',
    objective: 'เดินไปจุดที่ตรงกับหลักฐานทุกข้อ กด E สำรวจ แล้วเปิดแผนที่ (M) ปักหมุด',
    landmarkId: 'site-a',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'pin-verified' },
  },
  {
    order: 6,
    title: 'ส่งผลและรับรหัส',
    objective: 'ครูเนมสรุปผลผ่านสมุดภาคสนาม',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];
