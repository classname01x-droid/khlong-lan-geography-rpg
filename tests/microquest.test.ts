import { describe, expect, it } from 'vitest';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { ALL_LEVELS, LEVEL_SEQUENCE } from '../src/content/registry';
import { CHAPTERS, getChapterIntro } from '../src/content/story/chapters';
import { continueTarget, currentChapter } from '../src/core/campaign/Campaign';
import { buildQuestTracker, hintKey } from '../src/core/guide/QuestGuide';
import { currentMicro, microStates } from '../src/core/guide/MicroQuest';
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

describe('บทที่ 1: Micro-Quest ทีละขั้น (คำนวณจากสถานะจริงของเกม)', () => {
  it('มี 13 ขั้นตามลำดับเรื่อง: ครูเนม → ศาลา → ผู้ใหญ่บ้าน → ลุงคำ → ป้าศรี → สมุด → วิเคราะห์ → เลือกเส้นทาง → บ้านผ้าปัก → ช่างผ้าปัก → ปักหมุด → ปริศนา → ตรวจค้น', () => {
    const s = newSession();
    expect(microStates(s).map((m) => m.step.id)).toEqual([
      'talk-nem', 'go-sala', 'quiz-wisdom', 'talk-kham', 'talk-sri', 'read-clues', 'open-routes', 'choose-route',
      'travel', 'talk-nuan', 'pin', 'read-riddle', 'find-cloth',
    ]);
    expect(goal(s)).toBe('ไปคุยกับครูเนม');
    expect(progress(s)).toBe('0/13');
  });

  it('เปลี่ยนขั้นอัตโนมัติตามการกระทำจริง และข้อความ "✓ ..." ของขั้นที่เพิ่งสำเร็จ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    expect(goal(s)).toBe('ไปพบผู้ใหญ่บ้านที่ศาลาชุมชน');
    expect(buildQuestTracker(s).doneText).toBe('✓ รับภารกิจสำเร็จ!');
    talk(s, 'headman', HEADMAN_OK);
    expect(goal(s)).toBe('ไปคุยกับลุงคำ');
    expect(progress(s)).toBe('3/13');
    talk(s, 'fisher-kham');
    expect(goal(s)).toBe('ไปคุยกับป้าศรี');
    talk(s, 'villager-sri');
    expect(goal(s)).toBe('เปิดสมุดอ่านข้อมูลที่ได้มา');
    // เปิดสมุด: หน้าเบาะแสถูกอ่าน → flag read:<เบาะแส> (อยู่ใน flags เดิม)
    s.notebookTab = 'clues';
    s.markNotebookViewed();
    expect(s.flags.has('read:clue-bridge')).toBe(true);
    expect(goal(s)).toBe('เปิดหน้าวิเคราะห์เส้นทาง');
    s.noteSkill('straight-vs-route');
    expect(goal(s)).toBe('เลือกเส้นทางที่ตรงกับข้อมูล');
    s.chooseRoute(1);
    expect(goal(s)).toBe('ออกเดินทางตามเส้นทางที่วิเคราะห์');
    explore(s, 'nai-chiao');
    expect(goal(s)).toBe('พูดคุยกับช่างผ้าปัก');
    expect(buildQuestTracker(s).doneText).toBe('✓ พบแหล่งผ้าปักแล้ว!');
    talk(s, 'embroiderer-nuan');
    expect(goal(s)).toBe('เปิดแผนที่และปักหมุดบ้านผ้าปัก');
    expect(s.submitPin({ x: 70, y: 13 }, 1).ok).toBe(true);
    expect(goal(s)).toBe('อ่านปริศนาลายผ้าผืนแรกในสมุด');
    s.notebookTab = 'clues';
    s.markNotebookViewed();
    expect(goal(s)).toBe('ใช้มาตราส่วนหาจุดซ่อน แล้วตรวจค้น');
    expect(progress(s)).toBe('12/13');
  });

  it('ทำก่อนลำดับ: คุยป้าศรีก่อนลุงคำ / เปิดหน้าวิเคราะห์ก่อนอ่านเบาะแส — ขั้นที่ทำแล้วนับให้ ไม่ต้องย้อนทำ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'villager-sri');
    expect(goal(s)).toBe('ไปคุยกับลุงคำ'); // ลุงคำยังจำเป็น (ข้อมูลสะพานใช้เลือกเส้นทาง)
    expect(progress(s)).toBe('4/13');
    talk(s, 'fisher-kham');
    expect(goal(s)).toBe('เปิดสมุดอ่านข้อมูลที่ได้มา');
    s.noteSkill('straight-vs-route'); // ไปหน้าวิเคราะห์เลย
    expect(goal(s)).toBe('เลือกเส้นทางที่ตรงกับข้อมูล');
    expect(microStates(s).find((m) => m.step.id === 'read-clues')!.done).toBe(true);
  });

  it('ไม่ได้คุยป้าศรีเลยแต่เลือกเส้นทางถูก (ข้อมูลป้าศรีเป็นตัวช่วย) → ไม่ติดค้าง ขั้นของฉากที่ผ่านแล้วนับว่าสำเร็จ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'fisher-kham');
    s.chooseRoute(1);
    expect(goal(s)).toBe('ออกเดินทางตามเส้นทางที่วิเคราะห์');
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
    expect(goal(s)).toBe('เปิดแผนที่และปักหมุดบ้านผ้าปัก');
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
    talk(a, 'villager-sri');
    const snap = JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot;
    // รูปแบบบันทึกเดิม: ไม่มีช่องใหม่ (ขั้นย่อยคำนวณจาก flags/เบาะแส/ทักษะที่บันทึกอยู่แล้ว)
    const KNOWN = ['version', 'levelId', 'contentVersion', 'flags', 'clues', 'evidence', 'mistakes', 'skills', 'firedTriggers', 'seenVariants',
      'talkedTo', 'messages', 'quests', 'fog', 'totalMeters', 'elapsedMs', 'player', 'pinnedAt', 'completed', 'gridAttempts'];
    for (const k of Object.keys(a.toSnapshot())) expect(KNOWN, k).toContain(k);
    const b = newSession();
    expect(b.restore(snap)).toBe(true);
    expect(goal(b)).toBe(goal(a));
    expect(progress(b)).toBe(progress(a));
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
    expect(goal(b)).toBe('เปิดแผนที่และปักหมุดบ้านผ้าปัก');
    b.submitPin({ x: 70, y: 13 }, 1);
    expect(b.inspectPointAt({ x: 40, y: 13 })).toBeDefined(); // ปริศนายังเปิดให้ทำ
    expect(b.currentStepOrder).toBe(7);
  });

  it('ระดับคำแนะนำเริ่มใหม่ทุกครั้งที่ขั้นเปลี่ยน · ระดับ 1 วิธีทำ → 2 เครื่องมือ → 3 คำถามช่วยคิด', () => {
    const s = newSession();
    const k0 = hintKey(s);
    talk(s, 'teacher-nem');
    expect(hintKey(s)).not.toBe(k0);
    const m = currentMicro(s)!.step;
    expect(buildQuestTracker(s, { hintTier: 0 }).hint).toBe(m.how);
    expect(buildQuestTracker(s, { hintTier: 1 }).hint).toBe(m.tool);
    expect(buildQuestTracker(s, { hintTier: 2 }).hint).toBe(m.think);
  });

  it('ไม่เฉลย: ทุกขั้นทุกระดับไม่มีชื่อสถานที่ลับ เส้นทางที่ถูก คำตอบปริศนา หรือทิศของจุดซ่อน', () => {
    const secret = L1.landmarks.filter((l) => l.revealFlag).map((l) => l.name);
    const route = L1.routeAnalysis!.routes.find((r) => r.id === L1.routeAnalysis!.correctRouteId)!;
    const pinName = L1.landmarks.find((l) => l.id === L1.pinTask!.targetId)!.name;
    for (const st of L1.story)
      for (const m of st.micro ?? []) {
        const text = [m.goal, m.how, m.tool, m.think, m.doneText ?? ''].join(' ');
        for (const n of secret) expect(text, m.id).not.toContain(n);
        expect(text, m.id).not.toContain(`เส้นทาง ${route.label}`);
        expect(text, m.id).not.toContain(route.description);
        expect(text, m.id).not.toContain(pinName);
        expect(text, m.id).not.toMatch(/ทิศตะวันตก|ต้นไม้ใหญ่|300 เมตร|30 ช่อง/);
      }
    const quizStep = L1.story[2].micro![0];
    expect([quizStep.goal, quizStep.how, quizStep.tool, quizStep.think].join(' ')).not.toContain('ผ้าปัก');
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
