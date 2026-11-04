import type {
  ClueDefinition,
  EndingDefinition,
  EvidenceDefinition,
  InspectPoint,
  PinTaskDefinition,
  QuestDefinition,
  QuizDefinition,
  RouteAnalysisDefinition,
  StoryStep,
  TriggerZone,
} from '../../types';

/** ภารกิจด่านสักงาม: คำถาม เบาะแส การวิเคราะห์เส้นทาง การปักหมุด และตอนจบ */

const WISDOM_CHOICES = [
  {
    id: 'basketry',
    label: 'งานจักสาน',
    hint: 'งานจักสานใช้ตอกไม้ไผ่หรือหวายสานขัดกันเป็นภาชนะ ไม่ได้ใช้เข็มกับด้าย ลองนึกถึงคำว่า "ฝีเข็ม" ในปริศนา',
  },
  { id: 'embroidery', label: 'ผ้าปัก' },
  {
    id: 'pottery',
    label: 'เครื่องปั้นดินเผา',
    hint: 'เครื่องปั้นดินเผาใช้ดินเหนียวขึ้นรูปแล้วเผาไฟ ไม่ได้ทำบนผืนผ้า ลองนึกถึงคำว่า "ผืนผ้า" ในปริศนา',
  },
];

export const sakNgamQuizzes: QuizDefinition[] = [
  {
    id: 'wisdom',
    speaker: 'ผู้ใหญ่บ้าน',
    question:
      'ปริศนา: "เส้นด้ายหลากสีเดินทางบนผืนผ้าทีละฝีเข็ม จนกลายเป็นลวดลายเล่าเรื่อง" ภูมิปัญญาที่ลุงพูดถึงคืออะไร?',
    choices: WISDOM_CHOICES,
    correctChoiceId: 'embroidery',
    fallbackHint: 'ลองฟังปริศนาอีกครั้ง: เข็ม ด้าย และผืนผ้า',
    correctFeedback: 'ถูกต้อง! ผ้าปักคือภูมิปัญญาที่บ้านไหนเจียวสืบทอดกันมา',
    effects: [{ type: 'flag', flag: 'quiz-wisdom' }],
  },
  {
    // ตัวเลือกคำนวณจากระยะจริงบนแผนที่ (×0.1, ×1, ×10) จึงไม่ขัดกับแผนที่แม้ย้ายตำแหน่ง
    id: 'scale',
    speaker: 'ผู้ใหญ่บ้าน',
    question: 'ลองคิดดูนะหลาน บนแผนที่ 1:10,000 ระยะ {{mapcm:sala>nai-chiao}} เซนติเมตร เท่ากับระยะจริงเท่าไร?',
    choices: [
      {
        id: 'times-ten',
        label: '{{dist:sala>nai-chiao*10}} เมตร',
        hint: 'มากเกินไป ลองคิดทีละขั้น: 1 ซม. บนแผนที่ = 10,000 ซม. จริง = 100 เมตร',
      },
      {
        id: 'tenth',
        label: '{{dist:sala>nai-chiao*0.1}} เมตร',
        hint: 'น้อยเกินไป 1 ซม. บนแผนที่ 1:10,000 คือ 10,000 ซม. จริง = 100 เมตร ไม่ใช่ 10 เมตร',
      },
      { id: 'correct', label: '{{dist:sala>nai-chiao}} เมตร' },
    ],
    correctChoiceId: 'correct',
    fallbackHint: '1 ซม. บนแผนที่ 1:10,000 = 100 เมตรจริง',
    correctFeedback:
      'ถูกต้อง! 1 ซม. บนแผนที่ = 100 เมตร ดังนั้น {{mapcm:sala>nai-chiao}} ซม. = {{dist:sala>nai-chiao}} เมตร (= {{dist:sala>nai-chiao*0.1}} ช่องตาราง)',
    effects: [{ type: 'flag', flag: 'quiz-scale' }],
  },
];

