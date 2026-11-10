import { describe, expect, it } from 'vitest';
import {
  khlongNamLaiLevel as L,
  L2_BARREL,
  L2_CONFLUENCE,
  L2_HEADMAN,
  L2_HOUSES,
  L2_KHAM,
  L2_PAEN,
  L2_RANGER,
  L2_SITE,
} from '../src/content/levels/khlongnamlai';
import { A_POINTS, B_POINTS, MAIN_POINTS } from '../src/content/levels/khlongnamlai/map';
import { validateLevel } from '../src/content/validateLevel';
import { directionFromVector, THAI_DIRECTION } from '../src/core/direction/Compass';
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
const quiz = (id: string) => L.quizzes!.find((q) => q.id === id)!;
const rightIdx = (id: string) => quiz(id).choices.findIndex((c) => c.id === quiz(id).correctChoiceId);
const wrongIdx = (id: string, n = 0) => quiz(id).choices.map((_, i) => i).filter((i) => i !== rightIdx(id))[n];
const kind = (s: GameSession) => s.dialogueView?.kind;
type View = { kind: string; text?: string; speaker?: string; question?: string; choices?: string[]; feedback?: string | null; button?: string; page?: number; pages?: number; title?: string };
const view = (s: GameSession) => s.dialogueView as View;
const talk = (s: GameSession, id: string) => s.talkTo(L.npcs.find((n) => n.id === id)!);
const toQuiz = (s: GameSession) => {
  for (let g = 0; g < 40 && s.inDialogue && kind(s) !== 'quiz'; g++) s.advanceDialogue();
};
const finish = (s: GameSession) => {
  for (let g = 0; g < 40 && s.inDialogue; g++) {
    if (kind(s) === 'quiz') throw new Error(`ติดที่คำถาม: ${view(s).question}`);
    s.advanceDialogue();
  }
};
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
const FLAGS = {
  kham: ['q-kham'],
  topo: ['q-kham', 'got-topo', 'map-revealed'],
  task: ['q-kham', 'got-topo', 'map-revealed', 'contour-task'],
  mapOpened: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map'],
  labeled: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled'],
  learned: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned'],
  paenTask: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned', 'met-paen', 'paen-task'],
  paenMap: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned', 'met-paen', 'paen-task', 'paen-map'],
  stream: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned', 'met-paen', 'paen-task', 'paen-map', 'q-stream', 'upstream-task'],
  upstreamMap: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned', 'met-paen', 'paen-task', 'paen-map', 'q-stream', 'upstream-task', 'upstream-map'],
  upstream: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned', 'met-paen', 'paen-task', 'paen-map', 'q-stream', 'upstream-task', 'upstream-map', 'q-upstream'],
  found: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned', 'met-paen', 'paen-task', 'paen-map', 'q-stream', 'upstream-task', 'upstream-map', 'q-upstream', 'site-found', 'barrel-seen'],
  done: ['q-kham', 'got-topo', 'map-revealed', 'contour-task', 'contour-map', 'contour-labeled', 'contours-learned', 'met-paen', 'paen-task', 'paen-map', 'q-stream', 'upstream-task', 'upstream-map', 'q-upstream', 'site-found', 'barrel-seen', 'q-chem'],
} as const;
function withFlags(stage: keyof typeof FLAGS) {
  const r = newPlay();
  for (const f of FLAGS[stage]) r.s.flags.add(f);
  r.s.updateQuests(true);
  return r;
}
/** เล่นด้วยบทสนทนาและการเปิดแผนที่จริง (ตอบถูกทุกข้อ) ถึงขั้นที่กำหนด */
function playTo(stage: 'kham' | 'topo' | 'task' | 'learned' | 'paenTask' | 'stream' | 'upstream' | 'chem') {
  const { s, p } = newPlay();
  const order = ['kham', 'topo', 'task', 'learned', 'paenTask', 'stream', 'upstream', 'chem'];
  const upTo = (x: string) => order.indexOf(stage) >= order.indexOf(x);
  talk(s, 'headman');
  toQuiz(s);
  answer(s, 'q-kham');
  finish(s);
  if (upTo('topo')) {
    talk(s, 'ta-kham');
    finish(s);
  }
  if (upTo('task')) {
    talk(s, 'ranger');
    finish(s);
  }
  if (upTo('learned')) {
    s.applyMapOpenMarks();
    talk(s, 'ranger');
    toQuiz(s);
    answer(s, 'q-contour');
    toQuiz(s);
    answer(s, 'q-slope');
    finish(s);
  }
  if (upTo('paenTask')) {
    talk(s, 'paen');
    finish(s);
  }
  if (upTo('stream')) {
    s.applyMapOpenMarks();
    talk(s, 'paen');
    toQuiz(s);
    answer(s, 'q-stream');
    finish(s);
  }
  if (upTo('upstream')) {
    s.applyMapOpenMarks();
    talk(s, 'paen');
    toQuiz(s);
    answer(s, 'q-upstream');
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

const nearest = (pts: Array<{ x: number; y: number }>, p: { x: number; y: number }) => Math.min(...pts.map((t) => Math.hypot(t.x - p.x, t.y - p.y)));
const A_TILES = waterwayTiles(A_POINTS);
const B_TILES = waterwayTiles(B_POINTS);
const M_TILES = waterwayTiles(MAIN_POINTS);
const isRoad = (x: number, y: number) => ['road', 'bridge'].includes(grid.getTerrain(x, y)!);

describe('ด่าน 2: แผนที่ — ทางแยก แอ่งต่ำ ที่สูง ลำน้ำ 2 สาย', () => {
  it('ข้อมูลด่านผ่านการตรวจสอบ · ทุกจุดเดินถึงได้ (บ้าน ต้นน้ำ ถังสารเคมี) · แผนที่ขนาดเดิม 80×60', () => {
    expect(validateLevel(L)).toEqual([]);
    expect([L.map.widthTiles, L.map.heightTiles]).toEqual([80, 60]);
    const reach = reachableTiles(grid, L.spawn);
    for (const n of L.npcs) expect(isPointReachable(grid, reach, n.at, 1), n.id).toBe(true);
    for (const p of [...Object.values(L2_HOUSES), L2_SITE, L2_BARREL]) expect(isPointReachable(grid, reach, p, 1), JSON.stringify(p)).toBe(true);
  });

  it('ถนนสายหลักมีทางแยกหลายทิศ (ตะวันตก กลาง ลงแอ่ง ตะวันออก) · มีทางเชื่อมและทางตัน ไม่มีเส้นทางเดียวตรงไปเป้าหมาย', () => {
    for (const x of [25, 40, 48, 62]) {
      expect(isRoad(x, 10) && isRoad(x, 11), `ถนนสายหลัก x=${x}`).toBe(true); // อยู่บนถนนสายหลัก
      expect(isRoad(x, 13), `ทางแยก x=${x}`).toBe(true); // แยกลงใต้
    }
    // ทางเชื่อมตะวันตก–กลาง (y=22) และทางลัดตะวันออก (y=35) เชื่อมเครือข่ายเป็นวง
    expect(isRoad(30, 22) || isRoad(31, 22)).toBe(true);
    expect(isRoad(58, 35)).toBe(true);
    // ปลายทางแต่ละหลังเชื่อมกับถนนต่างสาย: บ้านนางแป้นกับต้นน้ำ B ไม่ได้อยู่บนเส้นเดียวกับบ้านหลังอื่น
    const roadTiles: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (isRoad(x, y)) roadTiles.push({ x, y });
    for (const k of ['west', 'mid', 'east', 'southeast', 'paen'] as const) expect(nearest(roadTiles, L2_HOUSES[k]), k).toBeLessThanOrEqual(3);
    // ผู้เล่นเดินผิดทางได้แต่ไม่ติด: จากบ้านทุกหลัง/ทางตันกลับถนนสายหลักได้
    for (const p of [...Object.values(L2_HOUSES), { x: 29, y: 34 }, L2_SITE]) {
      expect(findPath(grid, p, { x: L2_HEADMAN.x, y: L2_HEADMAN.y + 1 }), JSON.stringify(p)).not.toBeNull();
    }
  });

  it('มีสะพานจริง: ถนนสายหลักข้ามลำน้ำสายหลัก · ทางแยกกลางข้ามลำน้ำ B · ทางเชื่อมข้ามลำน้ำ A', () => {
    const bridges: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.getTerrain(x, y) === 'bridge') bridges.push({ x, y });
    expect(bridges.some((b) => b.y <= 11 && b.y >= 10 && b.x >= 34 && b.x <= 35)).toBe(true);
    expect(bridges.some((b) => nearest(B_TILES, b) <= 1 && b.y > 12)).toBe(true);
    expect(bridges.some((b) => nearest(A_TILES, b) <= 1)).toBe(true);
    const lm = L.landmarks.find((l) => l.id === 'bridge')!;
    expect(grid.getTerrain(lm.at.x, lm.at.y)).toBe('bridge');
  });

  it('เส้นชั้นความสูงช่วงต่าง 50 ม. มีเพียง 100, 150, 200 · ภูเขาวงซ้อนกัน', () => {
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
    expect(min).toBeGreaterThan(50);
    expect(max).toBeLessThan(250);
    expect([...bands].sort().slice(1).map((b) => b * 50)).toEqual([100, 150, 200]);
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
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = (c % grid.width) + dx;
            const ny = Math.floor(c / grid.width) + dy;
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
    expect([components(r150), components(r200)]).toEqual([1, 1]); // วงใน (150 และ 200 ม.) เป็นผืนเดียวซ้อนกัน
    expect(components(r100)).toBeGreaterThanOrEqual(2); // ที่สูงมุมเหนือ + ภูเขา
    for (let i = 0; i < r100.length; i++) {
      if (r200[i]) expect(r150[i]).toBe(true);
      if (r150[i]) expect(r100[i]).toBe(true);
    }
  });

  it('ลำน้ำ A และ B ไหลลงตามความสูง (ไม่ไหลขึ้นเนิน) มาบรรจบที่เดียวกัน แล้วไหลต่อเป็นลำน้ำสายหลัก · แสดงชื่อ/จุดบรรจบบนแผนที่', () => {
    const a = analyzeWaterway(A_POINTS, elev);
    const b = analyzeWaterway(B_POINTS, elev);
    const m = analyzeWaterway(MAIN_POINTS, elev);
    for (const w of [a, b, m]) expect(w.monotonic).toBe(true);
    expect(a.mouth).toEqual(L2_CONFLUENCE);
    expect(b.mouth).toEqual(L2_CONFLUENCE);
    expect(m.source).toEqual(L2_CONFLUENCE);
    expect(a.sourceMeters).toBeGreaterThan(a.mouthMeters + 40);
    expect(b.sourceMeters).toBeGreaterThan(b.mouthMeters + 40);
    for (const pts of [A_POINTS, B_POINTS, MAIN_POINTS]) for (const t of waterwayTiles(pts)) expect(['water', 'bridge']).toContain(grid.getTerrain(t.x, t.y));
    expect(directionFromVector(m.mouth.x - m.source.x, m.mouth.y - m.source.y)).toBe('N'); // ไหลขึ้นด้านบนจอ แต่เป็นไหลจากที่สูงไปที่ต่ำ
    expect(L.waterways!.map((w) => [w.name, w.showName])).toEqual([['ลำน้ำ A', true], ['ลำน้ำ B', true], ['ลำน้ำสายหลัก', true]]);
    const conf = L.landmarks.find((l) => l.id === 'confluence')!;
    expect(conf.at).toEqual(L2_CONFLUENCE);
    expect(conf.knownWhen).toEqual({ flags: ['got-topo'] });
    // ต้นน้ำไม่ใช่ยอดเขา
    let peak = { x: 0, y: 0 };
    let best = -Infinity;
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++)
        if (h({ x, y }) > best) {
          best = h({ x, y });
          peak = { x, y };
        }
    expect(nearest([...A_TILES, ...B_TILES, ...M_TILES], peak)).toBeGreaterThan(8);
    expect(best - b.sourceMeters).toBeGreaterThan(40);
  });

  it('บ้านชาวบ้าน 5 หลัง: บ้านนางแป้นอยู่ในแอ่งต่ำสุด (< 100 ม.) หลังเดียว · ต่ำกว่าหลังอื่นชัดเจน · ใกล้ลำน้ำ B ไม่ใกล้สายอื่น', () => {
    const hs = Object.entries(L2_HOUSES).map(([k, p]) => ({ k, h: h(p) }));
    const paen = hs.find((x) => x.k === 'paen')!;
    const others = hs.filter((x) => x.k !== 'paen');
    expect(paen.h).toBeLessThan(100); // อยู่ต่ำกว่าเส้น 100 ม. = พื้นที่ต่ำสุดตามเส้นชั้นความสูง
    for (const o of others) {
      expect(o.h, o.k).toBeGreaterThanOrEqual(100); // บ้านอื่นไม่อยู่ในแอ่งต่ำ
      expect(o.h - paen.h, o.k).toBeGreaterThan(30);
    }
    // บ้านที่มีป้ายชื่อ (ผู้ใหญ่บ้าน/ตาคำ/สถานีป่าไม้) อยู่บนที่สูงกว่าเส้น 100 ม. ด้วย → ไม่ปะปนกับพื้นที่ต่ำสุด
    for (const p of [L2_HEADMAN, L2_KHAM, L2_RANGER]) expect(h(p)).toBeGreaterThan(100);
    // นางแป้นยืนหน้าบ้านนั้น · ใกล้ลำน้ำ B (≤ 4 ช่อง) และห่างลำน้ำ A/สายหลักมาก → ตอบ B ได้จากแผนที่
    expect(Math.hypot(L2_PAEN.x - L2_HOUSES.paen.x, L2_PAEN.y - L2_HOUSES.paen.y)).toBeLessThanOrEqual(2);
    expect(nearest(B_TILES, L2_PAEN)).toBeLessThanOrEqual(4);
    expect(nearest(A_TILES, L2_PAEN)).toBeGreaterThan(8);
    expect(nearest(M_TILES, L2_PAEN)).toBeGreaterThan(8);
    expect(nearest(B_TILES, L2_PAEN)).toBeLessThan(nearest(M_TILES, L2_PAEN) / 2);
    // บ้านชาวบ้านบนแผนที่ไม่มีป้ายชื่อบอกว่าเป็นบ้านใคร และปรากฏเฉพาะเมื่อได้รับแผนที่
    const houses = L.landmarks.filter((l) => l.id.startsWith('house-'));
    expect(houses).toHaveLength(5);
    expect(new Set(houses.map((l) => l.name))).toEqual(new Set(['บ้านชาวบ้าน']));
    for (const l of houses) expect(l.symbol).toBe('village');
    // ตัวเลขความสูงของบ้านปรากฏเมื่อเข้าใจความสูง (spotHeights) ครบทั้ง 5 หลัง
    expect(L.spotHeights).toEqual(Object.values(L2_HOUSES));
    expect(L.spotHeightsFlag).toBe('contours-learned');
    expect(Math.min(...hs.map((x) => x.h))).toBe(paen.h);
  });

  it('ต้นน้ำ B: ทางเดินเลียบลำน้ำจากบ้านนางแป้นขึ้นไปถึงจุดตรวจสอบ · จุดตรวจสอบสูงกว่าบ้านนางแป้นมาก · ถังอยู่ใกล้ลำธาร', () => {
    const path = findPath(grid, L2_PAEN, L2_SITE)!;
    expect(path).not.toBeNull();
    const along = path.filter((p) => nearest(B_TILES, p) <= 6).length / path.length;
    expect(along).toBeGreaterThan(0.7); // เดินเลียบลำน้ำ B ขึ้นไป
    // ตลอดเส้นทางระดับความสูงเพิ่มขึ้น (ย้อนขึ้นไปทางต้นน้ำ)
    expect(h(L2_SITE) - h(L2_PAEN)).toBeGreaterThan(60);
    expect(nearest(B_TILES, L2_SITE)).toBeLessThanOrEqual(3);
    expect(nearest(B_TILES, L2_BARREL)).toBeLessThanOrEqual(2);
    expect(nearest(A_TILES, L2_SITE)).toBeGreaterThan(15);
    expect(grid.getTerrain(L2_BARREL.x, L2_BARREL.y)).not.toBe('water');
    expect(grid.isBlocked(L2_BARREL.x, L2_BARREL.y)).toBe(false);
    expect(Math.hypot(L2_BARREL.x - L2_SITE.x, L2_BARREL.y - L2_SITE.y)).toBeLessThanOrEqual(3);
    // ต้นน้ำ B ไม่ใช่จุดสูงสุดของภูเขา (หลักฐานต้องไล่ตามลำน้ำ ไม่ใช่ขึ้นยอดเขา)
    expect(h(L2_SITE)).toBeLessThan(190);
    // ทางลัดจากถนนตะวันออกไปยังต้นน้ำ B ก็ถึงได้ (ทางเลือก)
    expect(findPath(grid, { x: 62, y: 20 }, L2_SITE)).not.toBeNull();
    // กลับบ้านผู้ใหญ่บ้านได้
    expect(findPath(grid, L2_SITE, { x: L2_HEADMAN.x, y: L2_HEADMAN.y + 1 })).not.toBeNull();
  });

  it('ผู้ใหญ่บ้าน → ตาคำ: ตะวันออก 4 ซม. = 400 ม. · ข้ามสะพานระหว่างทาง', () => {
    expect(directionFromVector(L2_KHAM.x - L2_HEADMAN.x, L2_KHAM.y - L2_HEADMAN.y)).toBe('E');
    expect(defaultScale.tilesToMeters(L2_KHAM.x - L2_HEADMAN.x)).toBe(400);
    const path = findPath(grid, L.spawn, { x: L2_KHAM.x, y: L2_KHAM.y + 1 })!;
    const bridge = path.find((p) => grid.getTerrain(p.x, p.y) === 'bridge')!;
    expect(bridge.x).toBeGreaterThan(L2_HEADMAN.x);
    expect(bridge.x).toBeLessThan(L2_KHAM.x);
  });

  it('ไม่มีลูกศร/หมุด/เป้าหมายนำทาง · ตอนเริ่มไม่มีเครื่องหมายใดบนแผนที่ · เมื่อได้รับแผนที่เห็นบ้าน/ภูเขา/ป่า/สถานี/จุดบรรจบ', () => {
    expect(L.exploreMode).toBe(true);
    const { s } = newPlay();
    for (const f of ['start', ...FLAGS.done]) {
      if (f !== 'start') s.flags.add(f);
      expect(guideTarget(s), f).toBeNull();
      expect(buildQuestTracker(s, {}).target, f).toBeNull();
    }
    expect(L.landmarks.every((l) => !l.revealFlag)).toBe(true);
    const fresh = newSession(L);
    expect(L.landmarks.filter((l) => fresh.isLandmarkOnMap(l)).map((l) => l.id)).toEqual([]);
    fresh.flags.add('got-topo');
    const onMap = L.landmarks.filter((l) => fresh.isLandmarkOnMap(l)).map((l) => l.id);
    expect(onMap).toEqual(expect.arrayContaining(['house-1', 'house-2', 'house-3', 'house-4', 'house-5', 'peak', 'forest-w', 'forest-e', 'ranger-station', 'confluence']));
    expect(L.landmarks.filter((l) => l.symbol === 'peak' || l.symbol === 'forest' || l.symbol === 'village').length).toBeGreaterThanOrEqual(8);
    // บ้านนางแป้นไม่มีป้ายพิเศษ/ลูกศร: NPC ไม่มีเครื่องหมาย (exploreMode) และบ้านชื่อเหมือนกันทุกหลัง
    expect(L.landmarks.some((l) => l.name.includes('แป้น'))).toBe(false);
  });
});

