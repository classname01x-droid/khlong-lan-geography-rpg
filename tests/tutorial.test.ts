import { describe, expect, it } from 'vitest';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { ALL_LEVELS } from '../src/content/registry';
import { INTERACT_RADIUS_TILES } from '../src/config/constants';
import { pickInteraction } from '../src/core/input/Interaction';
import { PROGRESS_KEY, ProgressStore, type StorageLike } from '../src/core/progress/ProgressStore';
import {
  allTutorialText,
  newTutorialSave,
  parseTutorialSave,
  shouldRunTutorial,
  TUTORIAL_LEVEL_ID,
  TUTORIAL_MEASURE_METERS,
  TUTORIAL_NPC_ID,
  TUTORIAL_STEPS,
  TutorialRun,
  tutorialView,
  type TutorialInput,
} from '../src/core/tutorial/Tutorial';
import { LABEL_BASE, labelSizes } from '../src/core/ui/WorldLabels';
import { newSession, talk } from './helpers';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const base: TutorialInput = { mode: 'explore', totalMeters: 0, tripMeters: 0, nearNpc: false, talked: false, measured: false };

describe('บทแนะนำ: ทีละขั้นตามการกระทำจริงของผู้เล่น', () => {
  it('ลำดับ: เดิน → เข้าใกล้ครูเนม → คุย → สมุด → แผนที่ → วัดระยะ → เดินวัดระยะ → เริ่มภารกิจ', () => {
    expect(TUTORIAL_STEPS).toEqual(['move', 'approach', 'talk', 'notebook', 'map', 'measure', 'measure-walk', 'finish']);
    const t = new TutorialRun();
    t.update(base);
    expect(t.step).toBe('move');
    t.update({ ...base, totalMeters: 20 });
    expect(t.step).toBe('approach');
    t.update({ ...base, totalMeters: 30, nearNpc: true });
    expect(t.step).toBe('talk');
    // คุยแล้ว (บทสนทนาเปิด แล้วจบ)
    t.update({ ...base, mode: 'dialogue', totalMeters: 30, nearNpc: true });
    t.update({ ...base, totalMeters: 30, talked: true });
    expect(t.step).toBe('notebook');
    // เปิดสมุดแล้วปิด = ผ่าน
    t.update({ ...base, mode: 'notebook', talked: true });
    expect(t.step).toBe('notebook');
    t.update({ ...base, talked: true });
    expect(t.step).toBe('map');
    t.update({ ...base, mode: 'map', talked: true });
    t.update({ ...base, talked: true });
    expect(t.step).toBe('measure');
    t.update({ ...base, talked: true, measured: true, tripMeters: 0 });
    expect(t.step).toBe('measure-walk');
    t.update({ ...base, talked: true, measured: true, tripMeters: TUTORIAL_MEASURE_METERS - 1 });
    expect(t.step).toBe('measure-walk');
    t.update({ ...base, talked: true, measured: true, tripMeters: TUTORIAL_MEASURE_METERS });
    expect(t.step).toBe('finish');
    expect(t.active).toBe(true);
    // ขั้นสุดท้ายต้องแตะ "เริ่มภารกิจ" เอง
    expect(t.event('finish', { ...base, talked: true, measured: true, tripMeters: 40 })).toBe(true);
    expect(t.active).toBe(false);
    expect(t.save.status).toBe('done');
    expect(t.save.endedAt).toBeTruthy();
  });

  it('ทำอะไรก่อนก็ได้: ขั้นที่ทำไปแล้วผ่านเอง (บทแนะนำไม่กั้นเนื้อเรื่อง)', () => {
    const t = new TutorialRun();
    // เปิดแผนที่ก่อนคุย และกดวัดระยะไว้แล้ว
    t.update({ ...base, mode: 'map' });
    t.update({ ...base, measured: true, tripMeters: 50 });
    expect(t.step).toBe('move');
    t.update({ ...base, talked: true, measured: true, tripMeters: 50 });
    // ข้าม move/approach/talk (คุยแล้ว) → สมุด (ยังไม่เปิด) — แผนที่/วัดระยะถูกจดไว้แล้ว
    expect(t.step).toBe('notebook');
    t.update({ ...base, mode: 'notebook', talked: true, measured: true, tripMeters: 50 });
    t.update({ ...base, talked: true, measured: true, tripMeters: 50 });
    expect(t.step).toBe('finish');
  });

  it('ข้ามบทแนะนำ: สถานะ skipped และไม่มีขั้นค้าง', () => {
    const t = new TutorialRun();
    t.update(base);
    expect(t.skip()).toBe(true);
    expect(t.save.status).toBe('skipped');
    expect(t.step).toBeNull();
    expect(t.update({ ...base, talked: true })).toBe(false);
    expect(t.skip()).toBe(false);
  });

  it('ข้อความแต่ละขั้น: สั้น ภาษาไทย มีไฮไลต์ปุ่ม · จอสัมผัสบอกชื่อปุ่ม คอมพิวเตอร์บอกแป้น', () => {
    const t = new TutorialRun();
    const touch = tutorialView(t, base, true)!;
    expect(touch).toMatchObject({ step: 'move', index: 1, total: 8, highlight: 'joystick' });
    expect(touch.text).toContain('[จอยสติก]');
    expect(tutorialView(t, base, false)!.text).toContain('[W]');
    t.update({ ...base, totalMeters: 20, nearNpc: true });
    expect(tutorialView(t, base, true)).toMatchObject({ step: 'talk', highlight: 'interact' });
    expect(tutorialView(t, base, true)!.text).toContain('[คุย]');
    expect(tutorialView(t, base, false)!.text).toContain('[E]');
    // ระหว่างบทสนทนา: บอกวิธีอ่านต่อ
    expect(tutorialView(t, { ...base, mode: 'dialogue' }, true)).toMatchObject({ highlight: 'next' });
    // หน้าต่างอื่น (เช่น เมนูหยุดเกม): ไม่แสดง
    expect(tutorialView(t, { ...base, mode: 'pause' }, true)).toBeNull();
    for (const s of allTutorialText()) expect(s.length).toBeLessThan(90);
  });

  it('ขั้นวัดระยะแสดงความคืบหน้า และขั้นสุดท้ายมีปุ่มเริ่มภารกิจ', () => {
    const t = new TutorialRun({ status: 'active', done: TUTORIAL_STEPS.slice(0, 6), events: ['map', 'notebook'] });
    expect(tutorialView(t, { ...base, measured: true, tripMeters: 12.7 }, true)).toMatchObject({ step: 'measure-walk', progress: 'วัดได้ 12/30 ม.' });
    const f = new TutorialRun({ status: 'active', done: TUTORIAL_STEPS.slice(0, 7), events: ['map', 'notebook'] });
    expect(tutorialView(f, base, true)).toMatchObject({ step: 'finish', finishButton: true, highlight: 'tracker' });
  });

  it('ไม่เฉลย: ข้อความบทแนะนำไม่มีชื่อสถานที่ลับ ชื่อจุดคำตอบ ทิศ/ระยะของคำตอบ หรือคำตอบปริศนา', () => {
    const text = allTutorialText().join('\n');
    for (const L of ALL_LEVELS) {
      for (const lm of L.landmarks) if (lm.revealFlag) expect(text, `${L.id} ${lm.name}`).not.toContain(lm.name);
      if (L.pinTask && L.pinTask.targetId !== 'site-analysis') {
        const name = L.landmarks.find((l) => l.id === L.pinTask!.targetId)!.name;
        expect(text, name).not.toContain(name);
        expect(text).not.toContain(L.pinTask.wisdomChoices.find((c) => c.id === L.pinTask!.correctWisdomId)!.label);
      }
      const route = L.routeAnalysis?.routes.find((r) => r.id === L.routeAnalysis!.correctRouteId);
      if (route) expect(text).not.toContain(`เส้นทาง ${route.label}`);
      for (const q of L.quizzes ?? []) expect(text).not.toContain(q.choices.find((c) => c.id === q.correctChoiceId)!.label);
    }
    // ไม่บอกทิศของจุดหมาย (บอกได้เฉพาะ "เหนืออยู่ด้านบน" ซึ่งเป็นวิธีอ่านแผนที่)
    expect(text).not.toMatch(/ทิศ(ตะวันออก|ตะวันตก|ใต้)/);
    expect(text).not.toContain('ศาลาชุมชน');
  });
});

