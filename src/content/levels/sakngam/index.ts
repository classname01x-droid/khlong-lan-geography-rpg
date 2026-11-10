import type { Choice, LessonDefinition, LevelDefinition, MicroStep, NpcDefinition, QuizDefinition, StoryStep } from '../../types';
import { sakNgamMap } from './map';

/**
 * ด่านที่ 1 (v0.23): "สำรวจชุมชนสักงามด้วยทิศทางและมาตราส่วน 1:10,000" (1 ซม. บนแผนที่ = 100 ม. = 10 ช่อง)
 * ผู้เล่นอ่านคำบอกทิศ+ระยะ → คำนวณด้วยมาตราส่วน → เดินหาจุดหมายเอง
 * exploreMode: ไม่มีลูกศร/หมุด/เส้นนำทาง/วงแหวนไฮไลต์ NPC/เครื่องหมาย ! ✓ — มีเฉพาะเข็มทิศ แผนที่ และจุดสังเกตตามธรรมชาติ
 *
 * เส้นทางจริงในแผนที่ (ตรวจด้วย tests/sakngam.test.ts):
 *   โรงเรียน (15,40) ──ตะวันออก 4 ซม. = 400 ม. (ข้ามสะพานบนถนนหลัก)──► บ้านผู้ใหญ่บ้าน (55,43)
 *   บ้านผู้ใหญ่บ้าน ──ตะวันตก 3 ซม. = 300 ม.──► คุณยายริมทาง (25,47) [จุดเลี้ยว]
 *   คุณยาย ──เหนือ 2 ซม. = 200 ม.──► บ้านผ้าปักป้าเจียว (25,27)
 *   จุด C (72,50): ห่างลำธาร 4 ซม. = 400 ม. (≥ 300 ม.) ติดทุ่งนา ทางตะวันออกของบ้านผู้ใหญ่บ้านราว 2 ซม.
 * ตอบโจทย์มาตราส่วนถูกต้องครบ → เดินตามคำบอกเอง · รางวัล +100 เหรียญ +10 ศรัทธา เมื่อรายงานป้าเจียวสำเร็จ
 */
export const SAKNGAM_WAT = { x: 28, y: 17 } as const;
export const SAKNGAM_TRASH = { x: 28, y: 47 } as const;
/** จุดสอนใช้เครื่องมือวัดระยะ: บนถนนหลัก หลังออกจากโรงเรียน (ต้องตอบโจทย์ครูเนมก่อน) */
export const SAKNGAM_TEACH_SPOT = { x: 17, y: 48 } as const;

const PLAYER = 'ผู้กล้า';
const choices = (...labels: string[]): Choice[] => labels.map((label, i) => ({ id: `c${i}`, label }));

/** บทเรียนมาตราส่วนของครูเนม — ทีละหน้า (ย้อนกลับ/ถัดไป) เน้นเหตุผลและขั้นตอน ไม่ใช่แค่จำสูตร */
const lessons: Record<string, LessonDefinition> = {
  scale: {
    speaker: 'ครูเนม',
    pages: [
      {
        title: '1. มาตราส่วนคืออะไร?',
        text: 'แผนที่คือภาพที่ "ย่อ" พื้นที่จริงให้เล็กลง จะได้วาดลงกระดาษได้\nมาตราส่วนบอกความสัมพันธ์ว่า ระยะบนแผนที่ 1 ส่วน แทนระยะจริงกี่ส่วน เราจึงใช้มันเปลี่ยนระยะบนแผนที่ให้เป็นระยะจริงได้',
      },
      {
        title: '2. 1:10,000 หมายถึงอะไร?',
        text: 'เลขหน้า (1) คือระยะบนแผนที่ เลขหลัง (10,000) คือระยะจริง และใช้หน่วยเดียวกัน\nดังนั้น 1 ซม. บนแผนที่ เท่ากับ 10,000 ซม. บนพื้นจริง',
      },
      {
        title: '3. แปลง ซม. เป็นเมตร',
        text: '10,000 ซม. ยาวเกินไปจะนึกภาพยาก จึงเปลี่ยนเป็นเมตร โดยหารด้วย 100 (เพราะ 1 เมตร = 100 ซม.)\n10,000 ÷ 100 = 100 เมตร\nสรุป: 1 ซม. บนแผนที่ = 100 เมตรจริง',
      },
      {
        title: '4. แปลงเมตรเป็นกิโลเมตร',
        text: 'ถ้าระยะยาวมาก ให้เปลี่ยนเป็นกิโลเมตร โดยหารด้วย 1,000 (เพราะ 1 กม. = 1,000 เมตร)\nเช่น 300 ÷ 1,000 = 0.3 กม.',
      },
      {
        title: '5. ตัวอย่างการคำนวณ',
        text: 'แผนที่วัดได้ 3 ซม. ทำทีละขั้น:\n① คูณด้วยมาตราส่วน: 3 × 10,000 = 30,000 ซม.\n② เปลี่ยนเป็นเมตร (÷ 100): 30,000 ÷ 100 = 300 เมตร\n③ เปลี่ยนเป็น กม. (÷ 1,000): 300 ÷ 1,000 = 0.3 กม.\nสรุป: 3 × 10,000 = 30,000 ซม. = 300 เมตร = 0.3 กม.',
      },
    ],
  },
};

