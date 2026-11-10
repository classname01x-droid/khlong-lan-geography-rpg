import { directionFromVector, THAI_DIRECTION } from '../../../core/direction/Compass';
import { ElevationModel } from '../../../core/world/Elevation';
import { analyzeWaterway } from '../../../core/world/Waterway';
import type { Condition, DialogueNode, LessonDefinition, LevelDefinition, MicroStep, NpcDefinition, QuizDefinition, StoryStep } from '../../types';
import { sakNgamLevel } from '../sakngam';
import { A_POINTS, B_POINTS, khlongNamLaiMap, MAIN_POINTS } from './map';

/**
 * ด่านที่ 2 (v0.27): "ปริศนาสารพิษแห่งต้นน้ำ" — เกมสำรวจและสืบหาต้นน้ำด้วยหลักฐานภูมิศาสตร์ (ไม่ใช่เดินตาม NPC เป็นเส้นตรง)
 * exploreMode: ไม่มีลูกศร/หมุด/วงแหวนไฮไลต์ — ผู้เล่นใช้แผนที่ภูมิประเทศที่ได้จากตาคำ + ตัวเลขความสูงที่ได้จากเจ้าหน้าที่ป่าไม้ สำรวจเอง
 *
 *   1 บ้านผู้ใหญ่บ้าน (14,10): รับภารกิจ + โจทย์ระยะไปบ้านตาคำ (ตะวันออก 4 ซม. ข้ามสะพาน) — ใช้ความรู้จากด่าน 1
 *   2 บ้านตาคำ (54,10): "นำแผนที่ไปใช้สืบหาต้นน้ำ" → แผนที่เด้งขึ้นกลางจอ "คุณได้รับแผนที่ของตาคำ!" (เส้นชั้นความสูง ลำน้ำ A/B จุดบรรจบ ถนน ทางแยก บ้าน ภูเขา ป่า — ยังไม่มีตัวเลข)
 *   3 สถานีป่าไม้ (74,10): บทเรียนเส้นชั้นความสูง → เปิดแผนที่นับเส้น → โจทย์ (เติมตัวเลขบนเส้น) → โจทย์ความลาดชัน (ได้ตัวเลขความสูงของบ้านทุกหลัง)
 *      → "นางแป้นอยู่ใกล้ลำน้ำในบริเวณที่ต่ำที่สุดของพื้นที่สำรวจ" (ไม่บอกทิศ/บ้าน/สะพาน/ลำน้ำ/เส้นทาง)
 *   4 ผู้เล่นอ่านตัวเลขความสูง เทียบบ้าน 5 หลัง เลือกทางแยกเอง → บ้านนางแป้น (46,13) หลังเดียวในแอ่งต่ำ (< 100 ม.) ริมลำน้ำ B
 *   5 นางแป้น: เปิดแผนที่ ตอบว่าบ้านอยู่ใกล้ลำน้ำสายใด (ตอบผิด = ไปเปิดแผนที่แล้วคุยใหม่) → โจทย์ย้อนขึ้นต้นน้ำตามระดับความสูง
 *   6 เดินเลียบลำน้ำ B ขึ้นต้นน้ำเอง → "พบร่องรอยสารเคมีบริเวณต้นน้ำ!" → โจทย์จัดการอย่างปลอดภัย → รายงานผู้ใหญ่บ้าน
 */

const PLAYER = 'ผู้กล้า';
const RANGER = 'เจ้าหน้าที่ป่าไม้';
const PAEN = 'นางแป้น';

/** ตำแหน่งที่ใช้ร่วมกับ test (ค่าตรวจทิศ/ระยะ/ความสูงกับแผนที่จริง) */
export const L2_HEADMAN = { x: 14, y: 10 } as const;
export const L2_KHAM = { x: 54, y: 10 } as const;
export const L2_RANGER = { x: 74, y: 10 } as const;
/** นางแป้นยืนหน้าบ้านในแอ่งต่ำริมลำน้ำ B */
export const L2_PAEN = { x: 47, y: 15 } as const;
/** จุดตรวจสอบต้นน้ำ B (ปลายทางเดินป่าเลียบลำน้ำ) และถังสารเคมี */
export const L2_SITE = { x: 55, y: 35 } as const;
export const L2_BARREL = { x: 54, y: 34 } as const;
/** บ้านชาวบ้าน 5 หลัง (ตำแหน่งหน้าบ้าน) — ไม่มีป้ายชื่อบนแผนที่ · hp = บ้านนางแป้น (อยู่ในแอ่งต่ำที่สุด) */
export const L2_HOUSES = {
  west: { x: 27, y: 32 },
  mid: { x: 46, y: 28 },
  east: { x: 64, y: 30 },
  southeast: { x: 64, y: 47 },
  paen: { x: 46, y: 15 },
} as const;
export const L2_CONFLUENCE = { x: 34, y: 12 } as const;