export const sakNgamClues: ClueDefinition[] = [
  {
    id: 'clue-sala',
    type: 'direction',
    source: 'ครูเนม',
    text: 'ศาลาชุมชนอยู่ทาง{{dir:school>sala}}ของเสาธงโรงเรียน ห่างเป็นเส้นตรงประมาณ {{dist:school>sala}} เมตร',
  },
  {
    id: 'clue-direction',
    type: 'direction',
    source: 'ผู้ใหญ่บ้าน',
    text: 'แหล่งผ้าปักบ้านไหนเจียวอยู่ทาง{{dir:sala>nai-chiao}}ของศาลาชุมชน',
  },
  {
    id: 'clue-distance',
    type: 'distance',
    source: 'ผู้ใหญ่บ้าน',
    text: 'บนแผนที่มาตราส่วน 1:10,000 ระยะเส้นตรงจากศาลาชุมชนถึงแหล่งผ้าปักวัดได้ {{mapcm:sala>nai-chiao}} เซนติเมตร',
  },
  {
    id: 'clue-bridge',
    type: 'landmark',
    source: 'ลุงคำ',
    text: 'ช่างผ้าปักบ้านไหนเจียวต้องข้ามสะพานไม้ข้ามห้วยสาขาทุกครั้งที่นำผ้ามาที่ศาลา (ห้วยสาขามีสะพานไม้แห่งเดียว)',
  },
  {
    id: 'clue-old-cloth',
    type: 'distance',
    source: 'ป้านวล (ลายผ้าผืนแรก)',
    text: 'ลายบอกทางบนผ้าปักผืนแรก: จากบ้านไหนเจียว มุ่ง{{dir:nai-chiao>old-banyan}} {{mapcm:nai-chiao>old-banyan}} เซนติเมตรบนแผนที่ 1:10,000 คือที่นั่งปักผ้าใต้ต้นไม้ใหญ่ของบรรพบุรุษ',
  },
  {
    id: 'clue-fork',
    type: 'landmark',
    source: 'ป้าศรี',
    text: 'ที่ต้นสักใหญ่ ถนนแยกเป็นสองทาง: ตรงขึ้นทิศเหนือ หรือเลี้ยวไปทิศตะวันออก ระยะเดินพอ ๆ กัน แต่มีทางเดียวที่ข้ามห้วยสาขา',
  },
];

export const sakNgamEvidence: EvidenceDefinition[] = [
  {
    id: 'evidence-pattern',
    name: 'ภาพร่างลวดลายผ้าปัก',
    description: 'ภาพร่างลวดลายที่ป้านวล ช่างผ้าปักบ้านไหนเจียว วาดให้ระหว่างการสำรวจ',
  },
  {
    id: 'evidence-old-cloth',
    name: 'เศษผ้าปักลายโบราณ',
    description: 'เศษผ้าปักเก่าที่พบใต้ต้นไม้ใหญ่ ทางตะวันตกของบ้านไหนเจียว ตรงกับลายบอกทางบนผ้าผืนแรก',
  },
];

/** จุดตรวจค้น (กด E) — ที่นั่งปักผ้าของบรรพบุรุษ เปิดให้ค้นเมื่อได้เบาะแสลายผ้าผืนแรกแล้ว */
export const sakNgamInspectPoints: InspectPoint[] = [
  {
    id: 'old-banyan-spot',
    at: { x: 40, y: 13 },
    radiusTiles: 1.5,
    when: { clues: ['clue-old-cloth'], notFlags: ['mystery-found'] },
    nodes: [
      {
        speaker: 'สมุดภาคสนาม',
        text: 'ใต้ต้นไม้ใหญ่ตรงนี้มีม้านั่งไม้เก่า ๆ ในโพรงไม้มีเศษผ้าปักลายโบราณซุกอยู่!',
        effects: [
          { type: 'evidence', evidenceId: 'evidence-old-cloth' },
          { type: 'flag', flag: 'mystery-found' },
        ],
      },
      {
        speaker: 'สมุดภาคสนาม',
        text: 'จุดนี้อยู่{{dir:nai-chiao>old-banyan}}ของบ้านไหนเจียว ห่าง {{dist:nai-chiao>old-banyan}} เมตร = {{mapcm:nai-chiao>old-banyan}} ซม. บนแผนที่ ตรงกับลายผ้าผืนแรก',
      },
    ],
  },
];

/**
 * ภารกิจของด่าน — สถานะ: ล็อก → กำลังทำ → สำเร็จ
 * ภารกิจหลักต้องทำให้จบด่าน ส่วนภารกิจรองและภารกิจปริศนาเป็นทางเลือก (นับในหน้าสรุปผล)
 */
