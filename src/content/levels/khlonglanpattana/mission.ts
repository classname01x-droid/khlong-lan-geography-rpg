import type {
  ClueDefinition,
  EndingDefinition,
  EvidenceDefinition,
  InspectPoint,
  IntegratedSiteAnalysisDefinition,
  PinTaskDefinition,
  QuestDefinition,
  QuizDefinition,
  StoryStep,
} from '../../types';

/**
 * ภารกิจด่านคลองลานพัฒนา (ด่านสุดท้าย) — บูรณาการ:
 *   ด่าน 1 มาตราส่วน ทิศ ระยะเส้นตรง/ตามถนน · ด่าน 2 สัญลักษณ์ ความสูง ทิศน้ำไหล · ด่าน 3 พิกัด E/N และหมุดอ้างอิง
 * เล่นได้ครบ 7 ฉาก: ภารกิจ → หมุดอ้างอิง/ระยะทาง → ภูมิประเทศ/ทิศน้ำไหล → พิกัด E/N → กระดานวิเคราะห์ (C)
 *   → ยืนยันภาคสนาม + ปักหมุด + บันทึกภูมิปัญญา → รายงานครูเนม (รหัสชิ้นที่ 4) → บทที่ 5
 *
 * หมายเหตุ: แหล่งเรียนรู้และเนื้อหาภูมิปัญญาในด่านนี้เป็น "ข้อมูลจำลอง" ทั้งหมด
 */

export const lanQuizzes: QuizDefinition[] = [
  {
    id: 'scale-review',
    speaker: 'ครูเนม',
    question: 'แผนที่มาตราส่วน 1:10,000 วัดได้ 4 ซม. คิดเป็นระยะจริงเท่าไร?',
    choices: [
      { id: '40', label: '40 เมตร', hint: '1:10,000 หมายถึง 1 ซม. บนแผนที่ = 10,000 ซม. = 100 ม. ในพื้นที่จริง' },
      { id: '400', label: '400 เมตร' },
      { id: '4000', label: '4,000 เมตร', hint: 'ลองแปลงหน่วยอีกครั้ง: 10,000 ซม. เท่ากับกี่เมตร?' },
    ],
    correctChoiceId: '400',
    fallbackHint: '1 ซม. บนแผนที่ = 100 ม.',
    correctFeedback: 'ถูกต้อง! 1 ซม. = 100 ม. ดังนั้น 4 ซม. = 400 ม.',
    effects: [{ type: 'flag', flag: 'mission-accepted' }],
  },
  {
    // ตัวเลือกคำนวณจากแผนที่: เส้นตรง (ถูก) / ระยะตามถนน / แปลงมาตราส่วนผิด
    id: 'rp-distance',
    speaker: 'พี่ต้นกล้า (อาสาสำรวจ)',
    question: 'ศูนย์ภาคสนามถึงชุมชน บนแผนที่ห่าง {{mapcm:center>village}} ซม. ระยะ "เส้นตรง" ในพื้นที่จริงประมาณเท่าไร?',
    choices: [
      { id: 'road', label: '{{road:center>village}} เมตร', hint: 'นี่คือระยะเดินตามถนน (ออกถนนใหญ่แล้วเลี้ยวเข้าชุมชน) ไม่ใช่ระยะเส้นตรง' },
      { id: 'straight', label: '{{dist:center>village}} เมตร' },
      { id: 'tenth', label: '{{dist:center>village*0.1}} เมตร', hint: '1 ซม. บนแผนที่ 1:10,000 = 100 ม. ไม่ใช่ 10 ม.' },
    ],
    correctChoiceId: 'straight',
    fallbackHint: 'ระยะเส้นตรง = ระยะบนแผนที่ (ซม.) × 100 ม.',
    correctFeedback: 'ถูกต้อง! เส้นตรง {{dist:center>village}} ม. แต่เดินตามถนนจริง {{road:center>village}} ม. — ต้องแยกสองค่านี้เสมอ',
    effects: [{ type: 'flag', flag: 'distance-ok' }],
  },
  {
    id: 'flow-4',
    speaker: 'ป้าบัวลอย (ผู้ดูแลลำน้ำ)',
    question: 'จากระดับความสูงของสองป้าย ลำน้ำคลองลานไหลไปทางใด?',
    choices: [
      { id: 'n', label: 'ไหลไปทางทิศเหนือ', hint: 'น้ำไหลจากที่สูงไปที่ต่ำ ป้ายทางเหนือสูงกว่า น้ำจึงไหลออกจากทางเหนือ' },
      { id: 's', label: 'ไหลไปทางทิศใต้' },
      { id: 'e', label: 'ไหลไปทางทิศตะวันออก', hint: 'ดูแนวลำน้ำบนแผนที่ (M) ลำน้ำทอดตัวเหนือ–ใต้ แล้วเทียบระดับความสูงสองป้าย' },
    ],
    correctChoiceId: 's',
    fallbackHint: 'น้ำไหลจากที่สูงไปที่ต่ำ',
    correctFeedback: 'ถูกต้อง! {{elev:bm-up}} ม. → {{elev:bm-down}} ม. น้ำไหลไปทาง{{flow:stream-main}} ต้นน้ำจึงอยู่ทางเหนือของสะพาน',
    verifyFlowOf: 'stream-main',
    effects: [{ type: 'flag', flag: 'flow-ok' }],
  },
];

