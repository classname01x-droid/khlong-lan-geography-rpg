import type {
  ClueDefinition,
  EvidenceDefinition,
  InspectPoint,
  OldMapDefinition,
  QuestDefinition,
  QuizDefinition,
  SiteAnalysisDefinition,
  StoryStep,
} from '../../types';
import { STREAM_POINTS } from './map';

/** ภารกิจด่านคลองน้ำไหล (ต้นแบบ: เล่นได้ฉาก 1–3, ฉาก 4–6 วางโครงไว้แล้ว) */

export const namLaiQuizzes: QuizDefinition[] = [
  {
    id: 'flow',
    speaker: 'พี่ภูมิ (อาสาสมัครสำรวจแผนที่)',
    question:
      'หมุดฝั่งเหนือสูง {{elev:bm-north}} ม. หมุดฝั่งใต้สูง {{elev:bm-south}} ม. (จากระดับทะเลปานกลาง) ลำห้วยคลองน้ำไหลไหลไปทางทิศใด?',
    choices: [
      {
        id: 'south',
        label: 'ไหลไปทางทิศใต้',
        hint: 'น้ำไหลจากที่สูงไปที่ต่ำ ลองเทียบตัวเลขอีกครั้งว่าหมุดฝั่งไหนสูงกว่า (ด้านล่างของแผนที่ไม่ได้แปลว่าต่ำกว่า)',
      },
      { id: 'north', label: 'ไหลไปทางทิศเหนือ' },
      {
        id: 'west',
        label: 'ไหลไปทางทิศตะวันตก',
        hint: 'ลองดูแนวลำห้วยบนแผนที่ — ลำห้วยทอดตัวแนวเหนือ–ใต้ แล้วเทียบระดับความสูงของสองหมุด',
      },
    ],
    correctChoiceId: 'north',
    fallbackHint: 'น้ำไหลจากที่สูงไปที่ต่ำเสมอ',
    correctFeedback:
      'ถูกต้อง! ฝั่งใต้สูงกว่า ({{elev:bm-south}} ม.) ฝั่งเหนือต่ำกว่า ({{elev:bm-north}} ม.) น้ำจึงไหลไปทาง{{flow:stream-main}}',
    effects: [{ type: 'flag', flag: 'flow-known' }],
    verifyFlowOf: 'stream-main',
  },
];

export const namLaiClues: ClueDefinition[] = [
  {
    id: 'clue-office',
    type: 'direction',
    source: 'ครูเนม',
    text: 'ศาลาจัดการน้ำชุมชนอยู่ทาง{{dir:school>water-office}}ของโรงเรียน ห่างเป็นเส้นตรงประมาณ {{dist:school>water-office}} เมตร',
  },
  {
    id: 'clue-symbol',
    type: 'symbol',
    source: 'ป้าจันทร์',
    text: 'บนแผนที่เก่า ตาน้ำต้นลำห้วยใช้สัญลักษณ์ ◎ (ตาน้ำ) ซึ่งต่างจากสัญลักษณ์ฝาย หนองน้ำ และบ่อขุด',
  },
  {
    id: 'clue-elev-rule',
    type: 'elevation',
    source: 'พี่ภูมิ',
    text: 'น้ำไหลจากที่สูงไปที่ต่ำเสมอ ต้องดูระดับความสูง (▲ บนแผนที่ หรือหมุดหลักฐานระดับ) ไม่ใช่ดูว่าอยู่ด้านบนหรือล่างของแผนที่',
  },
  {
    id: 'clue-bm-north',
    type: 'elevation',
    source: 'หมุดหลักฐานระดับฝั่งเหนือ',
    text: 'ระดับความสูง {{elev:bm-north}} เมตร จากระดับทะเลปานกลาง (รทก.)',
  },
  {
    id: 'clue-bm-south',
    type: 'elevation',
    source: 'หมุดหลักฐานระดับฝั่งใต้',
    text: 'ระดับความสูง {{elev:bm-south}} เมตร จากระดับทะเลปานกลาง (รทก.)',
  },
  {
    id: 'clue-farm-pond',
    type: 'comparison',
    source: 'ลุงเพชร',
    text: 'บ่อน้ำในไร่ขุดขึ้นเมื่อไม่กี่ปีก่อน เก็บน้ำฝน ไม่ได้รับน้ำจากลำห้วย และแผนที่เก่าน่าจะยังไม่มีบ่อนี้',
  },
  {
    id: 'clue-stones',
    type: 'comparison',
    source: 'ยายหอม',
    text: 'ผู้ใหญ่สมัยก่อนเล่าว่าตาน้ำต้นลำห้วยอยู่ใกล้ก้อนหินใหญ่สามก้อน',
  },
];

