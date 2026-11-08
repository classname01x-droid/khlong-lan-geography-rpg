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
    question: 'งานฝีมือที่ใช้เข็มกับด้ายสร้างลวดลายลงบนผืนผ้า เธอคิดว่าคืออะไร?',
    choices: WISDOM_CHOICES,
    correctChoiceId: 'embroidery',
    fallbackHint: 'ลองฟังปริศนาอีกครั้ง: เข็ม ด้าย และผืนผ้า',
    correctFeedback: 'ถูกแล้ว! เป็นภูมิปัญญาผ้าปักที่เราต้องไปค้นหา',
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
      {
        speaker: 'สมุดภาคสนาม',
        text: 'มุมผ้ามีตัวอักษรปักซ่อนไว้หนึ่งคำ — ส่งข้อมูลให้ครูเนมยืนยันคำพิทักษ์ (ต้องปักหมุดบ้านผ้าปักให้ถูกด้วย)',
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
    title: 'ช่วยชาวบ้านสักงาม รับคำพิทักษ์คำแรก',
    description: 'ในฐานะผู้นำชุมชนคนใหม่ ช่วยชาวบ้านตามหาแหล่งผ้าปักของตำบลสักงาม แล้วรับคำพิทักษ์คำแรกเพื่อช่วยพญาจระเข้',
    lockedHint: '',
    objectives: [
      { text: 'รับภารกิจจากครูเนมที่โรงเรียนสักงาม', done: { type: 'step', order: 1 } },
      { text: 'ไปพบผู้ใหญ่บ้านที่ศาลาชุมชน', done: { type: 'step', order: 2 } },
      { text: 'ตอบคำถามเรื่องงานฝีมือของผู้ใหญ่บ้าน', done: { type: 'step', order: 3 } },
      { text: 'ฟังข้อมูลจากป้าศรีและลุงคำ วัดระยะจากศาลา แล้วเลือกเส้นทางบนกระดานวิเคราะห์', done: { type: 'step', order: 4 } },
      { text: 'ออกสำรวจตามเส้นทาง ค้นหาแหล่งผ้าปัก แล้วคุยกับช่างผ้าปัก', done: { type: 'step', order: 5 } },
      { text: 'ปักหมุดบ้านผ้าปักบนแผนที่', done: { type: 'step', order: 6 } },
      { text: 'ไขปริศนาลายผ้าผืนแรก แล้วรับคำพิทักษ์คำแรก', done: { type: 'step', order: 7 } },
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
  // รหัสได้หลังปักหมุดถูก "และ" ไขปริศนาลายผ้าผืนแรกด้วยตัวเอง (ทำอย่างไหนก่อนก็ได้) — ไม่ได้จากการคุยหรือเดินถึงจุดเดียว
  startWhen: { flags: ['pin-verified', 'mystery-found'] },
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
      text: 'และเศษผ้าปักโบราณที่เธอตามหาเจอ มีคำว่า "ลาย" ปักซ่อนไว้ — นี่คือคำพิทักษ์คำแรก!',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'เยี่ยมมาก! เราได้คำพิทักษ์คำแรกแล้ว เหลืออีก 3 คำ ครูมอบแผนที่ตำบลสักงามให้เก็บไว้ด้วยนะ',
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
    title: 'ฟังข้อมูลจากป้าศรีและลุงคำ แล้วเลือกเส้นทาง',
    objective: 'ไปพบป้าศรี → ลุงคำ → อ่านสมุด → วัดระยะจากศาลา → เลือกเส้นทางบนกระดานวิเคราะห์เส้นทาง',
    landmarkId: 'big-teak',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'route-correct' },
  },
  {
    order: 5,
    title: 'ออกสำรวจ ค้นหาแหล่งผ้าปัก และคุยกับช่างผ้าปัก',
    objective: 'เดินตามเส้นทางที่เลือก ดูระยะจากศาลาบนแถบวัดระยะ แล้วคุยกับช่างผ้าปัก',
    landmarkId: 'nai-chiao',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'evidence-collected' },
  },
  {
    order: 6,
    title: 'ปักหมุดบ้านผ้าปัก',
    objective: 'เปิดแผนที่ (M) เลื่อนหมุดไปตำแหน่งแหล่งผ้าปัก กดปักหมุด แล้วเลือกประเภทภูมิปัญญา',
    landmarkId: 'nai-chiao',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'pin-verified' },
  },
  {
    order: 7,
    title: 'ไขปริศนาลายผ้าผืนแรก รับคำพิทักษ์คำแรก',
    objective: 'อ่านปริศนาในสมุด วัดระยะจากบ้านไหนเจียว เดินตามทิศและระยะ แล้วกด E สำรวจจุดซ่อน',
    landmarkId: 'nai-chiao',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];

