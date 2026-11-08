import { describe, expect, it } from 'vitest';
import { khlongNamLaiLevel as L2 } from '../src/content/levels/khlongnamlai';
import { pongNamRonLevel as L3 } from '../src/content/levels/pongnamron';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { canEnterLevel, getLevelSlot, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import { validateLevel } from '../src/content/validateLevel';
import { describeLevel } from '../src/core/progress/LevelProgress';
import { ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';
import type { GameSession, SessionSnapshot } from '../src/core/session/GameSession';
import { analyzeSettlement, scanSettlement, type SettlementReport } from '../src/core/site/SettlementAnalysis';
import { newSession, runDialogue as runPlain, talk as talkPlain } from './helpers';
import type { SettlementTopic } from '../src/content/types';

/* ตัวเลือกที่ถูก (index ตามลำดับในเนื้อหา): contour-read=1 · relearn-height=1 · relearn-water=1 */
const RELEARN_ANSWER: Record<SettlementTopic, number> = { height: 1, water: 1 };
const TOPICS: SettlementTopic[] = ['height', 'water'];
const A = L3.settlementAnalysis!;

/** ข้อความทั้งหมดที่ผู้เล่นเห็นในบทสนทนา (ทุกบรรทัด ทุกคำถาม) — เก็บไว้ตรวจเนื้อหา */
const SAID: string[] = [];
function runDialogue(s: GameSession, answers: number[] = []): string {
  const queue = [...answers];
  let outcome = 'continue';
  for (let guard = 0; s.inDialogue && guard < 200; guard++) {
    const v = s.dialogueView!;
    if (v.kind === 'quiz') {
      SAID.push(v.question, ...v.choices);
      const a = queue.shift();
      if (a === undefined) throw new Error('quiz needs an answer');
      s.answerQuiz(a);
    } else {
      SAID.push(v.text);
      outcome = s.advanceDialogue();
    }
  }
  return outcome;
}
function talk(s: GameSession, npcId: string, answers: number[] = []): void {
  const npc = s.level.npcs.find((n) => n.id === npcId)!;
  s.talkTo(npc);
  runDialogue(s, answers);
}
void runPlain;
void talkPlain;
const said = (from = 0) => SAID.slice(from).join('\n');

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** ทุกจุดศูนย์กลางที่วิเคราะห์ได้ (คำนวณจากแผนที่จริง ไม่ได้เขียนตำแหน่งไว้ในเทสต์) */
function allReports(s: GameSession): SettlementReport[] {
  return scanSettlement(s.settlementWorld()!, A, 1);
}
const passing = (s: GameSession) => allReports(s).filter((r) => r.passed);
/** พื้นที่ที่ตก "เฉพาะหัวข้อนี้" (หัวข้ออื่นผ่าน) ถ้าไม่มีใช้ที่ตกหัวข้อนี้อย่างน้อย */
function failingOn(s: GameSession, topic: SettlementTopic, only = true): SettlementReport {
  const all = allReports(s).filter((r) => !r.passed && r.weakTopics.includes(topic));
  const exact = all.filter((r) => r.weakTopics.length === 1);
  const r = (only && exact.length ? exact : all)[0];
  if (!r) throw new Error(`no failing area for ${topic}`);
  return r;
}
const tile = (r: SettlementReport) => ({ x: r.center.x, y: r.center.y });

/** ฉาก 1–2: รับเอกสาร + เรียนกับลุงสอน (ตอบผิดก่อนถูก) + ป้าจันทร์ */
function playTo(step: number): GameSession {
  const s = newSession(L3);
  if (step <= 1) return s;
  talk(s, 'teacher-nem');
  if (step <= 2) return s;
  talk(s, 'villager-son', [0, 1]); // contour-read: ผิด → ถูก
  talk(s, 'water-keeper');
  return s; // ฉาก 3
}

/** ผ่านฉาก 3–4 ด้วยพื้นที่ผ่านเกณฑ์ที่คำนวณได้ */
function passAnalysis(s: GameSession): SettlementReport {
  const best = passing(s)[0];
  const rep = s.analyzeSettlementAt(tile(best))!;
  expect(rep.passed).toBe(true);
  return rep;
}

function playToField(): GameSession {
  const s = playTo(3);
  passAnalysis(s);
  talk(s, 'explorer-khiao');
  return s;
}

/** ตรวจภาคสนาม แล้วคุยกับพี่เขียวจนยืนยันหลักฐาน — ตอนจบ (ครูเนมสรุป) เริ่มเองต่อจากนั้นและเล่นจนจบ */
function finishField(s: GameSession) {
  s.playerTile = { ...s.settlementChosen! };
  expect(s.startFieldCheck()).toBe(true);
  runDialogue(s);
  talk(s, 'explorer-khiao');
}

/** เรียนเสริมกับครูเนมจนครบทุกเกณฑ์ที่ค้าง (ตอบถูกทุกข้อ) */
function relearnAll(s: GameSession) {
  const weak = TOPICS.filter((t) => s.settlementPending().includes(t));
  talk(s, 'teacher-nem', weak.map((t) => RELEARN_ANSWER[t]));
}

describe('ด่าน 3: ข้อมูลพื้นฐาน', () => {
  it('ใช้ id level-3 · contentVersion 3 · ผ่าน validateLevel', () => {
    expect(L3.id).toBe('level-3');
    expect(L3.title).toBe('ปริศนาเมืองโบราณใต้ผืนดิน');
    expect(L3.contentVersion).toBe(3);
    expect(validateLevel(L3)).toEqual([]);
    expect(getLevelSlot('level-3')!.missionTitle).toBe(L3.title);
    expect(L3.unlocks).toBe('level-4');
  });

  it('6 ฉาก · NPC เดิม 4 คน · ไม่มีภารกิจรอง', () => {
    expect(L3.story.map((st) => st.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(L3.npcs.map((n) => n.id).sort()).toEqual(['explorer-khiao', 'teacher-nem', 'villager-son', 'water-keeper']);
    expect(L3.quests!.filter((q) => q.kind !== 'main')).toEqual([]);
  });

  it('เกณฑ์มี 2 ข้อเท่านั้น: ระดับความสูง 50 + ระยะจากแหล่งน้ำ 50 · ผ่านเมื่อมากกว่า 70 · ไม่มีความลาดชัน', () => {
    expect(Object.keys(A.topics).sort()).toEqual(['height', 'water']);
    expect(A.height.max).toBe(50);
    expect(A.water.max).toBe(50);
    expect(A.passPercent).toBe(70);
    const content = JSON.stringify([A, L3.npcs, L3.quizzes, L3.clues, L3.story, L3.ending]);
    expect(content).not.toMatch(/ลาดชัน|slope|landform|ลักษณะพื้นที่/);
    // ทุกเกณฑ์สอนเสริมโดยครูเนม
    expect(Object.values(A.topics).every((t) => t.teacherId === 'teacher-nem')).toBe(true);
  });

  it('ข้อความทั้งหมดแทนค่าตัวแปรได้ครบ (ไม่มี {{…}} ค้าง)', () => {
    const s = playTo(3);
    const texts = [
      ...L3.npcs.flatMap((n) => n.dialogue.flatMap((v) => v.nodes.flatMap((nd) => ('text' in nd ? [nd.text] : [])))),
      ...L3.quizzes!.flatMap((q) => [q.question, ...q.choices.map((c) => c.label), ...q.choices.map((c) => c.hint ?? ''), q.correctFeedback ?? '', q.fallbackHint ?? '']),
      ...L3.clues!.map((c) => c.text),
      ...L3.story.flatMap((st) => (st.micro ?? []).flatMap((m) => [m.goal, ...m.steps, m.result, m.think ?? ''])),
    ];
    s.analyzeSettlementAt(tile(passing(s)[0]));
    for (const t of texts) expect(s.resolveText(t)).not.toMatch(/\{\{(cfg|site|try):/);
  });

  it('รหัสบทที่ 3 ยังเป็น "พิกัด"', () => {
    expect(L3.ending!.codePiece).toEqual({ index: 3, total: 4, value: 'พิกัด' });
  });
});

describe('ฉาก 1–2: รับภารกิจและเรียนรู้', () => {
  it('ก่อนฉาก 3 เลือกพื้นที่ไม่ได้', () => {
    const s = playTo(1);
    expect(s.isSettlementAvailable()).toBe(false);
    expect(s.settlementLock()).toEqual({ kind: 'early' });
    expect(s.analyzeSettlementAt({ x: 46, y: 20 })).toBeNull();
  });

  it('ฉาก 1: ครูเนมให้เกณฑ์ 2 ข้อ + แผนที่ · เชื่อมเรื่องหีบ · บอกว่าเป็นสถานการณ์จำลอง', () => {
    const s = playTo(1);
    const mark = SAID.length;
    talk(s, 'teacher-nem');
    expect(s.flags.has('got-topo-map')).toBe(true);
    expect(s.evidence).toContain('evidence-topo-map');
    expect(s.clues).toEqual(expect.arrayContaining(['clue-criteria', 'clue-topo']));
    expect(said(mark)).toContain('คำพิทักษ์');
    expect(said(mark)).toContain('จำลอง');
    expect(said(mark)).toContain('ระดับความสูง 50 + ระยะจากแหล่งน้ำ 50');
    expect(s.currentStepOrder).toBe(2);
  });

  it('ฉาก 2: ลุงสอนสอนอ่านระดับความสูง (ตอบผิดได้คำใบ้) · ป้าจันทร์ให้ช่วงที่เหมาะสม', () => {
    const s = playTo(2);
    talk(s, 'villager-son', [0, 1]);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.flags.has('learned-contour')).toBe(true);
    expect(s.currentStepOrder).toBe(2);
    const mark = SAID.length;
    talk(s, 'water-keeper');
    expect(s.clues).toEqual(expect.arrayContaining(['clue-flood', 'clue-water']));
    expect(said(mark)).toContain('6 ม. ขึ้นไป');
    expect(said(mark)).toContain('70 ม. ขึ้นไป');
    expect(s.currentStepOrder).toBe(3);
  });
});

describe('ฉาก 3: เลือกพื้นที่และวิเคราะห์', () => {
  it('เครื่องมือเลือกพื้นที่เปิดเมื่อถึงฉาก 3', () => {
    const s = playTo(3);
    expect(s.isSettlementAvailable()).toBe(true);
    expect(s.mapTool).toBe('settlement');
  });

  it('ตำแหน่งที่เลือกใกล้ขอบ ถูกเลื่อนเข้าเขตสำรวจ (วงอยู่ในแผนที่ทั้งวง)', () => {
    const s = playTo(3);
    expect(s.clampSettlementTile({ x: 0, y: 59 })).toEqual({ x: A.radiusTiles, y: 59 - A.radiusTiles });
    const r = s.analyzeSettlementAt({ x: 0, y: 59 })!;
    expect(r.center).toEqual({ x: A.radiusTiles, y: 59 - A.radiusTiles });
  });

  it('คะแนนในเกมเท่ากับการคำนวณอิสระจากแผนที่ (ระดับความสูง + ระยะน้ำ)', () => {
    const s = playTo(3);
    const f = failingOn(s, 'height');
    const direct = analyzeSettlement(s.settlementWorld()!, A, tile(f));
    const rep = s.analyzeSettlementAt(tile(f))!;
    expect(rep).toEqual(direct);
    expect(rep.total).toBe(rep.parts[0].score + rep.parts[1].score);
  });

  it('ไม่ผ่าน: ได้ flag · นับข้อผิด · จดเกณฑ์ที่พลาด · ผ่าน = มากกว่า 70 เท่านั้น', () => {
    const s = playTo(3);
    const all = allReports(s);
    for (const r of all) expect(r.passed).toBe(r.total > 70);
    const f = failingOn(s, 'water');
    const rep = s.analyzeSettlementAt(tile(f))!;
    expect(rep.passed).toBe(false);
    expect(s.flags.has('settlement-attempted')).toBe(true);
    expect(s.flags.has('weak:water')).toBe(true);
    expect(s.mistakes.compare).toBe(1);
    expect(s.settlementAttempts[0]).toEqual({ x: f.center.x, y: f.center.y, percent: rep.percent, passed: false, weak: rep.weakTopics });
  });

  it('70 พอดีบนแผนที่จริง → ไม่ผ่าน', () => {
    const s = playTo(3);
    const seventy = allReports(s).find((r) => r.total === 70)!;
    expect(seventy).toBeTruthy();
    expect(s.analyzeSettlementAt(tile(seventy))!.passed).toBe(false);
  });
});

describe('ฉาก 4: ไม่ผ่าน → กลับไปพบครูเนม → เลือกใหม่', () => {
  it('ไม่ผ่าน → เลือกใหม่ไม่ได้จนกว่าจะคุยกับครูเนม · ลูกศรนำทางไปครูเนม', () => {
    const s = playTo(3);
    s.analyzeSettlementAt(tile(failingOn(s, 'height')));
    expect(s.currentStepOrder).toBe(4);
    expect(s.settlementLock()).toEqual({ kind: 'lessons', topics: s.settlementPending() });
    expect(s.isSettlementAvailable()).toBe(false);
    expect(s.analyzeSettlementAt(tile(passing(s)[0]))).toBeNull();
    expect(s.flags.has('pending:teacher-nem')).toBe(true);
  });

  it('ครูเนมอธิบายเฉพาะเกณฑ์ที่พลาด (ตกเฉพาะระดับความสูง → ไม่สอนเรื่องระยะน้ำ)', () => {
    const s = playTo(3);
    const f = failingOn(s, 'height');
    expect(f.weakTopics).toEqual(['height']);
    s.analyzeSettlementAt(tile(f));
    const mark = SAID.length;
    relearnAll(s);
    expect(said(mark)).toContain('ระดับความสูง: วงของเธอ');
    expect(said(mark)).not.toContain('ระยะจากแหล่งน้ำ: วงของเธอ');
    expect(s.flags.has('relearned:height')).toBe(true);
    expect(s.flags.has('lessons-done')).toBe(true);
    expect(s.isSettlementAvailable()).toBe(true);
  });

  it('ตอบคำถามทบทวนผิดก่อน → ได้คำใบ้ แล้วตอบถูกจึงนับว่าทบทวนแล้ว', () => {
    const s = playTo(3);
    s.analyzeSettlementAt(tile(failingOn(s, 'water')));
    const q = s.mistakes.quiz;
    talk(s, 'teacher-nem', [0, RELEARN_ANSWER.water]);
    expect(s.mistakes.quiz).toBe(q + 1);
    expect(s.flags.has('relearned:water')).toBe(true);
  });

  it('ไม่ลบเบาะแส/ความคืบหน้าเดิมเมื่อไม่ผ่าน', () => {
    const s = playTo(3);
    const clues = [...s.clues];
    const evidence = [...s.evidence];
    s.analyzeSettlementAt(tile(failingOn(s, 'height')));
    expect(s.clues).toEqual(expect.arrayContaining(clues));
    expect(s.evidence).toEqual(expect.arrayContaining(evidence));
    expect(s.flags.has('learned-contour')).toBe(true);
  });

  it('เลือกพื้นที่ใหม่หลังทบทวน → ผ่าน → บันทึกพื้นที่ที่เลือก → ปลดล็อกฉากออกสำรวจ (ยังไม่ประกาศว่าพบเมือง)', () => {
    const s = playTo(3);
    s.analyzeSettlementAt(tile(failingOn(s, 'height')));
    relearnAll(s);
    const rep = passAnalysis(s);
    expect(s.settlementAttempts).toHaveLength(2);
    expect(s.settlementChosen).toEqual(tile(rep));
    expect(s.currentStepOrder).toBe(5);
    expect(s.flags.has('evidence-verified')).toBe(false);
    expect(s.evidence).not.toContain('evidence-field');
  });

  it('ผ่านตั้งแต่ครั้งแรก → ข้ามฉาก 4', () => {
    const s = playTo(3);
    passAnalysis(s);
    expect(s.currentStepOrder).toBe(5);
    expect(s.mistakes.compare).toBe(0);
  });
});

describe('ฉาก 5: ออกสำรวจ', () => {
  it('ตรวจได้เมื่อคุยกับพี่เขียวแล้ว และยืนอยู่ในพื้นที่ที่เลือกเท่านั้น', () => {
    const s = playTo(3);
    passAnalysis(s);
    const c = s.settlementChosen!;
    expect(s.fieldCheckAvailable(c)).toBe(false);
    talk(s, 'explorer-khiao');
    expect(s.fieldCheckAvailable(c)).toBe(true);
    expect(s.fieldCheckAvailable({ x: c.x + A.fieldCheck.radiusTiles + 3, y: c.y })).toBe(false);
  });

  it('ตรวจสอบ → ค่าที่วัดจริง (ระดับความสูง · ระยะน้ำ) + หลักฐานจำลอง', () => {
    const s = playToField();
    s.playerTile = { ...s.settlementChosen! };
    const mark = SAID.length;
    expect(s.startFieldCheck()).toBe(true);
    runDialogue(s);
    const rep = s.chosenReport()!;
    expect(said(mark)).toContain(`สูงกว่าลำน้ำ ${rep.measures.heightAboveWater} ม.`);
    expect(said(mark)).toContain(`~${rep.measures.waterDistanceMeters} ม.`);
    expect(said(mark)).toContain('จำลอง');
    expect(s.evidence).toContain('evidence-field');
    expect(s.flags.has('field-checked')).toBe(true);
    expect(s.fieldCheckAvailable(s.playerTile)).toBe(false);
  });

  it('พบหลักฐานครบ → พี่เขียวยืนยัน → ฉาก 6 ครูเนมสรุปและจบบท', () => {
    const s = playToField();
    finishField(s);
    expect(s.flags.has('evidence-verified')).toBe(true);
    expect(s.flags.has('mission-complete')).toBe(true);
    expect(s.currentStepOrder).toBe(7);
  });
});

describe('ฉาก 6: รายงาน รหัส "พิกัด" และปลดล็อกบท 4', () => {
  it('ครูเนมสรุปผ่านสมุดภาคสนาม ใช้ข้อมูลจริงของพื้นที่ที่เลือก และย้ำว่าเป็นความเหมาะสมจำลอง', () => {
    const s = playToField();
    finishField(s);
    expect(s.flags.has('mission-complete')).toBe(true);
    const text = s.messages.map((m) => m.text).join('\n');
    const rep = s.chosenReport()!;
    expect(text).toContain(`${rep.total}/100`);
    expect(text).toContain('ไม่ใช่ความน่าจะเป็นที่จะพบเมืองโบราณจริง');
    expect(text).toContain('"พิกัด"');
    expect(s.messages.every((m) => m.speaker.includes('สมุดภาคสนาม'))).toBe(true);
    expect(s.mode).toBe('summary');
    expect(s.currentStepOrder).toBe(7);
    expect(s.questStatus.get('main-pong')).toBe('completed');
  });

  it('ภารกิจหลักยังไม่สำเร็จก่อนจบ', () => {
    expect(playToField().questStatus.get('main-pong')).toBe('active');
  });

  it('จบด่าน 3 → ProgressStore: รหัส "พิกัด" · ปลดล็อก level-4 · บันทึกกลางด่านถูกล้าง · บทอื่นไม่กระทบ', () => {
    const s = playToField();
    finishField(s);
    const sum = s.summary();
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.completeLevel(result('sakngam', 'ลาย', 1), sakNgamLevel.unlocks);
    store.completeLevel(result('level-2', 'น้ำ', 2), L2.unlocks);
    store.saveInProgress('level-3', playTo(3).toSnapshot());
    store.completeLevel(
      {
        levelId: 'level-3',
        completedAt: 'x',
        distanceMeters: sum.distanceMeters,
        cluesFound: sum.cluesFound,
        cluesTotal: sum.cluesTotal,
        mistakes: sum.mistakes,
        elapsedMs: sum.elapsedMs,
        skills: sum.skills,
        evidenceFound: s.evidence.length,
        evidenceTotal: L3.evidence!.length,
        codePiece: L3.ending!.codePiece!,
      },
      L3.unlocks,
    );
    expect(store.isCompleted('level-3')).toBe(true);
    expect(store.loadInProgress('level-3')).toBeFalsy();
    expect(store.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ', 'พิกัด']);
    expect(store.isUnlocked('level-4')).toBe(true);
    expect(canEnterLevel('level-4', store.data)).toBe(true);
    const cards = LEVEL_SEQUENCE.map((slot, i) => describeLevel(slot, store.data, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null));
    expect(cards.map((c) => c.state)).toEqual(['completed', 'completed', 'completed', 'unlocked']);
  });
});

describe('บันทึก/โหลด และการย้ายบันทึกรุ่นเก่า', () => {
  const roundTrip = (a: GameSession) => {
    const b = newSession(L3);
    expect(b.restore(JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot)).toBe(true);
    return b;
  };

  it('กลางฉาก 4 (ตกแล้ว ยังไม่เรียน): ประวัติ ธง และบทเรียนค้างยังอยู่', () => {
    const a = playTo(3);
    const f = failingOn(a, 'height');
    const rep = a.analyzeSettlementAt(tile(f))!;
    const b = roundTrip(a);
    expect(b.currentStepOrder).toBe(4);
    expect(b.settlementAttempts).toEqual(a.settlementAttempts);
    expect(b.settlementPending()).toEqual(a.settlementPending());
    expect(b.isSettlementAvailable()).toBe(false);
    expect(b.latestSettlementReport()!.percent).toBe(rep.percent); // คำนวณใหม่จากแผนที่ได้ค่าเดิม
    expect(b.flags.has('pending:teacher-nem')).toBe(true);
  });

  it('กลางฉาก 5: พื้นที่ที่เลือกกลับมาครบ · ตรวจภาคสนามต่อได้ · จบด่านได้', () => {
    const a = playToField();
    const b = roundTrip(a);
    expect(b.currentStepOrder).toBe(5);
    expect(b.settlementChosen).toEqual(a.settlementChosen);
    expect(b.chosenReport()!.percent).toBe(a.chosenReport()!.percent);
    finishField(b);
    const c = roundTrip(b);
    expect(c.flags.has('evidence-verified')).toBe(true);
    expect(c.flags.has('mission-complete')).toBe(true);
    expect(c.currentStepOrder).toBe(7);
  });

  it('snapshot เก็บเฉพาะประวัติการเลือก ไม่เก็บคะแนนที่คำนวณได้', () => {
    const a = playToField();
    const snap = a.toSnapshot() as SessionSnapshot & { settlement?: { attempts: unknown[]; chosen: unknown } };
    expect(snap.contentVersion).toBe(3);
    expect(Object.keys(snap.settlement!).sort()).toEqual(['attempts', 'chosen']);
    expect(JSON.stringify(snap.settlement)).not.toContain('total');
  });

  it.each([1, 2])('บันทึกกลางบทรุ่นเดิม (contentVersion %i) → ไม่โหลด เริ่มบท 3 ใหม่ โดยไม่แตะข้อมูลอื่น', (ver) => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.completeLevel(result('sakngam', 'ลาย', 1), sakNgamLevel.unlocks);
    store.completeLevel(result('level-2', 'น้ำ', 2), L2.unlocks);
    const old = { ...playTo(3).toSnapshot(), contentVersion: ver };
    store.saveInProgress('level-3', old);
    const s = newSession(L3);
    expect(s.restore(store.loadInProgress('level-3') as SessionSnapshot)).toBe(false);
    expect(s.currentStepOrder).toBe(1);
    expect(s.settlementAttempts).toEqual([]);
    // บท 1–2 · รหัสที่ได้ · การปลดล็อก ไม่ถูกแตะ
    expect(store.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ']);
    expect(store.isCompleted('sakngam')).toBe(true);
    expect(store.isCompleted('level-2')).toBe(true);
    expect(store.isUnlocked('level-3')).toBe(true);
  });

  it('บันทึกด่าน 1 และ 2 ยังโหลดได้ครบหลังบันทึกด่าน 3 · snapshot ข้ามด่านโหลดไม่ได้', () => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    const l1 = newSession(sakNgamLevel);
    talk(l1, 'teacher-nem');
    store.saveInProgress('sakngam', l1.toSnapshot());
    const l2 = newSession(L2);
    talk(l2, 'teacher-nem');
    store.saveInProgress('level-2', l2.toSnapshot());
    store.saveInProgress('level-3', playTo(3).toSnapshot());
    expect(newSession(sakNgamLevel).restore(store.loadInProgress('sakngam') as SessionSnapshot)).toBe(true);
    expect(newSession(L2).restore(store.loadInProgress('level-2') as SessionSnapshot)).toBe(true);
    expect(newSession(L3).restore(store.loadInProgress('level-2') as SessionSnapshot)).toBe(false);
  });

  it('ด่าน 3 ปลดล็อกเมื่อจบด่าน 2 เท่านั้น', () => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    expect(canEnterLevel('level-3', store.data)).toBe(false);
    store.completeLevel(result('sakngam', 'ลาย', 1), sakNgamLevel.unlocks);
    expect(canEnterLevel('level-3', store.data)).toBe(false);
    store.completeLevel(result('level-2', 'น้ำ', 2), L2.unlocks);
    expect(canEnterLevel('level-3', store.data)).toBe(true);
  });
});

function result(levelId: string, value: string, index: number): LevelResult {
  return {
    levelId,
    completedAt: 'x',
    distanceMeters: 1,
    cluesFound: 1,
    cluesTotal: 1,
    mistakes: 0,
    elapsedMs: 1,
    skills: [],
    codePiece: { index, total: 4, value },
  };
}