describe('ด่าน 2: ฉากที่ 1 — บ้านผู้ใหญ่บ้าน', () => {
  it('ผู้กล้าเกิดที่บ้านผู้ใหญ่บ้าน · บทสนทนาเริ่มเอง (ครั้งเดียว)', () => {
    expect(Math.hypot(L.spawn.x - L2_HEADMAN.x, L.spawn.y - L2_HEADMAN.y)).toBeLessThanOrEqual(2);
    const s = newSession(L);
    expect(s.triggerAt(L.spawn)?.npcId).toBe('headman');
    s.flags.add('q-kham');
    expect(s.triggerAt(L.spawn)).toBeUndefined();
  });

  it('บอกทิศ+ระยะ+มาตราส่วน+สะพาน ก่อนถามโจทย์ · ตอบผิด = บทเรียนครูเนมแล้วตอบข้อเดิม ไม่เพิ่ม HP บอส', () => {
    const { s, p } = newPlay();
    talk(s, 'headman');
    const read = lines(s);
    expect(read[0]).toBe('ผู้ใหญ่บ้าน: ผู้กล้า! มีคนแอบนำสารเคมีไปทิ้งบริเวณต้นน้ำ ตอนนี้น้ำในชุมชนเริ่มผิดปกติแล้ว');
    expect(read[1]).toBe('ผู้กล้า: แล้วเราจะรู้ได้อย่างไรว่าต้นน้ำอยู่ที่ไหนครับ?');
    expect(read[2]).toBe('ผู้ใหญ่บ้าน: ข้าไม่รู้ตำแหน่งแน่ชัด แต่ตาคำรู้จักป่าแถบนี้ดี ลองไปหาเขาดู');
    expect(read[3]).toMatch(/ทิศตะวันออก.*4 เซนติเมตร.*1:10,000.*สะพาน/);
    expect(view(s).choices).toEqual(['40 เมตร', '400 เมตร', '4,000 เมตร']);
    s.answerQuiz(wrongIdx('q-kham'));
    expect(view(s)).toMatchObject({ kind: 'lesson', speaker: 'ครูเนม', page: 1, pages: 5 });
    skipLesson(s);
    expect(kind(s)).toBe('quiz');
    expect(p.rpg.bossHpBonus).toBe(0);
    s.answerQuiz(rightIdx('q-kham'));
    finish(s);
    expect(s.flags.has('q-kham')).toBe(true);
    expect(s.flags.has('got-topo')).toBe(false);
  });
});

