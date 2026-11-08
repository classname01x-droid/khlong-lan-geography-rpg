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
 * ภารกิจบทที่ 3 (โป่งน้ำร้อน) — "ปริศนาเมืองโบราณใต้ผืนดิน" (6 ฉาก · คำพิทักษ์คำที่ 3 = "พิกัด")
 *
 *   ฉาก 1  รับเกณฑ์และแผนที่ภูมิประเทศจากครูเนม
 *   ฉาก 2  ลุงสอนสอนอ่านระดับความสูง · ป้าจันทร์ให้ข้อมูลน้ำท่วมและระยะใช้น้ำ
 *   ฉาก 3  เปิดแผนที่ → แตะเลือกพื้นที่ (วงกลมรัศมีคงที่) → ยืนยัน → คะแนน 2 เกณฑ์
 *   ฉาก 4  ไม่ผ่าน → กลับไปพบครูเนม ทบทวนเฉพาะเกณฑ์ที่พลาด → เลือกใหม่ (ผ่านตั้งแต่ครั้งแรก = ข้าม)
 *   ฉาก 5  เดินทางไปพื้นที่ที่เลือก → ตรวจสอบ → พบหลักฐานจำลอง → พี่เขียวยืนยัน
 *   ฉาก 6  ครูเนมสรุป · คำพิทักษ์ "พิกัด" · ปลดล็อกบทที่ 4
 *
 * เกณฑ์ 2 ข้อเท่านั้น (ไม่มีความลาดชัน):
 *   ระดับความสูง (50)       = สูงกว่าลำน้ำที่ใกล้ที่สุดกี่เมตร (ระดับความสูงเฉลี่ยในวง − ระดับผิวลำน้ำ)
 *   ระยะจากแหล่งน้ำ (50)    = ระยะจากกลางวงถึงลำน้ำที่ใกล้ที่สุด
 *   คะแนนรวม = ระดับความสูง + ระยะจากแหล่งน้ำ · ผ่านเมื่อมากกว่า 70
 *
 * ช่วงคะแนนตั้งจากข้อมูลแผนที่จริง (สำรวจทุกตำแหน่งในเขตสำรวจ 3,611 จุด):
 *   ลำน้ำสายเดียวไหลจากเหนือ (ผิวน้ำ ~127 ม.) ลงใต้ (~85 ม.) · ความสูงเฉลี่ยในวง 89–172 ม. · ระยะถึงน้ำ 10–436 ม.
 *   ลำน้ำลดระดับลง 42 ม. ตลอดสาย จึงใช้ "สูงกว่าลำน้ำ" แทนความสูงตายตัว (ความสูงเดียวกันอาจอยู่เหนือน้ำทางใต้ แต่จมน้ำทางเหนือ)
 *   ผลตามช่วงด้านล่าง: ผ่าน ~25% ของพื้นที่ (ส่วนใหญ่เป็นแถบฝั่งตะวันออกที่สูงกว่าลำน้ำพอดีและไม่ไกลน้ำ) · ฝั่งตะวันตกต่ำ เสี่ยงน้ำท่วม · ทางตะวันออกไกลไกลน้ำ
 *
 * เรื่องเมืองโบราณเป็นสถานการณ์จำลองเพื่อการเรียนรู้ ไม่ใช่ประวัติศาสตร์จริง — คะแนนคือความเหมาะสมตามเงื่อนไขจำลอง
 * ไม่มีตำแหน่งคำตอบในเนื้อหา: คะแนนทุกครั้งคำนวณจากภูมิประเทศ (core/site/SettlementAnalysis.ts)
 */

/* ---------------- เกณฑ์วิเคราะห์ (ข้อมูลของด่าน) ---------------- */