const quizzes: QuizDefinition[] = [
  {
    id: 'q-school',
    speaker: 'ครูเนม',
    question: 'แผนที่มาตราส่วน 1:10,000 ระยะจากโรงเรียนถึงบ้านผู้ใหญ่บ้าน 4 เซนติเมตร ระยะทางจริงเท่าไร?',
    choices: choices('40 เมตร', '400 เมตร', '4,000 เมตร'),
    correctChoiceId: 'c1',
    fallbackHint: '1 ซม. บนแผนที่ = 100 เมตรจริง ลองคูณดู',
    correctFeedback: 'ถูกต้อง! 4 ซม. × 100 = 400 เมตร ลองเดินไปดูเองนะ',
    effects: [{ type: 'flag', flag: 'q-school' }],
    wrongLesson: 'scale',
  },
  {
    id: 'q-west',
    speaker: 'ผู้ใหญ่บ้าน',
    question: 'มาตราส่วน 1:10,000 ระยะบนแผนที่ 3 เซนติเมตร เท่ากับระยะจริงเท่าไร?',
    choices: choices('30 เมตร', '300 เมตร', '3,000 เมตร'),
    correctChoiceId: 'c1',
    fallbackHint: '1 ซม. บนแผนที่ = 100 เมตรจริง',
    correctFeedback: 'ถูกต้อง! 3 ซม. = 300 เมตร',
    effects: [{ type: 'flag', flag: 'q-west' }],
    wrongLesson: 'scale',
  },
  {
    id: 'q-north',
    speaker: 'ผู้ใหญ่บ้าน',
    question: 'ระยะบนแผนที่ 2 เซนติเมตร เท่ากับระยะจริงเท่าไร?',
    choices: choices('20 เมตร', '200 เมตร', '2,000 เมตร'),
    correctChoiceId: 'c1',
    fallbackHint: '1 ซม. บนแผนที่ = 100 เมตรจริง',
    correctFeedback: 'ถูกต้อง! 2 ซม. = 200 เมตร เดินตามคำบอกได้เลย',
    effects: [{ type: 'flag', flag: 'route-known' }],
    wrongLesson: 'scale',
  },
  {
    id: 'q-wat',
    speaker: PLAYER,
    question: 'มาตราส่วน 1:10,000 ระยะจากสำนักสงฆ์ถึงกองขยะบนแผนที่ 3 ซม. ต้องเดินทางทิศใด และระยะทางจริงเท่าไร?',
    choices: choices('เหนือ 300 เมตร', 'ใต้ 30 เมตร', 'ใต้ 300 เมตร'),
    correctChoiceId: 'c2',
    fallbackHint: '3 ซม. × 100 = 300 เมตร · ดูทิศจากกองขยะที่อยู่ทางใต้ของสำนักสงฆ์ (เหนืออยู่ด้านบนของแผนที่)',
    correctFeedback: 'ถูกต้อง! ใต้ 300 เมตร (3 ซม. = 300 ม.) เดินไปทางทิศใต้ด้วยตนเองเลย',
    effects: [{ type: 'flag', flag: 'wat-quiz' }],
    wrongLesson: 'scale',
  },
  {
    id: 'q-adv1',
    speaker: 'ป้าเจียว',
    question: 'ถ้าชาวบ้านทิ้งขยะลงลำธาร จะเกิดผลกระทบอย่างไร?',
    choices: choices('น้ำไหลสะดวกขึ้น', 'น้ำเน่าเสีย สัตว์น้ำได้รับอันตราย และอาจอุดตันทางน้ำ', 'ไม่มีผลกระทบ'),
    correctChoiceId: 'c1',
    fallbackHint: 'ลองคิดถึงน้ำที่มีขยะลอยอยู่ และสัตว์ที่อาศัยในน้ำ',
    correctFeedback: 'ถูกต้อง! ขยะทำให้น้ำเสีย ทำร้ายสัตว์น้ำ และอุดตันทางน้ำ',
    effects: [{ type: 'flag', flag: 'adv1' }],
    wrongEffects: [{ type: 'bossHp', amount: 10, cap: 50 }],
  },
  {
    id: 'q-adv2',
    speaker: 'ป้าเจียว',
    question: 'ควรจัดการขยะอย่างไรเพื่อไม่ให้เกิดปัญหาซ้ำ?',
    choices: choices('เผาขยะริมลำธาร', 'ทิ้งขยะในป่า', 'แยกขยะและนำไปยังจุดรวบรวมที่เหมาะสม'),
    correctChoiceId: 'c2',
    fallbackHint: 'ขยะที่แยกแล้วต้องมีที่เก็บที่ไม่ทำลายธรรมชาติ',
    correctFeedback: 'ถูกต้อง! แยกขยะแล้วนำไปจุดรวบรวมที่เหมาะสม',
    effects: [{ type: 'flag', flag: 'adv2' }],
    wrongEffects: [{ type: 'bossHp', amount: 10, cap: 50 }],
  },
];

