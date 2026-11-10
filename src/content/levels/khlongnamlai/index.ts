import { ElevationModel } from '../../../core/world/Elevation';
import type { Condition, DialogueNode, LessonDefinition, LevelDefinition, MicroStep, NpcDefinition, QuizDefinition, StoryStep } from '../../types';
import { sakNgamLevel } from '../sakngam';
import { A_POINTS, B_POINTS, khlongNamLaiMap, MAIN_POINTS } from './map';

/**
 * ด่านที่ 2 (v0.26): "ปริศนาสารพิษแห่งต้นน้ำ" — ตำบลคลองน้ำไหล
 * ผู้กล้าสืบหาจุดทิ้งสารเคมี ด้วยมาตราส่วน 1:10,000 เส้นชั้นความสูง และทิศทางการไหลของน้ำ
 * exploreMode: ไม่มีลูกศร/หมุด/วงแหวนไฮไลต์ — ผู้เล่นเดินตามคำบอกทิศ+ระยะเอง (เหมือนด่านที่ 1)
 *
 * ลำดับ (ตรวจด้วย tests/khlongnamlai.test.ts):
 *   1 บ้านผู้ใหญ่บ้าน (14,10): รับภารกิจ + โจทย์ระยะไปบ้านตาคำ (ตะวันออก 4 ซม.)
 *   2 บ้านตาคำ (54,10): ได้แผนที่ภูมิประเทศ (เส้นชั้นความสูง ยังไม่มีตัวเลข) + โจทย์ระยะไปสถานีป่าไม้ (ตะวันออก 2 ซม.)
 *   3 สถานีป่าไม้ (74,10): บทเรียนเส้นชั้นความสูง → เปิดแผนที่นับเส้น → โจทย์ความสูง (เติมตัวเลขบนเส้น) → โจทย์ความลาดชัน
 *   4 วิเคราะห์ทิศน้ำไหล (A,B → C) และเลือกลำน้ำที่ต้องตรวจสอบ (B) + คำบอกทางไปต้นน้ำ B (ใต้ 3 ซม. ตะวันตก 2 ซม.)
 *   5 เดินไปจุดตรวจสอบ (54,40) เอง → "พบร่องรอยสารเคมีบริเวณต้นน้ำ!" 6 เลือกวิธีรับมือถังสารเคมี 7 กลับไปรายงานผู้ใหญ่บ้าน
 */

const PLAYER = 'ผู้กล้า';
const RANGER = 'เจ้าหน้าที่ป่าไม้';

/** ตำแหน่งที่ใช้ร่วมกับ test (ค่าตรวจทิศ/ระยะกับแผนที่จริง) */
export const L2_HEADMAN = { x: 14, y: 10 } as const;
export const L2_KHAM = { x: 54, y: 10 } as const;
export const L2_RANGER = { x: 74, y: 10 } as const;
/** กระท่อมเฝ้าป่า = จุดเลี้ยว (ใต้ 3 ซม. จากสถานีป่าไม้) */
export const L2_HUT = { x: 74, y: 40 } as const;
/** จุดตรวจสอบต้นน้ำ B (ตะวันตก 2 ซม. จากกระท่อม) */
export const L2_SITE = { x: 54, y: 40 } as const;
/** จุดตรวจสอบบนแผนที่วิเคราะห์ */
export const L2_CHECK_A = { x: 30, y: 29 } as const;
export const L2_CHECK_B = { x: 56, y: 34 } as const;
export const L2_CHECK_C = { x: 40, y: 6 } as const;
/** ถังสารเคมีที่ปรากฏหลังเดินถึงจุดตรวจสอบ */
export const L2_BARREL = { x: 55, y: 38 } as const;

const elevation = new ElevationModel(khlongNamLaiMap.elevation!);
/** ข้อความช่วงความสูงจากเส้นชั้นความสูง 50 ม. เช่น "100–150 ม." (ต่ำกว่า 100 = ไม่มีเส้นใต้ลงไป) */
export function bandLabel(h: number): string {
  const lo = Math.floor(h / 50) * 50;
  return lo < 100 ? 'ต่ำกว่า 100 ม.' : `${lo}–${lo + 50} ม.`;
}
const hA = bandLabel(elevation.heightAt(L2_CHECK_A.x, L2_CHECK_A.y));
const hB = bandLabel(elevation.heightAt(L2_CHECK_B.x, L2_CHECK_B.y));
const hC = bandLabel(elevation.heightAt(L2_CHECK_C.x, L2_CHECK_C.y));

const choices = (...labels: string[]) => labels.map((label, i) => ({ id: `c${i}`, label }));
/** แนบเงื่อนไข "ยังไม่ผ่านขั้นนี้" ให้ทุกบรรทัด/คำถาม — โหลดเกมกลางบทสนทนาแล้วคุยใหม่จะข้ามส่วนที่ทำแล้ว */
const unlessDone = (flag: string, nodes: DialogueNode[]): DialogueNode[] =>
  nodes.map((n) => ({ ...n, when: { notFlags: [flag, ...(('when' in n && n.when?.notFlags) || [])] } }));

