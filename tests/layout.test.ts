import { describe, expect, it } from 'vitest';
import { GAME_FPS } from '../src/config/constants';
import { cueBox, inside, layoutLabels, overlaps, placeCue, type Box } from '../src/core/ui/LabelLayout';
import { TutorialRun, tutorialView, TUTORIAL_STEPS, type TutorialInput } from '../src/core/tutorial/Tutorial';

const view: Box = { x: 0, y: 0, w: 320, h: 213 };
const npc: Box = { x: 150, y: 90, w: 16, h: 26 };
const size = { w: 30, h: 10 };

describe('ป้าย "คุย": วางตามที่ว่าง ไม่ถูกแถบบนจอบัง', () => {
  it('ไม่มีอะไรบัง → อยู่เหนือ NPC', () => {
    const p = placeCue({ target: npc, size, gap: 1.5, view, obstacles: [] });
    expect(p.side).toBe('above');
    expect(p.box.y + p.box.h).toBeLessThanOrEqual(npc.y);
    expect(p.blocked).toBe(false);
  });

  it('แถบภารกิจบังด้านบน-ขวา → ย้ายไปด้านซ้าย (ยังติด NPC) และไม่ทับแถบ', () => {
    const tracker: Box = { x: 140, y: 0, w: 180, h: 88 };
    const right: Box = { x: 175, y: 80, w: 145, h: 60 }; // ปุ่มที่ซ้อนทางขวา
    const p = placeCue({ target: npc, size, gap: 1.5, view, obstacles: [tracker, right] });
    expect(p.side).toBe('left');
    expect(overlaps(p.box, tracker) || overlaps(p.box, right)).toBe(false);
    expect(p.box.x + p.box.w).toBeLessThanOrEqual(npc.x);
    expect(npc.x - (p.box.x + p.box.w)).toBeLessThan(3);
  });

  it('เลี่ยงตัวผู้เล่นถ้ามีที่ว่างอื่น', () => {
    const player: Box = { x: 150, y: 76, w: 14, h: 16 }; // ผู้เล่นยืนเหนือ NPC
    const p = placeCue({ target: npc, size, gap: 1.5, view, obstacles: [], avoid: [player] });
    expect(p.side).not.toBe('above');
    expect(overlaps(p.box, player)).toBe(false);
  });

  it('ขอบจอ: ไม่วางนอกจอ', () => {
    const atTop: Box = { x: 150, y: 2, w: 16, h: 26 };
    const p = placeCue({ target: atTop, size, gap: 1.5, view, obstacles: [] });
    expect(inside(p.box, view)).toBe(true);
  });

  it('ถูกบังทุกด้าน → เลือกตำแหน่งที่ถูกบังน้อยที่สุด (และบอกว่าถูกบัง)', () => {
    const all: Box = { x: 0, y: 0, w: 320, h: 213 };
    const p = placeCue({ target: npc, size, gap: 1.5, view, obstacles: [all] });
    expect(p.blocked).toBe(true);
    expect(cueBox(p.side, { target: npc, size, gap: 1.5 })).toEqual(p.box);
  });
});

describe('ป้ายชื่อไม่ทับกัน', () => {
  const lab = (id: string, x: number, y: number, priority: number, shifts?: number[]) => ({ id, box: { x, y, w: 40, h: 8 }, priority, shifts });

  it('ป้ายที่ชนกัน: ป้ายสำคัญกว่าอยู่ที่เดิม ป้ายรองเลื่อนไปที่ว่าง', () => {
    const out = layoutLabels([lab('far', 100, 100, 10, [-9, 9]), lab('near', 110, 102, 1, [9])]);
    const near = out.find((o) => o.id === 'near')!;
    const far = out.find((o) => o.id === 'far')!;
    expect(near).toMatchObject({ shown: true, dy: 0 });
    expect(far.shown).toBe(true);
    expect(far.dy).not.toBe(0);
    expect(overlaps(near.box, far.box)).toBe(false);
  });

  it('ไม่มีที่ว่าง → ซ่อนป้ายที่สำคัญน้อยกว่า (อยู่ไกลผู้เล่นกว่า)', () => {
    const out = layoutLabels([lab('a', 100, 100, 1), lab('b', 105, 101, 2)]);
    expect(out.find((o) => o.id === 'a')!.shown).toBe(true);
    expect(out.find((o) => o.id === 'b')!.shown).toBe(false);
  });

  it('ไม่ทับสิ่งกีดขวาง (ตัว NPC / ป้ายคุย / แถบบนจอ)', () => {
    const blocker: Box = { x: 100, y: 95, w: 40, h: 10 };
    const out = layoutLabels([lab('x', 100, 100, 1, [-12, 12])], [blocker]);
    expect(out[0].shown).toBe(true);
    expect(overlaps(out[0].box, blocker)).toBe(false);
  });

  it('ไม่สร้างป้ายใหม่: ผลลัพธ์มีเฉพาะป้ายที่ส่งเข้าไป (ป้ายสถานที่ลับที่ยังไม่ค้นพบจึงไม่มีทางปรากฏ)', () => {
    const reqs = [lab('lm:school', 0, 0, 1), lab('npc:nem', 50, 0, 0)];
    const out = layoutLabels(reqs);
    expect(out.map((o) => o.id).sort()).toEqual(['lm:school', 'npc:nem']);
  });

  it('ผลลัพธ์คงที่ (ลำดับเท่ากัน ใช้ id)', () => {
    const a = layoutLabels([lab('b', 0, 0, 1), lab('a', 0, 0, 1)]);
    expect(a.find((o) => o.shown)!.id).toBe('a');
  });
});

describe('บทแนะนำในแผนที่/สมุด: ย่อเป็นแถบคำแนะนำสั้น', () => {
  const base: TutorialInput = { mode: 'explore', totalMeters: 0, tripMeters: 0, nearNpc: false, talked: true, measured: false };
  it('สมุด/แผนที่มีข้อความสั้น (≤ 40 ตัวอักษร) พร้อมชื่อปุ่มปิด · บทสนทนายังใช้การ์ดปกติ', () => {
    const t = new TutorialRun({ status: 'active', done: TUTORIAL_STEPS.slice(0, 3), events: [] });
    for (const touch of [true, false]) {
      const nb = tutorialView(t, { ...base, mode: 'notebook' }, touch)!;
      const mp = tutorialView(t, { ...base, mode: 'map' }, touch)!;
      expect(nb.short).toMatch(touch ? /\[ปิดสมุด\]/ : /\[N\]/);
      expect(mp.short).toMatch(touch ? /\[ปิดแผนที่\]/ : /\[M\]/);
      if (touch) for (const v of [nb, mp]) expect(v.short!.length).toBeLessThanOrEqual(40);
      expect(tutorialView(t, { ...base, mode: 'dialogue' }, touch)!.short).toBeNull();
      expect(tutorialView(t, base, touch)!.short).toBeNull();
    }
  });
});

describe('นาฬิกาเกม: ไม่ช้าลงตอนเริ่มเกมบนเครื่องช้า', () => {
  it('ปิดช่วงตัดเวลา 120 เฟรมแรกของ Phaser (panicMax = 0) แต่ยังกันเฟรมยาวผิดปกติ (min 5 fps)', () => {
    expect(GAME_FPS.panicMax).toBe(0);
    expect(GAME_FPS.min).toBe(5);
    expect(GAME_FPS.target).toBe(60);
  });
});