export const namLaiEvidence: EvidenceDefinition[] = [
  {
    id: 'old-map',
    name: 'แผนที่เก่าของชุมชน (วาดมือ)',
    description: 'แผนที่ที่ป้าจันทร์วาดไว้ ใช้มาตราส่วนเดียวกับแผนที่สำรวจ (1:10,000) แต่ไม่มีเส้นชั้นความสูง',
  },
];

/** หมุดหลักฐานระดับ (BM): เดินไปใกล้แล้วกด E เพื่ออ่านค่าความสูง (ค่าคำนวณจากแบบจำลองความสูง) */
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
];

/**
 * แผนที่แผ่นที่สอง: แผนที่เก่าของชุมชน (วาดมือ) — พิกัดและมาตราส่วนเดียวกับแผนที่ด่าน
 * มีของที่ "ไม่มีแล้ว" (ทางเดินเก่าไปตาน้ำ) และ "ยังไม่มี" (บ่อในไร่ ถนนเข้าไร่) ให้ผู้เล่นเปรียบเทียบ
 */
export const namLaiOldMap: OldMapDefinition = {
  title: 'แผนที่เก่าของชุมชน (วาดมือ)',
  note: 'มาตราส่วน 1:10,000 · ไม่มีเส้นชั้นความสูง · ไม่ได้บอกทิศน้ำไหล',
  requiredEvidenceId: 'old-map',
  lines: [
    { style: 'stream', points: STREAM_POINTS },
    { style: 'road', points: [{ x: 0, y: 34 }, { x: 79, y: 34 }] },
    { style: 'road', points: [{ x: 10, y: 15 }, { x: 10, y: 34 }] },
    {
      style: 'trail',
      points: [
        { x: 40, y: 36 },
        { x: 34, y: 44 },
        { x: 28, y: 50 },
        { x: 24, y: 53 },
      ],
    },
  ],
  marks: [
    { symbol: 'school', at: { x: 11, y: 8 }, label: 'โรงเรียน' },
    { symbol: 'village', at: { x: 45, y: 30 }, label: 'หมู่บ้าน' },
    { symbol: 'temple', at: { x: 62, y: 29 }, label: 'วัด' },
    { symbol: 'weir', at: { x: 32, y: 22 }, label: 'ฝาย' },
    { symbol: 'marsh', at: { x: 33, y: 3 }, label: 'หนองน้ำ', labelAt: 'right' },
    { symbol: 'spring', at: { x: 22, y: 53 }, label: 'ตาน้ำ', labelAt: 'left' },
    { symbol: 'stones', at: { x: 25, y: 53 }, label: 'หินสามก้อน', labelAt: 'right' },
  ],
};

/**
 * สถานที่ผู้ต้องสงสัย: แหล่งน้ำ 4 แห่งที่ดูคล้าย "ตาน้ำต้นลำห้วย"
 * ระบบตรวจจากข้อมูลแผนที่ (validateLevel + tests): ตาน้ำผ่านหลักฐานทุกข้อ ส่วนอีก 3 แห่งไม่ผ่านอย่างน้อย 1 ข้อ
 * (หน้าจอให้ผู้เล่นเลือกสถานที่จะทำในฉาก 4–5)
 */
export const namLaiSiteAnalysis: SiteAnalysisDefinition = {
  waterwayId: 'stream-main',
  requiredSymbol: 'spring',
  toleranceTiles: 3,
  candidates: ['spring', 'weir', 'marsh', 'farm-pond'],
  correctLandmarkId: 'spring',
};

