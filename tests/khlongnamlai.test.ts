import { describe, expect, it } from 'vitest';
import {
  khlongNamLaiLevel as L,
  L2_BARREL,
  L2_CHECK_A,
  L2_CHECK_B,
  L2_CHECK_C,
  L2_HEADMAN,
  L2_HUT,
  L2_KHAM,
  L2_RANGER,
  L2_SITE,
} from '../src/content/levels/khlongnamlai';
import { A_POINTS, B_POINTS, MAIN_POINTS } from '../src/content/levels/khlongnamlai/map';
import { validateLevel } from '../src/content/validateLevel';
import { directionFromVector } from '../src/core/direction/Compass';
import { guideTarget } from '../src/core/guide/Navigation';
import { buildQuestTracker } from '../src/core/guide/QuestGuide';
import { ProgressStore } from '../src/core/progress/ProgressStore';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import type { GameSession } from '../src/core/session/GameSession';
import { ElevationModel } from '../src/core/world/Elevation';
import { buildWorld } from '../src/core/world/MapBuilder';
import { findPath, isPointReachable, reachableTiles } from '../src/core/world/pathfinding';
import { analyzeWaterway, waterwayTiles } from '../src/core/world/Waterway';
import { newSession } from './helpers';

const grid = buildWorld(L.map);
const elev = new ElevationModel(L.map.elevation!);
const h = (p: { x: number; y: number }) => elev.heightAt(p.x, p.y);
const cm = (a: { x: number; y: number }, b: { x: number; y: number }) => defaultScale.tilesToMeters(Math.hypot(a.x - b.x, a.y - b.y)) / 100;
const quiz = (id: string) => L.quizzes!.find((q) => q.id === id)!;
const rightIdx = (id: string) => quiz(id).choices.findIndex((c) => c.id === quiz(id).correctChoiceId);
const wrongIdx = (id: string, n = 0) => quiz(id).choices.map((_, i) => i).filter((i) => i !== rightIdx(id))[n];
const kind = (s: GameSession) => s.dialogueView?.kind;
const view = (s: GameSession) => s.dialogueView as { kind: string; text?: string; speaker?: string; question?: string; choices?: string[]; feedback?: string | null; button?: string; page?: number; pages?: number; title?: string };
const talk = (s: GameSession, id: string) => s.talkTo(L.npcs.find((n) => n.id === id)!);
function toQuiz(s: GameSession): void {
  for (let g = 0; g < 40 && s.inDialogue && kind(s) !== 'quiz'; g++) s.advanceDialogue();
}
function finish(s: GameSession): void {
  for (let g = 0; g < 40 && s.inDialogue; g++) {
    if (kind(s) === 'quiz') throw new Error(`ติดที่คำถาม: ${view(s).question}`);
    s.advanceDialogue();
  }
}
/** อ่านทุกบรรทัดจนถึงคำถามถัดไป (หรือจบ) — คืนข้อความที่ผ่านไป */
function lines(s: GameSession): string[] {
  const out: string[] = [];
  for (let g = 0; g < 40 && s.inDialogue && kind(s) !== 'quiz'; g++) {
    const v = view(s);
    out.push(v.kind === 'lesson' ? `[บทเรียน ${v.page}/${v.pages}] ${v.title}` : `${v.speaker}: ${v.text}`);
    s.advanceDialogue();
  }
  return out;
}
const answer = (s: GameSession, id: string) => s.answerQuiz(rightIdx(id));
const skipLesson = (s: GameSession) => {
  for (let g = 0; g < 10 && kind(s) === 'lesson'; g++) s.advanceDialogue();
};
function newPlay() {
  const s = newSession(L);
  const p = new ProgressStore(null, 'sakngam');
  s.wallet = p;
  return { s, p };
}
/** สถานะกลางเกมที่กำหนด flag เอง (เหมือนโหลดเกมที่บันทึกไว้ขั้นนั้น) */
const FLAGS = {
  kham: ['q-kham'],
  topo: ['q-kham', 'got-topo', 'q-station'],
  task: ['q-kham', 'got-topo', 'q-station', 'contour-task'],
  mapOpened: ['q-kham', 'got-topo', 'q-station', 'contour-task', 'opened:map'],
  labeled: ['q-kham', 'got-topo', 'q-station', 'contour-task', 'opened:map', 'contour-labeled'],
  learned: ['q-kham', 'got-topo', 'q-station', 'contour-task', 'opened:map', 'contour-labeled', 'contours-learned'],
  source: ['q-kham', 'got-topo', 'q-station', 'contour-task', 'opened:map', 'contour-labeled', 'contours-learned', 'q-flow', 'q-source'],
  site: ['q-kham', 'got-topo', 'q-station', 'contour-task', 'opened:map', 'contour-labeled', 'contours-learned', 'q-flow', 'q-source', 'q-site'],
  found: ['q-kham', 'got-topo', 'q-station', 'contour-task', 'opened:map', 'contour-labeled', 'contours-learned', 'q-flow', 'q-source', 'q-site', 'site-found', 'barrel-seen'],
  done: ['q-kham', 'got-topo', 'q-station', 'contour-task', 'opened:map', 'contour-labeled', 'contours-learned', 'q-flow', 'q-source', 'q-site', 'site-found', 'barrel-seen', 'q-chem'],
} as const;
function withFlags(stage: keyof typeof FLAGS) {
  const r = newPlay();
  for (const f of FLAGS[stage]) r.s.flags.add(f);
  r.s.updateQuests(true);
  return r;
}
/** เล่นถึงขั้นที่กำหนดด้วยบทสนทนาจริง (ตอบถูกทุกข้อ) */
function playTo(stage: 'kham' | 'topo' | 'task' | 'learned' | 'site' | 'chem') {
  const { s, p } = newPlay();
  const order = ['kham', 'topo', 'task', 'learned', 'site', 'chem'];
  const upTo = (x: string) => order.indexOf(stage) >= order.indexOf(x);
  talk(s, 'headman');
  toQuiz(s);
  answer(s, 'q-kham');
  finish(s);
  if (upTo('topo')) {
    talk(s, 'ta-kham');
    toQuiz(s);
    answer(s, 'q-station');
    finish(s);
  }
  if (upTo('task')) {
    talk(s, 'ranger');
    finish(s);
  }
  if (upTo('learned')) {
    s.noteOpened('map');
    talk(s, 'ranger');
    toQuiz(s);
    answer(s, 'q-contour');
    toQuiz(s);
    answer(s, 'q-slope');
    finish(s);
  }
  if (upTo('site')) {
    talk(s, 'ranger');
    toQuiz(s);
    answer(s, 'q-flow');
    toQuiz(s);
    answer(s, 'q-source');
    toQuiz(s);
    answer(s, 'q-site');
    finish(s);
  }
  if (upTo('chem')) {
    s.checkArrivals(L2_SITE);
    toQuiz(s);
    answer(s, 'q-chem');
    finish(s);
  }
  return { s, p };
}