describe('บทแนะนำ: บันทึกใน ProgressStore (เข้ากันได้กับข้อมูลเดิม)', () => {
  it('ผู้เล่นใหม่ (ไม่มีบันทึก) เท่านั้นที่เริ่มบทแนะนำ และเฉพาะด่านแรก', () => {
    expect(shouldRunTutorial(TUTORIAL_LEVEL_ID, null, false)).toBe(true);
    expect(shouldRunTutorial('level-2', null, false)).toBe(false);
    // ข้อมูลรุ่นเก่าที่มีความคืบหน้าแล้ว = ผู้เล่นที่เคยเล่น → ไม่แสดง
    expect(shouldRunTutorial(TUTORIAL_LEVEL_ID, null, true)).toBe(false);
    expect(shouldRunTutorial(TUTORIAL_LEVEL_ID, newTutorialSave(), true)).toBe(true);
    expect(shouldRunTutorial(TUTORIAL_LEVEL_ID, { status: 'skipped', done: [], events: [] }, false)).toBe(false);
    expect(shouldRunTutorial(TUTORIAL_LEVEL_ID, { status: 'done', done: [...TUTORIAL_STEPS], events: [] }, true)).toBe(false);
  });

  it('บันทึก/โหลดสถานะบทแนะนำ โดยข้อมูลด่านเดิมไม่เปลี่ยน (version 2 เหมือนเดิม)', () => {
    const storage = new MemoryStorage();
    const p = new ProgressStore(storage, 'sakngam');
    expect(p.tutorialSave()).toBeNull();
    p.saveTutorial({ status: 'active', done: ['move', 'approach'], events: ['map'] });
    p.saveInProgress('sakngam', { x: 1 });
    const raw = JSON.parse(storage.getItem(PROGRESS_KEY)!);
    expect(raw.version).toBe(2);
    const again = new ProgressStore(storage, 'sakngam');
    expect(again.tutorialSave()).toEqual({ status: 'active', done: ['move', 'approach'], events: ['map'] });
    expect(again.loadInProgress('sakngam')).toEqual({ x: 1 });
    // เริ่มเกมใหม่ = เริ่มบทแนะนำใหม่ (มีปุ่มข้ามสำหรับผู้ที่เคยเล่น)
    again.resetAll();
    expect(again.tutorialSave()).toBeNull();
  });

  it('ข้อมูลรุ่นเก่า (ไม่มีช่อง tutorial) โหลดได้ครบ · ข้อมูลบทแนะนำเสีย → ไม่พัง', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 2, completed: {}, unlocked: ['sakngam'], codePieces: {}, inProgress: { sakngam: { a: 1 } }, lastLevelId: 'sakngam' }),
    );
    const p = new ProgressStore(storage, 'sakngam');
    expect(p.tutorialSave()).toBeNull();
    expect(p.continueLevelId()).toBe('sakngam');
    expect(shouldRunTutorial('sakngam', p.tutorialSave(), p.hasAnySave())).toBe(false);
    expect(parseTutorialSave({ status: 'weird' })).toBeNull();
    expect(parseTutorialSave({ status: 'active', done: ['move', 'bogus'], events: ['map', 'x'] })).toEqual({
      status: 'active',
      done: ['move'],
      events: ['map'],
    });
  });
});

