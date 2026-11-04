import { describe, expect, it } from 'vitest';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import type { LevelDefinition } from '../src/content/types';
import { validateLevel } from '../src/content/validateLevel';
import { explore, newSession, talk } from './helpers';

const HEADMAN_OK = [1, 2];
const status = (s: ReturnType<typeof newSession>, id: string) => s.questStatus.get(id);

function toStep5() {
  const s = newSession();
  talk(s, 'teacher-nem');
  talk(s, 'headman', HEADMAN_OK);
  talk(s, 'fisher-kham');
  s.chooseRoute(1);
  return s;
}

describe('ระบบภารกิจ: หลัก / รอง / ปริศนา', () => {
  it('เริ่มด่าน: ภารกิจหลักเปิด ภารกิจอื่นล็อกไว้', () => {
    const s = newSession();
    expect(status(s, 'main-sakngam')).toBe('active');
    expect(status(s, 'side-measure')).toBe('locked');
    expect(status(s, 'side-bridges')).toBe('locked');
    expect(status(s, 'mystery-old-cloth')).toBe('locked');
    expect(s.questCounts()).toEqual({
      main: { done: 0, total: 1 },
      side: { done: 0, total: 2 },
      mystery: { done: 0, total: 1 },
    });
  });

  it('ภารกิจรอง "นักวัดระยะ" ปลดล็อกหลังพบครู และสำเร็จเมื่อใช้เครื่องมือครบ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    expect(status(s, 'side-measure')).toBe('active');
    expect(s.drainToasts()).toContain('ภารกิจรองใหม่: นักวัดระยะ');
    s.noteSkill('odometer');
    s.noteSkill('straight-vs-route');
    explore(s, 'pottery');
    expect(status(s, 'side-measure')).toBe('active'); // ต้องสำรวจปลายทาง 2 เส้นทาง
    explore(s, 'basketry');
    expect(status(s, 'side-measure')).toBe('completed');
  });

  it('ภารกิจรอง "สองสะพาน" ปลดล็อกจากเบาะแสของลุงคำ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    explore(s, 'bridge');
    expect(status(s, 'side-bridges')).toBe('locked');
    talk(s, 'fisher-kham');
    expect(status(s, 'side-bridges')).toBe('active');
    explore(s, 'wood-bridge');
    expect(status(s, 'side-bridges')).toBe('completed');
  });

  it('ภารกิจหลักสำเร็จเมื่อผ่านครบ 6 ฉาก และสถานะไม่ย้อนกลับ', () => {
    const s = toStep5();
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    s.submitPin({ x: 70, y: 13 }, 1);
    s.startEnding();
    while (s.inDialogue) s.advanceDialogue();
    expect(status(s, 'main-sakngam')).toBe('completed');
    expect(s.summary().quests.main).toEqual({ done: 1, total: 1 });
    s.updateQuests();
    expect(status(s, 'main-sakngam')).toBe('completed');
  });

  it('ภารกิจหลักใช้ฉากเดียวกับโครงเรื่อง (ไม่สร้างระบบฉากซ้ำ)', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    const main = s.quests().find((q) => q.def.kind === 'main')!;
    expect(main.objectivesDone).toEqual([true, false, false, false, false, false]);
  });
});

describe('ภารกิจปริศนา: ลายผ้าผืนแรก (3 ซม. = 300 ม.)', () => {
  it('ปลดล็อกเมื่อได้หลักฐานจากช่างผ้าปัก และเบาะแสบอกทิศตะวันตก 3 ซม.', () => {
    const s = toStep5();
    expect(status(s, 'mystery-old-cloth')).toBe('locked');
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    expect(status(s, 'mystery-old-cloth')).toBe('active');
    const clue = s.getClue('clue-old-cloth')!;
    expect(s.resolveText(clue.text)).toContain('มุ่งทิศตะวันตก 3 เซนติเมตร');
  });

  it('จุดลับไม่แสดงป้ายแม้เดินผ่าน จนกว่าจะตรวจค้นพบ', () => {
    const s = toStep5();
    explore(s, 'old-banyan', 3);
    const lm = s.level.landmarks.find((l) => l.id === 'old-banyan')!;
    expect(s.discoveredLandmarks.has('old-banyan')).toBe(true);
    expect(s.isLandmarkVisible(lm)).toBe(false);
    // ยังไม่มีเบาะแส → ตรวจค้นไม่ได้
    expect(s.inspectPointAt({ x: 40, y: 13 })).toBeUndefined();
  });

  it('ตรวจค้นได้เฉพาะในรัศมี และได้หลักฐานพิเศษเมื่อพบ', () => {
    const s = toStep5();
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    expect(s.inspectPointAt({ x: 43, y: 13 })).toBeUndefined();
    explore(s, 'old-banyan', 3); // เดินมาถึงจุดนั้นแล้ว
    const point = s.inspectPointAt({ x: 41, y: 13 })!;
    expect(point.id).toBe('old-banyan-spot');
    s.inspect(point);
    while (s.inDialogue) s.advanceDialogue();
    expect(s.evidence).toContain('evidence-old-cloth');
    expect(status(s, 'mystery-old-cloth')).toBe('completed');
    expect(s.isLandmarkVisible(s.level.landmarks.find((l) => l.id === 'old-banyan')!)).toBe(true);
    expect(s.inspectPointAt({ x: 40, y: 13 })).toBeUndefined(); // ค้นซ้ำไม่ได้
    expect(s.messages.length).toBe(0); // ไม่ใช่ข้อความจากครู
  });

  it('ภารกิจปริศนาเป็นทางเลือก — จบด่านได้โดยไม่ต้องทำ', () => {
    const s = toStep5();
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    s.submitPin({ x: 70, y: 13 }, 1);
    s.startEnding();
    while (s.inDialogue) s.advanceDialogue();
    expect(s.completed).toBe(true);
    expect(s.summary().quests.mystery).toEqual({ done: 0, total: 1 });
  });
});

describe('validateLevel ตรวจข้อมูลภารกิจ', () => {
  it('จับเป้าหมายที่อ้างถึงจุดสังเกตที่ไม่มี และภารกิจหลักที่ไม่ครอบคลุมทุกฉาก', () => {
    const quests = sakNgamLevel.quests!.map((q) =>
      q.id === 'side-bridges'
        ? { ...q, objectives: [{ text: 'x', done: { type: 'discover' as const, landmarkId: 'nowhere' } }] }
        : q.kind === 'main'
          ? { ...q, objectives: q.objectives.slice(0, 5) }
          : q,
    );
    const broken: LevelDefinition = { ...sakNgamLevel, quests };
    const errors = validateLevel(broken);
    expect(errors.some((e) => e.includes('side-bridges'))).toBe(true);
    expect(errors).toContain('ภารกิจหลักไม่ครอบคลุมฉาก 6');
  });
});
