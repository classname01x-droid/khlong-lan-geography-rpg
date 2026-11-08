import { describe, expect, it } from 'vitest';
import { khlongLanPattanaLevel as L4 } from '../src/content/levels/khlonglanpattana';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { ALL_LEVELS } from '../src/content/registry';
import type { LevelDefinition, ObjectiveCondition, StepCondition } from '../src/content/types';
import { buildQuestTracker, HintTracker, hintTierFor, stepKind } from '../src/core/guide/QuestGuide';
import { interactionTargets, pickInteraction } from '../src/core/input/Interaction';
import {
  ACTION_KEY,
  buildTouchContext,
  choiceKey,
  exploreActionForKey,
  joystickVector,
  TapGuard,
  type TouchContextInput,
} from '../src/core/input/InputMapping';
import type { GameSession } from '../src/core/session/GameSession';
import { computeMobileLayout, GAME_ASPECT, hudWidths } from '../src/core/ui/MobileLayout';
import { centerOnTile, clampPan, fitCell, MAP_ZOOMS, readableZoomIndex, scaleBarLength, screenToTile } from '../src/core/ui/MapViewport';
import { boardReader, esc, notebookReader } from '../src/ui/touch/readerHtml';
import { boardTitle, buildBoardView } from '../src/ui/views/boardView';
import { buildNotebookView, NOTEBOOK_TAB_LABEL } from '../src/ui/views/notebookView';
import { KEYBOARD_HINT_RE, touchWording } from '../src/ui/views/touchWording';
import { newSession, runDialogue, talk } from './helpers';

const NPC_RADIUS = 2;

const baseInput = (over: Partial<TouchContextInput> = {}): TouchContextInput => ({
  mode: 'explore',
  interact: null,
  analysis: null,
  dialogue: null,
  map: { pinStage: 'none', canSwitchSheet: false, wisdomChoices: [] },
  notebook: { routeChoices: [] },
  compareChoices: [],
  grid: { choices: [], selected: null, solved: false },
  ...over,
});

