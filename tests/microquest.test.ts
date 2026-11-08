import { describe, expect, it } from 'vitest';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { ALL_LEVELS, LEVEL_SEQUENCE } from '../src/content/registry';
import { CHAPTERS, getChapterIntro } from '../src/content/story/chapters';
import { continueTarget, currentChapter } from '../src/core/campaign/Campaign';
import { buildQuestTracker, hintKey } from '../src/core/guide/QuestGuide';
import { currentMicro, microStates, phaseProgress } from '../src/core/guide/MicroQuest';
import { guideText } from '../src/core/guide/GuideText';
import { ProgressStore, type StorageLike } from '../src/core/progress/ProgressStore';
import type { SessionSnapshot } from '../src/core/session/GameSession';
import { chapterIntroView } from '../src/ui/views/screens';
import { explore, newSession, talk } from './helpers';

/** ผู้ใหญ่บ้าน: คำถามงานฝีมือ (ผ้าปัก = 1) และคำถามมาตราส่วน (ถูก = 2) */
const HEADMAN_OK = [1, 2];
const goal = (s: ReturnType<typeof newSession>) => currentMicro(s)?.step.goal;
const progress = (s: ReturnType<typeof newSession>) => {
  const ms = microStates(s);
  return `${ms.filter((m) => m.done).length}/${ms.length}`;
};
const spot = () => L1.inspectPoints!.find((p) => p.id === 'old-banyan-spot')!;

