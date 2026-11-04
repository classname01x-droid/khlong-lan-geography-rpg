import { describe, expect, it } from 'vitest';
import { khlongNamLaiLevel as L2 } from '../src/content/levels/khlongnamlai';
import { STREAM_POINTS } from '../src/content/levels/khlongnamlai/map';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { canEnterLevel, getLevelSlot, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import type { LevelDefinition } from '../src/content/types';
import { validateLevel } from '../src/content/validateLevel';
import { describeLevel } from '../src/core/progress/LevelProgress';
import { ProgressStore, type StorageLike } from '../src/core/progress/ProgressStore';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import type { GameSession, SessionSnapshot } from '../src/core/session/GameSession';
import { ElevationModel } from '../src/core/world/Elevation';
import { buildWorld } from '../src/core/world/MapBuilder';
import { analyzeWaterway } from '../src/core/world/Waterway';
import { explore, newSession, runDialogue, talk } from './helpers';

const FLOW_NORTH = 1; // ตัวเลือก: 0 = C→B→A (ใต้), 1 = A→B→C (เหนือ), 2 = ตะวันออก
const SPRING = 0; // ประเภทสถานที่ตอนปักหมุด: 0 ตาน้ำ, 1 ฝาย, 2 หนองน้ำ
const SITE_A = { x: 22, y: 52 };

function inspect(s: GameSession, id: string, standAt?: { x: number; y: number }) {
  const p = L2.inspectPoints!.find((x) => x.id === id)!;
  if (standAt) s.playerTile = { ...standAt };
  expect(s.inspectPointAt(s.playerTile)?.id ?? s.inspectPointAt(p.at)?.id).toBe(id);
  s.inspect(p);
  runDialogue(s);
}

/** เล่นถึงต้นฉากที่กำหนด (ใช้การกระทำเดียวกับที่ผู้เล่นทำ) */
function playTo(step: number): GameSession {
  const s = newSession(L2);
  if (step <= 1) return s;
  talk(s, 'teacher-nem');
  s.cycleSheet(); // ดูฉบับ A
  s.cycleSheet(); // ดูฉบับ B
  if (step <= 2) return s;
  talk(s, 'villager-hom');
  talk(s, 'farmer-phet');
  explore(s, 'bridge');
  explore(s, 'site-b');
  if (step <= 3) return s;
  talk(s, 'water-keeper', [FLOW_NORTH]);
  if (step <= 4) return s;
  explore(s, 'three-stones');
  explore(s, 'site-c', 4);
  s.chooseSheet(0);
  if (step <= 5) return s;
  explore(s, 'site-a', 4);
  inspect(s, 'survey-a', { x: 22, y: 55 });
  s.submitPin(SITE_A, SPRING);
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

describe('ด่าน 2: ข้อมูลพื้นฐาน', () => {
  it('ใช้ id level-2 เดิม, ScaleSystem เดิม และผ่าน validateLevel', () => {
    expect(L2.id).toBe('level-2');
    expect(getLevelSlot('level-2')?.tambon).toBe('ตำบลคลองน้ำไหล');
    expect(newSession(L2).scale).toBe(defaultScale);
    expect(validateLevel(L2)).toEqual([]);
    expect(validateLevel(sakNgamLevel)).toEqual([]);
  });

  it('แผนที่สร้างซ้ำได้เหมือนเดิม และขนาดเท่าด่าน 1', () => {
    expect(buildWorld(L2.map).objects).toEqual(buildWorld(L2.map).objects);
    expect([L2.map.widthTiles, L2.map.heightTiles]).toEqual([80, 60]);
  });
});

describe('ลำดับฉาก 1–6', () => {
  it('ฉาก 1 ผ่านเมื่อคุยกับครูเนม และเปิดดูแผนที่ฐานครบทั้ง A และ B', () => {
    const s = newSession(L2);
    talk(s, 'teacher-nem');
    expect(s.evidence).toEqual(['map-a', 'map-b']);
    expect(s.currentStepOrder).toBe(1);
    s.cycleSheet();
    expect(s.mapSheet).toBe('A');
    expect(s.currentStepOrder).toBe(1);
    s.cycleSheet();
    expect(s.mapSheet).toBe('B');
    expect(s.currentStepOrder).toBe(2);
    s.cycleSheet();
    expect(s.mapSheet).toBe('current');
    expect(s.skills.has('map-symbols')).toBe(true);
  });

  it('ฉาก 2 ต้องคุยกับชาวบ้าน 2 คน และเดินไปเห็นสะพานกับฝายจริง', () => {
    const s = playTo(2);
    talk(s, 'villager-hom');
    talk(s, 'farmer-phet');
    expect(s.currentStepOrder).toBe(2);
    explore(s, 'bridge');
    expect(s.currentStepOrder).toBe(2);
    explore(s, 'site-b');
    expect(s.currentStepOrder).toBe(3);
  });

  it('ผู้ดูแลแหล่งน้ำไม่ให้ข้อมูลความสูงก่อนสำรวจชุมชน', () => {
    const s = playTo(2);
    talk(s, 'water-keeper');
    expect(s.clues).not.toContain('clue-elev-abc');
  });

  it('เดินครบทุกฉากจนจบด่าน', () => {
    const s = playTo(6);
    expect(s.currentStepOrder).toBe(6);
    expect(s.startEnding()).toBe(true);
    expect(runDialogue(s)).toBe('mission-complete');
    expect(s.currentStep).toBeUndefined();
    expect(s.questStatus.get('main-namlai')).toBe('completed');
  });
});

describe('การรวบรวมเบาะแส (สมุดแยกตามด่าน)', () => {
  it('เบาะแสมาจากด่าน 2 เท่านั้น และไม่ซ้ำ', () => {
    const s = playTo(5);
    const ids = new Set(L2.clues!.map((c) => c.id));
    expect(s.clues.every((id) => ids.has(id))).toBe(true);
    expect(new Set(s.clues).size).toBe(s.clues.length);
    expect(s.clues).toEqual(
      expect.arrayContaining(['clue-conflict', 'clue-symbols', 'clue-village', 'clue-stones', 'clue-weir', 'clue-elev-abc', 'clue-connect']),
    );
  });

  it('หน้าสมุด: ด่าน 2 ไม่มีหน้าวิเคราะห์เส้นทาง ส่วนด่าน 1 ยังมีเหมือนเดิม', () => {
    expect(newSession(L2).notebookTabs()).toEqual(['quests', 'clues', 'records']);
    expect(newSession(sakNgamLevel).notebookTabs()).toEqual(['quests', 'clues', 'routes', 'records']);
  });
});

describe('ทิศทางลำน้ำ: คำนวณจากระดับความสูง A → B → C', () => {
  const elevation = new ElevationModel(L2.map.elevation!);

  it('จุด A 145 ม. · B 130 ม. · C 115 ม. (คำนวณจากแบบจำลอง)', () => {
    const s = newSession(L2);
    expect(s.resolveText('{{elev:site-a}}/{{elev:site-b}}/{{elev:site-c}}')).toBe('145/130/115');
    expect(s.resolveText('{{flow:stream-main}}')).toBe('ทิศเหนือ');
  });

  it('ลำห้วยไหลไปทางเหนือ (ขึ้นด้านบนจอ) และลดระดับตลอดแนว', () => {
    const a = analyzeWaterway(STREAM_POINTS, elevation);
    expect(a.flowDirection).toBe('N');
    expect(a.monotonic).toBe(true);
    expect(analyzeWaterway([...STREAM_POINTS].reverse(), elevation).flowDirection).toBe('N');
  });

  it('กลับด้านภูมิประเทศ → ทิศน้ำไหลกลับ แม้ลำน้ำบนจออยู่ที่เดิม (ไม่ใช้ตำแหน่งบนจอ)', () => {
    const flipped = new ElevationModel({ baseMeters: 200, slope: { dx: 0, dy: -0.6 } });
    expect(analyzeWaterway(STREAM_POINTS, flipped).flowDirection).toBe('S');
  });

  it('validateLevel จับลำดับจุดที่ไม่ตรงทิศน้ำไหล และคำตอบที่ไม่ตรงความสูง', () => {
    const reversed: LevelDefinition = { ...L2, flowSequence: { waterwayId: 'stream-main', landmarkIds: ['site-c', 'site-b', 'site-a'] } };
    expect(validateLevel(reversed).some((e) => e.includes('ไม่ได้อยู่ท้ายน้ำ'))).toBe(true);
    const flipped: LevelDefinition = { ...L2, map: { ...L2.map, elevation: { baseMeters: 200, slope: { dx: 0, dy: -0.6 } } } };
    expect(validateLevel(flipped).some((e) => e.includes('คำถาม flow'))).toBe(true);
  });

  it('ตอบตามตำแหน่งบนจอ (C อยู่บน → ไหลลงใต้) ผิด และได้คำใบ้', () => {
    const s = playTo(3);
    s.talkTo(L2.npcs.find((n) => n.id === 'water-keeper')!);
    s.advanceDialogue();
    s.advanceDialogue();
    s.advanceDialogue();
    expect(s.dialogueView?.kind).toBe('quiz');
    expect(s.answerQuiz(0)).toBe(false);
    const v = s.dialogueView!;
    expect(v.kind === 'quiz' && v.feedback).toContain('ด้านบนของแผนที่ไม่ได้แปลว่าสูงกว่า');
    expect(s.answerQuiz(FLOW_NORTH)).toBe(true);
    runDialogue(s);
    expect(s.currentStepOrder).toBe(4);
  });
});

describe('การเปรียบเทียบแผนที่สองฉบับ (ฉาก 4)', () => {
  it('ระบบตรวจ: ฉบับ A ผ่านทั้ง 3 ชนิด, ฉบับ B ผิดทั้งสัญลักษณ์ ทิศน้ำไหล และจุดสังเกต', () => {
    const s = newSession(L2);
    expect(s.sheetReport('A')!.failed).toEqual([]);
    const b = s.sheetReport('B')!;
    expect(b.failed).toEqual(['symbol', 'flow', 'landmark']);
    expect(b.problems.filter((p) => p.check === 'symbol').map((p) => p.label)).toEqual(['A หนองน้ำ', 'C ตาน้ำ']);
    expect(s.verifiedSheetId()).toBe('A');
  });

  it('คำตอบไม่ได้ hardcode: สลับข้อมูลสองฉบับ → ฉบับที่ถูกเปลี่ยนตาม', () => {
    const [a, b] = L2.baseMaps!;
    const swapped: LevelDefinition = { ...L2, baseMaps: [{ ...a, marks: b.marks, flowArrows: b.flowArrows }, { ...b, marks: a.marks, flowArrows: a.flowArrows }] };
    expect(newSession(swapped).verifiedSheetId()).toBe('B');
    expect(validateLevel(swapped).filter((e) => e.includes('แผนที่ฐาน'))).toEqual([]);
  });

  it('validateLevel จับกรณีทั้งสองฉบับถูก (ผู้เล่นแยกไม่ออก)', () => {
    const [a] = L2.baseMaps!;
    const bothRight: LevelDefinition = { ...L2, baseMaps: [a, { ...a, id: 'B', requiredEvidenceId: 'map-b' }] };
    expect(validateLevel(bothRight)).toContain('แผนที่ฐานต้องมีฉบับเดียวที่ผ่านหลักฐานทุกข้อ (ตอนนี้ไม่มี หรือมีมากกว่าหนึ่ง)');
  });

  it('ตัดสินได้เฉพาะฉาก 4 และต้องเดินไปเห็นจุดสังเกตจริงก่อน (ไม่นับเป็นผิด)', () => {
    const early = playTo(3);
    expect(early.chooseSheet(0).blocked).toBe('not-available');
    const s = playTo(4);
    const r = s.chooseSheet(0);
    expect(r.blocked).toBe('missing-evidence');
    expect(r.missing.observations).toEqual(['three-stones', 'site-c']);
    expect(s.mistakes.compare).toBe(0);
  });

  it('เลือกผิดได้คำอธิบายจากผลตรวจ แล้วเลือกใหม่ได้', () => {
    const s = playTo(4);
    explore(s, 'three-stones');
    explore(s, 'site-c', 4);
    const wrong = s.chooseSheet(1);
    expect(wrong.ok).toBe(false);
    expect(wrong.reports['B'].failed.length).toBe(3);
    expect(s.mistakes.compare).toBe(1);
    const right = s.chooseSheet(0);
    expect(right.ok).toBe(true);
    expect(right.reports['A'].failed).toEqual([]);
    expect(s.currentStepOrder).toBe(5);
  });
});

describe('จุดสำรวจ A/B/C และการปักหมุด (ฉาก 5)', () => {
  it('มีจุดเดียวที่ผ่านหลักฐานทุกข้อ และระบบคำนวณเป้าหมายเอง', () => {
    const s = newSession(L2);
    const r = Object.fromEntries(s.evaluateSites().map((x) => [x.label, x.failed]));
    expect(r).toEqual({ 'จุด A': [], 'จุด B': ['upstream', 'symbol'], 'จุด C': ['upstream', 'symbol'] });
    expect(s.pinTargetId()).toBe('site-a');
  });

  it('ตรวจ: ต้องยืนใกล้ · พิกัด · ประเภทสถานที่ · หลักฐานการสำรวจ', () => {
    const s = playTo(5);
    explore(s, 'site-a', 4);
    s.playerTile = { x: 40, y: 34 };
    expect(s.submitPin(SITE_A, SPRING).problems).toEqual(['far', 'evidence']);
    expect(s.mistakes.pin).toBe(0); // ยังไม่ได้ไปถึง/สำรวจ ไม่นับว่าตอบผิด
    s.playerTile = { x: 22, y: 55 };
    expect(s.submitPin(SITE_A, SPRING).problems).toEqual(['evidence']);
    inspect(s, 'survey-a', { x: 22, y: 55 });
    expect(s.submitPin(SITE_A, 2).problems).toEqual(['wisdom']);
    expect(s.mistakes.pin).toBe(1);
    expect(s.submitPin({ x: 22, y: 55 }, SPRING)).toEqual({ ok: true, problems: [] });
    expect(s.currentStepOrder).toBe(6);
  });

  it('ปักที่จุด C (หนองน้ำด้านบนจอ) ผิดพิกัด', () => {
    const s = playTo(5);
    explore(s, 'site-c', 4);
    inspect(s, 'survey-c', { x: 35, y: 4 });
    expect(s.submitPin({ x: 33, y: 3 }, SPRING).problems).toContain('location');
  });
});

describe('จบด่าน 2 และปลดล็อกด่าน 3', () => {
  it('ครูเนมสรุป → รหัสลับชิ้นที่ 2 "น้ำ" → ปลดล็อก level-3 (ต้นแบบ) · ด่าน 4 ยังเข้าไม่ได้', () => {
    const s = playTo(6);
    s.startEnding();
    runDialogue(s);
    expect(s.messages[2].text).toContain('A 145 ม. → B 130 ม. → C 115 ม.');
    expect(L2.ending!.codePiece).toEqual({ index: 2, total: 4, value: 'น้ำ' });
    expect(L2.unlocks).toBe('level-3');

    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.completeLevel(
      { levelId: 'sakngam', completedAt: 'x', distanceMeters: 1, cluesFound: 6, cluesTotal: 6, mistakes: 0, elapsedMs: 1, skills: [], codePiece: sakNgamLevel.ending!.codePiece! },
      'level-2',
    );
    const sum = s.summary();
    store.completeLevel(
      { levelId: 'level-2', completedAt: 'x', distanceMeters: sum.distanceMeters, cluesFound: sum.cluesFound, cluesTotal: sum.cluesTotal, mistakes: sum.mistakes, elapsedMs: 0, skills: sum.skills, codePiece: L2.ending!.codePiece! },
      L2.unlocks,
    );
    expect(store.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ']);
    expect(store.isCompleted('sakngam')).toBe(true);
    const cards = LEVEL_SEQUENCE.map((slot, i) => describeLevel(slot, store.data, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null));
    expect(cards.map((c) => c.state)).toEqual(['completed', 'completed', 'unlocked', 'locked']);
    expect(canEnterLevel('level-3', store.data)).toBe(true);
    expect(canEnterLevel('level-4', store.data)).toBe(false);
  });
});

describe('ภารกิจรอง และภารกิจปริศนา', () => {
  it('ภารกิจรอง: อ่านป้ายวัดระดับครบ 3 จุด', () => {
    const s = playTo(4);
    expect(s.questStatus.get('side-gauges')).toBe('active');
    inspect(s, 'survey-a', { x: 22, y: 55 });
    inspect(s, 'survey-b', { x: 30, y: 28 });
    inspect(s, 'survey-c', { x: 35, y: 4 });
    expect(s.questStatus.get('side-gauges')).toBe('completed');
  });

  it('ภารกิจปริศนา: ยอดเนินตรงกับจุดสูงสุดจริง (validateLevel ตรวจ) และพบไหได้', () => {
    const s = playTo(4);
    expect(s.questStatus.get('mystery-jar')).toBe('locked');
    talk(s, 'villager-hom');
    expect(s.questStatus.get('mystery-jar')).toBe('active');
    explore(s, 'hill-summit');
    inspect(s, 'hill-jar', { x: 70, y: 51 });
    expect(s.evidence).toContain('old-jar');
    expect(s.questStatus.get('mystery-jar')).toBe('completed');
    const moved: LevelDefinition = {
      ...L2,
      inspectPoints: L2.inspectPoints!.map((p) => (p.id === 'hill-jar' ? { ...p, at: { x: 70, y: 42 } } : p)),
    };
    expect(validateLevel(moved).some((e) => e.includes('hill-jar') && e.includes('ไม่ใช่จุดสูงสุด'))).toBe(true);
  });
});

describe('บันทึกและโหลดความคืบหน้าด่าน 2', () => {
  it('บันทึกกลางฉาก 4 แล้วโหลดกลับ เล่นต่อจนจบได้', () => {
    const a = playTo(4);
    explore(a, 'three-stones');
    const snap = JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot;
    expect(snap.contentVersion).toBe(2);
    const b = newSession(L2);
    expect(b.restore(snap)).toBe(true);
    expect(b.currentStepOrder).toBe(4);
    expect(b.availableSheets().map((m) => m.id)).toEqual(['A', 'B']);
    expect(b.discoveredLandmarks.has('three-stones')).toBe(true);
    explore(b, 'site-c', 4);
    expect(b.chooseSheet(0).ok).toBe(true);
    explore(b, 'site-a', 4);
    inspect(b, 'survey-a', { x: 22, y: 55 });
    expect(b.submitPin(SITE_A, SPRING).ok).toBe(true);
    b.startEnding();
    expect(runDialogue(b)).toBe('mission-complete');
  });

  it('บันทึกของต้นแบบด่าน 2 รุ่นก่อน (ไม่มี contentVersion) ไม่ถูกโหลด → เริ่มด่านใหม่', () => {
    const old = { ...newSession(L2).toSnapshot(), contentVersion: undefined };
    const s = newSession(L2);
    expect(s.restore(old as SessionSnapshot)).toBe(false);
    expect(s.currentStepOrder).toBe(1);
  });

  it('บันทึกของด่าน 1 (ไม่มี contentVersion) ยังโหลดได้ตามเดิม', () => {
    const a = newSession(sakNgamLevel);
    talk(a, 'teacher-nem');
    const snap = JSON.parse(JSON.stringify(a.toSnapshot()));
    delete snap.contentVersion;
    const b = newSession(sakNgamLevel);
    expect(b.restore(snap)).toBe(true);
    expect(b.currentStepOrder).toBe(2);
  });
});
