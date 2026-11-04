import type { DialogueLine, DialogueNode, Effect, QuizDefinition } from '../../content/types';

export type DialogueView =
  | { kind: 'line'; speaker: string; text: string; step: number; total: number }
  | {
      kind: 'quiz';
      speaker: string;
      question: string;
      choices: string[];
      /** คำใบ้หลังตอบผิด (null = ยังไม่เคยตอบผิดในรอบนี้) */
      feedback: string | null;
      step: number;
      total: number;
    };

export interface DialogueHooks {
  resolveText(text: string): string;
  getQuiz(id: string): QuizDefinition | undefined;
  applyEffect(effect: Effect): void;
  onQuizAnswer(quizId: string, correct: boolean): void;
}

function isQuiz(node: DialogueNode): node is { quiz: string } {
  return 'quiz' in node;
}

/**
 * ตัวเดินบทสนทนา (ไม่ผูกกับการแสดงผล)
 * - บรรทัดธรรมดา: advance() ไปบรรทัดถัดไป, effects ของบรรทัดจะทำงานเมื่อบรรทัดนั้นแสดง
 * - คำถาม: answer(i) — ผิดจะอยู่ที่คำถามเดิมพร้อมคำใบ้, ถูกจะแสดงคำชมแล้วไปต่อ
 */
export class DialogueRunner {
  private readonly nodes: DialogueNode[];
  private pos = 0;
  private feedback: string | null = null;

  constructor(nodes: DialogueNode[], private readonly hooks: DialogueHooks) {
    this.nodes = [...nodes];
    this.enter();
  }

  get done(): boolean {
    return this.pos >= this.nodes.length;
  }

  get view(): DialogueView | null {
    if (this.done) return null;
    const node = this.nodes[this.pos];
    const step = this.pos + 1;
    const total = this.nodes.length;
    if (isQuiz(node)) {
      const quiz = this.requireQuiz(node.quiz);
      return {
        kind: 'quiz',
        speaker: quiz.speaker,
        question: this.hooks.resolveText(quiz.question),
        choices: quiz.choices.map((c) => this.hooks.resolveText(c.label)),
        feedback: this.feedback === null ? null : this.hooks.resolveText(this.feedback),
        step,
        total,
      };
    }
    return { kind: 'line', speaker: node.speaker, text: this.hooks.resolveText(node.text), step, total };
  }

  /** ไปบรรทัดถัดไป (ใช้ได้เฉพาะเมื่อกำลังแสดงบรรทัดธรรมดา) */
  advance(): void {
    if (this.done || isQuiz(this.nodes[this.pos])) return;
    this.pos++;
    this.enter();
  }

  /** ตอบคำถาม; คืน true/false ตามความถูกต้อง หรือ null ถ้าไม่ได้อยู่ที่คำถาม */
  answer(choiceIndex: number): boolean | null {
    if (this.done) return null;
    const node = this.nodes[this.pos];
    if (!isQuiz(node)) return null;
    const quiz = this.requireQuiz(node.quiz);
    const choice = quiz.choices[choiceIndex];
    if (!choice) return null;
    const correct = choice.id === quiz.correctChoiceId;
    this.hooks.onQuizAnswer(quiz.id, correct);
    if (!correct) {
      this.feedback = choice.hint ?? quiz.fallbackHint;
      return false;
    }
    const praise: DialogueLine = { speaker: quiz.speaker, text: quiz.correctFeedback, effects: quiz.effects };
    this.nodes.splice(this.pos + 1, 0, praise);
    this.pos++;
    this.enter();
    return true;
  }

  private requireQuiz(id: string): QuizDefinition {
    const quiz = this.hooks.getQuiz(id);
    if (!quiz) throw new Error(`ไม่พบคำถาม: ${id}`);
    return quiz;
  }

  private enter(): void {
    this.feedback = null;
    if (this.done) return;
    const node = this.nodes[this.pos];
    if (!isQuiz(node)) for (const e of node.effects ?? []) this.hooks.applyEffect(e);
  }
}