const elevation = new ElevationModel(khlongNamLaiMap.elevation!);
/** ข้อความช่วงความสูงจากเส้นชั้นความสูง 50 ม. เช่น "100–150 ม." (ต่ำกว่า 100 = ไม่มีเส้นใต้ลงไป) */
export function bandLabel(h: number): string {
  const lo = Math.floor(h / 50) * 50;
  return lo < 100 ? 'ต่ำกว่า 100 ม.' : `${lo}–${lo + 50} ม.`;
}
const dirOf = (from: { x: number; y: number }, to: { x: number; y: number }) => THAI_DIRECTION[directionFromVector(to.x - from.x, to.y - from.y)!];
const OPPOSITE: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', NW: 'SE', SE: 'NW' };
const oppositeDir = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  THAI_DIRECTION[OPPOSITE[directionFromVector(to.x - from.x, to.y - from.y)!] as keyof typeof THAI_DIRECTION];
const streamB = analyzeWaterway(B_POINTS, elevation);
const streamA = analyzeWaterway(A_POINTS, elevation);
/** ทิศที่ต้อง "ย้อนขึ้นไปทางต้นน้ำ B" จากบ้านนางแป้น และระดับความสูงของต้นน้ำ (คำนวณจากแผนที่จริง) */
const UP_B = dirOf(L2_PAEN, streamB.source);
const DOWN_B = oppositeDir(L2_PAEN, streamB.source);
const UP_A = dirOf(L2_PAEN, streamA.source);
const SRC_B_BAND = bandLabel(streamB.sourceMeters);
const SRC_A_BAND = bandLabel(streamA.sourceMeters);
const LOW_BAND = bandLabel(elevation.heightAt(L2_CONFLUENCE.x, L2_CONFLUENCE.y));

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

/* ---------------- คำบอกทางเดียวของด่าน: ผู้ใหญ่บ้าน → ตาคำ (ใช้มาตราส่วนเหมือนด่านที่ 1) ---------------- */

const ROUTE_KHAM =
  'บ้านตาคำอยู่ทางทิศตะวันออกของบ้านข้า ห่างบนแผนที่ 4 เซนติเมตร (มาตราส่วน 1:10,000) เดินตามถนนไป จะผ่านสะพานข้ามลำน้ำกลางทาง';