describe('Input mapping: ปุ่มสัมผัส ↔ คีย์บอร์ด', () => {
  it('โหมดสำรวจ: จอยสติก + ปุ่มไอคอนพร้อมชื่อไทย (ไม่ใช่ตัวอักษร E/M/R/C)', () => {
    const ctx = buildTouchContext(baseInput({ interact: { label: 'พูดคุยกับครูเนม', verb: 'คุย' }, analysis: { available: true, label: 'วิเคราะห์' } }));
    expect(ctx.joystick).toBe(true);
    expect(ctx.actions.map((a) => a.id)).toEqual(['interact', 'map', 'notebook', 'measure', 'analysis', 'grid', 'menu']);
    for (const a of ctx.actions) {
      expect(a.label).toMatch(/[฀-๿]/); // มีอักษรไทย
      expect(['E', 'M', 'R', 'C', 'N']).not.toContain(a.label);
      expect(a.icon.length).toBeGreaterThan(0);
    }
    expect(ctx.actions[0]).toMatchObject({ label: 'คุย', enabled: true, primary: true });
  });

  it('ปุ่มสัมผัสส่งรหัสปุ่มเดียวกับคีย์บอร์ด (โหมดสำรวจใช้กติกาเดียวกัน)', () => {
    const ctx = buildTouchContext(baseInput({ interact: { label: 'x', verb: 'x' }, analysis: { available: true, label: 'วิเคราะห์' } }));
    for (const a of ctx.actions) expect(exploreActionForKey(a.code)).toBe(a.id);
    expect(ACTION_KEY.interact).toBe('KeyE');
    expect(ACTION_KEY.map).toBe('KeyM');
    expect(ACTION_KEY.measure).toBe('KeyR');
    expect(ACTION_KEY.analysis).toBe('KeyC');
    expect(ACTION_KEY.menu).toBe('Escape');
  });

  it('ปุ่มที่ใช้ไม่ได้ถูกปิด/ซ่อน: ไม่มีอะไรในระยะ → ปุ่มโต้ตอบปิด · ด่านไม่มีการวิเคราะห์ → ไม่มีปุ่มวิเคราะห์', () => {
    const ctx = buildTouchContext(baseInput());
    expect(ctx.actions.find((a) => a.id === 'interact')!.enabled).toBe(false);
    expect(ctx.actions.some((a) => a.id === 'analysis')).toBe(false);
    const locked = buildTouchContext(baseInput({ analysis: { available: false, label: 'วิเคราะห์' } }));
    expect(locked.actions.find((a) => a.id === 'analysis')!.enabled).toBe(false);
  });

  it('บทสนทนา: แตะเพื่อไปต่อ · คำถาม: ตัวเลือกเป็นปุ่มใหญ่ส่ง Digit1..n · ไม่มีจอยสติก', () => {
    const line = buildTouchContext(baseInput({ mode: 'dialogue', dialogue: { kind: 'line', choices: [] } }));
    expect(line).toMatchObject({ joystick: false, tapToAdvance: true });
    expect(line.sheet!.options[0].code).toBe('Space');
    const quiz = buildTouchContext(baseInput({ mode: 'dialogue', dialogue: { kind: 'quiz', choices: ['40 ม.', '400 ม.', '4,000 ม.'] } }));
    expect(quiz.sheet!.options.map((o) => [o.label, o.code])).toEqual([
      ['40 ม.', 'Digit1'],
      ['400 ม.', 'Digit2'],
      ['4,000 ม.', 'Digit3'],
    ]);
    expect(quiz.tapToAdvance).toBe(false);
  });

  it('แผนที่: ปักหมุด/สลับแผ่น/ปิด · ขั้นเลือกประเภทสถานที่เป็นแผ่นตัวเลือก', () => {
    const map = buildTouchContext(baseInput({ mode: 'map', map: { pinStage: 'cursor', canSwitchSheet: true, wisdomChoices: [] } }));
    // ปุ่มลูกศร 4 ทิศ (ครั้งละ 1 ช่อง ใช้รหัสลูกศรเดียวกับคีย์บอร์ด) → ปักหมุดตรงนี้ → ปุ่มรอง (ครึ่งความกว้าง)
    expect(map.actions.map((a) => [a.id, a.code])).toEqual([
      ['pinUp', 'ArrowUp'],
      ['pinDown', 'ArrowDown'],
      ['pinLeft', 'ArrowLeft'],
      ['pinRight', 'ArrowRight'],
      ['pinHere', 'Space'],
      ['sheet', 'Tab'],
      ['close', 'KeyM'],
    ]);
    expect(map.actions.filter((a) => a.id.startsWith('pin') && a.id !== 'pinHere').map((a) => a.label)).toEqual(['เหนือ', 'ใต้', 'ตก', 'ออก']);
    expect(map.actions.find((a) => a.id === 'pinHere')!.primary).toBe(true);
    // ดูแผนที่อย่างเดียว (ยังปักหมุดไม่ได้): ไม่มีปุ่มลูกศร/ปักหมุด
    const view = buildTouchContext(baseInput({ mode: 'map', map: { pinStage: 'none', canSwitchSheet: false, wisdomChoices: [] } }));
    expect(view.actions.some((a) => a.id === 'pinUp' || a.id === 'pinHere')).toBe(false);
    const wisdom = buildTouchContext(baseInput({ mode: 'map', map: { pinStage: 'wisdom', canSwitchSheet: false, wisdomChoices: ['วัด', 'ศูนย์เรียนรู้'] } }));
    expect(wisdom.sheet!.options.map((o) => o.code)).toEqual(['Digit1', 'Digit2']);
    expect(wisdom.actions[0].code).toBe('Escape');
  });

  it('กระดานวิเคราะห์: เลือก A/B/C ได้ แต่ "ยืนยัน" กดได้เมื่อเลือกแล้วเท่านั้น · ผ่านแล้วปิดการเลือก', () => {
    const g = (selected: number | null, solved = false) =>
      buildTouchContext(baseInput({ mode: 'gridcheck', grid: { choices: ['จุด A', 'จุด B', 'จุด C'], selected, solved } }));
    expect(g(null).actions.find((a) => a.id === 'confirm')!.enabled).toBe(false);
    const sel = g(1);
    expect(sel.actions.find((a) => a.id === 'confirm')).toMatchObject({ enabled: true, code: 'Enter' });
    expect(sel.actions.filter((a) => a.id === 'choice').map((a) => a.selected)).toEqual([false, true, false]);
    expect(g(1, true).actions.filter((a) => a.id === 'choice').every((a) => !a.enabled)).toBe(true);
  });

  it('สมุด เปรียบเทียบ สรุปผล และเมนูหยุดเกม', () => {
    const nb = buildTouchContext(baseInput({ mode: 'notebook', notebook: { routeChoices: ['ก', 'ข', 'ค'] } }));
    expect(nb.actions.map((a) => a.code)).toEqual(['ArrowLeft', 'ArrowRight', 'KeyN']);
    expect(nb.sheet!.options.map((o) => o.code)).toEqual(['Digit1', 'Digit2', 'Digit3']);
    const cmp = buildTouchContext(baseInput({ mode: 'compare', compareChoices: ['ฉบับ A', 'ฉบับ B'] }));
    expect(cmp.actions.map((a) => a.code)).toEqual(['Digit1', 'Digit2', 'Escape']);
    const sum = buildTouchContext(baseInput({ mode: 'summary' }));
    expect(sum.actions.map((a) => a.code)).toEqual(['Enter', 'Escape']);
    expect(buildTouchContext(baseInput({ mode: 'pause' })).actions).toEqual([]); // เมนูหยุดเกมมีปุ่มแตะได้ของตัวเอง
    expect(choiceKey(0)).toBe('Digit1');
  });
});

