import { describe, expect, it } from 'vitest';
import { finaleRows } from '../src/content/finale';
import { khlongNamLaiLevel as L2 } from '../src/content/levels/khlongnamlai';
import { khlongLanPattanaLevel as L4 } from '../src/content/levels/khlonglanpattana';
import { finaleLevel as F } from '../src/content/levels/finale';
import { pongNamRonLevel as L3 } from '../src/content/levels/pongnamron';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { ALL_LEVELS, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import { CHAPTERS, FINALE_CHAPTER_ID } from '../src/content/story/chapters';
import { validateLevel } from '../src/content/validateLevel';
import {
  canPlayLevel,
  chapterStates,
  continueTarget,
  currentChapter,
  isCampaignComplete,
  missingCodes,
} from '../src/core/campaign/Campaign';
import { summarizeJourney } from '../src/core/campaign/JourneySummary';
import { PROGRESS_KEY, ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';
import type { GameSession, SessionSnapshot } from '../src/core/session/GameSession';
import { buildIntegratedBoard, explainIntegratedChoice, integratedHint } from '../src/core/site/integratedBoard';
import { explore, newSession, runDialogue, talk } from './helpers';

/* ---------------- ตัวช่วยบท 4 ---------------- */

const RP_STAND = { 1: { x: 21, y: 39 }, 2: { x: 50, y: 48 }, 3: { x: 71, y: 39 } } as const;
const SITE = { a: 0, b: 1, c: 2 } as const;
const SITE_AT = { a: { x: 24, y: 24 }, b: { x: 64, y: 24 }, c: { x: 60, y: 19 } } as const;
/* grid-n [ลบ, ถูก, บวก E] · grid-e [เป็น 0, ใช้ไม่ได้, ใช้คัดกรอง] · ประเภทสถานที่ [วัด, ศูนย์เรียนรู้, โรงเก็บ] */
const GRID_N_OK = 1;
const GRID_E_OK = 2;
const LEARNING_CENTER = 1;

function inspectAt(s: GameSession, level: typeof L4, id: string, at: { x: number; y: number }) {
  const p = level.inspectPoints!.find((x) => x.id === id)!;
  s.playerTile = { ...at };
  expect(s.inspectPointAt(s.playerTile)?.id, id).toBe(id);
  s.inspect(p);
}

function survey(s: GameSession, site: 'a' | 'b' | 'c') {
  explore(s, `site-${site}`, 5);
  inspectAt(s, L4, `survey-${site}`, SITE_AT[site]);
  runDialogue(s);
}

/** เล่นบท 4 ถึงต้นฉากที่กำหนด (การกระทำเดียวกับผู้เล่น) */
function play4(step: number): GameSession {
  const s = newSession(L4);
  if (step <= 1) return s;
  talk(s, 'teacher-nem', [1]);
  if (step <= 2) return s;
  for (const n of [1, 2, 3] as const) {
    inspectAt(s, L4, `rp-${n}-read`, RP_STAND[n]);
    runDialogue(s);
  }
  talk(s, 'surveyor-tonkla', [1]);
  if (step <= 3) return s;
  talk(s, 'water-keeper', [1]);
  if (step <= 4) return s;
  talk(s, 'record-keeper', [GRID_N_OK, GRID_E_OK]);
  if (step <= 5) return s;
  survey(s, 'a');
  s.chooseIntegratedSite(SITE.a); // ตั้งใจเลือกผิด 1 ครั้ง
  survey(s, 'b');
  s.chooseIntegratedSite(SITE.b);
  if (step <= 6) return s;
  s.playerTile = { x: 64, y: 25 };
  s.startIntegratedVerify('site-b');
  runDialogue(s);
  s.submitPin({ x: 64, y: 24 }, LEARNING_CENTER);
  if (step <= 7) return s;
  s.startEnding();
  runDialogue(s);
  return s;
}

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const resultOf = (levelId: string, extra: Partial<LevelResult> = {}): LevelResult => ({
  levelId,
  completedAt: 'x',
  distanceMeters: 1000,
  cluesFound: 1,
  cluesTotal: 1,
  mistakes: 1,
  elapsedMs: 60_000,
  skills: ['direction'],
  codePiece: ALL_LEVELS.find((l) => l.id === levelId)!.ending?.codePiece ?? null,
  ...extra,
});
const finish = (store: ProgressStore, levelId: string, extra: Partial<LevelResult> = {}) =>
  store.completeLevel(resultOf(levelId, extra), ALL_LEVELS.find((l) => l.id === levelId)!.unlocks);
const TAMBONS = ['sakngam', 'level-2', 'level-3', 'level-4'];

/* ================================================================= */

describe('บท 4 ฉาก 4: ตรวจพิกัด E/N จากบันทึก', () => {
  it('ลุงจำรัสให้บันทึกพิกัดในฉาก 4 เท่านั้น', () => {
    const s = play4(4);
    expect(s.currentStepOrder).toBe(4);
    const early = play4(3);
    talk(early, 'record-keeper');
    expect(early.evidence).not.toContain('grid-record');
  });

  it('ตัวเลือกคำนวณจาก GridSystem: N ของ RP-2 + 250 (ถูก) · ลบแทนบวก · บวกที่ E แทน', () => {
    const s = play4(4);
    const q = L4.quizzes!.find((x) => x.id === 'grid-n')!;
    expect(q.choices.map((c) => s.resolveText(c.label))).toEqual(['N 1,850', 'N 2,350', 'E 5,750 · N 2,100']);
    expect(s.resolveText(q.question)).toContain('E 5,500 · N 2,100');
  });

  it('คำนวณผิดได้คำใบ้ (ไม่นับผ่าน) แล้วตอบใหม่จนถูก → ฉาก 5', () => {
    const s = play4(4);
    talk(s, 'record-keeper', [0, 2, GRID_N_OK, 0, 1, GRID_E_OK]);
    expect(s.mistakes.quiz).toBe(4);
    expect(s.evidence).toContain('grid-record');
    expect(s.clues).toContain('clue-grid');
    expect(s.currentStepOrder).toBe(5);
    const hints = L4.quizzes!.find((x) => x.id === 'grid-n')!.choices.filter((c) => c.hint).map((c) => c.hint!);
    expect(hints.join()).toContain('N ต้อง "เพิ่ม"');
  });
});

describe('บท 4 ฉาก 5: กระดานวิเคราะห์หลักฐาน', () => {
  it('ยังเลือกไม่ได้ก่อนฉาก 5 และต้องสำรวจจุดที่เลือกเองก่อน (ไม่นับผิด)', () => {
    expect(play4(4).chooseIntegratedSite(SITE.b).blocked).toBe('not-available');
    const s = play4(5);
    const r = s.chooseIntegratedSite(SITE.b);
    expect(r).toMatchObject({ ok: false, blocked: 'missing-evidence', notSurveyed: ['site-b'] });
    expect(explainIntegratedChoice(s, r).lines.join()).toContain('ไม่นับเป็นการตอบผิด');
    expect(s.mistakes.compare).toBe(0);
  });

  it('กระดาน: หลักฐาน 3 ชนิด (คำนวณ) + ข้อมูลเฉพาะจุดที่สำรวจแล้ว · ไม่มีเครื่องหมายถูก/ผิดก่อนยืนยัน', () => {
    const s = play4(5);
    survey(s, 'a');
    survey(s, 'c');
    s.gridSelection = SITE.a;
    const v = buildIntegratedBoard(s)!;
    const ev = v.evidence.join('\n');
    expect(ev).toContain('ทางทิศตะวันออกเฉียงเหนือ · เส้นตรง ~310 ม. · ตามถนน ~430 ม.');
    expect(ev).toContain('ศาลา/อาคาร · สูงกว่า 160 ม.');
    expect(ev).toContain('(E 5,500 · N 2,100) + 250 = N 2,350 · E อ่านได้ 5,?40');
    expect(v.candidates[SITE.a].facts.join()).toContain('E 5,240 · N 2,350');
    expect(v.candidates[SITE.b].facts.join()).toContain('ยังไม่ได้สำรวจ');
    expect(v.candidates[SITE.c].facts.join()).toContain('สัญลักษณ์วัด');
    const all = [...v.evidence, ...v.candidates.flatMap((c) => c.facts), ...v.status, ...v.result].join('\n');
    expect(all).not.toMatch(/✓|✗|ถูกต้อง!|ยังไม่ถูก/);
  });

  it('เลือก A ผิด: อธิบายเฉพาะหลักฐานที่ขัด (ทิศ/ระยะ) + คำใบ้ ไม่เฉลย', () => {
    const s = play4(5);
    survey(s, 'a');
    const e = explainIntegratedChoice(s, s.chooseIntegratedSite(SITE.a));
    const text = e.lines.join('\n');
    expect(e.tone).toBe('wrong');
    expect(text).toContain('ขัดกับหลักฐาน 1 ชนิด');
    expect(text).toContain('อยู่ทางทิศตะวันตกเฉียงเหนือ แต่บันทึกบอกทางทิศตะวันออกเฉียงเหนือ');
    expect(text).toContain('ข้อที่ตรง: ภูมิประเทศและสัญลักษณ์แผนที่, พิกัดกริด E/N');
    expect(text).toContain('คำใบ้:');
    expect(text).not.toMatch(/จุด B|จุด C/);
    expect(s.mistakes.compare).toBe(1);
  });

  it('เลือก C ผิด: สัญลักษณ์ (วัด) และพิกัดไม่ตรง', () => {
    const s = play4(5);
    survey(s, 'c');
    const text = explainIntegratedChoice(s, s.chooseIntegratedSite(SITE.c)).lines.join('\n');
    expect(text).toContain('เป็นวัด แต่บันทึกใช้สัญลักษณ์ศาลา/อาคาร');
    expect(text).toContain('N 2,400 ไม่ตรงกับ N 2,350');
    expect(text).toContain('E 5,600 ไม่ตรงรูปแบบ 5,?40');
    expect(integratedHint(['terrain', 'grid'])).not.toMatch(/จุด [ABC]/);
  });

  it('เลือกถูก: สรุปเหตุผลครบ 3 ชนิด → ฉาก 6 · ประวัติและจำนวนครั้งผิดอ่านย้อนหลังได้', () => {
    const s = play4(6);
    expect(s.analysisSolved).toBe(true);
    expect(s.currentStepOrder).toBe(6);
    expect(s.mistakes.compare).toBe(1);
    expect(s.gridAttempts).toEqual([
      { landmarkId: 'site-a', ok: false },
      { landmarkId: 'site-b', ok: true },
    ]);
    const v = buildIntegratedBoard(s)!;
    expect(v.status.join()).toContain('ประวัติ: จุด A ✗ → จุด B ✓');
    const text = explainIntegratedChoice(s, s.lastIntegratedChoice!).lines.join('\n');
    expect(text).toContain('ถูกต้อง! จุด B ตรงกับหลักฐานครบทั้ง 3 ชนิด');
    expect(text).toContain('E 5,640 · N 2,350');
  });
});

describe('บท 4 ฉาก 6–7: ยืนยัน ปักหมุด รายงาน และรหัสชิ้นที่ 4', () => {
  it('เดินถึงอย่างเดียวปักไม่ผ่าน — ต้องกด E ตรวจยืนยัน (ได้บันทึกข้อมูลภูมิปัญญา) ก่อน', () => {
    const s = play4(6);
    explore(s, 'site-b', 5);
    s.playerTile = { x: 64, y: 25 };
    expect(s.submitPin({ x: 64, y: 24 }, LEARNING_CENTER)).toEqual({ ok: false, problems: ['evidence'] });
    expect(s.pinMissingEvidence).toEqual(['wisdom-record']);
    expect(s.integratedVerifyAt(s.playerTile)).toBe('site-b');
    s.startIntegratedVerify('site-b');
    const lines: string[] = [];
    for (let i = 0; i < 10 && s.inDialogue; i++) {
      const dv = s.dialogueView!;
      if (dv.kind === 'line') lines.push(dv.text);
      s.advanceDialogue();
    }
    const text = lines.join('\n');
    expect(text).toContain('เส้นตรง ~310 ม. · ตามถนน ~430 ม.');
    expect(text).toContain('สัญลักษณ์ศาลา/อาคาร · สูง 169 ม. · อยู่ทางต้นน้ำสะพานข้ามลำน้ำ');
    expect(text).toContain('ตรงนี้คือ E 5,640 · N 2,350');
    expect(text).toContain('ข้อมูลจำลอง');
    expect(s.evidence).toContain('wisdom-record');
  });

  it('ตรวจ: ยืนไกล · ตำแหน่งผิด · ประเภทผิด แล้วจึงผ่าน → ฉาก 7', () => {
    const s = play4(6);
    s.playerTile = { x: 64, y: 25 };
    s.startIntegratedVerify('site-b');
    runDialogue(s);
    explore(s, 'site-b', 5);
    s.playerTile = { x: 50, y: 44 };
    expect(s.submitPin({ x: 64, y: 24 }, LEARNING_CENTER).problems).toContain('far');
    explore(s, 'site-c', 5);
    s.playerTile = { x: 60, y: 20 };
    expect(s.submitPin({ x: 60, y: 19 }, LEARNING_CENTER).problems).toContain('location');
    s.playerTile = { x: 64, y: 25 };
    expect(s.submitPin({ x: 64, y: 24 }, 0).problems).toEqual(['wisdom']);
    expect(s.submitPin({ x: 64, y: 24 }, LEARNING_CENTER)).toEqual({ ok: true, problems: [] });
    expect(s.currentStepOrder).toBe(7);
  });

  it('ฉาก 7: ครูเนมสรุปความรู้ (ข้อความคำนวณ) → จบบท 4 → รหัสชิ้นที่ 4 จากข้อมูลเนื้อเรื่อง', () => {
    const s = play4(8);
    expect(s.completed).toBe(true);
    expect(s.mode).toBe('summary');
    const text = s.messages.map((m) => m.text).join('\n');
    expect(text).toContain('E 5,640 · N 2,350');
    expect(text).toContain('เส้นตรงราว 310 ม. แต่ตามถนนราว 430 ม.');
    expect(text).toContain('N 2,350');
    expect(L4.ending!.codePiece).toEqual({ index: 4, total: 4, value: 'ลาน' });
    expect(s.questStatus.get('main-lan')).toBe('completed');
    const store = new ProgressStore(new MemoryStorage(), L1.id);
    for (const id of ['sakngam', 'level-2', 'level-3']) finish(store, id);
    const sum = s.summary();
    store.completeLevel(
      { ...resultOf('level-4'), distanceMeters: sum.distanceMeters, mistakes: sum.mistakes, codePiece: L4.ending!.codePiece! },
      L4.unlocks,
    );
    expect(store.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ', 'พิกัด', 'ลาน']);
    expect(store.isUnlocked('finale')).toBe(true);
    expect(continueTarget(CHAPTERS, store.data)).toMatchObject({ kind: 'begin', chapter: { id: FINALE_CHAPTER_ID } });
  });

  it('บันทึกกลางฉาก 5 และฉาก 6 แล้วโหลดกลับ เล่นต่อจนจบได้ (บันทึกต้นแบบรุ่นก่อนยังโหลดได้)', () => {
    const a = play4(5);
    survey(a, 'a');
    a.chooseIntegratedSite(SITE.a);
    const b = newSession(L4);
    expect(b.restore(JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot)).toBe(true);
    expect(b.currentStepOrder).toBe(5);
    expect(b.mistakes.compare).toBe(1);
    expect(b.gridAttempts).toEqual([{ landmarkId: 'site-a', ok: false }]);
    survey(b, 'b');
    expect(b.chooseIntegratedSite(SITE.b).ok).toBe(true);
    const c = newSession(L4);
    expect(c.restore(JSON.parse(JSON.stringify(b.toSnapshot())))).toBe(true);
    expect(c.currentStepOrder).toBe(6);
    c.playerTile = { x: 64, y: 25 };
    c.startIntegratedVerify('site-b');
    runDialogue(c);
    explore(c, 'site-b', 5);
    expect(c.submitPin({ x: 64, y: 24 }, LEARNING_CENTER).ok).toBe(true);
    c.startEnding();
    expect(runDialogue(c)).toBe('mission-complete');
    // บันทึกจากต้นแบบรุ่นก่อน (ฉาก 4, contentVersion 1) ยังใช้ได้
    const proto = JSON.parse(JSON.stringify(play4(4).toSnapshot()));
    delete proto.gridAttempts;
    expect(newSession(L4).restore(proto)).toBe(true);
  });
});

/* ================================================================= */

const codes = { sakngam: 'ลาย', 'level-2': 'น้ำ', 'level-3': 'พิกัด', 'level-4': 'ลาน' };
const BOARD_STAND = [8, 15, 24, 31];

function finale(step: number): GameSession {
  const s = newSession(F);
  s.campaignCodes = { ...codes };
  if (step <= 1) return s;
  talk(s, 'teacher-nem');
  if (step <= 2) return s;
  // คำตอบที่ถูกของป้าย: board-1 ซม. (ตัวที่ 2) · board-2 จุดสูงสุด (A ตัวที่ 1) · board-3 (ตัวที่ 3) · board-4 (ตัวที่ 3)
  const answers = [1, 0, 2, 2];
  BOARD_STAND.forEach((x, i) => {
    inspectAt(s, F as typeof L4, `board-${i + 1}-read`, { x, y: 15 });
    runDialogue(s, [answers[i]]);
  });
  if (step <= 3) return s;
  // ตู้: ช่อง 1 น้ำ(3) · ช่อง 2 ลาน(2) · ช่อง 3 ลาย(1) · ช่อง 4 พิกัด(0)
  inspectAt(s, F as typeof L4, 'cabinet', { x: 20, y: 20 });
  runDialogue(s, [3, 2, 1, 0]);
  if (step <= 4) return s;
  talk(s, 'teacher-nem', [2]);
  return s;
}

describe('บทที่ 5: ปริศนาสุดท้าย', () => {
  it('เป็นฉากบทสรุปที่โรงเรียนบ้านสักงาม (ไม่ใช่ตำบลใหม่) และผ่าน validateLevel', () => {
    expect(F.id).toBe(FINALE_CHAPTER_ID);
    expect(F.tambon).toBe('โรงเรียนบ้านสักงาม');
    expect(LEVELS.some((l) => l.id === F.id)).toBe(false);
    expect(LEVEL_SEQUENCE.some((s) => s.id === F.id)).toBe(false);
    expect(ALL_LEVELS.at(-1)).toBe(F);
    expect(validateLevel(F)).toEqual([]);
    expect(F.ending!.codePiece).toBeUndefined();
  });

  it('ครูเนมแสดงรหัส 4 ชิ้นที่ผู้เล่นเก็บได้จริง (จากบันทึก ไม่ได้เขียนในเนื้อหา)', () => {
    const s = finale(1);
    s.campaignCodes = { ...codes, 'level-4': 'ทดสอบ' };
    talk(s, 'teacher-nem');
    const said = s.resolveText((F.npcs[0].dialogue[0].nodes[1] as { text: string }).text);
    expect(said).toContain('"ลาย" "น้ำ" "พิกัด" "ทดสอบ"');
    expect(s.currentStepOrder).toBe(2);
  });

  it('ป้ายจัดแสดงใช้หลักฐานจากบทก่อน (คำนวณจากข้อมูลด่าน) และตอบผิดได้คำอธิบาย', () => {
    const s = finale(2);
    inspectAt(s, F as typeof L4, 'board-2-read', { x: 15, y: 15 });
    runDialogue(s, [2, 0]); // ตอบจุด C (อยู่บนสุดของจอ) ก่อน
    expect(s.mistakes.quiz).toBe(1);
    const q2 = F.quizzes!.find((q) => q.id === 'board-2')!;
    expect(q2.question).toContain('จุด A สูง 145 ม. · จุด B สูง 130 ม. · จุด C สูง 115 ม.');
    expect(q2.choices.find((c) => c.id === 'site-c')!.hint).toContain('ตำแหน่งบนจอไม่ได้บอกความสูง');
    const q3 = F.quizzes!.find((q) => q.id === 'board-3')!;
    expect(q3.choices.find((c) => c.id === q3.correctChoiceId)!.label).toBe('E 4,660 · N 1,410');
    const q1 = F.quizzes!.find((q) => q.id === 'board-1')!;
    expect(q1.choices.find((c) => c.id === q1.correctChoiceId)!.label).toBe('6.1 ซม.');
    const q4 = F.quizzes!.find((q) => q.id === 'board-4')!;
    expect(q4.question).toContain('ระยะทางชี้ได้ 2 จุด · ภูมิประเทศชี้ได้ 2 จุด · พิกัดชี้ได้ 2 จุด');
  });

  it('ตู้แผนที่: ช่องเรียงตามทักษะ (ไม่ใช่ลำดับเดินทาง) ผู้เล่นต้องจับคู่รหัสเอง · ใส่ผิดได้คำอธิบาย', () => {
    const s = finale(3);
    expect(s.currentStepOrder).toBe(3);
    inspectAt(s, F as typeof L4, 'cabinet', { x: 20, y: 20 });
    runDialogue(s, [1, 3, 2, 1, 0]); // ช่อง 1 ใส่ "ลาย" ผิดก่อน
    expect(s.mistakes.quiz).toBe(1);
    expect(s.flags.has('cabinet-open')).toBe(true);
    expect(s.evidence).toContain('wisdom-map');
    const lockOrder = F.quizzes!.filter((q) => q.id.startsWith('lock-')).map((q) => q.correctChoiceId);
    expect(lockOrder).not.toEqual(TAMBONS); // เกมไม่ได้เรียงให้ตามลำดับการเดินทาง
    expect(new Set(lockOrder)).toEqual(new Set(TAMBONS));
    const wrongHint = F.quizzes!.find((q) => q.id === 'lock-1')!.choices.find((c) => c.id === 'sakngam')!.hint!;
    expect(wrongHint).toContain('ตำบลคลองน้ำไหล');
  });

  it('ข้ามขั้นไม่ได้: ตู้เปิดได้หลังติดรหัสครบ 4 ป้าย · ตอนจบเริ่มไม่ได้ก่อนตอบคำถามสรุป', () => {
    const s = finale(2);
    s.playerTile = { x: 20, y: 20 };
    expect(s.inspectPointAt(s.playerTile)).toBeUndefined();
    expect(s.startEnding()).toBe(false);
    const t = finale(4);
    expect(t.startEnding()).toBe(false);
    expect(t.completed).toBe(false);
  });

  it('คำถามสรุปความรู้ → ตอบผิดได้คำอธิบาย → ตอบถูกเข้าฉากจบเนื้อเรื่องทันที → จบบท 5', () => {
    const s = finale(4);
    talk(s, 'teacher-nem', [1, 2]); // ตอบ "ตำแหน่งบนจอ" ผิดก่อน
    expect(s.mistakes.quiz).toBe(1);
    expect(s.completed).toBe(true);
    expect(s.mode).toBe('summary');
    expect(s.messages.map((m) => m.text).join()).toContain('การเดินทางครั้งนี้สำเร็จแล้ว');
    expect(s.questStatus.get('main-finale')).toBe('completed');
    expect(F.quizzes!.find((q) => q.id === 'final-synthesis')!.choices[1].hint).toContain('แกน Y ของจอตรงข้ามกับค่า N');
  });

  it('บันทึกกลางบท 5 แล้วโหลดกลับ เล่นต่อได้ (ป้ายที่ทำแล้วไม่ต้องทำซ้ำ)', () => {
    const a = finale(2);
    inspectAt(a, F as typeof L4, 'board-1-read', { x: 8, y: 15 });
    runDialogue(a, [1]);
    const b = newSession(F);
    b.campaignCodes = { ...codes };
    expect(b.restore(JSON.parse(JSON.stringify(a.toSnapshot())))).toBe(true);
    expect(b.currentStepOrder).toBe(2);
    expect(b.flags.has('board-1')).toBe(true);
    b.playerTile = { x: 8, y: 15 };
    expect(b.inspectPointAt(b.playerTile)).toBeUndefined();
  });
});

describe('การเข้าบท 5 / การตรวจรหัส 4 ชิ้น / การจบเกม / การกันข้ามบท', () => {
  const finale5 = CHAPTERS.find((c) => c.id === FINALE_CHAPTER_ID)!;

  it('เข้าบท 5 ไม่ได้จนกว่าจบบท 1–4 ทั้งหมด', () => {
    const s = new ProgressStore(new MemoryStorage(), L1.id);
    for (const id of TAMBONS.slice(0, 3)) {
      finish(s, id);
      expect(canPlayLevel(CHAPTERS, s.data, FINALE_CHAPTER_ID)).toBe(false);
    }
    s.data.unlocked.push('finale'); // แก้ข้อมูลบันทึกเอง ก็ยังข้ามไม่ได้
    expect(canPlayLevel(CHAPTERS, s.data, FINALE_CHAPTER_ID)).toBe(false);
    finish(s, 'level-4');
    expect(canPlayLevel(CHAPTERS, s.data, FINALE_CHAPTER_ID)).toBe(true);
  });

  it('รหัสลับไม่ครบ 4 ชิ้น (ข้อมูลเสีย/แก้ไขเอง) → บท 5 ถูกกันไว้ และบอกว่าขาดกี่ชิ้น', () => {
    const s = new ProgressStore(new MemoryStorage(), L1.id);
    for (const id of TAMBONS) finish(s, id);
    delete s.data.codePieces['level-3'];
    s.data.completed['level-3'].codePiece = null;
    expect(missingCodes(finale5, s.data)).toEqual(['level-3']);
    expect(canPlayLevel(CHAPTERS, s.data, FINALE_CHAPTER_ID)).toBe(false);
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'blocked', missingCodes: ['level-3'] });
  });

  it('จบบท 5 = จบเกม: สำรวจครบทุกบท · เล่นซ้ำบทใดไม่ได้ · เล่นต่อ → สรุปการเดินทาง', () => {
    const s = new ProgressStore(new MemoryStorage(), L1.id);
    for (const id of TAMBONS) finish(s, id);
    expect(isCampaignComplete(CHAPTERS, s.data)).toBe(false);
    finish(s, 'finale', { codePiece: null });
    expect(isCampaignComplete(CHAPTERS, s.data)).toBe(true);
    expect(Object.values(chapterStates(CHAPTERS, s.data))).toEqual(['explored', 'explored', 'explored', 'explored', 'explored']);
    expect(continueTarget(CHAPTERS, s.data)).toEqual({ kind: 'complete' });
    for (const c of CHAPTERS) expect(canPlayLevel(CHAPTERS, s.data, c.levelId!), c.id).toBe(false);
    expect(currentChapter(CHAPTERS, s.data).id).toBe(FINALE_CHAPTER_ID);
  });

  it('สรุปผลการเรียนรู้ทั้งเกม: รวมเฉพาะค่าที่บันทึกไว้จริง', () => {
    const s = new ProgressStore(new MemoryStorage(), L1.id);
    finish(s, 'sakngam'); // บันทึกรุ่นเก่า: ไม่มีจำนวนหลักฐาน/ภารกิจ
    finish(s, 'level-2', { evidenceFound: 4, evidenceTotal: 6, quests: { main: { done: 1, total: 1 }, side: { done: 0, total: 1 } } });
    finish(s, 'level-3', { evidenceFound: 7, evidenceTotal: 7, quests: { main: { done: 1, total: 1 } }, skills: ['grid-reference'] });
    finish(s, 'level-4', { evidenceFound: 6, evidenceTotal: 6 });
    finish(s, 'finale', { codePiece: null, evidenceFound: 2, evidenceTotal: 2 });
    const sum = summarizeJourney(CHAPTERS.map((c) => c.levelId!), TAMBONS, s.data);
    expect(sum.completedCount).toBe(5);
    expect(sum.distanceMeters).toEqual({ value: 5000, from: 5, of: 5 });
    expect(sum.elapsedMs.value).toBe(300_000);
    expect(sum.mistakes.value).toBe(5);
    expect(sum.evidence).toEqual({ value: { found: 19, total: 21 }, from: 4, of: 5 }); // บท 1 ไม่มีข้อมูล → ไม่ประมาณ
    expect(sum.quests).toEqual({ value: { done: 2, total: 3 }, from: 2, of: 5 });
    expect(sum.skills).toEqual(['direction', 'grid-reference']);
    expect(sum.codes.map((c) => c?.value)).toEqual(['ลาย', 'น้ำ', 'พิกัด', 'ลาน']);
  });

  it('สรุปผลจากบันทึกที่ไม่มีข้อมูลหลักฐาน/ภารกิจเลย → แสดง "ไม่มีข้อมูล" (null) ไม่ใช่ 0', () => {
    const s = new ProgressStore(new MemoryStorage(), L1.id);
    finish(s, 'sakngam');
    const sum = summarizeJourney(CHAPTERS.map((c) => c.levelId!), TAMBONS, s.data);
    expect(sum.evidence).toBeNull();
    expect(sum.quests).toBeNull();
    expect(sum.codes.map((c) => c?.value ?? null)).toEqual(['ลาย', null, null, null]);
  });

  it('แผนที่ภูมิปัญญา 4 ตำบล: สถานที่ (ข้อมูลจำลอง) + รหัสจากข้อมูลตอนจบของแต่ละบท', () => {
    const rows = finaleRows();
    expect(rows.map((r) => r.code)).toEqual(['ลาย', 'น้ำ', 'พิกัด', 'ลาน']);
    expect(rows[0].site).toContain(L1.landmarks.find((l) => l.id === L1.pinTask!.targetId)!.name);
    for (const r of rows) expect(r.site).toContain('ข้อมูลจำลอง');
  });

  it('บันทึกเดิม (รุ่นก่อนที่ยังไม่มีบท 5) เปิดได้และคำนวณบทปัจจุบันถูก ไม่ผิดพลาด', () => {
    const storage = new MemoryStorage();
    const old = new ProgressStore(storage, L1.id);
    for (const id of ['sakngam', 'level-2', 'level-3']) finish(old, id);
    old.saveInProgress('level-4', newSession(L4).toSnapshot());
    const again = new MemoryStorage();
    again.setItem(PROGRESS_KEY, storage.getItem(PROGRESS_KEY)!);
    const s = new ProgressStore(again, L1.id);
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'resume', levelId: 'level-4' });
    expect(newSession(L4).restore(s.loadInProgress('level-4') as SessionSnapshot)).toBe(true);
  });
});

describe('ทุกด่านยังผ่าน validateLevel', () => {
  it('บท 1–5', () => {
    for (const L of [L1, L2, L3, L4, F]) expect(validateLevel(L), L.id).toEqual([]);
  });
});