const PAEN_HINT = 'มีชาวบ้านชื่อนางแป้นอาศัยอยู่ใกล้ลำน้ำในบริเวณที่ต่ำที่สุดของพื้นที่สำรวจ ลองไปตามหาเธอดู';

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
    question: 'บริเวณใดมีความลาดชันมากกว่า? (ช่วงต่างระดับเท่ากัน)',
    choices: choices('ไหล่เขาด้านตะวันตก เส้นอยู่ชิดกัน', 'ไหล่เขาด้านตะวันออก เส้นอยู่ห่างกัน', 'ทั้งสองด้านชันเท่ากัน'),
    correctChoiceId: 'c0',
    fallbackHint: 'เมื่อช่วงต่างระดับเท่ากัน เส้นที่อยู่ชิดกันแสดงว่าระดับความสูงเปลี่ยนเร็วในระยะทางสั้น จึงชันกว่า',
    correctFeedback: 'ถูกต้อง! เส้นอยู่ชิดกัน จึงชันกว่าบริเวณที่เส้นอยู่ห่างกัน',
    effects: [{ type: 'flag', flag: 'contours-learned' }],
  },
  {
    // ฉากที่ 5: ต้องอาศัยตำแหน่งที่ผู้เล่นพบเอง + แผนที่ (ลำน้ำ A/B มีชื่อกำกับบนแผนที่) — ไม่มีข้อความเฉลยก่อนตอบ
    id: 'q-stream',
    speaker: PLAYER,
    question: 'บ้านนางแป้นตั้งอยู่ใกล้ลำน้ำสายใด?',
    choices: choices('ลำน้ำ A', 'ลำน้ำ B', 'ลำน้ำสายหลัก (หลังจุดบรรจบ)'),
    correctChoiceId: 'c1',
    fallbackHint: 'ลองเปิดแผนที่ ดูจุดสีแดงที่เป็นตำแหน่งของเรา แล้วสังเกตใหม่ว่าอยู่ใกล้ลำน้ำสายใด จากนั้นคุยกับฉันอีกครั้งนะ',
    correctFeedback: 'ถูกต้อง! น้ำหน้าบ้านนางแป้นมาจากลำน้ำสายนี้',
    effects: [{ type: 'flag', flag: 'q-stream' }],
    wrongEndsDialogue: true,
    wrongSpeaker: PAEN,
  },
  {
    // ฉากที่ 6: ตัวเลือกสร้างจากทิศและระดับความสูงจริงของลำน้ำในแผนที่ (ตอบจากชื่อลำน้ำอย่างเดียวไม่ได้)
    id: 'q-upstream',
    speaker: PLAYER,
    question: 'จากข้อมูลระดับความสูงบนแผนที่ น้ำในลำน้ำสายนี้ไหลมาจากไหน และเราควรสำรวจย้อนขึ้นไปทางใด?',
    choices: choices(
      `ตามน้ำไปทาง${DOWN_B} ไปยังที่ต่ำ (${LOW_BAND})`,
      `ย้อนไปทาง${UP_A} ตามลำน้ำ A ที่ระดับ ${SRC_A_BAND}`,
      `ย้อนขึ้นไปทาง${UP_B} ตามลำน้ำ B ไปยังที่สูง (${SRC_B_BAND})`,
    ),
    correctChoiceId: 'c2',
    fallbackHint: 'น้ำไหลจากที่สูงลงที่ต่ำเสมอ ลองเปิดแผนที่ ดูตัวเลขความสูงของลำน้ำสายที่ใกล้บ้านนางแป้นว่าทางไหนสูงขึ้น แล้วคุยกับฉันอีกครั้งนะ',
    correctFeedback: 'ถูกต้อง! น้ำไหลจากที่สูงลงมาที่ต่ำ การตรวจสอบต้นน้ำจึงต้องย้อนขึ้นไปทางที่สูงขึ้นตามลำน้ำสายนี้',
    effects: [{ type: 'flag', flag: 'q-upstream' }],
    wrongEndsDialogue: true,
    wrongSpeaker: PAEN,
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

/** ฉากสุดท้าย: รายงานผู้ใหญ่บ้าน */
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
      { when: { flags: ['q-kham'], notFlags: ['q-chem'] }, ambient: true, nodes: [{ speaker: 'ผู้ใหญ่บ้าน', text: 'ลองเปิดแผนที่ของตาคำ แล้วสืบหาต้นน้ำให้เจอนะผู้กล้า ถ้าพบอะไรรีบกลับมาบอกข้า' }] },
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
        // ฉากที่ 2: ตาคำมอบแผนที่ — หลังบทสนทนาจบ แผนที่เด้งขึ้นกลางจอ (mapReveal)
        when: { flags: ['q-kham'], notFlags: ['got-topo'] },
        nodes: [
          { speaker: PLAYER, text: 'ตาคำครับ ผมกำลังตามหาต้นน้ำที่ถูกทิ้งสารเคมีครับ' },
          { speaker: 'ตาคำ', text: 'ตาเก็บแผนที่ภูมิประเทศแถบนี้ไว้ เจ้าลองนำไปใช้สืบหาต้นน้ำดู', effects: [{ type: 'flag', flag: 'got-topo' }] },
        ],
      },
      { when: { notFlags: ['q-chem'] }, ambient: true, nodes: [{ speaker: 'ตาคำ', text: 'แผนที่อยู่กับเจ้าแล้ว เปิดดูซ้ำได้จากปุ่มแผนที่ ลองไปถามเจ้าหน้าที่ป่าไม้เรื่องระดับความสูงดูนะ' }] },
      { ambient: true, nodes: [{ speaker: 'ตาคำ', text: 'ขอบใจที่ช่วยดูแลป่าต้นน้ำนะผู้กล้า' }] },
    ],
  },
  {
    id: 'ranger',
    name: RANGER,
    appearance: 'ranger',
    at: L2_RANGER,
    dialogue: [
      { when: { notFlags: ['got-topo'] }, ambient: true, nodes: [{ speaker: RANGER, text: 'ฉันเป็นเจ้าหน้าที่ป่าไม้ ถ้ามีเรื่องแผนที่และระดับความสูง ไปคุยกับตาคำก่อนก็ได้' }] },
      {
        // ฉากที่ 3 (1): ได้ข้อมูลระดับความสูง → บทเรียนเส้นชั้นความสูง → ให้เปิดแผนที่นับเส้นบนภูเขา
        when: { flags: ['got-topo'], notFlags: ['contour-task'] },
        nodes: [
          { speaker: PLAYER, text: 'ผมได้แผนที่จากตาคำ แต่ยังไม่รู้ว่าพื้นที่ไหนสูงหรือต่ำครับ' },
          { speaker: RANGER, text: 'ฉันมีข้อมูลระดับความสูงจากการสำรวจ ลองนำไปอ่านคู่กับแผนที่ดู' },
          { lesson: 'contour' },
          {
            speaker: RANGER,
            text: 'ผลสำรวจ: เส้นนอกสุดของภูเขาสูง 100 เมตร และแต่ละเส้นต่างกัน 50 เมตร ลองเปิดแผนที่ นับเส้นชั้นความสูงบนภูเขา แล้วกลับมาตอบฉัน',
            effects: [{ type: 'flag', flag: 'contour-task' }],
          },
        ],
      },
      {
        when: { flags: ['contour-task'], notFlags: ['contour-map', 'contour-labeled'] },
        ambient: true,
        nodes: [{ speaker: RANGER, text: 'ยังไม่ได้เปิดแผนที่เลยนะ ลองเปิดแผนที่ นับเส้นชั้นความสูงบนภูเขา แล้วค่อยกลับมาตอบ' }],
      },
      {
        // ฉากที่ 3 (2): กิจกรรมสั้น ๆ อ่านเส้นชั้นความสูง → เติมตัวเลขบนเส้น · ความลาดชัน → ตัวเลขความสูงของบ้าน → ไปตามหานางแป้น
        when: { flags: ['contour-task', 'contour-map'], notFlags: ['contours-learned'] },
        nodes: [
          ...unlessDone('contour-labeled', [
            { speaker: RANGER, text: 'นับเส้นบนภูเขาได้แล้วใช่ไหม ลองตอบดู' },
            { quiz: 'q-contour' },
            { speaker: RANGER, text: 'ฉันเติมตัวเลขความสูงลงบนเส้นชั้นความสูงในแผนที่ของตาคำให้แล้ว เปิดแผนที่ดูได้เลย' },
          ]),
          { speaker: RANGER, text: 'เส้นชั้นความสูงที่อยู่ชิดกันหมายถึงพื้นที่ชัน ส่วนเส้นที่ห่างกันหมายถึงพื้นที่ลาดชันน้อยกว่า เมื่อช่วงต่างระดับของเส้นเท่ากัน' },
          { speaker: RANGER, text: 'ลองเทียบไหล่เขาด้านตะวันตกกับด้านตะวันออกบนแผนที่ดู' },
          { quiz: 'q-slope' },
          { speaker: RANGER, text: 'เก่งมากผู้กล้า ตอนนี้เจ้ารู้แล้วว่าพื้นที่ไหนสูงหรือต่ำ ฉันเพิ่มตัวเลขความสูงของบ้านชาวบ้านลงบนแผนที่ให้ด้วย' },
          { speaker: RANGER, text: PAEN_HINT },
        ],
      },
      { when: { flags: ['contours-learned'], notFlags: ['q-chem'] }, ambient: true, nodes: [{ speaker: RANGER, text: PAEN_HINT }] },
      { ambient: true, nodes: [{ speaker: RANGER, text: 'ขอบใจที่แจ้งเรื่องสารเคมี ฉันจะรีบประสานเจ้าหน้าที่ไปตรวจสอบ' }] },
    ],
  },
  {
    id: 'paen',
    name: PAEN,
    appearance: 'auntie',
    at: L2_PAEN,
    dialogue: [
      { when: { notFlags: ['contours-learned'] }, ambient: true, nodes: [{ speaker: PAEN, text: 'สวัสดีจ้ะ ผู้กล้า มาเดินเที่ยวแถวนี้หรือ' }] },
      {
        // ฉากที่ 5 (1): พบนางแป้น → ให้เปิดแผนที่
        when: { flags: ['contours-learned'], notFlags: ['paen-task'] },
        nodes: [
          { speaker: PAEN, text: 'ช่วงนี้น้ำในลำธารแถวบ้านฉันเริ่มผิดปกติ ไม่รู้ว่าเกิดอะไรขึ้นจากต้นน้ำ', effects: [{ type: 'flag', flag: 'met-paen' }] },
          { speaker: PAEN, text: 'ลองเปิดแผนที่ดูก่อน แล้วกลับมาตอบฉันนะ', effects: [{ type: 'flag', flag: 'paen-task' }] },
        ],
      },
      {
        when: { flags: ['paen-task'], notFlags: ['paen-map', 'q-stream'] },
        ambient: true,
        nodes: [{ speaker: PAEN, text: 'ยังไม่ได้เปิดแผนที่เลยนะ ลองเปิดดูก่อนแล้วค่อยตอบ' }],
      },
      {
        // ฉากที่ 5 (2): คำถามว่าบ้านอยู่ใกล้ลำน้ำสายใด (ผิด = ปิดบทสนทนา ไปเปิดแผนที่สังเกตใหม่ แล้วคุยอีกครั้ง)
        when: { flags: ['paen-task', 'paen-map'], notFlags: ['upstream-task'] },
        nodes: [
          ...unlessDone('q-stream', [{ speaker: PLAYER, text: 'ผมเปิดแผนที่ดูแล้วครับ' }, { quiz: 'q-stream' }]),
          { speaker: PAEN, text: 'ถ้าน้ำแถวบ้านฉันผิดปกติ เราควรตรวจสอบว่ามีอะไรเกิดขึ้นทางต้นน้ำ ลองเปิดแผนที่ดูอีกครั้งว่าน้ำสายนี้ไหลมาจากทางไหน แล้วกลับมาคุยกัน', effects: [{ type: 'flag', flag: 'upstream-task' }] },
        ],
      },
      {
        when: { flags: ['upstream-task'], notFlags: ['upstream-map', 'q-upstream'] },
        ambient: true,
        nodes: [{ speaker: PAEN, text: 'ลองเปิดแผนที่ ดูว่าน้ำสายนี้ไหลมาจากทางไหน แล้วค่อยกลับมาคุยกันนะ' }],
      },
      {
        // ฉากที่ 6: วิเคราะห์ย้อนขึ้นต้นน้ำจากระดับความสูง
        when: { flags: ['upstream-task', 'upstream-map'], notFlags: ['q-upstream'] },
        nodes: [{ speaker: PAEN, text: 'ว่าอย่างไรจ๊ะ น้ำสายนี้ไหลมาจากไหน' }, { quiz: 'q-upstream' }, { speaker: PAEN, text: 'งั้นผู้กล้าช่วยไปตรวจสอบต้นน้ำให้หน่อยนะ ระวังตัวด้วย อย่าแตะต้องของแปลกปลอมเองนะ' }],
      },
      { when: { flags: ['q-upstream'], notFlags: ['q-chem'] }, ambient: true, nodes: [{ speaker: PAEN, text: 'ไปตรวจสอบต้นน้ำให้ฉันด้วยนะผู้กล้า ระวังตัวด้วย' }] },
      { ambient: true, nodes: [{ speaker: PAEN, text: 'ขอบใจผู้กล้ามากนะจ๊ะ น้ำในลำธารจะได้กลับมาสะอาด' }] },
    ],
  },
];