export const pongSettlement: SettlementAnalysisDefinition = {
  radiusTiles: 4, // วงกลมรัศมี 4 ช่อง = 40 ม.
  passPercent: 70,
  height: {
    max: 50,
    // ค่า = สูงกว่าลำน้ำ (ม.)
    bands: [
      { below: 3, score: 0, label: 'ต่ำเกินไป เสี่ยงน้ำท่วม' },
      { below: 6, score: 35, label: 'ค่อนข้างต่ำ' },
      { below: 12, score: 50, label: 'เหมาะสม' },
      { below: 20, score: 35, label: 'ค่อนข้างสูง' },
      { below: 30, score: 15, label: 'สูงเกินไป ใช้น้ำลำบาก' },
      { below: null, score: 0, label: 'สูงมาก ไกลน้ำ' },
    ],
  },
  water: {
    max: 50,
    // ค่า = ระยะถึงลำน้ำ (ม.)
    bands: [
      { below: 40, score: 15, label: 'ใกล้เกินไป เสี่ยงน้ำท่วม' },
      { below: 70, score: 35, label: 'ค่อนข้างใกล้' },
      { below: 130, score: 50, label: 'เหมาะสม' },
      { below: 200, score: 35, label: 'ค่อนข้างไกล' },
      { below: 300, score: 15, label: 'ไกล' },
      { below: null, score: 0, label: 'ไกลเกินไป' },
    ],
  },
  topics: {
    height: { label: 'ระดับความสูง', teacherId: 'teacher-nem' },
    water: { label: 'ระยะจากแหล่งน้ำ', teacherId: 'teacher-nem' },
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
      { speaker: 'สมุดภาคสนาม — ตรวจสอบตำแหน่ง', text: 'อยู่ในพื้นที่ที่เลือกแล้ว: {{grid:chosen}} (วงรัศมี {{site:radius}} ม.)' },
      { speaker: 'สมุดภาคสนาม — วัดจริง', text: 'ระดับความสูง {{site:explainHeight}} · ระยะจากลำน้ำ {{site:explainWater}}' },
      {
        speaker: 'สมุดภาคสนาม — ค้นหาหลักฐาน',
        text: 'ขุดตรวจผิวดิน: พบชั้นตะกอนน้ำหลาก และเศษภาชนะดินเผา "จำลอง" ที่วางไว้ฝึกบันทึก — หลักฐานครบ กลับไปให้พี่เขียวยืนยัน',
        effects: [
          { type: 'evidence', evidenceId: 'evidence-field' },
          { type: 'flag', flag: 'field-checked' },
        ],
      },
    ],
  },
};

/* ---------------- คำถาม ---------------- */