/** ฉาก 4: คำนวณพิกัดจากหมุดอ้างอิง (ตัวเลือกคำนวณจากหมุดและบันทึก) */
lanQuizzes.push(
  {
    id: 'grid-n',
    speaker: 'ลุงจำรัส (ผู้เก็บบันทึกพิกัด)',
    question: 'หมุด RP-2 อยู่ที่ {{grid:rp-2}} บันทึกบอกว่าแหล่งเรียนรู้อยู่ "เหนือ RP-2 ขึ้นไป {{ia:dn}} ม." ค่า N ของแหล่งเรียนรู้คือข้อใด?',
    choices: [
      { id: 'minus', label: '{{ia:nminus}}', hint: 'ไปทางเหนือ ค่า N ต้อง "เพิ่ม" ไม่ใช่ลด (แกน y ของจอเท่านั้นที่ลดลงเมื่อขึ้นด้านบน)' },
      { id: 'n', label: '{{ia:n}}' },
      { id: 'e', label: '{{ia:eplus}}', hint: 'ไปทางเหนือ ค่าที่เปลี่ยนคือ N — ค่า E เปลี่ยนเมื่อไปทางตะวันออก/ตะวันตกเท่านั้น' },
    ],
    correctChoiceId: 'n',
    fallbackHint: 'N ของ RP-2 + ระยะที่ไปทางเหนือ',
    correctFeedback: 'ถูกต้อง! N ของ RP-2 + {{ia:dn}} = {{ia:n}}',
    effects: [{ type: 'flag', flag: 'grid-n-ok' }],
  },
  {
    id: 'grid-e',
    speaker: 'ลุงจำรัส (ผู้เก็บบันทึกพิกัด)',
    question: 'ค่า E ในบันทึกเลือนอ่านได้แค่ {{ia:emask}} — จะใช้ตัวเลขนี้อย่างไร?',
    choices: [
      { id: 'zero', label: 'ถือว่า "?" เป็น 0 แล้วไปที่ค่านั้นเลย', hint: '"?" คือตัวเลขที่อ่านไม่ออก อาจเป็น 0–9 ก็ได้ เดาเป็น 0 อาจพาไปผิดที่' },
      { id: 'useless', label: 'ใช้ไม่ได้เลย เพราะตัวเลขเสียหาย', hint: 'ตัวเลขที่เหลือยังใช้ตัดจุดที่ไม่ตรงออกได้ เช่น หลักร้อยและหลักหน่วยต้องตรง' },
      { id: 'filter', label: 'ใช้ตัดจุดที่ไม่ตรงออก: ตัวเลขที่อ่านได้ต้องตรงทุกหลัก แล้วใช้หลักฐานอื่นช่วยแยกที่เหลือ' },
    ],
    correctChoiceId: 'filter',
    fallbackHint: 'ตัวเลขที่อ่านได้ยังมีประโยชน์',
    correctFeedback: 'ถูกต้อง! พิกัดที่เสียหายบางส่วนยังใช้คัดกรองได้ แต่ต้องใช้หลักฐานอื่นร่วมด้วย',
    effects: [{ type: 'flag', flag: 'grid-read' }],
  },
);