describe('ด่าน 2: แผนที่ — ภูมิประเทศ เส้นชั้นความสูง ลำน้ำ', () => {
  it('ข้อมูลด่านผ่านการตรวจสอบ (ลำน้ำไม่ไหลขึ้นเนิน ตรงกับช่องน้ำ · NPC/จุดสังเกตเดินถึงได้)', () => {
    expect(validateLevel(L)).toEqual([]);
    const reach = reachableTiles(grid, L.spawn);
    for (const n of L.npcs) expect(isPointReachable(grid, reach, n.at, 1), n.id).toBe(true);
    for (const p of [L2_SITE, L2_HUT, L2_BARREL]) expect(isPointReachable(grid, reach, p, 1), JSON.stringify(p)).toBe(true);
    expect(grid.isBlocked(L.spawn.x, L.spawn.y)).toBe(false);
  });

  it('ช่วงต่างระดับ 50 ม.: มีเส้นชั้นความสูงเพียง 3 เส้น (100, 150, 200) วงล้อมกันเข้าหาศูนย์กลาง', () => {
    expect(L.contourIntervalMeters).toBe(50);
    let min = Infinity;
    let max = -Infinity;
    const bands = new Set<number>();
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        const v = h({ x: x + 0.5, y: y + 0.5 });
        min = Math.min(min, v);
        max = Math.max(max, v);
        bands.add(Math.floor(v / 50));
      }
    // ความสูง 50–249 ม. → ขอบชั้นที่ตัดภายในแผนที่คือ 100, 150, 200 เท่านั้น (ไม่มีเส้น 50 หรือ 250)
    expect(min).toBeGreaterThan(50);
    expect(max).toBeLessThan(250);
    expect([...bands].sort()).toEqual([1, 2, 3, 4]);
    const boundaries = [...bands].sort().slice(1).map((b) => b * 50);
    expect(boundaries).toEqual([100, 150, 200]);

    // วงล้อมกัน: บริเวณที่สูงเกิน 100/150/200 ต่อเนื่องเป็นผืนเดียว และซ้อนกันเข้าข้างใน
    const region = (level: number) => {
      const cells: boolean[] = [];
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) cells.push(h({ x: x + 0.5, y: y + 0.5 }) >= level);
      return cells;
    };
    const components = (cells: boolean[]) => {
      const seen = new Set<number>();
      let n = 0;
      for (let i = 0; i < cells.length; i++) {
        if (!cells[i] || seen.has(i)) continue;
        n++;
        const stack = [i];
        seen.add(i);
        while (stack.length) {
          const c = stack.pop()!;
          const cx = c % grid.width;
          const cy = Math.floor(c / grid.width);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
            const j = ny * grid.width + nx;
            if (cells[j] && !seen.has(j)) {
              seen.add(j);
              stack.push(j);
            }
          }
        }
      }
      return n;
    };
    const r100 = region(100);
    const r150 = region(150);
    const r200 = region(200);
    expect([components(r100), components(r150), components(r200)]).toEqual([1, 1, 1]); // 3 วงใหญ่ (วงในสุด = 200 ม.)
    for (let i = 0; i < r100.length; i++) {
      if (r200[i]) expect(r150[i]).toBe(true);
      if (r150[i]) expect(r100[i]).toBe(true);
    }
    expect(r200.filter(Boolean).length).toBeGreaterThan(50); // วงในสุดมีพื้นที่ให้เห็นบนแผนที่
  });

  it('ลำน้ำ A และ B ไหลลงตามความสูง มาบรรจบที่จุดเดียวกัน แล้วไหลต่อเป็นลำน้ำสายหลัก (ไม่ไหลขึ้นเนินแม้แต่ช่องเดียว)', () => {
    const a = analyzeWaterway(A_POINTS, elev);
    const b = analyzeWaterway(B_POINTS, elev);
    const m = analyzeWaterway(MAIN_POINTS, elev);
    for (const w of [a, b, m]) expect(w.monotonic).toBe(true);
    expect(a.mouth).toEqual(b.mouth);
    expect(a.mouth).toEqual(m.source);
    expect(a.mouth).toEqual({ x: 40, y: 14 });
    // จุดบรรจบต่ำกว่าต้นน้ำทั้งสองสาย และลำน้ำสายหลักต่ำลงต่อไปจนถึงปลายน้ำ
    expect(a.sourceMeters).toBeGreaterThan(a.mouthMeters);
    expect(b.sourceMeters).toBeGreaterThan(b.mouthMeters);
    expect(m.sourceMeters).toBeGreaterThan(m.mouthMeters);
    // ทุกช่องของลำน้ำเป็นน้ำจริงบนแผนที่
    for (const pts of [A_POINTS, B_POINTS, MAIN_POINTS])
      for (const t of waterwayTiles(pts)) expect(['water', 'bridge']).toContain(grid.getTerrain(t.x, t.y));
    // น้ำไหลขึ้นไปทางเหนือ (ด้านบนจอ) แต่ไหลจากที่สูงไปที่ต่ำ: ปลายน้ำ C อยู่ด้านบนจอ
    expect(directionFromVector(m.mouth.x - m.source.x, m.mouth.y - m.source.y)).toBe('N');
  });

  it('ต้นน้ำสาย B ไม่ใช่ยอดเขา: ยอดสูงสุดอยู่ห่างจากลำน้ำทั้งสอง และต้นน้ำ B ต่ำกว่ายอดเกิน 50 ม.', () => {
    let peak = { x: 0, y: 0 };
    let best = -Infinity;
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        const v = h({ x, y });
        if (v > best) {
          best = v;
          peak = { x, y };
        }
      }
    const water = [...waterwayTiles(A_POINTS), ...waterwayTiles(B_POINTS), ...waterwayTiles(MAIN_POINTS)];
    expect(Math.min(...water.map((t) => Math.hypot(t.x - peak.x, t.y - peak.y)))).toBeGreaterThan(8);
    const bSource = analyzeWaterway(B_POINTS, elev).source;
    expect(best - h(bSource)).toBeGreaterThan(50);
    expect(grid.getTerrain(peak.x, peak.y)).not.toBe('water');
  });

  it('จุดตรวจ A, B, C อยู่บนลำน้ำของตนเอง · ความสูงตามช่วงเส้น (A 100–150, B 150–200, C ต่ำกว่า 100) · C อยู่ด้านบนจอแต่ต่ำที่สุด', () => {
    expect(waterwayTiles(A_POINTS).some((t) => t.x === L2_CHECK_A.x && t.y === L2_CHECK_A.y)).toBe(true);
    expect(waterwayTiles(B_POINTS).some((t) => t.x === L2_CHECK_B.x && t.y === L2_CHECK_B.y)).toBe(true);
    expect(waterwayTiles(MAIN_POINTS).some((t) => t.x === L2_CHECK_C.x && t.y === L2_CHECK_C.y)).toBe(true);
    const a = h(L2_CHECK_A);
    const b = h(L2_CHECK_B);
    const c = h(L2_CHECK_C);
    expect(a).toBeGreaterThan(100 + 15);
    expect(a).toBeLessThan(150 - 15);
    expect(b).toBeGreaterThan(150 + 15);
    expect(b).toBeLessThan(200 - 15);
    expect(c).toBeLessThan(100 - 15);
    expect(L2_CHECK_C.y).toBeLessThan(L2_CHECK_A.y); // บนจอสูงกว่า…
    expect(L2_CHECK_C.y).toBeLessThan(L2_CHECK_B.y);
    expect(c).toBeLessThan(a); // …แต่ต่ำที่สุด (ปลายน้ำ)
    expect(c).toBeLessThan(b);
    // ต้นน้ำ B (บริเวณตรวจสอบ) สูงกว่าจุดตรวจ B
    expect(h(L2_SITE)).toBeGreaterThan(b);
  });

  it('ความลาดชัน: รอบจุด A เส้นชั้นความสูงชิดกัน รอบจุด B เส้นห่างกัน (ช่วงต่างระดับเท่ากัน)', () => {
    // ระยะระหว่างเส้นชั้นความสูง ≈ 50 ม. ÷ ความชัน — วัดจากความสูงรอบจุดจริง (ต่างกันตามระยะ 3 ช่อง)
    const grad = (p: { x: number; y: number }) => {
      const gx = (h({ x: p.x + 3, y: p.y }) - h({ x: p.x - 3, y: p.y })) / 6;
      const gy = (h({ x: p.x, y: p.y + 3 }) - h({ x: p.x, y: p.y - 3 })) / 6;
      return Math.hypot(gx, gy); // เมตรต่อช่อง
    };
    const spacingA = 50 / grad(L2_CHECK_A);
    const spacingB = 50 / grad(L2_CHECK_B);
    expect(spacingA).toBeLessThan(8); // เส้นห่างกันไม่ถึง 8 ช่อง (80 ม.)
    expect(spacingB).toBeGreaterThan(15); // เส้นห่างกันเกิน 15 ช่อง (150 ม.)
    expect(spacingB).toBeGreaterThan(spacingA * 2.5);
  });
});