describe('ด่าน 2: ฉากที่ 2 — ตาคำมอบแผนที่ (แผนที่เด้งขึ้นกลางจอ)', () => {
  it('ตาคำไม่ให้แผนที่ก่อนผู้ใหญ่บ้านบอกทาง', () => {
    const { s } = newPlay();
    talk(s, 'ta-kham');
    finish(s);
    expect(s.flags.has('got-topo')).toBe(false);
  });

  it('บทสนทนาตามเรื่อง → ได้แผนที่ · ตั้งค่าให้แผนที่เด้งขึ้นกลางจอ "คุณได้รับแผนที่ของตาคำ!" ครั้งเดียว · ภารกิจถัดไป', () => {
    const { s } = playTo('kham');
    talk(s, 'ta-kham');
    const read = lines(s);
    expect(read).toEqual([
      'ผู้กล้า: ตาคำครับ ผมกำลังตามหาต้นน้ำที่ถูกทิ้งสารเคมีครับ',
      'ตาคำ: ตาเก็บแผนที่ภูมิประเทศแถบนี้ไว้ เจ้าลองนำไปใช้สืบหาต้นน้ำดู',
    ]);
    expect(s.inDialogue).toBe(false);
    expect(s.flags.has('got-topo')).toBe(true);
    expect(L.mapReveal).toEqual({ flag: 'got-topo', shownFlag: 'map-revealed', title: 'คุณได้รับแผนที่ของตาคำ!' });
    expect(L.topoMapFlag).toBe('got-topo'); // แสดงภูมิประเทศ/เส้นชั้นความสูงทั้งแผ่น เปิดอ่านซ้ำจากปุ่มแผนที่เดิม
    // ยังไม่มีตัวเลขความสูงกำกับเส้น และยังไม่มีตัวเลขที่บ้าน
    expect(L.contourLabelsFlag && s.flags.has(L.contourLabelsFlag)).toBe(false);
    expect(L.spotHeightsFlag && s.flags.has(L.spotHeightsFlag)).toBe(false);
    s.updateQuests(true);
    const t = buildQuestTracker(s, {});
    expect([t.objective, ...t.steps].join(' ')).toContain('ไปพบเจ้าหน้าที่ป่าไม้เพื่อสอบถามข้อมูลระดับความสูง');
    // คุยซ้ำไม่แจกแผนที่ซ้ำ
    talk(s, 'ta-kham');
    expect(view(s).text).toContain('เปิดดูซ้ำได้จากปุ่มแผนที่');
    finish(s);
  });

  it('ชื่อหัวข้อแผนที่ที่เพิ่งได้รับ (mapTitle) และปุ่ม "ตกลง" ปิดแผนที่ได้', async () => {
    const { mapTitle } = await import('../src/ui/views/mapText');
    const { buildTouchContext } = await import('../src/core/input/InputMapping');
    const { s } = withFlags('topo');
    expect(mapTitle(s)).toBe('แผนที่สำรวจ ตำบลคลองน้ำไหล');
    s.mapRevealTitle = L.mapReveal!.title;
    expect(mapTitle(s)).toBe('คุณได้รับแผนที่ของตาคำ!');
    const ctx = (reveal: boolean) =>
      buildTouchContext({
        mode: 'map',
        interact: null,
        analysis: null,
        dialogue: null,
        map: { pinStage: 'none', canSwitchSheet: false, wisdomChoices: [], reveal },
        notebook: { routeChoices: [] },
        compareChoices: [],
        grid: { choices: [], selected: null, solved: false },
      });
    expect(ctx(true).actions.find((a) => a.id === 'close')!.label).toBe('ตกลง');
    expect(ctx(false).actions.find((a) => a.id === 'close')!.label).toBe('ปิดแผนที่');
  });
});