/** บทเรียนมาตราส่วนของครูเนม (ชุดเดียวกับด่านที่ 1 — ตอบโจทย์ระยะผิด เปิดบทเรียนนี้) */
const lessons: Record<string, LessonDefinition> = {
  scale: sakNgamLevel.lessons!.scale,
  contour: {
    speaker: RANGER,
    pages: [
      {
        title: '1. เส้นชั้นความสูงคืออะไร?',
        text: 'เส้นบนแผนที่นี้เรียกว่า "เส้นชั้นความสูง" แต่ละเส้นเชื่อมจุดที่สูงจากระดับน้ำทะเลเท่ากัน\nถ้าเดินตามเส้นเดียวกัน ความสูงจะไม่เปลี่ยน',
      },
      {
        title: '2. ช่วงต่างระดับ',
        text: 'เส้นชั้นความสูงแต่ละเส้นต่างกันเท่า ๆ กัน เรียกว่า "ช่วงต่างระดับ" ในแผนที่นี้ต่างกันเส้นละ 50 เมตร\nข้ามจากเส้นหนึ่งไปอีกเส้นทางที่สูงขึ้น ความสูงจะเพิ่มขึ้น 50 เมตร',
      },
      {
        title: '3. เส้นที่วงล้อมกันคือเนินเขา',
        text: 'เส้นที่วงซ้อนกันเข้าหาจุดศูนย์กลางคือเนินเขา เส้นนอกสุดต่ำที่สุด วงในสุดสูงที่สุด\nนับเส้นจากวงนอกเข้าไปทีละเส้น แล้วบวกช่วงต่างระดับทีละ 50 เมตร จะรู้ความสูงของแต่ละเส้น',
      },
      {
        title: '4. เส้นชิด เส้นห่าง',
        text: 'เมื่อช่วงต่างระดับเท่ากัน:\n• เส้นอยู่ชิดกัน = ความสูงเปลี่ยนเร็วในระยะสั้น = พื้นที่ชัน\n• เส้นอยู่ห่างกัน = ความสูงเปลี่ยนช้า = พื้นที่ลาดชันน้อย',
      },
    ],
  },
};

/* ---------------- คำบอกทาง (ทิศ + ระยะบนแผนที่ + จุดสังเกต) ---------------- */

const ROUTE_KHAM =
  'บ้านตาคำอยู่ทางทิศตะวันออกของบ้านข้า ห่างบนแผนที่ 4 เซนติเมตร (มาตราส่วน 1:10,000) เดินตามถนนไป จะผ่านสะพานข้ามลำน้ำกลางทาง';
const ROUTE_STATION =
  'สถานีป่าไม้อยู่ทางทิศตะวันออกของบ้านตา ห่างบนแผนที่ 2 เซนติเมตร (มาตราส่วน 1:10,000) เดินตามถนนเส้นเดิมไปจนสุดทาง';
const ROUTE_SITE =
  'จากสถานีป่าไม้ ให้เดินตามถนนไปทางทิศใต้ 3 เซนติเมตรบนแผนที่ (มาตราส่วน 1:10,000) จะพบกระท่อมเฝ้าป่าริมทาง จากนั้นเลี้ยวไปทางทิศตะวันตกอีก 2 เซนติเมตร ขึ้นเนินไปตามถนนจนถึงต้นลำน้ำ B';

/* ---------------- คำถาม ---------------- */