/* ---------------- ขั้นย่อยของบทที่ 1 (v0.19: นำทางด้วย "การกระทำ") ----------------
 * ช่วงที่ 1 รับภารกิจ (3 ขั้น) → ช่วงที่ 2 ตามหาแหล่งผ้าปัก (13 ขั้น)
 * ทุกขั้นบอก: ทำอะไร · ใช้เครื่องมืออะไร · กด/แตะตรงไหน ({tap:...} แปลงตามอุปกรณ์) · สำเร็จแล้วเกิดอะไร
 * นำทาง (target) เฉพาะ NPC ที่มีคนบอกตำแหน่งแล้ว — ไม่นำทางไปบ้านผ้าปักหรือจุดปริศนา
 * วัดระยะ (measure) จากจุดอ้างอิงของภารกิจ: ศาลาชุมชน (ระหว่างวิเคราะห์/เดินทาง) · บ้านไหนเจียว (ปริศนาลายผ้า)
 * สำเร็จตามสถานะจริงของเกม · ไม่บอกเส้นทางที่ถูก ตำแหน่งลับ หรือคำตอบ
 */
export const SAKNGAM_PHASES = [
  { id: 'prep', title: 'ช่วงที่ 1 · รับภารกิจ' },
  { id: 'main', title: 'ช่วงที่ 2 · ตามหาแหล่งผ้าปัก' },
];