class Mem implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('บทที่ 1: ขั้นย่อยแบบนำทางด้วยการกระทำ (ช่วงรับภารกิจ 3 ขั้น + ช่วงตามหาแหล่งผ้าปัก 13 ขั้น)', () => {
  it('ลำดับขั้น: ครูเนม → ศาลา → คำถาม | ป้าศรี → ลุงคำ → สมุด → วัดระยะ → เปิดกระดาน → เลือกเส้นทาง → ออกสำรวจ → ค้นพบ → ช่างผ้าปัก → ปักหมุด → ปริศนา', () => {
    const s = newSession();
    const ms = microStates(s);
    expect(ms.map((m) => m.step.id)).toEqual([
      'talk-nem', 'go-sala', 'quiz-wisdom',
      'go-sri', 'talk-sri', 'go-kham', 'talk-kham', 'read-clues', 'start-measure', 'open-routes', 'choose-route',
      'travel', 'find-place', 'talk-nuan', 'pin', 'read-riddle', 'measure-riddle', 'find-cloth',
    ]);
    // เลขขั้นในแต่ละช่วง: ช่วงที่ 1 = 1–3 · ช่วงที่ 2 = 1–13 (ปริศนาสุดท้ายมี 3 ขั้นย่อยในขั้นที่ 13)
    expect(ms.filter((m) => m.phase === 'prep').map((m) => m.num)).toEqual([1, 2, 3]);
    expect(ms.filter((m) => m.phase === 'main').map((m) => m.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13, 13]);
    expect(ms.find((m) => m.step.id === 'find-cloth')).toMatchObject({ num: 13, part: 3, parts: 3 });
    expect(goal(s)).toBe('ไปคุยกับครูเนม');
    expect(phaseProgress(ms)).toEqual({ phase: 'prep', done: 0, total: 3 });
  });

  it('เปลี่ยนเป้าหมายตามการกระทำจริง: เดินถึง → คุย → สมุด → วัดระยะ → เปิดกระดาน → เลือก → ออกสำรวจ → ค้นพบ → ช่างผ้าปัก → ปักหมุด → ปริศนา', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    expect(goal(s)).toBe('ไปพบผู้ใหญ่บ้านที่ศาลาชุมชน');
    expect(buildQuestTracker(s).doneText).toBe('✓ รับภารกิจสำเร็จ!');
    talk(s, 'headman', HEADMAN_OK);
    expect(goal(s)).toBe('ไปพบป้าศรี');
    let t = buildQuestTracker(s);
    expect(t.phaseTitle).toBe('ช่วงที่ 2 · ตามหาแหล่งผ้าปัก');
    expect(t.progress).toEqual({ done: 0, total: 13, label: 'ขั้น' });
    expect(t.target).toMatchObject({ kind: 'npc', id: 'villager-sri', name: 'ป้าศรี' });
    // เดินเข้าใกล้ป้าศรี (≤ 4 ช่อง) → ขั้น "ไปพบ" สำเร็จ (จด flag near:...)
    expect(s.notePlayerNear({ x: 50, y: 40 })).toBe(false);
    expect(s.notePlayerNear({ x: 60, y: 33 })).toBe(true);
    expect(s.flags.has('near:villager-sri')).toBe(true);
    expect(goal(s)).toBe('คุยกับป้าศรี');
    talk(s, 'villager-sri');
    expect(goal(s)).toBe('ไปพบลุงคำ');
    expect(buildQuestTracker(s).target?.id).toBe('fisher-kham');
    talk(s, 'fisher-kham'); // คุยเลย (นับ "ไปพบ" ให้ด้วย)
    expect(goal(s)).toBe('เปิดสมุดภาคสนาม อ่านเบาะแส');
    t = buildQuestTracker(s);
    expect(t.progress.done).toBe(4);
    expect(t.action).toEqual({ id: 'clues', label: '📒 เปิดสมุด หน้าเบาะแส' });
    s.notebookTab = 'clues';
    s.markNotebookViewed();
    expect(goal(s)).toBe('เริ่มวัดระยะจากศาลาชุมชน');
    expect(buildQuestTracker(s).action?.label).toBe('📏 วัดจากศาลา');
    const m = s.startMeasure();
    expect(m).toMatchObject({ originId: 'sala', label: 'ศาลาชุมชน', allowReset: false });
    expect(goal(s)).toBe('เปิดกระดานวิเคราะห์เส้นทาง');
    expect(buildQuestTracker(s).action?.id).toBe('routes');
    s.noteSkill('straight-vs-route'); // เปิดหน้าวิเคราะห์เส้นทาง
    expect(goal(s)).toBe('เลือกเส้นทางที่ตรงกับข้อมูล');
    expect(s.chooseRoute(0).ok).toBe(false); // ตอบผิด → ยังอยู่ขั้นเดิม
    expect(goal(s)).toBe('เลือกเส้นทางที่ตรงกับข้อมูล');
    s.chooseRoute(1);
    expect(goal(s)).toBe('ออกสำรวจตามเส้นทางที่เลือก');
    explore(s, 'wood-bridge');
    expect(goal(s)).toBe('ค้นหาแหล่งผ้าปัก');
    // ระหว่างเดินทางยังวัดจากศาลา (ไม่เปลี่ยนจุดเริ่มวัด)
    expect(s.measure?.originId).toBe('sala');
    expect(buildQuestTracker(s).target).toBeNull(); // ไม่นำทางไปบ้านผ้าปัก
    explore(s, 'nai-chiao');
    expect(goal(s)).toBe('คุยกับช่างผ้าปัก (ป้านวล)');
    expect(buildQuestTracker(s).target?.id).toBe('embroiderer-nuan'); // ค้นพบเองแล้ว จึงนำทางไปหาป้านวลได้
    talk(s, 'embroiderer-nuan');
    expect(goal(s)).toBe('ปักหมุดแหล่งผ้าปักบนแผนที่');
    expect(s.submitPin({ x: 70, y: 13 }, 1).ok).toBe(true);
    expect(goal(s)).toBe('อ่านปริศนาลายผ้าผืนแรก');
    s.notebookTab = 'clues';
    s.markNotebookViewed();
    expect(goal(s)).toBe('เริ่มวัดระยะจากบ้านไหนเจียว');
    const r = s.startMeasure();
    expect(r).toMatchObject({ originId: 'nai-chiao', allowReset: true });
    expect(goal(s)).toBe('เดินตามปริศนา แล้วสำรวจจุดซ่อน');
    expect(phaseProgress(microStates(s))).toEqual({ phase: 'main', done: 12, total: 13 });
  });

  it('ทำก่อนลำดับ: คุยลุงคำก่อนป้าศรี / เปิดกระดานก่อนอ่านสมุด — ขั้นที่ทำแล้วนับให้ ไม่ต้องย้อนทำ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'fisher-kham');
    expect(goal(s)).toBe('ไปพบป้าศรี'); // ป้าศรียังต้องไปพบ (ข้อมูลทางแยก)
    expect(phaseProgress(microStates(s)).done).toBe(2);
    talk(s, 'villager-sri');
    expect(goal(s)).toBe('เปิดสมุดภาคสนาม อ่านเบาะแส');
    s.noteSkill('straight-vs-route'); // ไปหน้าวิเคราะห์เลย
    // อ่านสมุดนับให้แล้ว (กระดานแสดงเบาะแสเดียวกัน) แต่การวัดระยะจากศาลายังต้องทำ
    expect(microStates(s).find((m) => m.step.id === 'read-clues')!.done).toBe(true);
    expect(goal(s)).toBe('เริ่มวัดระยะจากศาลาชุมชน');
    s.startMeasure();
    expect(goal(s)).toBe('เลือกเส้นทางที่ตรงกับข้อมูล');
  });

  it('เลือกเส้นทางถูกก่อนทำขั้นอื่น → ไม่ติดค้าง ขั้นของฉากที่ผ่านแล้วนับว่าสำเร็จ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'fisher-kham');
    s.chooseRoute(1);
    expect(goal(s)).toBe('ออกสำรวจตามเส้นทางที่เลือก');
    expect(microStates(s).filter((m) => m.storyOrder <= 4).every((m) => m.done)).toBe(true);
  });

  it('ไขปริศนาก่อนปักหมุด → ขั้นปริศนานับแล้ว ปักหมุดถูกแล้วได้รหัสทันที', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'fisher-kham');
    s.chooseRoute(1);
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    explore(s, 'old-banyan');
    s.inspect(spot());
    while (s.inDialogue) s.advanceDialogue();
    expect(goal(s)).toBe('ปักหมุดแหล่งผ้าปักบนแผนที่');
    expect(microStates(s).filter((m) => m.storyOrder === 7).every((m) => m.done)).toBe(true);
    expect(s.completed).toBe(false);
    s.submitPin({ x: 70, y: 13 }, 1);
    expect(s.startEnding()).toBe(true);
  });

  it('ได้รหัส "ลาย" เฉพาะเมื่อ ปักหมุดถูก + ไขปริศนาเอง — คุยกับ NPC หรือเดินถึงจุดเดียวไม่พอ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'fisher-kham');
    s.chooseRoute(1);
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    explore(s, 'old-banyan'); // เดินถึงจุด (ยังไม่ตรวจค้น)
    expect(s.startEnding()).toBe(false);
    s.submitPin({ x: 70, y: 13 }, 1);
    expect(s.startEnding()).toBe(false); // ปักหมุดอย่างเดียว ยังไม่ได้
    s.inspect(spot());
    while (s.inDialogue) s.advanceDialogue();
    expect(s.completed).toBe(true);
    expect(s.messages.some((m) => m.text.includes('"ลาย"'))).toBe(true);
  });

  it('โหลดกลางภารกิจ: snapshot เดิม → ขั้นเดิม ความคืบหน้าเดิม (ไม่มีข้อมูลบันทึกเพิ่ม)', () => {
    const a = newSession();
    talk(a, 'teacher-nem');
    talk(a, 'headman', HEADMAN_OK);
    a.notePlayerNear({ x: 58, y: 33 });
    talk(a, 'villager-sri');
    a.notePlayerNear({ x: 34, y: 45 }); // ถึงลุงคำแล้ว แต่ยังไม่คุย
    const snap = JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot;
    // รูปแบบบันทึกเดิม: ไม่มีช่องใหม่ (ขั้นย่อยคำนวณจาก flags/เบาะแส/ทักษะที่บันทึกอยู่แล้ว)
    const KNOWN = ['version', 'levelId', 'contentVersion', 'flags', 'clues', 'evidence', 'mistakes', 'skills', 'firedTriggers', 'seenVariants',
      'talkedTo', 'messages', 'quests', 'fog', 'totalMeters', 'elapsedMs', 'player', 'pinnedAt', 'completed', 'gridAttempts'];
    for (const k of Object.keys(a.toSnapshot())) expect(KNOWN, k).toContain(k);
    const b = newSession();
    expect(b.restore(snap)).toBe(true);
    expect(goal(b)).toBe(goal(a));
    expect(goal(b)).toBe('คุยกับลุงคำ');
    expect(progress(b)).toBe(progress(a));
  });

  it('โหลดกลางการวัดระยะ: เริ่มวัดจากศาลาแล้วออกจากเกม → กลับมายังวัดจากศาลาต่อ (จาก flag เดิม ไม่มีข้อมูลบันทึกเพิ่ม)', () => {
    const a = newSession();
    talk(a, 'teacher-nem');
    talk(a, 'headman', HEADMAN_OK);
    talk(a, 'villager-sri');
    talk(a, 'fisher-kham');
    a.notebookTab = 'clues';
    a.markNotebookViewed();
    a.startMeasure();
    const snap = JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot;
    expect(snap.flags).toContain('measured:sala');
    const b = newSession();
    expect(b.restore(snap)).toBe(true);
    expect(b.measure?.originId).toBe('sala');
    expect(goal(b)).toBe('เปิดกระดานวิเคราะห์เส้นทาง');
    // ไม่มีเบาะแสซ้ำหลังโหลด
    expect(new Set(b.clues).size).toBe(b.clues.length);
  });

  it('บันทึกเก่า (v0.16: ฉาก 6 = ปักหมุดแล้วจบ) → โหลดได้ ไม่ติด — ปักหมุดแล้วต่อด้วยปริศนาที่ทำได้จริง', () => {
    // จำลองบันทึกกลางด่านจากรุ่นก่อน: ผ่านฉาก 5 แล้ว (ได้เบาะแสลายผ้าผืนแรกจากป้านวล) ยังไม่ปักหมุด
    const a = newSession();
    talk(a, 'teacher-nem');
    talk(a, 'headman', HEADMAN_OK);
    talk(a, 'fisher-kham');
    a.chooseRoute(1);
    explore(a, 'nai-chiao');
    talk(a, 'embroiderer-nuan');
    const old = JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot;
    const b = newSession();
    expect(b.restore(old)).toBe(true);
    expect(goal(b)).toBe('ปักหมุดแหล่งผ้าปักบนแผนที่');
    b.submitPin({ x: 70, y: 13 }, 1);
    expect(b.inspectPointAt({ x: 40, y: 13 })).toBeDefined(); // ปริศนายังเปิดให้ทำ
    expect(b.currentStepOrder).toBe(7);
  });

  it('ระดับคำแนะนำเริ่มใหม่ทุกครั้งที่ขั้นเปลี่ยน · ระดับ 1 วิธีทำ (แสดงตลอด) → 2 เครื่องมือ → 3 คำถามช่วยคิด', () => {
    const s = newSession();
    const k0 = hintKey(s);
    talk(s, 'teacher-nem');
    expect(hintKey(s)).not.toBe(k0);
    const m = currentMicro(s)!.step;
    const t0 = buildQuestTracker(s, { hintTier: 0 });
    expect(t0.hint).toBeNull();
    expect(t0.steps.length).toBe(m.steps.length);
    expect(buildQuestTracker(s, { hintTier: 1 }).hint).toBe(guideText(s.resolveText(m.tool), { touch: false, guideLabel: t0.action?.label }));
    expect(buildQuestTracker(s, { hintTier: 2 }).hint).toBe(guideText(s.resolveText(m.think), { touch: false }));
  });

  it('ไม่เฉลย: ทุกขั้นทุกระดับไม่มีชื่อสถานที่ลับ เส้นทางที่ถูก คำตอบปริศนา หรือทิศของจุดซ่อน', () => {
    const secret = L1.landmarks.filter((l) => l.revealFlag).map((l) => l.name);
    const route = L1.routeAnalysis!.routes.find((r) => r.id === L1.routeAnalysis!.correctRouteId)!;
    const pinName = L1.landmarks.find((l) => l.id === L1.pinTask!.targetId)!.name;
    const pinOrder = L1.story.find((st) => st.completeWhen?.type === 'flag' && st.completeWhen.flag === L1.pinTask!.successFlag)!.order;
    for (const st of L1.story)
      for (const m of st.micro ?? []) {
        const text = [m.goal, ...m.steps, m.result, m.tool, m.think, m.doneText ?? ''].join(' ');
        for (const n of secret) expect(text, m.id).not.toContain(n);
        expect(text, m.id).not.toContain(`เส้นทาง ${route.label}`);
        expect(text, m.id).not.toContain(route.description);
        // ชื่อแหล่งผ้าปักใช้ได้เฉพาะหลังปักหมุดแล้ว (เป็นจุดเริ่มของปริศนา)
        if (st.order <= pinOrder) expect(text, m.id).not.toContain(pinName);
        expect(text, m.id).not.toMatch(/ทิศตะวันตก|ต้นไม้ใหญ่|300 เมตร|30 ช่อง/);
        // ไม่นำทางไปบ้านผ้าปักหรือจุดลับ
        expect(m.target?.landmarkId, m.id).not.toBe('nai-chiao');
      }
    const quizStep = L1.story[2].micro![0];
    expect([quizStep.goal, ...quizStep.steps, quizStep.result, quizStep.tool, quizStep.think].join(' ')).not.toContain('ผ้าปัก');
  });

  it('คำแนะนำอ้างอิงข้อมูลที่ผู้เล่นได้แล้วเท่านั้น: ลุงคำ/ป้าศรีถูกพูดถึงหลังผู้ใหญ่บ้านบอกเท่านั้น', () => {
    const headman = L1.npcs.find((n) => n.id === 'headman')!;
    const told = headman.dialogue.flatMap((v) => v.nodes).map((n) => ('text' in n ? n.text : '')).join(' ');
    expect(told).toContain('ลุงคำที่ริมลำห้วย');
    expect(told).toContain('ป้าศรีที่ต้นสักใหญ่');
    // ขั้นลุงคำ/ป้าศรีอยู่หลังผู้ใหญ่บ้าน (ฉาก 4)
    const order = (id: string) => L1.story.find((st) => st.micro?.some((m) => m.id === id))!.order;
    expect(order('talk-kham')).toBeGreaterThan(order('quiz-wisdom'));
    expect(order('talk-sri')).toBeGreaterThan(order('quiz-wisdom'));
    // ผู้ใหญ่บ้านบอกให้ไปหาป้าศรีก่อน แล้วจึงลุงคำ (ตรงกับลำดับขั้น)
    expect(told.indexOf('ป้าศรี')).toBeLessThan(told.indexOf('ลุงคำ'));
  });

  it('แผนที่: ศาลาชุมชนแสดงได้หลังครูเนมบอก (ก่อนไปถึง) · สถานที่ลับไม่แสดงจนค้นพบและเปิดเผย', () => {
    const s = newSession();
    const sala = L1.landmarks.find((l) => l.id === 'sala')!;
    const secret = L1.landmarks.find((l) => l.revealFlag)!;
    expect(s.isLandmarkOnMap(sala)).toBe(false);
    talk(s, 'teacher-nem');
    expect(s.isLandmarkVisible(sala)).toBe(false);
    expect(s.isLandmarkOnMap(sala)).toBe(true);
    for (const L of ALL_LEVELS) for (const lm of L.landmarks) if (lm.revealFlag) expect(lm.knownWhen, `${L.id} ${lm.id}`).toBeUndefined();
    explore(s, secret.id);
    expect(s.isLandmarkOnMap(secret)).toBe(false);
  });
});