const quizzes: QuizDefinition[] = [
  {
    id: 'q-kham',
    speaker: PLAYER,
    question: 'จากบ้านผู้ใหญ่บ้านไปบ้านตาคำ ทิศตะวันออก ระยะบนแผนที่ 4 ซม. มาตราส่วน 1:10,000 ระยะทางจริงเท่าไร?',
    choices: choices('40 เมตร', '400 เมตร', '4,000 เมตร'),
    correctChoiceId: 'c1',
    fallbackHint: '1 ซม. บนแผนที่ = 100 เมตรจริง ลองคูณดู',
    correctFeedback: 'ถูกต้อง! 4 ซม. × 100 = 400 เมตร เดินไปทางตะวันออกตามถนน ผ่านสะพานแล้วจะถึงบ้านตาคำ',
    effects: [{ type: 'flag', flag: 'q-kham' }],
    wrongLesson: 'scale',
  },
  {
    id: 'q-station',
    speaker: PLAYER,
    question: 'จากบ้านตาคำไปสถานีป่าไม้ ทิศตะวันออก ระยะบนแผนที่ 2 ซม. มาตราส่วน 1:10,000 ระยะทางจริงเท่าไร?',
    choices: choices('20 เมตร', '200 เมตร', '2,000 เมตร'),
    correctChoiceId: 'c1',
    fallbackHint: '1 ซม. บนแผนที่ = 100 เมตรจริง ลองคูณดู',
    correctFeedback: 'ถูกต้อง! 2 ซม. × 100 = 200 เมตร เดินตามถนนไปทางตะวันออกได้เลย',
    effects: [{ type: 'flag', flag: 'q-station' }],
    wrongLesson: 'scale',
  },
  {
    id: 'q-contour',
    speaker: RANGER,
    question: 'ถ้าเส้นนอกสูง 100 เมตร และเส้นแต่ละชั้นต่างกัน 50 เมตร เส้นด้านในสุดสูงเท่าไร?',
    choices: choices('100 เมตร', '150 เมตร', '200 เมตร'),
    correctChoiceId: 'c2',
    fallbackHint: 'เส้นชั้นความสูงแต่ละเส้นมีช่วงต่างระดับที่แน่นอน ลองนับจำนวนช่วงระหว่างเส้นดูอีกครั้ง',
    correctFeedback: 'ถูกต้อง! ภูเขามีเส้น 3 เส้น คือ 100, 150 และ 200 เมตร วงในสุดสูง 200 เมตร',
    effects: [{ type: 'flag', flag: 'contour-labeled' }],
  },
  {
    id: 'q-slope',
    speaker: RANGER,
    question: 'พื้นที่ใดมีความลาดชันมากกว่า?',
    choices: choices('จุด A', 'จุด B', 'ทั้งสองจุดชันเท่ากัน'),
    correctChoiceId: 'c0',
    fallbackHint: 'เมื่อช่วงต่างระดับเท่ากัน เส้นที่อยู่ชิดกันแสดงว่าระดับความสูงเปลี่ยนเร็วในระยะทางสั้น จึงชันกว่า',
    correctFeedback: 'ถูกต้อง! จุด A เส้นอยู่ชิดกัน จึงชันกว่าจุด B',
    effects: [{ type: 'flag', flag: 'contours-learned' }],
  },
  {
    id: 'q-flow',
    speaker: PLAYER,
    question: 'จากข้อมูลระดับความสูงในแผนที่ น้ำไหลจากบริเวณใดไปยังบริเวณใด?',
    choices: choices(
      `จากจุด C (${hC}) ไปยังจุด A (${hA}) และจุด B (${hB})`,
      `จากจุด A (${hA}) ไปยังจุด B (${hB}) แล้วไปยังจุด C (${hC})`,
      `จากจุด A (${hA}) และจุด B (${hB}) ไปยังจุด C (${hC})`,
    ),
    correctChoiceId: 'c2',
    fallbackHint: 'น้ำไหลจากที่สูงลงที่ต่ำเสมอ ดูตัวเลขความสูงที่จุด A, B และ C บนแผนที่ (ไม่ใช่ดูว่าจุดใดอยู่ด้านบนของจอ)',
    correctFeedback: 'ถูกต้อง! น้ำไหลจากที่สูง (A และ B) ลงสู่ที่ต่ำ (C) แม้จุด C จะอยู่ด้านบนของจอก็ตาม',
    effects: [{ type: 'flag', flag: 'q-flow' }],
  },
  {
    id: 'q-source',
    speaker: PLAYER,
    question: 'จากหลักฐาน ผู้กล้าควรเริ่มตรวจสอบต้นทางของลำน้ำสายใด?',
    choices: [
      { id: 'c0', label: 'ลำน้ำ A', hint: 'ลำน้ำ A ไม่พบความผิดปกติในจุดตรวจที่กำหนด' },
      { id: 'c1', label: 'ลำน้ำ B' },
      { id: 'c2', label: 'จุด C หลังลำน้ำบรรจบ', hint: 'จุด C อยู่ปลายน้ำ ผลจากต้นน้ำไหลมารวมกันที่นั่น ควรย้อนขึ้นไปทางต้นน้ำของสายที่พบความผิดปกติ' },
    ],
    correctChoiceId: 'c1',
    fallbackHint: 'ดูว่าลำน้ำสายใดพบความผิดปกติก่อนถึงจุดบรรจบ',
    correctFeedback: 'พบความผิดปกติในลำน้ำ B ก่อนถึงจุดบรรจบ จึงควรตรวจสอบย้อนขึ้นไปทางต้นน้ำของสาย B (นี่เป็นการเลือกจุดตรวจสอบ ยังไม่ได้ยืนยันว่าพบต้นเหตุ)',
    effects: [{ type: 'flag', flag: 'q-source' }],
  },
  {
    id: 'q-site',
    speaker: PLAYER,
    question: 'จากสถานีป่าไม้ เดินทิศใต้ 3 ซม. แล้วเลี้ยวทิศตะวันตก 2 ซม. (มาตราส่วน 1:10,000) รวมระยะทางจริงกี่เมตร?',
    choices: choices('50 เมตร', '500 เมตร', '5,000 เมตร'),
    correctChoiceId: 'c1',
    fallbackHint: '3 ซม. + 2 ซม. = 5 ซม. แล้วใช้ 1 ซม. = 100 เมตร',
    correctFeedback: 'ถูกต้อง! (3 + 2) ซม. × 100 = 500 เมตร เดินลงใต้ 300 เมตร เลี้ยวตะวันตก 200 เมตร ด้วยตนเองเลย',
    effects: [{ type: 'flag', flag: 'q-site' }],
    wrongLesson: 'scale',
  },
  {
    id: 'q-chem',
    speaker: PLAYER,
    question: 'พบถังสารเคมีแล้ว! เราควรทำอย่างไรดี?',
    choices: [
      { id: 'c0', label: 'เปิดถังตรวจสอบด้วยตัวเอง', hint: 'ไม่ควรเปิดถังเอง สารเคมีอาจรั่วไหลและเป็นอันตรายต่อร่างกาย' },
      { id: 'c1', label: 'ผลักถังลงลำธาร', hint: 'การผลักถังลงลำธารทำให้สารเคมีปนเปื้อนไปตามน้ำถึงชุมชนด้านล่าง' },
      { id: 'c2', label: 'อยู่ห่างจากถังและแจ้งเจ้าหน้าที่ให้ตรวจสอบ' },
    ],
    correctChoiceId: 'c2',
    fallbackHint: 'ปลอดภัยที่สุดคืออยู่ห่างจากถัง และให้เจ้าหน้าที่ที่ผ่านการฝึกมาตรวจสอบ',
    correctFeedback: 'ตัดสินใจถูกต้อง!',
    effects: [{ type: 'flag', flag: 'q-chem' }],
    // ตอบผิด: พลังมลพิษพญาจระเข้ +10 HP (เพดานรวม 50 ตามระบบมลพิษเดิม ใช้ร่วมกับด่านที่ 1)
    wrongEffects: [{ type: 'bossHp', amount: 10, cap: 50 }],
  },
];