describe('ด่าน 2: ฉากที่ 3 — เจ้าหน้าที่ป่าไม้ · เส้นชั้นความสูง (กิจกรรมสั้น ๆ)', () => {
  it('บทแรก: ผู้กล้าถาม เจ้าหน้าที่ให้ข้อมูลระดับความสูง → บทเรียนทีละหน้า → ให้เปิดแผนที่นับเส้น', () => {
    const { s } = playTo('topo');
    talk(s, 'ranger');
    const read = lines(s);
    expect(read[0]).toBe('ผู้กล้า: ผมได้แผนที่จากตาคำ แต่ยังไม่รู้ว่าพื้นที่ไหนสูงหรือต่ำครับ');
    expect(read[1]).toBe('เจ้าหน้าที่ป่าไม้: ฉันมีข้อมูลระดับความสูงจากการสำรวจ ลองนำไปอ่านคู่กับแผนที่ดู');
    expect(read.filter((x) => x.startsWith('[บทเรียน'))).toHaveLength(4);
    expect(read.join(' ')).toContain('เส้นนอกสุดของภูเขาสูง 100 เมตร');
    expect(s.flags.has('contour-task')).toBe(true);
    talk(s, 'ranger'); // ยังไม่เปิดแผนที่ → ไม่ถามโจทย์
    expect(kind(s)).toBe('line');
    expect(view(s).text).toContain('เปิดแผนที่');
    finish(s);
  });

  it('โจทย์เส้นด้านในสุด = 200 ม. (ตรงจำนวนเส้นบนแผนที่ 3 เส้น) · ตอบผิด: อธิบายสั้น ๆ แล้วลองใหม่ที่เดิม · ตอบถูกเติมตัวเลขบนเส้น', () => {
    const { s } = playTo('task');
    s.applyMapOpenMarks();
    talk(s, 'ranger');
    toQuiz(s);
    expect(view(s).question).toBe('ถ้าเส้นนอกสูง 100 เมตร และเส้นแต่ละชั้นต่างกัน 50 เมตร เส้นด้านในสุดสูงเท่าไร?');
    expect(view(s).choices).toEqual(['100 เมตร', '150 เมตร', '200 เมตร']);
    expect(100 + (3 - 1) * L.contourIntervalMeters!).toBe(200);
    s.answerQuiz(wrongIdx('q-contour'));
    expect(view(s).kind).toBe('quiz');
    expect(view(s).feedback).toBe('เส้นชั้นความสูงแต่ละเส้นมีช่วงต่างระดับที่แน่นอน ลองนับจำนวนช่วงระหว่างเส้นดูอีกครั้ง');
    expect(s.flags.has('contour-labeled')).toBe(false);
    s.answerQuiz(rightIdx('q-contour'));
    expect(s.flags.has('contour-labeled')).toBe(true);
    expect(L.contourLabelsFlag).toBe('contour-labeled');
  });

  it('ความลาดชัน: เส้นชิด = ชัน · เสร็จแล้วได้ตัวเลขความสูงของบ้าน และเจ้าหน้าที่บอกเพียงว่านางแป้นอาศัยในบริเวณต่ำสุดใกล้ลำน้ำ (ไม่บอกทิศ/บ้าน/สะพาน/สาย/เส้นทาง)', () => {
    const { s, p } = playTo('learned');
    expect(s.flags.has('contours-learned')).toBe(true);
    expect(p.rpg.bossHpBonus).toBe(0);
    const { s: s2 } = withFlags('labeled');
    talk(s2, 'ranger');
    const read = lines(s2);
    expect(read.join(' ')).toContain('เส้นชั้นความสูงที่อยู่ชิดกันหมายถึงพื้นที่ชัน');
    expect(view(s2).question).toContain('ความลาดชันมากกว่า');
    s2.answerQuiz(wrongIdx('q-slope'));
    expect(view(s2).feedback).toBe('เมื่อช่วงต่างระดับเท่ากัน เส้นที่อยู่ชิดกันแสดงว่าระดับความสูงเปลี่ยนเร็วในระยะทางสั้น จึงชันกว่า');
    s2.answerQuiz(rightIdx('q-slope'));
    const end = lines(s2).join(' ');
    expect(end).toContain('มีชาวบ้านชื่อนางแป้นอาศัยอยู่ใกล้ลำน้ำในบริเวณที่ต่ำที่สุดของพื้นที่สำรวจ ลองไปตามหาเธอดู');
    // ข้อความของเจ้าหน้าที่ทั้งหมดและทุกบรรทัดภารกิจ ห้ามเฉลยตำแหน่ง/เส้นทาง
    const texts: string[] = [];
    for (const v of L.npcs.find((n) => n.id === 'ranger')!.dialogue) for (const nd of v.nodes) if ('text' in nd) texts.push(nd.text);
    for (const st of L.story) texts.push(st.title, ...(st.micro ?? []).flatMap((m) => [m.goal, ...m.steps]));
    for (const t of texts) {
      expect(t, t).not.toMatch(/นางแป้น.*(ทิศ|ตะวัน|เหนือ|ใต้|สะพาน|ลำน้ำ [AB]|ถนน|ทางแยก)/);
    }
    expect(L.npcs.find((n) => n.id === 'ranger')!.dialogue.some((v) => v.nodes.some((nd) => 'text' in nd && /บ้านหลัง|สะพานที่|ลำน้ำ B/.test(nd.text)))).toBe(false);
  });
});

