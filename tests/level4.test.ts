import { describe, expect, it } from 'vitest';
import { finaleRows } from '../src/content/finale';
import { khlongNamLaiLevel as L2 } from '../src/content/levels/khlongnamlai';
import { khlongLanPattanaLevel as L4 } from '../src/content/levels/khlonglanpattana';
import { STREAM_POINTS } from '../src/content/levels/khlonglanpattana/map';
import { pongNamRonLevel as L3 } from '../src/content/levels/pongnamron';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { canEnterLevel, getLevelSlot, isPlayableLevel, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import type { LevelDefinition } from '../src/content/types';
import { validateLevel } from '../src/content/validateLevel';
import { describeLevel, levelState } from '../src/core/progress/LevelProgress';
import { PROGRESS_KEY, ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';
import { roadMetersBetween, straightMeters } from '../src/core/route/RouteAnalysis';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import type { GameSession, SessionSnapshot } from '../src/core/session/GameSession';
import {
  evaluateIntegratedSite,
  INTEGRATED_CHECKS,
  matchesDigitMask,
  type IntegratedEvidence,
  type SiteFacts,
} from '../src/core/site/IntegratedSiteAnalysis';
import { ElevationModel } from '../src/core/world/Elevation';
import { GridSystem } from '../src/core/world/GridSystem';
import { buildWorld } from '../src/core/world/MapBuilder';
import { isPointReachable, reachableTiles } from '../src/core/world/pathfinding';
import { analyzeWaterway } from '../src/core/world/Waterway';
import { explore, newSession, runDialogue, talk } from './helpers';

/* ตัวเลือก: scale-review [40, 400, 4000] · rp-distance [ถนน, เส้นตรง, ÷10] · flow-4 [เหนือ, ใต้, ตะวันออก] */
const SCALE_OK = 1;
const DIST_ROAD = 0;
const DIST_OK = 1;
const FLOW_NORTH = 0;
const FLOW_OK = 1;

const RP_STAND = { 1: { x: 21, y: 39 }, 2: { x: 50, y: 48 }, 3: { x: 71, y: 39 } } as const;

function readRp(s: GameSession, n: 1 | 2 | 3) {
  const p = L4.inspectPoints!.find((x) => x.id === `rp-${n}-read`)!;
  s.playerTile = { ...RP_STAND[n] };
  expect(s.inspectPointAt(s.playerTile)?.id).toBe(p.id);
  s.inspect(p);
  runDialogue(s);
}

/** เล่นถึงต้นฉากที่กำหนด (การกระทำเดียวกับผู้เล่น) */
function playTo(step: number): GameSession {
  const s = newSession(L4);
  if (step <= 1) return s;
  talk(s, 'teacher-nem', [SCALE_OK]);
  if (step <= 2) return s;
  readRp(s, 1);
  readRp(s, 2);
  readRp(s, 3);
  talk(s, 'surveyor-tonkla', [DIST_OK]);
  if (step <= 3) return s;
  talk(s, 'water-keeper', [FLOW_OK]);
  return s;
}

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const result = (levelId: string, value: string, index: number): LevelResult => ({
  levelId,
  completedAt: 'x',
  distanceMeters: 1,
  cluesFound: 1,
  cluesTotal: 1,
  mistakes: 0,
  elapsedMs: 1,
  skills: [],
  codePiece: { index, total: 4, value },
});

const world = buildWorld(L4.map);
const grid = new GridSystem(L4.grid!, L4.map.widthTiles, L4.map.heightTiles, defaultScale);
const at = (id: string) => L4.landmarks.find((l) => l.id === id)!.at;

describe('ด่าน 4: ข้อมูลพื้นฐาน มาตราส่วน และพิกัด', () => {
  it('ใช้ id level-4 ที่จองไว้ ผ่าน validateLevel และเป็นตำบลสุดท้าย (จบแล้วปลดล็อกบทสรุป)', () => {
    expect(L4.id).toBe('level-4');
    expect(getLevelSlot('level-4')?.status).toBe('available');
    expect(getLevelSlot('level-4')?.codePieceIndex).toBe(4);
    expect(LEVELS.at(-1)).toBe(L4);
    expect(L3.unlocks).toBe('level-4');
    expect(L4.unlocks).toBe('finale');
    expect(validateLevel(L4)).toEqual([]);
  });

  it('มาตราส่วน: ScaleSystem เดิม 1 ช่อง = 10 ม. · 1:10,000 (1 ซม. = 100 ม.)', () => {
    expect(defaultScale.config.metersPerTile).toBe(10);
    expect(defaultScale.config.mapScaleDenominator).toBe(10_000);
    expect(defaultScale.mapCmToMeters(4)).toBe(400);
    const s = newSession(L4);
    expect(s.scale).toBe(defaultScale);
    // ระยะบนแผนที่ (ซม.) × 100 = ระยะเส้นตรงจริง (ม.) — ค่าที่แสดงในคำถามฉาก 2
    const straight = straightMeters(at('center'), at('village'), defaultScale);
    expect(Number(s.resolveText('{{mapcm:center>village}}'))).toBeCloseTo(defaultScale.metersToMapCm(straight), 1);
    expect(s.resolveText('{{dist:center>village}}')).toBe(String(Math.round(straight / 10) * 10));
  });

  it('แผนที่ 80×60 ช่อง = 800 × 600 ม. ครอบคลุม E 5,000–5,800 · N 2,000–2,600', () => {
    expect(defaultScale.tilesToMeters(L4.map.widthTiles)).toBe(800);
    expect(grid.eastingAtColumnEdge(0)).toBe(5000);
    expect(grid.eastingAtColumnEdge(L4.map.widthTiles)).toBe(5800);
    expect(grid.northingAtRowEdge(L4.map.heightTiles)).toBe(2000);
    expect(grid.northingAtRowEdge(0)).toBe(2600);
  });

  it('พิกัดหมุดอ้างอิงคำนวณจาก GridSystem (E เพิ่มไปตะวันออก · N เพิ่มไปเหนือ)', () => {
    const s = newSession(L4);
    expect(s.resolveText('{{grid:rp-1}}')).toBe('E 5,200 · N 2,200');
    expect(s.resolveText('{{grid:rp-2}}')).toBe('E 5,500 · N 2,100');
    expect(s.resolveText('{{grid:rp-3}}')).toBe('E 5,700 · N 2,200');
    // RP-3 อยู่ตะวันออกของ RP-1 (E มากกว่า) · RP-2 อยู่ใต้ (ล่างจอ) ของทั้งสอง (N น้อยกว่า)
    expect(grid.tileToGrid(at('rp-3')).e).toBeGreaterThan(grid.tileToGrid(at('rp-1')).e);
    expect(grid.tileToGrid(at('rp-2')).n).toBeLessThan(grid.tileToGrid(at('rp-1')).n);
    for (const id of ['rp-1', 'rp-2', 'rp-3']) expect(grid.gridToTile(grid.tileToGrid(at(id)))).toEqual(at(id));
  });

  it('หลักฐานพิกัด: N = N ของ RP-2 + 250 = 2,350 (คำนวณจากหมุด ไม่ได้เขียนตายตัว)', () => {
    const s = newSession(L4);
    expect(s.integratedTargetN()).toBe(grid.tileToGrid(at('rp-2')).n + L4.integratedSiteAnalysis!.grid.dN);
    expect(s.integratedTargetN()).toBe(2350);
    expect(s.resolveText('{{ia:n}} · {{ia:emask}}')).toBe('N 2,350 · E 5,?40');
  });

  it('ค่า E ที่อ่านได้บางหลัก: "?" แทนตัวเลขใดก็ได้ 1 หลัก', () => {
    expect(matchesDigitMask(5640, '5,?40')).toBe(true);
    expect(matchesDigitMask(5240, '5,?40')).toBe(true);
    expect(matchesDigitMask(5600, '5,?40')).toBe(false);
    expect(matchesDigitMask(15640, '5,?40')).toBe(false);
    expect(matchesDigitMask(5640, '5,640')).toBe(true);
  });
});

describe('การเข้าถึงสถานที่สำคัญ', () => {
  const reach = reachableTiles(world, L4.spawn);

  it('จุดเริ่ม ชุมชน สะพาน สี่แยก พื้นที่เกษตร หมุด 3 หมุด ป้ายวัดระดับ และเป้าหมาย 3 แห่ง เดินไปถึงได้', () => {
    for (const lm of L4.landmarks) expect(isPointReachable(world, reach, lm.at, 1), lm.id).toBe(true);
  });

  it('NPC ทุกคนและจุดอ่านหมุดทุกจุดเดินไปถึงได้', () => {
    for (const n of L4.npcs) expect(isPointReachable(world, reach, n.at, 1), n.id).toBe(true);
    for (const p of L4.inspectPoints!) expect(isPointReachable(world, reach, p.at, Math.max(1, p.radiusTiles)), p.id).toBe(true);
  });

  it('มีถนน ทางแยก สะพาน ลำน้ำ พื้นที่เกษตร และเนิน', () => {
    expect(world.getTerrain(at('bridge').x, at('bridge').y)).toBe('bridge');
    expect(world.getTerrain(at('junction').x, at('junction').y)).toBe('road');
    expect(world.getTerrain(at('farm').x, at('farm').y)).toBe('rice');
    const el = new ElevationModel(L4.map.elevation!);
    expect(el.heightAt(24, 20)).toBeGreaterThan(el.heightAt(24, 44) + 30); // เนินตะวันตก
    expect(el.heightAt(67, 18)).toBeGreaterThan(el.heightAt(67, 44) + 30); // เนินตะวันออก
  });

  it('ถนนเชื่อมจากสะพานไปทุกจุดเป้าหมาย (เดินตามถนนได้จริง)', () => {
    for (const c of L4.integratedSiteAnalysis!.candidates) {
      expect(roadMetersBetween(world, defaultScale, at('bridge'), at(c.landmarkId)), c.landmarkId).not.toBeNull();
    }
  });
});

describe('หลักฐานสามประเภท (ระยะทาง · ภูมิประเทศ · พิกัด)', () => {
  const rows = () => Object.fromEntries(newSession(L4).evaluateIntegratedSites().map((r) => [r.landmarkId, r]));

  it('มีจุดเดียวที่ผ่านทุกข้อ (คำนวณจากโลกเกม) = จุด B', () => {
    const r = rows();
    expect(r['site-b'].failed).toEqual([]);
    expect(newSession(L4).siteTargetId()).toBe('site-b');
    expect(r['site-a'].failed).toEqual(['distance']);
    expect(r['site-c'].failed).toEqual(['terrain', 'grid']);
  });

  it('ตอบจากหลักฐานข้อเดียวไม่ได้: หลักฐานแต่ละชนิดชี้ได้อย่างน้อย 2 จุด', () => {
    const all = newSession(L4).evaluateIntegratedSites();
    const passing = (c: string) => all.filter((r) => !r.failed.includes(c as never)).map((r) => r.landmarkId);
    expect(passing('distance')).toEqual(['site-b', 'site-c']);
    expect(passing('terrain')).toEqual(['site-a', 'site-b']);
    expect(passing('grid')).toEqual(['site-a', 'site-b']);
    // ทุกคู่ของหลักฐานต้องใช้ร่วมกันจึงจะเหลือจุดเดียว
    for (const c of INTEGRATED_CHECKS) expect(passing(c).length).toBeGreaterThanOrEqual(2);
  });

  it('ระยะเส้นตรงกับระยะตามถนนแยกกัน: ถนนยาวกว่าเส้นตรงเสมอ และตรวจทั้งสองค่า', () => {
    const r = rows();
    for (const id of ['site-a', 'site-b', 'site-c']) {
      expect(r[id].facts.roadMeters!).toBeGreaterThan(r[id].facts.straightMeters);
    }
    expect(Math.round(r['site-b'].facts.straightMeters)).toBe(312);
    expect(r['site-b'].facts.roadMeters).toBe(430);
    // ตัวลวง: จุด A มีระยะเส้นตรงจากสะพานน้อยกว่า แต่ทิศผิด และระยะตามถนนไม่ตรง
    expect(r['site-a'].report.reasons).toEqual(['direction', 'straight', 'road']);
    // ใช้ระยะตามถนนแทนเส้นตรง (สับสนสองค่า) → จุด B ไม่ผ่าน
    const ev = newSession(L4).integratedEvidence()!;
    const swapped: IntegratedEvidence = { ...ev, distance: { ...ev.distance, straightMeters: ev.distance.roadMeters } };
    expect(evaluateIntegratedSite(r['site-b'].facts, swapped).reasons).toContain('straight');
  });

  it('ภูมิประเทศ: ทิศน้ำไหลคำนวณจากความสูง (ไหลไปทางใต้) — ทุกเป้าหมายอยู่ทางต้นน้ำของสะพาน แต่วัดใช้สัญลักษณ์ต่าง', () => {
    const ww = analyzeWaterway(STREAM_POINTS, new ElevationModel(L4.map.elevation!));
    expect(ww.flowDirection).toBe('S');
    expect(ww.monotonic).toBe(true);
    const r = rows();
    for (const id of ['site-a', 'site-b', 'site-c']) {
      expect(r[id].facts.waterRelation).toBe('upstream');
      expect(r[id].facts.elevationMeters).toBeGreaterThan(160);
    }
    expect(r['site-c'].report.reasons).toContain('symbol');
  });

  it('ฟังก์ชันตรวจบริสุทธิ์: เปลี่ยนข้อเท็จจริงทีละอย่าง → ข้อที่ไม่ผ่านเปลี่ยนตาม', () => {
    const ev = newSession(L4).integratedEvidence()!;
    const b = rows()['site-b'].facts;
    const check = (f: Partial<SiteFacts>) => evaluateIntegratedSite({ ...b, ...f }, ev).failed;
    expect(check({})).toEqual([]);
    expect(check({ direction: 'E' })).toEqual(['distance']);
    expect(check({ roadMeters: null })).toEqual(['distance']);
    expect(check({ roadMeters: 600 })).toEqual(['distance']);
    expect(check({ symbol: 'temple' })).toEqual(['terrain']);
    expect(check({ elevationMeters: 140 })).toEqual(['terrain']);
    expect(check({ waterRelation: 'downstream' })).toEqual(['terrain']);
    expect(check({ n: 2400 })).toEqual(['grid']);
    expect(check({ e: 5650 })).toEqual(['grid']);
  });

  it('คำตอบไม่ได้ hardcode: เปลี่ยนสัญลักษณ์ของ C เป็นศาลา และ A เป็นวัด → validateLevel จับได้ว่าไม่ตรงกับที่ตั้งใจ/หลายจุดผ่าน', () => {
    const changed: LevelDefinition = {
      ...L4,
      landmarks: L4.landmarks.map((l) => (l.id === 'site-c' ? { ...l, symbol: 'office' } : l)),
      integratedSiteAnalysis: { ...L4.integratedSiteAnalysis!, grid: { ...L4.integratedSiteAnalysis!.grid, eMask: '5,6?0', dN: 300 } },
    };
    const s = newSession(changed);
    expect(s.evaluateIntegratedSites().filter((r) => r.failed.length === 0).map((r) => r.landmarkId)).toEqual(['site-c']);
    expect(validateLevel(changed).some((e) => e.includes('ไม่ตรงกับผลคำนวณ'))).toBe(true);
  });

  it('validateLevel จับกรณีหลักฐานข้อเดียวชี้คำตอบได้ทันที', () => {
    const exact: LevelDefinition = {
      ...L4,
      integratedSiteAnalysis: { ...L4.integratedSiteAnalysis!, grid: { ...L4.integratedSiteAnalysis!.grid, eMask: '5,640' } },
    };
    expect(validateLevel(exact).some((e) => e.includes('เพียงข้อเดียวชี้ได้ 1 จุด'))).toBe(true);
  });

  it('ข้อความหลักฐานใช้ตัวเลขจากข้อมูลปริศนาเดียวกับที่ใช้ตรวจ', () => {
    const s = newSession(L4);
    const clue = (id: string) => s.resolveText(L4.clues!.find((c) => c.id === id)!.text);
    expect(clue('clue-distance')).toBe('จากสะพาน ไปทางทิศตะวันออกเฉียงเหนือ · เส้นตรงราว 310 ม. · เดินตามถนนราว 430 ม.');
    expect(clue('clue-terrain')).toContain('สูงกว่า 160 ม.');
    expect(clue('clue-grid')).toContain('E 5,?40');
    for (const c of L4.clues!) expect(s.resolveText(c.text)).not.toMatch(/\{\{/);
  });
});

describe('ฉาก 1–3', () => {
  it('ฉาก 1: ครูเนมมอบแผนที่ที่เสียหาย + ทบทวนมาตราส่วน (ตอบผิดได้คำใบ้)', () => {
    const s = newSession(L4);
    expect(s.currentStepOrder).toBe(1);
    talk(s, 'teacher-nem', [0, SCALE_OK]);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.evidence).toContain('damaged-map');
    expect(s.clues).toEqual(expect.arrayContaining(['clue-mission', 'clue-rps']));
    expect(s.currentStepOrder).toBe(2);
  });

  it('ข้อความบอกชัดว่าแหล่งเรียนรู้เป็นข้อมูลจำลอง', () => {
    const texts = [...L4.npcs.flatMap((n) => n.dialogue.flatMap((d) => d.nodes.map((x) => ('text' in x ? x.text : '')))), ...L4.evidence!.map((e) => e.description)];
    expect(texts.some((t) => t.includes('ข้อมูลจำลอง'))).toBe(true);
    expect(L4.evidence!.find((e) => e.id === 'wisdom-record')!.name).toContain('ข้อมูลจำลอง');
  });

  it('ฉาก 2: ต้องอ่านหมุดครบ 3 หมุด และตอบระยะเส้นตรงถูก (ตอบระยะตามถนน = ผิด)', () => {
    const s = playTo(2);
    readRp(s, 1);
    readRp(s, 2);
    talk(s, 'surveyor-tonkla', [DIST_ROAD, DIST_OK]);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.currentStepOrder).toBe(2);
    readRp(s, 3);
    expect(s.currentStepOrder).toBe(3);
    expect(s.clues).toEqual(expect.arrayContaining(['clue-straight-road', 'clue-distance', 'clue-rp-1', 'clue-rp-2', 'clue-rp-3']));
  });

  it('ตัวเลือกคำถามระยะคำนวณจากแผนที่: ระยะตามถนนยาวกว่าเส้นตรง', () => {
    const s = newSession(L4);
    const q = L4.quizzes!.find((x) => x.id === 'rp-distance')!;
    const [road, straight, tenth] = q.choices.map((c) => Number(s.resolveText(c.label).replace(/[^\d]/g, '')));
    expect(road).toBe(s.roadMetersBetweenLandmarks('center', 'village'));
    expect(road).toBeGreaterThan(straight * 1.3);
    expect(tenth * 10).toBeCloseTo(straight, -1);
  });

  it('NPC ฉากถัดไปไม่ให้หลักฐานก่อนถึงฉาก', () => {
    const s = newSession(L4);
    talk(s, 'surveyor-tonkla');
    talk(s, 'water-keeper');
    talk(s, 'record-keeper');
    expect(s.clues).toEqual([]);
    s.playerTile = { ...RP_STAND[1] };
    expect(s.inspectPointAt(s.playerTile)).toBeUndefined(); // หมุดเปิดตั้งแต่ฉาก 2
  });

  it('ฉาก 3: ความสูงสองป้าย → ทิศน้ำไหล (ตอบตามจอผิด) → หลักฐานภูมิประเทศ/สัญลักษณ์', () => {
    const s = playTo(3);
    talk(s, 'water-keeper', [FLOW_NORTH, FLOW_OK]);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.clues).toEqual(expect.arrayContaining(['clue-elev', 'clue-terrain']));
    expect(Number(s.resolveText('{{elev:bm-up}}'))).toBeGreaterThan(Number(s.resolveText('{{elev:bm-down}}')));
    expect(s.currentStepOrder).toBe(4);
    expect(s.questStatus.get('mystery-levels')).toBe('active');
    explore(s, 'bm-up');
    explore(s, 'bm-down');
    expect(s.questStatus.get('mystery-levels')).toBe('completed');
  });

  it('ภารกิจรอง: สำรวจโครงข่ายถนน', () => {
    const s = playTo(3);
    expect(s.questStatus.get('side-roads')).toBe('active');
    explore(s, 'junction');
    explore(s, 'farm');
    expect(s.questStatus.get('side-roads')).toBe('completed');
  });

  it('ก่อนจบฉาก 6 เรียกตอนจบโดยตรงไม่ได้ (รหัสชิ้นที่ 4 ได้จากเงื่อนไขจบบทเท่านั้น)', () => {
    const s = playTo(4);
    expect(s.isPinAvailable()).toBe(false);
    expect(s.startEnding()).toBe(false);
    expect(s.completed).toBe(false);
    expect(s.mode).toBe('explore');
    expect(L4.ending!.codePiece).toEqual({ index: 4, total: 4, value: 'ลาน' });
  });
});

describe('ปลดล็อก บันทึก/โหลด และความเข้ากันได้', () => {
  it('ด่าน 4 ปลดล็อกเมื่อจบด่าน 3 เท่านั้น', () => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    expect(canEnterLevel('level-4', store.data)).toBe(false);
    store.completeLevel(result('sakngam', 'ลาย', 1), sakNgamLevel.unlocks);
    store.completeLevel(result('level-2', 'น้ำ', 2), L2.unlocks);
    expect(canEnterLevel('level-4', store.data)).toBe(false);
    store.completeLevel(result('level-3', 'พิกัด', 3), L3.unlocks);
    expect(canEnterLevel('level-4', store.data)).toBe(true);
    const cards = LEVEL_SEQUENCE.map((slot, i) =>
      describeLevel(slot, store.data, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null),
    );
    expect(cards.map((c) => c.state)).toEqual(['completed', 'completed', 'completed', 'unlocked']);
  });

  it('ระบบกันเข้าด่านที่ไม่มีเนื้อหายังทำงาน (ช่องที่ยังเป็น planned / id ที่ไม่มี)', () => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.data.unlocked.push('level-5');
    expect(isPlayableLevel('level-5')).toBe(false);
    expect(canEnterLevel('level-5', store.data)).toBe(false);
    const planned = { ...LEVEL_SEQUENCE[3], status: 'planned' as const };
    store.completeLevel(result('level-3', 'พิกัด', 3), L3.unlocks);
    expect(levelState(planned, store.data, false)).toBe('in-development');
  });

  it('บันทึกกลางฉาก 2 และฉาก 3 แล้วโหลดกลับ เล่นต่อได้ไม่หาย', () => {
    const a = playTo(2);
    readRp(a, 1);
    a.playerTile = { x: 30, y: 44 };
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.saveInProgress('level-4', JSON.parse(JSON.stringify(a.toSnapshot())));
    const b = newSession(L4);
    expect(b.restore(store.loadInProgress('level-4') as SessionSnapshot)).toBe(true);
    expect(b.currentStepOrder).toBe(2);
    expect(b.flags.has('read-rp-1')).toBe(true);
    expect(b.playerTile).toEqual({ x: 30, y: 44 });
    readRp(b, 2);
    readRp(b, 3);
    talk(b, 'surveyor-tonkla', [DIST_OK]);
    expect(b.currentStepOrder).toBe(3);
    const c = newSession(L4);
    expect(c.restore(JSON.parse(JSON.stringify(b.toSnapshot())))).toBe(true);
    talk(c, 'water-keeper', [FLOW_OK]);
    expect(c.currentStepOrder).toBe(4);
    expect(c.toSnapshot().contentVersion).toBe(1);
  });

  it('บันทึกด่าน 4 ที่ contentVersion ไม่ตรง หรือเป็นของด่านอื่น → ไม่โหลด', () => {
    const snap = { ...playTo(3).toSnapshot(), contentVersion: 99 };
    expect(newSession(L4).restore(snap)).toBe(false);
    expect(newSession(L4).restore(newSession(L3).toSnapshot())).toBe(false);
  });

  it('บันทึกเดิม (ProgressStore v2 จากรุ่นก่อน ที่ปลดล็อก level-4 ไว้แล้ว) โหลดได้ ข้อมูลด่าน 1–3 ครบ และเข้าด่าน 4 ได้', () => {
    const storage = new MemoryStorage();
    const old = new ProgressStore(storage, 'sakngam');
    old.completeLevel(result('sakngam', 'ลาย', 1), 'level-2');
    old.completeLevel(result('level-2', 'น้ำ', 2), 'level-3');
    old.saveInProgress('level-3', newSession(L3).toSnapshot());
    old.completeLevel(result('level-3', 'พิกัด', 3), 'level-4');
    const raw = storage.getItem(PROGRESS_KEY)!;
    // โหลดจากข้อความที่บันทึกไว้ (เหมือนเปิดเกมรุ่นใหม่)
    const fresh = new MemoryStorage();
    fresh.setItem(PROGRESS_KEY, raw);
    const store = new ProgressStore(fresh, 'sakngam');
    expect(store.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ', 'พิกัด']);
    expect(store.isCompleted('level-3')).toBe(true);
    expect(canEnterLevel('level-4', store.data)).toBe(true);
    // บันทึกกลางด่าน 4 ไม่กระทบข้อมูลด่านอื่น
    store.saveInProgress('level-4', playTo(3).toSnapshot());
    expect(store.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ', 'พิกัด']);
    expect(store.continueLevelId()).toBe('level-4');
  });

  it('บันทึกกลางด่านของด่าน 1–3 ยังโหลดได้ตามเดิม', () => {
    for (const L of [sakNgamLevel, L2, L3]) {
      const s = newSession(L);
      const snap = JSON.parse(JSON.stringify(s.toSnapshot()));
      expect(newSession(L).restore(snap), L.id).toBe(true);
    }
  });

  it('ข้อมูลฉากจบ: แผนที่ภูมิปัญญา 4 ตำบล + รหัสจากข้อมูลตอนจบของแต่ละด่าน', () => {
    const rows = finaleRows();
    expect(rows.map((r) => r.levelId)).toEqual(['sakngam', 'level-2', 'level-3', 'level-4']);
    expect(rows.map((r) => r.code)).toEqual(['ลาย', 'น้ำ', 'พิกัด', 'ลาน']);
    expect(rows.map((r) => r.codeIndex)).toEqual([1, 2, 3, 4]);
    for (const r of rows) expect(r.site).toContain('ข้อมูลจำลอง');
  });
});