describe('ด่าน 2: ทิศและระยะของเส้นทาง (1:10,000 · 1 ซม. = 100 ม.) ตรงกับแผนที่จริง', () => {
  it('บ้านผู้ใหญ่บ้าน → บ้านตาคำ: ทิศตะวันออก 4 ซม. = 400 ม. · ผ่านสะพานข้ามลำน้ำที่อยู่ระหว่างทางจริง', () => {
    expect(directionFromVector(L2_KHAM.x - L2_HEADMAN.x, L2_KHAM.y - L2_HEADMAN.y)).toBe('E');
    expect(L2_KHAM.y).toBe(L2_HEADMAN.y);
    expect(cm(L2_HEADMAN, L2_KHAM)).toBeCloseTo(4, 5);
    expect(defaultScale.tilesToMeters(L2_KHAM.x - L2_HEADMAN.x)).toBe(400);
    const path = findPath(grid, L.spawn, { x: L2_KHAM.x, y: L2_KHAM.y + 1 })!;
    expect(path).not.toBeNull();
    const bridge = path.find((p) => grid.getTerrain(p.x, p.y) === 'bridge')!;
    expect(bridge).toBeDefined();
    expect(bridge.x).toBeGreaterThan(L2_HEADMAN.x);
    expect(bridge.x).toBeLessThan(L2_KHAM.x);
    const lm = L.landmarks.find((l) => l.id === 'bridge')!;
    expect(grid.getTerrain(lm.at.x, lm.at.y)).toBe('bridge');
  });

  it('บ้านตาคำ → สถานีป่าไม้: ทิศตะวันออก 2 ซม. = 200 ม.', () => {
    expect(directionFromVector(L2_RANGER.x - L2_KHAM.x, L2_RANGER.y - L2_KHAM.y)).toBe('E');
    expect(L2_RANGER.y).toBe(L2_KHAM.y);
    expect(cm(L2_KHAM, L2_RANGER)).toBeCloseTo(2, 5);
    expect(findPath(grid, { x: L2_KHAM.x, y: L2_KHAM.y + 1 }, { x: L2_RANGER.x, y: L2_RANGER.y + 1 })).not.toBeNull();
  });

  it('สถานีป่าไม้ → กระท่อมเฝ้าป่า: ทิศใต้ 3 ซม. · กระท่อม → จุดตรวจสอบต้นน้ำ B: ทิศตะวันตก 2 ซม. · รวม 5 ซม. = 500 ม.', () => {
    expect(directionFromVector(L2_HUT.x - L2_RANGER.x, L2_HUT.y - L2_RANGER.y)).toBe('S');
    expect(L2_HUT.x).toBe(L2_RANGER.x);
    expect(cm(L2_RANGER, L2_HUT)).toBeCloseTo(3, 5);
    expect(directionFromVector(L2_SITE.x - L2_HUT.x, L2_SITE.y - L2_HUT.y)).toBe('W');
    expect(L2_SITE.y).toBe(L2_HUT.y);
    expect(cm(L2_HUT, L2_SITE)).toBeCloseTo(2, 5);
    expect(cm(L2_RANGER, L2_HUT) + cm(L2_HUT, L2_SITE)).toBeCloseTo(5, 5);
    // กระท่อมเฝ้าป่า (สิ่งปลูกสร้าง) อยู่ที่มุมเลี้ยวจริง · เส้นทางเดินถึงได้และเลี้ยวที่มุมนั้น
    const hut = L.landmarks.find((l) => l.id === 'hut')!;
    expect(Math.hypot(hut.at.x - L2_HUT.x, hut.at.y - L2_HUT.y)).toBeLessThanOrEqual(3);
    // ถนนดินตามคำบอกทางมีจริงตลอดแนว: ลงใต้ (x=74) แล้วเลี้ยวตะวันตก (y=40) จนถึงจุดตรวจสอบ
    const isRoad = (x: number, y: number) => ['road', 'bridge'].includes(grid.getTerrain(x, y)!);
    for (let y = L2_RANGER.y; y <= L2_HUT.y; y++) expect(isRoad(L2_RANGER.x, y) && isRoad(L2_RANGER.x + 1, y), `x=74 y=${y}`).toBe(true);
    for (let x = L2_SITE.x; x <= L2_HUT.x; x++) expect(isRoad(x, L2_HUT.y) && isRoad(x, L2_HUT.y + 1), `y=40 x=${x}`).toBe(true);
    const path = findPath(grid, { x: L2_RANGER.x + 1, y: L2_RANGER.y + 1 }, L2_SITE)!;
    expect(path).not.toBeNull();
    expect(defaultScale.tilesToMeters(path.length)).toBeGreaterThanOrEqual(400); // เดินตรงข้ามป่าสั้นกว่าถนนได้ แต่ไม่สั้นกว่าระยะเส้นตรง
  });

  it('จุดตรวจสอบอยู่ใกล้ลำน้ำ B ทางต้นน้ำ · ถังสารเคมีอยู่ใกล้ลำธารและเดินถึงได้ · กลับบ้านผู้ใหญ่บ้านได้', () => {
    const bTiles = waterwayTiles(B_POINTS);
    const dist = (p: { x: number; y: number }) => Math.min(...bTiles.map((t) => Math.hypot(t.x - p.x, t.y - p.y)));
    expect(dist(L2_SITE)).toBeLessThanOrEqual(3);
    expect(dist(L2_BARREL)).toBeLessThanOrEqual(3);
    expect(grid.getTerrain(L2_BARREL.x, L2_BARREL.y)).not.toBe('water');
    expect(grid.isBlocked(L2_BARREL.x, L2_BARREL.y)).toBe(false);
    expect(Math.hypot(L2_BARREL.x - L2_SITE.x, L2_BARREL.y - L2_SITE.y)).toBeLessThanOrEqual(3); // ถังอยู่ในระยะที่ผู้เล่นเห็นตอนมาถึง
    expect(findPath(grid, L2_SITE, { x: L2_HEADMAN.x, y: L2_HEADMAN.y + 1 })).not.toBeNull();
    // ระยะกลับตามที่แถบภารกิจบอก: ตะวันออก 2 → เหนือ 3 → ตะวันตก 6 ซม.
    expect(cm(L2_RANGER, L2_HEADMAN)).toBeCloseTo(6, 5);
    expect(directionFromVector(L2_HEADMAN.x - L2_RANGER.x, L2_HEADMAN.y - L2_RANGER.y)).toBe('W');
  });

  it('ไม่มีลูกศร/หมุด/เป้าหมายนำทาง และไม่มีป้ายบอกตำแหน่งตาคำหรือต้นน้ำล่วงหน้า', () => {
    expect(L.exploreMode).toBe(true);
    const { s } = newPlay();
    for (const f of ['start', 'q-kham', 'got-topo', 'q-station', 'contour-task', 'contour-labeled', 'contours-learned', 'q-flow', 'q-source', 'q-site', 'site-found', 'q-chem', 'l2-report']) {
      if (f !== 'start') s.flags.add(f);
      expect(guideTarget(s), f).toBeNull();
      expect(buildQuestTracker(s, {}).target, f).toBeNull();
    }
    expect(L.landmarks.every((l) => !l.revealFlag)).toBe(true);
    const fresh = newSession(L);
    // ตอนเริ่ม: ไม่มีจุดใดบนแผนที่ที่บอกตำแหน่งบ้านตาคำ/ต้นน้ำ (จุดตรวจ A, B, C ปรากฏเมื่อได้แผนที่ภูมิประเทศเท่านั้น)
    expect(L.landmarks.filter((l) => fresh.isLandmarkOnMap(l)).map((l) => l.id)).toEqual([]);
    fresh.flags.add('got-topo');
    expect(L.landmarks.filter((l) => fresh.isLandmarkOnMap(l)).map((l) => l.id).sort()).toEqual(['check-a', 'check-b', 'check-c']);
  });
});