export const sakNgamQuests: QuestDefinition[] = [
  {
    id: 'main-sakngam',
    kind: 'main',
    title: 'ปริศนาลวดลายแห่งสักงาม',
    description: 'ค้นหาแหล่งภูมิปัญญาของชุมชนตามปริศนาของผู้ใหญ่บ้าน บันทึกตำแหน่ง และรับรหัสลับชิ้นที่ 1',
    lockedHint: '',
    objectives: [
      { text: 'รับภารกิจจากครูเนมที่โรงเรียนสักงาม', done: { type: 'step', order: 1 } },
      { text: 'เดินทางไปศาลาชุมชน', done: { type: 'step', order: 2 } },
      { text: 'ไขปริศนาภูมิปัญญาของผู้ใหญ่บ้าน', done: { type: 'step', order: 3 } },
      { text: 'รวบรวมเบาะแสและเลือกเส้นทางที่ตรงกับหลักฐาน', done: { type: 'step', order: 4 } },
      { text: 'สำรวจแหล่งผ้าปักบ้านไหนเจียว', done: { type: 'step', order: 5 } },
      { text: 'ปักหมุดตำแหน่งและรับรหัสลับชิ้นที่ 1', done: { type: 'step', order: 6 } },
    ],
  },
  {
    id: 'side-measure',
    kind: 'side',
    title: 'นักวัดระยะ',
    description: 'ครูเนมชวนให้ฝึกใช้เครื่องมือ: วัดระยะเดินจริงด้วยตัวเอง แล้วเทียบกับระยะเส้นตรงในสมุดภาคสนาม',
    unlockWhen: { minStep: 2 },
    lockedHint: 'รับภารกิจจากครูเนมก่อน',
    objectives: [
      { text: 'กด R เพื่อเริ่มวัดระยะเดินจริง', done: { type: 'skill', skill: 'odometer' } },
      { text: 'เปิดหน้า "วิเคราะห์เส้นทาง" ในสมุดภาคสนาม', done: { type: 'skill', skill: 'straight-vs-route' } },
      { text: 'เดินสำรวจให้ถึงปลายทางอย่างน้อย 2 เส้นทาง', done: { type: 'routesExplored', count: 2 } },
    ],
    reward: { text: 'บันทึกในสมุด: ระยะตามถนนยาวกว่าระยะเส้นตรงเสมอ' },
  },
  {
    id: 'side-bridges',
    kind: 'side',
    title: 'สองสะพานแห่งสักงาม',
    description: 'ลุงคำเล่าว่าสักงามมีสะพานข้ามลำน้ำสองแห่ง ไปสำรวจให้ครบ แล้วสังเกตว่าแต่ละแห่งข้ามลำน้ำสายใด',
    unlockWhen: { clues: ['clue-bridge'] },
    lockedHint: 'ฟังเรื่องเล่าจากชาวบ้านที่หาปลาริมลำห้วย',
    objectives: [
      { text: 'สำรวจสะพานข้ามลำห้วยใหญ่', done: { type: 'discover', landmarkId: 'bridge' } },
      { text: 'สำรวจสะพานไม้ข้ามห้วยสาขา', done: { type: 'discover', landmarkId: 'wood-bridge' } },
    ],
    reward: { text: 'บันทึกในสมุด: สะพานเป็นจุดสังเกตที่ช่วยยืนยันเส้นทางได้' },
  },
  {
    id: 'mystery-old-cloth',
    kind: 'mystery',
    title: 'ลายผ้าผืนแรก',
    description: 'ผ้าปักผืนแรกของหมู่บ้านมีลายบอกทางซ่อนอยู่ ใช้ทิศและมาตราส่วนตามหาที่นั่งปักผ้าของบรรพบุรุษ',
    unlockWhen: { flags: ['evidence-collected'] },
    lockedHint: '??? — พูดคุยกับผู้รู้เรื่องผ้าปักให้ครบก่อน',
    objectives: [
      { text: 'ฟังเรื่องลายผ้าผืนแรกจากป้านวล', done: { type: 'clue', clueId: 'clue-old-cloth' } },
      { text: 'ตามลายผ้าไปหาที่นั่งปักผ้าของบรรพบุรุษ แล้วกด E ตรวจค้น', done: { type: 'flag', flag: 'mystery-found' } },
    ],
    reward: { text: 'ได้หลักฐานพิเศษ: เศษผ้าปักลายโบราณ' },
  },
];

export const sakNgamTriggers: TriggerZone[] = [
  // เดินมาถึงศาลาชุมชน (ลานหน้าศาลา + ถนนหน้าศาลา) → ผู้ใหญ่บ้านเริ่มคุยอัตโนมัติ
  // พื้นที่อยู่ในรัศมีเปิดหมอก (5 ช่อง) จากผู้ใหญ่บ้าน ผู้เล่นจึงเห็นตัวผู้ใหญ่บ้านเสมอ
  { id: 'arrive-sala', area: { x: 44, y: 44, w: 8, h: 6 }, npcId: 'headman', when: { minStep: 2, maxStep: 2 } },
];