const ROUTE_TEXT =
  'จากบ้านข้า เดินไปทางทิศตะวันตก 3 เซนติเมตรบนแผนที่ จะพบคุณยายอยู่ริมทาง จากนั้นเดินขึ้นเหนืออีก 2 เซนติเมตร จะถึงบ้านผ้าปักของป้าเจียว';
const WAT_HINT =
  'ไปที่สำนักสงฆ์เขาแสงเพชรก่อนนะ อยู่ทางทิศเหนือของบ้านป้าราว 1 เซนติเมตรบนแผนที่ ไปถึงแล้วค่อยคำนวณหากองขยะ';

const npcs: NpcDefinition[] = [
  {
    id: 'teacher-nem',
    name: 'ครูเนม',
    appearance: 'teacher',
    at: { x: 12, y: 40 },
    dialogue: [
      {
        when: { notFlags: ['q-school'] },
        nodes: [
          { speaker: PLAYER, text: 'ครูเนมครับ ชุมชนของเรามีปัญหาอะไรหรือครับ?' },
          { speaker: 'ครูเนม', text: 'ลองไปถามผู้ใหญ่บ้านดูสิ เดินทางไปทางทิศตะวันออก ข้ามสะพานก็จะพบบ้านผู้ใหญ่บ้าน' },
          { speaker: 'ครูเนม', text: 'ก่อนไป ครูจะสอนเรื่องมาตราส่วนให้ก่อน ผู้กล้าจะได้คำนวณระยะได้เอง' },
          { lesson: 'scale' },
          { quiz: 'q-school' },
        ],
      },
      {
        ambient: true,
        nodes: [
          { speaker: 'ครูเนม', text: 'ไปถามผู้ใหญ่บ้านทางทิศตะวันออกนะ ข้ามสะพานไปก็จะพบ อยากทบทวนเรื่องมาตราส่วนไหม?' },
          { lesson: 'scale' },
        ],
      },
    ],
  },
  {
    id: 'headman',
    name: 'ผู้ใหญ่บ้าน',
    appearance: 'headman',
    at: { x: 55, y: 44 },
    dialogue: [
      { when: { notFlags: ['q-school'] }, ambient: true, nodes: [{ speaker: 'ผู้ใหญ่บ้าน', text: 'สวัสดี ไปคุยกับครูเนมที่โรงเรียนก่อนไหม ครูมีเรื่องจะบอก' }] },
      {
        when: { notFlags: ['route-known'] },
        nodes: [
          { speaker: 'ผู้ใหญ่บ้าน', text: 'ชุมชนผ้าปักกำลังมีปัญหาขยะสะสมใกล้ลำธาร ช่วยไปหาป้าเจียวหน่อย', effects: [{ type: 'flag', flag: 'met-headman' }] },
          { speaker: 'ผู้ใหญ่บ้าน', text: ROUTE_TEXT },
          { quiz: 'q-west' },
          { quiz: 'q-north' },
        ],
      },
      { when: { notFlags: ['m-report'] }, ambient: true, nodes: [{ speaker: 'ผู้ใหญ่บ้าน', text: 'ลืมทางหรือ? จากบ้านข้า ตะวันตก 3 ซม. พบคุณยาย แล้วขึ้นเหนืออีก 2 ซม. นะ' }] },
      { ambient: true, nodes: [{ speaker: 'ผู้ใหญ่บ้าน', text: 'ขอบใจที่ช่วยดูแลลำธารของชุมชนนะ' }] },
    ],
  },
  {
    id: 'grandma',
    name: 'คุณยาย',
    appearance: 'villager',
    at: { x: 25, y: 47 },
    dialogue: [
      { when: { flags: ['route-known'] }, ambient: true, nodes: [{ speaker: 'คุณยาย', text: 'ผู้กล้าจะไปหาป้าเจียวหรือจ๊ะ เดินขึ้นเหนือไปตามทางนี้แหละ' }] },
      { ambient: true, nodes: [{ speaker: 'คุณยาย', text: 'วันนี้ลมเย็นสบายดีนะจ๊ะ' }] },
    ],
  },
  {
    id: 'jiao',
    name: 'ป้าเจียว',
    appearance: 'villager',
    at: { x: 25, y: 27 },
    dialogue: [
      {
        when: { notFlags: ['go-wat'] },
        nodes: [
          { speaker: 'ป้าเจียว', text: 'ช่วงนี้มีขยะจากการค้าขายสะสมใกล้ลำธาร ป้าอยากให้ผู้กล้าช่วยหาที่มาของกองขยะหน่อย' },
          { speaker: 'ป้าเจียว', text: WAT_HINT, effects: [{ type: 'flag', flag: 'go-wat' }] },
        ],
      },
      { when: { notFlags: ['trash-found'] }, ambient: true, nodes: [{ speaker: 'ป้าเจียว', text: WAT_HINT }] },
      {
        when: { notFlags: ['m-report'] },
        nodes: [
          { speaker: 'ป้าเจียว', text: 'ขอบใจที่ช่วยหากองขยะนะ ตอนนี้ป้าอยากได้คำแนะนำจากผู้กล้า 2 ข้อ' },
          { quiz: 'q-adv1' },
          { quiz: 'q-adv2' },
          {
            speaker: 'ป้าเจียว',
            text: 'ขอบใจมากนะ ต่อไปเราจะช่วยกันจัดการขยะและรักษาสายน้ำของชุมชน',
            effects: [
              { type: 'flag', flag: 'm-report' },
              { type: 'reward', id: 'sakngam:final', coins: 100, faith: 10 },
            ],
          },
        ],
      },
      { ambient: true, nodes: [{ speaker: 'ป้าเจียว', text: 'จุดรวบรวมขยะจะช่วยรักษาสายน้ำของเราได้มากเลยนะ' }] },
    ],
  },
];

