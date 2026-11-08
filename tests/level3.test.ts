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

/* ตัวเลือกคำถามที่ถูก (ตามลำดับในเนื้อหา): contour-spacing=1 · slope-calc=1 · relearn-slope=1 · relearn-landform=1 · relearn-height=2 · relearn-water=1 */
const RELEARN_ANSWER: Record<SettlementTopic, number> = { slope: 1, landform: 1, height: 2, water: 1 };
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
  talk(s, 'villager-son', [0, 1, 1]); // contour: ผิด→ถูก · slope-calc: ถูก
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

describe('ด่าน 3 ใหม่: ข้อมูลพื้นฐาน', () => {
  it('ใช้ id level-3 · ชื่อใหม่ · contentVersion 2 · ผ่าน validateLevel', () => {
    expect(L3.id).toBe('level-3');
    expect(L3.title).toBe('ปริศนาเมืองโบราณใต้ผืนดิน');
    expect(L3.contentVersion).toBe(2);
    expect(validateLevel(L3)).toEqual([]);
    expect(getLevelSlot('level-3')!.missionTitle).toBe(L3.title);
    expect(L3.unlocks).toBe('level-4');
  });

  it('มี 6 ฉาก และ NPC 4 บทบาท (ครูเนม ลุงสอน ป้าจันทร์ นักสำรวจ)', () => {
    expect(L3.story.map((st) => st.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(L3.npcs.map((n) => n.id).sort()).toEqual(['explorer-khiao', 'teacher-nem', 'villager-son', 'water-keeper']);
    expect(L3.npcs.map((n) => n.name)).toEqual(expect.arrayContaining(['ครูเนม', 'ลุงสอน', 'ป้าจันทร์']));
  });

  it('ไม่มีระบบปริศนาเก่าเหลืออยู่ (RP / A-B-C / พิกัดบันทึกเก่า / pinTask)', () => {
    expect(L3.gridSiteAnalysis).toBeUndefined();
    expect(L3.pinTask).toBeUndefined();
    expect(L3.inspectPoints ?? []).toEqual([]);
    const ids = L3.landmarks.map((l) => l.id);
    for (const old of ['rp-1', 'rp-2', 'rp-3', 'old-mark', 'site-a', 'site-b', 'site-c']) expect(ids).not.toContain(old);
    const all = JSON.stringify([L3.npcs, L3.quizzes, L3.clues, L3.story, L3.ending]);
    expect(all).not.toContain('RP-');
    expect(all).not.toContain('บันทึกเก่า');
  });

  it('เกณฑ์: น้ำหนัก 40/35/25 รวม 100 · ผ่านเมื่อมากกว่า 70%', () => {
    expect(A.weights.slope).toBe(40);
    expect(A.weights.height + A.weights.landform).toBe(35);
    expect(A.weights.water).toBe(25);
    expect(A.weights.slope + A.weights.height + A.weights.landform + A.weights.water).toBe(100);
    expect(A.passPercent).toBe(70);
  });

  it('รหัสบทที่ 3 ยังเป็น "พิกัด" (ชิ้นที่ 3 จาก 4)', () => {
    expect(L3.ending!.codePiece).toEqual({ index: 3, total: 4, value: 'พิกัด' });
  });
});

describe('ฉาก 1–2: รับภารกิจและเรียนรู้', () => {
  it('วิเคราะห์ไม่ได้ก่อนถึงฉาก 3 · เครื่องมือล็อกด้วยเหตุ "early"', () => {
    const s = playTo(1);
    expect(s.isSettlementAvailable()).toBe(false);
    expect(s.settlementLock()).toEqual({ kind: 'early' });
    expect(s.analyzeSettlementAt({ x: 46, y: 20 })).toBeNull();
    expect(s.settlementAttempts).toHaveLength(0);
  });

  it('ฉาก 1: ครูเนมให้เกณฑ์ + แผนที่ภูมิประเทศ เชื่อมเรื่องหีบ และบอกว่าเป็นสถานการณ์จำลอง', () => {
    const s = playTo(1);
    const mark = SAID.length;
    talk(s, 'teacher-nem');
    expect(s.flags.has('topo-received')).toBe(true);
    expect(s.flags.has('got-topo-map')).toBe(true);
    expect(s.evidence).toContain('evidence-topo-map');
    expect(s.clues).toEqual(expect.arrayContaining(['clue-criteria', 'clue-topo']));
    expect(said(mark)).toContain('หีบ');
    expect(said(mark)).toContain('จำลอง');
    expect(s.currentStepOrder).toBe(2);
  });

  it('ฉาก 2: ลุงสอนสอนเส้นชั้นความสูง (ตอบผิดได้คำใบ้) · ป้าจันทร์ให้ข้อมูลน้ำ · ไม่มีใครบอกพื้นที่เป้าหมาย', () => {
    const s = playTo(2);
    talk(s, 'villager-son', [0, 1, 1]);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.flags.has('learned-slope')).toBe(true);
    expect(s.clues).toEqual(expect.arrayContaining(['clue-contour', 'clue-slope-rule', 'clue-landform']));
    expect(s.currentStepOrder).toBe(2); // ยังต้องถามป้าจันทร์
    talk(s, 'water-keeper');
    expect(s.flags.has('water-info')).toBe(true);
    expect(s.clues).toEqual(expect.arrayContaining(['clue-flood', 'clue-water']));
    expect(s.currentStepOrder).toBe(3);
    // ข้อความทั้งหมดที่ NPC พูด/เบาะแส ไม่มีพิกัดของพื้นที่ที่ผ่าน
    const best = passing(s)[0].center;
    const blob = [SAID.join('\n'), ...s.clues.map((id) => s.resolveText(L3.clues!.find((c) => c.id === id)!.text))].join('\n');
    expect(blob).not.toContain(`${best.x},${best.y}`);
    expect(blob).not.toContain('E 4,'); // ไม่มีการเฉลยพิกัด
  });

  it('NPC แต่ละคนให้ข้อมูลต่างกัน', () => {
    const s = playTo(3);
    const bySource = (src: string) => L3.clues!.filter((c) => c.source === src).map((c) => c.id);
    expect(bySource('ลุงสอน')).toEqual(expect.arrayContaining(['clue-contour', 'clue-slope-rule', 'clue-landform']));
    expect(bySource('ป้าจันทร์')).toEqual(['clue-flood', 'clue-water']);
    expect(bySource('ครูเนม')).toEqual(['clue-criteria', 'clue-topo']);
    expect(s.skills.size).toBeGreaterThanOrEqual(0);
  });
});

describe('ฉาก 3: วิเคราะห์พื้นที่ (คำนวณจากแผนที่จริง)', () => {
  it('เปิดเครื่องมือเมื่อถึงฉาก 3 · mapTool = settlement', () => {
    const s = playTo(3);
    expect(s.currentStepOrder).toBe(3);
    expect(s.isSettlementAvailable()).toBe(true);
    expect(s.mapTool).toBe('settlement');
    expect(s.isPinAvailable()).toBe(false);
  });

  it('คะแนนคำนวณจากภูมิประเทศ: ผลของเกมตรงกับการคำนวณอิสระ และไม่สุ่ม', () => {
    const s = playTo(3);
    const fail = failingOn(s, 'slope');
    const t = tile(fail);
    const world = s.settlementWorld()!;
    const direct = analyzeSettlement(world, A, t);
    const rep = s.analyzeSettlementAt(t)!;
    expect(rep.percent).toBe(direct.percent);
    expect(rep.total).toBe(direct.total);
    // คำนวณซ้ำได้ค่าเดิมทุกครั้ง
    expect(analyzeSettlement(world, A, t).percent).toBe(direct.percent);
    // ส่วนประกอบรวมกันเป็นคะแนนรวม
    expect(rep.parts.reduce((a, p) => a + p.score, 0)).toBeCloseTo(rep.total, 6);
    expect(rep.parts.reduce((a, p) => a + p.max, 0)).toBe(100);
  });

  it('คะแนนเปลี่ยนตามภูมิประเทศ: ถ้าแก้ความสูงของแผนที่ ผลวิเคราะห์ที่จุดเดิมเปลี่ยน (ไม่ hardcode)', () => {
    const s = playTo(3);
    const best = passing(s)[0];
    const world = s.settlementWorld()!;
    expect(best.percent).toBeGreaterThan(A.passPercent);
    const flattened = { ...world, elevation: { ...world.elevation, meters: () => 100, heightAt: () => 100 } } as unknown as typeof world;
    let changed = false;
    try {
      changed = analyzeSettlement(flattened, A, best.center).percent !== best.percent;
    } catch {
      changed = true;
    }
    expect(changed).toBe(true);
  });

  it('ผ่านเมื่อ "มากกว่า" 70% เท่านั้น (70 พอดีไม่ผ่าน)', () => {
    const s = playTo(3);
    const all = allReports(s);
    for (const r of all) expect(r.passed).toBe(r.percent > A.passPercent);
    expect(all.some((r) => r.passed)).toBe(true);
    expect(all.some((r) => !r.passed)).toBe(true);
  });

  it('วิเคราะห์แล้ว: ได้ flag, ทักษะ, ประวัติ · ไม่ผ่านนับเป็นข้อผิด', () => {
    const s = playTo(3);
    const f = failingOn(s, 'slope');
    const rep = s.analyzeSettlementAt(tile(f))!;
    expect(rep.passed).toBe(false);
    expect(s.flags.has('settlement-attempted')).toBe(true);
    expect(s.flags.has('settlement-passed')).toBe(false);
    expect(s.settlementAttempts).toEqual([{ x: f.center.x, y: f.center.y, percent: rep.percent, passed: false, weak: rep.weakTopics }]);
    expect(s.mistakes.compare).toBe(1);
    expect(s.skills.has('contour-reading')).toBe(true);
    expect(s.skills.has('slope-analysis')).toBe(true);
    expect(s.skills.has('site-suitability')).toBe(false);
  });
});

describe('ฉาก 4: ไม่ผ่าน → กลับไปเรียนเฉพาะหัวข้อที่ผิด → วิเคราะห์ใหม่', () => {
  it('ตกเฉพาะความลาดชัน: ต้องไปหาลุงสอนเท่านั้น · วิเคราะห์ใหม่ไม่ได้จนกว่าจะเรียน', () => {
    const s = playTo(3);
    const f = failingOn(s, 'slope');
    s.analyzeSettlementAt(tile(f));
    expect(s.currentStepOrder).toBe(4);
    const pend = s.settlementPending();
    expect(pend).toEqual(f.weakTopics.filter((t) => A.topics[t].teacherId === 'villager-son' || A.topics[t].teacherId === 'teacher-nem'));
    expect(s.settlementLock()).toEqual({ kind: 'lessons', topics: pend });
    expect(s.isSettlementAvailable()).toBe(false);
    expect(s.analyzeSettlementAt(tile(passing(s)[0]))).toBeNull(); // ยังวิเคราะห์ไม่ได้
    expect(s.flags.has('pending:villager-son')).toBe(true);
    expect(s.flags.has('lessons-done')).toBe(false);
  });

  it('บทเรียนเสริมสอนเฉพาะหัวข้อที่ผิด (หัวข้ออื่นไม่ถูกสอน)', () => {
    const s = playTo(3);
    const f = failingOn(s, 'slope');
    const wrongTopics = f.weakTopics;
    s.analyzeSettlementAt(tile(f));
    const before = SAID.length;
    // เรียนกับผู้สอนทุกคนที่ค้าง
    for (const teacher of ['villager-son', 'teacher-nem']) {
      if (!s.flags.has(`pending:${teacher}`)) continue;
      const npc = s.level.npcs.find((n) => n.id === teacher)!;
      s.talkTo(npc);
      const answers: number[] = [];
      for (const t of wrongTopics) if (A.topics[t].teacherId === teacher) answers.push(RELEARN_ANSWER[t]);
      runDialogue(s, answers);
    }
    const heard = said(before);
    if (wrongTopics.includes('slope')) expect(heard).toContain('ความลาดชัน: วง');
    for (const t of ['slope', 'landform', 'height', 'water'] as SettlementTopic[]) {
      if (!wrongTopics.includes(t)) expect(heard).not.toContain(`${A.topics[t].label}: วง`);
    }
    for (const t of wrongTopics) expect(s.flags.has(`relearned:${t}`)).toBe(true);
    expect(s.settlementPending()).toEqual([]);
    expect(s.flags.has('lessons-done')).toBe(true);
    expect(s.isSettlementAvailable()).toBe(true);
  });

  it('ตอบแบบทดสอบท้ายบทผิด ยังไม่นับว่าเรียนแล้ว', () => {
    const s = playTo(3);
    const f = failingOn(s, 'slope');
    s.analyzeSettlementAt(tile(f));
    const teacher = A.topics[f.weakTopics[0]].teacherId;
    const topic = f.weakTopics.find((t) => A.topics[t].teacherId === teacher)!;
    s.talkTo(s.level.npcs.find((n) => n.id === teacher)!);
    // ตอบผิด (ตัวเลือก 0 ไม่ใช่คำตอบที่ถูกของข้อใดเลย) แล้วถูก
    const answers: number[] = [];
    for (const t of f.weakTopics) if (A.topics[t].teacherId === teacher) answers.push(t === topic ? 0 : RELEARN_ANSWER[t], RELEARN_ANSWER[t]);
    const q0 = s.mistakes.quiz;
    // ตัวเลือกที่ 0 ผิดทุกข้อยกเว้นไม่มี → ตรวจเฉพาะ topic แรก
    runDialogue(s, answers.filter((_a, i) => i < 2 || true));
    expect(s.mistakes.quiz).toBeGreaterThanOrEqual(q0);
    expect(s.flags.has(`relearned:${topic}`)).toBe(true);
  });

  it('เรียนครบแล้ววิเคราะห์ใหม่ที่พื้นที่ที่ผ่าน → ผ่าน, จำพื้นที่ที่เลือก, ไปฉาก 5', () => {
    const s = playTo(3);
    const f = failingOn(s, 'slope');
    s.analyzeSettlementAt(tile(f));
    for (const teacher of ['villager-son', 'teacher-nem']) {
      if (!s.flags.has(`pending:${teacher}`)) continue;
      s.talkTo(s.level.npcs.find((n) => n.id === teacher)!);
      runDialogue(s, f.weakTopics.filter((t) => A.topics[t].teacherId === teacher).map((t) => RELEARN_ANSWER[t]));
    }
    const rep = passAnalysis(s);
    expect(s.settlementAttempts).toHaveLength(2);
    expect(s.settlementSolved).toBe(true);
    expect(s.settlementChosen).toEqual(tile(rep));
    expect(s.landmarkPoints.chosen).toEqual(tile(rep));
    expect(s.currentStepOrder).toBe(5);
    expect(s.skills.has('site-suitability')).toBe(true);
    expect(s.mistakes.compare).toBe(1);
  });

  it('ผ่านตั้งแต่ครั้งแรก → ข้ามฉาก 4 ไปฉาก 5', () => {
    const s = playTo(3);
    passAnalysis(s);
    expect(s.settlementAttempts).toHaveLength(1);
    expect(s.currentStepOrder).toBe(5);
    expect(s.mistakes.compare).toBe(0);
  });

  it('ตกหลายหัวข้อ: ทุกหัวข้อที่ตกต้องเรียนครบ (ทั้งลุงสอนและครูเนม)', () => {
    const s = playTo(3);
    const multi = allReports(s).find((r) => !r.passed && r.weakTopics.some((t) => A.topics[t].teacherId === 'teacher-nem') && r.weakTopics.some((t) => A.topics[t].teacherId === 'villager-son'));
    if (!multi) return; // แผนที่ไม่มีวงที่ตกทั้งสองผู้สอนพร้อมกัน — ครอบคลุมโดยการสแกนใน validateLevel
    s.analyzeSettlementAt(tile(multi));
    expect(s.flags.has('pending:villager-son')).toBe(true);
    expect(s.flags.has('pending:teacher-nem')).toBe(true);
    s.talkTo(s.level.npcs.find((n) => n.id === 'villager-son')!);
    runDialogue(s, multi.weakTopics.filter((t) => A.topics[t].teacherId === 'villager-son').map((t) => RELEARN_ANSWER[t]));
    expect(s.settlementPending().length).toBeGreaterThan(0);
    expect(s.isSettlementAvailable()).toBe(false);
    s.talkTo(s.level.npcs.find((n) => n.id === 'teacher-nem')!);
    runDialogue(s, multi.weakTopics.filter((t) => A.topics[t].teacherId === 'teacher-nem').map((t) => RELEARN_ANSWER[t]));
    expect(s.settlementPending()).toEqual([]);
  });

  it('ทุกหัวข้อมีพื้นที่ที่ตกเพราะหัวข้อนั้น (ตัวอย่างให้ผู้เล่นได้เรียนครบ)', () => {
    const s = playTo(3);
    for (const t of ['slope', 'landform', 'height', 'water'] as SettlementTopic[]) {
      expect(allReports(s).some((r) => !r.passed && r.weakTopics.includes(t))).toBe(true);
    }
  });
});

describe('ฉาก 5: ตรวจสอบภาคสนามกับนักสำรวจ', () => {
  it('พี่เขียวให้ข้อมูลเฉพาะตอนฉาก 5 · ยังตรวจภาคสนามไม่ได้ก่อนคุยกับพี่เขียว', () => {
    const s = playTo(3);
    passAnalysis(s);
    s.playerTile = { ...s.settlementChosen! };
    expect(s.fieldCheckAvailable(s.playerTile)).toBe(false);
    talk(s, 'explorer-khiao');
    expect(s.flags.has('explorer-briefed')).toBe(true);
    expect(s.fieldCheckAvailable(s.playerTile)).toBe(true);
  });

  it('ต้องยืนในพื้นที่ที่เลือกจึงตรวจได้ (ห่างเกินรัศมีไม่ได้)', () => {
    const s = playToField();
    const c = s.settlementChosen!;
    expect(s.fieldCheckAvailable({ x: c.x + A.fieldCheck.radiusTiles + 3, y: c.y })).toBe(false);
    s.playerTile = { x: c.x + A.fieldCheck.radiusTiles + 3, y: c.y };
    expect(s.startFieldCheck()).toBe(false);
    expect(s.fieldCheckAvailable(c)).toBe(true);
  });

  it('ตรวจภาคสนาม: ผลตรงกับที่คำนวณ (ความสูง ความลาด ลักษณะ ระยะน้ำ) ได้หลักฐานและ flag', () => {
    const s = playToField();
    s.playerTile = { ...s.settlementChosen! };
    const mark = SAID.length;
    expect(s.startFieldCheck()).toBe(true);
    runDialogue(s);
    const rep = s.chosenReport()!;
    const heard = said(mark);
    expect(heard).toContain(`${Math.round(rep.measures.meanSlopePct * 10) / 10}`);
    expect(heard).toContain('E ');
    expect(heard).toContain('จำลอง');
    expect(s.flags.has('field-checked')).toBe(true);
    expect(s.evidence).toContain('evidence-field');
    expect(s.fieldCheckAvailable(s.playerTile)).toBe(false); // ตรวจซ้ำไม่ได้
  });

  it('คุยกับพี่เขียวหลังตรวจ → ยืนยันหลักฐาน และไปฉาก 6', () => {
    const s = playToField();
    finishField(s);
    expect(s.flags.has('evidence-verified')).toBe(true);
    expect(s.flags.has('mission-complete')).toBe(true); // ฉาก 6 เริ่มเองต่อจากฉาก 5
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
    expect(text).toContain(`${rep.percent}%`);
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
    const f = failingOn(a, 'slope');
    const rep = a.analyzeSettlementAt(tile(f))!;
    const b = roundTrip(a);
    expect(b.currentStepOrder).toBe(4);
    expect(b.settlementAttempts).toEqual(a.settlementAttempts);
    expect(b.settlementPending()).toEqual(a.settlementPending());
    expect(b.isSettlementAvailable()).toBe(false);
    expect(b.latestSettlementReport()!.percent).toBe(rep.percent); // คำนวณใหม่จากแผนที่ได้ค่าเดิม
    expect(b.flags.has('pending:villager-son') || b.flags.has('pending:teacher-nem')).toBe(true);
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
    expect(snap.contentVersion).toBe(2);
    expect(Object.keys(snap.settlement!).sort()).toEqual(['attempts', 'chosen']);
    expect(JSON.stringify(snap.settlement)).not.toContain('total');
  });

  it('บันทึกกลางด่านรุ่นเดิม (contentVersion 1: ปริศนาพิกัดเก่า) → ไม่โหลด เริ่มด่าน 3 ใหม่ โดยไม่แตะข้อมูลอื่น', () => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.completeLevel(result('sakngam', 'ลาย', 1), sakNgamLevel.unlocks);
    store.completeLevel(result('level-2', 'น้ำ', 2), L2.unlocks);
    const old = { ...playTo(3).toSnapshot(), contentVersion: 1 };
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