describe('เรื่องหีบสมบัติเชื่อมทุกบท', () => {
  it('ฉากเปิดบทที่ 1 แสดงหีบ ช่องรหัส 4 ช่องที่ยังว่าง และหมายเหตุว่าเป็นเรื่องแต่ง', () => {
    const p = new ProgressStore(new Mem(), 'sakngam');
    const v = chapterIntroView('sakngam', p.data)!;
    expect(v.chest).toEqual({ slots: ['?', '?', '?', '?'], note: expect.stringContaining('เรื่องแต่ง') });
    expect(v.goal).toContain('หีบ');
  });

  it('จบบทที่ 1 → บทปัจจุบันเป็นบทที่ 2 · ช่องรหัสบนหีบมี "ลาย" · ครูเนมบอกเหลืออีก 3 ชิ้น', () => {
    const p = new ProgressStore(new Mem(), 'sakngam');
    p.completeLevel(
      {
        levelId: 'sakngam',
        completedAt: 'x',
        distanceMeters: 1,
        cluesFound: 1,
        cluesTotal: 1,
        mistakes: 0,
        elapsedMs: 1,
        skills: [],
        codePiece: L1.ending!.codePiece!,
      },
      'level-2',
    );
    expect(currentChapter(CHAPTERS, p.data).id).toBe('level-2');
    const next = continueTarget(CHAPTERS, p.data);
    expect(next.kind === 'begin' && next.chapter.id).toBe('level-2');
    const v = chapterIntroView('level-2', p.data)!;
    expect(v.chest!.slots).toEqual(['ลาย', '?', '?', '?']);
    expect(v.lines[0].text).toContain('"ลาย"');
    expect(v.lines[0].text).toContain('เหลืออีก 3 ชิ้น');
    expect(LEVEL_SEQUENCE[0].id).toBe('sakngam');
    expect(getChapterIntro('finale')!.lines.some((l) => l.text.includes('หีบ'))).toBe(true);
  });
});