describe('ด่าน 2: ฉากที่ 4–5 — ออกตามหานางแป้น · ระบุลำน้ำ', () => {
  it('นางแป้นไม่เริ่มบทสนทนาหลักก่อนผู้กล้าได้ข้อมูลความสูง (ห้ามข้ามขั้น)', () => {
    const { s } = withFlags('topo');
    talk(s, 'paen');
    expect(kind(s)).toBe('line');
    finish(s);
    expect(s.flags.has('met-paen')).toBe(false);
  });

  it('พบนางแป้น: บทแรกตามเรื่อง → ให้เปิดแผนที่ (ยังไม่ถามโจทย์) · อัปเดตภารกิจ', () => {
    const { s } = withFlags('learned');
    talk(s, 'paen');
    const read = lines(s);
    expect(read[0]).toBe('นางแป้น: ช่วงนี้น้ำในลำธารแถวบ้านฉันเริ่มผิดปกติ ไม่รู้ว่าเกิดอะไรขึ้นจากต้นน้ำ');
    expect(read[1]).toContain('เปิดแผนที่');
    expect(s.flags.has('met-paen')).toBe(true);
    expect(s.inDialogue).toBe(false);
    talk(s, 'paen'); // ยังไม่ได้เปิดแผนที่ → ไม่ถาม
    expect(view(s).text).toContain('ยังไม่ได้เปิดแผนที่');
    finish(s);
    expect(s.flags.has('q-stream')).toBe(false);
  });

  it('คำถามว่าบ้านนางแป้นอยู่ใกล้ลำน้ำสายใด: ตัวเลือกตรงลำน้ำบนแผนที่ · ไม่มีข้อความเฉลยก่อนตอบ · ตอบผิดแล้วปิดบทสนทนา ให้ไปเปิดแผนที่สังเกตใหม่ ไม่ต้องเดินกลับไปหา NPC อื่น', () => {
    const { s } = playTo('paenTask');
    s.applyMapOpenMarks();
    expect(s.flags.has('paen-map')).toBe(true); // เปิดแผนที่แล้วจดไว้
    talk(s, 'paen');
    const read = lines(s);
    expect(read[0]).toBe('ผู้กล้า: ผมเปิดแผนที่ดูแล้วครับ');
    expect(view(s).question).toBe('บ้านนางแป้นตั้งอยู่ใกล้ลำน้ำสายใด?');
    expect(view(s).choices).toEqual(['ลำน้ำ A', 'ลำน้ำ B', 'ลำน้ำสายหลัก (หลังจุดบรรจบ)']);
    // ชื่อลำน้ำทุกตัวเลือกมีบนแผนที่ (waterways showName)
    for (const w of L.waterways!) expect(w.showName).toBe(true);
    // ไม่มีข้อความใดเฉลยว่านางแป้นอยู่ริมสายใดก่อนตอบ
    const pre = L.npcs.flatMap((n) => n.dialogue.flatMap((v) => v.nodes.filter((nd) => 'text' in nd).map((nd) => (nd as { text: string }).text)));
    for (const t of pre) expect(t, t).not.toMatch(/(บ้าน|นางแป้น).*(ริม|ใกล้)ลำน้ำ ?[AB]|ลำน้ำ ?[AB].*บ้านนางแป้น/);
    expect(quiz('q-stream').question).not.toMatch(/[AB]\b.*ใกล้|อยู่ริม/);
    // ตอบผิด → คำใบ้เป็นบรรทัดสุดท้ายแล้วจบ (ไม่ถูกบังคับให้เดินไปหา NPC อื่น) · เปิดแผนที่แล้วคุยใหม่ได้
    s.answerQuiz(wrongIdx('q-stream'));
    expect(view(s)).toMatchObject({ kind: 'line', speaker: 'นางแป้น' });
    expect(view(s).text).toContain('ลองเปิดแผนที่');
    finish(s);
    expect(s.flags.has('q-stream')).toBe(false);
    s.applyMapOpenMarks();
    talk(s, 'paen');
    toQuiz(s);
    expect(view(s).question).toBe('บ้านนางแป้นตั้งอยู่ใกล้ลำน้ำสายใด?');
    answer(s, 'q-stream');
    expect(quiz('q-stream').choices[rightIdx('q-stream')].label).toBe('ลำน้ำ B'); // ตรงกับระยะจริงบนแผนที่ (ใกล้ B)
    finish(s);
    expect(s.flags.has('q-stream')).toBe(true);
    expect(s.flags.has('upstream-task')).toBe(true);
  });
});

