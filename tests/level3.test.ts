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
    expect(LEVELS.map((l) => l.id)).toEqual(['sakngam', 'level-2', 'level-3']);
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

describe('การปักหมุด (เป้าหมายคำนวณจากการวิเคราะห์)', () => {
  function readyToPin() {
    const s = playTo(4);
    survey(s, 'b');
    s.chooseGridSite(SITE.b);
    return s;
  }

  it('ยังปักไม่ได้ก่อนตรวจพิกัด', () => {
    const s = playTo(4);
    expect(s.isPinAvailable()).toBe(false);
  });

  it('เป้าหมายการปักคือจุด B (คำนวณ ไม่ได้กำหนดในเนื้อหา)', () => {
    const s = readyToPin();
    expect(L3.pinTask!.targetId).toBe('site-analysis');
    expect(s.pinTargetId()).toBe('site-b');
  });

  it('ตรวจ: ยืนไกลเกิน · พิกัดผิด (ปักตามพิกัดตัวอักษรที่ A) · ประเภทสถานที่ผิด', () => {
    const s = readyToPin();
    s.playerTile = { x: 40, y: 49 };
    expect(s.submitPin({ x: 66, y: 18 }, HOT_SPRING).problems).toContain('far');
    survey(s, 'a');
    expect(s.submitPin({ x: 66, y: 41 }, HOT_SPRING).problems).toContain('location');
    s.playerTile = { x: 66, y: 19 };
    expect(s.submitPin({ x: 66, y: 18 }, FOOT_BATH).problems).toEqual(['wisdom']);
    const ok = s.submitPin({ x: 66, y: 18 }, HOT_SPRING);
    expect(ok).toEqual({ ok: true, problems: [] });
    expect(s.flags.has('pin-verified')).toBe(true);
    expect(s.currentStepOrder).toBe(6);
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

  it('ด่าน 4 เข้าไม่ได้: ยังไม่มีเนื้อหา แม้ข้อมูลบันทึกจะปลดล็อกไว้', () => {
    expect(isPlayableLevel('level-4')).toBe(false);
    expect(getLevelSlot('level-4')?.status).toBe('planned');
    expect(LEVELS.some((l) => l.id === 'level-4')).toBe(false);
    const store = new ProgressStore(new MemoryStorage(), 'sakngam');
    store.completeLevel(result('level-3', '?', 3), L3.unlocks);
    expect(store.isUnlocked('level-4')).toBe(true);
    expect(canEnterLevel('level-4', store.data)).toBe(false);
    const card = describeLevel(LEVEL_SEQUENCE[3], store.data, false, null);
    expect(card.state).toBe('in-development');
    expect(card.canEnter).toBe(false);
  });

  it('ด่าน 3 ยังไม่มีตอนจบ (ต้นแบบ) จึงไม่ให้ชิ้นรหัส', () => {
    expect(L3.ending).toBeUndefined();
    expect(L3.story.filter((s) => s.status === 'playable').map((s) => s.order)).toEqual([1, 2, 3]);
  });
});