export const lanClues: ClueDefinition[] = [
  {
    id: 'clue-mission',
    type: 'landmark',
    source: 'ครูเนม',
    text: 'แผนที่ภูมิปัญญาที่เสียหายระบุแหล่งเรียนรู้ชุมชนแห่งสุดท้าย (ข้อมูลจำลอง) — ต้องใช้หลักฐานระยะทาง ภูมิประเทศ และพิกัดร่วมกัน',
  },
  { id: 'clue-rps', type: 'landmark', source: 'ครูเนม', text: 'หมุดอ้างอิงพิกัด 3 หมุด (RP-1, RP-2, RP-3) มีพิกัดตอกไว้ ใช้เทียบพิกัดและวัดระยะ' },
  { id: 'clue-rp-1', type: 'coordinate', source: 'หมุด RP-1', text: 'พิกัดบนหมุด: {{grid:rp-1}}' },
  { id: 'clue-rp-2', type: 'coordinate', source: 'หมุด RP-2', text: 'พิกัดบนหมุด: {{grid:rp-2}}' },
  { id: 'clue-rp-3', type: 'coordinate', source: 'หมุด RP-3', text: 'พิกัดบนหมุด: {{grid:rp-3}}' },
  {
    id: 'clue-straight-road',
    type: 'distance',
    source: 'พี่ต้นกล้า',
    text: 'ศูนย์ภาคสนาม → ชุมชน: เส้นตรง {{dist:center>village}} ม. ({{mapcm:center>village}} ซม. บนแผนที่) แต่ตามถนน {{road:center>village}} ม.',
  },
  // ---- หลักฐานรวม 3 ชนิด (ฉาก 2, 3, 4) — ตัวเลขมาจาก integratedSiteAnalysis ด้านล่าง ----
  {
    id: 'clue-distance',
    type: 'distance',
    source: 'แผนที่ที่เสียหาย (พี่ต้นกล้าอ่านให้)',
    text: 'จากสะพาน ไปทาง{{ia:dir}} · เส้นตรงราว {{ia:straight}} ม. · เดินตามถนนราว {{ia:road}} ม.',
  },
  { id: 'clue-elev', type: 'elevation', source: 'ป้าบัวลอย', text: 'ป้ายวัดระดับทางเหนือ {{elev:bm-up}} ม. · ทางใต้ {{elev:bm-down}} ม.' },
  {
    id: 'clue-terrain',
    type: 'symbol',
    source: 'แผนที่ที่เสียหาย (ป้าบัวลอยอ่านให้)',
    text: 'สัญลักษณ์ศาลา/อาคาร · บนเนินสูงกว่า {{ia:minelev}} ม. · อยู่ทางต้นน้ำของสะพาน',
  },
  {
    // ฉาก 4: ลุงจำรัสให้หลักฐานนี้
    id: 'clue-grid',
    type: 'coordinate',
    source: 'บันทึกพิกัด (ลุงจำรัส)',
    text: 'อยู่เหนือหมุด RP-2 ขึ้นไป {{ia:dn}} ม. (N = {{ia:n}}) · ค่า E เลือนอ่านได้แค่ {{ia:emask}} ("?" = ตัวเลขที่เสียหาย)',
  },
];

