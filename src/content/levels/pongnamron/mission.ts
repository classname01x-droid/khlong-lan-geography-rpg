import type {
  ClueDefinition,
  EndingDefinition,
  EvidenceDefinition,
  QuestDefinition,
  QuizDefinition,
  SettlementAnalysisDefinition,
  StoryStep,
} from '../../types';
import { answerQuiz, hearReport, talkTo } from '../../guide/steps';

/**
 * ภารกิจบทที่ 3 (โป่งน้ำร้อน) — "ปริศนาเมืองโบราณใต้ผืนดิน" (6 ฉาก · รหัสลับชิ้นที่ 3 = "พิกัด")
 *
 *   ฉาก 1  รับเอกสารเกณฑ์วิเคราะห์และแผนที่ภูมิประเทศจากครูเนม
 *   ฉาก 2  เรียนเส้นชั้นความสูงและความลาดชันกับลุงสอน · ถามข้อมูลแหล่งน้ำกับป้าจันทร์
 *   ฉาก 3  วิเคราะห์พื้นที่: แตะเลือกบนแผนที่ → วงกลมวิเคราะห์ → คำนวณคะแนนจากแบบจำลองความสูงจริง
 *   ฉาก 4  คะแนนไม่ผ่าน → กลับไปเรียนเฉพาะหัวข้อที่ผิดกับลุงสอน/ครูเนม แล้ววิเคราะห์ใหม่ (ผ่านตั้งแต่ครั้งแรก = ข้าม)
 *   ฉาก 5  เดินทางไปตรวจสอบพื้นที่ที่เลือกและหาหลักฐานภาคสนามกับพี่เขียว
 *   ฉาก 6  ครูเนมสรุปผล · รับรหัส "พิกัด" · ปลดล็อกบทที่ 4
 *
 * เรื่องเมืองโบราณเป็นสถานการณ์จำลองเพื่อการเรียนรู้ ไม่ใช่ประวัติศาสตร์จริง — คะแนนคือความเหมาะสมตามเกณฑ์จำลอง
 * ไม่มีตำแหน่งคำตอบเขียนไว้ในเนื้อหา: คะแนนทุกครั้งคำนวณจากภูมิประเทศ (core/site/SettlementAnalysis.ts)
 */

/* ---------------- เกณฑ์วิเคราะห์ความเหมาะสม (ข้อมูลของด่าน) ---------------- */

export const pongSettlement: SettlementAnalysisDefinition = {
  radiusTiles: 4,
  // ความลาดชัน 40 · ความสูงเหนือน้ำ 20 + ลักษณะพื้นที่ 15 (= ความสูงและลักษณะพื้นที่ 35) · แหล่งน้ำ 25
  weights: { slope: 40, height: 20, landform: 15, water: 25 },
  passPercent: 70,
  weakBelow: 0.7,
  slope: { idealMinPct: 1, idealMaxPct: 4, zeroAtPct: 6.2, flatFactor: 0.55 },
  height: { floodLevelMeters: 3, safeMarginMeters: 3, tooHighMeters: 14, tooHighFactor: 0.4 },
  landform: { summitMarginMeters: 7, basinMarginMeters: 2.5, summitFactor: 0.45, basinFactor: 0.3, reliefFullMeters: 3, reliefZeroMeters: 12 },
  water: { tooCloseMeters: 70, tooCloseFactor: 0.3, idealMaxMeters: 180, zeroAtMeters: 320 },
  topics: {
    slope: { label: 'ความลาดชัน', teacherId: 'villager-son' },
    height: { label: 'ความสูงเหนือระดับน้ำ', teacherId: 'teacher-nem' },
    landform: { label: 'ลักษณะพื้นที่', teacherId: 'villager-son' },
    water: { label: 'ความใกล้แหล่งน้ำ', teacherId: 'teacher-nem' },
  },
  availableWhen: { minStep: 3 },
  attemptFlag: 'settlement-attempted',
  successFlag: 'settlement-passed',
  fieldCheck: {
    radiusTiles: 5,
    when: { flags: ['explorer-briefed'] },
    flag: 'field-checked',
    evidenceId: 'evidence-field',
    nodes: [
      { speaker: 'สมุดภาคสนาม — ตรวจสอบพื้นที่ที่เลือก', text: 'ที่ตั้ง: {{grid:chosen}} · ความสูง {{elev:chosen}} ม. (รทก.จำลอง) · วงตรวจรัศมี {{site:radius}} ม.' },
      { speaker: 'สมุดภาคสนาม — ตรวจสอบพื้นที่ที่เลือก', text: '① ความสูง/ชั้นตะกอน: {{site:explainHeight}} (น้ำท่วมสูงสุด {{cfg:flood}} ม.)' },
      { speaker: 'สมุดภาคสนาม — ตรวจสอบพื้นที่ที่เลือก', text: '② ความลาด/พื้นผิว: {{site:explainSlope}} · {{site:explainLandform}}' },
      { speaker: 'สมุดภาคสนาม — ตรวจสอบพื้นที่ที่เลือก', text: '③ แหล่งน้ำ: {{site:explainWater}}' },
      {
        speaker: 'สมุดภาคสนาม — ตรวจสอบพื้นที่ที่เลือก',
        text: 'บันทึกหลักฐาน: ค่าที่วัดจริงตรงกับที่วิเคราะห์จากแผนที่ (ในเกมวางเศษภาชนะดินเผา "จำลอง" ไว้ในชั้นตะกอนเพื่อฝึกบันทึกหลักฐาน — ของจริงต้องให้นักโบราณคดีตรวจ) กลับไปให้พี่เขียวตรวจหลักฐานร่วมกัน',
        effects: [
          { type: 'evidence', evidenceId: 'evidence-field' },
          { type: 'flag', flag: 'field-checked' },
        ],
      },
    ],
  },
};