/* ---------------- บทสนทนา ---------------- */

/** ฉากที่ 1: ผู้ใหญ่บ้านรับภารกิจ (เริ่มอัตโนมัติเมื่อผู้กล้าเกิดที่บ้านผู้ใหญ่บ้าน) */
const headmanIntro: DialogueNode[] = [
  { speaker: 'ผู้ใหญ่บ้าน', text: 'ผู้กล้า! มีคนแอบนำสารเคมีไปทิ้งบริเวณต้นน้ำ ตอนนี้น้ำในชุมชนเริ่มผิดปกติแล้ว' },
  { speaker: PLAYER, text: 'แล้วเราจะรู้ได้อย่างไรว่าต้นน้ำอยู่ที่ไหนครับ?' },
  { speaker: 'ผู้ใหญ่บ้าน', text: 'ข้าไม่รู้ตำแหน่งแน่ชัด แต่ตาคำรู้จักป่าแถบนี้ดี ลองไปหาเขาดู', effects: [{ type: 'flag', flag: 'met-headman' }] },
  { speaker: 'ผู้ใหญ่บ้าน', text: ROUTE_KHAM },
  { quiz: 'q-kham' },
];

/** ฉากที่ 7: รายงานผู้ใหญ่บ้าน */
const headmanReport: DialogueNode[] = [
  { speaker: PLAYER, text: 'ผู้ใหญ่ครับ ผมพบถังสารเคมีบริเวณต้นทางลำน้ำที่ผิดปกติแล้ว!' },
  {
    speaker: 'ผู้ใหญ่บ้าน',
    text: 'ขอบใจมากผู้กล้า เราจะรีบประสานเจ้าหน้าที่ และเตือนชาวบ้านให้งดใช้น้ำบริเวณที่สงสัยว่าปนเปื้อนจนกว่าจะตรวจสอบว่าปลอดภัย',
    effects: [{ type: 'flag', flag: 'l2-report' }, { type: 'reward', id: 'level-2:final', coins: 100, faith: 10 }],
  },
  { speaker: 'ภารกิจสำเร็จ', text: 'ปกป้องต้นน้ำคลองน้ำไหล' },
];