describe('ด่าน 2: ฉากที่ 1 — บ้านผู้ใหญ่บ้าน', () => {
  it('ผู้กล้าเกิดที่บ้านผู้ใหญ่บ้าน · บทสนทนาเริ่มเองในพื้นที่เริ่มต้น (ครั้งเดียว)', () => {
    expect(Math.hypot(L.spawn.x - L2_HEADMAN.x, L.spawn.y - L2_HEADMAN.y)).toBeLessThanOrEqual(2);
    const s = newSession(L);
    const t = s.triggerAt(L.spawn);
    expect(t?.npcId).toBe('headman');
    s.flags.add('q-kham');
    expect(s.triggerAt(L.spawn)).toBeUndefined();
  });

  it('บทสนทนาตามเรื่อง → บอกทิศ+ระยะ+มาตราส่วน+จุดสังเกต ก่อนถามโจทย์ 3 ตัวเลือก', () => {
    const { s } = newPlay();
    talk(s, 'headman');
    const read = lines(s);
    expect(read[0]).toBe('ผู้ใหญ่บ้าน: ผู้กล้า! มีคนแอบนำสารเคมีไปทิ้งบริเวณต้นน้ำ ตอนนี้น้ำในชุมชนเริ่มผิดปกติแล้ว');
    expect(read[1]).toBe('ผู้กล้า: แล้วเราจะรู้ได้อย่างไรว่าต้นน้ำอยู่ที่ไหนครับ?');
    expect(read[2]).toBe('ผู้ใหญ่บ้าน: ข้าไม่รู้ตำแหน่งแน่ชัด แต่ตาคำรู้จักป่าแถบนี้ดี ลองไปหาเขาดู');
    expect(read[3]).toContain('ทิศตะวันออก');
    expect(read[3]).toContain('4 เซนติเมตร');
    expect(read[3]).toContain('1:10,000');
    expect(read[3]).toContain('สะพาน');
    const q = view(s);
    expect(q.kind).toBe('quiz');
    expect(q.choices).toEqual(['40 เมตร', '400 เมตร', '4,000 เมตร']);
    expect(q.question).toContain('4 ซม.');
    expect(s.flags.has('q-kham')).toBe(false);
  });

  it('ตอบมาตราส่วนผิด → กลับไปเรียนกับครูเนม (บทเรียน 5 หน้า) แล้วตอบข้อเดิม · ไม่หักรางวัล ไม่เพิ่ม HP บอส', () => {
    const { s, p } = newPlay();
    talk(s, 'headman');
    toQuiz(s);
    s.answerQuiz(wrongIdx('q-kham'));
    expect(kind(s)).toBe('lesson');
    expect(view(s)).toMatchObject({ speaker: 'ครูเนม', page: 1, pages: 5 });
    skipLesson(s);
    expect(kind(s)).toBe('quiz');
    expect(view(s).question).toContain('4 ซม.');
    expect(p.rpg.bossHpBonus).toBe(0);
    expect(p.rpg.coins).toBe(0);
    s.answerQuiz(rightIdx('q-kham'));
    finish(s);
    expect(s.flags.has('q-kham')).toBe(true);
    expect(s.flags.has('got-topo')).toBe(false);
  });
});

describe('ด่าน 2: ฉากที่ 2 — บ้านตาคำ · แผนที่ภูมิประเทศ', () => {
  it('ตาคำไม่ให้แผนที่ก่อนผู้ใหญ่บ้านบอกทาง (ห้ามข้ามขั้น)', () => {
    const { s } = newPlay();
    talk(s, 'ta-kham');
    expect(kind(s)).toBe('line');
    finish(s);
    expect(s.flags.has('got-topo')).toBe(false);
  });

  it('ได้แผนที่ภูมิประเทศ 1 ภาพ (ยังไม่มีตัวเลข) · ภารกิจใหม่ · บอกทางไปสถานีป่าไม้ + โจทย์ระยะ', () => {
    const { s } = playTo('kham');
    talk(s, 'ta-kham');
    const read = lines(s);
    expect(read[0]).toBe('ผู้กล้า: ตาคำครับ ผมกำลังตามหาต้นน้ำที่ถูกทิ้งสารเคมีครับ');
    expect(read[1]).toBe('ตาคำ: ตาเก็บแผนที่ภูเขาแถบนี้ไว้ แต่ตัวเลขความสูงเลือนหายไปแล้ว');
    expect(read.join(' ')).toContain('เจ้าลองไปหาเจ้าหน้าที่ป่าไม้ เขามีข้อมูลสำรวจระดับความสูง');
    expect(read.join(' ')).toContain('ทิศตะวันออก');
    expect(read.join(' ')).toContain('2 เซนติเมตร');
    expect(s.flags.has('got-topo')).toBe(true);
    // แผนที่ที่ได้: ไม่มีตัวเลขบนเส้น และไม่มีจุดระดับความสูง A/B/C จนกว่าจะทำกิจกรรม
    expect(L.topoMapFlag).toBe('got-topo');
    expect(L.contourLabelsFlag && s.flags.has(L.contourLabelsFlag)).toBe(false);
    expect(L.spotHeightsFlag && s.flags.has(L.spotHeightsFlag)).toBe(false);
    expect(view(s).choices).toEqual(['20 เมตร', '200 เมตร', '2,000 เมตร']);
    s.answerQuiz(wrongIdx('q-station'));
    expect(kind(s)).toBe('lesson'); // ตอบผิด → ทบทวนกับครูเนม
    skipLesson(s);
    s.answerQuiz(rightIdx('q-station'));
    finish(s);
    expect(s.flags.has('q-station')).toBe(true);
    s.updateQuests(true);
    const t = buildQuestTracker(s, {});
    expect([t.objective, ...t.steps].join(' ')).toContain('ตามหาเจ้าหน้าที่ป่าไม้เพื่อสอบถามระดับความสูง');
  });

  it('คุยซ้ำกับตาคำ: ไม่ให้แผนที่/รางวัลซ้ำ ไม่ถามซ้ำ · โหลดเกมกลางบทสนทนาแล้วไม่ค้าง', () => {
    const { s } = newPlay();
    for (const f of ['q-kham', 'got-topo']) s.flags.add(f); // ได้แผนที่แล้วแต่ยังไม่ได้ตอบโจทย์ระยะ (ปิดเกมกลางบทสนทนา)
    talk(s, 'ta-kham');
    const read = lines(s);
    expect(read.join(' ')).not.toContain('ผมกำลังตามหาต้นน้ำ'); // ข้ามบทแรกที่ทำไปแล้ว
    expect(kind(s)).toBe('quiz');
    s.answerQuiz(rightIdx('q-station'));
    finish(s);
    talk(s, 'ta-kham');
    expect(kind(s)).toBe('line');
    finish(s);
  });
});