describe('จอยสติก 8 ทิศ และการกันแตะซ้ำ', () => {
  it('ลากไม่ถึง deadzone = หยุด · ปล่อยนิ้ว (0,0) = หยุด', () => {
    expect(joystickVector(0, 0, 50)).toEqual({ dir: null, x: 0, y: 0 });
    expect(joystickVector(10, 0, 50).dir).toBeNull(); // 20% < 25%
  });

  it('ปัดเป็น 8 ทิศ (ขึ้นจอ = เหนือ) และเวกเตอร์ยาว 1 เสมอ', () => {
    const cases: Array<[number, number, string]> = [
      [0, -40, 'N'],
      [30, -30, 'NE'],
      [40, 0, 'E'],
      [30, 30, 'SE'],
      [0, 40, 'S'],
      [-30, 30, 'SW'],
      [-40, 0, 'W'],
      [-30, -30, 'NW'],
      [40, -10, 'E'], // 76° → ตะวันออก
      [40, -25, 'NE'], // 58° → ตะวันออกเฉียงเหนือ
    ];
    for (const [dx, dy, dir] of cases) {
      const v = joystickVector(dx, dy, 50);
      expect(v.dir, `${dx},${dy}`).toBe(dir);
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6);
    }
    // ลากเลยรัศมีก็ยังเดินด้วยความเร็วเท่าเดิม
    expect(joystickVector(500, 0, 50)).toMatchObject({ dir: 'E', x: 1, y: 0 });
  });

  it('TapGuard: แตะครั้งเดียวส่งคำสั่งครั้งเดียว (pointerdown ซ้ำ/เมาส์จำลองถูกตัด) แต่กดปุ่มอื่นพร้อมกันได้', () => {
    const g = new TapGuard(280);
    expect(g.accept('map', 1000)).toBe(true);
    expect(g.accept('map', 1010)).toBe(false);
    expect(g.accept('interact', 1015)).toBe(true); // คนละปุ่ม
    expect(g.accept('map', 1300)).toBe(true);
  });
});

describe('Contextual interaction', () => {
  it('ใกล้ NPC → "พูดคุยกับ…" · ไกลเกินระยะ → ไม่มีเป้าหมาย', () => {
    const s = newSession(L4);
    s.playerTile = { x: 10, y: 50 };
    expect(pickInteraction(s, NPC_RADIUS)).toMatchObject({ kind: 'npc', id: 'teacher-nem', label: 'พูดคุยกับครูเนม', verb: 'คุย' });
    s.playerTile = { x: 30, y: 50 };
    expect(pickInteraction(s, NPC_RADIUS)).toBeNull();
  });

  it('จุดสำรวจที่ยังไม่เปิดตามเนื้อเรื่อง ไม่ถูกเสนอ · เปิดแล้วแสดงชื่อจุด', () => {
    const s = newSession(L4);
    s.playerTile = { x: 21, y: 39 };
    expect(pickInteraction(s, NPC_RADIUS)).toBeNull(); // หมุดเปิดตั้งแต่ฉาก 2
    talk(s, 'teacher-nem', [1]);
    expect(pickInteraction(s, NPC_RADIUS)).toMatchObject({ kind: 'inspect', id: 'rp-1-read', label: 'สำรวจหมุดอ้างอิงพิกัด RP-1' });
  });

  it('หลายเป้าหมายในระยะ: เลือกตัวที่ใกล้ที่สุด · ระยะเท่ากันเลือก NPC ก่อน (ไม่สุ่ม)', () => {
    const level: LevelDefinition = {
      ...L4,
      inspectPoints: [
        { id: 'near-a', at: { x: 11, y: 50 }, radiusTiles: 2, when: {}, nodes: [{ speaker: 'ป้ายทดสอบ', text: 'x' }] },
        ...L4.inspectPoints!,
      ],
    };
    const s = newSession(level);
    s.playerTile = { x: 10, y: 50 }; // ครูเนม (9,50) ห่าง 1 · ป้าย (11,50) ห่าง 1
    const list = interactionTargets(s, NPC_RADIUS);
    expect(list.map((t) => t.id)).toEqual(['teacher-nem', 'near-a']);
    s.playerTile = { x: 11, y: 51 }; // ป้ายห่าง 1 · ครูเนมห่าง 2.24 (เกินระยะ)
    expect(pickInteraction(s, NPC_RADIUS)!.id).toBe('near-a');
    for (let i = 0; i < 5; i++) expect(pickInteraction(s, NPC_RADIUS)!.id).toBe('near-a');
  });

  it('จุดตรวจยืนยัน (บท 4 ฉาก 6) แสดง "ตรวจสอบหลักฐานที่…"', () => {
    const s = newSession(L4);
    s.flags.add('analysis-done');
    s.playerTile = { x: 64, y: 25 };
    expect(pickInteraction(s, NPC_RADIUS)).toMatchObject({ kind: 'verify', label: 'ตรวจสอบหลักฐานที่จุด B', verb: 'ตรวจสอบ' });
  });
});