export const namLaiQuests: QuestDefinition[] = [
  {
    id: 'main-namlai',
    kind: 'main',
    title: 'ปริศนาสายน้ำแห่งคลองน้ำไหล',
    description: 'ตามหาตาน้ำต้นลำห้วยของชุมชน โดยใช้ระดับความสูง สัญลักษณ์แผนที่ และแผนที่สองแผ่น',
    lockedHint: '',
    objectives: [
      { text: 'รับภารกิจจากครูเนมที่โรงเรียน', done: { type: 'step', order: 1 } },
      { text: 'พบผู้ดูแลแหล่งน้ำ และรับแผนที่เก่า', done: { type: 'step', order: 2 } },
      { text: 'อ่านระดับความสูง หาทิศทางน้ำไหล', done: { type: 'step', order: 3 } },
      { text: 'เปรียบเทียบแผนที่สองแผ่น (อยู่ระหว่างพัฒนา)', done: { type: 'step', order: 4 } },
      { text: 'ตามหาตาน้ำต้นลำห้วย (อยู่ระหว่างพัฒนา)', done: { type: 'step', order: 5 } },
      { text: 'บันทึกตำแหน่ง รับรหัสลับชิ้นที่ 2 (อยู่ระหว่างพัฒนา)', done: { type: 'step', order: 6 } },
    ],
  },
  {
    id: 'side-symbols',
    kind: 'side',
    title: 'นักอ่านสัญลักษณ์แผนที่',
    description: 'ป้าจันทร์ให้แผนที่เก่ามาแล้ว ลองหาสถานที่จริงที่ตรงกับสัญลักษณ์บนแผนที่',
    unlockWhen: { flags: ['got-old-map'] },
    lockedHint: 'รับแผนที่เก่าจากผู้ดูแลแหล่งน้ำ',
    objectives: [
      { text: 'เปิดดูแผนที่เก่า (M แล้วกด Tab)', done: { type: 'skill', skill: 'map-compare' } },
      { text: 'สำรวจฝายบนลำห้วย', done: { type: 'discover', landmarkId: 'weir' } },
      { text: 'สำรวจวัด', done: { type: 'discover', landmarkId: 'temple' } },
    ],
    reward: { text: 'บันทึกในสมุด: สัญลักษณ์บนแผนที่เก่าตรงกับสถานที่จริงที่ยังอยู่' },
  },
];

export const namLaiStory: StoryStep[] = [
  {
    order: 1,
    title: 'รับภารกิจที่โรงเรียนคลองน้ำไหล',
    objective: 'คุยกับครูเนมเพื่อรับภารกิจ',
    landmarkId: 'school',
    status: 'playable',
    completeWhen: { type: 'talk', npcId: 'teacher-nem' },
  },
  {
    order: 2,
    title: 'พบผู้ดูแลแหล่งน้ำ',
    objective: 'ไปศาลาจัดการน้ำชุมชน คุยกับป้าจันทร์ และรับแผนที่เก่า',
    landmarkId: 'water-office',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'got-old-map' },
  },
  {
    order: 3,
    title: 'อ่านระดับความสูงหาทิศทางน้ำไหล',
    objective: 'อ่านหมุดหลักฐานระดับ 2 จุด (กด E) แล้วตอบพี่ภูมิว่าลำห้วยไหลไปทางไหน',
    landmarkId: 'bridge',
    status: 'playable',
    completeWhen: { type: 'flag', flag: 'flow-known' },
  },
  {
    order: 4,
    title: 'เปรียบเทียบแผนที่สองแผ่น',
    objective: '(อยู่ระหว่างพัฒนา) เทียบสัญลักษณ์บนแผนที่เก่ากับสถานที่จริง',
    landmarkId: 'water-office',
    status: 'planned',
    completeWhen: { type: 'flag', flag: 'maps-compared' },
  },
  {
    order: 5,
    title: 'ตามหาตาน้ำต้นลำห้วย',
    objective: '(อยู่ระหว่างพัฒนา) เลือกแหล่งน้ำที่ตรงกับหลักฐานทุกข้อ',
    landmarkId: 'spring',
    status: 'planned',
    completeWhen: { type: 'flag', flag: 'spring-found' },
  },
  {
    order: 6,
    title: 'บันทึกตำแหน่ง รับรหัสลับชิ้นที่ 2',
    objective: '(อยู่ระหว่างพัฒนา)',
    landmarkId: 'spring',
    status: 'planned',
    completeWhen: { type: 'flag', flag: 'level2-complete' },
  },
];