describe('บทแนะนำใช้ข้อมูลจริงของด่านแรก', () => {
  it('ครูเนมเป็นผู้มอบภารกิจฉากที่ 1 และอยู่ใกล้จุดเกิด (เห็นได้ทันที ไม่ใช่ข้อมูลลับ)', () => {
    expect(L1.id).toBe(TUTORIAL_LEVEL_ID);
    expect(L1.story[0].completeWhen).toEqual({ type: 'talk', npcId: TUTORIAL_NPC_ID });
    const nem = L1.npcs.find((n) => n.id === TUTORIAL_NPC_ID)!;
    expect(Math.hypot(nem.at.x - L1.spawn.x, nem.at.y - L1.spawn.y)).toBeLessThanOrEqual(L1.fog.revealRadiusTiles);
  });

  it('เข้าใกล้ครูเนม → เป้าหมายโต้ตอบ = คุยกับครูเนม · คุยจบ → ผ่านฉาก 1 (talked)', () => {
    const s = newSession(L1);
    const nem = L1.npcs.find((n) => n.id === TUTORIAL_NPC_ID)!;
    s.playerTile = { x: nem.at.x + 1, y: nem.at.y + 1 };
    const target = pickInteraction(s, INTERACT_RADIUS_TILES);
    expect(target).toMatchObject({ kind: 'npc', id: TUTORIAL_NPC_ID, verb: 'คุย' });
    expect(s.currentStepOrder).toBe(1);
    talk(s, TUTORIAL_NPC_ID);
    expect(s.currentStepOrder).toBeGreaterThan(1);
  });
});

