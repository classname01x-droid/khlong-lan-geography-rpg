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
        text: 'มุมผ้ามีตัวอักษรปักซ่อนไว้หนึ่งคำ — ส่งข้อมูลให้ครูเนมยืนยันรหัส (ต้องปักหมุดบ้านผ้าปักให้ถูกด้วย)',
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
    title: 'ตามหารหัสหีบสมบัติชิ้นแรก',
    description: 'ครูเนมพบหีบไม้เก่าที่มีช่องรหัส 4 ช่อง — ตามหารหัสชิ้นแรกจากภูมิปัญญาผ้าปักของตำบลสักงาม',
    lockedHint: '',
    objectives: [
      { text: 'รับภารกิจจากครูเนมที่โรงเรียนสักงาม', done: { type: 'step', order: 1 } },
      { text: 'ไปพบผู้ใหญ่บ้านที่ศาลาชุมชน', done: { type: 'step', order: 2 } },
      { text: 'ตอบคำถามเรื่องงานฝีมือของผู้ใหญ่บ้าน', done: { type: 'step', order: 3 } },
      { text: 'ถามชาวบ้าน แล้ววิเคราะห์เส้นทางในสมุด', done: { type: 'step', order: 4 } },
      { text: 'ตามหาบ้านผ้าปัก แล้วคุยกับช่างผ้าปัก', done: { type: 'step', order: 5 } },
      { text: 'ปักหมุดบ้านผ้าปักบนแผนที่', done: { type: 'step', order: 6 } },
      { text: 'ไขปริศนาลายผ้าผืนแรก แล้วรับรหัสชิ้นแรก', done: { type: 'step', order: 7 } },
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
      text: 'และเศษผ้าปักโบราณที่เธอตามหาเจอ มีคำว่า "ลาย" ปักซ่อนไว้ — นี่คือรหัสหีบชิ้นแรก!',
    },
    {
      speaker: 'ครูเนม (ผ่านสมุดภาคสนาม)',
      text: 'เยี่ยมมาก! เราได้รหัสชิ้นแรกแล้ว เหลืออีก 3 ชิ้น ครูมอบแผนที่ตำบลสักงามให้เก็บไว้ด้วยนะ',
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
    title: 'ปักหมุดบ้านผ้าปัก',
    objective: 'เปิดแผนที่ (M) ปักหมุดตำแหน่งและเลือกประเภทภูมิปัญญา',
    landmarkId: 'nai-chiao',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'pin-verified' },
  },
  {
    order: 7,
    title: 'ไขปริศนาลายผ้าผืนแรก รับรหัสชิ้นแรก',
    objective: 'ใช้ทิศและมาตราส่วนตามลายบอกทางบนผ้าผืนแรก แล้วตรวจค้นให้พบ',
    landmarkId: 'nai-chiao',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'mission-complete' },
  },
];

/* ---------------- ขั้นย่อย (Micro-Quest) ของบทที่ 1 ----------------
 * แสดงบนแถบภารกิจทีละขั้น: ตอนนี้ · วิธีทำ · คำแนะนำระดับ 2 (เครื่องมือ) · ระดับ 3 (คำถามช่วยคิด)
 * สำเร็จตามสถานะจริงของเกม · ไม่บอกเส้นทางที่ถูก ตำแหน่งลับ หรือคำตอบ
 * ข้อความในวงเล็บ (N) (M) (R) (E) แปลงเป็นชื่อปุ่มบนจอสัมผัสอัตโนมัติ
 */