const npcs: NpcDefinition[] = [
  {
    id: 'headman',
    name: 'ผู้ใหญ่บ้าน',
    appearance: 'headman',
    at: L2_HEADMAN,
    dialogue: [
      { when: { notFlags: ['q-kham'] }, nodes: headmanIntro },
      { when: { flags: ['q-chem'], notFlags: ['l2-report'] }, nodes: headmanReport },
      {
        when: { flags: ['q-kham'], notFlags: ['q-chem'] },
        ambient: true,
        nodes: [{ speaker: 'ผู้ใหญ่บ้าน', text: `${ROUTE_KHAM} · ถ้าเจอต้นน้ำที่ผิดปกติ รีบกลับมาบอกข้านะ` }],
      },
      { ambient: true, nodes: [{ speaker: 'ผู้ใหญ่บ้าน', text: 'ขอบใจที่ช่วยปกป้องต้นน้ำของชุมชนนะ' }] },
    ],
  },
  {
    id: 'ta-kham',
    name: 'ตาคำ',
    appearance: 'elder',
    at: L2_KHAM,
    dialogue: [
      { when: { notFlags: ['q-kham'] }, ambient: true, nodes: [{ speaker: 'ตาคำ', text: 'สวัสดีผู้กล้า ไปคุยกับผู้ใหญ่บ้านก่อนไหม เขามีเรื่องจะบอก' }] },
      {
        // ฉากที่ 2: ได้แผนที่ภูมิประเทศ (ยังไม่มีตัวเลข) + บอกทางไปสถานีป่าไม้
        when: { flags: ['q-kham'], notFlags: ['q-station'] },
        nodes: [
          ...unlessDone('got-topo', [
            { speaker: PLAYER, text: 'ตาคำครับ ผมกำลังตามหาต้นน้ำที่ถูกทิ้งสารเคมีครับ' },
            { speaker: 'ตาคำ', text: 'ตาเก็บแผนที่ภูเขาแถบนี้ไว้ แต่ตัวเลขความสูงเลือนหายไปแล้ว' },
          ]),
          { speaker: 'ตาคำ', text: 'เอาแผนที่นี้ไปเถอะ เปิดดูได้จากปุ่มแผนที่ (มีเส้นชั้นความสูง ลำน้ำ 2 สาย และจุดตรวจ A, B, C)', effects: [{ type: 'flag', flag: 'got-topo' }], when: { notFlags: ['got-topo'] } },
          { speaker: 'ตาคำ', text: 'เจ้าลองไปหาเจ้าหน้าที่ป่าไม้ เขามีข้อมูลสำรวจระดับความสูง' },
          { speaker: 'ตาคำ', text: ROUTE_STATION },
          { quiz: 'q-station' },
        ],
      },
      { when: { notFlags: ['q-chem'] }, ambient: true, nodes: [{ speaker: 'ตาคำ', text: ROUTE_STATION }] },
      { ambient: true, nodes: [{ speaker: 'ตาคำ', text: 'ขอบใจที่ช่วยดูแลป่าต้นน้ำนะผู้กล้า' }] },
    ],
  },
  {
    id: 'ranger',
    name: RANGER,
    appearance: 'ranger',
    at: L2_RANGER,
    dialogue: [
      { when: { notFlags: ['q-station'] }, ambient: true, nodes: [{ speaker: RANGER, text: 'ฉันเป็นเจ้าหน้าที่ป่าไม้ ถ้ามีเรื่องแผนที่และระดับความสูง ไปคุยกับตาคำก่อนก็ได้' }] },
      {
        // ฉากที่ 3 (1): เส้นชั้นความสูง → ให้เปิดแผนที่ นับเส้นบนภูเขา
        when: { flags: ['q-station'], notFlags: ['contour-task'] },
        nodes: [
          { speaker: PLAYER, text: 'ผมได้แผนที่จากตาคำ แต่ไม่รู้ว่าพื้นที่ไหนสูงหรือต่ำครับ' },
          { speaker: RANGER, text: 'เส้นบนแผนที่นี้เรียกว่าเส้นชั้นความสูง แต่ละเส้นเชื่อมจุดที่สูงจากระดับน้ำทะเลเท่ากัน' },
          { speaker: RANGER, text: 'ฉันมีผลสำรวจอยู่ ลองใช้ข้อมูลนี้อ่านแผนที่ดู' },
          { lesson: 'contour' },
          {
            speaker: RANGER,
            text: 'ผลสำรวจ: เส้นนอกสุดของภูเขาสูง 100 เมตร และแต่ละเส้นต่างกัน 50 เมตร ลองเปิดแผนที่ นับเส้นชั้นความสูงบนภูเขา แล้วกลับมาตอบฉัน',
            effects: [{ type: 'flag', flag: 'contour-task' }],
          },
        ],
      },
      {
        // ยังไม่ได้เปิดแผนที่ดูเส้น → ให้ไปดูก่อน
        when: { flags: ['contour-task'], notFlags: ['opened:map', 'contour-labeled'] },
        ambient: true,
        nodes: [{ speaker: RANGER, text: 'ยังไม่ได้เปิดแผนที่เลยนะ ลองเปิดแผนที่ นับเส้นชั้นความสูงบนภูเขา แล้วค่อยกลับมาตอบ' }],
      },
      {
        // ฉากที่ 3 (2): กิจกรรม 1 อ่านระดับความสูง → เติมตัวเลข · กิจกรรม 2 ความลาดชัน
        when: { flags: ['contour-task', 'opened:map'], notFlags: ['contours-learned'] },
        nodes: [
          ...unlessDone('contour-labeled', [
            { speaker: RANGER, text: 'นับเส้นบนภูเขาได้แล้วใช่ไหม ลองตอบดู' },
            { quiz: 'q-contour' },
            { speaker: RANGER, text: 'ฉันเติมตัวเลขความสูงลงบนเส้นชั้นความสูงในแผนที่ให้แล้ว เปิดแผนที่ดูได้เลย' },
          ]),
          { speaker: RANGER, text: 'เส้นชั้นความสูงที่อยู่ชิดกันหมายถึงพื้นที่ชัน ส่วนเส้นที่ห่างกันหมายถึงพื้นที่ลาดชันน้อยกว่า เมื่อช่วงต่างระดับของเส้นเท่ากัน' },
          { speaker: RANGER, text: 'ดูที่แผนที่ รอบจุด A เส้นชั้นความสูงอยู่ชิดกัน ส่วนรอบจุด B เส้นอยู่ห่างกัน' },
          { quiz: 'q-slope' },
          { speaker: RANGER, text: 'เก่งมากผู้กล้า ตอนนี้เจ้ารู้แล้วว่าพื้นที่ไหนสูงหรือต่ำ ลองใช้แผนที่ตามหาต้นน้ำดู' },
        ],
      },
      {
        // ฉากที่ 4: วิเคราะห์ลำน้ำ 2 สาย → เลือกต้นทางที่ต้องตรวจสอบ · ฉากที่ 5: คำบอกทางไปต้นน้ำ B
        when: { flags: ['contours-learned'], notFlags: ['q-site'] },
        nodes: [
          ...unlessDone('q-flow', [
            { speaker: PLAYER, text: 'น้ำทั้งสองสายไหลมารวมกัน แต่เราจะรู้ได้อย่างไรว่าควรตรวจสอบที่ไหน?' },
            { speaker: RANGER, text: 'ผลตรวจน้ำ: ลำน้ำ A ไม่พบความผิดปกติในจุดตรวจ · ลำน้ำ B พบปลาตายและน้ำผิดปกติก่อนถึงจุดบรรจบ · บริเวณ C อยู่ปลายน้ำหลังจุดบรรจบ' },
            { speaker: RANGER, text: 'ลองดูว่าลำน้ำสายไหนพบความผิดปกติก่อนถึงจุดบรรจบ แล้วสังเกตทิศทางการไหลของน้ำ ตัวเลขความสูงที่จุด A, B, C อยู่บนแผนที่แล้ว' },
            { quiz: 'q-flow' },
          ]),
          ...unlessDone('q-source', [{ quiz: 'q-source' }]),
          { speaker: RANGER, text: 'เจ้าไปตรวจสอบต้นทางลำน้ำ B ได้เลย ไม่ต้องกลับไปหาตาคำอีก ฉันจะประสานทีมตามไปทีหลัง' },
          { speaker: RANGER, text: ROUTE_SITE },
          { quiz: 'q-site' },
        ],
      },
      { when: { flags: ['q-site'], notFlags: ['q-chem'] }, ambient: true, nodes: [{ speaker: RANGER, text: ROUTE_SITE }] },
      { ambient: true, nodes: [{ speaker: RANGER, text: 'ขอบใจที่แจ้งเรื่องสารเคมี ฉันจะรีบประสานเจ้าหน้าที่ไปตรวจสอบ' }] },
    ],
  },
];

