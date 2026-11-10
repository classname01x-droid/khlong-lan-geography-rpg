import { describe, expect, it } from 'vitest';
import { LEVELS as ALL } from '../src/content/registry';
import { missionFlag, rewardId } from '../src/content/levels/simple';
import type { LevelDefinition } from '../src/content/types';
import { ProgressStore } from '../src/core/progress/ProgressStore';
import { ElevationModel } from '../src/core/world/Elevation';
import { newSession, talk } from './helpers';

// ด่าน 3–4 ใช้ตัวสร้างภารกิจแบบ 1 NPC = 1 คำถาม · ด่าน 1 (สักงาม) และด่าน 2 (ปริศนาสารพิษแห่งต้นน้ำ) เป็นด่านสำรวจด้วยทิศ+มาตราส่วน
// — ทดสอบใน tests/sakngam.test.ts และ tests/khlongnamlai.test.ts
const LEVELS = ALL.filter((l) => l.id !== 'sakngam' && l.id !== 'level-2');
const store = () => new ProgressStore(null, 'sakngam');

/** ตอบถูกทุกข้อของด่าน (รู้คำตอบจากข้อมูลด่าน) */
function solve(level: LevelDefinition, s: ReturnType<typeof newSession>): void {
  for (const npc of level.npcs) {
    const quiz = level.quizzes!.find((q) => npc.dialogue[0].nodes.some((n) => 'quiz' in n && n.quiz === q.id))!;
    talk(s, npc.id, [quiz.choices.findIndex((c) => c.id === quiz.correctChoiceId)]);
  }
}

describe('ภารกิจแบบเรียบง่าย: 1 NPC = 1 ปัญหา = 1 เป้าหมาย', () => {
  for (const level of LEVELS) {
    describe(level.id, () => {
      it('มี 3 ภารกิจ · NPC ละ 1 คำถาม 3 ตัวเลือก (ถูก 1) · ไม่มีหีบ/รหัสลับ/เบาะแสซ้อน', () => {
        expect(level.npcs).toHaveLength(3);
        expect(level.story).toHaveLength(3);
        expect(level.quizzes).toHaveLength(3);
        for (const q of level.quizzes!) {
          expect(q.choices).toHaveLength(3);
          expect(q.choices.filter((c) => c.id === q.correctChoiceId)).toHaveLength(1);
          expect(new Set(q.choices.map((c) => c.label)).size).toBe(3);
        }
        expect(level.ending?.codePiece).toBeUndefined();
        expect(level.pinTask ?? level.routeAnalysis ?? level.clues ?? level.inspectPoints ?? level.siteAnalysis).toBeUndefined();
      });

      it('NPC พูดไม่เกิน 2 ประโยค ไม่ยาว · ปัญหา 1 บรรทัด แล้วถามเลย', () => {
        for (const npc of level.npcs) {
          for (const v of npc.dialogue) {
            const lines = v.nodes.filter((n) => 'text' in n) as Array<{ text: string }>;
            expect(lines.length).toBeLessThanOrEqual(1);
            for (const l of lines) {
              expect(l.text.length).toBeLessThanOrEqual(90);
              expect((l.text.match(/[.!?]/g) ?? []).length).toBeLessThanOrEqual(2);
            }
          }
        }
      });

      it('ตอบผิดลองใหม่ได้ ไม่เสียอะไร · ตอบถูกได้ +100 เหรียญ +10 ศรัทธา ครั้งเดียว', () => {
        const s = newSession(level);
        const p = store();
        s.wallet = p;
        const npc = level.npcs[0];
        const quiz = level.quizzes![0];
        const right = quiz.choices.findIndex((c) => c.id === quiz.correctChoiceId);
        const wrong = right === 0 ? 1 : 0;
        s.talkTo(npc);
        s.advanceDialogue(); // ปัญหา → คำถาม
        expect(s.dialogueView?.kind).toBe('quiz');
        s.answerQuiz(wrong);
        expect(p.rpg.coins).toBe(0);
        expect(p.rpg.faith).toBe(0);
        expect(s.flags.has(missionFlag(level.npcs[0].dialogue[0].nodes.length ? quiz.id.slice(2) : ''))).toBe(false);
        expect(s.dialogueView?.kind).toBe('quiz'); // ยังอยู่ที่คำถาม ลองใหม่ได้
        s.answerQuiz(right);
        expect(p.rpg.coins).toBe(100);
        expect(p.rpg.faith).toBe(10);
        expect(s.rewardEvents).toHaveLength(1);
        // ทำซ้ำไม่ได้เพิ่ม
        expect(p.earn(rewardId(level.id, quiz.id.slice(2)), 100, 10)).toBe(false);
        expect(p.rpg.coins).toBe(100);
      });

      it('เล่นจนจบด่าน: ได้ 300 เหรียญ + 30 ศรัทธา · ตอนจบเริ่มเอง · ฉากทุกฉากผ่าน', () => {
        const s = newSession(level);
        const p = store();
        s.wallet = p;
        solve(level, s);
        expect(p.rpg.coins).toBe(300);
        expect(p.rpg.faith).toBe(30);
        expect(s.currentStepOrder).toBe(4);
        expect(s.inDialogue || s.completed).toBe(true);
      });

      it('คุยซ้ำหลังช่วยแล้ว: NPC พูดขอบคุณ ไม่ถามซ้ำ ไม่ให้รางวัลซ้ำ', () => {
        const s = newSession(level);
        const p = store();
        s.wallet = p;
        solve(level, s);
        if (s.inDialogue) while (s.inDialogue) s.advanceDialogue();
        talk(s, level.npcs[0].id);
        expect(p.rpg.coins).toBe(300);
      });
    });
  }
});