export const lanEvidence: EvidenceDefinition[] = [
  { id: 'damaged-map', name: 'แผนที่ภูมิปัญญาที่เสียหาย', description: 'แผนที่ 1:10,000 ที่ข้อมูลบางส่วนเลือน (ข้อมูลจำลอง)' },
  { id: 'grid-record', name: 'บันทึกพิกัดจากแผนที่ที่เสียหาย', description: 'N จากหมุด RP-2 และค่า E ที่อ่านได้บางหลัก' },
  { id: 'survey-a', name: 'บันทึกสำรวจจุด A', description: 'สิ่งที่พบจริงที่จุด A' },
  { id: 'survey-b', name: 'บันทึกสำรวจจุด B', description: 'สิ่งที่พบจริงที่จุด B' },
  { id: 'survey-c', name: 'บันทึกสำรวจจุด C', description: 'สิ่งที่พบจริงที่จุด C' },
  {
    id: 'wisdom-record',
    name: 'บันทึกข้อมูลภูมิปัญญา (ข้อมูลจำลอง)',
    description: 'ข้อมูลแหล่งเรียนรู้ชุมชนแห่งสุดท้าย — เรื่องราวสมมติเพื่อการเรียนรู้ ต้องตรวจกับชุมชนจริงก่อนใช้สอน',
  },
];

const readRp = (n: 1 | 2 | 3, at: { x: number; y: number }): InspectPoint => ({
  id: `rp-${n}-read`,
  at,
  radiusTiles: 1.6,
  when: { minStep: 2, notFlags: [`read-rp-${n}`] },
  nodes: [
    {
      speaker: `หมุดอ้างอิงพิกัด RP-${n}`,
      text: `ตัวเลขบนหมุด: {{grid:rp-${n}}} — เทียบกับพิกัดของตัวเองที่มุมซ้ายบนจอ`,
      effects: [
        { type: 'clue', clueId: `clue-rp-${n}` },
        { type: 'flag', flag: `read-rp-${n}` },
      ],
    },
  ],
});

/** ฉาก 5: สำรวจจุดจริงก่อนตัดสินบนกระดานวิเคราะห์ (ต้องสำรวจจุดที่เลือกก่อนจึงยืนยันได้) */
const survey = (id: 'a' | 'b' | 'c', at: { x: number; y: number }, text: string): InspectPoint => ({
  id: `survey-${id}`,
  at,
  radiusTiles: 2.5,
  when: { minStep: 5, notFlags: [`surveyed-${id}`] },
  nodes: [
    {
      speaker: `สมุดภาคสนาม — จุด ${id.toUpperCase()}`,
      text: `${text} · พิกัดตรงนี้ {{grid:site-${id}}}`,
      effects: [
        { type: 'evidence', evidenceId: `survey-${id}` },
        { type: 'flag', flag: `surveyed-${id}` },
      ],
    },
  ],
});

export const lanInspectPoints: InspectPoint[] = [
  readRp(1, { x: 21, y: 39 }),
  readRp(2, { x: 50, y: 48 }),
  readRp(3, { x: 71, y: 39 }),
  survey('a', { x: 24, y: 24 }, 'อาคารบนเนินตะวันตก ปิดเงียบ ไม่มีป้าย'),
  survey('b', { x: 64, y: 24 }, 'อาคารบนเนินตะวันออก มีป้ายไม้เลือน ๆ ว่า "ศูนย์เรียนรู้" (ข้อมูลจำลอง)'),
  survey('c', { x: 60, y: 19 }, 'วัดเล็กบนเนินตะวันออก'),
];

/**
 * จุดเป้าหมาย 3 แห่ง — หลักฐานแต่ละชนิดชี้ได้ 2 จุดเสมอ (validateLevel ตรวจ) จึงตอบจากหลักฐานข้อเดียวไม่ได้:
 *   ระยะทาง  (สะพาน → NE, เส้นตรง ~310, ตามถนน ~430)  : B, C
 *   ภูมิประเทศ (ศาลา/อาคาร, > 160 ม., ต้นน้ำของสะพาน) : A, B
 *   พิกัด     (N = RP-2 + 250, E = 5,?40)               : A, B
 * จุดที่ผ่านทุกข้อคำนวณจากโลกเกม (ไม่ได้กำหนดตายตัว)
 */
