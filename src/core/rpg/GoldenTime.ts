import type { GoldenQuestionData } from '../../content/rpg/goldenQuestions';

/**
 * Golden Time — ตอบคำถามภูมิศาสตร์ 5 นาที (ตรรกะล้วน)
 *   หัวใจ 3 ดวง · ตอบถูก +100 เหรียญ · ตอบผิด −1 หัวใจ (ไม่หักเงิน) · หัวใจหมด/เวลาหมด/คำถามหมด = จบ (ไม่มี Game Over)
 *   สุ่มคำถามไม่ซ้ำจนครบคลัง · คำถามละ 3 ตัวเลือก (สลับลำดับ) · ไม่มี combo/คะแนนพิเศษ
 */
export const GOLDEN_DURATION_MS = 5 * 60 * 1000;
export const GOLDEN_HEARTS = 3;
export const GOLDEN_COINS_PER_ANSWER = 100;
export const GOLDEN_LOW_TIME_MS = 30 * 1000;

export interface ShownQuestion {
  id: string;
  q: string;
  choices: [string, string, string];
  correct: number;
}

export type GoldenEnd = 'hearts' | 'time' | 'bank' | null;

function shuffle<T>(a: readonly T[], rng: () => number): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class GoldenTime {
  hearts = GOLDEN_HEARTS;
  coins = 0;
  timeLeftMs: number;
  over: GoldenEnd = null;
  answered = 0;
  right = 0;
  private readonly queue: ShownQuestion[];
  private index = 0;

  constructor(bank: readonly GoldenQuestionData[], rng: () => number = Math.random, durationMs = GOLDEN_DURATION_MS) {
    this.timeLeftMs = durationMs;
    this.queue = shuffle(bank, rng).map((d) => {
      const order = shuffle([0, 1, 2], rng);
      const choices = order.map((i) => d.c[i]) as [string, string, string];
      return { id: d.id, q: d.q, choices, correct: order.indexOf(0) };
    });
    if (this.queue.length === 0) this.over = 'bank';
  }

  get current(): ShownQuestion | null {
    return this.over ? null : (this.queue[this.index] ?? null);
  }

  get lowTime(): boolean {
    return !this.over && this.timeLeftMs <= GOLDEN_LOW_TIME_MS;
  }

  /** เวลาผ่านไป (มิลลิวินาที) — หยุดนับเมื่อจบแล้ว */
  tick(dtMs: number): void {
    if (this.over) return;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - Math.max(0, dtMs));
    if (this.timeLeftMs <= 0) this.over = 'time';
  }

  /** ตอบข้อปัจจุบัน (index 0–2) — ถูก +100 · ผิด −1 หัวใจ · ยังไม่เปลี่ยนข้อ (เรียก next() เมื่อแสดงผลแล้ว) */
  answer(choice: number): { correct: boolean; correctIndex: number } | null {
    const q = this.current;
    if (!q || choice < 0 || choice > 2) return null;
    this.answered++;
    const correct = choice === q.correct;
    if (correct) {
      this.right++;
      this.coins += GOLDEN_COINS_PER_ANSWER;
    } else {
      this.hearts = Math.max(0, this.hearts - 1);
      if (this.hearts === 0) this.over = 'hearts';
    }
    return { correct, correctIndex: q.correct };
  }

  /** ไปข้อถัดไป — คลังหมดแล้วจบ (เก็บรางวัลที่ได้) */
  next(): void {
    if (this.over) return;
    this.index++;
    if (this.index >= this.queue.length) this.over = 'bank';
  }
}
