import { DIRECTIONS_8, directionFromVector, THAI_DIRECTION, type Direction8 } from '../../core/direction/Compass';
import { ElevationModel } from '../../core/world/Elevation';
import type { MapDefinition, TilePoint } from '../../core/world/types';
import type { CharacterAppearance, Choice, LevelDefinition, QuizDefinition, StoryStep } from '../types';

/**
 * ภารกิจแบบเรียบง่าย (v0.22): 1 NPC = 1 ปัญหา = 1 เป้าหมาย
 *   NPC พูดไม่เกิน 2 ประโยค → คำถาม 3 ตัวเลือก → ตอบถูก +100 เหรียญ +10 ศรัทธา (ครั้งแรกเท่านั้น) · ตอบผิดลองใหม่ ไม่เสียอะไร
 * ทุกด่านใช้ตัวสร้างนี้ร่วมกัน — ด่านเขียนเป็น "ข้อมูล" (MissionSpec) ไม่มีโค้ดระบบเกม
 * ข้อเท็จจริงทางภูมิศาสตร์ (ทิศ ความสูง) คำนวณจากแผนที่จริงด้วยฟังก์ชันด้านล่าง จึงไม่ผิดเมื่อแก้แผนที่
 */

export const MISSION_COINS = 100;
export const MISSION_FAITH = 10;

export interface MissionSpec {
  /** รหัสสั้นของภารกิจ (ใช้ทำ flag m-<id>) */
  id: string;
  npc: { id: string; name: string; appearance: CharacterAppearance; at: TilePoint };
  /** ปัญหาของ NPC (≤ 2 ประโยค) */
  problem: string;
  question: string;
  correct: string;
  wrong: [string, string];
  /** คำใบ้สั้นเมื่อตอบผิด */
  hint: string;
  /** คำตอบถูก: ผลลัพธ์ 1 ประโยค */
  feedback: string;
  /** NPC พูดหลังช่วยแล้ว (≤ 2 ประโยค) */
  thanks: string;
  /** จุดสังเกตที่ภารกิจนี้อ้างถึง (ต้องมีใน landmarks) */
  landmark: string;
  /** ข้อความบนแถบภารกิจ (สั้น) */
  goal: string;
}

export const missionFlag = (id: string): string => `m-${id}`;

/* ---------------- ข้อเท็จจริงจากแผนที่ ---------------- */

export function dirBetween(from: TilePoint, to: TilePoint): Direction8 {
  return directionFromVector(to.x - from.x, to.y - from.y) as Direction8;
}

/** ทิศที่ถูก + ตัวเลือกหลอก 2 ข้อ (ทิศตรงข้าม และทิศที่ตั้งฉาก) */
export function directionChoices(from: TilePoint, to: TilePoint): { correct: string; wrong: [string, string] } {
  const d = dirBetween(from, to);
  const i = DIRECTIONS_8.indexOf(d);
  return { correct: THAI_DIRECTION[d], wrong: [THAI_DIRECTION[DIRECTIONS_8[(i + 4) % 8]], THAI_DIRECTION[DIRECTIONS_8[(i + 2) % 8]]] };
}

export function flowChoices(flow: Direction8): { correct: string; wrong: [string, string] } {
  const i = DIRECTIONS_8.indexOf(flow);
  return { correct: THAI_DIRECTION[flow], wrong: [THAI_DIRECTION[DIRECTIONS_8[(i + 4) % 8]], THAI_DIRECTION[DIRECTIONS_8[(i + 2) % 8]]] };
}

/** ความสูง (ม.) ของจุดบนแผนที่ที่มีแบบจำลองความสูง */
export function heightOf(map: MapDefinition, p: TilePoint): number {
  return new ElevationModel(map.elevation!).meters(p);
}

/** จุดที่สูงที่สุด/ต่ำที่สุดในกลุ่ม — ต้องห่างอันดับสองอย่างน้อย margin เมตร (ไม่กำกวม) */
export function extremeOf(
  map: MapDefinition,
  points: Array<{ id: string; at: TilePoint }>,
  which: 'highest' | 'lowest',
): { id: string; others: [string, string]; meters: Record<string, number> } {
  const meters = Object.fromEntries(points.map((p) => [p.id, heightOf(map, p.at)]));
  const sorted = [...points].sort((a, b) => (which === 'highest' ? meters[b.id] - meters[a.id] : meters[a.id] - meters[b.id]));
  if (Math.abs(meters[sorted[0].id] - meters[sorted[1].id]) < 3) throw new Error(`ความสูงของ ${sorted[0].id} กับ ${sorted[1].id} ใกล้กันเกินไป`);
  return { id: sorted[0].id, others: [sorted[1].id, sorted[2].id], meters };
}