const micro = (id: string, goal: string, steps: string[], done: string, doneText: string): MicroStep => ({
  id,
  goal,
  steps,
  result: 'ภารกิจเดินหน้าต่อ',
  tools: ['แผนที่', 'เข็มทิศ', 'วัดระยะ'],
  tool: 'เปิดแผนที่ดูถนน แม่น้ำ สะพาน และอาคารได้ · เหนืออยู่ด้านบนเสมอ',
  think: 'ลองแปลงระยะบนแผนที่เป็นระยะจริง แล้วดูทิศจากเข็มทิศ',
  doneText,
  done: { type: 'flag', flag: done },
});

const step = (order: number, title: string, landmarkId: string, flag: string, ms: MicroStep[]): StoryStep => ({
  order,
  title,
  objective: title,
  landmarkId,
  status: 'playable',
  completeWhen: { type: 'flag', flag },
  micro: ms,
});

const story: StoryStep[] = [
  step(1, 'พบครูเนม', 'school', 'q-school', [
    micro('s1', 'พบครูเนมที่โรงเรียน', ['คุยกับครูเนมในโรงเรียน', 'เรียนเรื่องมาตราส่วน แล้วตอบโจทย์ (1 ซม. = 100 ม.)'], 'q-school', '✓ ตอบโจทย์ถูก'),
  ]),
  step(2, 'พบผู้ใหญ่บ้าน', 'headman-house', 'route-known', [
    micro(
      's2a',
      'เดินทางไปบ้านผู้ใหญ่บ้าน',
      ['ครูเนมบอก: ไปทางทิศตะวันออก ข้ามสะพาน', 'โรงเรียน → บ้านผู้ใหญ่บ้าน 4 ซม. = 400 เมตร', 'ดูทิศจากเข็มทิศ แล้วเดินไปเอง'],
      'met-headman',
      '✓ พบผู้ใหญ่บ้านแล้ว',
    ),
    micro(
      's2b',
      'ฟังคำบอกทางของผู้ใหญ่บ้าน',
      ['จากบ้านผู้ใหญ่บ้าน เดินไปทางทิศตะวันตก 3 ซม. บนแผนที่ จะพบคุณยายริมทาง', 'จากนั้นเดินขึ้นเหนืออีก 2 ซม. จะถึงบ้านผ้าปักของป้าเจียว', 'แปลงระยะเป็นระยะจริงด้วยมาตราส่วน 1:10,000'],
      'route-known',
      '✓ คำนวณระยะถูกแล้ว',
    ),
  ]),
  step(3, 'ตามหาป้าเจียว', 'jiao-house', 'go-wat', [
    micro(
      's3',
      'ตามหาป้าเจียว',
      ['มาตราส่วน 1:10,000', 'เดินทางทิศตะวันตก 300 เมตร (จากบ้านผู้ใหญ่บ้าน)', 'เมื่อพบคุณยาย ให้เลี้ยวขึ้นเหนือ 200 เมตร', 'ตามหาบ้านผ้าปัก'],
      'go-wat',
      '✓ พบป้าเจียวแล้ว',
    ),
  ]),
  step(4, 'ไปสำนักสงฆ์เขาแสงเพชร', 'wat', 'wat-quiz', [
    micro(
      's4',
      'ไปสำนักสงฆ์เขาแสงเพชรก่อน',
      ['ป้าเจียวบอก: สำนักสงฆ์อยู่ทางทิศเหนือของบ้านป้าเจียว ประมาณ 1 ซม. บนแผนที่ (มาตราส่วน 1:10,000)', 'ไปถึงแล้วจะมีโจทย์ให้ตอบ'],
      'wat-quiz',
      '✓ ตอบโจทย์ที่สำนักสงฆ์ถูก',
    ),
  ]),
  step(5, 'เดินไปหากองขยะ', 'bridge', 'trash-found', [
    micro(
      's5',
      'เดินไปหากองขยะด้วยตนเอง',
      ['จากสำนักสงฆ์ถึงกองขยะ 3 ซม. บนแผนที่ = 300 เมตร', 'ทิศทาง: ใต้ (ลงใต้จากสำนักสงฆ์)', 'ใช้เข็มทิศและเครื่องมือวัดระยะช่วยได้'],
      'trash-found',
      '✓ พบเศษขยะแล้ว',
    ),
  ]),
  step(6, 'รายงานป้าเจียว', 'jiao-house', 'm-report', [
    micro('s6', 'กลับไปหาป้าเจียว', ['เดินกลับตามเส้นทางเดิม', 'ให้คำแนะนำป้าเจียว 2 ข้อ (ตอบผิดเลือกใหม่ได้ แต่พญาจระเข้จะแข็งแกร่งขึ้น)'], 'm-report', '✓ รายงานสำเร็จ'),
  ]),
];