/* ---------------- ฉาก (แถบภารกิจ — ไม่บอกทิศ/ตำแหน่งของนางแป้นและต้นน้ำ) ---------------- */

const micro = (id: string, goal: string, steps: string[], done: MicroStep['done'], doneText: string): MicroStep => ({
  id,
  goal,
  steps,
  result: 'ภารกิจเดินหน้าต่อ',
  tools: ['แผนที่', 'เข็มทิศ', 'วัดระยะ'],
  tool: 'เปิดแผนที่ดูถนน ทางแยก แม่น้ำ สะพาน เส้นชั้นความสูง และบ้านได้ · เหนืออยู่ด้านบนเสมอ',
  think: 'ลองเทียบตัวเลขความสูงบนแผนที่ กับสิ่งที่เห็นรอบตัว',
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
  step(2, 'ไปพบตาคำและรับแผนที่', 'kham-house', 'got-topo', [
    micro('s2a', 'เดินไปบ้านตาคำ', ['ไปทางทิศตะวันออก 4 ซม. บนแผนที่ (1:10,000)', 'ตามถนนไป ผ่านสะพานข้ามลำน้ำกลางทาง'], { type: 'near', npcId: 'ta-kham' }, '✓ ถึงบ้านตาคำแล้ว'),
    micro('s2b', 'คุยกับตาคำ รับแผนที่ภูมิประเทศ', ['เข้าไปคุยกับตาคำ', 'แผนที่ของตาคำเปิดดูซ้ำได้จากปุ่มแผนที่'], flag('got-topo'), '✓ ได้รับแผนที่ของตาคำ'),
  ]),
  step(3, 'ไปพบเจ้าหน้าที่ป่าไม้เพื่อสอบถามข้อมูลระดับความสูง', 'ranger-station', 'contour-task', [
    micro(
      's3a',
      'ไปพบเจ้าหน้าที่ป่าไม้เพื่อสอบถามข้อมูลระดับความสูง',
      ['เปิดแผนที่ของตาคำ ดูว่าสถานีป่าไม้อยู่ตรงไหน แล้วเดินไปเอง', 'ไม่มีลูกศรหรือหมุดนำทาง'],
      { type: 'near', npcId: 'ranger' },
      '✓ ถึงสถานีป่าไม้แล้ว',
    ),
    micro('s3b', 'คุยกับเจ้าหน้าที่ป่าไม้', ['ฟังเรื่องเส้นชั้นความสูง', 'จดผลสำรวจ: เส้นนอกสุด 100 ม. ต่างกันเส้นละ 50 ม.'], flag('contour-task'), '✓ ได้ข้อมูลระดับความสูง'),
  ]),
  step(4, 'อ่านเส้นชั้นความสูงและความลาดชัน', 'ranger-station', 'contours-learned', [
    micro('s4a', 'เปิดแผนที่ นับเส้นชั้นความสูงบนภูเขา', ['เปิดแผนที่ (ปุ่มแผนที่)', 'นับจำนวนเส้นบนภูเขา เส้นนอกสุด 100 ม. ต่างกันเส้นละ 50 ม.'], flag('contour-map'), '✓ ดูแผนที่แล้ว'),
    micro('s4b', 'ตอบโจทย์ความสูง แล้วเติมตัวเลขลงบนแผนที่', ['กลับไปคุยกับเจ้าหน้าที่ป่าไม้', 'ตอบว่าเส้นในสุดสูงเท่าไร'], flag('contour-labeled'), '✓ ตัวเลขความสูงถูกเติมบนแผนที่แล้ว'),
    micro('s4c', 'ตอบโจทย์ความลาดชัน', ['เส้นชิดกันหรือห่างกัน ต่างกันอย่างไร'], flag('contours-learned'), '✓ เข้าใจความสูงและความลาดชัน'),
  ]),
  step(5, 'ตามหานางแป้นที่อาศัยอยู่ใกล้ลำน้ำในพื้นที่ต่ำที่สุด', 'house-5', 'met-paen', [
    micro(
      's5',
      'ตามหานางแป้นที่อาศัยอยู่ใกล้ลำน้ำในพื้นที่ต่ำที่สุด',
      ['เปิดแผนที่ภูมิประเทศ', 'อ่านตัวเลขระดับความสูง', 'เปรียบเทียบพื้นที่ต่าง ๆ', 'สำรวจเส้นทางด้วยตนเอง (เลือกทางแยกเอง)', 'ค้นหาบ้านนางแป้น'],
      flag('met-paen'),
      '✓ พบนางแป้นแล้ว',
    ),
  ]),
  step(6, 'ระบุลำน้ำที่ใกล้บ้านนางแป้น', 'house-5', 'q-stream', [
    micro('s6', 'เปิดแผนที่ ดูว่าบ้านนางแป้นอยู่ใกล้ลำน้ำสายใด', ['เปิดแผนที่ ดูจุดสีแดงที่เป็นตำแหน่งของเรา', 'แล้วคุยกับนางแป้นอีกครั้ง ตอบว่าบ้านอยู่ใกล้ลำน้ำสายใด'], flag('q-stream'), '✓ ระบุลำน้ำถูกต้อง'),
  ]),
  step(7, 'วิเคราะห์ย้อนขึ้นไปยังต้นน้ำ', 'house-5', 'q-upstream', [
    micro('s7', 'ใช้ระดับความสูงหาว่าต้องสำรวจย้อนขึ้นไปทางใด', ['เปิดแผนที่ ดูตัวเลขความสูงตามลำน้ำสายนั้น', 'น้ำไหลจากที่สูงลงที่ต่ำ แล้วคุยกับนางแป้น'], flag('q-upstream'), '✓ รู้ทิศที่ต้องสำรวจแล้ว'),
  ]),
  step(8, 'เดินสำรวจย้อนขึ้นไปตามลำน้ำเพื่อตรวจสอบต้นน้ำ', 'peak', 'site-found', [
    micro('s8', 'เดินสำรวจย้อนขึ้นไปตามลำน้ำด้วยตนเอง', ['ใช้แผนที่ เข็มทิศ และตัวเลขความสูง', 'ไม่มีลูกศร หมุด หรือเส้นนำทาง'], flag('site-found'), '✓ พบร่องรอยสารเคมี'),
  ]),
  step(9, 'เลือกวิธีรับมือถังสารเคมี', 'peak', 'q-chem', [
    micro('s9', 'ตัดสินใจอย่างปลอดภัย', ['อย่าสัมผัสหรือเคลื่อนย้ายถัง', 'เลือกวิธีรับมือที่ปลอดภัยที่สุด'], flag('q-chem'), '✓ ตัดสินใจถูกต้อง'),
  ]),
  step(10, 'กลับไปรายงานผู้ใหญ่บ้าน', 'headman-house', 'l2-report', [
    micro('s10', 'เดินกลับไปรายงานผู้ใหญ่บ้าน', ['บ้านผู้ใหญ่บ้านอยู่ปลายถนนสายหลักทางตะวันตก', 'ใช้แผนที่และเข็มทิศเดินกลับด้วยตนเอง'], flag('l2-report'), '✓ รายงานสำเร็จ'),
  ]),
];

const known = { showLabel: true } as const;
const onMap: Condition = { flags: ['got-topo'] };
/** เครื่องหมายบนแผนที่ภูมิประเทศ (แสดงเมื่อได้รับแผนที่) — บ้านชาวบ้านทุกหลังเหมือนกัน ไม่บอกว่าหลังใดคือบ้านนางแป้น */
const mark = { showLabel: true, knownWhen: onMap, mapMark: true } as const;
const house = (id: string, at: { x: number; y: number }) => ({ id, name: 'บ้านชาวบ้าน', at, symbol: 'village' as const, mapLabelAt: 'right' as const, ...mark });

export const khlongNamLaiLevel: LevelDefinition = {
  id: 'level-2',
  contentVersion: 12,
  tambon: 'ตำบลคลองน้ำไหล',
  title: 'ปริศนาสารพิษแห่งต้นน้ำ',
  map: khlongNamLaiMap,
  spawn: { x: 14, y: 11 },
  fog: { revealRadiusTiles: 5 },
  exploreMode: true,
  // ป้ายชื่อแสดงเมื่อเดินเข้าใกล้เท่านั้น · เครื่องหมายบนแผนที่ (บ้าน ภูเขา ป่า สถานีป่าไม้ จุดบรรจบ) แสดงเมื่อได้รับแผนที่ของตาคำ
  landmarks: [
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 14, y: 9 }, ...known },
    { id: 'bridge', name: 'สะพานข้ามลำน้ำ', at: { x: 34, y: 10 }, ...known },
    { id: 'kham-house', name: 'บ้านตาคำ', at: { x: 54, y: 9 }, ...known },
    { id: 'ranger-station', name: 'สถานีป่าไม้', at: { x: 74, y: 9 }, symbol: 'office', ...mark },
    house('house-1', L2_HOUSES.west),
    house('house-2', L2_HOUSES.mid),
    house('house-3', L2_HOUSES.east),
    house('house-4', L2_HOUSES.southeast),
    house('house-5', L2_HOUSES.paen),
    { id: 'confluence', name: 'จุดบรรจบลำน้ำ A และ B', at: L2_CONFLUENCE, mapLabelAt: 'left', ...mark },
    { id: 'peak', name: 'เขาสูง', at: { x: 41, y: 39 }, symbol: 'peak', ...mark },
    { id: 'forest-w', name: 'ป่า', at: { x: 20, y: 46 }, symbol: 'forest', ...mark },
    { id: 'forest-e', name: 'ป่า', at: { x: 72, y: 36 }, symbol: 'forest', ...mark },
  ],
  npcs,
  triggers: [{ id: 'intro', area: { x: 12, y: 11, w: 5, h: 2 }, npcId: 'headman', when: { notFlags: ['q-kham'] } }],
  story,
  quizzes,
  lessons,
  arrivals: [
    // เดินถึงต้นน้ำ B (ต้องวิเคราะห์ย้อนขึ้นต้นน้ำถูกก่อน) → ข้อความ + ถังสารเคมี + คำถามวิธีรับมือ (ผ่านเมื่อตอบถูก)
    {
      id: 'site',
      at: L2_SITE,
      radiusTiles: 2.5,
      when: { flags: ['q-upstream'] },
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
      description: 'สืบหาจุดทิ้งสารเคมีด้วยแผนที่ เส้นชั้นความสูง และทิศทางการไหลของน้ำ',
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
  // ถังสารเคมีที่ถูกทิ้งใกล้ลำธาร (ปรากฏหลังเดินถึงต้นน้ำ) — ภาพอย่างเดียว ไม่มีการชน ไม่เคลื่อนย้ายได้
  decor: [{ id: 'chem-barrel', kind: 'barrel', at: L2_BARREL, showWhen: { flags: ['barrel-seen'] } }],
  // แผนที่ภูมิประเทศชุดเดียวตลอดภารกิจ: ได้จากตาคำ (เด้งขึ้นกลางจอ · ยังไม่มีตัวเลข) → ตัวเลขบนเส้น (หลังกิจกรรม 1) → ตัวเลขความสูงของบ้าน (หลังกิจกรรม 2)
  topoMapFlag: 'got-topo',
  mapReveal: { flag: 'got-topo', shownFlag: 'map-revealed', title: 'คุณได้รับแผนที่ของตาคำ!' },
  contourIntervalMeters: 50,
  contourLabelsFlag: 'contour-labeled',
  spotHeightsFlag: 'contours-learned',
  mapOpenMarks: [
    // เปิดแผนที่หลังเจ้าหน้าที่ให้ไปนับเส้น (การเปิดแผนที่ตอนรับแผนที่จากตาคำไม่นับ)
    { when: { flags: ['contour-task'] }, flag: 'contour-map' },
    { when: { flags: ['paen-task'] }, flag: 'paen-map' },
    { when: { flags: ['upstream-task'] }, flag: 'upstream-map' },
  ],
  spotHeights: [L2_HOUSES.west, L2_HOUSES.mid, L2_HOUSES.east, L2_HOUSES.southeast, L2_HOUSES.paen],
  waterways: [
    { id: 'stream-a', name: 'ลำน้ำ A', points: A_POINTS, showName: true },
    { id: 'stream-b', name: 'ลำน้ำ B', points: B_POINTS, showName: true },
    { id: 'stream-main', name: 'ลำน้ำสายหลัก', points: MAIN_POINTS, showName: true },
  ],
  unlocks: 'level-3',
  skills: ['direction', 'scale', 'elevation'],
};