export const pongQuizzes: QuizDefinition[] = [
  {
    id: 'contour-read',
    speaker: 'ลุงสอน',
    question: 'พื้นที่หนึ่งอยู่บนเส้นชั้นความสูง 118 ม. ลำน้ำข้าง ๆ อยู่บนเส้น 110 ม. พื้นที่นั้นสูงกว่าลำน้ำกี่เมตร?',
    choices: [
      { id: 'elev', label: '118 ม.', hint: '118 ม. คือความสูงของพื้นที่ ต้องลบความสูงของลำน้ำออกก่อน' },
      { id: 'ok', label: '8 ม.' },
      { id: 'sum', label: '228 ม.', hint: 'ต้องลบ ไม่ใช่บวก: 118 − 110' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: 'สูงกว่าลำน้ำ = ความสูงของพื้นที่ − ความสูงของลำน้ำ',
    correctFeedback: 'ถูกต้อง! 118 − 110 = 8 ม.',
    effects: [{ type: 'flag', flag: 'quiz-contour' }],
  },
  {
    id: 'relearn-height',
    speaker: 'ครูเนม',
    question: 'พื้นที่สูง 112 ม. ลำน้ำใกล้ ๆ สูง 110 ม. เกณฑ์ระดับความสูงเป็นอย่างไร?',
    choices: [
      { id: 'abs', label: 'เหมาะสม เพราะสูงถึง 112 ม.', hint: 'ต้องเทียบกับลำน้ำตรงนั้น ไม่ใช่ดูตัวเลขความสูงอย่างเดียว' },
      { id: 'ok', label: 'ต่ำเกินไป สูงกว่าลำน้ำแค่ 2 ม. เสี่ยงน้ำท่วม' },
      { id: 'near', label: 'เหมาะสม เพราะอยู่ใกล้น้ำ', hint: 'ความใกล้น้ำเป็นอีกเกณฑ์หนึ่ง ข้อนี้ถามเรื่องระดับความสูง' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: '112 − 110 = 2 ม. น้อยกว่า {{cfg:flood}} ม.',
    correctFeedback: 'ถูกต้อง! ต้องสูงกว่าลำน้ำ {{cfg:idealHeightFrom}} ม. ขึ้นไปจึงเหมาะสม',
    effects: [{ type: 'flag', flag: 'relearned:height' }],
  },
  {
    id: 'relearn-water',
    speaker: 'ครูเนม',
    question: 'แผนที่ 1:10,000 วัดจากกลางวงถึงลำน้ำได้ 1 ซม. ระยะจริงเท่าไร และเหมาะไหม?',
    choices: [
      { id: 'x10', label: '10 ม. ใกล้เกินไป', hint: '1 ซม. บนแผนที่ 1:10,000 = 100 ม. ไม่ใช่ 10 ม.' },
      { id: 'ok', label: '100 ม. เหมาะสม' },
      { id: 'x1000', label: '1,000 ม. ไกลเกินไป', hint: 'คูณ 100 ไม่ใช่ 1,000' },
    ],
    correctChoiceId: 'ok',
    fallbackHint: '1 ซม. = 100 ม. จริง',
    correctFeedback: 'ถูกต้อง! 100 ม. อยู่ในช่วงเหมาะสม ({{cfg:idealWaterFrom}}–{{cfg:idealWaterBelow}} ม.)',
    effects: [{ type: 'flag', flag: 'relearned:water' }],
  },
];

/* ---------------- เบาะแสและหลักฐาน ---------------- */

export const pongClues: ClueDefinition[] = [
  {
    id: 'clue-criteria',
    type: 'comparison',
    source: 'ครูเนม',
    text: 'เกณฑ์ (เต็ม 100): ระดับความสูง {{cfg:maxHeight}} + ระยะจากแหล่งน้ำ {{cfg:maxWater}} · ผ่านเมื่อมากกว่า {{cfg:pass}} · วงกลมรัศมี {{cfg:radius}} ม.',
  },
  {
    id: 'clue-topo',
    type: 'elevation',
    source: 'ครูเนม',
    text: 'แผนที่ภูมิประเทศ: เส้นชั้นความสูงทุก {{cfg:interval}} ม. — ไม่มีใครบอกว่าพื้นที่ไหนเหมาะ ต้องวิเคราะห์เอง',
  },
  {
    id: 'clue-contour',
    type: 'elevation',
    source: 'ลุงสอน',
    text: 'สูงกว่าลำน้ำ = ความสูงของพื้นที่ − ความสูงของลำน้ำตรงนั้น (ลำน้ำไหลจากเหนือลงใต้ ผิวน้ำทางเหนือสูงกว่า)',
  },
  {
    id: 'clue-flood',
    type: 'elevation',
    source: 'ป้าจันทร์',
    text: 'สูงกว่าลำน้ำไม่ถึง {{cfg:flood}} ม. = น้ำท่วม · เหมาะสม: สูงกว่าลำน้ำ {{cfg:idealHeightFrom}} ม. ขึ้นไป แต่ไม่ถึง {{cfg:idealHeightBelow}} ม.',
  },
  {
    id: 'clue-water',
    type: 'distance',
    source: 'ป้าจันทร์',
    text: 'เหมาะสม: ห่างลำน้ำ {{cfg:idealWaterFrom}} ม. ขึ้นไป แต่ไม่ถึง {{cfg:idealWaterBelow}} ม. · ติดน้ำเกินไปเสี่ยงน้ำท่วม · ไกลเกินไปใช้น้ำลำบาก',
  },
];

export const pongEvidence: EvidenceDefinition[] = [
  { id: 'evidence-topo-map', name: 'แผนที่ภูมิประเทศเส้นชั้นความสูง', description: 'แผนที่ทั้งตำบลจากครูเนม (เส้นชั้นความสูงทุก 2 ม.)' },
  { id: 'evidence-field', name: 'หลักฐานภาคสนามจำลอง', description: 'ระดับความสูงและระยะถึงลำน้ำที่วัดจริง · ชั้นตะกอนน้ำหลาก · เศษภาชนะดินเผาจำลอง' },
];

/* ---------------- ตอนจบ ---------------- */

const NEM_BOOK = 'ครูเนม (ผ่านสมุดภาคสนาม)';
export const pongEnding: EndingDefinition = {
  // เริ่มเองเมื่อพี่เขียวยืนยันหลักฐาน (ฉาก 5 จบ → ฉาก 6)
  startWhen: { flags: ['evidence-verified'] },
  messages: [
    { speaker: NEM_BOOK, text: 'พื้นที่ที่เธอเลือก {{grid:chosen}} ได้ {{site:total}}/100 · ระดับความสูง {{site:heightScore}}/{{cfg:maxHeight}} · ระยะจากแหล่งน้ำ {{site:waterScore}}/{{cfg:maxWater}}' },
    { speaker: NEM_BOOK, text: 'คะแนนนี้คือความเหมาะสมตามเงื่อนไขจำลอง ไม่ใช่ความน่าจะเป็นที่จะพบเมืองโบราณจริง — การยืนยันต้องมีหลักฐานภาคสนาม' },
    { speaker: NEM_BOOK, text: 'คำพิทักษ์คำที่ 3 คือ "พิกัด" — เหลืออีกคำเดียว! ครูมอบแผนที่ตำบลโป่งน้ำร้อนให้เก็บไว้ด้วยนะ' },
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
    description: 'ใช้แผนที่เส้นชั้นความสูงเลือกพื้นที่ที่เหมาะกับการตั้งถิ่นฐาน (สถานการณ์จำลอง) แล้วไปสำรวจเพื่อรับคำพิทักษ์คำที่ 3',
    lockedHint: '',
    objectives: [
      { text: 'รับเกณฑ์และแผนที่จากครูเนม', done: { type: 'step', order: 1 } },
      { text: 'เรียนอ่านระดับความสูงกับลุงสอน และฟังป้าจันทร์เรื่องแหล่งน้ำ', done: { type: 'step', order: 2 } },
      { text: 'เลือกพื้นที่บนแผนที่และวิเคราะห์', done: { type: 'step', order: 3 } },
      { text: 'ทบทวนกับครูเนมแล้ววิเคราะห์ใหม่จนผ่าน', done: { type: 'step', order: 4 } },
      { text: 'ไปสำรวจพื้นที่และหาหลักฐาน', done: { type: 'step', order: 5 } },
      { text: 'ครูเนมสรุปและมอบคำพิทักษ์ "พิกัด"', done: { type: 'step', order: 6 } },
    ],
  },
];

/* ---------------- ฉากและขั้นย่อย ---------------- */

export const pongStory: StoryStep[] = [
  {
    order: 1,
    title: 'รับเกณฑ์และแผนที่จากครูเนม',
    objective: 'คุยกับครูเนม',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'topo-received' },
  },
  {
    order: 2,
    title: 'เรียนอ่านระดับความสูงและข้อมูลแหล่งน้ำ',
    objective: 'คุยกับลุงสอนและป้าจันทร์',
    landmarkId: 'village',
    status: 'playable',
    completeWhen: { type: 'all', of: [{ type: 'flag', flag: 'learned-contour' }, { type: 'flag', flag: 'water-info' }] },
  },
  {
    order: 3,
    title: 'เลือกพื้นที่และวิเคราะห์',
    objective: 'เปิดแผนที่ เลือกพื้นที่ แล้วยืนยันการวิเคราะห์',
    landmarkId: 'village',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'settlement-attempted' },
  },
  {
    order: 4,
    title: 'ทบทวนและวิเคราะห์ใหม่จนผ่าน',
    objective: 'ถ้าไม่ผ่าน กลับไปพบครูเนม แล้วเลือกพื้นที่ใหม่',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'settlement-passed' },
  },
  {
    order: 5,
    title: 'ออกสำรวจพื้นที่ที่เลือก',
    objective: 'ไปพื้นที่ที่เลือก ตรวจสอบ และหาหลักฐานกับพี่เขียว',
    landmarkId: 'camp',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'evidence-verified' },
  },
  {
    order: 6,
    title: 'รายงานผลและรับคำพิทักษ์ "พิกัด"',
    objective: 'ครูเนมสรุปผ่านสมุดภาคสนาม',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];

export const PONG_PHASES = [
  { id: 'learn', title: 'ช่วงที่ 1 · รับภารกิจและเรียนรู้' },
  { id: 'analyze', title: 'ช่วงที่ 2 · เลือกพื้นที่และวิเคราะห์' },
  { id: 'field', title: 'ช่วงที่ 3 · ออกสำรวจและรายงาน' },
];

const PONG_MICRO: Record<number, NonNullable<StoryStep['micro']>> = {
  1: [
    talkTo({
      id: 'talk-nem',
      phase: 'learn',
      npcId: 'teacher-nem',
      name: 'ครูเนม',
      goal: 'ไปคุยกับครูเนม รับเกณฑ์และแผนที่',
      where: 'ที่โรงเรียน',
      result: 'ได้เกณฑ์ 2 ข้อ (ระดับความสูง · ระยะจากแหล่งน้ำ) และแผนที่ภูมิประเทศ',
      think: 'ถ้าจะตั้งหมู่บ้าน ควรอยู่สูงแค่ไหน และห่างน้ำแค่ไหน?',
      done: { type: 'flag', flag: 'topo-received' },
      doneText: '✓ ได้เกณฑ์และแผนที่แล้ว!',
    }),
  ],
  2: [
    talkTo({
      id: 'go-son',
      phase: 'learn',
      npcId: 'villager-son',
      name: 'ลุงสอน',
      goal: 'ไปพบลุงสอน',
      where: 'ในชุมชน ใกล้ถนนหลัก',
      result: 'ลุงสอนเริ่มสอนอ่านระดับความสูง',
      think: 'ตัวเลขบนเส้นชั้นความสูงบอกอะไร?',
      done: { type: 'near', npcId: 'villager-son' },
      doneText: '✓ ถึงลุงสอนแล้ว!',
      impliedByNext: true,
    }),
    answerQuiz({
      id: 'learn-contour',
      phase: 'learn',
      npcId: 'villager-son',
      name: 'ลุงสอน',
      goal: 'ฟังลุงสอน แล้วตอบคำถาม 1 ข้อ',
      result: 'หาได้ว่าพื้นที่สูงกว่าลำน้ำกี่เมตร',
      tool: 'สูงกว่าลำน้ำ = ความสูงของพื้นที่ − ความสูงของลำน้ำ',
      think: 'ต้องบวกหรือลบ?',
      done: { type: 'flag', flag: 'learned-contour' },
      doneText: '✓ อ่านระดับความสูงได้แล้ว!',
    }),
    talkTo({
      id: 'talk-jan',
      phase: 'learn',
      npcId: 'water-keeper',
      name: 'ป้าจันทร์',
      goal: 'ไปคุยกับป้าจันทร์ เรื่องแหล่งน้ำ',
      where: 'ที่ศาลาประชาคม',
      result: 'รู้ช่วงความสูงและระยะจากน้ำที่เหมาะสม (จดลงสมุดให้เอง)',
      think: 'อยู่ติดน้ำเกินไป หรือไกลน้ำเกินไป มีปัญหาอะไร?',
      done: { type: 'flag', flag: 'water-info' },
      doneText: '✓ ได้ข้อมูลแหล่งน้ำแล้ว!',
    }),
  ],
  3: [
    {
      id: 'analyze',
      phase: 'analyze',
      goal: 'เลือกพื้นที่บนแผนที่ แล้วยืนยันการวิเคราะห์',
      tools: ['แผนที่', 'วงกลมวิเคราะห์'],
      steps: [
        '{tap:guide} — แผนที่เปิดในโหมดเลือกพื้นที่',
        '{tapmap} เพื่อวางวงกลม (รัศมี {{cfg:radius}} ม.) — แตะที่ใหม่ได้เรื่อย ๆ',
        '{tap:pinHere} เพื่อยืนยัน แล้วอ่านคะแนนใต้แผนที่',
      ],
      result: 'ได้คะแนน 2 เกณฑ์ รวมเต็ม 100 · มากกว่า {{cfg:pass}} = ผ่าน',
      tool: 'ดูตัวเลขบนเส้นชั้นความสูงของพื้นที่และของลำน้ำ · 1 ช่อง = 10 ม.',
      think: 'ตรงไหนสูงกว่าลำน้ำ {{cfg:idealHeightFrom}}–{{cfg:idealHeightBelow}} ม. และห่างน้ำ {{cfg:idealWaterFrom}}–{{cfg:idealWaterBelow}} ม.?',
      doneText: '✓ วิเคราะห์แล้ว!',
      action: 'settlement',
      done: { type: 'flag', flag: 'settlement-attempted' },
    },
  ],
  4: [
    {
      id: 'relearn',
      phase: 'analyze',
      goal: 'กลับไปพบครูเนม ทบทวนเรื่องที่พลาด',
      tools: ['ลูกศรนำทาง', 'ปุ่มคุย'],
      steps: ['ต้องทบทวน: {{try:weak}}', '{walk} ไปหาครูเนม (ดูลูกศรที่ขอบจอ) แล้ว{tap:talk}', 'ฟังแล้วตอบคำถาม'],
      result: 'เลือกพื้นที่ใหม่ได้',
      tool: 'ครูเนมอธิบายเฉพาะเกณฑ์ที่ยังไม่ได้คะแนนเต็ม',
      think: 'ครั้งก่อนเกณฑ์ไหนได้คะแนนน้อย?',
      doneText: '✓ ทบทวนแล้ว!',
      target: { pendingTeacher: true },
      done: { type: 'flag', flag: 'lessons-done' },
    },
    {
      id: 'retry',
      phase: 'analyze',
      goal: 'เลือกพื้นที่ใหม่ แล้ววิเคราะห์อีกครั้ง',
      tools: ['แผนที่', 'วงกลมวิเคราะห์'],
      steps: ['{tap:guide} — เปิดแผนที่', '{tapmap} เลือกที่ใหม่ (วงสีแดง = ที่เคยไม่ผ่าน)', '{tap:pinHere} เพื่อยืนยัน'],
      result: 'มากกว่า {{cfg:pass}} = ผ่าน แล้วออกสำรวจได้ · ลองใหม่ได้ไม่จำกัด',
      tool: 'ใช้สิ่งที่ครูเนมเพิ่งอธิบาย',
      think: 'พื้นที่ใหม่ควรต่างจากเดิมอย่างไร?',
      doneText: '✓ วิเคราะห์ผ่านแล้ว!',
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
      goal: 'ไปพบพี่เขียว นักสำรวจ',
      where: 'ที่ค่ายสำรวจทางตะวันออก',
      result: 'พี่เขียวบอกวิธีสำรวจ',
      think: 'ทำไมผลบนแผนที่ยังไม่ใช่หลักฐาน?',
      done: { type: 'flag', flag: 'explorer-briefed' },
      doneText: '✓ พร้อมออกสำรวจ!',
    }),
    {
      id: 'field-check',
      phase: 'field',
      goal: 'ไปพื้นที่ที่เลือก แล้วตรวจสอบ',
      tools: ['ลูกศรนำทาง', 'ปุ่มตรวจสอบ'],
      steps: ['{walk} ไปในวงสีเขียว (ดูลูกศรที่ขอบจอ)', 'เมื่อปุ่ม "ตรวจสอบ" ขึ้น {tap:check} แล้ว{next}'],
      result: 'ได้ค่าที่วัดจริงและหลักฐานจำลอง',
      tool: '{tap:map} ดูวงสีเขียว',
      think: 'ค่าที่วัดจริงตรงกับแผนที่ไหม?',
      doneText: '✓ พบหลักฐานแล้ว!',
      target: { area: 'chosen' },
      action: 'map',
      done: { type: 'flag', flag: 'field-checked' },
    },
    talkTo({
      id: 'review-khiao',
      phase: 'field',
      npcId: 'explorer-khiao',
      name: 'พี่เขียว',
      goal: 'กลับไปให้พี่เขียวยืนยันหลักฐาน',
      where: 'ที่ค่ายสำรวจ',
      result: 'พี่เขียวยืนยันการค้นพบ แล้วครูเนมได้รับรายงาน',
      think: 'หลักฐานภาคสนามยืนยันอะไรได้บ้าง?',
      done: { type: 'flag', flag: 'evidence-verified' },
      doneText: '✓ ยืนยันหลักฐานแล้ว!',
    }),
  ],
  6: [
    hearReport({
      id: 'report',
      phase: 'field',
      code: 'คำพิทักษ์คำที่ 3 "พิกัด"',
      goal: 'ฟังครูเนมสรุป แล้วรับคำพิทักษ์ "พิกัด"',
      done: { type: 'flag', flag: 'mission-complete' },
    }),
  ],
};
for (const st of pongStory) if (PONG_MICRO[st.order]) st.micro = PONG_MICRO[st.order];
