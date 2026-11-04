import type {
  ClueDefinition,
  EndingDefinition,
  EvidenceDefinition,
  PinTaskDefinition,
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
    objective: 'หาเบาะแส ทิศทาง ระยะทาง จุดสังเกต ให้ครบ แล้วเลือกเส้นทางในสมุดภาคสนาม (N)',
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
