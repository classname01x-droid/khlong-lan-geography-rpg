import { describe, expect, it } from 'vitest';
import { pongNamRonLevel as L3 } from '../src/content/levels/pongnamron';
import { validateLevel } from '../src/content/validateLevel';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import { analyzeSettlement, scanSettlement, slopePctAt, type SettlementWorld } from '../src/core/site/SettlementAnalysis';
import { ElevationModel } from '../src/core/world/Elevation';
import { buildWorld } from '../src/core/world/MapBuilder';
import { WorldGrid } from '../src/core/world/WorldGrid';

const D = L3.settlementAnalysis!;

/** แผนที่ทดลอง 40×40: ลำห้วย (น้ำ) ที่ x=5 · ภูมิประเทศกำหนดเองต่อกรณี */
function world(elev: ConstructorParameters<typeof ElevationModel>[0], waterX = 5): SettlementWorld {
  const grid = new WorldGrid(40, 40, 'grass');
  for (let y = 0; y < 40; y++) grid.setTerrain(waterX, y, 'water');
  return { grid, elevation: new ElevationModel(elev), scale: defaultScale };
}

describe('SettlementAnalysis: คะแนนคำนวณจากภูมิประเทศ', () => {
  it('ลาด 3% (1 ช่อง = 10 ม. ลาด 0.3 ม./ช่อง) ได้คะแนนความลาดชันเต็ม · ลาด 8% ได้ 0', () => {
    const gentle = world({ baseMeters: 100, slope: { dx: 0.3, dy: 0 } });
    expect(slopePctAt(gentle, 20, 20)).toBeCloseTo(3, 5);
    const rg = analyzeSettlement(gentle, D, { x: 20, y: 20 });
    expect(rg.parts.find((p) => p.id === 'slope')!.score).toBe(D.weights.slope);
    const steep = world({ baseMeters: 100, slope: { dx: 0.8, dy: 0 } });
    const rs = analyzeSettlement(steep, D, { x: 20, y: 20 });
    expect(rs.parts.find((p) => p.id === 'slope')!.score).toBe(0);
    expect(rs.weakTopics).toContain('slope');
  });

  it('ราบสนิทได้คะแนนความลาดชันน้อยกว่าลาดเล็กน้อย (ระบายน้ำไม่ดี)', () => {
    const flat = analyzeSettlement(world({ baseMeters: 100, slope: { dx: 0, dy: 0 } }), D, { x: 20, y: 20 });
    const gentle = analyzeSettlement(world({ baseMeters: 100, slope: { dx: 0.3, dy: 0 } }), D, { x: 20, y: 20 });
    expect(flat.parts.find((p) => p.id === 'slope')!.score).toBeLessThan(gentle.parts.find((p) => p.id === 'slope')!.score);
  });

  it('ความสูงเหนือน้ำ: ต่ำกว่าระดับน้ำท่วมได้ 0 · สูงพอได้เต็ม', () => {
    // ผิวน้ำ x=5 → ความสูงเพิ่มตาม x ด้วย 0.3 ม./ช่อง: ที่ x=12 สูงกว่าน้ำ 2.1 ม. (ท่วม) · ที่ x=30 สูง 7.5 ม. (พอ)
    const w = world({ baseMeters: 100, slope: { dx: 0.3, dy: 0 } });
    const low = analyzeSettlement(w, D, { x: 12, y: 20 });
    expect(low.measures.heightAboveWater!).toBeLessThanOrEqual(D.height.floodLevelMeters + 1);
    expect(low.parts.find((p) => p.id === 'height')!.score).toBeLessThan(D.weights.height);
    const hi = analyzeSettlement(w, D, { x: 30, y: 20 });
    expect(hi.measures.heightAboveWater!).toBeGreaterThan(D.height.floodLevelMeters + D.height.safeMarginMeters);
    expect(hi.parts.find((p) => p.id === 'height')!.score).toBe(D.weights.height);
  });

  it('แหล่งน้ำ: ติดลำห้วยเกินไปและไกลเกินไปได้คะแนนน้อยกว่าระยะที่เหมาะ', () => {
    const w = world({ baseMeters: 100, slope: { dx: 0.3, dy: 0 } });
    const score = (x: number) => analyzeSettlement(w, D, { x, y: 20 }).parts.find((p) => p.id === 'water')!.score;
    const close = score(6 + D.radiusTiles); // ~ 50–60 ม.
    const ideal = score(5 + 12); // 120 ม.
    const far = score(5 + 35); // 350 ม.
    expect(ideal).toBe(D.weights.water);
    expect(close).toBeLessThan(ideal);
    expect(far).toBe(0);
  });

  it('ไม่มีการสุ่ม: วิเคราะห์ซ้ำกี่ครั้งก็ได้ผลเดิม · คะแนนรวม = ผลรวมแต่ละเกณฑ์', () => {
    const w = world({ baseMeters: 100, slope: { dx: 0.3, dy: 0.1 }, hills: [{ at: { x: 25, y: 20 }, radiusTiles: 8, meters: 6 }] });
    const results = [1, 2, 3].map(() => analyzeSettlement(w, D, { x: 22, y: 18 }));
    expect(results[1].percent).toBe(results[0].percent);
    expect(results[2].total).toBe(results[0].total);
    expect(results[0].parts.reduce((a, p) => a + p.score, 0)).toBeCloseTo(results[0].total, 6);
    expect(results[0].percent).toBeCloseTo(results[0].total, 5); // เต็ม 100 → percent = total
  });

  it('ผ่านเมื่อมากกว่า 70% เท่านั้น: ปรับเกณฑ์ผ่านแล้วผลผ่าน/ไม่ผ่านเปลี่ยนตาม', () => {
    const w = world({ baseMeters: 100, slope: { dx: 0.3, dy: 0 } });
    const r = analyzeSettlement(w, D, { x: 22, y: 20 });
    const hi = analyzeSettlement(w, { ...D, passPercent: r.percent }, { x: 22, y: 20 });
    expect(hi.passed).toBe(false); // เท่ากับเกณฑ์พอดี = ไม่ผ่าน (ต้อง "มากกว่า")
    const lo = analyzeSettlement(w, { ...D, passPercent: r.percent - 0.1 }, { x: 22, y: 20 });
    expect(lo.passed).toBe(true);
  });

  it('ยอดเนินและแอ่งลดคะแนนลักษณะพื้นที่เทียบกับชานเนิน', () => {
    const base = { baseMeters: 100, slope: { dx: 0.3, dy: 0 } };
    const shelf = analyzeSettlement(world(base), D, { x: 22, y: 20 });
    const summit = analyzeSettlement(world({ ...base, hills: [{ at: { x: 22, y: 20 }, radiusTiles: 8, meters: 15 }] }), D, { x: 22, y: 20 });
    const basin = analyzeSettlement(world({ ...base, hills: [{ at: { x: 22, y: 20 }, radiusTiles: 8, meters: -15 }] }), D, { x: 22, y: 20 });
    expect(shelf.measures.landform).toBe('shelf');
    expect(summit.measures.landform).toBe('summit');
    expect(basin.measures.landform).toBe('basin');
    const lf = (r: typeof shelf) => r.parts.find((p) => p.id === 'landform')!.score;
    expect(lf(summit)).toBeLessThan(lf(shelf));
    expect(lf(basin)).toBeLessThan(lf(shelf));
  });
});