/* ---------------- Quest Tracker ---------------- */

/** ทำให้ฉากก่อนหน้าทั้งหมดผ่าน (ตั้งสถานะตรง ๆ) เพื่อดูแถบภารกิจของฉากที่ต้องการ */
function satisfy(s: GameSession, c: StepCondition | ObjectiveCondition): void {
  switch (c.type) {
    case 'flag':
      s.flags.add(c.flag);
      return;
    case 'talk':
      (s as unknown as { talkedTo: Set<string> }).talkedTo.add(c.npcId);
      return;
    case 'all':
      for (const o of c.of) satisfy(s, o);
      return;
    case 'discover':
      s.discoveredLandmarks.add(c.landmarkId);
      return;
    case 'clue':
      s.clues.push(c.clueId);
      return;
    case 'evidence':
      s.evidence.push(c.evidenceId);
      return;
    default:
      return;
  }
}

function sessionAtStep(level: LevelDefinition, order: number): GameSession {
  const s = newSession(level);
  for (const st of level.story) if (st.order < order && st.completeWhen) satisfy(s, st.completeWhen);
  s.updateQuests(true);
  return s;
}

describe('Quest Tracker (ทุกบท ดึงจาก GameSession)', () => {
  it('บท 1 เริ่มเกม: ชื่อบท ภารกิจ เป้าหมาย ความคืบหน้า', () => {
    const s = newSession(L1);
    const t = buildQuestTracker(s, { chapterOrder: 1 });
    expect(t.chapterLabel).toBe(`บทที่ 1: ${L1.quests!.find((q) => q.kind === 'main')!.title}`);
    // บทที่ 1 มีขั้นย่อย: ภารกิจหลัก · เป้าหมายเดียว · วิธีทำ · ความคืบหน้าเป็นขั้น
    expect(t.questTitle).toBe('ช่วยชาวบ้านสักงาม รับคำพิทักษ์คำแรก');
    expect(t.objective).toBe('ไปคุยกับครูเนม');
    // ช่วงที่ 1 (รับภารกิจ) มี 3 ขั้น — นับแยกจากช่วงที่ 2 (13 ขั้น)
    expect(t.progress).toEqual({ done: 0, total: 3, label: 'ขั้น' });
    expect(t.phaseTitle).toBe('ช่วงที่ 1 · รับภารกิจ');
    expect(t.micro).toBe(true);
    // วิธีทำแสดงตั้งแต่เริ่ม (กด/แตะอะไร) · เครื่องมือ · ผลเมื่อสำเร็จ · เป้าหมายนำทาง
    expect(t.steps.join(' ')).toContain('ครูเนม');
    expect(t.tools.length).toBeGreaterThan(0);
    expect(t.result).toContain('ภารกิจ');
    expect(t.target?.id).toBe('teacher-nem');
    expect(t.hint).toBeNull();
    expect(t.hintTier).toBe(0);
  });

  it('เป้าหมายเปลี่ยนเองเมื่อสำเร็จ: ฉากแบบหลายเป้าหมายแสดงทีละข้อ + ความคืบหน้า 2/4', () => {
    const s = sessionAtStep(L4, 2);
    let t = buildQuestTracker(s, { chapterOrder: 4 });
    expect(t.progress).toEqual({ done: 2, total: L4.story.flatMap((st) => st.micro ?? []).length, label: 'ขั้น' });
    expect(t.objective).toBe('อ่านพิกัดที่หมุดอ้างอิง RP-1');
    expect(t.target?.id).toBe('rp-1');
    s.flags.add('read-rp-1');
    s.flags.add('read-rp-2');
    t = buildQuestTracker(s, { chapterOrder: 4 });
    expect(t.progress.done).toBe(4);
    expect(t.objective).toBe('อ่านพิกัดที่หมุดอ้างอิง RP-3');
    expect(t.remaining).toEqual(['ไปคุยกับพี่ต้นกล้า', 'ตอบคำถามเรื่องระยะเส้นตรง']);
    s.flags.add('read-rp-3');
    s.flags.add('distance-ok');
    t = buildQuestTracker(s, { chapterOrder: 4 });
    expect(t.objective).toBe('ไปคุยกับป้าบัวลอย');
    expect(t.step.current).toBe(3);
  });

  it('ทุกบททุกฉากมีเป้าหมายที่อ่านได้ และชนิดฉากถูกระบุ', () => {
    for (const L of ALL_LEVELS) {
      for (const st of L.story) {
        const s = sessionAtStep(L, st.order);
        const t = buildQuestTracker(s, { hintTier: 2 });
        const micro = L.story.some((x) => x.micro?.length);
        expect(t.questTitle, `${L.id}#${st.order}`).toBe(micro ? L.quests!.find((q) => q.kind === 'main')!.title : st.title);
        expect(t.objective.length, `${L.id}#${st.order}`).toBeGreaterThan(3);
        expect(t.hint?.length ?? 0, `${L.id}#${st.order}`).toBeGreaterThan(5);
        expect(stepKind(L, st)).not.toBe('other');
      }
    }
  });

  it('จบภารกิจแล้ว → แสดงว่าสำเร็จ ไม่มีคำแนะนำค้าง', () => {
    const s = sessionAtStep(L1, L1.story.length + 1);
    const t = buildQuestTracker(s, { chapterOrder: 1 });
    expect(t.complete).toBe(true);
    expect(t.hint).toBeNull();
  });

  it('แสดงภารกิจรอง/ปริศนาที่กำลังทำ', () => {
    const s = sessionAtStep(L4, 4);
    s.clues.push('clue-straight-road'); // ได้จากพี่ต้นกล้าในฉาก 2
    s.updateQuests(true);
    expect(buildQuestTracker(s).sideQuests).toContain('สำรวจโครงข่ายถนน');
  });
});

