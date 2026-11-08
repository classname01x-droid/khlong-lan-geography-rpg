import { describe, expect, it } from 'vitest';
import { pongNamRonLevel as L3 } from '../src/content/levels/pongnamron';
import type { SettlementAnalysisDefinition } from '../src/content/types';
import { validateLevel } from '../src/content/validateLevel';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import {
  analyzeSettlement,
  bandFor,
  circleTiles,
  clampToSurvey,
  inSurveyArea,
  measureSettlement,
  scanSettlement,
  type SettlementWorld,
} from '../src/core/site/SettlementAnalysis';
import { ElevationModel } from '../src/core/world/Elevation';
import { buildWorld } from '../src/core/world/MapBuilder';
import { WorldGrid } from '../src/core/world/WorldGrid';

const D = L3.settlementAnalysis!;

/**
 * แผนที่ทดลอง 40×40: ลำน้ำ (ช่องน้ำ) เป็นแนวตั้งที่ x = 5 · พื้นสูงขึ้นไปทางตะวันออก 1 ม./ช่อง
 * ความสูงที่กลางช่อง x = 100 + x พอดี → ลำน้ำสูง 105 ม. · วงกลมที่ศูนย์กลาง x = c มีความสูงเฉลี่ย 100 + c
 * จึงได้ "สูงกว่าลำน้ำ" = c − 5 ม. และ "ระยะถึงน้ำ" = (c − 5) × 10 ม. — คำนวณด้วยมือได้ทุกกรณี
 */
function testWorld(): SettlementWorld {
  const grid = new WorldGrid(40, 40, 'grass');
  for (let y = 0; y < 40; y++) grid.setTerrain(5, y, 'water');
  return { grid, elevation: new ElevationModel({ baseMeters: 99.5, slope: { dx: 1, dy: 0 } }), scale: defaultScale };
}
const W = testWorld();
const score = (c: number) => analyzeSettlement(W, D, { x: c, y: 20 });

describe('เขตสำรวจและการเลือกตำแหน่ง', () => {
  it('ตำแหน่งที่แตะใกล้ขอบถูกเลื่อนให้วงกลมอยู่ในแผนที่ทั้งวง', () => {
    expect(clampToSurvey(W.grid, D.radiusTiles, { x: 0, y: 0 })).toEqual({ x: 4, y: 4 });
    expect(clampToSurvey(W.grid, D.radiusTiles, { x: 39, y: 39 })).toEqual({ x: 35, y: 35 });
    expect(clampToSurvey(W.grid, D.radiusTiles, { x: 20, y: 12 })).toEqual({ x: 20, y: 12 });
    expect(inSurveyArea(W.grid, D.radiusTiles, { x: 3, y: 20 })).toBe(false);
    expect(inSurveyArea(W.grid, D.radiusTiles, { x: 4, y: 20 })).toBe(true);
  });
});

describe('วงกลมวิเคราะห์', () => {
  it('รัศมีคงที่จากข้อมูลด่าน: 4 ช่อง = 40 ม. (ScaleSystem)', () => {
    expect(D.radiusTiles).toBe(4);
    expect(defaultScale.tilesToMeters(D.radiusTiles)).toBe(40);
  });

  it('ช่องในวง = ทุกช่องที่ห่างศูนย์กลางไม่เกินรัศมี (49 ช่องที่รัศมี 4)', () => {
    const tiles = circleTiles(W.grid, { x: 20, y: 20 }, 4);
    expect(tiles).toHaveLength(49);
    for (const t of tiles) expect(Math.hypot(t.x - 20, t.y - 20)).toBeLessThanOrEqual(4);
    expect(tiles).toContainEqual({ x: 24, y: 20 });
    expect(tiles).not.toContainEqual({ x: 23, y: 23 }); // มุม (ห่าง 4.24 ช่อง) อยู่นอกวง
  });
});

describe('การวัดค่า 2 เกณฑ์ (จากข้อมูลภูมิประเทศ)', () => {
  it('ระดับความสูง = ค่าเฉลี่ยในวง · สูงกว่าลำน้ำ = ระดับความสูง − ระดับลำน้ำที่ใกล้ที่สุด', () => {
    const m = measureSettlement(W, { x: 13, y: 20 }, D.radiusTiles);
    expect(m.elevation).toBe(113);
    expect(m.waterElevation).toBe(105);
    expect(m.heightAboveWater).toBe(8);
  });

  it('ระยะจากแหล่งน้ำ = ระยะจากกลางวงถึงช่องน้ำที่ใกล้ที่สุด (เมตร)', () => {
    expect(measureSettlement(W, { x: 13, y: 20 }, D.radiusTiles).waterDistanceMeters).toBe(80);
    expect(measureSettlement(W, { x: 30, y: 7 }, D.radiusTiles).waterDistanceMeters).toBe(250);
  });

  it('ไม่มีความลาดชันในผลวิเคราะห์ — มีเพียง 2 เกณฑ์', () => {
    const r = score(13);
    expect(r.parts.map((p) => p.id)).toEqual(['height', 'water']);
    expect(Object.keys(r.measures).some((k) => /slope|landform|relief/i.test(k))).toBe(false);
  });

  it('ไม่มีการสุ่ม: วิเคราะห์ซ้ำได้ผลเดิม', () => {
    expect(score(17)).toEqual(score(17));
  });
});