const known = { showLabel: true } as const;

export const sakNgamLevel: LevelDefinition = {
  id: 'sakngam',
  contentVersion: 12,
  tambon: 'ตำบลสักงาม',
  title: 'สำรวจชุมชนสักงามด้วยทิศและมาตราส่วน',
  map: sakNgamMap,
  spawn: { x: 14, y: 43 },
  fog: { revealRadiusTiles: 5 },
  exploreMode: true,
  // ป้ายชื่อสถานที่แสดงเมื่อผู้เล่นเดินเข้าใกล้ (เปิดหมอก) เท่านั้น — ไม่แสดงตำแหน่งล่วงหน้า และไม่มีกองขยะ/จุดหมายบนแผนที่
  landmarks: [
    { id: 'school', name: 'โรงเรียนสักงาม (เสาธง)', at: { x: 15, y: 40 }, ...known },
    { id: 'bridge', name: 'สะพานข้ามลำห้วยใหญ่', at: { x: 32, y: 48 }, ...known },
    { id: 'sala', name: 'ศาลาชุมชน', at: { x: 46, y: 45 }, ...known },
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 55, y: 43 }, ...known },
    { id: 'jiao-house', name: 'บ้านผ้าปักป้าเจียว', at: { x: 25, y: 28 }, ...known },
    { id: 'wat', name: 'สำนักสงฆ์เขาแสงเพชร', at: SAKNGAM_WAT, ...known },
  ],
  npcs,
  story,
  quizzes,
  lessons,
  arrivals: [
    // จุดสอนใช้เครื่องมือวัดระยะ: หยุดเดินจนกว่าจะกดปุ่มจริง (ผ่านแล้วไม่แสดงซ้ำ)
    { id: 'teach-measure', at: SAKNGAM_TEACH_SPOT, radiusTiles: 2.5, when: { flags: ['q-school'] }, flag: 'teach-measure', teach: { tool: 'measure', text: 'กดเครื่องมือวัดระยะทาง' } },
    // ถึงสำนักสงฆ์ → หยุดเดิน ถามโจทย์มาตราส่วน (ไม่ผ่านจนกว่าจะตอบถูก)
    {
      id: 'wat',
      at: SAKNGAM_WAT,
      radiusTiles: 2,
      when: { flags: ['go-wat'] },
      flag: 'at-wat',
      doneFlag: 'wat-quiz',
      nodes: [{ speaker: PLAYER, text: 'ถึงสำนักสงฆ์เขาแสงเพชรแล้ว!' }, { quiz: 'q-wat' }],
    },
    // พบกองขยะ → หยุดเดิน แจ้งครั้งเดียว กด "ตกลง" แล้วเข้าขั้นตอนเก็บขยะ (กลับไปรายงาน)
    {
      id: 'trash',
      at: SAKNGAM_TRASH,
      radiusTiles: 2,
      when: { flags: ['wat-quiz'] },
      flag: 'trash-found',
      nodes: [{ speaker: PLAYER, text: 'พบเศษขยะแล้ว!', button: 'ตกลง' }],
    },
  ],
  quests: [
    {
      id: 'main',
      kind: 'main',
      title: 'ตามหาป้าเจียว',
      description: 'ใช้ทิศและมาตราส่วน 1:10,000 เดินสำรวจชุมชน',
      lockedHint: '',
      objectives: story.map((s) => ({ text: s.title, done: { type: 'step', order: s.order } })),
      reward: { text: 'ชาวบ้านศรัทธาในตัวผู้นำมากขึ้น' },
    },
  ],
  ending: {
    messages: [{ speaker: 'ชาวบ้าน', text: 'ขอบคุณที่ช่วยรักษาสายน้ำของชุมชนสักงาม!' }],
    startWhen: { flags: ['m-report'] },
    rewardItem: 'ความศรัทธาของชาวบ้าน',
    completeFlag: 'sakngam-complete',
  },
  // ศาลพญาจระเข้ผู้พิทักษ์ข้างโรงเรียน (ภาพ placeholder)
  decor: [
    { id: 'guardian-shrine', kind: 'shrine', at: { x: 11, y: 40 } },
    { id: 'trash-pile', kind: 'trash', at: SAKNGAM_TRASH },
  ],
  unlocks: 'level-2',
  skills: ['direction', 'scale'],
};