export const lanIntegratedAnalysis: IntegratedSiteAnalysisDefinition = {
  distance: { fromId: 'bridge', direction: 'NE', straightMeters: 310, roadMeters: 430, toleranceMeters: 30 },
  terrain: { symbol: 'office', minElevationMeters: 160, waterwayId: 'stream-main', relation: 'upstream', ofId: 'bridge' },
  grid: { fromId: 'rp-2', dN: 250, eMask: '5,?40', toleranceMeters: 20 },
  symbolLabels: { office: 'ศาลา/อาคาร', temple: 'วัด' },
  candidates: [
    { landmarkId: 'site-a', label: 'จุด A', evidenceId: 'survey-a' },
    { landmarkId: 'site-b', label: 'จุด B', evidenceId: 'survey-b' },
    { landmarkId: 'site-c', label: 'จุด C', evidenceId: 'survey-c' },
  ],
  correctLandmarkId: 'site-b',
  placeType: 'learning-center',
  requiredClueIds: ['clue-distance', 'clue-terrain', 'clue-grid'],
  availableWhen: { minStep: 5 },
  successFlag: 'analysis-done',
  // ฉาก 6: กด E ที่จุดที่วิเคราะห์ได้ → ตรวจหลักฐาน 3 ชนิดอีกครั้ง ณ ที่จริง แล้วบันทึกข้อมูลภูมิปัญญา
  verify: {
    radiusTiles: 3,
    when: { flags: ['analysis-done'] },
    evidenceId: 'wisdom-record',
    flag: 'site-verified',
    recordText:
      'ศูนย์เรียนรู้ภูมิปัญญาชุมชน (ข้อมูลจำลอง) — สอนการทำฝายชะลอน้ำและการปลูกพืชตามแนวระดับบนที่ลาด (เรื่องสมมติเพื่อการเรียนรู้)',
  },
};

/** ฉาก 6: ปักหมุด — ต้องยืนใกล้ ตำแหน่งตรงจุดที่วิเคราะห์ได้ ประเภทถูก และมีบันทึกข้อมูลภูมิปัญญา (จากการตรวจยืนยัน) */
export const lanPinTask: PinTaskDefinition = {
  targetId: 'site-analysis',
  toleranceTiles: 2,
  mustStandWithinTiles: 5,
  wisdomPrompt: 'สถานที่ที่ปักหมุดคืออะไร',
  wisdomChoices: [
    { id: 'temple', label: 'วัด' },
    { id: 'learning-center', label: 'ศูนย์เรียนรู้ภูมิปัญญาชุมชน (ข้อมูลจำลอง)' },
    { id: 'storehouse', label: 'โรงเก็บอุปกรณ์การเกษตร' },
  ],
  correctWisdomId: 'learning-center',
  requiredEvidenceIds: ['wisdom-record'],
  problemHints: {
    far: 'ต้องยืนใกล้ตำแหน่งที่จะปัก (ไม่เกิน 50 ม.) — เดินไปที่จุดนั้นก่อน',
    unexplored: 'ตำแหน่งที่ปักยังอยู่ในหมอก ต้องเดินไปสำรวจก่อน',
    location: 'ตำแหน่งที่ปักยังไม่ตรงกับจุดที่วิเคราะห์ได้ — ตรวจระยะทาง ภูมิประเทศ และพิกัดอีกครั้ง',
    wisdom: 'ประเภทสถานที่ยังไม่ถูก — ทบทวนสัญลักษณ์บนแผนที่ที่เสียหาย',
    evidence: 'ยังขาดหลักฐาน',
  },
  availableWhen: { flags: ['analysis-done'] },
  successFlag: 'pin-verified',
};