describe('ด่าน 2: ฉากที่ 3 — เจ้าหน้าที่ป่าไม้ · เส้นชั้นความสูง · ความลาดชัน', () => {
  it('บทสนทนาแรก: อธิบายเส้นชั้นความสูง + บทเรียนทีละหน้า + ให้เปิดแผนที่นับเส้น (ยังไม่ถามโจทย์)', () => {
    const { s } = playTo('topo');
    talk(s, 'ranger');
    const read = lines(s);
    expect(read[0]).toBe('ผู้กล้า: ผมได้แผนที่จากตาคำ แต่ไม่รู้ว่าพื้นที่ไหนสูงหรือต่ำครับ');
    expect(read[1]).toBe('เจ้าหน้าที่ป่าไม้: เส้นบนแผนที่นี้เรียกว่าเส้นชั้นความสูง แต่ละเส้นเชื่อมจุดที่สูงจากระดับน้ำทะเลเท่ากัน');
    expect(read[2]).toBe('เจ้าหน้าที่ป่าไม้: ฉันมีผลสำรวจอยู่ ลองใช้ข้อมูลนี้อ่านแผนที่ดู');
    expect(read.filter((x) => x.startsWith('[บทเรียน'))).toHaveLength(4);
    expect(read.join(' ')).toContain('เส้นนอกสุดของภูเขาสูง 100 เมตร');
    expect(read.join(' ')).toContain('50 เมตร');
    expect(s.flags.has('contour-task')).toBe(true);
    expect(s.inDialogue).toBe(false);
    const text = L.lessons!.contour.pages.map((p) => p.text).join(' ');
    expect(text).toContain('ช่วงต่างระดับ');
    expect(text).toContain('เส้นอยู่ชิดกัน');
    expect(text).toContain('เส้นอยู่ห่างกัน');
  });

  it('ก่อนเปิดแผนที่ดูเส้น: เจ้าหน้าที่ยังไม่ถามโจทย์ ให้ไปเปิดแผนที่ก่อน · ตัวเลขยังไม่ถูกเติม', () => {
    const { s } = playTo('task');
    talk(s, 'ranger');
    expect(kind(s)).toBe('line');
    expect(view(s).text).toContain('เปิดแผนที่');
    finish(s);
    expect(s.flags.has('contour-labeled')).toBe(false);
    expect(L.trackMapOpen).toBe(true);
  });

  it('กิจกรรม 1: เส้นนอก 100 ม. ต่างเส้นละ 50 ม. เส้นในสุด = 200 ม. (ตรงกับจำนวนเส้นบนแผนที่จริง) · ตอบถูกเติมตัวเลขลงแผนที่เดิม', () => {
    const { s } = playTo('task');
    s.noteOpened('map');
    talk(s, 'ranger');
    toQuiz(s);
    const q = view(s);
    expect(q.question).toBe('ถ้าเส้นนอกสูง 100 เมตร และเส้นแต่ละชั้นต่างกัน 50 เมตร เส้นด้านในสุดสูงเท่าไร?');
    expect(q.choices).toEqual(['100 เมตร', '150 เมตร', '200 เมตร']);
    expect(quiz('q-contour').choices[rightIdx('q-contour')].label).toBe('200 เมตร');
    // เส้นบนแผนที่จริง: 100 + (3 − 1) × 50 = 200
    const interval = L.contourIntervalMeters!;
    expect(100 + (3 - 1) * interval).toBe(200);
    // ตอบผิด → เจ้าหน้าที่อธิบายสั้น ๆ แล้วลองใหม่ที่เดิม (ไม่เดินกลับ ไม่เริ่มใหม่ ไม่เพิ่ม HP บอส)
    s.answerQuiz(wrongIdx('q-contour'));
    expect(view(s).kind).toBe('quiz');
    expect(view(s).feedback).toBe('เส้นชั้นความสูงแต่ละเส้นมีช่วงต่างระดับที่แน่นอน ลองนับจำนวนช่วงระหว่างเส้นดูอีกครั้ง');
    s.answerQuiz(wrongIdx('q-contour', 1));
    expect(s.flags.has('contour-labeled')).toBe(false);
    s.answerQuiz(rightIdx('q-contour'));
    expect(s.flags.has('contour-labeled')).toBe(true); // ตัวเลขบนเส้นปรากฏในแผนที่เดิม
    expect(L.contourLabelsFlag).toBe('contour-labeled');
  });

  it('กิจกรรม 2: เส้นชิดกัน = ชัน (จุด A) · ตอบผิดอธิบายแล้วลองใหม่ · ตอบถูกได้แผนที่ตัวเลขครบ', () => {
    const { s, p } = withFlags('labeled');
    expect(s.flags.has('contour-labeled')).toBe(true);
    expect(s.flags.has('contours-learned')).toBe(false);
    talk(s, 'ranger');
    // โหลดเกมกลางบทสนทนา: ข้ามกิจกรรม 1 ที่ทำแล้ว ไปที่กิจกรรม 2 โดยตรง
    const read = lines(s);
    expect(read.join(' ')).not.toContain('นับเส้นบนภูเขาได้แล้ว');
    expect(read.join(' ')).toContain('เส้นชั้นความสูงที่อยู่ชิดกันหมายถึงพื้นที่ชัน');
    expect(read.join(' ')).toContain('รอบจุด A เส้นชั้นความสูงอยู่ชิดกัน');
    const q = view(s);
    expect(q.question).toBe('พื้นที่ใดมีความลาดชันมากกว่า?');
    expect(q.choices).toEqual(['จุด A', 'จุด B', 'ทั้งสองจุดชันเท่ากัน']);
    for (const n of [0, 1]) {
      s.answerQuiz(wrongIdx('q-slope', n));
      expect(view(s).kind).toBe('quiz');
      expect(view(s).feedback).toBe('เมื่อช่วงต่างระดับเท่ากัน เส้นที่อยู่ชิดกันแสดงว่าระดับความสูงเปลี่ยนเร็วในระยะทางสั้น จึงชันกว่า');
    }
    expect(p.rpg.bossHpBonus).toBe(0);
    s.answerQuiz(rightIdx('q-slope'));
    expect(quiz('q-slope').choices[rightIdx('q-slope')].label).toBe('จุด A');
    const end = lines(s);
    expect(end.join(' ')).toContain('เก่งมากผู้กล้า ตอนนี้เจ้ารู้แล้วว่าพื้นที่ไหนสูงหรือต่ำ ลองใช้แผนที่ตามหาต้นน้ำดู');
    expect(s.flags.has('contours-learned')).toBe(true);
    expect(L.spotHeightsFlag).toBe('contours-learned'); // จุดระดับความสูง A, B, C ปรากฏ → แผนที่ตัวเลขครบ
    expect(L.spotHeights).toEqual([L2_CHECK_A, L2_CHECK_B, L2_CHECK_C]);
  });
});