describe('คำแนะนำแบบเป็นระดับ (ไม่เฉลย)', () => {
  it('ระดับเพิ่มตามเวลาในฉาก / จำนวนครั้งที่ผิด / การขอเพิ่ม และเริ่มใหม่เมื่อเปลี่ยนฉาก', () => {
    expect(hintTierFor(0, 0)).toBe(0);
    expect(hintTierFor(61_000, 0)).toBe(1);
    expect(hintTierFor(0, 1)).toBe(1);
    expect(hintTierFor(0, 3)).toBe(2);
    expect(hintTierFor(200_000, 0)).toBe(2);
    expect(hintTierFor(0, 0, 1)).toBe(1);
    const h = new HintTracker();
    expect(h.update(2, 1000, 0)).toBe(0);
    expect(h.update(2, 30_000, 1)).toBe(1); // ผิด 1 ครั้งในฉากนี้
    h.requestMore();
    expect(h.update(2, 31_000, 1)).toBe(2);
    expect(h.update(3, 32_000, 1)).toBe(0); // ฉากใหม่: นับใหม่
  });

  it('ระดับ 1 = วิธีทำ (แสดงตลอด) · ระดับ 2 = เครื่องมือ · ระดับ 3 = คำถามช่วยคิด', () => {
    const s = sessionAtStep(L4, 5);
    const t0 = buildQuestTracker(s, { hintTier: 0, touch: true });
    expect(t0.kind).toBe('analysis');
    expect(t0.objective).toBe('สำรวจจุด A, B และ C');
    expect(t0.hint).toBeNull();
    expect(t0.steps.join(' ')).toContain('แตะปุ่ม "✋ สำรวจ"');
    const t1 = buildQuestTracker(s, { hintTier: 1, touch: true });
    expect(t1.hint).toContain('วัดระยะ');
    const t2 = buildQuestTracker(s, { hintTier: 2 });
    expect(t2.hint).toMatch(/\?$/);
    for (const f of ['surveyed-a', 'surveyed-b', 'surveyed-c']) s.flags.add(f);
    const board = buildQuestTracker(s, { touch: true });
    expect(board.objective).toBe('เปิดกระดานวิเคราะห์หลักฐาน');
    expect(board.action?.id).toBe('analysis');
    const quiz = buildQuestTracker(sessionAtStep(L4, 3), { touch: true });
    expect(quiz.objective).toBe('ไปคุยกับป้าบัวลอย');
    expect(quiz.target?.id).toBe('water-keeper');
  });

  it('ไม่เฉลย: คำแนะนำทุกระดับของทุกบทไม่ระบุสถานที่คำตอบ', () => {
    for (const L of ALL_LEVELS) {
      const answerNames: string[] = [];
      const def = L.integratedSiteAnalysis ?? L.gridSiteAnalysis;
      if (def?.correctLandmarkId) {
        answerNames.push(L.landmarks.find((l) => l.id === def.correctLandmarkId)!.name);
        answerNames.push(def.candidates.find((c) => c.landmarkId === def.correctLandmarkId)!.label);
      }
      if (L.pinTask && L.pinTask.targetId !== 'site-analysis') answerNames.push(L.landmarks.find((l) => l.id === L.pinTask!.targetId)!.name);
      const correctRoute = L.routeAnalysis?.routes.find((r) => r.id === L.routeAnalysis!.correctRouteId);
      for (const st of L.story) {
        const s = sessionAtStep(L, st.order);
        for (const c of def?.candidates ?? []) if (c.evidenceId) s.evidence.push(c.evidenceId); // สำรวจครบ → ไม่มีรายการจุด
        for (const tier of [0, 1, 2]) {
          const hint = buildQuestTracker(s, { hintTier: tier }).hint ?? '';
          for (const name of answerNames) expect(hint, `${L.id}#${st.order} tier ${tier}`).not.toContain(name);
          if (correctRoute) expect(hint).not.toContain(correctRoute.description);
        }
      }
    }
  });

  it('คำแนะนำมาจากข้อมูลจริง: คุยแล้ว/ตอบแล้ว เป้าหมายเลื่อนตาม', () => {
    const s = newSession(L4);
    expect(buildQuestTracker(s).objective).toContain('ไปคุยกับครูเนม');
    talk(s, 'teacher-nem', [1]);
    runDialogue(s);
    expect(buildQuestTracker(s).step.current).toBe(2);
    expect(buildQuestTracker(s).objective).toBe('อ่านพิกัดที่หมุดอ้างอิง RP-1');
  });
});

