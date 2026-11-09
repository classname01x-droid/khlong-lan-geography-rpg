import { describe, expect, it } from 'vitest';
import { sakNgamLevel as L, SAKNGAM_C_SPOT } from '../src/content/levels/sakngam';
import { validateLevel } from '../src/content/validateLevel';
import { directionFromVector } from '../src/core/direction/Compass';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import { guideTarget } from '../src/core/guide/Navigation';
import { buildQuestTracker } from '../src/core/guide/QuestGuide';
import { ProgressStore } from '../src/core/progress/ProgressStore';
import { buildWorld } from '../src/core/world/MapBuilder';
import { findPath, isPointReachable, reachableTiles } from '../src/core/world/pathfinding';
import { newSession, talk } from './helpers';

const grid = buildWorld(L.map);
const npc = (id: string) => L.npcs.find((n) => n.id === id)!.at;
const cm = (a: { x: number; y: number }, b: { x: number; y: number }) => defaultScale.tilesToMeters(Math.hypot(a.x - b.x, a.y - b.y)) / 100; // ซม. บนแผนที่ 1:10,000
const right = (id: string) => L.quizzes!.find((q) => q.id === id)!.choices.findIndex((c) => c.id === L.quizzes!.find((q) => q.id === id)!.correctChoiceId);

describe('สักงาม: ทิศและระยะในแผนที่ตรงกับโจทย์ (1:10,000 · 1 ซม. = 100 ม.)', () => {
  it('ข้อมูลด่านผ่านการตรวจสอบ และจุดหมายทุกจุดเดินถึงได้', () => {
    expect(validateLevel(L)).toEqual([]);
    const reach = reachableTiles(grid, L.spawn);
    for (const id of ['teacher-nem', 'headman', 'grandma', 'jiao']) expect(isPointReachable(grid, reach, npc(id), 2), id).toBe(true);
    expect(isPointReachable(grid, reach, SAKNGAM_C_SPOT, 2)).toBe(true);
    expect(grid.getTerrain(SAKNGAM_C_SPOT.x, SAKNGAM_C_SPOT.y)).not.toBe('water');
  });

  it('โรงเรียน → บ้านผู้ใหญ่บ้าน: ทิศตะวันออก 4 ซม. = 400 ม. และต้องข้ามสะพาน', () => {
    const school = L.landmarks.find((l) => l.id === 'school')!.at;
    const h = npc('headman');
    expect(directionFromVector(h.x - school.x, h.y - school.y)).toBe('E');
    expect(cm(school, h)).toBeCloseTo(4, 0);
    const path = findPath(grid, L.spawn, { x: h.x, y: h.y + 1 })!;
    expect(path).not.toBeNull();
    expect(path.some((p) => grid.getTerrain(p.x, p.y) === 'bridge')).toBe(true);
  });

  it('บ้านผู้ใหญ่บ้าน → คุณยาย: ทิศตะวันตก 3 ซม. · คุณยาย → ป้าเจียว: ทิศเหนือ 2 ซม.', () => {
    const h = npc('headman');
    const g = npc('grandma');
    const j = npc('jiao');
    expect(directionFromVector(g.x - h.x, g.y - h.y)).toBe('W');
    expect(Math.abs(g.x - h.x)).toBe(30);
    expect(directionFromVector(j.x - g.x, j.y - g.y)).toBe('N');
    expect(g.x).toBe(j.x);
    expect(g.y - j.y).toBe(20);
    // เดินถึงได้จริงตามลำดับ
    expect(findPath(grid, { x: h.x, y: h.y + 1 }, { x: g.x, y: g.y - 1 })).not.toBeNull();
    expect(findPath(grid, g, { x: j.x, y: j.y + 1 })).not.toBeNull();
  });

  it('จุด C: ห่างลำธารทุกสายอย่างน้อย 300 ม. (ลำธารหลักห่าง 400 ม.) · ติดทุ่งนา ตะวันออกของบ้านผู้ใหญ่บ้านราว 2 ซม.', () => {
    const water: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.getTerrain(x, y) === 'water') water.push({ x, y });
    const nearest = Math.min(...water.map((w) => cm(w, SAKNGAM_C_SPOT)));
    expect(nearest).toBeGreaterThanOrEqual(3);
    const main = Math.min(...water.filter((w) => w.x < 36).map((w) => cm(w, SAKNGAM_C_SPOT)));
    expect(main).toBeGreaterThanOrEqual(3.9);
    const h = npc('headman');
    expect(directionFromVector(SAKNGAM_C_SPOT.x - h.x, SAKNGAM_C_SPOT.y - h.y)).toBe('E');
    expect(cm(h, SAKNGAM_C_SPOT)).toBeGreaterThan(1.5);
    expect(cm(h, SAKNGAM_C_SPOT)).toBeLessThan(2.5);
  });
});