/** ฉาก 7: รายงานครูเนม — รหัสชิ้นที่ 4 เก็บในข้อมูลด่าน (เปลี่ยนได้ภายหลัง) แล้วเข้าสู่บทที่ 5 */
export const lanEnding: EndingDefinition = {
  messages: [
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ครูได้รับรายงานแล้ว! แหล่งเรียนรู้แห่งสุดท้ายอยู่ที่ {{grid:site-analysis}} ตรงทั้งระยะทาง ภูมิประเทศ และพิกัด',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ระยะทาง: จากสะพานเส้นตรงราว {{ia:straight}} ม. แต่ตามถนนราว {{ia:road}} ม. — สองค่านี้ต่างกันเสมอเมื่อถนนต้องอ้อม',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ภูมิประเทศ: น้ำไหลจากที่สูงไปที่ต่ำ ต้นน้ำจึงอยู่ทางเหนือของสะพาน และสัญลักษณ์แผนที่แยกศาลา/อาคารออกจากวัดได้',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'พิกัด: N ของหมุด RP-2 + {{ia:dn}} ม. = {{ia:n}} และตัวเลข E ที่อ่านได้บางส่วนยังใช้คัดกรองได้',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'หลักฐานแต่ละชนิดชี้ได้มากกว่าหนึ่งจุด ต้องใช้ทั้งสามร่วมกันจึงเหลือจุดเดียว — นี่คือหัวใจของการบูรณาการ',
    },
    { speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)', text: 'ครูมอบรหัสลับชิ้นที่ 4 ให้ ครบ 4 ชิ้นแล้ว! กลับมาพบครูที่โรงเรียนบ้านสักงามเพื่อไขปริศนาสุดท้ายนะ' },
  ],
  // รหัสชั่วคราว — เปลี่ยนได้ที่นี่ภายหลัง
  codePiece: { index: 4, total: 4, value: 'ลาน' },
  rewardItem: 'แผนที่ตำบลคลองลานพัฒนา',
  completeFlag: 'mission-complete',
};

export const lanQuests: QuestDefinition[] = [
  {
    id: 'main-lan',
    kind: 'main',
    title: 'ปริศนาแผนที่ลับแห่งคลองลานพัฒนา',
    description: 'ใช้หลักฐานระยะทาง ภูมิประเทศ และพิกัด ระบุตำแหน่งแหล่งเรียนรู้ชุมชนแห่งสุดท้าย (ข้อมูลจำลอง)',
    lockedHint: '',
    objectives: [
      { text: 'รับภารกิจแผนที่ลับจากครูเนม', done: { type: 'step', order: 1 } },
      { text: 'สำรวจหมุดอ้างอิงและคำนวณระยะทาง', done: { type: 'step', order: 2 } },
      { text: 'ตรวจสัญลักษณ์ภูมิประเทศและทิศทางน้ำไหล', done: { type: 'step', order: 3 } },
      { text: 'ตรวจสอบพิกัด E/N จากบันทึก', done: { type: 'step', order: 4 } },
      { text: 'วิเคราะห์จุดเป้าหมายทั้งสามแห่ง (กด C)', done: { type: 'step', order: 5 } },
      { text: 'ยืนยันสถานที่ ปักหมุด และบันทึกข้อมูลภูมิปัญญา', done: { type: 'step', order: 6 } },
      { text: 'ส่งรายงานและรับรหัสชิ้นที่ 4', done: { type: 'step', order: 7 } },
    ],
  },
  {
    id: 'side-roads',
    kind: 'side',
    title: 'สำรวจโครงข่ายถนน',
    description: 'เดินสำรวจสี่แยกทางขึ้นเนินและถนนเลียบพื้นที่เกษตร เพื่อเข้าใจว่าทำไมระยะตามถนนจึงยาวกว่าเส้นตรง',
    unlockWhen: { clues: ['clue-straight-road'] },
    lockedHint: 'คุยกับพี่ต้นกล้าที่สะพาน',
    objectives: [
      { text: 'เดินไปถึงสี่แยกทางขึ้นเนิน', done: { type: 'discover', landmarkId: 'junction' } },
      { text: 'เดินไปถึงพื้นที่เกษตร', done: { type: 'discover', landmarkId: 'farm' } },
    ],
    reward: { text: 'บันทึกในสมุด: รู้จักโครงข่ายถนนของตำบล' },
  },
  {
    id: 'mystery-levels',
    kind: 'mystery',
    title: 'ป้ายวัดระดับสองป้าย',
    description: 'ป้าบัวลอยบอกค่าระดับความสูงของสองป้าย — เดินไปดูป้ายทั้งสองด้วยตัวเองว่าอยู่ต้นน้ำหรือปลายน้ำจริง',
    unlockWhen: { clues: ['clue-elev'] },
    lockedHint: 'คุยกับป้าบัวลอยริมลำน้ำ',
    objectives: [
      { text: 'เดินไปถึงป้ายวัดระดับทางเหนือ', done: { type: 'discover', landmarkId: 'bm-up' } },
      { text: 'เดินไปถึงป้ายวัดระดับทางใต้', done: { type: 'discover', landmarkId: 'bm-down' } },
    ],
    reward: { text: 'บันทึกในสมุด: ยืนยันทิศน้ำไหลด้วยการสำรวจจริง' },
  },
];