describe('ด่าน 2: ฉากที่ 4 — วิเคราะห์ทิศทางการไหลของน้ำ', () => {
  it('หลักฐาน: ลำน้ำ A ปกติ · B พบปลาตายก่อนบรรจบ · C ปลายน้ำ → โจทย์ทิศทางการไหลจากค่าความสูงจริง', () => {
    const { s } = playTo('learned');
    talk(s, 'ranger');
    const read = lines(s);
    expect(read[0]).toBe('ผู้กล้า: น้ำทั้งสองสายไหลมารวมกัน แต่เราจะรู้ได้อย่างไรว่าควรตรวจสอบที่ไหน?');
    expect(read[1]).toContain('ลำน้ำ A ไม่พบความผิดปกติ');
    expect(read[1]).toContain('ลำน้ำ B พบปลาตายและน้ำผิดปกติก่อนถึงจุดบรรจบ');
    expect(read[1]).toContain('บริเวณ C อยู่ปลายน้ำหลังจุดบรรจบ');
    expect(read[2]).toContain('ทิศทางการไหลของน้ำ');
    const q = view(s);
    expect(q.question).toBe('จากข้อมูลระดับความสูงในแผนที่ น้ำไหลจากบริเวณใดไปยังบริเวณใด?');
    expect(q.choices).toHaveLength(3);
    // ตัวเลือกใช้ช่วงความสูงจริงของจุดตรวจ (A 100–150 · B 150–200 · C ต่ำกว่า 100)
    expect(q.choices![2]).toBe('จากจุด A (100–150 ม.) และจุด B (150–200 ม.) ไปยังจุด C (ต่ำกว่า 100 ม.)');
    expect(quiz('q-flow').choices[rightIdx('q-flow')].label).toBe(q.choices![2]);
    for (const c of q.choices!) expect(c).toMatch(/\d{3}–\d{3} ม\./);
    // คำตอบถูกต้องคือที่สูง (A, B) → ที่ต่ำ (C) ตามแบบจำลองความสูงจริง
    expect(h(L2_CHECK_A)).toBeGreaterThan(h(L2_CHECK_C));
    expect(h(L2_CHECK_B)).toBeGreaterThan(h(L2_CHECK_C));
    s.answerQuiz(wrongIdx('q-flow'));
    expect(view(s).kind).toBe('quiz');
    expect(view(s).feedback).toContain('ดูตัวเลขความสูง');
    s.answerQuiz(rightIdx('q-flow'));
    expect(s.flags.has('q-flow')).toBe(true);
  });

  it('เลือกต้นทางที่ต้องตรวจสอบ: ลำน้ำ B (ถูก) · ผิด = อธิบายแล้วลองใหม่ · คำอธิบายเน้นว่าเป็นการเลือกจุดตรวจสอบ ไม่ใช่ยืนยันต้นเหตุ', () => {
    const { s } = playTo('learned');
    talk(s, 'ranger');
    toQuiz(s);
    s.answerQuiz(rightIdx('q-flow'));
    toQuiz(s);
    expect(view(s)).toMatchObject({ kind: 'quiz', question: 'จากหลักฐาน ผู้กล้าควรเริ่มตรวจสอบต้นทางของลำน้ำสายใด?' });
    expect(view(s).choices).toEqual(['ลำน้ำ A', 'ลำน้ำ B', 'จุด C หลังลำน้ำบรรจบ']);
    expect(quiz('q-source').choices[rightIdx('q-source')].label).toBe('ลำน้ำ B');
    s.answerQuiz(0);
    expect(view(s).feedback).toContain('ลำน้ำ A ไม่พบความผิดปกติ');
    s.answerQuiz(2);
    expect(view(s).feedback).toContain('ต้นน้ำของสายที่พบความผิดปกติ');
    expect(s.flags.has('q-source')).toBe(false);
    s.answerQuiz(1);
    expect(quiz('q-source').correctFeedback).toContain('ย้อนขึ้นไปทางต้นน้ำของสาย B');
    expect(quiz('q-source').correctFeedback).toContain('ยังไม่ได้ยืนยันว่าพบต้นเหตุ');
    expect(s.flags.has('q-source')).toBe(true);
  });

  it('หลังเลือกลำน้ำ B: ไม่ต้องกลับไปหาตาคำ · ได้คำบอกทางไปต้นน้ำ B (ใต้ 3 ซม. กระท่อมเฝ้าป่า ตะวันตก 2 ซม.) · โจทย์ระยะรวม', () => {
    const { s } = playTo('learned');
    talk(s, 'ranger');
    toQuiz(s);
    answer(s, 'q-flow');
    toQuiz(s);
    answer(s, 'q-source');
    const read = lines(s);
    expect(read.join(' ')).toContain('ไม่ต้องกลับไปหาตาคำอีก');
    const route = read.find((x) => x.includes('ทิศใต้'))!;
    expect(route).toContain('3 เซนติเมตร');
    expect(route).toContain('1:10,000');
    expect(route).toContain('กระท่อมเฝ้าป่า');
    expect(route).toContain('ทิศตะวันตก');
    expect(route).toContain('2 เซนติเมตร');
    const q = view(s);
    expect(q.question).toContain('ทิศใต้ 3 ซม.');
    expect(q.choices).toEqual(['50 เมตร', '500 เมตร', '5,000 เมตร']);
    s.answerQuiz(wrongIdx('q-site'));
    expect(kind(s)).toBe('lesson'); // ครูเนม
    skipLesson(s);
    s.answerQuiz(rightIdx('q-site'));
    finish(s);
    expect(s.flags.has('q-site')).toBe(true);
    // อ่านคำบอกทางซ้ำได้จากเจ้าหน้าที่ และแถบภารกิจ
    talk(s, 'ranger');
    expect(view(s).text).toContain('ทิศใต้ 3 เซนติเมตร');
    finish(s);
    s.updateQuests(true);
    const t = buildQuestTracker(s, {});
    expect([t.objective, ...t.steps].join(' ')).toContain('ทิศใต้ 3 ซม.');
  });
});