describe('ด่าน 2: ฉากที่ 6 — วิเคราะห์ย้อนขึ้นต้นน้ำ', () => {
  it('คำถามทิศทางไหลจากสูงลงต่ำ: ตัวเลือกคำนวณจากทิศและระดับความสูงจริงของลำน้ำบนแผนที่ · ตอบผิดปิดบทสนทนาให้ดูแผนที่ใหม่', () => {
    const { s } = playTo('stream');
    talk(s, 'paen');
    expect(view(s).text).toContain('เปิดแผนที่');
    finish(s);
    s.applyMapOpenMarks();
    talk(s, 'paen');
    toQuiz(s);
    const q = view(s);
    expect(q.question).toBe('จากข้อมูลระดับความสูงบนแผนที่ น้ำในลำน้ำสายนี้ไหลมาจากไหน และเราควรสำรวจย้อนขึ้นไปทางใด?');
    const b = analyzeWaterway(B_POINTS, elev);
    const a = analyzeWaterway(A_POINTS, elev);
    const dir = (from: { x: number; y: number }, to: { x: number; y: number }) => THAI_DIRECTION[directionFromVector(to.x - from.x, to.y - from.y)!];
    const bandOf = (v: number) => (Math.floor(v / 50) * 50 < 100 ? 'ต่ำกว่า 100 ม.' : `${Math.floor(v / 50) * 50}–${Math.floor(v / 50) * 50 + 50} ม.`);
    const correct = q.choices![rightIdx('q-upstream')];
    expect(correct).toContain(`ย้อนขึ้นไปทาง${dir(L2_PAEN, b.source)}`);
    expect(correct).toContain('ลำน้ำ B');
    expect(correct).toContain(bandOf(b.sourceMeters));
    expect(b.sourceMeters).toBeGreaterThan(h(L2_PAEN) + 50); // ต้นน้ำสูงกว่าบ้านนางแป้นจริง
    expect(q.choices!.filter((c) => c.includes('ลำน้ำ A'))).toHaveLength(1);
    expect(q.choices!.find((c) => c.includes('ลำน้ำ A'))).toContain(dir(L2_PAEN, a.source));
    expect(q.choices!.find((c) => c.startsWith('ตามน้ำ'))).toContain('ต่ำกว่า 100 ม.'); // ตามน้ำ = ไปทางต่ำ (ผิด)
    expect(new Set(q.choices).size).toBe(3);
    s.answerQuiz(wrongIdx('q-upstream'));
    expect(view(s).text).toContain('ลองเปิดแผนที่');
    finish(s);
    expect(s.flags.has('q-upstream')).toBe(false);
    s.applyMapOpenMarks();
    talk(s, 'paen');
    toQuiz(s);
    answer(s, 'q-upstream');
    const end = lines(s).join(' ');
    expect(end).toContain('ไปตรวจสอบต้นน้ำ');
    expect(s.flags.has('q-upstream')).toBe(true);
  });

  it('ต้นน้ำที่ถูกต้องสอดคล้องกับทิศไหลและหลักฐาน: ย้อนตามน้ำจากบ้านนางแป้นไปทางที่สูงขึ้นถึงจุดตรวจสอบจริง', () => {
    const b = analyzeWaterway(B_POINTS, elev);
    const dist = (p: { x: number; y: number }) => b.tiles.findIndex((t) => Math.hypot(t.x - p.x, t.y - p.y) <= 3);
    // ตำแหน่งจุดตรวจสอบอยู่ใกล้ปลายต้นน้ำมากกว่าบ้านนางแป้น (ดัชนีตามลำดับต้นน้ำ → ปลายน้ำ)
    expect(dist(L2_SITE)).toBeGreaterThanOrEqual(0);
    expect(dist(L2_PAEN)).toBeGreaterThan(dist(L2_SITE));
  });
});

