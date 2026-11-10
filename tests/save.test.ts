import { describe, expect, it } from 'vitest';
import { FogOfWar } from '../src/core/fog/FogOfWar';
import type { SessionSnapshot } from '../src/core/session/GameSession';
import { explore, newSession, runDialogue, talk } from './helpers';

describe('FogOfWar export/import', () => {
  it('บันทึกและโหลดช่องที่สำรวจแล้วได้ครบ', () => {
    const a = new FogOfWar(80, 60);
    a.reveal(10, 10, 5);
    a.reveal(70, 50, 3);
    const b = new FogOfWar(80, 60);
    expect(b.importBits(a.exportBits())).toBe(true);
    expect(b.exportBits()).toBe(a.exportBits());
    expect(b.exploredCount).toBe(a.exploredCount);
    expect(new FogOfWar(10, 10).importBits(a.exportBits())).toBe(false);
    expect(b.importBits('%%%')).toBe(false);
  });
});

describe('บันทึกการเล่นกลางด่าน (snapshot)', () => {
  const rightOf = (id: string, s = newSession()) => {
    const q = s.level.quizzes!.find((x) => x.id === id)!;
    return q.choices.findIndex((c) => c.id === q.correctChoiceId);
  };
  function midGame() {
    const s = newSession();
    // ผิด 1 ครั้งก่อนตอบถูก (ลองใหม่ได้ ไม่เสียอะไร)
    const right = rightOf('q-school', s);
    talk(s, 'teacher-nem', [right === 0 ? 1 : 0, right]);
    explore(s, 'sala');
    s.odometer.sample(0, 0);
    s.odometer.sample(160, 0); // 100 ม.
    s.elapsedMs = 90_000;
    s.playerTile = { x: 35, y: 46 };
    return s;
  }

  it('JSON → โหลดกลับได้สถานะเดิม และเล่นต่อจนจบด่านได้', () => {
    const a = midGame();
    const snap = JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot;
    const b = newSession();
    expect(b.restore(snap)).toBe(true);
    expect([...b.flags]).toEqual([...a.flags]);
    expect(b.mistakes).toEqual(a.mistakes);
    expect(b.summary().mistakes).toBe(1);
    expect(b.currentStepOrder).toBe(2);
    expect(Object.fromEntries(b.questStatus)).toEqual(Object.fromEntries(a.questStatus));
    expect(b.fog.exploredCount).toBe(a.fog.exploredCount);
    expect([...b.discoveredLandmarks].sort()).toEqual([...a.discoveredLandmarks].sort());
    expect(b.odometer.totalMeters).toBeCloseTo(100);
    expect(b.elapsedMs).toBe(90_000);
    expect(b.playerTile).toEqual({ x: 35, y: 46 });
    expect(b.drainToasts()).toEqual([]); // ไม่แจ้งเตือนซ้ำตอนโหลด

    // เล่นต่อ: ครูเนมที่ถามแล้วไม่ถามซ้ำ · เดินต่อจนจบด่าน (ถึงสำนักสงฆ์/กองขยะด้วยการเดินถึงเอง)
    talk(b, 'headman', [rightOf('q-west', b), rightOf('q-north', b)]);
    talk(b, 'jiao');
    expect(b.flags.has('go-wat')).toBe(true);
    expect(b.checkArrivals({ x: 28, y: 17 })).toBe(true);
    runDialogue(b, [rightOf('q-wat', b)]);
    expect(b.checkArrivals({ x: 28, y: 47 })).toBe(true);
    runDialogue(b);
    talk(b, 'jiao', [rightOf('q-adv1', b), rightOf('q-adv2', b)]);
    while (b.inDialogue) b.advanceDialogue();
    expect(b.completed || b.flags.has('sakngam-complete')).toBe(true);
  });

  it('ไม่โหลดข้อมูลของด่านอื่น หรือข้อมูลเสีย (session ไม่ถูกแก้)', () => {
    const snap = midGame().toSnapshot();
    const b = newSession();
    expect(b.restore({ ...snap, levelId: 'level-2' })).toBe(false);
    expect(b.restore({ ...snap, fog: 'broken' })).toBe(false);
    expect(b.restore({ ...snap, player: { x: 999, y: 0 } })).toBe(false);
    expect(b.flags.size).toBe(0);
    expect(b.currentStepOrder).toBe(1);
  });
});