describe('ด่าน 2: ฉากที่ 5–6 — เดินไปจุดตรวจสอบ · ถังสารเคมี · ตัดสินใจ', () => {
  it('ถึงจุดตรวจสอบก่อนคำนวณระยะ/วิเคราะห์ ไม่เกิดอะไร (ห้ามข้ามขั้น)', () => {
    const { s } = withFlags('source');
    expect(s.checkArrivals(L2_SITE)).toBe(false);
    expect(s.flags.has('site-found')).toBe(false);
    const f = newPlay().s;
    expect(f.checkArrivals(L2_SITE)).toBe(false);
  });

  it('ถึงจุดตรวจสอบ: "พบร่องรอยสารเคมีบริเวณต้นน้ำ!" ปุ่มตกลง → ถังสารเคมีปรากฏ → ถามวิธีรับมือ', () => {
    const { s } = playTo('site');
    expect(s.checkArrivals({ x: L2_SITE.x + 8, y: L2_SITE.y })).toBe(false); // ยังไม่ถึง
    const decor = L.decor!.find((d) => d.kind === 'barrel')!;
    expect(s.matches(decor.showWhen)).toBe(false); // ถังยังไม่ปรากฏ
    expect(s.checkArrivals({ x: L2_SITE.x + 2, y: L2_SITE.y })).toBe(true);
    expect(s.mode).toBe('dialogue');
    expect(view(s)).toMatchObject({ kind: 'line', text: 'พบร่องรอยสารเคมีบริเวณต้นน้ำ!', button: 'ตกลง' });
    expect(s.matches(decor.showWhen)).toBe(false);
    s.advanceDialogue();
    expect(view(s).text).toBe('พบถังสารเคมีแล้ว! เราควรทำอย่างไรดี?');
    expect(s.matches(decor.showWhen)).toBe(true); // ถังปรากฏหลังกดตกลง
    expect(decor.at).toEqual(L2_BARREL);
    s.advanceDialogue();
    const q = view(s);
    expect(q.kind).toBe('quiz');
    expect(q.choices).toEqual(['เปิดถังตรวจสอบด้วยตัวเอง', 'ผลักถังลงลำธาร', 'อยู่ห่างจากถังและแจ้งเจ้าหน้าที่ให้ตรวจสอบ']);
    expect(quiz('q-chem').choices[rightIdx('q-chem')].label).toBe('อยู่ห่างจากถังและแจ้งเจ้าหน้าที่ให้ตรวจสอบ');
  });

  it('ตอบผิด: พลังมลพิษพญาจระเข้ +10 HP ทันที (แจ้งผลกระทบ) · ลองใหม่ได้ · เพดานรวม 50 ใช้ร่วมกับด่าน 1 ไม่เริ่มนับใหม่', () => {
    const { s, p } = playTo('site');
    p.addBossHp(40, 50); // ด่าน 1 ทำให้สะสมมาแล้ว 40
    s.checkArrivals(L2_SITE);
    toQuiz(s);
    s.drainToasts();
    s.answerQuiz(0);
    expect(p.rpg.bossHpBonus).toBe(50);
    expect(s.drainToasts()).toContain('พลังมลพิษพญาจระเข้ +10!');
    expect(view(s).kind).toBe('quiz');
    expect(view(s).feedback).toContain('สารเคมีอาจรั่วไหล');
    s.answerQuiz(1);
    expect(p.rpg.bossHpBonus).toBe(50); // เต็มเพดานแล้ว ไม่เกิน 50 แม้ตอบผิดซ้ำ
    expect(view(s).feedback).toContain('ปนเปื้อนไปตามน้ำ');
    expect(s.flags.has('q-chem')).toBe(false);
    s.answerQuiz(2);
    expect(quiz('q-chem').correctFeedback).toBe('ตัดสินใจถูกต้อง!');
    expect(s.flags.has('q-chem')).toBe(true);
    finish(s);
    expect(s.mode).toBe('explore');
    expect(s.checkArrivals(L2_SITE)).toBe(false); // ผ่านแล้วไม่ขึ้นซ้ำ
    // ตอบผิดเริ่มจากศูนย์ → +10 ต่อครั้ง
    const f = playTo('site');
    f.s.checkArrivals(L2_SITE);
    toQuiz(f.s);
    f.s.answerQuiz(0);
    f.s.answerQuiz(1);
    expect(f.p.rpg.bossHpBonus).toBe(20);
  });

  it('ปิดเกมระหว่างถามวิธีรับมือ (ยังไม่ตอบถูก) → โหลดแล้วเดินถึงอีกครั้งเรียกคำถามซ้ำได้ ไม่ค้าง', () => {
    const { s } = playTo('site');
    s.checkArrivals(L2_SITE);
    const s2 = newSession(L);
    expect(s2.restore(JSON.parse(JSON.stringify(s.toSnapshot())))).toBe(true);
    expect(s2.mode).toBe('explore');
    expect(s2.checkArrivals(L2_SITE)).toBe(true);
    expect(s2.mode).toBe('dialogue');
  });

  it('คำตอบถูก: ไม่มีการสัมผัสหรือเคลื่อนย้ายถังจริง (ถังเป็นภาพประกอบ ไม่มีการชน ไม่มีตัวเลือกให้เก็บ)', () => {
    const decor = L.decor!.find((d) => d.kind === 'barrel')!;
    expect(decor).toBeDefined();
    expect(L.inspectPoints).toBeUndefined();
    expect(quiz('q-chem').choices.map((c) => c.label).join(' ')).not.toMatch(/เก็บ|ย้าย/);
  });
});

describe('ด่าน 2: ฉากที่ 7 — รายงานผู้ใหญ่บ้าน · รางวัล · จบด่าน', () => {
  it('ต้องตัดสินใจถูกก่อน ผู้ใหญ่บ้านจึงรับรายงาน · ก่อนหน้านั้นพูดย้ำทางไปตาคำ ไม่ให้รางวัล', () => {
    const { s, p } = withFlags('found');
    talk(s, 'headman');
    expect(view(s).text).toContain('ตาคำ');
    finish(s);
    expect(s.flags.has('l2-report')).toBe(false);
    expect(p.rpg.coins).toBe(0);
  });

  it('รายงานผู้ใหญ่บ้าน: บทสนทนาตามเรื่อง · ได้ +100 เหรียญ +10 ศรัทธา ครั้งเดียว · จบด่านและปลดล็อกด่านถัดไป', () => {
    const { s, p } = playTo('chem');
    expect(s.flags.has('q-chem')).toBe(true);
    talk(s, 'headman');
    const read = lines(s);
    expect(read[0]).toBe('ผู้กล้า: ผู้ใหญ่ครับ ผมพบถังสารเคมีบริเวณต้นทางลำน้ำที่ผิดปกติแล้ว!');
    expect(read[1]).toBe('ผู้ใหญ่บ้าน: ขอบใจมากผู้กล้า เราจะรีบประสานเจ้าหน้าที่ และเตือนชาวบ้านให้งดใช้น้ำบริเวณที่สงสัยว่าปนเปื้อนจนกว่าจะตรวจสอบว่าปลอดภัย');
    expect(read[2]).toBe('ภารกิจสำเร็จ: ปกป้องต้นน้ำคลองน้ำไหล');
    expect(s.flags.has('l2-report')).toBe(true);
    expect(p.rpg.coins).toBe(100);
    expect(p.rpg.faith).toBe(10);
    expect(p.rpg.rewarded).toContain('level-2:final');
    expect(L.ending?.startWhen).toEqual({ flags: ['l2-report'] });
    expect(L.ending?.completeFlag).toBe('level-2-complete');
    expect(L.ending?.messages[0].text).toBe('ภารกิจสำเร็จ — ปกป้องต้นน้ำคลองน้ำไหล');
    expect(L.unlocks).toBe('level-3');
    // รายงานซ้ำ/คุยซ้ำ: ไม่ได้รางวัลซ้ำ
    talk(s, 'headman');
    finish(s);
    expect(p.rpg.coins).toBe(100);
    expect(p.rpg.faith).toBe(10);
  });

  it('คุยกับ NPC เดิมระหว่างทาง ไม่เกิดบทสนทนาผิดลำดับ', () => {
    const { s } = playTo('learned');
    // ตาคำหลังได้แผนที่: ย้ำทางไปสถานีป่าไม้ ไม่แจกแผนที่ซ้ำ
    talk(s, 'ta-kham');
    expect(view(s).text).toContain('สถานีป่าไม้');
    finish(s);
    // ผู้ใหญ่บ้านระหว่างภารกิจ: ย้ำทางไปบ้านตาคำ ไม่ถามโจทย์ใหม่ ไม่ให้รางวัล
    talk(s, 'headman');
    expect(kind(s)).toBe('line');
    finish(s);
    expect(s.flags.has('l2-report')).toBe(false);
    // เจ้าหน้าที่หลังเรียนรู้แล้ว: ไม่สอนซ้ำ ไปที่การวิเคราะห์ลำน้ำ
    talk(s, 'ranger');
    expect(view(s).text).toContain('น้ำทั้งสองสายไหลมารวมกัน');
  });
});