export const lanStory: StoryStep[] = [
  {
    order: 1,
    title: 'ครูเนมมอบภารกิจแผนที่ลับ',
    objective: 'คุยกับครูเนม รับแผนที่ภูมิปัญญาที่เสียหาย และทบทวนมาตราส่วน',
    landmarkId: 'center',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-accepted' },
  },
  {
    order: 2,
    title: 'สำรวจจุดอ้างอิงและคำนวณระยะทาง',
    objective: 'อ่านหมุด RP-1, RP-2, RP-3 (กด E) และคุยกับพี่ต้นกล้าที่สะพานเรื่องระยะเส้นตรง/ตามถนน',
    landmarkId: 'bridge',
    status: 'playable',
    completeWhen: {
      type: 'all',
      of: [
        { type: 'flag', flag: 'read-rp-1' },
        { type: 'flag', flag: 'read-rp-2' },
        { type: 'flag', flag: 'read-rp-3' },
        { type: 'flag', flag: 'distance-ok' },
      ],
    },
  },
  {
    order: 3,
    title: 'ตรวจสัญลักษณ์และทิศทางน้ำไหล',
    objective: 'คุยกับป้าบัวลอยริมลำน้ำ อ่านระดับความสูง หาทิศน้ำไหล และฟังเรื่องสัญลักษณ์บนแผนที่ที่เสียหาย',
    landmarkId: 'bm-up',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'flow-ok' },
  },
  {
    order: 4,
    title: 'ตรวจสอบพิกัด E/N จากบันทึก',
    objective: 'คุยกับลุงจำรัสในชุมชน ฟังบันทึกพิกัด แล้วคำนวณ N จากหมุด RP-2 และอ่านค่า E ที่เลือน',
    landmarkId: 'village',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'grid-read' },
  },
  {
    order: 5,
    title: 'วิเคราะห์จุดเป้าหมายทั้งสามแห่ง',
    objective: 'เดินสำรวจจุด A, B, C (กด E) แล้วกด C เปิดกระดานวิเคราะห์หลักฐาน เลือกจุดที่ตรงหลักฐานครบ 3 ชนิด',
    landmarkId: 'bridge',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'analysis-done' },
  },
  {
    order: 6,
    title: 'ยืนยันสถานที่และบันทึกข้อมูล',
    objective: 'เดินไปจุดที่วิเคราะห์ได้ กด E ตรวจยืนยันและบันทึกภูมิปัญญา แล้วเปิดแผนที่ (M) ปักหมุด เลือกประเภทสถานที่',
    landmarkId: 'site-b',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'pin-verified' },
  },
  {
    order: 7,
    title: 'ส่งรายงานและรับรหัสชิ้นที่ 4',
    objective: 'ครูเนมสรุปผลผ่านสมุดภาคสนาม',
    landmarkId: 'center',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];