const MICRO: Record<number, NonNullable<StoryStep['micro']>> = {
  1: [
    {
      id: 'talk-nem',
      phase: 'prep',
      goal: 'ไปคุยกับครูเนม',
      tools: ['ปุ่มคุย'],
      steps: ['มองหาครูเนม (มีเครื่องหมาย ! เหนือหัว) ในโรงเรียน', '{walk} ไปใกล้ ๆ จนมีป้าย "คุย" ขึ้น', '{tap:talk} แล้ว{next}จนจบ'],
      result: 'ได้รับภารกิจ และครูเนมบอกทิศกับระยะไปศาลาชุมชน (จดลงสมุดให้เอง)',
      tool: 'ถ้ามองไม่เห็นครูเนม ดูลูกศรสีเหลืองที่ขอบจอ — ลูกศรชี้ไปทางที่ครูเนมอยู่',
      think: 'พญาจระเข้จะสงบได้ด้วยคำพิทักษ์ 4 คำ — ไปฟังว่าคำแรกเริ่มหาจากที่ไหน',
      doneText: '✓ รับภารกิจสำเร็จ!',
      target: { npcId: 'teacher-nem' },
      done: { type: 'talk', npcId: 'teacher-nem' },
    },
  ],
  2: [
    {
      id: 'go-sala',
      phase: 'prep',
      goal: 'ไปพบผู้ใหญ่บ้านที่ศาลาชุมชน',
      tools: ['ลูกศรนำทาง', 'แผนที่', 'เข็มทิศ'],
      steps: ['ดูลูกศรสีเหลืองที่ขอบจอ — ชี้ไปทางผู้ใหญ่บ้าน', '{walk} ตามถนนจนถึงลานหน้าศาลา', 'ผู้ใหญ่บ้านจะทักเอง แล้ว{next}'],
      result: 'ผู้ใหญ่บ้านเล่าเรื่องคำพิทักษ์คำแรก แล้วถามคำถามหนึ่งข้อ',
      tool: '{tap:guide} ดูว่าศาลาอยู่ตรงไหน (จุด ! สีเหลือง) เทียบกับจุดสีแดงที่เป็นตัวเรา',
      think: 'ครูเนมบอกว่าศาลาอยู่ทาง{{dir:school>sala}}ของเสาธง ห่าง {{dist:school>sala}} เมตร — 1 ช่อง = 10 เมตร ต้องเดินประมาณกี่ช่อง?',
      doneText: '✓ ถึงศาลาชุมชนแล้ว!',
      target: { npcId: 'headman' },
      done: { type: 'flag', flag: 'met-headman' },
    },
  ],
  3: [
    {
      id: 'quiz-wisdom',
      phase: 'prep',
      goal: 'ตอบคำถามของผู้ใหญ่บ้าน',
      tools: ['กล่องคำถาม'],
      steps: ['อ่านคำถามในกล่องข้อความ', '{choose}ที่คิดว่าถูก', 'ถ้าผิด จะได้คำใบ้ แล้วเลือกใหม่ได้'],
      result: 'ได้เบาะแสทิศทางและระยะทางไปแหล่งภูมิปัญญา แล้วผู้ใหญ่บ้านจะบอกให้ไปพบป้าศรีและลุงคำ',
      tool: 'ถ้ากล่องคำถามปิดไปแล้ว เดินกลับไปหาผู้ใหญ่บ้านแล้ว{tap:talk}',
      think: 'งานฝีมือแต่ละอย่างใช้วัสดุอะไร? อย่างไหนใช้เข็มกับด้ายบนผืนผ้า',
      doneText: '✓ ตอบถูกแล้ว! เริ่มช่วงที่ 2',
      target: { npcId: 'headman' },
      done: { type: 'flag', flag: 'quiz-wisdom' },
    },
  ],
  4: [
    {
      id: 'go-sri',
      phase: 'main',
      goal: 'ไปพบป้าศรี',
      tools: ['ลูกศรนำทาง', 'แผนที่'],
      steps: ['ป้าศรีอยู่ที่ต้นสักใหญ่ ทาง{{dir:sala>big-teak}}ของศาลา — ดูลูกศรสีเหลืองที่ขอบจอ', '{walk} ตามถนนจนเห็นป้าศรี (มีเครื่องหมาย ! เหนือหัว)'],
      result: 'เมื่อเดินถึงใกล้ป้าศรี ปุ่ม "คุย" จะขึ้น',
      tool: '{tap:guide} ดูตำแหน่งป้าศรีบนแผนที่ (จุด ! สีเหลือง)',
      think: 'ป้าศรีอยู่ทิศไหนของศาลา? ลองดูเข็มทิศระหว่างเดินว่าเรากำลังหันไปทางนั้นไหม',
      doneText: '✓ ถึงป้าศรีแล้ว!',
      target: { npcId: 'villager-sri' },
      done: { type: 'near', npcId: 'villager-sri' },
      impliedByNext: true,
    },
    {
      id: 'talk-sri',
      phase: 'main',
      goal: 'คุยกับป้าศรี',
      tools: ['ปุ่มคุย'],
      steps: ['เดินเข้าใกล้ป้าศรีจนมีป้าย "คุย"', '{tap:talk} แล้ว{next}จนจบ'],
      result: 'ได้เบาะแส "ทางแยกที่ต้นสักใหญ่" จดลงสมุดให้เอง',
      tool: 'ถ้าปุ่มคุยยังไม่ขึ้น ให้เดินเข้าไปชิดป้าศรีอีกนิด',
      think: 'ที่ทางแยก ถนนแต่ละทางไปทางทิศไหน?',
      doneText: '✓ ได้ข้อมูลทางแยกจากป้าศรีแล้ว!',
      target: { npcId: 'villager-sri' },
      done: { type: 'clue', clueId: 'clue-fork' },
    },
    {
      id: 'go-kham',
      phase: 'main',
      goal: 'ไปพบลุงคำ',
      tools: ['ลูกศรนำทาง', 'แผนที่'],
      steps: ['ลุงคำหาปลาอยู่ริมลำห้วยใหญ่ ใกล้สะพานบนถนนหลัก — ดูลูกศรสีเหลืองที่ขอบจอ', '{walk} ไปจนเห็นลุงคำ (มีเครื่องหมาย ! เหนือหัว)'],
      result: 'เมื่อเดินถึงใกล้ลุงคำ ปุ่ม "คุย" จะขึ้น',
      tool: '{tap:guide} ดูตำแหน่งลุงคำบนแผนที่ (จุด ! สีเหลือง)',
      think: 'ลุงคำอยู่ทิศไหนของต้นสักใหญ่? ต้องเดินกลับลงไปที่ถนนหลักก่อนหรือไม่',
      doneText: '✓ ถึงลุงคำแล้ว!',
      target: { npcId: 'fisher-kham' },
      done: { type: 'near', npcId: 'fisher-kham' },
      impliedByNext: true,
    },
    {
      id: 'talk-kham',
      phase: 'main',
      goal: 'คุยกับลุงคำ',
      tools: ['ปุ่มคุย'],
      steps: ['เดินเข้าใกล้ลุงคำจนมีป้าย "คุย"', '{tap:talk} แล้ว{next}จนจบ'],
      result: 'ได้เบาะแส "สะพานไม้ข้ามห้วยสาขา" จดลงสมุดให้เอง',
      tool: 'ถ้าปุ่มคุยยังไม่ขึ้น ให้เดินเข้าไปชิดลุงคำอีกนิด',
      think: 'ช่างผ้าปักต้องข้ามลำน้ำสายไหน และข้ามที่ไหน?',
      doneText: '✓ ได้ข้อมูลสะพานจากลุงคำแล้ว!',
      target: { npcId: 'fisher-kham' },
      done: { type: 'clue', clueId: 'clue-bridge' },
    },
    {
      id: 'read-clues',
      phase: 'main',
      goal: 'เปิดสมุดภาคสนาม อ่านเบาะแส',
      tools: ['สมุดภาคสนาม'],
      steps: ['{tap:guide} — สมุดจะเปิดหน้าเบาะแสให้เอง', 'อ่านข้อมูลจากป้าศรี (ทางแยก) และลุงคำ (สะพาน) ที่มีป้าย "ใหม่"', 'อ่านจบแล้ว{tap:closeBook}'],
      result: 'ต่อไปจะเริ่มวัดระยะจากศาลาชุมชน',
      tool: 'เบาะแสเรียงตามลำดับที่ได้รับ แต่ละข้อมีไอคอนบอกชนิด: 🧭 ทิศทาง · 📏 ระยะทาง · 📍 จุดสังเกต',
      think: 'ตอนนี้เรารู้ทิศ ระยะเส้นตรง และจุดสังเกตที่ต้องผ่านแล้วหรือยัง?',
      doneText: '✓ อ่านเบาะแสครบแล้ว!',
      action: 'clues',
      notebookTab: 'clues',
      done: { type: 'all', of: [{ type: 'flag', flag: 'read:clue-fork' }, { type: 'flag', flag: 'read:clue-bridge' }] },
      impliedByLater: true,
    },
    {
      id: 'start-measure',
      phase: 'main',
      goal: 'เริ่มวัดระยะจากศาลาชุมชน',
      tools: ['เครื่องมือวัดระยะ'],
      steps: ['{tap:guide} (หรือ{tap:measure})', 'เกมจะเริ่มวัดจาก "ศาลาชุมชน" ให้เอง — ดูเส้นสีเหลืองจากศาลามาถึงตัวเรา', 'ตัวเลข "ระยะจากศาลาชุมชน" จะเปลี่ยนตามที่เราเดิน'],
      result: 'แถบวัดระยะจะอยู่บนจอตลอด ใช้ตรวจระยะระหว่างเดินทาง',
      tool: 'ระยะที่วัดคือ "เส้นตรง" จากศาลาถึงตัวเรา ไม่ใช่ระยะที่เดินมาทั้งหมด · 1 ช่อง = 10 เมตร',
      think: 'ผู้ใหญ่บ้านบอกว่าแหล่งผ้าปักห่างจากศาลา {{mapcm:sala>nai-chiao}} ซม. บนแผนที่ 1:10,000 — เท่ากับกี่เมตร?',
      doneText: '✓ เริ่มวัดจากศาลาชุมชนแล้ว!',
      action: 'measure',
      actionLabel: '📏 วัดจากศาลา',
      measure: { from: 'sala' },
      done: { type: 'flag', flag: 'measured:sala' },
    },
    {
      id: 'open-routes',
      phase: 'main',
      goal: 'เปิดกระดานวิเคราะห์เส้นทาง',
      tools: ['กระดานวิเคราะห์เส้นทาง'],
      steps: ['{tap:guide} (หรือ{tap:routes})', 'ดูข้อมูลเส้นทาง ก ข และ ค', 'เทียบทิศทาง ระยะทาง และสะพาน กับเบาะแสด้านบนของกระดาน'],
      result: 'เมื่อกระดานเปิดแล้ว ขั้นต่อไปคือเลือกเส้นทาง',
      tool: 'กระดานวิเคราะห์เส้นทางอยู่ในสมุด หน้า "วิเคราะห์เส้นทาง" — ปุ่มลัดเปิดให้ตรงหน้านั้นเลย',
      think: 'เส้นทางแต่ละเส้นไปทางทิศไหน และผ่านสะพานใดบ้าง?',
      doneText: '✓ เปิดกระดานวิเคราะห์เส้นทางแล้ว!',
      action: 'routes',
      notebookTab: 'routes',
      measure: { from: 'sala' },
      done: { type: 'skill', skill: 'straight-vs-route' },
    },
    {
      id: 'choose-route',
      phase: 'main',
      goal: 'เลือกเส้นทางที่ตรงกับข้อมูล',
      tools: ['กระดานวิเคราะห์เส้นทาง', 'แผนที่'],
      steps: ['{tap:guide}', 'อ่านเบาะแส 3 ชนิดด้านบนของกระดาน (ทิศ · ระยะ · สะพาน)', '{choose}เส้นทาง ก ข หรือ ค ที่ตรงกับข้อมูลทุกข้อ'],
      result: 'ถ้าตรงทุกข้อ เกมบันทึกเส้นทางแล้วไปขั้นออกสำรวจ · ถ้ายังไม่ตรง กระดานบอกว่าข้อมูลใดขัดแย้ง แล้วเลือกใหม่ได้',
      tool: '{tap:map} ดูต้นสักใหญ่และลำห้วยที่สำรวจแล้ว · ระยะบนแผนที่ (ซม.) × 100 = เมตรจริง',
      think: 'เส้นทางใดผ่านสะพานตามที่ลุงคำบอก และปลายทางอยู่ทางทิศที่ผู้ใหญ่บ้านบอก?',
      doneText: '✓ วิเคราะห์เส้นทางสำเร็จ!',
      action: 'routes',
      actionLabel: '🔍 เลือกเส้นทาง',
      notebookTab: 'routes',
      measure: { from: 'sala' },
      done: { type: 'flag', flag: 'route-correct' },
    },
  ],
  5: [
    {
      id: 'travel',
      phase: 'main',
      goal: 'ออกสำรวจตามเส้นทางที่เลือก',
      tools: ['แผนที่', 'เข็มทิศ', 'วัดระยะ'],
      steps: ['{walk} ตามถนนของเส้นทางที่เลือก', 'มองหาจุดสังเกตที่ชาวบ้านบอกระหว่างทาง', 'ดู "ระยะจากศาลาชุมชน" บนแถบวัดระยะระหว่างเดิน'],
      result: 'เมื่อผ่านจุดสังเกตบนเส้นทาง จะไปขั้นค้นหาแหล่งผ้าปัก',
      tool: '{tap:map} ดูว่าเดินมาถูกทิศไหม · ถ้าแถบวัดระยะหายไป {tap:measure} เกมจะวัดจากศาลาให้เหมือนเดิม',
      think: 'ผ่านจุดสังเกตที่ชาวบ้านบอกแล้วหรือยัง? ถ้ายัง อาจเดินผิดทาง',
      doneText: '✓ มาถูกทางแล้ว — พบจุดสังเกตบนเส้นทาง!',
      action: 'map',
      measure: { from: 'sala' },
      done: { type: 'discover', landmarkId: 'wood-bridge' },
      impliedByLater: true,
    },
    {
      id: 'find-place',
      phase: 'main',
      goal: 'ค้นหาแหล่งผ้าปัก',
      tools: ['วัดระยะ', 'เข็มทิศ', 'แผนที่'],
      steps: ['{walk} ต่อตามเส้นทาง', 'เทียบ "ระยะจากศาลาชุมชน" บนแถบวัดระยะ กับระยะที่คำนวณจากเบาะแส', 'เมื่อพบบ้านที่มีลานปักผ้า ชื่อสถานที่จะขึ้นบนจอ'],
      result: 'ชื่อแหล่งผ้าปักขึ้นบนจอและแผนที่ — ต่อไปคุยกับช่างผ้าปัก',
      tool: 'แถบวัดระยะบอกระยะเส้นตรงจากศาลาถึงตัวเราตอนนี้ — ใช้เทียบกับระยะในเบาะแสได้เลย',
      think: 'เบาะแสบอกว่าแหล่งผ้าปักอยู่ทิศไหนของศาลา และห่างกี่เมตร? ตอนนี้เราอยู่ห่างเท่าไรแล้ว',
      doneText: '✓ พบแหล่งผ้าปักแล้ว!',
      action: 'map',
      measure: { from: 'sala' },
      done: { type: 'discover', landmarkId: 'nai-chiao' },
    },
    {
      id: 'talk-nuan',
      phase: 'main',
      goal: 'คุยกับช่างผ้าปัก (ป้านวล)',
      tools: ['ปุ่มคุย'],
      steps: ['มองหาป้านวล (มีเครื่องหมาย ! เหนือหัว)', '{walk} เข้าไปใกล้ แล้ว{tap:talk}', '{next}จนจบ'],
      result: 'ได้หลักฐาน "ภาพร่างลวดลายผ้าปัก" และปริศนาลายผ้าผืนแรก (จดลงสมุดให้เอง)',
      tool: 'ป้านวลอยู่ที่ลานหน้าบ้านผ้าปัก',
      think: 'ภูมิปัญญาผ้าปักทำอย่างไร และส่งต่อกันอย่างไร?',
      doneText: '✓ ได้หลักฐานลวดลายผ้าปักแล้ว!',
      // บอกตำแหน่งป้านวลได้หลังผู้เล่นค้นพบแหล่งผ้าปักเองแล้วเท่านั้น
      target: { npcId: 'embroiderer-nuan', when: { type: 'discover', landmarkId: 'nai-chiao' } },
      done: { type: 'flag', flag: 'evidence-collected' },
    },
  ],
  6: [
    {
      id: 'pin',
      phase: 'main',
      goal: 'ปักหมุดแหล่งผ้าปักบนแผนที่',
      tools: ['แผนที่', 'หมุด'],
      steps: ['ยืนใกล้แหล่งผ้าปัก แล้ว{tap:guide}', '{tapmap} ให้หมุดอยู่ตรงแหล่งผ้าปัก', '{tap:pinHere} แล้ว{choose}ประเภทภูมิปัญญา'],
      result: 'ครูเนมได้รับตำแหน่งผ่านสมุดภาคสนาม · ถ้ายังไม่ถูก ระบบบอกว่าข้อใดยังไม่ตรง (ตำแหน่ง ประเภท หรือหลักฐาน)',
      tool: 'ป้ายเหนือหมุดบอกพิกัด X · Y ของหมุด — เทียบกับจุดสีแดงที่เป็นตัวเรา',
      think: 'ตำแหน่งที่ปักตรงกับที่เราเดินมาถึงจริงไหม และภูมิปัญญาที่นี่คือประเภทใด?',
      doneText: '✓ ปักหมุดสำเร็จ!',
      action: 'pin',
      done: { type: 'flag', flag: 'pin-verified' },
    },
  ],
  7: [
    {
      id: 'read-riddle',
      phase: 'main',
      goal: 'อ่านปริศนาลายผ้าผืนแรก',
      tools: ['สมุดภาคสนาม'],
      steps: ['{tap:guide} — สมุดเปิดหน้าเบาะแสให้เอง', 'อ่านเบาะแสจากป้านวล: จุดเริ่ม · ทิศ · ระยะบนแผนที่ (ซม.)', 'อ่านจบแล้ว{tap:closeBook}'],
      result: 'ต่อไปเริ่มวัดระยะจากจุดเริ่มของปริศนา',
      tool: 'ปริศนาบอก 3 อย่าง: จุดเริ่ม ทิศ และระยะบนแผนที่ (ซม.)',
      think: 'ลายบอกทางเริ่มจากจุดไหน ไปทางทิศใด และไกลกี่เซนติเมตรบนแผนที่?',
      doneText: '✓ อ่านปริศนาแล้ว!',
      action: 'clues',
      notebookTab: 'clues',
      done: { type: 'flag', flag: 'read:clue-old-cloth' },
      impliedByLater: true,
    },
    {
      id: 'measure-riddle',
      phase: 'main',
      joinPrev: true,
      goal: 'เริ่มวัดระยะจากบ้านไหนเจียว',
      tools: ['เครื่องมือวัดระยะ'],
      steps: ['ยืนที่บ้านไหนเจียว แล้ว{tap:guide} (หรือ{tap:measure})', 'เกมเริ่มวัดจาก "แหล่งผ้าปักบ้านไหนเจียว" — เส้นสีเหลืองลากจากจุดนั้นมาถึงตัวเรา'],
      result: 'ตัวเลข "ระยะจากแหล่งผ้าปักบ้านไหนเจียว" เปลี่ยนตามที่เราเดิน',
      tool: 'ระยะที่วัดเป็นเส้นตรงจากบ้านไหนเจียวถึงตัวเรา · 1 ช่อง = 10 เมตร',
      think: 'ถ้าระยะบนแผนที่เป็น x ซม. ที่มาตราส่วน 1:10,000 จะเท่ากับ x × 100 เมตร',
      doneText: '✓ เริ่มวัดจากบ้านไหนเจียวแล้ว!',
      action: 'measure',
      actionLabel: '📏 วัดจากบ้านไหนเจียว',
      measure: { from: 'nai-chiao', allowReset: true },
      done: { type: 'flag', flag: 'measured:nai-chiao' },
      impliedByLater: true,
    },
    {
      id: 'find-cloth',
      phase: 'main',
      joinPrev: true,
      goal: 'เดินตามปริศนา แล้วสำรวจจุดซ่อน',
      tools: ['วัดระยะ', 'เข็มทิศ', 'สมุดภาคสนาม'],
      steps: ['คำนวณ: ระยะบนแผนที่ (ซม.) × 100 = กี่เมตร', '{walk} ไปตามทิศในปริศนา ดูแถบวัดระยะจนระยะตรงกับที่คำนวณ', 'เมื่อปุ่ม "สำรวจ" ขึ้น {tap:inspect}'],
      result: 'พบสิ่งที่ซ่อนอยู่ — เมื่อปักหมุดถูกแล้วด้วย ครูเนมจะมอบคำพิทักษ์คำแรก',
      tool: 'ถ้าเดินเลยหรือหลงทาง ใช้ปุ่ม "เริ่มวัดใหม่จากตรงนี้" บนแถบวัดระยะ หรือกลับไปบ้านไหนเจียวแล้ว{tap:measure}อีกครั้ง',
      think: 'บนแผนที่ 1:10,000 1 ซม. = 100 เมตร ระยะในปริศนาจึงเท่ากับกี่เมตร และกี่ช่อง?',
      doneText: '✓ พบเศษผ้าปักโบราณแล้ว!',
      measure: { from: 'nai-chiao', allowReset: true },
      done: { type: 'flag', flag: 'mystery-found' },
    },
  ],
};
for (const st of sakNgamStory) if (MICRO[st.order]) st.micro = MICRO[st.order];