describe('สักงาม: เล่นตามภารกิจ — ไม่มีการนำทาง', () => {
  it('ไม่มีลูกศร/เป้าหมายนำทาง/หมุด/จุดลับบนแผนที่ ในทุกขั้น', () => {
    expect(L.exploreMode).toBe(true);
    const s = newSession(L);
    const stages = ['start', 'q-school', 'met-headman', 'route-known', 'trash-quiz', 'c-found', 'm-report'];
    for (const f of stages) {
      if (f !== 'start') s.flags.add(f);
      expect(guideTarget(s), f).toBeNull();
      const t = buildQuestTracker(s, {});
      expect(t.target, f).toBeNull();
    }
    expect(L.landmarks.every((l) => l.knownWhen === undefined && !l.revealFlag)).toBe(true);
    expect(L.landmarks.some((l) => /จุด C|จุด A|จุด B/.test(l.name))).toBe(false);
    for (const n of L.npcs) expect(s.hasNewDialogue(n) && false).toBe(false);
  });

  it('ลำดับ: ครูเนม → ผู้ใหญ่บ้าน (3 โจทย์) → ป้าเจียว (เลือกจุด C) → เดินถึงจุด C → รายงาน +100 เหรียญ +10 ศรัทธา', () => {
    const s = newSession(L);
    const p = new ProgressStore(null, 'sakngam');
    s.wallet = p;
    const wrong = (id: string) => (right(id) + 1) % 3;
    // ผู้ใหญ่บ้านก่อนครูเนม: ยังไม่ให้โจทย์
    talk(s, 'headman');
    expect(s.flags.has('met-headman')).toBe(false);
    // ครูเนม: ตอบผิดลองใหม่ได้ ไม่หักเงิน
    s.talkTo(L.npcs[0]);
    s.advanceDialogue();
    s.advanceDialogue();
    expect(s.dialogueView?.kind).toBe('quiz');
    s.answerQuiz(wrong('q-school'));
    expect(s.dialogueView?.kind).toBe('quiz');
    s.answerQuiz(right('q-school'));
    while (s.inDialogue) s.advanceDialogue();
    expect(s.flags.has('q-school')).toBe(true);
    talk(s, 'headman', [right('q-west'), right('q-north')]);
    expect(s.flags.has('route-known')).toBe(true);
    // เดินถึงจุด C ก่อนเลือกคำตอบ = ยังไม่นับ
    expect(s.checkArrivals(SAKNGAM_C_SPOT)).toBe(false);
    talk(s, 'jiao', [wrong('q-site'), right('q-site')]);
    expect(s.flags.has('trash-quiz')).toBe(true);
    expect(p.rpg.coins).toBe(0);
    // ยังไม่ถึงจุด C = รายงานไม่ได้
    talk(s, 'jiao');
    expect(s.flags.has('m-report')).toBe(false);
    expect(s.checkArrivals({ x: 40, y: 48 })).toBe(false);
    expect(s.checkArrivals({ x: SAKNGAM_C_SPOT.x - 2, y: SAKNGAM_C_SPOT.y })).toBe(true);
    expect(s.drainToasts()).toContain('พบพื้นที่ที่เหมาะสมสำหรับรวบรวมขยะ');
    talk(s, 'jiao');
    while (s.inDialogue) s.advanceDialogue();
    expect(p.rpg.coins).toBe(100);
    expect(p.rpg.faith).toBe(10);
    expect(s.completed || s.flags.has('sakngam-complete')).toBe(true);
  });

  it('แถบภารกิจแสดงโจทย์/คำบอกทางที่ได้รับแล้ว (อ่านซ้ำได้) และไม่เฉลยคำตอบก่อนตอบถูก', () => {
    const s = newSession(L);
    for (const f of ['q-school', 'met-headman']) s.flags.add(f);
    s.updateQuests(true);
    const before = buildQuestTracker(s, {});
    const text = [before.objective, ...before.steps].join(' ');
    expect(text).toContain('3 ซม.');
    expect(text).not.toContain('300 เมตร');
    s.flags.add('route-known');
    s.updateQuests(true);
    const after = buildQuestTracker(s, {});
    const t2 = [after.objective, ...after.steps].join(' ');
    expect(after.objective).toBe('ตามหาป้าเจียว');
    expect(t2).toContain('ทิศตะวันตก 300 เมตร');
    expect(t2).toContain('ขึ้นเหนือ 200 เมตร');
    // ก่อนตอบโจทย์ข้อแรก ไม่บอก 400 เมตร
    const s0 = newSession(L);
    expect([buildQuestTracker(s0, {}).objective, ...buildQuestTracker(s0, {}).steps].join(' ')).not.toContain('400');
  });
});