/* ---------------- ฉาก (แถบภารกิจ) ---------------- */

const micro = (id: string, goal: string, steps: string[], done: MicroStep['done'], doneText: string): MicroStep => ({
  id,
  goal,
  steps,
  result: 'ภารกิจเดินหน้าต่อ',
  tools: ['แผนที่', 'เข็มทิศ', 'วัดระยะ'],
  tool: 'เปิดแผนที่ดูถนน แม่น้ำ สะพาน และอาคารได้ · เหนืออยู่ด้านบนเสมอ',
  think: 'ลองแปลงระยะบนแผนที่เป็นระยะจริง แล้วดูทิศจากเข็มทิศ',
  doneText,
  done,
});
const flag = (f: string): MicroStep['done'] => ({ type: 'flag', flag: f });

const step = (order: number, title: string, landmarkId: string, completeFlag: string, ms: MicroStep[]): StoryStep => ({
  order,
  title,
  objective: title,
  landmarkId,
  status: 'playable',
  completeWhen: { type: 'flag', flag: completeFlag },
  micro: ms,
});

const story: StoryStep[] = [
  step(1, 'รับภารกิจจากผู้ใหญ่บ้าน', 'headman-house', 'q-kham', [
    micro('s1', 'ฟังผู้ใหญ่บ้าน แล้วคำนวณระยะไปบ้านตาคำ', ['ผู้ใหญ่บ้านบอก: ตาคำอยู่ทางทิศตะวันออก 4 ซม. บนแผนที่ (มาตราส่วน 1:10,000)', 'แปลงระยะบนแผนที่เป็นระยะจริงก่อนเดินทาง'], flag('q-kham'), '✓ คำนวณระยะถูกแล้ว'),
  ]),
  step(2, 'เดินทางไปหาตาคำ', 'kham-house', 'got-topo', [
    micro(
      's2a',
      'เดินไปบ้านตาคำ',
      ['ไปทางทิศตะวันออก 4 ซม. บนแผนที่ (1:10,000)', 'ตามถนนไป ผ่านสะพานข้ามลำน้ำกลางทาง'],
      { type: 'near', npcId: 'ta-kham' },
      '✓ ถึงบ้านตาคำแล้ว',
    ),
    micro('s2b', 'คุยกับตาคำ รับแผนที่ภูมิประเทศ', ['เข้าไปคุยกับตาคำ', 'ตาคำมีแผนที่ภูเขาแถบนี้ แต่ตัวเลขความสูงเลือนหายไปแล้ว'], flag('got-topo'), '✓ ได้รับแผนที่ภูมิประเทศ'),
  ]),
  step(3, 'ตามหาเจ้าหน้าที่ป่าไม้เพื่อสอบถามระดับความสูง', 'ranger-station', 'contour-task', [
    micro(
      's3a',
      'ตามหาเจ้าหน้าที่ป่าไม้เพื่อสอบถามระดับความสูง',
      ['เดินไปสถานีป่าไม้: ทิศตะวันออกของบ้านตาคำ 2 ซม. บนแผนที่ (1:10,000)', 'ตามถนนเส้นเดิมไปจนสุดทาง'],
      { type: 'near', npcId: 'ranger' },
      '✓ ถึงสถานีป่าไม้แล้ว',
    ),
    micro('s3b', 'คุยกับเจ้าหน้าที่ป่าไม้', ['ฟังเรื่องเส้นชั้นความสูง', 'จดผลสำรวจ: เส้นนอกสุด 100 ม. ต่างกันเส้นละ 50 ม.'], flag('contour-task'), '✓ ได้ผลสำรวจระดับความสูง'),
  ]),
  step(4, 'เรียนรู้ความสูงและความลาดชัน', 'ranger-station', 'contours-learned', [
    micro('s4a', 'เปิดแผนที่ นับเส้นชั้นความสูงบนภูเขา', ['เปิดแผนที่ (ปุ่มแผนที่)', 'นับจำนวนเส้นบนภูเขา เส้นนอกสุด 100 ม. ต่างกันเส้นละ 50 ม.'], flag('opened:map'), '✓ ดูแผนที่แล้ว'),
    micro('s4b', 'ตอบโจทย์ความสูง แล้วเติมตัวเลขลงบนแผนที่', ['กลับไปคุยกับเจ้าหน้าที่ป่าไม้', 'ตอบว่าเส้นในสุดสูงเท่าไร'], flag('contour-labeled'), '✓ ตัวเลขความสูงถูกเติมบนแผนที่แล้ว'),
    micro('s4c', 'ตอบโจทย์ความลาดชัน', ['เส้นชิดกันหรือห่างกัน ต่างกันอย่างไร', 'เทียบรอบจุด A กับจุด B'], flag('contours-learned'), '✓ เข้าใจความสูงและความลาดชัน'),
  ]),
  step(5, 'วิเคราะห์ลำน้ำ เลือกต้นทางที่ต้องตรวจสอบ', 'ranger-station', 'q-source', [
    micro('s5a', 'ดูระดับความสูงที่จุด A, B, C แล้วหาทิศน้ำไหล', ['เปิดแผนที่ อ่านตัวเลขความสูงบนเส้นและที่จุด A, B, C', 'น้ำไหลจากที่สูงไปที่ต่ำ ไม่เกี่ยวกับบนหรือล่างของจอ'], flag('q-flow'), '✓ รู้ทิศน้ำไหลแล้ว'),
    micro('s5b', 'เลือกลำน้ำที่ต้องตรวจสอบต้นทาง', ['ลำน้ำ A ปกติ · ลำน้ำ B พบปลาตายก่อนถึงจุดบรรจบ · C อยู่ปลายน้ำ'], flag('q-source'), '✓ เลือกจุดตรวจสอบแล้ว'),
  ]),
  step(6, 'ใช้มาตราส่วนเดินไปตรวจสอบต้นทางลำน้ำ B', 'hut', 'site-found', [
    micro(
      's6a',
      'คำนวณระยะทางรวมจากคำบอกทาง',
      ['จากสถานีป่าไม้: ทิศใต้ 3 ซม. ถึงกระท่อมเฝ้าป่า แล้วเลี้ยวทิศตะวันตก 2 ซม. (1:10,000)', 'ตอบระยะทางรวมก่อนเดิน'],
      flag('q-site'),
      '✓ คำนวณระยะทางถูกแล้ว',
    ),
    micro('s6b', 'เดินไปยังต้นลำน้ำ B ด้วยตนเอง', ['จากสถานีป่าไม้ ทิศใต้ 3 ซม. ตามถนนถึงกระท่อมเฝ้าป่า แล้วเลี้ยวทิศตะวันตก 2 ซม. ขึ้นเนิน (1:10,000)', 'ใช้เข็มทิศและเครื่องมือวัดระยะ · ไม่มีลูกศรนำทาง'], flag('site-found'), '✓ ถึงจุดตรวจสอบแล้ว'),
  ]),
  step(7, 'เลือกวิธีรับมือถังสารเคมี', 'hut', 'q-chem', [
    micro('s7', 'ตัดสินใจอย่างปลอดภัย', ['อย่าสัมผัสหรือเคลื่อนย้ายถัง', 'เลือกวิธีรับมือที่ปลอดภัยที่สุด'], flag('q-chem'), '✓ ตัดสินใจถูกต้อง'),
  ]),
  step(8, 'กลับไปรายงานผู้ใหญ่บ้าน', 'headman-house', 'l2-report', [
    micro(
      's8',
      'เดินกลับไปบ้านผู้ใหญ่บ้าน',
      ['ย้อนทางเดิม: ทิศตะวันออก 2 ซม. ขึ้นเหนือ 3 ซม. ถึงสถานีป่าไม้', 'จากนั้นไปทางทิศตะวันตก 6 ซม. ตามถนน ผ่านบ้านตาคำและสะพานข้ามลำน้ำ ถึงบ้านผู้ใหญ่บ้าน'],
      flag('l2-report'),
      '✓ รายงานสำเร็จ',
    ),
  ]),
];