describe('รางวัลทั้งเกม: รหัสรางวัลไม่ซ้ำข้ามด่าน (ทุกภารกิจได้ 100 เหรียญ + 10 ศรัทธา ครบ)', () => {
  it('เล่นด่าน 3–4 ด้วยบันทึกเดียวกัน: 6 ภารกิจ = 600 เหรียญ + 60 ศรัทธา', () => {
    const p = store();
    const ids = new Set<string>();
    for (const level of LEVELS) {
      const s = newSession(level);
      s.wallet = p;
      for (const q of level.quizzes!) for (const e of q.effects) if (e.type === 'reward') ids.add(e.id);
      solve(level, s);
    }
    expect(ids.size).toBe(6);
    expect(p.rpg.coins).toBe(600);
    expect(p.rpg.faith).toBe(60);
  });
});

describe('คำตอบมาจากแผนที่จริง (แก้แผนที่แล้วคำตอบเปลี่ยนตาม)', () => {
  const byId = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
  const correct = (l: LevelDefinition, q: string) => {
    const quiz = l.quizzes!.find((x) => x.id === q)!;
    return quiz.choices.find((c) => c.id === quiz.correctChoiceId)!.label;
  };

  it('จุดที่ถามว่า "สูงที่สุด/ต่ำที่สุด" ตรงกับแบบจำลองความสูง และห่างจากอันดับสอง ≥ 3 ม.', () => {
    const check = (levelId: string, quizId: string, ids: string[], which: 'max' | 'min', names: Record<string, string>) => {
      const l = byId[levelId];
      const e = new ElevationModel(l.map.elevation!);
      const hs = ids.map((id) => ({ id, h: e.meters(l.landmarks.find((x) => x.id === id)!.at) }));
      hs.sort((a, b) => (which === 'max' ? b.h - a.h : a.h - b.h));
      expect(Math.abs(hs[0].h - hs[1].h)).toBeGreaterThanOrEqual(3);
      expect(correct(l, quizId)).toBe(names[hs[0].id]);
    };
    const abc = { 'site-a': 'จุด A', 'site-b': 'จุด B', 'site-c': 'จุด C' };
    check('level-4', 'q-shelter', ['site-a', 'site-b', 'site-c'], 'max', abc);
    check('level-3', 'q-gather', ['camp', 'hall', 'bridge'], 'min', { camp: 'ค่ายสำรวจ', hall: 'ศาลาประชาคม', bridge: 'สะพานข้ามลำห้วย' });
  });

  it('คำถามอ้างถึงจุดที่มีป้ายบนแผนที่ตั้งแต่เริ่ม (knownWhen) และมีตัวเลขความสูงให้อ่าน', () => {
    for (const l of LEVELS) for (const lm of l.landmarks) expect(lm.knownWhen).toBeDefined();
    for (const id of ['level-3', 'level-4']) {
      const l = byId[id];
      expect(l.spotHeights!.length).toBeGreaterThanOrEqual(3);
    }
  });
});
