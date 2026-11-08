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
import { answerQuiz, hearReport, openTool, pinOnMap, talkTo } from '../../guide/steps';

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
    { speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)', text: 'ครูมอบคำพิทักษ์คำที่ 2 และแผนที่ตำบลคลองน้ำไหลให้ เก็บไว้รวมกับคำแรกนะ' },
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
      { text: 'ส่งผลและรับคำพิทักษ์คำที่ 2', done: { type: 'step', order: 6 } },
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
    title: 'ส่งผลและรับคำพิทักษ์',
    objective: 'ครูเนมสรุปผลผ่านสมุดภาคสนาม',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];

/* ---------------- ขั้นย่อย (v0.19: นำทางด้วย "การกระทำ") ----------------
 * นำทางเฉพาะ NPC และสถานที่ที่แผนที่ฐานทั้งสองฉบับเขียนตรงกัน (สะพาน ฝาย จุด C)
 * ไม่นำทางไปหินสามก้อน (ตำแหน่งจริงคือหลักฐานว่าฉบับไหนถูก) และไม่บอกว่าจุดไหนคือตาน้ำ
 */
const NAMLAI_MICRO: Record<number, NonNullable<StoryStep['micro']>> = {
  1: [
    talkTo({
      id: 'talk-nem',
      npcId: 'teacher-nem',
      name: 'ครูเนม',
      where: 'ที่โรงเรียน',
      result: 'ได้แผนที่ฐานฉบับ A และ B กับเบาะแสสัญลักษณ์แผนที่ (จดลงสมุดให้เอง)',
      think: 'ข้อมูลแหล่งน้ำของตำบลขัดแย้งกันเรื่องอะไรบ้าง?',
      done: { type: 'talk', npcId: 'teacher-nem' },
      doneText: '✓ ได้แผนที่ฐานสองฉบับแล้ว!',
    }),
    {
      id: 'view-sheets',
      goal: 'เปิดดูแผนที่ฐานฉบับ A และ B',
      tools: ['แผนที่', 'ปุ่มสลับแผ่น'],
      steps: ['{tap:guide} — แผนที่จะเปิดแผ่นที่ยังไม่ได้ดูให้เอง', '{tap:sheet} เพื่อดูอีกฉบับ', 'สังเกตสัญลักษณ์ที่สองฉบับเขียนไม่เหมือนกัน แล้ว{tap:closeMap}'],
      result: 'ได้ฝึกอ่านสัญลักษณ์ — ต่อไปออกสำรวจชุมชน',
      tool: 'ความหมายของสัญลักษณ์อยู่ในกรอบ "สัญลักษณ์" (จอสัมผัสมีปุ่ม 📖 สัญลักษณ์)',
      think: 'สองฉบับเขียนตาน้ำ หนองน้ำ หินสามก้อน และทิศน้ำไหลต่างกันตรงไหน?',
      doneText: '✓ ดูแผนที่ฐานครบสองฉบับแล้ว!',
      action: 'sheets',
      actionLabel: '🗺️ แผนที่ฐาน A/B',
      done: { type: 'all', of: [{ type: 'flag', flag: 'viewed-sheet-A' }, { type: 'flag', flag: 'viewed-sheet-B' }] },
    },
  ],
  2: [
    talkTo({
      id: 'talk-hom',
      npcId: 'villager-hom',
      name: 'ยายหอม',
      where: 'ในหมู่บ้าน ทาง{{dir:school>village}}ของโรงเรียน',
      result: 'ได้เบาะแสเรื่องหินสามก้อนและสะพาน',
      think: 'ยายหอมเล่าว่าหินสามก้อนอยู่ใกล้อะไร?',
      done: { type: 'talk', npcId: 'villager-hom' },
    }),
    talkTo({
      id: 'talk-phet',
      npcId: 'farmer-phet',
      name: 'ลุงเพชร',
      where: 'ที่พื้นที่เกษตร ทาง{{dir:village>farmland}}ของหมู่บ้าน',
      result: 'ได้เบาะแสเรื่องฝาย',
      think: 'ชาวบ้านเรียกฝายว่า "ต้นน้ำของนา" — ฝายเป็นต้นน้ำของลำห้วยจริงหรือไม่?',
      done: { type: 'talk', npcId: 'farmer-phet' },
    }),
    {
      id: 'see-bridge',
      goal: 'ไปดูสะพานข้ามลำห้วยด้วยตัวเอง',
      tools: ['ลูกศรนำทาง', 'แผนที่'],
      steps: ['ดูลูกศรสีเหลืองที่ขอบจอ — ชี้ไปทางสะพาน', '{walk} ไปจนชื่อ "สะพานข้ามลำห้วย" ขึ้นบนจอ'],
      result: 'สะพานถูกบันทึกบนแผนที่สำรวจ',
      tool: 'สัญลักษณ์สะพานบนแผนที่ฐานคือเส้นคู่ขวางลำน้ำ — {tap:guide} ดูตำแหน่ง',
      think: 'สะพานบนแผนที่ฐานทั้งสองฉบับอยู่ตรงกับที่เห็นจริงไหม?',
      doneText: '✓ ไปดูสะพานแล้ว!',
      target: { landmarkId: 'bridge' },
      done: { type: 'discover', landmarkId: 'bridge' },
    },
    {
      id: 'see-weir',
      goal: 'ไปดูฝาย (จุด B) ด้วยตัวเอง',
      tools: ['ลูกศรนำทาง', 'แผนที่'],
      steps: ['ดูลูกศรสีเหลืองที่ขอบจอ — ชี้ไปทางฝาย', '{walk} ไปจนชื่อ "จุด B ฝายกั้นลำห้วย" ขึ้นบนจอ'],
      result: 'ฝายถูกบันทึกบนแผนที่สำรวจ — ต่อไปพบผู้ดูแลแหล่งน้ำ',
      tool: 'ฝายอยู่บนลำห้วย แผนที่ฐานทั้งสองฉบับเขียนตรงกัน — {tap:guide} ดูตำแหน่ง',
      think: 'ฝายกั้นลำห้วยไว้ทำอะไร?',
      doneText: '✓ ไปดูฝายแล้ว!',
      target: { landmarkId: 'site-b' },
      done: { type: 'discover', landmarkId: 'site-b' },
    },
  ],
  3: [
    talkTo({
      id: 'talk-jan',
      npcId: 'water-keeper',
      name: 'ป้าจันทร์',
      goal: 'ไปพบป้าจันทร์ที่ศาลาจัดการน้ำ',
      where: 'ที่ศาลาจัดการน้ำชุมชน ใกล้หมู่บ้าน',
      result: 'ได้ค่าระดับความสูงของจุด A B C แล้วป้าจันทร์จะถามคำถาม',
      think: 'ค่าระดับความสูงบอกอะไรเกี่ยวกับการไหลของน้ำ?',
      done: { type: 'clue', clueId: 'clue-elev-abc' },
      impliedByLater: true,
    }),
    answerQuiz({
      id: 'quiz-flow',
      npcId: 'water-keeper',
      name: 'ป้าจันทร์',
      goal: 'ตอบคำถามเรื่องทิศทางน้ำไหล',
      result: 'รู้ว่าน้ำไหลทางไหน — ต่อไปไปดูจุด C และหินสามก้อนด้วยตัวเอง',
      tool: '{tap:notebook} ดูค่าระดับความสูงของจุด A B C ที่ป้าจันทร์บอก',
      think: 'น้ำไหลจากที่สูงไปที่ต่ำ — จุดไหนสูงที่สุด และจุดไหนต่ำที่สุด?',
      done: { type: 'flag', flag: 'flow-known' },
    }),
  ],
  4: [
    {
      id: 'see-c',
      goal: 'ไปดูจุด C ด้วยตัวเอง',
      tools: ['ลูกศรนำทาง', 'แผนที่'],
      steps: ['จุด C อยู่ทาง{{dir:village>site-c}}ของหมู่บ้าน (แผนที่ฐานทั้งสองฉบับเขียนตำแหน่งตรงกัน) — ดูลูกศรสีเหลือง', '{walk} ไปจนชื่อจุด C ขึ้นบนจอ', 'สังเกตว่าที่จุด C เป็นตาน้ำหรือหนองน้ำ'],
      result: 'บันทึกสิ่งที่เห็นที่จุด C',
      tool: '{tap:map} แล้ว{tap:sheet} เทียบสิ่งที่เห็นกับสัญลักษณ์ของจุด C ในแผนที่ฐานแต่ละฉบับ',
      think: 'สิ่งที่เห็นจริงที่จุด C ตรงกับสัญลักษณ์ของฉบับไหน?',
      doneText: '✓ ไปดูจุด C แล้ว!',
      target: { landmarkId: 'site-c' },
      done: { type: 'discover', landmarkId: 'site-c' },
    },
    {
      id: 'see-stones',
      goal: 'ตรวจว่าหินสามก้อนอยู่ที่ไหนจริง',
      tools: ['แผนที่ฐาน', 'แผนที่'],
      steps: ['{tap:guide} ดูว่าฉบับ A และ B เขียนหินสามก้อนไว้ตรงไหน', '{walk} ไปดูตำแหน่งที่แต่ละฉบับเขียน', 'เมื่อพบหินจริง ชื่อ "หินใหญ่สามก้อน" จะขึ้นบนจอ'],
      result: 'รู้แล้วว่าหินสามก้อนอยู่ตรงไหนจริง — ต่อไปเปิดหน้าเทียบแผนที่',
      tool: 'ยายหอมเล่าเรื่องหินสามก้อน — {tap:notebook} อ่านเบาะแสของยายหอมอีกครั้ง',
      think: 'แผนที่ฉบับไหนเขียนหินสามก้อนตรงกับที่เห็นจริง?',
      doneText: '✓ พบหินสามก้อนแล้ว!',
      action: 'sheets',
      actionLabel: '🗺️ แผนที่ฐาน A/B',
      done: { type: 'discover', landmarkId: 'three-stones' },
    },
    openTool({
      id: 'open-compare',
      goal: 'เปิดหน้าเทียบแผนที่',
      button: 'compare',
      look: ['ดูแผนที่ฐานฉบับ A และ B ทีละฉบับ', 'อ่านรายการที่ต้องตรวจ: สัญลักษณ์ · ทิศน้ำไหลกับความสูง · สิ่งที่เห็นจริง'],
      result: 'เมื่อเปิดแล้ว ขั้นต่อไปคือเลือกฉบับที่เชื่อถือได้',
      tool: 'ปุ่มเทียบแผนที่ใช้ได้เมื่อมีแผนที่ฐานครบสองฉบับ',
      think: 'ถ้าสองฉบับขัดกัน เราจะเชื่อฉบับไหน และเพราะอะไร?',
      done: { type: 'flag', flag: 'opened:compare' },
      doneText: '✓ เปิดหน้าเทียบแผนที่แล้ว!',
      impliedByLater: true,
    }),
    {
      id: 'choose-sheet',
      goal: 'เลือกแผนที่ฐานที่เชื่อถือได้',
      tools: ['หน้าเทียบแผนที่'],
      steps: ['{tap:guide}', 'เทียบแต่ละฉบับกับความสูง ทิศน้ำไหล และสิ่งที่เห็นจริง', '{choose}ฉบับที่ตรงทุกข้อ'],
      result: 'ถ้าตรงทุกข้อ ไปขั้นค้นหาจุดสำรวจ · ถ้ายังไม่ตรง หน้าจอบอกว่าข้อใดขัดแย้ง แล้วเลือกใหม่ได้',
      tool: 'ถ้ายังเลือกไม่ได้ หน้าจอจะบอกว่าต้องไปดูที่ใดด้วยตัวเองก่อน',
      think: 'น้ำไหลจากที่สูงไปที่ต่ำ — ลูกศรทิศน้ำไหลของฉบับไหนตรงกับค่าความสูง?',
      doneText: '✓ เลือกแผนที่ที่เชื่อถือได้แล้ว!',
      action: 'compare',
      actionLabel: '🔍 เลือกฉบับ',
      done: { type: 'flag', flag: 'maps-compared' },
    },
  ],
  5: [
    {
      id: 'survey-site',
      goal: 'เดินไปจุดที่ตรงกับหลักฐาน แล้วสำรวจ',
      tools: ['แผนที่ฐานที่เลือก', 'ปุ่มสำรวจ'],
      steps: ['{tap:guide} ดูแผนที่ฐานฉบับที่เลือก ว่าจุดไหนเขียนเป็นตาน้ำ', '{walk} ไปที่จุดนั้น', 'เมื่อปุ่ม "สำรวจ" ขึ้น {tap:inspect}'],
      result: 'บันทึกสำรวจจุดนั้นลงสมุด — ต่อไปปักหมุด',
      tool: 'ต้นน้ำของลำห้วยต้องเป็นจุดที่สูงที่สุด — {tap:notebook} ดูค่าความสูงของ A B C',
      think: 'จุดไหนเป็นทั้ง "จุดที่สูงที่สุด" และ "ตาน้ำ" ตามแผนที่ที่เชื่อถือได้?',
      doneText: '✓ สำรวจแล้ว!',
      action: 'sheets',
      actionLabel: '🗺️ เปิดแผนที่ฐาน',
      done: { type: 'any', of: [{ type: 'flag', flag: 'surveyed-a' }, { type: 'flag', flag: 'surveyed-b' }, { type: 'flag', flag: 'surveyed-c' }] },
      impliedByLater: true,
    },
    pinOnMap({
      id: 'pin',
      place: 'จุดที่สำรวจ',
      kind: 'ประเภทแหล่งน้ำ',
      think: 'จุดที่ปักเป็นแหล่งน้ำประเภทใด ตามสิ่งที่เห็นจริงและแผนที่ที่เชื่อถือได้?',
      done: { type: 'flag', flag: 'pin-verified' },
    }),
  ],
  6: [hearReport({ id: 'report', code: 'คำพิทักษ์คำที่ 2', done: { type: 'flag', flag: 'mission-complete' } })],
};
for (const st of namLaiStory) if (NAMLAI_MICRO[st.order]) st.micro = NAMLAI_MICRO[st.order];