export const sakNgamRouteAnalysis: RouteAnalysisDefinition = {
  originId: 'sala',
  targetId: 'nai-chiao',
  routes: [
    {
      id: 'route-west',
      label: 'ก',
      description: 'จากถนนหลัก เลี้ยวขึ้นทิศเหนือที่ทางแยกฝั่งตะวันตกของศาลา',
      to: 'pottery',
    },
    {
      id: 'route-north',
      label: 'ข',
      description: 'จากถนนหลัก เลี้ยวขึ้นทิศเหนือทางฝั่งตะวันออก ถึงต้นสักใหญ่แล้วตรงขึ้นเหนือต่อ',
      to: 'nai-chiao',
    },
    {
      id: 'route-east',
      label: 'ค',
      description: 'จากถนนหลัก เลี้ยวขึ้นทิศเหนือทางฝั่งตะวันออก ถึงต้นสักใหญ่แล้วเลี้ยวไปทิศตะวันออก',
      to: 'basketry',
    },
  ],
  correctRouteId: 'route-north',
  requiredClueIds: ['clue-direction', 'clue-distance', 'clue-bridge'],
  requiredLandmarkId: 'wood-bridge',
  // วัดบนแผนที่คลาดเคลื่อนได้ ±0.2 ซม. (= ±20 ม. ที่มาตราส่วน 1:10,000)
  distanceToleranceMapCm: 0.2,
  successFlag: 'route-correct',
};

export const sakNgamPinTask: PinTaskDefinition = {
  targetId: 'nai-chiao',
  toleranceTiles: 2,
  wisdomPrompt: 'ภูมิปัญญาที่สำรวจพบ ณ ตำแหน่งนี้คือประเภทใด',
  wisdomChoices: WISDOM_CHOICES.map(({ id, label }) => ({ id, label })),
  correctWisdomId: 'embroidery',
  requiredEvidenceIds: ['evidence-pattern'],
  availableWhen: { flags: ['route-correct'] },
  successFlag: 'pin-verified',
};

export const sakNgamEnding: EndingDefinition = {
  messages: [
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ครูได้รับหมุดตำแหน่งแหล่งผ้าปักบ้านไหนเจียวแล้ว ถูกต้องทั้งพิกัด ประเภทภูมิปัญญา และหลักฐานการสำรวจ!',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'เราใช้ทิศทาง: บ้านไหนเจียวอยู่ทาง{{dir:sala>nai-chiao}}ของศาลา และใช้มาตราส่วน: {{mapcm:sala>nai-chiao}} ซม. บนแผนที่ 1:10,000 เท่ากับ {{dist:sala>nai-chiao}} เมตรจริง',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ระยะเส้นตรงคือ {{dist:sala>nai-chiao}} เมตร แต่ระยะเดินตามถนนประมาณ {{route:route-north}} เมตร เพราะถนนไม่ได้ตรงไปยังเป้าหมาย',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'เส้นทางไปลานจักสานมีทิศและระยะใกล้เคียงกัน แต่จุดสังเกตอย่างสะพานไม้ช่วยให้เราแยกเส้นทางที่ถูกต้องได้',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'ครูมอบรหัสลับชิ้นที่ 1 และแผนที่ตำบลสักงามให้ เก็บไว้ใช้ในภารกิจตำบลถัดไปนะ',
    },
  ],
  // ค่ารหัสเป็น placeholder — กำหนดรหัสจริงของทั้ง 4 ตำบลภายหลัง
  codePiece: { index: 1, total: 4, value: 'ลาย' },
  rewardItem: 'แผนที่ตำบลสักงาม',
  completeFlag: 'mission-complete',
};

export const sakNgamStory: StoryStep[] = [
  {
    order: 1,
    title: 'ครูเนมมอบภารกิจที่โรงเรียนสักงาม',
    objective: 'คุยกับครูเนมเพื่อรับภารกิจ',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'talk', npcId: 'teacher-nem' },
  },
  {
    order: 2,
    title: 'เดินทางไปศาลาชุมชน',
    objective: 'ใช้ทิศและระยะทางจากครูเนมเดินไปศาลาชุมชน',
    landmarkId: 'sala',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'met-headman' },
  },
  {
    order: 3,
    title: 'ผู้ใหญ่บ้านเปิดเผยปริศนาผ้าปัก',
    objective: 'ตอบปริศนาของผู้ใหญ่บ้าน และรับเบาะแสเรื่องแหล่งภูมิปัญญา',
    landmarkId: 'sala',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'quiz-wisdom' },
  },
  {
    order: 4,
    title: 'รวบรวมเบาะแสและเปรียบเทียบเส้นทาง',
    objective: 'หาเบาะแสทิศทาง ระยะทาง จุดสังเกต แล้วเลือกเส้นทางในสมุด (N)',
    landmarkId: 'big-teak',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'route-correct' },
  },
  {
    order: 5,
    title: 'สำรวจแหล่งผ้าปักบ้านไหนเจียว',
    objective: 'เดินทางตามเส้นทางที่วิเคราะห์ แล้วพูดคุยกับช่างผ้าปัก',
    landmarkId: 'nai-chiao',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'evidence-collected' },
  },
  {
    order: 6,
    title: 'บันทึกตำแหน่ง รับรหัส และจบภารกิจ',
    objective: 'เปิดแผนที่ (M) ปักหมุดตำแหน่งและเลือกประเภทภูมิปัญญา',
    landmarkId: 'nai-chiao',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];