describe('ป้ายชื่อในโลกเกมอ่านได้บนโทรศัพท์', () => {
  it('คอมพิวเตอร์ (ภาพเกมเต็มขนาด) = ขนาดเดิม', () => {
    expect(labelSizes(3)).toEqual({ npc: LABEL_BASE.npc, landmark: LABEL_BASE.landmark, cue: LABEL_BASE.cue, marker: 1 });
    expect(labelSizes(4).npc).toBe(LABEL_BASE.npc);
  });

  it('โทรศัพท์: ขนาดบนจอไม่ต่ำกว่า ~14 px และมีเพดานไม่ให้บังฉาก', () => {
    for (const spw of [1.2, 1.5, 1.75, 2.2]) {
      const z = labelSizes(spw);
      expect(z.npc * spw, String(spw)).toBeGreaterThanOrEqual(13.5);
      expect(z.landmark * spw).toBeGreaterThanOrEqual(13.5);
      expect(z.cue * spw).toBeGreaterThanOrEqual(14.5);
      expect(z.marker).toBeGreaterThanOrEqual(1);
    }
    const tiny = labelSizes(0.5);
    expect(tiny.npc).toBeLessThanOrEqual(12);
    expect(tiny.marker).toBe(2);
  });

  it('ชื่อสถานที่ลับไม่ปรากฏก่อนค้นพบ: เปิดหมอกแล้วยังซ่อน จนกว่าจะได้ flag', () => {
    for (const L of ALL_LEVELS) {
      for (const lm of L.landmarks.filter((l) => l.revealFlag)) {
        const s = newSession(L);
        s.fog.reveal(lm.at.x, lm.at.y, 3);
        s.checkLandmarkDiscovery();
        expect(s.isLandmarkVisible(lm), `${L.id} ${lm.id}`).toBe(false);
        s.flags.add(lm.revealFlag!);
        expect(s.isLandmarkVisible(lm)).toBe(lm.showLabel);
      }
      // ชื่อ NPC ไม่บอกชื่อสถานที่ลับ (ป้ายชื่อ NPC แสดงตลอด)
      for (const lm of L.landmarks.filter((l) => l.revealFlag))
        for (const n of L.npcs) expect(n.name, `${L.id} ${n.id}`).not.toContain(lm.name);
    }
  });
});