describe('Mobile layout (แนวนอน/แนวตั้ง/รอยบาก)', () => {
  const none = { top: 0, right: 0, bottom: 0, left: 0 };

  it('มือถือแนวนอน 844×390: ภาพเกมสูงเต็มจอ คงสัดส่วน 3:2 ปุ่มอยู่ข้างภาพ ไม่ทับฉาก', () => {
    const l = computeMobileLayout(844, 390, none, true);
    expect(l.portrait).toBe(false);
    expect(l.sideColumns).toBe(true);
    expect(l.game.h).toBe(390);
    expect(l.game.w / l.game.h).toBeCloseTo(GAME_ASPECT, 6);
    expect(l.left.x + l.left.w).toBeLessThanOrEqual(l.game.x + 0.5);
    expect(l.right.x).toBeGreaterThanOrEqual(l.game.x + l.game.w - 0.5);
    expect(l.compact).toBe(true);
    expect(l.button).toBeGreaterThanOrEqual(44);
  });

  it('เครื่องมีรอยบาก (safe-area ซ้าย–ขวา 47): ย่อภาพเกมเล็กน้อยเพื่อให้ปุ่มไม่ทับ และไม่วางอะไรในรอยบาก', () => {
    const l = computeMobileLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, true);
    expect(l.sideColumns).toBe(true);
    expect(l.left.x).toBe(47);
    expect(l.right.x + l.right.w).toBeCloseTo(844 - 47, 6);
    expect(l.game.y + l.game.h).toBeLessThanOrEqual(390 - 21 + 0.5);
    expect(l.game.w / l.game.h).toBeCloseTo(GAME_ASPECT, 6);
  });

  it('จอ 4:3 (แท็บเล็ต): ไม่มีที่ข้างภาพ → ปุ่มซ้อนบนขอบภาพ (ภาพไม่ถูกบีบ)', () => {
    const l = computeMobileLayout(1024, 768, none, true);
    expect(l.sideColumns).toBe(false);
    expect(l.game.w / l.game.h).toBeCloseTo(GAME_ASPECT, 6);
  });

  it('แนวตั้ง: ตรวจพบเพื่อแสดงคำแนะนำให้หมุนจอ', () => {
    expect(computeMobileLayout(390, 844, none, true).portrait).toBe(true);
  });

  it('คอมพิวเตอร์ (ไม่มีจอสัมผัส): ภาพเกมพอดีจอ ไม่มีคอลัมน์ปุ่ม', () => {
    const l = computeMobileLayout(1440, 900, none, false);
    expect(l.sideColumns).toBe(false);
    expect(l.game.h).toBe(900);
    expect(l.left.w).toBe(0);
  });
});

/* =====================================================================
 * v0.13 — อ่านง่ายบนโทรศัพท์จริง: แผนที่ขยาย/เลื่อน · หน้าอ่านตัวอักษรใหญ่ · คำแนะนำปุ่มสัมผัส
 * ===================================================================== */

describe('แผนที่บนจอสัมผัส: ขยาย/เลื่อน (MapViewport)', () => {
  const view = { x: 0, y: 80, w: 960, h: 500 };
  it('ระดับ 1× ทั้งแผนที่พอดีพื้นที่แสดงผล', () => {
    const cell = fitCell(80, 60, view);
    expect(cell).toBe(8);
    expect(80 * cell).toBeLessThanOrEqual(view.w);
    expect(60 * cell).toBeLessThanOrEqual(view.h);
  });
  it('แผนที่เล็กกว่าพื้นที่ → จัดกึ่งกลาง · ใหญ่กว่า → เลื่อนได้แต่ไม่เลยขอบ', () => {
    expect(clampPan({ x: -999, y: 999 }, 640, 480, view)).toEqual({ x: 160, y: 90 });
    const big = { w: 80 * 16, h: 60 * 16 };
    const p = clampPan({ x: 500, y: -5000 }, big.w, big.h, view);
    expect(p.x).toBe(view.x); // ไม่เห็นขอบว่างด้านซ้าย
    expect(p.y + big.h).toBe(view.y + view.h); // ขอบล่างของแผนที่ชิดขอบล่างพื้นที่
  });
  it('ขยายรอบช่องที่เลือก แล้วแตะกลับได้ช่องเดิม (พิกัดไม่เพี้ยนทุกระดับขยาย)', () => {
    for (const z of MAP_ZOOMS) {
      const c = 8 * z;
      const tile = { x: 41, y: 27 };
      const o = centerOnTile(tile, c, 80, 60, view);
      const back = screenToTile(o.x + (tile.x + 0.5) * c, o.y + (tile.y + 0.5) * c, o, c, 80, 60, view);
      expect(back).toEqual(tile);
    }
    expect(screenToTile(5, 5, { x: 0, y: 80 }, 8, 80, 60, view)).toBeNull(); // นอกพื้นที่แผนที่ (ใต้แถบหัว)
  });
  it('แถบมาตราส่วนบนจอยาวตามการขยาย: 100 ม. = 10 ช่องเสมอ (มาตราส่วนเดิม)', () => {
    for (const z of MAP_ZOOMS) expect(scaleBarLength(100, 10, 8 * z)).toBe(10 * 8 * z);
  });
  it('ระดับขยายเริ่มต้นตามขนาดจอ: ชื่อสถานที่บนจอ ≥ 13 px', () => {
    for (const k of [0.4, 0.5, 0.534, 0.6, 0.75, 1]) {
      const i = readableZoomIndex(14, k);
      expect(14 * MAP_ZOOMS[i] * k >= 13 || i === MAP_ZOOMS.length - 1).toBe(true);
    }
  });
});