describe('ด่าน 2: ฉากที่ 7 — พบต้นตอสารเคมี · ตัดสินใจ · รายงาน', () => {
  it('ถึงต้นน้ำก่อนวิเคราะห์ ไม่เกิดอะไร (ห้ามข้ามขั้น)', () => {
    for (const stage of ['learned', 'paenMap', 'stream', 'upstreamMap'] as const) {
      const { s } = withFlags(stage);
      expect(s.checkArrivals(L2_SITE), stage).toBe(false);
      expect(s.flags.has('site-found')).toBe(false);
    }
  });

  it('พบร่องรอยสารเคมี "พบร่องรอยสารเคมีบริเวณต้นน้ำ!" [ตกลง] → ถังสารเคมีปรากฏ → ถามวิธีรับมือ (ไม่มีการจับ/เปิด/ย้ายถัง)', () => {
    const { s } = withFlags('upstream');
    expect(s.checkArrivals({ x: L2_SITE.x - 10, y: L2_SITE.y })).toBe(false);
    const decor = L.decor!.find((d) => d.kind === 'barrel')!;
    expect(s.matches(decor.showWhen)).toBe(false);
    expect(s.checkArrivals({ x: L2_SITE.x - 1, y: L2_SITE.y + 1 })).toBe(true);
    expect(view(s)).toMatchObject({ kind: 'line', text: 'พบร่องรอยสารเคมีบริเวณต้นน้ำ!', button: 'ตกลง' });
    expect(s.matches(decor.showWhen)).toBe(false);
    s.advanceDialogue();
    expect(s.matches(decor.showWhen)).toBe(true);
    expect(decor.at).toEqual(L2_BARREL);
    s.advanceDialogue();
    expect(view(s).choices).toEqual(['เปิดถังตรวจสอบด้วยตัวเอง', 'ผลักถังลงลำธาร', 'อยู่ห่างจากถังและแจ้งเจ้าหน้าที่ให้ตรวจสอบ']);
    expect(L.inspectPoints).toBeUndefined();
  });

  it('ตอบผิด: พลังมลพิษพญาจระเข้ +10 HP ทันที (เพดานรวม 50 ร่วมกับด่าน 1) · ลองใหม่ได้ · ตอบถูก "ตัดสินใจถูกต้อง!"', () => {
    const { s, p } = withFlags('upstream');
    p.addBossHp(40, 50);
    s.checkArrivals(L2_SITE);
    toQuiz(s);
    s.drainToasts();
    s.answerQuiz(0);
    expect(p.rpg.bossHpBonus).toBe(50);
    expect(s.drainToasts()).toContain('พลังมลพิษพญาจระเข้ +10!');
    expect(view(s).feedback).toContain('สารเคมีอาจรั่วไหล');
    s.answerQuiz(1);
    expect(p.rpg.bossHpBonus).toBe(50);
    s.answerQuiz(2);
    expect(quiz('q-chem').correctFeedback).toBe('ตัดสินใจถูกต้อง!');
    finish(s);
    expect(s.flags.has('q-chem')).toBe(true);
    expect(s.checkArrivals(L2_SITE)).toBe(false);
    const f = withFlags('upstream');
    f.s.checkArrivals(L2_SITE);
    toQuiz(f.s);
    f.s.answerQuiz(0);
    f.s.answerQuiz(1);
    expect(f.p.rpg.bossHpBonus).toBe(20);
  });

  it('ปิดเกมระหว่างถามวิธีรับมือ → โหลดแล้วเดินถึงอีกครั้งเรียกคำถามซ้ำได้ ไม่ค้าง', () => {
    const { s } = withFlags('upstream');
    s.checkArrivals(L2_SITE);
    const s2 = newSession(L);
    expect(s2.restore(JSON.parse(JSON.stringify(s.toSnapshot())))).toBe(true);
    expect(s2.mode).toBe('explore');
    expect(s2.checkArrivals(L2_SITE)).toBe(true);
  });

  it('รายงานผู้ใหญ่บ้าน: บทสนทนาตามเรื่อง · +100 เหรียญ +10 ศรัทธา ครั้งเดียว · จบด่านปลดล็อกด่านถัดไป · ก่อนตัดสินใจถูกยังรายงานไม่ได้', () => {
    const a = withFlags('found');
    talk(a.s, 'headman');
    finish(a.s);
    expect(a.s.flags.has('l2-report')).toBe(false);
    const { s, p } = withFlags('done');
    talk(s, 'headman');
    const read = lines(s);
    expect(read[0]).toBe('ผู้กล้า: ผู้ใหญ่ครับ ผมพบถังสารเคมีบริเวณต้นทางลำน้ำที่ผิดปกติแล้ว!');
    expect(read[1]).toBe('ผู้ใหญ่บ้าน: ขอบใจมากผู้กล้า เราจะรีบประสานเจ้าหน้าที่ และเตือนชาวบ้านให้งดใช้น้ำบริเวณที่สงสัยว่าปนเปื้อนจนกว่าจะตรวจสอบว่าปลอดภัย');
    expect(read[2]).toBe('ภารกิจสำเร็จ: ปกป้องต้นน้ำคลองน้ำไหล');
    expect([p.rpg.coins, p.rpg.faith]).toEqual([100, 10]);
    expect(p.rpg.rewarded).toContain('level-2:final');
    expect(L.ending?.startWhen).toEqual({ flags: ['l2-report'] });
    expect(L.ending?.messages[0].text).toBe('ภารกิจสำเร็จ — ปกป้องต้นน้ำคลองน้ำไหล');
    expect(L.unlocks).toBe('level-3');
    talk(s, 'headman');
    finish(s);
    expect([p.rpg.coins, p.rpg.faith]).toEqual([100, 10]);
  });

  it('คุยกับ NPC เดิมระหว่างทาง ไม่เกิดบทสนทนาผิดลำดับ ไม่ให้รางวัลซ้ำ', () => {
    const { s, p } = playTo('stream');
    for (const id of ['headman', 'ta-kham', 'ranger']) {
      talk(s, id);
      expect(kind(s)).toBe('line');
      finish(s);
    }
    expect(s.flags.has('l2-report')).toBe(false);
    expect(p.rpg.coins).toBe(0);
  });
});

