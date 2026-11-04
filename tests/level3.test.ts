import { describe, expect, it } from 'vitest';
import { khlongNamLaiLevel as L2 } from '../src/content/levels/khlongnamlai';
import { pongNamRonLevel as L3 } from '../src/content/levels/pongnamron';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { canEnterLevel, getLevelSlot, isPlayableLevel, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import type { LevelDefinition } from '../src/content/types';
import { validateLevel } from '../src/content/validateLevel';
import { describeLevel } from '../src/core/progress/LevelProgress';
import { ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';
import { defaultScale, ScaleSystem } from '../src/core/scale/ScaleSystem';
import type { GameSession, SessionSnapshot } from '../src/core/session/GameSession';
import { GridSystem } from '../src/core/world/GridSystem';
import { buildWorld } from '../src/core/world/MapBuilder';
import { evaluateGridSite } from '../src/core/site/GridSiteAnalysis';
import { buildGridBoard, explainGridChoice, gridHint } from '../src/core/site/gridBoard';
import { explore, newSession, runDialogue, talk } from './helpers';

/* ตัวเลือกคำถาม: grid-axes [นับ N จากบน, สลับ E/N, ถูก] · north-100 [N ลด, N เพิ่ม, E เพิ่ม] */
const AXES_TOP = 0;
const AXES_OK = 2;
const NORTH_DOWN = 0;
const NORTH_UP = 1;
/* หน้าตรวจพิกัด: ลำดับจุด A, B, C · ประเภทสถานที่ตอนปักหมุด: 1 = บ่อน้ำร้อนธรรมชาติ */
const SITE = { a: 0, b: 1, c: 2 };
const HOT_SPRING = 1;
const FOOT_BATH = 2;

const POS = {
  'rp-1-read': { x: 21, y: 39 },
  'rp-2-read': { x: 41, y: 49 },
  'rp-3-read': { x: 71, y: 39 },
  'survey-a': { x: 66, y: 41 },
  'survey-b': { x: 66, y: 18 },
  'survey-c': { x: 73, y: 28 },
} as const;

function inspect(s: GameSession, id: keyof typeof POS) {
  const p = L3.inspectPoints!.find((x) => x.id === id)!;
  s.playerTile = { ...POS[id] };
  expect(s.inspectPointAt(s.playerTile)?.id).toBe(id);
  s.inspect(p);
  runDialogue(s);
}

/** เล่นถึงต้นฉากที่กำหนด (ใช้การกระทำเดียวกับที่ผู้เล่นทำ) */
function playTo(step: number): GameSession {
  const s = newSession(L3);
  if (step <= 1) return s;
  talk(s, 'teacher-nem', [AXES_OK]);
  if (step <= 2) return s;
  explore(s, 'rp-1');
  inspect(s, 'rp-1-read');
  explore(s, 'rp-2');
  inspect(s, 'rp-2-read');
  explore(s, 'rp-3');
  inspect(s, 'rp-3-read');
  talk(s, 'villager-son');
  if (step <= 3) return s;
  talk(s, 'record-keeper', [NORTH_UP]);
  if (step <= 4) return s;
  survey(s, 'a');
  s.chooseGridSite(SITE.a); // ตั้งใจเลือกผิด 1 ครั้ง
  survey(s, 'b');
  s.chooseGridSite(SITE.b);
  if (step <= 5) return s;
  s.playerTile = { x: 66, y: 19 };
  s.startGridVerify('site-b');
  runDialogue(s);
  s.submitPin({ x: 66, y: 18 }, HOT_SPRING);
  if (step <= 6) return s;
  s.startEnding();
  runDialogue(s);
  return s;
}

/** สำรวจจุดเป้าหมาย (เดินไปเปิดหมอก + กด E ที่จุด) */
function survey(s: GameSession, site: 'a' | 'b' | 'c') {
  explore(s, `site-${site}`, 4);
  inspect(s, `survey-${site}`);
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

const grid = new GridSystem(L3.grid!, L3.map.widthTiles, L3.map.heightTiles, defaultScale);

describe('ระบบพิกัดกริด (GridSystem)', () => {
  it('1 ช่อง = 10 ม. ใช้ ScaleSystem เดียวกับด่านอื่น (1:10,000)', () => {
    expect(defaultScale.config.metersPerTile).toBe(10);
    expect(defaultScale.config.mapScaleDenominator).toBe(10_000);
    expect(grid.scale).toBe(defaultScale);
  });

  it('จุดกำเนิดอยู่มุมตะวันตกเฉียงใต้: ช่องซ้ายล่าง = E0, N0', () => {
    expect(grid.tileToGrid({ x: 0, y: L3.map.heightTiles - 1 })).toEqual({ e: 4000, n: 1000 });
    expect(grid.tileToGrid({ x: 0, y: 0 })).toEqual({ e: 4000, n: 1000 + (L3.map.heightTiles - 1) * 10 });
  });

  it('แกน X: เดินไปทางตะวันออก (ขวา) 1 ช่อง → E เพิ่ม 10 ม. · N ไม่เปลี่ยน', () => {
    const a = grid.tileToGrid({ x: 30, y: 30 });
    const b = grid.tileToGrid({ x: 31, y: 30 });
    expect(b.e - a.e).toBe(10);
    expect(b.n).toBe(a.n);
  });

  it('แกน Y: เดินไปทางเหนือ (ขึ้นจอ = y ของ Phaser ลดลง) 1 ช่อง → N เพิ่ม 10 ม.', () => {
    const a = grid.tileToGrid({ x: 30, y: 30 });
    const north = grid.tileToGrid({ x: 30, y: 29 });
    const south = grid.tileToGrid({ x: 30, y: 31 });
    expect(north.n - a.n).toBe(10);
    expect(south.n - a.n).toBe(-10);
    expect(north.e).toBe(a.e);
    // พิกเซล: py ลดลง (ขึ้นจอ) → N เพิ่ม
    const tp = defaultScale.config.tileSizePx;
    expect(grid.pxToGrid(100, 100 - tp).n - grid.pxToGrid(100, 100).n).toBe(10);
  });

  it('แปลงไป-กลับครบทุกช่อง: tile → grid → tile', () => {
    for (let y = 0; y < L3.map.heightTiles; y++) {
      for (let x = 0; x < L3.map.widthTiles; x++) {
        expect(grid.gridToTile(grid.tileToGrid({ x, y }))).toEqual({ x, y });
      }
    }
  });

  it('แปลงไป-กลับ: พิกเซล ↔ grid และพิกัดกลางช่องอยู่ในช่องเดิม', () => {
    for (const [px, py] of [[0, 0], [123.5, 456.25], [17, 959], [1279, 1]] as const) {
      const g = grid.pxToGrid(px, py);
      const back = grid.gridToPx(g);
      expect(back.x).toBeCloseTo(px, 6);
      expect(back.y).toBeCloseTo(py, 6);
    }
    const tp = defaultScale.config.tileSizePx;
    const center = grid.pxToGrid(40 * tp + tp / 2, 20 * tp + tp / 2);
    expect(grid.gridToTile(center)).toEqual({ x: 40, y: 20 });
  });

  it('แบบ "นับ N จากขอบบน" (ความผิดพลาดที่พบบ่อย) แปลงไป-กลับได้ และต่างจากแบบมาตรฐาน', () => {
    const t = { x: 66, y: 18 };
    expect(grid.topCountedGridToTile(grid.tileToTopCountedGrid(t))).toEqual(t);
    expect(grid.tileToTopCountedGrid(t)).not.toEqual(grid.tileToGrid(t));
  });

  it('ระยะจริงจากพิกัด: E ต่าง 300 ม. N ต่าง 400 ม. → 500 ม. และตรงกับ ScaleSystem', () => {
    expect(grid.distanceMeters({ e: 4000, n: 1000 }, { e: 4300, n: 1400 })).toBe(500);
    const a = { x: 10, y: 50 };
    const b = { x: 40, y: 10 };
    expect(grid.distanceMeters(grid.tileToGrid(a), grid.tileToGrid(b))).toBeCloseTo(
      defaultScale.tilesToMeters(Math.hypot(b.x - a.x, b.y - a.y)),
      6,
    );
  });

  it('ใช้มาตราส่วนอื่นได้ (ไม่ hardcode 10 ม.)', () => {
    const g = new GridSystem({ falseEasting: 0, falseNorthing: 0 }, 10, 10, new ScaleSystem({ ...defaultScale.config, metersPerTile: 25 }));
    expect(g.tileToGrid({ x: 1, y: 8 })).toEqual({ e: 25, n: 25 });
  });

  it('รูปแบบที่แสดง: E ก่อน N พร้อมตัวคั่นหลักพัน (พิกัดจำลอง ไม่ใช่ละติจูด/ลองจิจูด)', () => {
    expect(GridSystem.format({ e: 4660, n: 1410 })).toBe('E 4,660 · N 1,410');
  });
});

describe('ด่าน 3: ข้อมูลพื้นฐาน', () => {
  it('ใช้ id level-3 ที่จองไว้ และผ่าน validateLevel', () => {
    expect(L3.id).toBe('level-3');
    expect(getLevelSlot('level-3')?.status).toBe('available');
    expect(LEVELS.map((l) => l.id)).toEqual(['sakngam', 'level-2', 'level-3', 'level-4']);
    expect(validateLevel(L3)).toEqual([]);
  });

  it('แผนที่มีจุดเริ่ม ชุมชน ลำห้วย สะพาน ถนน ป่า เขา จุดอ้างอิง และเป้าหมาย 3 แห่ง', () => {
    const ids = L3.landmarks.map((l) => l.id);
    for (const id of ['school', 'village', 'hall', 'bridge', 'rp-1', 'rp-2', 'rp-3', 'site-a', 'site-b', 'site-c']) {
      expect(ids).toContain(id);
    }
    const terrains = new Set(L3.map.features.map((f) => ('terrain' in f ? f.terrain : f.kind)));
    for (const k of ['water', 'road', 'building', 'scatter']) expect([...terrains].some((x) => x.includes(k))).toBe(true);
    // สะพานเกิดเองตรงที่ถนนตัดลำห้วย — ตำแหน่งสัญลักษณ์สะพานต้องเป็นสะพานจริง
    const world = buildWorld(L3.map);
    const b = L3.landmarks.find((l) => l.id === 'bridge')!.at;
    expect(world.getTerrain(b.x, b.y)).toBe('bridge');
    expect(L3.map.elevation).toBeDefined();
  });

  it('พิกัดที่แสดงตรงกับตำแหน่งจริงบนแผนที่ (คำนวณจาก GridSystem)', () => {
    const s = newSession(L3);
    expect(s.resolveText('{{grid:school}}')).toBe('E 4,140 · N 1,090');
    expect(s.resolveText('{{grid:site-b}}')).toBe(GridSystem.format(grid.tileToGrid(L3.landmarks.find((l) => l.id === 'site-b')!.at)));
    expect(s.resolveText('{{gridrecord}}')).toBe('E 4,660 · N 1,180');
    // โรงเรียนอยู่ใต้ (ล่างจอ) ของจุด B → N ของโรงเรียนน้อยกว่า
    expect(grid.tileToGrid({ x: 14, y: 50 }).n).toBeLessThan(grid.tileToGrid({ x: 66, y: 18 }).n);
  });

  it('ไม่มีการเปลี่ยนเนื้อหาด่าน 1–2', () => {
    expect(sakNgamLevel.grid).toBeUndefined();
    expect(L2.grid).toBeUndefined();
    expect(L2.contentVersion).toBe(2);
    expect(L2.unlocks).toBe('level-3');
  });
});

describe('ฉาก 1–3 (ภารกิจเริ่มต้น)', () => {
  it('ฉาก 1: ครูเนมให้แผนที่กริด บันทึกเก่า และถามพิกัดเสาธง — ตอบแบบนับ N จากบนผิดและได้คำใบ้', () => {
    const s = newSession(L3);
    expect(s.currentStepOrder).toBe(1);
    talk(s, 'teacher-nem', [AXES_TOP, AXES_OK]);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.evidence).toEqual(expect.arrayContaining(['grid-map', 'old-record']));
    expect(s.clues).toEqual(expect.arrayContaining(['clue-grid-rule', 'clue-record', 'clue-rps']));
    expect(s.currentStepOrder).toBe(2);
  });

  it('ตัวเลือกคำถามพิกัดคำนวณจากแผนที่ (ถูก / นับ N จากบน / สลับแกน)', () => {
    const s = newSession(L3);
    const q = L3.quizzes!.find((x) => x.id === 'grid-axes')!;
    expect(q.choices.map((c) => s.resolveText(c.label))).toEqual(['E 4,140 · N 1,500', 'E 1,090 · N 4,140', 'E 4,140 · N 1,090']);
  });

  it('ฉาก 2: ต้องอ่านหมุดครบ 3 หมุดและคุยกับลุงสอน', () => {
    const s = playTo(2);
    explore(s, 'rp-1');
    inspect(s, 'rp-1-read');
    talk(s, 'villager-son');
    expect(s.currentStepOrder).toBe(2);
    inspect(s, 'rp-2-read');
    inspect(s, 'rp-3-read');
    expect(s.currentStepOrder).toBe(3);
    expect(s.clues).toEqual(expect.arrayContaining(['clue-rp-1', 'clue-rp-2', 'clue-rp-3', 'clue-footbath']));
  });

  it('ผู้เก็บบันทึกไม่ให้เบาะแสก่อนตรวจหมุดอ้างอิง', () => {
    const s = playTo(2);
    talk(s, 'record-keeper');
    expect(s.clues).not.toContain('clue-convention');
  });

  it('ฉาก 3: ป้าเรือนให้เบาะแสพิกัดที่อาจบันทึกผิด ตำแหน่งสัมพัทธ์ และสิ่งที่ต้องพบ', () => {
    const s = playTo(3);
    talk(s, 'record-keeper', [NORTH_DOWN, NORTH_UP]);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.clues).toEqual(expect.arrayContaining(['clue-convention', 'clue-relative', 'clue-field']));
    expect(s.flags.has('record-checked')).toBe(true);
    expect(s.currentStepOrder).toBe(4);
    expect(s.resolveText(L3.clues!.find((c) => c.id === 'clue-relative')!.text)).toBe(
      'จากหมุด RP-2 ไปทางทิศตะวันออกเฉียงเหนือ ราว 400 เมตร',
    );
  });

  it('ภารกิจรอง: เดินตามพิกัดไปจุดชมวิว', () => {
    const s = playTo(2);
    expect(s.questStatus.get('side-viewpoint')).toBe('locked');
    talk(s, 'ranger-khiao');
    expect(s.questStatus.get('side-viewpoint')).toBe('active');
    explore(s, 'viewpoint');
    expect(s.questStatus.get('side-viewpoint')).toBe('completed');
  });
});

describe('เบาะแสในสมุด', () => {
  it('เบาะแสพิกัดเป็นชนิด "พิกัดกริด" และไม่ซ้ำ', () => {
    const s = playTo(4);
    expect(new Set(s.clues).size).toBe(s.clues.length);
    const types = new Set(s.clues.map((id) => L3.clues!.find((c) => c.id === id)!.type));
    expect(types.has('coordinate')).toBe(true);
    expect(s.clues.every((id) => L3.clues!.some((c) => c.id === id))).toBe(true);
  });

  it('ไม่มีเบาะแสใดบอกตรง ๆ ว่าจุดใดคือคำตอบ', () => {
    const s = newSession(L3);
    for (const c of L3.clues!) expect(s.resolveText(c.text)).not.toMatch(/จุด [ABC] คือ|คำตอบ/);
  });
});

describe('จุดเป้าหมาย 3 แห่ง: ต้องตรงทั้งพิกัด ทิศ/ระยะ และหลักฐานภาคสนาม', () => {
  it('จุด B ผ่านทั้ง 3 ข้อ · A ตรงพิกัดในบันทึกเมื่ออ่านตามตัวอักษร · C ตรงทิศ/ระยะและมีไอน้ำ', () => {
    const s = newSession(L3);
    const rows = Object.fromEntries(s.evaluateGridSites().map((r) => [r.landmarkId, r]));
    expect(rows['site-b'].failed).toEqual([]);
    // A = ตัวล่อ: อ่านพิกัดตามที่เขียนแบบมาตรฐาน ตกที่ A พอดี
    expect(grid.gridToTile(L3.gridSiteAnalysis!.record)).toEqual({ x: 66, y: 41 });
    expect(rows['site-a'].failed).toEqual(['grid', 'relative', 'field']);
    // C = ตัวล่อ: ทิศและระยะจาก RP-2 ตรง และมีไอน้ำ แต่ไม่มีหินปูน และพิกัดไม่ตรง
    expect(rows['site-c'].failed).toEqual(['grid', 'field']);
    expect(rows['site-c'].report.actualDirection).toBe('NE');
    expect(rows['site-c'].report.missingFeatures).toEqual(['white-rock']);
  });

  it('คำนวณพิกัดอย่างเดียวไม่พอ: แต่ละหลักฐานเดี่ยว ๆ ชี้ได้มากกว่าหนึ่งจุด หรือชี้ผิดจุด', () => {
    const s = newSession(L3);
    const ev = s.gridSiteEvidence()!;
    const pass = (check: 'grid' | 'relative' | 'field') =>
      s.evaluateGridSites().filter((r) => !r.failed.includes(check)).map((r) => r.landmarkId);
    expect(pass('relative')).toEqual(['site-b', 'site-c']);
    // หลักฐานภาคสนามบางส่วน (ไอน้ำ) ก็ตรงทั้ง B และ C
    const steam = L3.landmarks.filter((l) => l.features?.includes('steam')).map((l) => l.id);
    expect(steam).toEqual(['site-b', 'site-c']);
    // พิกัดตามตัวอักษร (ไม่แก้การนับ N) ชี้ไปที่ A ซึ่งไม่ใช่คำตอบ
    const literal = { ...ev, recordTile: grid.gridToTile(L3.gridSiteAnalysis!.record) };
    const lm = (id: string) => L3.landmarks.find((l) => l.id === id)!;
    expect(evaluateGridSite(lm('site-a').at, lm('site-a').features!, literal, defaultScale).failed).not.toContain('grid');
    expect(evaluateGridSite(lm('site-b').at, lm('site-b').features!, literal, defaultScale).failed).toContain('grid');
  });

  it('คำตอบไม่ได้ hardcode: ย้ายหินปูนไปจุด C → ระบบตัดสินใหม่ และ validateLevel แจ้งว่าไม่ตรงกับที่ตั้งใจ', () => {
    const swapped: LevelDefinition = {
      ...L3,
      landmarks: L3.landmarks.map((l) =>
        l.id === 'site-b' ? { ...l, features: ['steam'] } : l.id === 'site-c' ? { ...l, features: ['steam', 'white-rock'] } : l,
      ),
      gridSiteAnalysis: { ...L3.gridSiteAnalysis!, record: { e: 4730, n: 1310 }, recordConvention: 'standard' },
    };
    const s = newSession(swapped);
    expect(s.evaluateGridSites().filter((r) => r.failed.length === 0).map((r) => r.landmarkId)).toEqual(['site-c']);
    expect(validateLevel(swapped).some((e) => e.includes('ไม่ตรงกับผลคำนวณ'))).toBe(true);
  });

  it('validateLevel จับกรณีมีสองจุดผ่านทุกข้อ (ผู้เล่นแยกไม่ออก)', () => {
    const both: LevelDefinition = {
      ...L3,
      landmarks: L3.landmarks.map((l) => (l.id === 'site-c' ? { ...l, at: { x: 67, y: 19 }, features: ['steam', 'white-rock'] } : l)),
    };
    expect(validateLevel(both).some((e) => e.includes('ต้องมีจุดเดียว'))).toBe(true);
  });
});

describe('การเลือกจุดเป้าหมาย (หน้าตรวจพิกัด — ตรรกะของฉาก 4)', () => {
  it('ยังเลือกไม่ได้ก่อนถึงฉาก 4', () => {
    const s = playTo(3);
    expect(s.isGridCheckOpen()).toBe(false);
    expect(s.chooseGridSite(SITE.b).blocked).toBe('not-available');
  });

  it('ต้องไปสำรวจจุดที่เลือกด้วยตัวเองก่อน (ไม่นับเป็นผิด)', () => {
    const s = playTo(4);
    expect(s.isGridCheckOpen()).toBe(true);
    const r = s.chooseGridSite(SITE.b);
    expect(r).toMatchObject({ ok: false, blocked: 'missing-evidence', notSurveyed: ['site-b'] });
    expect(s.mistakes.compare).toBe(0);
  });

  it('จุดสำรวจเปิดหลังฟังผู้เก็บบันทึกเท่านั้น', () => {
    const s = playTo(3);
    s.playerTile = { ...POS['survey-b'] };
    expect(s.inspectPointAt(s.playerTile)).toBeUndefined();
  });

  it('เลือกจุด A (ตามพิกัดตัวอักษร) ผิด → ได้ผลตรวจรายข้อเพื่ออธิบาย แล้วเลือกใหม่ได้', () => {
    const s = playTo(4);
    survey(s, 'a');
    const r = s.chooseGridSite(SITE.a);
    expect(r.ok).toBe(false);
    expect(r.blocked).toBeUndefined();
    expect(r.reports['site-a'].failed).toEqual(['grid', 'relative', 'field']);
    expect(r.reports['site-a'].actualDirection).toBe('E');
    expect(r.reports['site-a'].missingFeatures).toEqual(['steam']);
    expect(s.mistakes.compare).toBe(1);
    survey(s, 'c');
    expect(s.chooseGridSite(SITE.c).ok).toBe(false);
    survey(s, 'b');
    expect(s.chooseGridSite(SITE.b).ok).toBe(true);
    expect(s.flags.has('grid-checked')).toBe(true);
    expect(s.skills.has('grid-reference')).toBe(true);
    expect(s.skills.has('relative-position')).toBe(true);
    expect(s.mistakes.compare).toBe(2);
    expect(s.currentStepOrder).toBe(5);
  });
});

describe('ฉาก 4: กระดานวิเคราะห์พิกัด', () => {
  it('ข้อมูลบนกระดานคำนวณจากบันทึกและแผนที่: บันทึกเก่า · พิกัดที่แก้แล้ว · RP-2 · ทิศ/ระยะ · หลักฐานภาคสนาม', () => {
    const s = playTo(4);
    const v = buildGridBoard(s)!;
    const ev = v.evidence.join('\n');
    expect(ev).toContain('บันทึกพิกัดเก่า (ตามที่เขียน): E 4,660 · N 1,180');
    expect(ev).toContain('พิกัดที่แก้ไขแล้ว: E 4,660 · N 1,410');
    expect(ev).toContain('N = 1,590 − (1,180 − 1,000) = 1,410');
    expect(ev).toContain('หมุดอ้างอิง RP-2: E 4,400 · N 1,100');
    expect(ev).toContain('ทางทิศตะวันออกเฉียงเหนือ ราว 400 ม.');
    expect(ev).toContain('ไอน้ำร้อน และ หินปูนสีขาว');
    // พิกัดที่แก้แล้วได้จาก GridSystem ไม่ได้เขียนไว้
    expect(s.gridCorrectedRecord()).toEqual(grid.tileToGrid(grid.topCountedGridToTile(L3.gridSiteAnalysis!.record)));
    expect(v.candidates.map((c) => c.label)).toEqual(['จุด A', 'จุด B', 'จุด C']);
  });

  it('ก่อนกดยืนยัน ไม่เปิดเผยคำตอบหรือผลถูก/ผิด แม้เลือกจุดไว้แล้ว', () => {
    const s = playTo(4);
    survey(s, 'a');
    survey(s, 'b');
    survey(s, 'c');
    s.gridSelection = SITE.b;
    const v = buildGridBoard(s)!;
    const all = [...v.evidence, ...v.candidates.flatMap((c) => c.facts), ...v.status, ...v.result].join('\n');
    expect(all).not.toMatch(/✓|✗|ถูกต้อง|ไม่ถูก|ไม่ตรง/);
    expect(v.result).toEqual([]);
    expect(v.candidates[SITE.b].selected).toBe(true);
    expect(v.status[0]).toContain('กด Enter เพื่อยืนยัน');
    expect(s.flags.has('grid-checked')).toBe(false);
  });

  it('จุดที่ยังไม่สำรวจ ไม่แสดงข้อมูล (ต้องเดินไปดูเอง)', () => {
    const s = playTo(4);
    survey(s, 'a');
    const v = buildGridBoard(s)!;
    expect(v.candidates[SITE.a].facts.join()).toContain('E 4,660 · N 1,180');
    expect(v.candidates[SITE.b].surveyed).toBe(false);
    expect(v.candidates[SITE.b].facts.join()).toContain('ยังไม่ได้สำรวจ');
    const r = s.chooseGridSite(SITE.b);
    expect(explainGridChoice(s, r)).toMatchObject({ tone: 'blocked' });
    expect(explainGridChoice(s, r).lines.join()).toContain('ไม่นับเป็นการตอบผิด');
  });

  it('ตอบผิด (จุด A): อธิบายหลักฐานที่ขัดแย้งครบ 3 ชนิด พร้อมคำใบ้ โดยไม่บอกว่าจุดใดถูก', () => {
    const s = playTo(4);
    survey(s, 'a');
    const r = s.chooseGridSite(SITE.a);
    const e = explainGridChoice(s, r);
    const text = e.lines.join('\n');
    expect(e.tone).toBe('wrong');
    expect(text).toContain('ขัดกับหลักฐาน 3 ชนิด');
    expect(text).toContain('อ่านตามที่เขียน'); // ตัวลวง: พิกัดตามตัวอักษร
    expect(text).toContain('ทางทิศตะวันออก ~270 ม.');
    expect(text).toContain('ไม่พบไอน้ำร้อน');
    expect(text).toContain('คำใบ้:');
    expect(text).not.toMatch(/จุด B|จุด C|E 4,730/);
    expect(s.mistakes.compare).toBe(1);
  });

  it('ตอบผิด (จุด C): ทิศ/ระยะตรง แต่พิกัดและหินปูนไม่ตรง — บอกข้อที่ตรงด้วย', () => {
    const s = playTo(4);
    survey(s, 'c');
    const e = explainGridChoice(s, s.chooseGridSite(SITE.c));
    const text = e.lines.join('\n');
    expect(text).toContain('ขัดกับหลักฐาน 2 ชนิด');
    expect(text).toContain('ไม่พบหินปูนสีขาว');
    expect(text).toContain('ข้อที่ตรง: ทิศและระยะจากจุดอ้างอิง');
    expect(text).not.toMatch(/จุด A|จุด B/);
    expect(gridHint(['field'])).not.toMatch(/จุด [ABC]/);
  });

  it('ตอบถูก: สรุปเหตุผลจากข้อมูลจริง ปลดล็อกฉาก 5 และนับครั้งที่ผิดไว้', () => {
    const s = playTo(4);
    survey(s, 'a');
    s.chooseGridSite(SITE.a);
    survey(s, 'b');
    const r = s.chooseGridSite(SITE.b);
    const text = explainGridChoice(s, r).lines.join('\n');
    expect(r.ok).toBe(true);
    expect(text).toContain('ตรงกับหลักฐานครบทั้ง 3 ชนิด');
    expect(text).toContain('E 4,660 · N 1,410');
    expect(text).toContain('ทางทิศตะวันออกเฉียงเหนือ ~400 ม.');
    expect(text).toContain('ไอน้ำร้อนและหินปูนสีขาว');
    expect(s.currentStepOrder).toBe(5);
    expect(s.mistakes.compare).toBe(1);
    expect(s.gridAttempts).toEqual([
      { landmarkId: 'site-a', ok: false },
      { landmarkId: 'site-b', ok: true },
    ]);
    // อ่านย้อนหลังได้: กระดานแสดงสถานะวิเคราะห์แล้ว + ประวัติ
    s.lastGridChoice = null;
    const v = buildGridBoard(s)!;
    expect(v.status.join()).toContain('วิเคราะห์แล้ว: จุด B');
    expect(v.status.join()).toContain('ประวัติ: จุด A ✗ → จุด B ✓');
    expect(v.status.join()).toContain('ตอบผิดแล้ว 1 ครั้ง');
    // ตอบซ้ำหลังผ่านแล้ว ไม่นับผิดเพิ่ม
    expect(s.chooseGridSite(SITE.a).blocked).toBe('already-solved');
    expect(s.mistakes.compare).toBe(1);
  });

  it('ฉาก 5 ยังไม่เปิดถ้ายังไม่ตอบถูก (ตอบผิดอย่างเดียวไม่ปลดล็อก)', () => {
    const s = playTo(4);
    survey(s, 'c');
    s.chooseGridSite(SITE.c);
    expect(s.currentStepOrder).toBe(4);
    expect(s.isPinAvailable()).toBe(false);
    s.playerTile = { ...POS['survey-b'] };
    expect(s.gridVerifyAt(s.playerTile)).toBeNull();
  });
});

describe('ฉาก 5: สำรวจจริง ยืนยัน และปักหมุด', () => {
  function readyToVerify() {
    const s = playTo(4);
    survey(s, 'b');
    s.chooseGridSite(SITE.b);
    return s;
  }

  it('เป้าหมายการปักคือจุดที่วิเคราะห์ได้ (คำนวณ ไม่ได้กำหนดในเนื้อหา)', () => {
    const s = readyToVerify();
    expect(L3.pinTask!.targetId).toBe('site-analysis');
    expect(s.pinTargetId()).toBe('site-b');
  });

  it('กด E ที่จุด: ตรวจพิกัด E/N · ทิศ/ระยะจาก RP-2 · ไอน้ำและหินปูน แล้วได้รายงานยืนยัน', () => {
    const s = readyToVerify();
    s.playerTile = { x: 66, y: 19 };
    expect(s.gridVerifyAt(s.playerTile)).toBe('site-b');
    expect(s.startGridVerify('site-b')).toBe(true);
    const lines: string[] = [];
    for (let i = 0; i < 10 && s.inDialogue; i++) {
      const v = s.dialogueView!;
      if (v.kind === 'line') lines.push(v.text);
      s.advanceDialogue();
    }
    const text = lines.join('\n');
    expect(text).toContain('ตรงนี้คือ E 4,660 · N 1,410');
    expect(text).toContain('คุณยืนที่ E 4,660 · N 1,400');
    expect(text).toContain('ทางทิศตะวันออกเฉียงเหนือ ประมาณ 400 ม.');
    expect(text).toContain('ไอน้ำร้อน ✓ พบ · หินปูนสีขาว ✓ พบ');
    expect(s.evidence).toContain('field-report');
    expect(s.flags.has('site-verified')).toBe(true);
    expect(s.gridVerifyAt(s.playerTile)).toBeNull(); // ตรวจแล้วไม่ต้องตรวจซ้ำ
  });

  it('ตรวจที่จุดอื่น (C) ระบบแสดงข้อที่ไม่ตรง และไม่ให้รายงานยืนยัน', () => {
    const s = readyToVerify();
    s.playerTile = { ...POS['survey-c'] };
    expect(s.gridVerifyAt(s.playerTile)).toBe('site-c');
    s.startGridVerify('site-c');
    const lines: string[] = [];
    for (let i = 0; i < 10 && s.inDialogue; i++) {
      const v = s.dialogueView!;
      if (v.kind === 'line') lines.push(v.text);
      s.advanceDialogue();
    }
    expect(lines.join('\n')).toContain('หินปูนสีขาว ✗ ไม่พบ');
    expect(s.evidence).not.toContain('field-report');
  });

  it('เดินถึงตำแหน่งอย่างเดียวปักหมุดไม่ผ่าน — คำใบ้บอกเฉพาะหลักฐานที่ยังขาด', () => {
    const s = readyToVerify();
    s.playerTile = { x: 66, y: 19 };
    const r = s.submitPin({ x: 66, y: 18 }, HOT_SPRING);
    expect(r).toEqual({ ok: false, problems: ['evidence'] });
    expect(s.pinMissingEvidence).toEqual(['field-report']);
    expect(s.mistakes.pin).toBe(0); // ขาดหลักฐานไม่นับเป็นตอบผิด
    expect(L3.pinTask!.problemHints!.evidence).toBeTruthy();
  });

  it('ตรวจ: ยืนไกลเกิน · พิกัดผิด (ปักที่ A ตามพิกัดตัวอักษร) · ประเภทสถานที่ผิด · แล้วปักถูก', () => {
    const s = readyToVerify();
    s.playerTile = { x: 66, y: 19 };
    s.startGridVerify('site-b');
    runDialogue(s);
    s.playerTile = { x: 40, y: 49 };
    expect(s.submitPin({ x: 66, y: 18 }, HOT_SPRING).problems).toEqual(['far']);
    survey(s, 'a');
    expect(s.submitPin({ x: 66, y: 41 }, HOT_SPRING).problems).toContain('location');
    s.playerTile = { x: 66, y: 19 };
    expect(s.submitPin({ x: 66, y: 18 }, FOOT_BATH).problems).toEqual(['wisdom']);
    expect(s.mistakes.pin).toBe(2);
    expect(s.submitPin({ x: 66, y: 18 }, HOT_SPRING)).toEqual({ ok: true, problems: [] });
    expect(s.flags.has('pin-verified')).toBe(true);
    expect(s.currentStepOrder).toBe(6);
  });
});

describe('ฉาก 6: ส่งรายงาน รหัสลับชิ้นที่ 3 และภารกิจ', () => {
  it('ครูเนมสรุปผ่านสมุดภาคสนาม ครบ 5 ความรู้ และจบด่าน', () => {
    const s = playTo(6);
    expect(s.startEnding()).toBe(true);
    expect(runDialogue(s)).toBe('mission-complete');
    const text = s.messages.map((m) => m.text).join('\n');
    expect(s.messages.every((m) => m.speaker.includes('สมุดภาคสนาม'))).toBe(true);
    expect(text).toContain('E 4,660 · N 1,410'); // {{grid:site-analysis}} → จุดที่วิเคราะห์ได้
    expect(text).toContain('ค่า E เพิ่มเมื่อไปทางตะวันออก');
    expect(text).toContain('ค่า N เพิ่มเมื่อไปทางเหนือ');
    expect(text).toContain('แกน Y ของ Phaser');
    expect(text).toContain('จุดกำเนิด');
    expect(text).toContain('หลักฐานประกอบ');
    expect(s.mode).toBe('summary');
    expect(s.currentStepOrder).toBe(7);
    expect(L3.ending!.codePiece).toEqual({ index: 3, total: 4, value: 'พิกัด' });
    const sum = s.summary();
    expect(sum.mistakesBy.compare).toBe(1);
    expect(sum.distanceMeters).toBeGreaterThanOrEqual(0);
  });

  it('ภารกิจหลักสำเร็จเมื่อจบเท่านั้น — ยังไม่สำเร็จก่อนมีหลักฐานครบ', () => {
    // ฉาก 5: วิเคราะห์ถูกแล้ว แต่ยังไม่มีรายงานยืนยันภาคสนามและยังไม่ได้ปักหมุด
    const s2 = playTo(5);
    expect(s2.evidence).not.toContain('field-report');
    expect(s2.questStatus.get('main-pong')).toBe('active');
    expect(s2.isPinAvailable()).toBe(true);
    const done = playTo(7);
    expect(done.questStatus.get('main-pong')).toBe('completed');
  });

  it('ภารกิจปริศนา: แปลงทิศ/ระยะจาก RP-1 เป็นพิกัด แล้วเดินไปหาหมุดเก่าที่ไม่มีป้าย', () => {
    const s = playTo(4);
    expect(s.questStatus.get('mystery-old-mark')).toBe('locked');
    talk(s, 'villager-son');
    expect(s.questStatus.get('mystery-old-mark')).toBe('active');
    expect(s.resolveText(L3.clues!.find((c) => c.id === 'clue-old-mark')!.text)).toContain('ทางทิศเหนือ 150 เมตร');
    expect(L3.landmarks.find((l) => l.id === 'old-mark')!.showLabel).toBe(false);
    s.playerTile = { x: 20, y: 25 };
    const p = s.inspectPointAt(s.playerTile)!;
    expect(p.id).toBe('old-mark');
    s.inspect(p);
    runDialogue(s, [0, 1, 2]); // ผิด (N ลด) · ผิด (E เปลี่ยน) · ถูก
    expect(s.mistakes.quiz).toBe(2);
    expect(s.evidence).toContain('old-mark-plate');
    expect(s.questStatus.get('mystery-old-mark')).toBe('completed');
    const q = L3.quizzes!.find((x) => x.id === 'old-mark-coord')!;
    expect(s.resolveText(q.choices[2].label)).toBe('E 4,200 · N 1,350');
  });
});

describe('บันทึก/โหลดระหว่างฉาก 4–5', () => {
  const roundTrip = (a: GameSession) => {
    const b = newSession(L3);
    expect(b.restore(JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot)).toBe(true);
    return b;
  };

  it('กลางฉาก 4 หลังตอบผิด: จำนวนครั้งผิดและประวัติไม่หาย · เลือกค้างไม่ถูกบันทึก', () => {
    const a = playTo(4);
    survey(a, 'a');
    a.chooseGridSite(SITE.a);
    a.gridSelection = SITE.c;
    const b = roundTrip(a);
    expect(b.currentStepOrder).toBe(4);
    expect(b.mistakes.compare).toBe(1);
    expect(b.gridAttempts).toEqual([{ landmarkId: 'site-a', ok: false }]);
    expect(b.gridSelection).toBeNull();
    expect(b.lastGridChoice).toBeNull();
    expect(b.mode).toBe('explore');
    survey(b, 'b');
    expect(b.chooseGridSite(SITE.b).ok).toBe(true);
  });

  it('กลางฉาก 5 (ก่อน/หลังตรวจยืนยัน): โหลดแล้วปักหมุดต่อได้ ไม่ต้องวิเคราะห์ใหม่', () => {
    const a = playTo(5);
    const b = roundTrip(a);
    expect(b.currentStepOrder).toBe(5);
    expect(b.gridCheckSolved).toBe(true);
    b.playerTile = { x: 66, y: 19 };
    expect(b.gridVerifyAt(b.playerTile)).toBe('site-b');
    b.startGridVerify('site-b');
    runDialogue(b);
    const c = roundTrip(b);
    expect(c.evidence).toContain('field-report');
    expect(c.gridVerifyAt({ x: 66, y: 19 })).toBeNull();
    c.playerTile = { x: 66, y: 19 };
    expect(c.submitPin({ x: 66, y: 18 }, HOT_SPRING).ok).toBe(true);
    c.startEnding();
    expect(runDialogue(c)).toBe('mission-complete');
  });

  it('บันทึกรุ่นต้นแบบ (ไม่มีประวัติกระดาน) ยังโหลดได้', () => {
    const snap = JSON.parse(JSON.stringify(playTo(4).toSnapshot()));
    delete snap.gridAttempts;
    const b = newSession(L3);
    expect(b.restore(snap)).toBe(true);
    expect(b.gridAttempts).toEqual([]);
  });
});

describe('บันทึก/โหลด และการปลดล็อก', () => {
  it('บันทึกกลางด่าน (ฉาก 4) แล้วโหลดกลับ เล่นต่อได้', () => {
    const a = playTo(4);
    survey(a, 'a');
    a.playerTile = { x: 50, y: 40 };
    const snap = JSON.parse(JSON.stringify(a.toSnapshot())) as SessionSnapshot;
    expect(snap.contentVersion).toBe(1);
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.saveInProgress('level-3', snap);
    const b = newSession(L3);
    expect(b.restore(store.loadInProgress('level-3') as SessionSnapshot)).toBe(true);
    expect(b.currentStepOrder).toBe(4);
    expect(b.playerTile).toEqual({ x: 50, y: 40 });
    expect(b.evidence).toContain('survey-a');
    expect(b.clues).toEqual(a.clues);
    survey(b, 'b');
    expect(b.chooseGridSite(SITE.b).ok).toBe(true);
  });

  it('บันทึกด่าน 3 ที่ contentVersion ไม่ตรง → ไม่โหลด เริ่มด่านใหม่', () => {
    const snap = { ...playTo(3).toSnapshot(), contentVersion: 99 };
    const s = newSession(L3);
    expect(s.restore(snap)).toBe(false);
    expect(s.currentStepOrder).toBe(1);
  });

  it('บันทึกด่าน 1 และ 2 ยังอยู่ครบหลังบันทึกด่าน 3', () => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    const l1 = newSession(sakNgamLevel);
    talk(l1, 'teacher-nem');
    store.saveInProgress('sakngam', l1.toSnapshot());
    const l2 = newSession(L2);
    talk(l2, 'teacher-nem');
    store.saveInProgress('level-2', l2.toSnapshot());
    store.saveInProgress('level-3', playTo(3).toSnapshot());
    const r1 = newSession(sakNgamLevel);
    const r2 = newSession(L2);
    expect(r1.restore(store.loadInProgress('sakngam') as SessionSnapshot)).toBe(true);
    expect(r2.restore(store.loadInProgress('level-2') as SessionSnapshot)).toBe(true);
    expect(r1.currentStepOrder).toBe(2);
    expect(r2.clues).toEqual(l2.clues);
    // snapshot ของด่านหนึ่งโหลดเข้าอีกด่านไม่ได้
    expect(newSession(L3).restore(store.loadInProgress('level-2') as SessionSnapshot)).toBe(false);
  });

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

  it('ด่าน 3 ปลดล็อกเมื่อจบด่าน 2 เท่านั้น', () => {
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    expect(canEnterLevel('level-3', store.data)).toBe(false);
    store.completeLevel(result('sakngam', 'ลาย', 1), sakNgamLevel.unlocks);
    expect(canEnterLevel('level-3', store.data)).toBe(false);
    store.completeLevel(result('level-2', 'น้ำ', 2), L2.unlocks);
    expect(canEnterLevel('level-3', store.data)).toBe(true);
    const cards = LEVEL_SEQUENCE.map((slot, i) =>
      describeLevel(slot, store.data, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null),
    );
    expect(cards.map((c) => c.state)).toEqual(['completed', 'completed', 'unlocked', 'locked']);
    expect(cards[2].canEnter).toBe(true);
  });

  it('ด่าน 4 เข้าได้เฉพาะเมื่อจบด่าน 3 (ปลดล็อกผ่าน ProgressStore)', () => {
    expect(isPlayableLevel('level-4')).toBe(true);
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    expect(canEnterLevel('level-4', store.data)).toBe(false);
    store.completeLevel(result('level-3', '?', 3), L3.unlocks);
    expect(store.isUnlocked('level-4')).toBe(true);
    expect(canEnterLevel('level-4', store.data)).toBe(true);
    const card = describeLevel(LEVEL_SEQUENCE[3], store.data, false, null);
    expect(card.state).toBe('unlocked');
    expect(card.canEnter).toBe(true);
  });

  it('จบด่าน 3 → บันทึกผ่าน ProgressStore เดิม · รหัส "พิกัด" · ปลดล็อก level-4', () => {
    const s = playTo(7);
    const sum = s.summary();
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.completeLevel(result('sakngam', 'ลาย', 1), sakNgamLevel.unlocks);
    store.completeLevel(result('level-2', 'น้ำ', 2), L2.unlocks);
    store.saveInProgress('level-3', playTo(5).toSnapshot());
    store.completeLevel(
      {
        levelId: 'level-3',
        completedAt: 'x',
        distanceMeters: sum.distanceMeters,
        cluesFound: sum.cluesFound,
        cluesTotal: sum.cluesTotal,
        mistakes: sum.mistakes,
        elapsedMs: sum.elapsedMs,
        skills: sum.skills,
        evidenceFound: s.evidence.length,
        evidenceTotal: L3.evidence!.length,
        codePiece: L3.ending!.codePiece,
      },
      L3.unlocks,
    );
    expect(store.isCompleted('level-3')).toBe(true);
    expect(store.loadInProgress('level-3')).toBeFalsy(); // บันทึกกลางด่านถูกล้างเมื่อจบ
    expect(store.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ', 'พิกัด']);
    expect(store.isUnlocked('level-4')).toBe(true);
    expect(canEnterLevel('level-4', store.data)).toBe(true);
    const cards = LEVEL_SEQUENCE.map((slot, i) =>
      describeLevel(slot, store.data, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null),
    );
    expect(cards.map((c) => c.state)).toEqual(['completed', 'completed', 'completed', 'unlocked']);
    expect(cards[3].canEnter).toBe(true);
    expect(L3.story.every((st) => st.status === 'playable')).toBe(true);
  });
});