describe('แผนที่โป่งน้ำร้อน: ไม่ hardcode คำตอบ', () => {
  const w: SettlementWorld = { grid: buildWorld(L3.map), elevation: new ElevationModel(L3.map.elevation!), scale: defaultScale };
  const all = scanSettlement(w, D, 1);

  it('มีพื้นที่ที่ผ่านเกณฑ์ และมีพื้นที่ที่ไม่ผ่านทุกหัวข้อ (เพื่อให้เรียนเสริมได้ครบ)', () => {
    expect(all.filter((r) => r.passed).length).toBeGreaterThan(0);
    for (const t of ['slope', 'height', 'landform', 'water'] as const) expect(all.some((r) => !r.passed && r.weakTopics.includes(t))).toBe(true);
  });

  it('พื้นที่ที่ผ่านเป็นส่วนน้อยของแผนที่ (เดามั่วไม่ผ่าน)', () => {
    const ratio = all.filter((r) => r.passed).length / all.length;
    expect(ratio).toBeLessThan(0.1);
    expect(ratio).toBeGreaterThan(0);
  });

  it('เนื้อหาด่านไม่มีตำแหน่งคำตอบ: ข้อความทุกอย่างไม่มีพิกัดของพื้นที่ที่ผ่าน', () => {
    const blob = JSON.stringify([L3.npcs, L3.quizzes, L3.clues, L3.story, L3.landmarks, L3.spotHeights]);
    for (const r of all.filter((x) => x.passed).slice(0, 200)) {
      expect(blob).not.toContain(`"x":${r.center.x},"y":${r.center.y}`);
    }
  });

  it('ย้ายเนินให้ต่างไป → พื้นที่ที่ผ่านย้ายตามภูมิประเทศ และ validateLevel ยังตรวจแผนที่ใหม่ได้', () => {
    const moved = structuredClone(L3.map.elevation!);
    moved.hills = (moved.hills ?? []).map((h) => ({ ...h, at: { x: h.at.x, y: h.at.y } }));
    // ลบเนินที่สร้างชานเนิน (เนินแรก) → พื้นที่ผ่านต้องลดลง/เปลี่ยน
    const noTerrace = { ...L3, map: { ...L3.map, elevation: { ...moved, hills: moved.hills.slice(1) } } };
    const w2: SettlementWorld = { grid: buildWorld(noTerrace.map), elevation: new ElevationModel(noTerrace.map.elevation!), scale: defaultScale };
    const after = scanSettlement(w2, D, 1).filter((r) => r.passed);
    const before = all.filter((r) => r.passed);
    expect(after.length).not.toBe(before.length);
    // ตัวตรวจเนื้อหาด่านเห็นว่าไม่ครบเงื่อนไขอีกต่อไป (ไม่ผ่านการตรวจ หรือยังผ่านถ้ามีพื้นที่ผ่านเหลือ)
    const errors = validateLevel(noTerrace);
    if (after.length === 0) expect(errors.length).toBeGreaterThan(0);
  });

  it('validateLevel: น้ำหนักเกณฑ์รวมไม่ใช่ 100 → ถูกจับ', () => {
    const bad = { ...L3, settlementAnalysis: { ...D, weights: { ...D.weights, slope: 10 } } };
    expect(validateLevel(bad).length).toBeGreaterThan(0);
  });
});