/* ---------------- คำถามในบทเรียน ---------------- */

export const pongQuizzes: QuizDefinition[] = [
  {
    id: 'contour-spacing',
    speaker: 'ลุงสอน',
    question: 'เส้นชั้นความสูงสองเส้นบนแผนที่อยู่ห่างกันมาก หมายความว่าตรงนั้นเป็นอย่างไร?',
    choices: [
      { id: 'steep', label: 'ชันมาก', hint: 'เส้นห่างหมายถึงต้องเดินไกลกว่าจะสูงขึ้น {{cfg:interval}} ม. = ลาดเอียงน้อย ส่วนเส้นถี่ต่างหากที่ชัน' },
      { id: 'gentle', label: 'ลาดเอียงน้อย (ค่อย ๆ สูงขึ้น)' },
      { id: 'peak', label: 'เป็นยอดเขาที่สูงที่สุด', hint: 'ยอดเขามักเป็นเส้นวงปิดเล็ก ๆ ไม่ใช่เส้นที่ห่างกัน' },
    ],
    correctChoiceId: 'gentle',
    fallbackHint: 'เส้นถี่ = ชัน เส้นห่าง = ลาด',
    correctFeedback: 'ถูกต้อง! เส้นห่าง = ลาดเอียงน้อย',
    effects: [{ type: 'flag', flag: 'quiz-contour' }],
  },
  {
    id: 'slope-calc',
    speaker: 'ลุงสอน',
    question: 'จุดสองจุดสูงต่างกัน 2 เมตร ห่างกันในแนวราบ 50 เมตร ความลาดชันกี่เปอร์เซ็นต์?',
    choices: [
      { id: 'inverted', label: '25%', hint: 'นี่คือ 50 ÷ 2 สลับตัวตั้งกับตัวหารแล้ว ต้องเอาความสูงที่เปลี่ยน (2) ตั้ง' },
      { id: 'ok', label: '4%' },
      { id: 'forgot', label: '0.04%', hint: 'ลืมคูณ 100 — 2 ÷ 50 = 0.04 แล้วคูณ 100 จึงเป็นเปอร์เซ็นต์' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: 'ลาดชัน (%) = ความสูงที่เปลี่ยน ÷ ระยะราบ × 100',
    correctFeedback: 'ถูกต้อง! 2 ÷ 50 × 100 = 4% — อยู่ในช่วงที่เหมาะกับที่ตั้งหมู่บ้าน ({{cfg:slopeMin}}–{{cfg:slopeMax}}%)',
    effects: [{ type: 'flag', flag: 'learned-slope' }],
  },
  {
    id: 'relearn-slope',
    speaker: 'ลุงสอน',
    question: 'ที่ตั้งหมู่บ้านควรมีความลาดชันแบบใด?',
    choices: [
      { id: 'flat', label: 'ราบสนิท 0% ดีที่สุด', hint: 'ราบสนิทน้ำระบายไม่ดี ฝนตกแล้วท่วมขัง' },
      { id: 'ok', label: 'ลาด {{cfg:slopeMin}}–{{cfg:slopeMax}}% ระบายน้ำดีและยังสร้างบ้านได้' },
      { id: 'steep', label: 'ยิ่งชันยิ่งดี น้ำจะไม่ท่วม', hint: 'ชันเกิน {{cfg:slopeZero}}% สร้างบ้านและเดินลำบาก ดินพังง่าย' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: 'ลาดเล็กน้อย ไม่ราบสนิท ไม่ชัน',
    correctFeedback: 'ถูกต้อง! ลาดเล็กน้อยคือกำลังเหมาะ',
    effects: [{ type: 'flag', flag: 'relearned:slope' }],
  },
  {
    id: 'relearn-landform',
    speaker: 'ลุงสอน',
    question: 'แถบที่เส้นชั้นความสูงห่างออกกว้างเป็นขั้นบันไดบนไหล่เนิน เรียกว่าอะไร และเหมาะตั้งหมู่บ้านไหม?',
    choices: [
      { id: 'summit', label: 'ยอดเนิน — เหมาะที่สุด', hint: 'ยอดเนินโล่ง ลมแรง และมักอยู่ไกลน้ำ เส้นรอบยอดเนินเป็นวงปิดเล็ก ไม่ใช่แถบกว้าง' },
      { id: 'ok', label: 'ชานเนิน — เหมาะ เรียบ ไม่ท่วม ไม่โล่งลม' },
      { id: 'basin', label: 'แอ่ง — เหมาะเพราะมีน้ำขัง', hint: 'แอ่งน้ำท่วมขัง ไม่ใช่ที่ตั้งหมู่บ้าน เส้นจะล้อมพื้นที่ต่ำกว่ารอบข้าง' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: 'ขั้นบันไดบนไหล่เนินเรียกชานเนิน',
    correctFeedback: 'ถูกต้อง! ชานเนินเรียบและพ้นน้ำท่วม',
    effects: [{ type: 'flag', flag: 'relearned:landform' }],
  },
  {
    id: 'relearn-height',
    speaker: 'ครูเนม',
    question: 'น้ำท่วมสูงสุด {{cfg:flood}} ม. เหนือผิวน้ำ ที่ตั้งหมู่บ้านควรสูงกว่าผิวน้ำอย่างน้อยเท่าไร?',
    choices: [
      { id: 'one', label: '1 ม. ก็พอ', hint: '1 ม. ต่ำกว่าระดับน้ำท่วมสูงสุด น้ำท่วมถึง' },
      { id: 'equal', label: 'เท่าระดับน้ำท่วมสูงสุดพอดี ({{cfg:flood}} ม.)', hint: 'เท่าระดับน้ำท่วมสูงสุดยังเสี่ยง ต้องเผื่อความปลอดภัยด้วย' },
      { id: 'ok', label: 'อย่างน้อย {{cfg:safe}} ม. (พ้นน้ำท่วมและเผื่อไว้)' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: 'ระดับน้ำท่วมสูงสุด + ระยะเผื่อ',
    correctFeedback: 'ถูกต้อง! สูงกว่าผิวน้ำอย่างน้อย {{cfg:safe}} ม. แต่ไม่ควรเกิน {{cfg:tooHigh}} ม.',
    effects: [{ type: 'flag', flag: 'relearned:height' }],
  },
  {
    id: 'relearn-water',
    speaker: 'ครูเนม',
    question: 'บนแผนที่ 1:10,000 วัดจากวงถึงลำห้วยได้ 1.5 ซม. ระยะจริงเท่าไร และใกล้พอใช้น้ำไหม (ใกล้พอ = ไม่เกิน {{cfg:wIdeal}} ม.)?',
    choices: [
      { id: 'x10', label: '15 ม. — ติดลำห้วยเกินไป', hint: '1 ซม. บนแผนที่ 1:10,000 = 100 ม. ไม่ใช่ 10 ม.' },
      { id: 'ok', label: '150 ม. — ใกล้พอใช้น้ำ' },
      { id: 'x1000', label: '1,500 ม. — ไกลเกินไป', hint: 'คูณ 100 ไม่ใช่ 1,000 — 1.5 ซม. = 150 ม.' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: '1 ซม. = 100 ม. จริง',
    correctFeedback: 'ถูกต้อง! 1.5 ซม. × 100 = 150 ม. ซึ่งอยู่ในช่วงใกล้พอใช้น้ำ',
    effects: [{ type: 'flag', flag: 'relearned:water' }],
  },
];

/* ---------------- เบาะแสและหลักฐาน ---------------- */

export const pongClues: ClueDefinition[] = [
  {
    id: 'clue-criteria',
    type: 'comparison',
    source: 'ครูเนม',
    text: 'เกณฑ์วิเคราะห์พื้นที่ (เต็ม 100): ความลาดชัน {{cfg:wSlope}} · ความสูงเหนือน้ำ {{cfg:wHeight}} + ลักษณะพื้นที่ {{cfg:wLandform}} · ความใกล้แหล่งน้ำ {{cfg:wWater}} · ผ่านเมื่อมากกว่า {{cfg:pass}}% · วงกลมวิเคราะห์รัศมี {{cfg:radius}} ม.',
  },
  {
    id: 'clue-topo',
    type: 'elevation',
    source: 'ครูเนม',
    text: 'แผนที่ภูมิประเทศ: เส้นชั้นความสูงทุก {{cfg:interval}} ม. เส้นหนาทุก 10 ม. — ไม่มีใครบอกว่าพื้นที่ไหนเหมาะ ต้องวิเคราะห์เอง',
  },
  {
    id: 'clue-contour',
    type: 'elevation',
    source: 'ลุงสอน',
    text: 'เส้นชั้นความสูง = เส้นที่ผ่านจุดสูงเท่ากัน · เส้นถี่ = ชัน · เส้นห่าง = ลาดเอียงน้อย',
  },
  {
    id: 'clue-slope-rule',
    type: 'elevation',
    source: 'ลุงสอน',
    text: 'ลาดชัน (%) = ความสูงที่เปลี่ยน ÷ ระยะราบ × 100 · ที่ตั้งหมู่บ้านชอบ {{cfg:slopeMin}}–{{cfg:slopeMax}}% · ชันเกิน {{cfg:slopeZero}}% ถือว่าชันเกินไป',
  },
  {
    id: 'clue-landform',
    type: 'landmark',
    source: 'ลุงสอน',
    text: 'ลักษณะพื้นที่: ชานเนิน (ลานเรียบเป็นขั้น) เหมาะ · ยอดเนินโล่งลมแรง · แอ่งน้ำท่วมขัง · ที่ราบริมห้วยน้ำท่วมถึง',
  },
  {
    id: 'clue-flood',
    type: 'elevation',
    source: 'ป้าจันทร์',
    text: 'น้ำท่วมสูงสุด {{cfg:flood}} ม. เหนือผิวน้ำปกติ — ควรอยู่สูงกว่าผิวน้ำอย่างน้อย {{cfg:safe}} ม. แต่ไม่เกิน {{cfg:tooHigh}} ม.',
  },
  {
    id: 'clue-water',
    type: 'distance',
    source: 'ป้าจันทร์',
    text: 'ใกล้น้ำพอตักได้ไม่เกิน {{cfg:wIdeal}} ม. · ไม่ควรติดลำห้วยกว่า {{cfg:wClose}} ม. · ไกลเกิน {{cfg:wZero}} ม. ใช้น้ำลำบาก',
  },
];

export const pongEvidence: EvidenceDefinition[] = [
  { id: 'evidence-topo-map', name: 'แผนที่ภูมิประเทศเส้นชั้นความสูง', description: 'แผนที่ทั้งตำบลจากครูเนม (เส้นชั้นความสูงทุก 2 ม. เส้นหนาทุก 10 ม.)' },
  { id: 'evidence-field', name: 'บันทึกตรวจภาคสนามพื้นที่ที่เลือก', description: 'ค่าความสูงเหนือน้ำ ความลาด ลักษณะพื้นที่ และระยะถึงลำห้วย ที่ตรวจจริงในพื้นที่ (ข้อมูลจำลอง)' },
];

/* ---------------- ตอนจบ ---------------- */

const NEM_BOOK = 'ครูเนม (ผ่านสมุดภาคสนาม)';
export const pongEnding: EndingDefinition = {
  // เริ่มเองเมื่อพี่เขียวยืนยันหลักฐานภาคสนาม (ฉาก 5 จบ → ฉาก 6)
  startWhen: { flags: ['evidence-verified'] },
  messages: [
    { speaker: NEM_BOOK, text: 'ครูได้รับรายงานจากพี่เขียวแล้ว พื้นที่ที่เธอเลือกอยู่ที่พิกัด {{grid:chosen}} สูง {{elev:chosen}} ม. ได้คะแนนความเหมาะสม {{site:percent}}%' },
    { speaker: NEM_BOOK, text: 'ความลาดเฉลี่ย {{site:slope}}% · สูงกว่าผิวน้ำ {{site:above}} ม. · {{site:landform}} · ห่างลำห้วย ~{{site:water}} ม. — ผ่านทั้งความลาดชัน ความสูงและลักษณะพื้นที่ และแหล่งน้ำ' },
    { speaker: NEM_BOOK, text: 'ย้ำอีกครั้ง: คะแนนนี้คือความเหมาะสมตามเกณฑ์จำลอง ไม่ใช่ความน่าจะเป็นที่จะพบเมืองโบราณจริง ถ้าจะรู้ว่ามีชุมชนโบราณจริงหรือไม่ ต้องขุดค้นทางโบราณคดีและมีหลักฐานจริง' },
    { speaker: NEM_BOOK, text: 'สิ่งที่เราใช้: เส้นห่าง = ลาด เส้นถี่ = ชัน · ลาดชัน (%) = ความสูงที่เปลี่ยน ÷ ระยะราบ × 100 · และพิกัดกริด E/N บอกที่ตั้งให้คนอื่นหาเจอ' },
    { speaker: NEM_BOOK, text: 'รหัสหีบชิ้นที่ 3 คือ "พิกัด" — เหลืออีกชิ้นเดียว! ครูมอบแผนที่ตำบลโป่งน้ำร้อนให้เก็บไว้ด้วยนะ' },
  ],
  codePiece: { index: 3, total: 4, value: 'พิกัด' },
  rewardItem: 'แผนที่ตำบลโป่งน้ำร้อน',
  completeFlag: 'mission-complete',
};

/* ---------------- ภารกิจ ---------------- */

export const pongQuests: QuestDefinition[] = [
  {
    id: 'main-pong',
    kind: 'main',
    title: 'ปริศนาเมืองโบราณใต้ผืนดิน',
    description: 'ใช้เส้นชั้นความสูงวิเคราะห์ว่าพื้นที่ใดเหมาะกับการตั้งถิ่นฐาน แล้วไปตรวจสอบภาคสนาม (สถานการณ์จำลอง) เพื่อรับรหัสหีบชิ้นที่ 3',
    lockedHint: '',
    objectives: [
      { text: 'รับเอกสารและแผนที่ภูมิประเทศจากครูเนม', done: { type: 'step', order: 1 } },
      { text: 'เรียนเส้นชั้นความสูงกับลุงสอน และฟังข้อมูลแหล่งน้ำจากป้าจันทร์', done: { type: 'step', order: 2 } },
      { text: 'เลือกพื้นที่บนแผนที่และวิเคราะห์คะแนนความเหมาะสม', done: { type: 'step', order: 3 } },
      { text: 'ทบทวนหัวข้อที่ผิดแล้ววิเคราะห์ใหม่จนผ่านเกณฑ์', done: { type: 'step', order: 4 } },
      { text: 'ไปตรวจสอบพื้นที่และหลักฐานกับนักสำรวจ', done: { type: 'step', order: 5 } },
      { text: 'ครูเนมสรุปผลและมอบรหัส "พิกัด"', done: { type: 'step', order: 6 } },
    ],
  },
  {
    id: 'side-contours',
    kind: 'side',
    title: 'นักอ่านเส้นชั้นความสูง',
    description: 'ฝึกอ่านภูมิประเทศจากแผนที่ แล้วไปดูของจริงที่จุดชมวิว',
    unlockWhen: { flags: ['got-topo-map'] },
    lockedHint: 'รับแผนที่ภูมิประเทศจากครูเนมก่อน',
    objectives: [
      { text: 'เปิดแผนที่ดูเส้นชั้นความสูง', done: { type: 'flag', flag: 'opened:map' } },
      { text: 'เดินไปจุดชมวิวทางเหนือ ดูภาพรวมภูมิประเทศ', done: { type: 'discover', landmarkId: 'viewpoint' } },
    ],
    reward: { text: 'บันทึกในสมุด: ทางเหนือพื้นสูงกว่าทางใต้ ลำห้วยจึงไหลจากเหนือลงใต้' },
  },
];

/* ---------------- ฉากและขั้นย่อย ---------------- */

export const pongStory: StoryStep[] = [
  {
    order: 1,
    title: 'รับเอกสารและแผนที่จากครูเนม',
    objective: 'คุยกับครูเนม รับเอกสารเกณฑ์วิเคราะห์และแผนที่ภูมิประเทศ',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'topo-received' },
  },
  {
    order: 2,
    title: 'เรียนรู้เส้นชั้นความสูงกับลุงสอน',
    objective: 'ฟังลุงสอนสอนอ่านเส้นชั้นความสูง และถามป้าจันทร์เรื่องแหล่งน้ำ',
    landmarkId: 'village',
    status: 'playable',
    completeWhen: { type: 'all', of: [{ type: 'flag', flag: 'learned-slope' }, { type: 'flag', flag: 'water-info' }] },
  },
  {
    order: 3,
    title: 'วิเคราะห์พื้นที่ที่อาจเหมาะกับการตั้งถิ่นฐาน',
    objective: 'เปิดแผนที่ เลือกพื้นที่ แล้ววิเคราะห์คะแนนความเหมาะสม',
    landmarkId: 'viewpoint',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'settlement-attempted' },
  },
  {
    order: 4,
    title: 'ทบทวนและวิเคราะห์ใหม่จนผ่านเกณฑ์',
    objective: 'ถ้าคะแนนไม่ผ่าน ไปเรียนเพิ่มตามหัวข้อที่ผิด แล้ววิเคราะห์ใหม่',
    landmarkId: 'village',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'settlement-passed' },
  },
  {
    order: 5,
    title: 'ตรวจสอบพื้นที่และค้นหาหลักฐานกับนักสำรวจ',
    objective: 'ไปตรวจสอบพื้นที่ที่เลือกกับพี่เขียว แล้วยืนยันหลักฐานร่วมกัน',
    landmarkId: 'camp',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'evidence-verified' },
  },
  {
    order: 6,
    title: 'รายงานผลและรับรหัส "พิกัด"',
    objective: 'ครูเนมสรุปผลผ่านสมุดภาคสนาม',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];

export const PONG_PHASES = [
  { id: 'learn', title: 'ช่วงที่ 1 · รับภารกิจและเรียนรู้' },
  { id: 'analyze', title: 'ช่วงที่ 2 · วิเคราะห์พื้นที่' },
  { id: 'field', title: 'ช่วงที่ 3 · ตรวจสอบภาคสนามและรายงาน' },
];

const PONG_MICRO: Record<number, NonNullable<StoryStep['micro']>> = {
  1: [
    talkTo({
      id: 'talk-nem',
      phase: 'learn',
      npcId: 'teacher-nem',
      name: 'ครูเนม',
      goal: 'ไปคุยกับครูเนม รับเอกสารและแผนที่',
      where: 'ที่โรงเรียน',
      result: 'ได้เอกสารเกณฑ์วิเคราะห์ (เต็ม 100) และแผนที่ภูมิประเทศเส้นชั้นความสูง (จดลงสมุดให้เอง)',
      think: 'เรื่องเมืองโบราณในเกมเป็นสถานการณ์จำลอง — ครูเนมให้เกณฑ์อะไรบ้างในการเลือกที่ตั้งหมู่บ้าน?',
      done: { type: 'flag', flag: 'topo-received' },
      doneText: '✓ ได้เอกสารและแผนที่แล้ว!',
    }),
  ],
  2: [
    talkTo({
      id: 'go-son',
      phase: 'learn',
      npcId: 'villager-son',
      name: 'ลุงสอน',
      goal: 'ไปพบลุงสอน',
      where: 'ในชุมชน ใกล้สะพานบนถนนหลัก',
      result: 'ลุงสอนเริ่มสอนเส้นชั้นความสูง',
      think: 'ลุงสอนจะสอนอะไร? ลองนึกถึงเส้นบนแผนที่ที่ผ่านจุดสูงเท่ากัน',
      done: { type: 'near', npcId: 'villager-son' },
      doneText: '✓ ถึงลุงสอนแล้ว!',
      impliedByNext: true,
    }),
    answerQuiz({
      id: 'learn-contour',
      phase: 'learn',
      npcId: 'villager-son',
      name: 'ลุงสอน',
      goal: 'ฟังบทเรียนเส้นชั้นความสูง แล้วตอบคำถาม 2 ข้อ',
      result: 'รู้ว่าเส้นห่าง = ลาด เส้นถี่ = ชัน และคำนวณความลาดชัน (%) ได้',
      tool: '{tap:notebook} ดูเบาะแสของลุงสอนซ้ำได้ · ลาดชัน (%) = ความสูงที่เปลี่ยน ÷ ระยะราบ × 100',
      think: 'เส้นห่างกันมาก ต้องเดินไกลกว่าจะสูงขึ้นเท่าเดิม — ตรงนั้นชันหรือลาด?',
      done: { type: 'flag', flag: 'learned-slope' },
      doneText: '✓ เรียนเส้นชั้นความสูงแล้ว!',
    }),
    {
      id: 'read-topo',
      phase: 'learn',
      goal: 'เปิดแผนที่ภูมิประเทศ ดูเส้นชั้นความสูง',
      tools: ['แผนที่'],
      steps: ['{tap:guide} — แผนที่เปิดให้เห็นทั้งตำบลโดยไม่ต้องเดินสำรวจ', 'ดูเส้นหนา (ทุก 10 ม.) และเส้นบาง (ทุก {{cfg:interval}} ม.)', 'สังเกตแถบที่เส้น "ห่างกว้าง" กับแถบที่เส้น "ถี่" แล้ว{tap:closeMap}'],
      result: 'เห็นภาพรวมภูมิประเทศ: ทางเหนือสูง ทางใต้ต่ำ ลำห้วยตัดเป็นหุบ',
      tool: 'เส้นหนาคือเส้นหลัก (index) ทุก 10 ม. ใช้นับความสูงจากลำห้วย · เส้นบางทุก {{cfg:interval}} ม.',
      think: 'ตรงไหนบนแผนที่ที่เส้นห่างเป็นแถบกว้าง ตรงไหนเส้นถี่จนแทบติดกัน?',
      doneText: '✓ ดูแผนที่ภูมิประเทศแล้ว!',
      action: 'map',
      done: { type: 'flag', flag: 'opened:map' },
      impliedByLater: true,
    },
    talkTo({
      id: 'talk-jan',
      phase: 'learn',
      npcId: 'water-keeper',
      name: 'ป้าจันทร์',
      goal: 'ไปคุยกับป้าจันทร์ ถามเรื่องแหล่งน้ำ',
      where: 'ที่ศาลาประชาคม',
      result: 'ได้ข้อมูลระดับน้ำท่วมสูงสุดและระยะใช้น้ำสะดวก (จดลงสมุดให้เอง)',
      think: 'ที่ตั้งหมู่บ้านควรอยู่สูงกว่าผิวน้ำเท่าไร และห่างลำห้วยเท่าไรจึงพอดี?',
      done: { type: 'flag', flag: 'water-info' },
      doneText: '✓ ได้ข้อมูลแหล่งน้ำแล้ว!',
    }),
  ],
  3: [
    {
      id: 'analyze',
      phase: 'analyze',
      goal: 'เลือกพื้นที่บนแผนที่ แล้ววิเคราะห์ความเหมาะสม',
      tools: ['แผนที่', 'วงกลมวิเคราะห์'],
      steps: [
        '{tap:guide} — แผนที่เปิดในโหมดวิเคราะห์ (วงกลมสีเหลืองรัศมี {{cfg:radius}} ม.)',
        '{tapmap} ให้วงอยู่ตรงพื้นที่ที่คิดว่าเหมาะ — ดูว่าเส้นชั้นความสูงลาดเล็กน้อยไหม และห่างลำห้วยแค่ไหน',
        '{tap:pinHere} แล้วอ่านคะแนนทีละเกณฑ์ใต้แผนที่',
      ],
      result: 'ได้คะแนนความเหมาะสมตามเกณฑ์ · ถ้ามากกว่า {{cfg:pass}}% ผ่านและไปตรวจภาคสนาม · ถ้าไม่ผ่าน ระบบบอกหัวข้อที่ต้องทบทวนและผู้สอน',
      tool: 'ใช้เส้นชั้นความสูง (ห่าง = ลาด) และวัดระยะถึงลำห้วยด้วยมาตราส่วน (1 ช่อง = 10 ม.) · ดูเกณฑ์ซ้ำในสมุด หน้าเบาะแส',
      think: 'ที่ไหนที่เส้นห่างเป็นแถบกว้าง สูงพ้นผิวน้ำอย่างน้อย {{cfg:safe}} ม. แต่ยังไม่ไกลจากลำห้วยเกิน {{cfg:wIdeal}} ม.?',
      doneText: '✓ วิเคราะห์พื้นที่แล้ว!',
      action: 'settlement',
      done: { type: 'flag', flag: 'settlement-attempted' },
    },
  ],
  4: [
    {
      id: 'relearn',
      phase: 'analyze',
      goal: 'กลับไปเรียนเพิ่มตามหัวข้อที่ยังไม่เข้าใจ',
      tools: ['ลูกศรนำทาง', 'ปุ่มคุย'],
      steps: [
        'ผลล่าสุดบอกว่าต้องทบทวน: {{try:weak}}',
        'ดูลูกศรสีเหลืองที่ขอบจอ — ชี้ไปหาผู้สอนคนแรกที่ต้องไปหา',
        '{walk} ไปใกล้ ๆ แล้ว{tap:talk}',
        'ฟังบทเรียนเฉพาะหัวข้อที่ผิด แล้วตอบคำถามท้ายบท (ถ้ามีผู้สอนอีกคน ไปหาด้วย)',
      ],
      result: 'ทบทวนครบทุกหัวข้อที่ผิดแล้ว กลับไปวิเคราะห์ใหม่ได้',
      tool: 'ลุงสอนสอน ความลาดชัน · ลักษณะพื้นที่ — ครูเนมสอน ความสูงเหนือน้ำ · ความใกล้แหล่งน้ำ',
      think: 'ในผลล่าสุด ข้อไหนได้คะแนนน้อยที่สุด? ข้อนั้นคือหัวข้อที่ต้องเรียนก่อน',
      doneText: '✓ ทบทวนครบแล้ว!',
      target: { pendingTeacher: true },
      done: { type: 'flag', flag: 'lessons-done' },
    },
    {
      id: 'retry',
      phase: 'analyze',
      goal: 'วิเคราะห์พื้นที่ใหม่อีกครั้ง',
      tools: ['แผนที่', 'วงกลมวิเคราะห์'],
      steps: ['{tap:guide} — เปิดแผนที่ในโหมดวิเคราะห์', '{tapmap} เลือกพื้นที่ใหม่ โดยใช้สิ่งที่เพิ่งทบทวน (ดูวงสีแดงที่เคยไม่ผ่านบนแผนที่ แล้วเลี่ยงเหตุที่ผิด)', '{tap:pinHere} แล้วอ่านคะแนน'],
      result: 'ถ้ามากกว่า {{cfg:pass}}% ผ่านและไปตรวจภาคสนาม — วิเคราะห์ซ้ำได้ไม่จำกัด',
      tool: 'เทียบผลทีละเกณฑ์ในสมุด หน้า "หลักฐาน/ข้อความ" ว่าครั้งก่อนพลาดข้อใด',
      think: 'ครั้งก่อนเสียคะแนนข้อไหน? พื้นที่ใหม่ควรต่างจากเดิมอย่างไร?',
      doneText: '✓ วิเคราะห์ผ่านเกณฑ์แล้ว!',
      action: 'settlement',
      done: { type: 'flag', flag: 'settlement-passed' },
    },
  ],
  5: [
    talkTo({
      id: 'go-khiao',
      phase: 'field',
      npcId: 'explorer-khiao',
      name: 'พี่เขียว (นักสำรวจ)',
      goal: 'ไปพบพี่เขียว นักสำรวจภาคสนาม',
      where: 'ที่ค่ายสำรวจข้างถนนขึ้นเขา ทางตะวันออก',
      result: 'พี่เขียวอธิบายวิธีตรวจภาคสนามทั้ง 3 อย่าง',
      think: 'การตรวจของจริงต่างจากการวิเคราะห์จากแผนที่อย่างไร?',
      done: { type: 'flag', flag: 'explorer-briefed' },
      doneText: '✓ รับคำแนะนำนักสำรวจแล้ว!',
    }),
    {
      id: 'field-check',
      phase: 'field',
      goal: 'ไปที่พื้นที่ที่เลือก แล้วตรวจสอบภาคสนาม',
      tools: ['ลูกศรนำทาง', 'ปุ่มตรวจสอบ', 'แผนที่'],
      steps: [
        'พื้นที่ที่เลือกคือวงสีเขียวบนแผนที่ — ดูลูกศรสีเหลืองที่ขอบจอ',
        '{walk} ไปให้ถึงในวง',
        'เมื่อปุ่ม "ตรวจสอบ" ขึ้น {tap:check} แล้ว{next}',
      ],
      result: 'ได้บันทึกตรวจภาคสนาม 3 ข้อ: ความสูงเหนือน้ำ · ความลาด/พื้นผิว · ระยะถึงลำห้วย',
      tool: '{tap:map} ดูวงสีเขียวและพิกัดของพื้นที่ที่เลือก',
      think: 'ค่าที่วัดจริงตรงกับที่คำนวณจากแผนที่ไหม?',
      doneText: '✓ ตรวจภาคสนามแล้ว!',
      target: { area: 'chosen' },
      action: 'map',
      done: { type: 'flag', flag: 'field-checked' },
    },
    talkTo({
      id: 'review-khiao',
      phase: 'field',
      npcId: 'explorer-khiao',
      name: 'พี่เขียว',
      goal: 'กลับไปตรวจหลักฐานร่วมกับพี่เขียว',
      where: 'ที่ค่ายสำรวจข้างถนนขึ้นเขา',
      result: 'พี่เขียวยืนยันหลักฐาน แล้วครูเนมได้รับรายงาน',
      think: 'หลักฐานภาคสนามยืนยันอะไรได้ และยังพิสูจน์อะไรไม่ได้?',
      done: { type: 'flag', flag: 'evidence-verified' },
      doneText: '✓ ยืนยันหลักฐานแล้ว!',
    }),
  ],
  6: [
    hearReport({
      id: 'report',
      phase: 'field',
      code: 'รหัสลับชิ้นที่ 3 "พิกัด"',
      goal: 'ฟังครูเนมสรุปผล แล้วรับรหัส "พิกัด"',
      done: { type: 'flag', flag: 'mission-complete' },
    }),
  ],
};
for (const st of pongStory) if (PONG_MICRO[st.order]) st.micro = PONG_MICRO[st.order];