describe('แถบด้านบนภาพเกม: แถบสถานะกับแถบภารกิจไม่ทับกัน', () => {
  it('ทุกความกว้างตั้งแต่จอเล็ก (iPhone SE) ถึงแท็บเล็ต', () => {
    for (let w = 360; w <= 1200; w += 20) {
      for (const compact of [true, false]) {
        const h = hudWidths(w, compact);
        expect(h.status + h.tracker + 24).toBeLessThanOrEqual(w);
        expect(h.tracker).toBeGreaterThan(150);
      }
    }
  });
});

/** ข้อความทุกชิ้นในข้อมูลด่าน (เดินทุกค่า string แบบ recursive) */
function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => allStrings(x, out));
  return out;
}
const numbersIn = (t: string) => (t.match(/\d[\d,.]*\d|\d{2,}/g) ?? []).sort();

describe('คำแนะนำปุ่ม: คีย์บอร์ด → ปุ่มสัมผัส (เฉพาะจอสัมผัส)', () => {
  it('ตัวอย่างการแปลง', () => {
    expect(touchWording('เดินไปกด E ที่จุดนั้นก่อน')).toBe('เดินไปแตะ ✋ ที่จุดนั้นก่อน');
    expect(touchWording('เปิดแผนที่ (M) เพื่อปักหมุด')).toBe('เปิดแผนที่ (🗺️ แผนที่) เพื่อปักหมุด');
    expect(touchWording('จุดใดตรงกับหลักฐานครบทั้ง 3 ชนิด? กดเลข 1–3 เพื่อเลือก · Esc หรือ C ปิด')).toBe(
      'จุดใดตรงกับหลักฐานครบทั้ง 3 ชนิด? แตะตัวเลือกทางขวาเพื่อเลือก',
    );
    expect(touchWording('กด C เปิดกระดาน', { analysisLabel: 'เทียบแผนที่' })).toBe('แตะ 🔍 เทียบแผนที่ เปิดกระดาน');
  });

  it('ข้อความทุกชิ้นของทุกบท: ไม่เหลือคำสั่งคีย์บอร์ด และตัวเลข/ระยะ/พิกัดไม่เปลี่ยน', () => {
    let rewritten = 0;
    for (const level of ALL_LEVELS) {
      for (const text of allStrings(level)) {
        const out = touchWording(text);
        if (out !== text) rewritten++;
        expect(out, `${level.id}: ${text}`).not.toMatch(KEYBOARD_HINT_RE);
        // ปลอดภัยต่อเนื้อหา: ตัวเลขหลายหลัก (ระยะ ความสูง พิกัด) ต้องเหมือนเดิมทุกตัว
        if (!/กด 1, 2|กด 1 หรือ 2|กดเลข/.test(text)) expect(numbersIn(out), text).toEqual(numbersIn(text));
      }
    }
    // ทดสอบจริง (ไม่ผ่านแบบว่างเปล่า): เนื้อหามีคำสั่งคีย์บอร์ดหลายสิบจุด
    expect(rewritten).toBeGreaterThan(30);
  });

  it('ข้อความที่ไม่มีคำสั่งคีย์บอร์ด → เหมือนเดิมทุกตัวอักษร', () => {
    for (const level of ALL_LEVELS)
      for (const text of allStrings(level)) if (!KEYBOARD_HINT_RE.test(text)) expect(touchWording(text)).toBe(text);
  });
});