/* ---------------- ตัวสร้างภารกิจ ---------------- */

type Built = Pick<LevelDefinition, 'npcs' | 'story' | 'quizzes' | 'quests' | 'ending'>;

export function buildMissions(levelId: string, specs: MissionSpec[], opts: { startFlag?: string } = {}): Built {
  const flags = specs.map((s) => missionFlag(s.id));
  const quizzes: QuizDefinition[] = specs.map((s, i) => {
    // ตำแหน่งคำตอบถูกหมุนไปตามลำดับภารกิจ (ไม่ใช่ข้อ ก ตลอด)
    const labels = [s.wrong[0], s.wrong[1]];
    labels.splice(i % 3, 0, s.correct);
    const choices: Choice[] = labels.map((label, k) => ({ id: `c${k}`, label, ...(label === s.correct ? {} : { hint: s.hint }) }));
    return {
      id: `q-${s.id}`,
      speaker: s.npc.name,
      question: s.question,
      choices,
      correctChoiceId: `c${labels.indexOf(s.correct)}`,
      fallbackHint: s.hint,
      correctFeedback: s.feedback,
      effects: [
        { type: 'flag', flag: missionFlag(s.id) },
        { type: 'reward', id: missionFlag(s.id), coins: MISSION_COINS, faith: MISSION_FAITH },
      ],
    };
  });

  const npcs = specs.map((s, i) => ({
    id: s.npc.id,
    name: s.npc.name,
    appearance: s.npc.appearance,
    at: s.npc.at,
    dialogue: [
      {
        when: { notFlags: [missionFlag(s.id)] },
        nodes: [
          {
            speaker: s.npc.name,
            text: s.problem,
            ...(i === 0 && opts.startFlag ? { effects: [{ type: 'flag' as const, flag: opts.startFlag }] } : {}),
          },
          { quiz: `q-${s.id}` },
        ],
      },
      { ambient: true, nodes: [{ speaker: s.npc.name, text: s.thanks }] },
    ],
  }));

  const story: StoryStep[] = specs.map((s, i) => ({
    order: i + 1,
    title: s.goal,
    objective: s.goal,
    landmarkId: s.landmark,
    status: 'playable',
    completeWhen: { type: 'flag', flag: missionFlag(s.id) },
    micro: [
      {
        id: `${s.id}-talk`,
        goal: s.goal,
        steps: [`เดินไปหา${s.npc.name} (ตามลูกศรชี้)`, 'กดคุย แล้วเลือกคำตอบ'],
        result: `ตอบถูกได้ +${MISSION_COINS} เหรียญ +${MISSION_FAITH} ศรัทธา`,
        tools: ['ปุ่มคุย'],
        tool: 'ดูแผนที่ประกอบคำถามได้ (ปุ่มแผนที่)',
        think: 'ลองเปิดแผนที่ แล้วเทียบกับสิ่งที่เห็นรอบตัว',
        doneText: `✓ ช่วย${s.npc.name}สำเร็จ`,
        done: { type: 'flag', flag: missionFlag(s.id) },
        target: { npcId: s.npc.id },
      },
    ],
  }));

  return {
    npcs,
    story,
    quizzes,
    quests: [
      {
        id: 'main',
        kind: 'main',
        title: 'ช่วยชาวบ้าน',
        description: `ช่วยชาวบ้านทั้ง ${specs.length} คน`,
        lockedHint: '',
        objectives: specs.map((s, i) => ({ text: s.goal, done: { type: 'step', order: i + 1 } })),
        reward: { text: 'ชาวบ้านศรัทธาในตัวผู้นำมากขึ้น' },
      },
    ],
    ending: {
      messages: [{ speaker: 'ชาวบ้าน', text: 'ขอบคุณที่ช่วยพวกเรา! ผู้นำชุมชนช่างเป็นที่พึ่งจริง ๆ' }],
      startWhen: { flags },
      rewardItem: 'ความศรัทธาของชาวบ้าน',
      completeFlag: `${levelId}-complete`,
    },
  };
}