describe('ด่าน 2: แถบภารกิจ · บันทึก/โหลด · คำเรียก · คำถาม', () => {
  it('แถบภารกิจแสดงเป้าหมายสั้น ๆ ตามขั้น และไม่เฉลยตำแหน่งนางแป้น/ต้นน้ำ/คำตอบ', () => {
    const s = newSession(L);
    const text = () => {
      const t = buildQuestTracker(s, {});
      return [t.objective, ...t.steps].join(' ');
    };
    s.updateQuests(true);
    expect(text()).toContain('ทิศตะวันออก 4 ซม.');
    expect(text()).not.toContain('400');
    const expectations: Array<[keyof typeof FLAGS, string]> = [
      ['topo', 'ไปพบเจ้าหน้าที่ป่าไม้เพื่อสอบถามข้อมูลระดับความสูง'],
      ['task', 'นับเส้นชั้นความสูง'],
      ['learned', 'ตามหานางแป้นที่อาศัยอยู่ใกล้ลำน้ำในพื้นที่ต่ำที่สุด'],
      ['paenTask', 'เปิดแผนที่'],
      ['stream', 'ตัวเลขความสูง'],
      ['upstream', 'เดินสำรวจย้อนขึ้นไปตามลำน้ำ'],
      ['found', 'อย่าสัมผัสหรือเคลื่อนย้ายถัง'],
      ['done', 'เดินกลับไปรายงานผู้ใหญ่บ้าน'],
    ];
    for (const [stage, expected] of expectations) {
      for (const f of FLAGS[stage]) s.flags.add(f);
      s.updateQuests(true);
      expect(text(), stage).toContain(expected);
    }
    // ขั้นตามหานางแป้น: มี 5 ขั้นตอนตามเงื่อนไข และไม่บอกทิศ/บ้าน/สะพาน/สายลำน้ำ/เส้นทาง
    const s2 = withFlags('learned').s;
    s2.updateQuests(true);
    const t2 = buildQuestTracker(s2, {});
    expect(t2.steps).toEqual(['เปิดแผนที่ภูมิประเทศ', 'อ่านตัวเลขระดับความสูง', 'เปรียบเทียบพื้นที่ต่าง ๆ', 'สำรวจเส้นทางด้วยตนเอง (เลือกทางแยกเอง)', 'ค้นหาบ้านนางแป้น']);
    expect([t2.objective, ...t2.steps].join(' ')).not.toMatch(/ทิศ|ตะวัน|เหนือ|ใต้|สะพาน|ลำน้ำ [AB]/);
  });

  it('บันทึก/โหลดทุกขั้นของภารกิจ: สถานะเท่าเดิม แล้วเล่นต่อจนจบด่านได้', () => {
    for (const stage of Object.keys(FLAGS) as Array<keyof typeof FLAGS>) {
      const { s } = withFlags(stage);
      const r = newSession(L);
      r.wallet = new ProgressStore(null, 'sakngam');
      expect(r.restore(JSON.parse(JSON.stringify(s.toSnapshot()))), stage).toBe(true);
      expect([...r.flags].sort(), stage).toEqual([...s.flags].sort());
      expect(r.currentStepOrder, stage).toBe(s.currentStepOrder);
      expect(r.mode).toBe('explore');
    }
    for (const stage of ['kham', 'topo', 'task', 'learned', 'paenTask', 'stream', 'upstream', 'chem'] as const) {
      const { s } = playTo(stage);
      const r = newSession(L);
      expect(r.restore(JSON.parse(JSON.stringify(s.toSnapshot()))), stage).toBe(true);
      expect([...r.flags].sort(), stage).toEqual([...s.flags].sort());
    }
    // โหลดกลางภารกิจแล้วเล่นต่อ (หลังตอบลำน้ำ B ถูก) จนรายงาน
    const { s } = playTo('stream');
    const r = newSession(L);
    const p = new ProgressStore(null, 'sakngam');
    r.wallet = p;
    expect(r.restore(JSON.parse(JSON.stringify(s.toSnapshot())))).toBe(true);
    r.applyMapOpenMarks();
    talk(r, 'paen');
    toQuiz(r);
    answer(r, 'q-upstream');
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

  it('ผู้เล่นเรียกว่า "ผู้กล้า" ไม่มี "นักเรียน"', () => {
    const all: string[] = [];
    for (const n of L.npcs) for (const v of n.dialogue) for (const node of v.nodes) if ('text' in node) all.push(node.text, node.speaker);
    for (const q of L.quizzes!) all.push(q.question, q.speaker, q.correctFeedback, ...q.choices.map((c) => c.label));
    for (const st of L.story) all.push(st.title, ...(st.micro ?? []).flatMap((m) => [m.goal, ...m.steps, m.doneText ?? '']));
    for (const t of all) expect(t).not.toContain('นักเรียน');
    expect(all.some((t) => t.includes('ผู้กล้า'))).toBe(true);
  });

  it('คำถามทุกข้อ 3 ตัวเลือก คำตอบถูก 1 ข้อ · ผิดเรื่องมาตราส่วน = บทเรียนครูเนม · ผิดเรื่องสิ่งแวดล้อม = +10 HP บอส (เพดาน 50)', () => {
    for (const q of L.quizzes!) {
      expect(q.choices, q.id).toHaveLength(3);
      expect(q.choices.filter((c) => c.id === q.correctChoiceId), q.id).toHaveLength(1);
      expect(new Set(q.choices.map((c) => c.label)).size, q.id).toBe(3);
      expect(q.wrongEffects?.some((e) => e.type === 'bossHp') ?? false, q.id).toBe(q.id === 'q-chem');
      if (q.id === 'q-kham') expect(q.wrongLesson).toBe('scale');
    }
    expect(quiz('q-chem').wrongEffects).toEqual([{ type: 'bossHp', amount: 10, cap: 50 }]);
    expect(L.quizzes!.map((q) => q.id)).toEqual(['q-kham', 'q-contour', 'q-slope', 'q-stream', 'q-upstream', 'q-chem']);
    expect(L.npcs.map((n) => n.id)).toEqual(['headman', 'ta-kham', 'ranger', 'paen']); // NPC เท่าที่จำเป็น
  });
});