describe('ด่าน 2: แถบภารกิจ · บันทึก/โหลด · ผู้เล่นเรียกว่า "ผู้กล้า"', () => {
  it('แถบภารกิจแสดงคำบอกทางที่ได้รับ (อ่านซ้ำได้) และไม่เฉลยก่อนตอบถูก', () => {
    const s = newSession(L);
    const text = () => {
      const t = buildQuestTracker(s, {});
      return [t.objective, ...t.steps].join(' ');
    };
    s.updateQuests(true);
    expect(text()).toContain('ทิศตะวันออก 4 ซม.');
    expect(text()).not.toContain('400');
    s.flags.add('q-kham');
    s.updateQuests(true);
    expect(text()).toContain('ทิศตะวันออก 4 ซม.');
    s.flags.add('got-topo');
    s.flags.add('q-station');
    s.updateQuests(true);
    expect(text()).toContain('ตามหาเจ้าหน้าที่ป่าไม้เพื่อสอบถามระดับความสูง');
    s.flags.add('contour-task');
    s.updateQuests(true);
    expect(text()).toContain('นับเส้นชั้นความสูง');
    expect(text()).not.toContain('200 เมตร');
    for (const f of ['opened:map', 'contour-labeled', 'contours-learned', 'q-flow', 'q-source']) s.flags.add(f);
    s.updateQuests(true);
    expect(text()).toContain('ทิศใต้ 3 ซม.');
    expect(text()).not.toContain('500 เมตร');
    for (const f of ['q-site', 'site-found', 'q-chem']) s.flags.add(f);
    s.updateQuests(true);
    expect(text()).toContain('ทิศตะวันตก 6 ซม.');
  });

  it('บันทึก/โหลดทุกขั้นของภารกิจ: สถานะเท่าเดิม แล้วเล่นต่อจนจบด่านได้', () => {
    for (const stage of Object.keys(FLAGS) as Array<keyof typeof FLAGS>) {
      const { s } = withFlags(stage);
      const snap = JSON.parse(JSON.stringify(s.toSnapshot()));
      const r = newSession(L);
      r.wallet = new ProgressStore(null, 'sakngam');
      expect(r.restore(snap), stage).toBe(true);
      expect([...r.flags].sort(), stage).toEqual([...s.flags].sort());
      expect(r.currentStepOrder, stage).toBe(s.currentStepOrder);
      expect(r.mode).toBe('explore');
    }
    // เล่นผ่านบทสนทนาจริงแล้วบันทึก/โหลด ณ ขั้นต่าง ๆ
    for (const stage of ['kham', 'topo', 'task', 'learned', 'site', 'chem'] as const) {
      const { s } = playTo(stage);
      const r = newSession(L);
      expect(r.restore(JSON.parse(JSON.stringify(s.toSnapshot()))), stage).toBe(true);
      expect([...r.flags].sort(), stage).toEqual([...s.flags].sort());
    }
    // โหลดแล้วเล่นต่อจนจบ (จากขั้นหลังตอบโจทย์ลำน้ำ)
    const { s } = withFlags('source');
    const r = newSession(L);
    const p = new ProgressStore(null, 'sakngam');
    r.wallet = p;
    expect(r.restore(JSON.parse(JSON.stringify(s.toSnapshot())))).toBe(true);
    talk(r, 'ranger');
    toQuiz(r);
    answer(r, 'q-site');
    finish(r);
    expect(r.checkArrivals(L2_SITE)).toBe(true);
    toQuiz(r);
    answer(r, 'q-chem');
    finish(r);
    talk(r, 'headman');
    finish(r);
    expect(r.flags.has('l2-report')).toBe(true);
    expect(p.rpg.coins).toBe(100);
  });

  it('ผู้เล่นเรียกว่า "ผู้กล้า" ไม่มี "นักเรียน" ในบทพูด/โจทย์/ภารกิจ', () => {
    const all: string[] = [];
    for (const n of L.npcs) for (const v of n.dialogue) for (const node of v.nodes) if ('text' in node) all.push(node.text, node.speaker);
    for (const q of L.quizzes!) all.push(q.question, q.speaker, q.correctFeedback, ...q.choices.map((c) => c.label));
    for (const st of L.story) all.push(st.title, ...(st.micro ?? []).flatMap((m) => [m.goal, ...m.steps, m.doneText ?? '']));
    for (const t of all) expect(t).not.toContain('นักเรียน');
    expect(all.some((t) => t.includes('ผู้กล้า'))).toBe(true);
  });

  it('คำถามทุกข้อ 3 ตัวเลือก คำตอบถูก 1 ข้อ · ผิดข้อมูลมาตราส่วน = บทเรียนครูเนม (ไม่เพิ่ม HP) · ผิดเรื่องสิ่งแวดล้อม = +10 HP บอส (เพดาน 50)', () => {
    for (const q of L.quizzes!) {
      expect(q.choices, q.id).toHaveLength(3);
      expect(q.choices.filter((c) => c.id === q.correctChoiceId), q.id).toHaveLength(1);
      expect(new Set(q.choices.map((c) => c.label)).size, q.id).toBe(3);
      const bossHp = q.wrongEffects?.some((e) => e.type === 'bossHp') ?? false;
      expect(bossHp, q.id).toBe(q.id === 'q-chem');
      if (['q-kham', 'q-station', 'q-site'].includes(q.id)) expect(q.wrongLesson, q.id).toBe('scale');
      else expect(q.wrongLesson, q.id).toBeUndefined();
    }
    expect(quiz('q-chem').wrongEffects).toEqual([{ type: 'bossHp', amount: 10, cap: 50 }]);
    expect(L.lessons!.scale.speaker).toBe('ครูเนม');
  });
});