const MICRO: Record<number, NonNullable<StoryStep['micro']>> = {
  1: [
    {
      id: 'talk-nem',
      goal: 'ไปคุยกับครูเนม',
      how: 'เดินเข้าใกล้ครูเนม แล้วกดคุย (E)',
      tool: 'ครูเนมยืนอยู่ในโรงเรียน มีเครื่องหมาย ! เหนือหัว — เดินไปใกล้จนมีป้าย "คุย" ขึ้น',
      think: 'ครูเนมพบหีบไม้เก่าที่ต้องใช้รหัส 4 ชิ้น — ไปฟังว่ารหัสชิ้นแรกเริ่มหาจากที่ไหน',
      doneText: '✓ รับภารกิจสำเร็จ!',
      tools: ['ปุ่มคุย'],
      done: { type: 'talk', npcId: 'teacher-nem' },
    },
  ],
  2: [
    {
      id: 'go-sala',
      goal: 'ไปพบผู้ใหญ่บ้านที่ศาลาชุมชน',
      how: 'เปิดแผนที่ (M) ดูทิศทางและระยะทางก่อนเดิน',
      tool: 'เปิดสมุด (N) หน้าเบาะแส อ่านทิศและระยะที่ครูเนมบอก แล้วใช้วัดระยะ (R) ระหว่างเดิน',
      think: 'ครูเนมบอกว่าศาลาอยู่ทิศไหนของเสาธง และไกลเท่าไร? 1 ช่อง = 10 เมตร ต้องเดินประมาณกี่ช่อง',
      doneText: '✓ ถึงศาลาชุมชนแล้ว!',
      tools: ['แผนที่', 'เข็มทิศ', 'วัดระยะ'],
      done: { type: 'flag', flag: 'met-headman' },
    },
  ],
  3: [
    {
      id: 'quiz-wisdom',
      goal: 'ตอบคำถามเรื่องงานฝีมือของผู้ใหญ่บ้าน',
      how: 'อ่านคำถาม แล้วเลือกคำตอบที่คิดว่าถูก',
      tool: 'ถ้าตอบผิด ผู้ใหญ่บ้านจะให้คำใบ้ แล้วตอบใหม่ได้',
      think: 'งานฝีมือแต่ละอย่างใช้วัสดุอะไร? อย่างไหนใช้เข็มกับด้ายบนผืนผ้า',
      doneText: '✓ ตอบถูกแล้ว!',
      tools: ['ปุ่มคุย'],
      done: { type: 'flag', flag: 'quiz-wisdom' },
    },
  ],
  4: [
    {
      id: 'talk-kham',
      goal: 'ไปคุยกับลุงคำ',
      how: 'ลุงคำหาปลาอยู่ริมลำห้วย ถามว่าต้องผ่านสะพานใด',
      tool: 'เปิดแผนที่ (M) ดูลำห้วยที่สำรวจแล้ว แล้วเดินไปตามริมลำห้วย',
      think: 'ช่างผ้าปักต้องข้ามลำน้ำสายไหน และข้ามที่ไหน?',
      doneText: '✓ ได้ข้อมูลสะพานจากลุงคำแล้ว!',
      tools: ['แผนที่', 'ปุ่มคุย'],
      done: { type: 'clue', clueId: 'clue-bridge' },
    },
    {
      id: 'talk-sri',
      goal: 'ไปคุยกับป้าศรี',
      how: 'ป้าศรีอยู่ที่ต้นสักใหญ่ ถามเรื่องทางแยกและจุดสังเกต',
      tool: 'เปิดแผนที่ (M) ดูถนนที่สำรวจแล้ว เดินตามถนนไปหาต้นสักใหญ่',
      think: 'ที่ทางแยก ถนนแต่ละทางไปทางทิศไหน?',
      doneText: '✓ ได้ข้อมูลทางแยกจากป้าศรีแล้ว!',
      tools: ['แผนที่', 'ปุ่มคุย'],
      done: { type: 'clue', clueId: 'clue-fork' },
    },
    {
      id: 'read-clues',
      goal: 'เปิดสมุดอ่านข้อมูลที่ได้มา',
      how: 'เปิดสมุด (N) แล้วอ่านข้อมูลจากลุงคำและป้าศรีในหน้าเบาะแส',
      tool: 'หน้าเบาะแสแยกเป็น ทิศทาง · ระยะทาง · จุดสังเกต — อ่านให้ครบทุกข้อ',
      think: 'ตอนนี้เรารู้ทิศ ระยะเส้นตรง และสะพานที่ต้องผ่านแล้วหรือยัง?',
      doneText: '✓ อ่านข้อมูลครบแล้ว!',
      tools: ['สมุด'],
      done: { type: 'flag', flag: 'read:clue-bridge' },
      impliedByLater: true,
      notebookTab: 'clues',
    },
    {
      id: 'open-routes',
      goal: 'เปิดหน้าวิเคราะห์เส้นทาง',
      how: 'ในสมุด (N) เปิดหน้า "วิเคราะห์เส้นทาง"',
      tool: 'ใช้แผนที่ (M) เปรียบเทียบทิศทาง ระยะทาง และสะพานของแต่ละเส้นทาง',
      think: 'เส้นทางแต่ละเส้นไปทางทิศไหน และผ่านสะพานใดบ้าง?',
      doneText: '✓ เปิดหน้าวิเคราะห์เส้นทางแล้ว!',
      tools: ['สมุด', 'แผนที่'],
      done: { type: 'skill', skill: 'straight-vs-route' },
    },
    {
      id: 'choose-route',
      goal: 'เลือกเส้นทางที่ตรงกับข้อมูล',
      how: 'เทียบแต่ละเส้นทางกับข้อมูลทุกข้อ แล้วเลือกเส้นทางเดียวที่ตรงทั้งหมด',
      tool: 'ระยะเส้นตรงบนแผนที่ (ซม.) × 100 = เมตรจริง · ระยะตามถนนยาวกว่าเส้นตรงเสมอ',
      think: 'จากข้อมูลที่ได้ เส้นทางใดผ่านสะพานตามที่ลุงคำบอก และไปทางทิศที่ผู้ใหญ่บ้านบอก?',
      doneText: '✓ วิเคราะห์เส้นทางสำเร็จ!',
      tools: ['สมุด', 'แผนที่'],
      done: { type: 'flag', flag: 'route-correct' },
    },
  ],
  5: [
    {
      id: 'travel',
      goal: 'ออกเดินทางตามเส้นทางที่วิเคราะห์',
      how: 'ดูทิศทาง ระยะทาง และจุดสังเกตระหว่างเดิน',
      tool: 'เปิดแผนที่ (M) ดูว่าเดินมาถูกทิศไหม · กดวัดระยะ (R) เทียบกับระยะที่คาดไว้',
      think: 'ผ่านจุดสังเกตที่ชาวบ้านบอกแล้วหรือยัง? ถ้ายัง อาจเดินผิดทาง',
      doneText: '✓ พบแหล่งผ้าปักแล้ว!',
      tools: ['แผนที่', 'เข็มทิศ', 'วัดระยะ'],
      done: { type: 'discover', landmarkId: 'nai-chiao' },
    },
    {
      id: 'talk-nuan',
      goal: 'พูดคุยกับช่างผ้าปัก',
      how: 'มองหาป้านวล (ช่างผ้าปัก) แล้วกดคุย (E)',
      tool: 'ป้านวลอยู่ใกล้บ้านผ้าปัก มีเครื่องหมาย ! เหนือหัว',
      think: 'ภูมิปัญญาผ้าปักทำอย่างไร และส่งต่อกันอย่างไร?',
      doneText: '✓ ได้หลักฐานลวดลายผ้าปักแล้ว!',
      tools: ['ปุ่มคุย'],
      done: { type: 'flag', flag: 'evidence-collected' },
    },
  ],
  6: [
    {
      id: 'pin',
      goal: 'เปิดแผนที่และปักหมุดบ้านผ้าปัก',
      how: 'เปิดแผนที่ (M) เลือกช่องที่ตั้ง แล้วเลือกประเภทภูมิปัญญา',
      tool: 'ยืนใกล้บ้านผ้าปักก่อนปัก · หมุดต้องอยู่ในพื้นที่ที่สำรวจแล้ว',
      think: 'ตำแหน่งที่ปักตรงกับที่เราเดินมาถึงจริงไหม และภูมิปัญญาที่นี่คือประเภทใด?',
      doneText: '✓ ปักหมุดสำเร็จ!',
      tools: ['แผนที่'],
      done: { type: 'flag', flag: 'pin-verified' },
    },
  ],
  7: [
    {
      id: 'read-riddle',
      goal: 'อ่านปริศนาลายผ้าผืนแรกในสมุด',
      how: 'เปิดสมุด (N) หน้าเบาะแส อ่านลายบอกทางที่ป้านวลจดไว้',
      tool: 'ปริศนาบอก "ทิศ" และ "ระยะบนแผนที่ (ซม.)" จากจุดอ้างอิง',
      think: 'ลายบอกทางเริ่มจากจุดไหน ไปทางทิศใด และไกลกี่เซนติเมตรบนแผนที่?',
      doneText: '✓ อ่านปริศนาแล้ว!',
      tools: ['สมุด'],
      done: { type: 'flag', flag: 'read:clue-old-cloth' },
      impliedByLater: true,
      notebookTab: 'clues',
    },
    {
      id: 'find-cloth',
      goal: 'ใช้มาตราส่วนหาจุดซ่อน แล้วตรวจค้น',
      how: 'คำนวณระยะจริงจากมาตราส่วน เดินตามทิศจากจุดอ้างอิง เมื่อถึงที่ให้กดสำรวจ (E)',
      tool: 'กดวัดระยะ (R) ที่จุดอ้างอิงก่อนออกเดิน · ดูทิศจากเข็มทิศ (เหนืออยู่ด้านบน)',
      think: 'บนแผนที่ 1:10,000 1 ซม. = 100 เมตร ระยะในปริศนาจึงเท่ากับกี่เมตร และกี่ช่อง?',
      doneText: '✓ พบเศษผ้าปักโบราณแล้ว!',
      tools: ['สมุด', 'วัดระยะ', 'เข็มทิศ'],
      done: { type: 'flag', flag: 'mystery-found' },
    },
  ],
};
for (const st of sakNgamStory) if (MICRO[st.order]) st.micro = MICRO[st.order];
