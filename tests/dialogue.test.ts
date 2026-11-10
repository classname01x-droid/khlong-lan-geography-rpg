import { describe, expect, it } from 'vitest';
import type { Effect, QuizDefinition } from '../src/content/types';
import { DialogueRunner } from '../src/core/dialogue/DialogueRunner';

const quiz: QuizDefinition = {
  id: 'q',
  speaker: 'A',
  question: 'Q?',
  choices: [
    { id: 'x', label: 'X', hint: 'not X' },
    { id: 'y', label: 'Y' },
    { id: 'z', label: 'Z' },
  ],
  correctChoiceId: 'y',
  fallbackHint: 'try again',
  correctFeedback: 'yes',
  effects: [{ type: 'flag', flag: 'solved' }],
};

function runner(applied: Effect[], answers: boolean[]) {
  return new DialogueRunner(
    [{ speaker: 'A', text: 'hi', effects: [{ type: 'flag', flag: 'greeted' }] }, { quiz: 'q' }, { speaker: 'A', text: 'bye' }],
    {
      resolveText: (t) => t,
      getQuiz: (id) => (id === 'q' ? quiz : undefined),
      getLesson: () => undefined,
      applyEffect: (e) => applied.push(e),
      onQuizAnswer: (_id, ok) => answers.push(ok),
    },
  );
}

describe('DialogueRunner', () => {
  it('effects ทำงานเมื่อบรรทัดแสดง; คำถามต้องตอบถูกจึงไปต่อ', () => {
    const applied: Effect[] = [];
    const answers: boolean[] = [];
    const r = runner(applied, answers);
    expect(applied).toEqual([{ type: 'flag', flag: 'greeted' }]);
    expect(r.answer(0)).toBeNull(); // ยังไม่ถึงคำถาม
    r.advance();
    expect(r.view?.kind).toBe('quiz');
    r.advance(); // advance ไม่ข้ามคำถาม
    expect(r.view?.kind).toBe('quiz');
    expect(r.answer(0)).toBe(false);
    expect(r.view).toMatchObject({ kind: 'quiz', feedback: 'not X' });
    expect(r.answer(2)).toBe(false);
    expect(r.view).toMatchObject({ kind: 'quiz', feedback: 'try again' });
    expect(r.answer(1)).toBe(true);
    expect(r.view).toMatchObject({ kind: 'line', text: 'yes' });
    expect(applied).toContainEqual({ type: 'flag', flag: 'solved' });
    r.advance();
    expect(r.view).toMatchObject({ kind: 'line', text: 'bye' });
    r.advance();
    expect(r.done).toBe(true);
    expect(answers).toEqual([false, false, true]);
  });
});