describe('คะแนน (ช่วงคะแนนจากข้อมูลด่าน)', () => {
  it('ช่วงคะแนน: ค่าน้อยกว่า below ของช่วงแรกที่ใช่', () => {
    expect(bandFor(D.height.bands, 2).score).toBe(0);
    expect(bandFor(D.height.bands, 3).score).toBe(35);
    expect(bandFor(D.height.bands, 8).score).toBe(50);
    expect(bandFor(D.height.bands, 12).score).toBe(35);
    expect(bandFor(D.height.bands, 100).score).toBe(0);
    expect(bandFor(D.water.bands, 100).score).toBe(50);
    expect(bandFor(D.water.bands, 500).score).toBe(0);
  });

  it('คะแนนรวม = คะแนนระดับความสูง + คะแนนความใกล้แหล่งน้ำ (เต็ม 50 + 50)', () => {
    expect(D.height.max + D.water.max).toBe(100);
    for (const c of [7, 9, 13, 17, 25, 35]) {
      const r = score(c);
      expect(r.total).toBe(r.parts[0].score + r.parts[1].score);
      expect(r.percent).toBe(r.total);
    }
  });

  it('มากกว่า 70 → ผ่าน: สูงกว่าลำน้ำ 8 ม. + ห่าง 80 ม. = 50 + 50 = 100', () => {
    const r = score(13);
    expect(r.parts.map((p) => p.score)).toEqual([50, 50]);
    expect(r.total).toBe(100);
    expect(r.passed).toBe(true);
    expect(r.weakTopics).toEqual([]);
  });

  it('มากกว่า 70 → ผ่าน: สูงกว่าลำน้ำ 12 ม. (ค่อนข้างสูง 35) + ห่าง 120 ม. (50) = 85', () => {
    const r = score(17);
    expect(r.total).toBe(85);
    expect(r.passed).toBe(true);
    expect(r.weakTopics).toEqual(['height']);
  });

  it('70 พอดี → ไม่ผ่าน (ต้องมากกว่า 70): สูงกว่าลำน้ำ 4 ม. (35) + ห่าง 40 ม. (35)', () => {
    const r = score(9);
    expect(r.parts.map((p) => p.score)).toEqual([35, 35]);
    expect(r.total).toBe(70);
    expect(r.passed).toBe(false);
    expect(r.weakTopics).toEqual(['height', 'water']);
  });

  it('ต่ำกว่า 70 → ไม่ผ่าน: ติดลำน้ำ สูงกว่าน้ำแค่ 2 ม. (0) + ห่าง 20 ม. (15) = 15', () => {
    const r = score(7);
    expect(r.total).toBe(15);
    expect(r.passed).toBe(false);
    expect(r.parts[0].label).toContain('น้ำท่วม');
  });

  it('เกณฑ์ผ่านมาจากข้อมูลด่าน: ปรับ passPercent แล้วผลเปลี่ยนตาม', () => {
    const lower: SettlementAnalysisDefinition = { ...D, passPercent: 69 };
    expect(analyzeSettlement(W, lower, { x: 9, y: 20 }).passed).toBe(true);
  });
});

describe('แผนที่โป่งน้ำร้อน: คะแนนจากภูมิประเทศจริง ไม่ hardcode คำตอบ', () => {
  const world: SettlementWorld = { grid: buildWorld(L3.map), elevation: new ElevationModel(L3.map.elevation!), scale: defaultScale };
  const all = scanSettlement(world, D, 1);

  it('มีพื้นที่ที่ผ่าน · มีพื้นที่ที่ไม่ผ่านเพราะแต่ละเกณฑ์ · มีกรณี 70 พอดี', () => {
    expect(all.some((r) => r.passed)).toBe(true);
    expect(all.some((r) => !r.passed && r.weakTopics.includes('height'))).toBe(true);
    expect(all.some((r) => !r.passed && r.weakTopics.includes('water'))).toBe(true);
    expect(all.some((r) => r.total === 70 && !r.passed)).toBe(true);
  });

  it('ส่วนที่ผ่านเป็นส่วนน้อยของเขตสำรวจ (เลือกมั่วมักไม่ผ่าน)', () => {
    const ratio = all.filter((r) => r.passed).length / all.length;
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.35);
  });

  it('บทพูด คำถาม เบาะแส และขั้นภารกิจ ไม่บอกพิกัดหรือตำแหน่งของพื้นที่ใดเลย (ผู้เล่นต้องวิเคราะห์เอง)', () => {
    const texts = JSON.stringify([L3.npcs.map((n) => n.dialogue), L3.quizzes, L3.clues, L3.story]);
    expect(texts).not.toMatch(/E\s?4,\d{3}|N\s?1,\d{3}/);
    expect(texts).not.toMatch(/"x":\d+,"y":\d+/);
  });

  it('เปลี่ยนภูมิประเทศ → ผลเปลี่ยนตาม (ลบเนินริมห้วยฝั่งตะวันออก)', () => {
    const elev = { ...L3.map.elevation!, hills: L3.map.elevation!.hills!.slice(1) };
    const w2: SettlementWorld = { ...world, elevation: new ElevationModel(elev) };
    const before = all.filter((r) => r.passed).length;
    const after = scanSettlement(w2, D, 1).filter((r) => r.passed).length;
    expect(after).not.toBe(before);
  }, 30000);

  it('validateLevel จับช่วงคะแนนผิด และคะแนนเต็มไม่รวม 100', () => {
    const badSum = { ...L3, settlementAnalysis: { ...D, water: { ...D.water, max: 40 } } };
    expect(validateLevel(badSum).join('\n')).toContain('รวมได้ 100');
    const badBands = { ...L3, settlementAnalysis: { ...D, height: { max: 50, bands: [{ below: 10, score: 50, label: 'x' }] } } };
    expect(validateLevel(badBands).join('\n')).toContain('ช่วงคะแนน height');
  }, 30000);
});
