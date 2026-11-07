import { describe, expect, it } from 'vitest';
import { explore, newSession, runDialogue, talk } from './helpers';

const EMBROIDERY = 1; // ลำดับตัวเลือก: 0 จักสาน, 1 ผ้าปัก, 2 ดินเผา
const SCALE_OK = 2; // คำถามมาตราส่วน: 0 = ×10, 1 = ×0.1, 2 = ระยะจริง
const HEADMAN_OK = [EMBROIDERY, SCALE_OK];

describe('ฉาก 1–2: รับภารกิจ และเดินทางไปศาลา', () => {
  it('เริ่มที่ฉาก 1 และผ่านเมื่อคุยกับครูเนม พร้อมได้เบาะแสแรก', () => {
    const s = newSession();
    expect(s.currentStepOrder).toBe(1);
    talk(s, 'teacher-nem');
    expect(s.currentStepOrder).toBe(2);
    expect(s.clues).toEqual(['clue-sala']);
  });

  it('ผู้ใหญ่บ้านเปิดบทสนทนาอัตโนมัติเมื่อมาถึงศาลา (เฉพาะฉาก 2)', () => {
    const s = newSession();
    const plaza = { x: 46, y: 46 };
    expect(s.triggerAt(plaza)).toBeUndefined();
    talk(s, 'teacher-nem');
    expect(s.triggerAt(plaza)?.npcId).toBe('headman');
    expect(s.triggerAt({ x: 14, y: 43 })).toBeUndefined();
  });

  it('คุยกับผู้ใหญ่บ้านก่อนพบครู ได้แค่คำแนะนำ ไม่ข้ามฉาก', () => {
    const s = newSession();
    talk(s, 'headman');
    expect(s.currentStepOrder).toBe(1);
    expect(s.flags.has('met-headman')).toBe(false);
  });
});

describe('ฉาก 3: ปริศนาผู้ใหญ่บ้าน (เลือกตอบ)', () => {
  it('ตอบผิดได้คำใบ้และลองใหม่ ตอบถูกจึงได้เบาะแส', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    s.talkTo(s.level.npcs.find((n) => n.id === 'headman')!);
    expect(s.flags.has('met-headman')).toBe(true);
    s.advanceDialogue(); // ทักทาย → เรื่องหีบ
    s.advanceDialogue(); // → รหัสชิ้นแรกเกี่ยวกับภูมิปัญญา
    s.advanceDialogue(); // → ลักษณะงานฝีมือ
    s.advanceDialogue(); // → คำถาม
    const quiz = s.dialogueView!;
    expect(quiz.kind).toBe('quiz');
    if (quiz.kind !== 'quiz') return;
    expect(quiz.choices).toEqual(['งานจักสาน', 'ผ้าปัก', 'เครื่องปั้นดินเผา']);

    expect(s.answerQuiz(0)).toBe(false);
    const after1 = s.dialogueView!;
    expect(after1.kind === 'quiz' && after1.feedback).toContain('ฝีเข็ม');
    expect(s.answerQuiz(2)).toBe(false);
    const after2 = s.dialogueView!;
    expect(after2.kind === 'quiz' && after2.feedback).toContain('ผืนผ้า');
    expect(s.mistakes.quiz).toBe(2);
    expect(s.clues).not.toContain('clue-direction');

    expect(s.answerQuiz(EMBROIDERY)).toBe(true);
    expect(s.dialogueView!.kind).toBe('line');
    runDialogue(s, [SCALE_OK]);
    expect(s.flags.has('quiz-wisdom')).toBe(true);
    expect(s.clues).toEqual(['clue-sala', 'clue-direction', 'clue-distance']);
    expect(s.currentStepOrder).toBe(4);
  });
});

describe('ฉาก 4: รวบรวมเบาะแส และเลือกเส้นทาง', () => {
  function atStep4() {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    return s;
  }

  it('ต้องมีเบาะแสครบ 3 ประเภทก่อนเลือกเส้นทาง (ไม่นับเป็นการตอบผิด)', () => {
    const s = atStep4();
    expect(s.requiredClueStatus().map((x) => [x.clue.type, x.collected])).toEqual([
      ['direction', true],
      ['distance', true],
      ['landmark', false],
    ]);
    expect(s.canChooseRoute()).toBe(false);
    expect(s.chooseRoute(1)).toMatchObject({ ok: false, blocked: 'missing-clues' });
    expect(s.mistakes.route).toBe(0);
  });

  it('เบาะแสเก็บในสมุดภาคสนามไม่ซ้ำ และนับครบตามที่พบ', () => {
    const s = atStep4();
    talk(s, 'fisher-kham');
    talk(s, 'fisher-kham');
    talk(s, 'villager-sri');
    expect(s.clues).toEqual(['clue-sala', 'clue-direction', 'clue-distance', 'clue-bridge', 'clue-fork']);
    expect(s.summary().cluesFound).toBe(5);
    expect(s.summary().cluesTotal).toBe(6); // + เบาะแสภารกิจปริศนา
  });

  it('เลือกเส้นทางหลอกนับเป็นการตอบผิด และบอกหลักฐานที่ไม่ตรง', () => {
    const s = atStep4();
    talk(s, 'fisher-kham');
    expect(s.canChooseRoute()).toBe(true);
    expect(s.chooseRoute(2)).toEqual({ ok: false, failed: ['landmark'] });
    expect(s.chooseRoute(0)).toEqual({ ok: false, failed: ['direction', 'distance', 'landmark'] });
    expect(s.mistakes.route).toBe(2);
    expect(s.chooseRoute(1)).toEqual({ ok: true, failed: [] });
    expect(s.currentStepOrder).toBe(5);
    expect(s.chooseRoute(1).blocked).toBe('already-solved');
  });
});