describe('หน้าอ่านตัวอักษรใหญ่ (สมุด/กระดานวิเคราะห์) ใช้ข้อมูลชุดเดียวกับ canvas', () => {
  const w = (t: string) => touchWording(t);
  const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

  it('สมุดทุกหน้า ทุกบท ทุกฉาก: สร้างได้ มีแท็บครบ และไม่มีคำสั่งคีย์บอร์ด', () => {
    for (const level of ALL_LEVELS) {
      for (const st of level.story) {
        const s = sessionAtStep(level, st.order);
        for (const tab of s.notebookTabs()) {
          s.notebookTab = tab;
          const view = buildNotebookView(s, { touch: true });
          const r = notebookReader(view, s.notebookTabs(), NOTEBOOK_TAB_LABEL, level.tambon, w);
          expect(r.tabs.filter((t) => t.active).map((t) => t.id)).toEqual([tab]);
          expect(textOf(r.body + r.foot), `${level.id} ฉาก ${st.order} ${tab}`).not.toMatch(KEYBOARD_HINT_RE);
          // บรรทัดชุดเดียวกับที่ canvas วาด (แหล่งข้อความเดียว — ต่างกันเฉพาะคำบอกปุ่มตามอุปกรณ์)
          expect(view.lines.length).toBe(buildNotebookView(s).lines.length);
        }
      }
    }
  });

  it('คอมพิวเตอร์ยังเห็นคำแนะนำคีย์บอร์ดเดิม (Delete 2 ครั้ง)', () => {
    const s = newSession(L1);
    s.notebookTab = 'records';
    expect(buildNotebookView(s).footer.text).toContain('Delete');
    expect(buildNotebookView(s, { touch: true }).footer.text).not.toContain('Delete');
  });

  it('กระดานวิเคราะห์ทุกฉาก: จอแคบแบ่งแท็บ · จอกว้างวางคู่ · ไม่มีคำสั่งคีย์บอร์ด', () => {
    for (const level of ALL_LEVELS.filter((l) => l.gridSiteAnalysis || l.integratedSiteAnalysis)) {
      for (const st of level.story) {
        const s = sessionAtStep(level, st.order);
        const view = buildBoardView(s);
        if (!view) continue;
        const narrow = boardReader(boardTitle(s), view, 'candidates', false, w);
        expect(narrow.tabs.map((t) => t.id)).toEqual(['evidence', 'candidates', 'result']);
        expect((narrow.body.match(/tl-card-h/g) ?? []).length).toBe(view.candidates.length);
        expect(narrow.body).not.toContain('data-sec="evidence"');
        const wide = boardReader(boardTitle(s), view, 'candidates', true, w);
        expect(wide.tabs).toEqual([]);
        expect(wide.body).toContain('data-sec="evidence"');
        expect(textOf(wide.body), `${level.id} ฉาก ${st.order}`).not.toMatch(KEYBOARD_HINT_RE);
      }
    }
  });

  it('ข้อความในหน้าอ่านถูก escape (ไม่ฝัง HTML)', () => {
    expect(esc('<b>"x" & y</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
  });
});

describe('ปุ่มสัมผัสใหม่: ขยายแผนที่ · คำอธิบายสัญลักษณ์ · เมนูหยุดเกม', () => {
  const view = (zoomIndex: number, compareTab: 0 | 1 | 'text' = 0) => ({ zoomIndex, zoomLevels: 3, legend: true, compareTab });
  it('ขยาย/ย่อ กดไม่ได้เมื่อสุดทาง · เป็นคำสั่งแสดงผล (ไม่ส่งรหัสคีย์บอร์ด)', () => {
    const at = (i: number) => buildTouchContext(baseInput({ mode: 'map', view: view(i) })).actions;
    expect(at(0).find((a) => a.id === 'zoomOut')!.enabled).toBe(false);
    expect(at(2).find((a) => a.id === 'zoomIn')!.enabled).toBe(false);
    const legend = at(1).find((a) => a.id === 'legend')!;
    expect(legend).toMatchObject({ ui: 'map-legend', code: '', selected: true });
  });
  it('เปรียบเทียบแผนที่: ดูแผ่น → มีปุ่มขยาย/สัญลักษณ์ · หน้าหลักฐาน → ไม่มี', () => {
    const ids = (tab: 0 | 'text') => buildTouchContext(baseInput({ mode: 'compare', compareChoices: ['A', 'B'], view: view(1, tab) })).actions.map((a) => a.id);
    expect(ids(0)).toEqual(['zoomIn', 'zoomOut', 'legend', 'choice', 'choice', 'close']);
    expect(ids('text')).toEqual(['choice', 'choice', 'close']);
  });
  it('เมนูหยุดเกม: ปุ่มใหญ่ส่งเลขรายการ (คีย์บอร์ดกดเลขได้เช่นกัน)', () => {
    const ctx = buildTouchContext(
      baseInput({ mode: 'pause', pauseItems: [{ index: 0, label: 'เล่นต่อ', icon: '▶' }, { index: 3, label: 'กลับเมนูหลัก', icon: '🏠' }] }),
    );
    expect(ctx.sheet!.options.map((o) => o.code)).toEqual(['Digit1', 'Digit4']);
  });
});