const known = { showLabel: true } as const;
const analysisMap: Condition = { flags: ['got-topo'] };
const checkpoint = { showLabel: true, knownWhen: analysisMap, mapMark: true } as const;

export const khlongNamLaiLevel: LevelDefinition = {
  id: 'level-2',
  contentVersion: 11,
  tambon: 'ตำบลคลองน้ำไหล',
  title: 'ปริศนาสารพิษแห่งต้นน้ำ',
  map: khlongNamLaiMap,
  spawn: { x: 14, y: 11 },
  fog: { revealRadiusTiles: 5 },
  exploreMode: true,
  // ป้ายชื่อแสดงเมื่อเดินเข้าใกล้เท่านั้น (ไม่แสดงตำแหน่งตาคำ/ต้นน้ำล่วงหน้า) · จุดตรวจ A, B, C แสดงเฉพาะบนแผนที่ภูมิประเทศที่ได้รับ
  landmarks: [
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 14, y: 9 }, ...known },
    { id: 'bridge', name: 'สะพานข้ามลำน้ำ', at: { x: 40, y: 10 }, ...known },
    { id: 'kham-house', name: 'บ้านตาคำ', at: { x: 54, y: 9 }, ...known },
    { id: 'ranger-station', name: 'สถานีป่าไม้', at: { x: 74, y: 9 }, ...known },
    { id: 'hut', name: 'กระท่อมเฝ้าป่า', at: { x: 75, y: 41 }, ...known },
    { id: 'check-a', name: 'จุด A (ลำน้ำ A)', at: L2_CHECK_A, mapLabelAt: 'left', ...checkpoint },
    { id: 'check-b', name: 'จุด B (ลำน้ำ B)', at: L2_CHECK_B, mapLabelAt: 'right', ...checkpoint },
    { id: 'check-c', name: 'จุด C (ปลายน้ำ)', at: L2_CHECK_C, mapLabelAt: 'right', ...checkpoint },
  ],
  npcs,
  triggers: [{ id: 'intro', area: { x: 12, y: 11, w: 5, h: 2 }, npcId: 'headman', when: { notFlags: ['q-kham'] } }],
  story,
  quizzes,
  lessons,
  arrivals: [
    // ถึงจุดตรวจสอบต้นน้ำ B (ต้องคำนวณระยะถูกก่อน) → ข้อความ + ถังสารเคมี + คำถามวิธีรับมือ (ผ่านเมื่อตอบถูก)
    {
      id: 'site',
      at: L2_SITE,
      radiusTiles: 2.5,
      when: { flags: ['q-site'] },
      flag: 'site-found',
      doneFlag: 'q-chem',
      nodes: [
        { speaker: PLAYER, text: 'พบร่องรอยสารเคมีบริเวณต้นน้ำ!', button: 'ตกลง' },
        { speaker: PLAYER, text: 'พบถังสารเคมีแล้ว! เราควรทำอย่างไรดี?', effects: [{ type: 'flag', flag: 'barrel-seen' }] },
        { quiz: 'q-chem' },
      ],
    },
  ],
  quests: [
    {
      id: 'main',
      kind: 'main',
      title: 'ปริศนาสารพิษแห่งต้นน้ำ',
      description: 'สืบหาจุดทิ้งสารเคมีด้วยมาตราส่วน เส้นชั้นความสูง และทิศทางการไหลของน้ำ',
      lockedHint: '',
      objectives: story.map((s) => ({ text: s.title, done: { type: 'step', order: s.order } })),
      reward: { text: 'ชาวบ้านศรัทธาในตัวผู้นำมากขึ้น' },
    },
  ],
  ending: {
    messages: [{ speaker: 'ผู้ใหญ่บ้าน', text: 'ภารกิจสำเร็จ — ปกป้องต้นน้ำคลองน้ำไหล' }],
    startWhen: { flags: ['l2-report'] },
    rewardItem: 'ความศรัทธาของชาวบ้าน',
    completeFlag: 'level-2-complete',
  },
  // ถังสารเคมีที่ถูกทิ้งใกล้ลำธาร (ปรากฏหลังเดินถึงจุดตรวจสอบ) — ภาพอย่างเดียว ไม่มีการชน ไม่เคลื่อนย้ายได้
  decor: [{ id: 'chem-barrel', kind: 'barrel', at: L2_BARREL, showWhen: { flags: ['barrel-seen'] } }],
  // แผนที่ภูมิประเทศชุดเดียวตลอดภารกิจ: ได้จากตาคำ → ตัวเลขบนเส้น (หลังกิจกรรม 1) → จุดระดับความสูง A, B, C (หลังกิจกรรม 2)
  topoMapFlag: 'got-topo',
  contourIntervalMeters: 50,
  contourLabelsFlag: 'contour-labeled',
  spotHeightsFlag: 'contours-learned',
  trackMapOpen: true,
  spotHeights: [L2_CHECK_A, L2_CHECK_B, L2_CHECK_C],
  waterways: [
    { id: 'stream-a', name: 'ลำน้ำ A', points: A_POINTS },
    { id: 'stream-b', name: 'ลำน้ำ B', points: B_POINTS },
    { id: 'stream-main', name: 'ลำน้ำสายหลัก (ปลายน้ำ)', points: MAIN_POINTS },
  ],
  unlocks: 'level-3',
  skills: ['direction', 'scale', 'elevation'],
};