describe('ฉาก 5–6: สำรวจผ้าปัก ปักหมุด และจบภารกิจ', () => {
  function atStep5() {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'fisher-kham');
    s.chooseRoute(1);
    return s;
  }
  const target = { x: 70, y: 13 };
  const PIN_EMBROIDERY = 1;

  it('ช่างผ้าปักยังไม่ให้หลักฐานถ้ายังไม่ได้วิเคราะห์เส้นทาง', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'embroiderer-nuan');
    expect(s.evidence).toEqual([]);
  });

  it('ตรวจพิกัด: ปักในพื้นที่ที่ยังไม่สำรวจไม่ได้', () => {
    const s = atStep5();
    expect(s.isPinAvailable()).toBe(true);
    const r = s.submitPin(target, PIN_EMBROIDERY);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(['unexplored', 'evidence']);
    expect(s.mistakes.pin).toBe(1);
  });

  it('ตรวจหลักฐาน: ตำแหน่งและประเภทถูก แต่ยังไม่ได้คุยกับช่างผ้าปัก → ไม่บันทึก และไม่นับว่าตอบผิด', () => {
    const s = atStep5();
    explore(s, 'nai-chiao');
    const r = s.submitPin(target, PIN_EMBROIDERY);
    expect(r).toEqual({ ok: false, problems: ['evidence'] });
    expect(s.mistakes.pin).toBe(0);
  });

  it('ตรวจพิกัด ประเภทภูมิปัญญา และหลักฐาน ก่อนบันทึก', () => {
    const s = atStep5();
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    expect(s.evidence).toEqual(['evidence-pattern']);
    expect(s.currentStepOrder).toBe(6);

    // ห่างเกินรัศมี 2 ช่อง (20 ม.)
    expect(s.submitPin({ x: 70, y: 16 }, PIN_EMBROIDERY).problems).toEqual(['location']);
    // ประเภทภูมิปัญญาผิด
    expect(s.submitPin(target, 0).problems).toEqual(['wisdom']);
    expect(s.mistakes.pin).toBe(2);
    // ในรัศมี 2 ช่องถือว่าถูก
    const ok = s.submitPin({ x: 71, y: 14 }, PIN_EMBROIDERY);
    expect(ok).toEqual({ ok: true, problems: [] });
    expect(s.pinnedAt).toEqual({ x: 71, y: 14 });
    expect(s.isPinAvailable()).toBe(false);
    // ปักหมุดผ่าน → ฉาก 7 (ยังต้องไขปริศนาลายผ้าผืนแรกก่อนครูเนมมอบรหัส)
    expect(s.currentStepOrder).toBe(7);
    expect(s.startEnding()).toBe(false);
  });

  it('ครูเนมสรุปผ่านสมุดภาคสนาม แล้วจบด่านพร้อมหน้าสรุปผล', () => {
    const s = atStep5();
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    s.submitPin(target, 0); // ผิด 1 ครั้ง
    s.submitPin(target, PIN_EMBROIDERY);
    s.elapsedMs = 125_000;
    // ยังไม่ได้ไขปริศนา → ยังไม่ได้รหัส
    expect(s.startEnding()).toBe(false);
    s.flags.add('mystery-found');

    expect(s.startEnding()).toBe(true);
    expect(s.mode).toBe('dialogue');
    expect(s.messages.length).toBe(6);
    expect(s.messages[4].text).toContain('"ลาย"');
    expect(s.messages[5].text).toContain('เหลืออีก 3 ชิ้น');
    expect(s.messages[1].text).toContain('4 ซม. บนแผนที่ 1:10,000 เท่ากับ 400 เมตรจริง');
    expect(s.messages[2].text).toContain(`${Math.round(s.routeMeters['route-north'] / 10) * 10} เมตร`);

    expect(runDialogue(s)).toBe('mission-complete');
    expect(s.completed).toBe(true);
    expect(s.mode).toBe('summary');
    expect(s.currentStep).toBeUndefined();
    expect(s.startEnding()).toBe(false);

    const sum = s.summary();
    expect(sum.mistakes).toBe(1);
    expect(sum.mistakesBy).toEqual({ quiz: 0, route: 0, pin: 1, compare: 0 });
    expect(sum.elapsedMs).toBe(125_000);
    expect(sum.cluesFound).toBe(5); // รวมเบาะแสลายผ้าผืนแรกจากป้านวล
    expect(sum.skills).toEqual(
      expect.arrayContaining(['direction', 'scale', 'landmark', 'straight-vs-route', 'grid-coordinates']),
    );
  });

  it('เครื่องหมาย ! แสดงเฉพาะ NPC ที่มีเรื่องใหม่', () => {
    const s = newSession();
    const npc = (id: string) => s.level.npcs.find((n) => n.id === id)!;
    expect(s.hasNewDialogue(npc('teacher-nem'))).toBe(true);
    expect(s.hasNewDialogue(npc('headman'))).toBe(false); // ambient ก่อนพบครู
    talk(s, 'teacher-nem');
    expect(s.hasNewDialogue(npc('teacher-nem'))).toBe(false);
    expect(s.hasNewDialogue(npc('headman'))).toBe(true);
  });
});
