import type { DialogueLine, DialogueNode, Effect, LessonDefinition, LessonNode, QuizDefinition } from '../../content/types';

export type DialogueView =
  | { kind: 'line'; speaker: string; text: string; step: number; total: number; button?: string }
  /** บทเรียนทีละหน้า: มีปุ่มถัดไป/ย้อนกลับ */
  | { kind: 'lesson'; speaker: string; title: string; text: string; page: number; pages: number; step: number; total: number }
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
  getLesson(id: string): LessonDefinition | undefined;
  applyEffect(effect: Effect): void;
  onQuizAnswer(quizId: string, correct: boolean): void;
}

function isLesson(node: DialogueNode): node is LessonNode {
  return 'lesson' in node;
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
  private lessonPage = 0;

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
    if (isLesson(node)) {
      const lesson = this.requireLesson(node.lesson);
      const pg = lesson.pages[this.lessonPage];
      return {
        kind: 'lesson',
        speaker: lesson.speaker,
        title: this.hooks.resolveText(pg.title),
        text: this.hooks.resolveText(pg.text),
        page: this.lessonPage + 1,
        pages: lesson.pages.length,
        step,
        total,
      };
    }
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
    return { kind: 'line', speaker: node.speaker, text: this.hooks.resolveText(node.text), step, total, ...(node.button ? { button: node.button } : {}) };
  }

  /** ไปบรรทัดถัดไป (ใช้ได้เฉพาะเมื่อกำลังแสดงบรรทัดธรรมดา) */
  advance(): void {
    if (this.done || isQuiz(this.nodes[this.pos])) return;
    const cur = this.nodes[this.pos];
    // บทเรียน: ถัดไป = หน้าถัดไป · หน้าสุดท้าย = จบบทเรียน
    if (isLesson(cur) && this.lessonPage < this.requireLesson(cur.lesson).pages.length - 1) {
      this.lessonPage++;
      return;
    }
    this.pos++;
    this.enter();
  }

  /** ย้อนกลับหน้าก่อนหน้าของบทเรียน (ไม่มีผลกับบรรทัด/คำถาม) */
  back(): void {
    if (this.done || !isLesson(this.nodes[this.pos]) || this.lessonPage === 0) return;
    this.lessonPage--;
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
      for (const e of quiz.wrongEffects ?? []) this.hooks.applyEffect(e);
      // ตอบผิด → เปิดบทเรียนก่อน แล้วกลับมาตอบคำถามเดิม (ความคืบหน้าไม่รีเซ็ต)
      if (quiz.wrongLesson && this.hooks.getLesson(quiz.wrongLesson)) {
        this.nodes.splice(this.pos, 0, { lesson: quiz.wrongLesson });
        this.lessonPage = 0;
        this.feedback = null;
        return false;
      }
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

  private requireLesson(id: string): LessonDefinition {
    const lesson = this.hooks.getLesson(id);
    if (!lesson) throw new Error(`ไม่พบบทเรียน: ${id}`);
    return lesson;
  }

  private enter(): void {
    this.feedback = null;
    this.lessonPage = 0;
    if (this.done) return;
    const node = this.nodes[this.pos];
    if (!isQuiz(node) && !isLesson(node)) for (const e of node.effects ?? []) this.hooks.applyEffect(e);
  }
}
