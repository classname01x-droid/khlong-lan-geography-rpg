import type { Choice, LevelDefinition, MicroStep, NpcDefinition, QuizDefinition, StoryStep } from '../../types';
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
export const SAKNGAM_C_SPOT = { x: 72, y: 50 } as const;

const PLAYER = 'ผู้เล่น';
const choices = (...labels: string[]): Choice[] => labels.map((label, i) => ({ id: `c${i}`, label }));

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
  },
  {
    id: 'q-site',
    speaker: 'ป้าเจียว',
    question: 'จุดใดอยู่ห่างจากลำธารอย่างน้อย 300 เมตร?',
    choices: choices('จุด A (ห่างลำธาร 1 ซม.)', 'จุด B (ห่างลำธาร 2 ซม.)', 'จุด C (ห่างลำธาร 4 ซม.)'),
    correctChoiceId: 'c2',
    fallbackHint: 'แปลงระยะบนแผนที่เป็นระยะจริงด้วย 1 ซม. = 100 เมตร แล้วเทียบกับ 300 เมตร',
    correctFeedback: 'ถูกต้อง! จุด C ห่างลำธาร 4 ซม. = 400 เมตร',
    effects: [{ type: 'flag', flag: 'trash-quiz' }],
  },
];

const ROUTE_TEXT =
  'จากบ้านข้า เดินไปทางทิศตะวันตก 3 เซนติเมตรบนแผนที่ จะพบคุณยายอยู่ริมทาง จากนั้นเดินขึ้นเหนืออีก 2 เซนติเมตร จะถึงบ้านผ้าปักของป้าเจียว';
const C_HINT = 'ลองเดินไปตรวจจุด C ด้วยตาตัวเองนะ อยู่ทางทิศตะวันออกของบ้านผู้ใหญ่บ้านราว 2 เซนติเมตร ติดทุ่งนา';

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
          { quiz: 'q-school' },
        ],
      },
      { ambient: true, nodes: [{ speaker: 'ครูเนม', text: 'ไปถามผู้ใหญ่บ้านทางทิศตะวันออกนะ ข้ามสะพานไปก็จะพบ ดูเข็มทิศช่วยได้' }] },
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
      { when: { flags: ['route-known'] }, ambient: true, nodes: [{ speaker: 'คุณยาย', text: 'หนูจะไปหาป้าเจียวหรือจ๊ะ เดินขึ้นเหนือไปตามทางนี้แหละ' }] },
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
        when: { notFlags: ['trash-quiz'] },
        nodes: [
          {
            speaker: 'ป้าเจียว',
            text: 'ช่วงนี้มีขยะจากการค้าขายสะสมใกล้ลำธาร ป้าอยากหาจุดรวบรวมขยะที่อยู่ห่างจากน้ำอย่างน้อย 300 เมตร ช่วยป้าหน่อยนะ',
            effects: [{ type: 'flag', flag: 'met-jiao' }],
          },
          { speaker: 'แผนที่จำลอง', text: 'มาตราส่วน 1:10,000 · จุด A ห่างจากลำธาร 1 ซม. · จุด B ห่างจากลำธาร 2 ซม. · จุด C ห่างจากลำธาร 4 ซม.' },
          { quiz: 'q-site' },
          { speaker: 'ป้าเจียว', text: C_HINT },
        ],
      },
      { when: { notFlags: ['c-found'] }, ambient: true, nodes: [{ speaker: 'ป้าเจียว', text: C_HINT }] },
      {
        when: { notFlags: ['m-report'] },
        nodes: [
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
  tools: ['แผนที่', 'เข็มทิศ'],
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
    micro('s1', 'พบครูเนมที่โรงเรียน', ['คุยกับครูเนมในโรงเรียน', 'ตอบโจทย์มาตราส่วน 1:10,000 (1 ซม. = 100 ม.)'], 'q-school', '✓ ตอบโจทย์ถูก'),
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
  step(3, 'ตามหาป้าเจียว', 'jiao-house', 'trash-quiz', [
    micro(
      's3',
      'ตามหาป้าเจียว',
      ['มาตราส่วน 1:10,000', 'เดินทางทิศตะวันตก 300 เมตร (จากบ้านผู้ใหญ่บ้าน)', 'เมื่อพบคุณยาย ให้เลี้ยวขึ้นเหนือ 200 เมตร', 'ตามหาบ้านผ้าปัก'],
      'trash-quiz',
      '✓ ช่วยป้าเจียวเลือกจุดได้แล้ว',
    ),
  ]),
  step(4, 'ตรวจจุด C', 'headman-house', 'c-found', [
    micro(
      's4',
      'ไปตรวจจุด C ด้วยตนเอง',
      ['จุด C ห่างลำธาร 4 ซม. = 400 เมตร (มาตราส่วน 1:10,000)', 'อยู่ทางทิศตะวันออกของบ้านผู้ใหญ่บ้านราว 2 ซม. ติดทุ่งนา', 'เดินไปตรวจสอบพื้นที่เอง'],
      'c-found',
      '✓ พบพื้นที่ที่เหมาะสม',
    ),
  ]),
  step(5, 'รายงานป้าเจียว', 'jiao-house', 'm-report', [
    micro('s5', 'กลับไปรายงานป้าเจียว', ['เดินกลับตามเส้นทางเดิม', 'คุยกับป้าเจียวที่หน้าบ้านผ้าปัก'], 'm-report', '✓ รายงานสำเร็จ'),
  ]),
];

const known = { showLabel: true } as const;

export const sakNgamLevel: LevelDefinition = {
  id: 'sakngam',
  contentVersion: 11,
  tambon: 'ตำบลสักงาม',
  title: 'สำรวจชุมชนสักงามด้วยทิศและมาตราส่วน',
  map: sakNgamMap,
  spawn: { x: 14, y: 43 },
  fog: { revealRadiusTiles: 5 },
  exploreMode: true,
  // ป้ายชื่อสถานที่แสดงเมื่อผู้เล่นเดินเข้าใกล้ (เปิดหมอก) เท่านั้น — ไม่แสดงตำแหน่งล่วงหน้า และไม่มีจุด C บนแผนที่
  landmarks: [
    { id: 'school', name: 'โรงเรียนสักงาม (เสาธง)', at: { x: 15, y: 40 }, ...known },
    { id: 'bridge', name: 'สะพานข้ามลำห้วยใหญ่', at: { x: 32, y: 48 }, ...known },
    { id: 'sala', name: 'ศาลาชุมชน', at: { x: 46, y: 45 }, ...known },
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 55, y: 43 }, ...known },
    { id: 'jiao-house', name: 'บ้านผ้าปักป้าเจียว', at: { x: 25, y: 28 }, ...known },
  ],
  npcs,
  story,
  quizzes,
  arrivals: [{ id: 'spot-c', at: SAKNGAM_C_SPOT, radiusTiles: 3, when: { flags: ['trash-quiz'] }, flag: 'c-found', toast: 'พบพื้นที่ที่เหมาะสมสำหรับรวบรวมขยะ' }],
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
  decor: [{ id: 'guardian-shrine', kind: 'shrine', at: { x: 11, y: 40 } }],
  unlocks: 'level-2',
  skills: ['direction', 'scale'],
};
