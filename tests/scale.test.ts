import { describe, expect, it } from 'vitest';
import { defaultScale, ScaleSystem } from '../src/core/scale/ScaleSystem';
import { DistanceTracker } from '../src/core/movement/DistanceTracker';

describe('ScaleSystem', () => {
  const s = defaultScale;

  it('1 ช่อง = 10 เมตร', () => {
    expect(s.tilesToMeters(1)).toBe(10);
    expect(s.metersToTiles(250)).toBe(25);
    expect(s.pxToMeters(16)).toBe(10); // 1 ช่อง = 16 px
    expect(s.metersToPx(10)).toBe(16);
  });

  it('มาตราส่วน 1:10,000 → 1 ซม. บนแผนที่ = 100 เมตร = 10 ช่อง', () => {
    expect(s.mapCmToMeters(1)).toBe(100);
    expect(s.metersToMapCm(100)).toBe(1);
    expect(s.metersToMapCm(s.tilesToMeters(1))).toBeCloseTo(0.1); // 1 ช่อง = 1 มม.
    expect(s.ratioLabel).toBe('1:10,000');
  });

  it('แปลงพิกเซล ↔ ช่อง', () => {
    expect(s.pxToTile(0)).toBe(0);
    expect(s.pxToTile(15.9)).toBe(0);
    expect(s.pxToTile(16)).toBe(1);
    expect(s.tileCenterPx(2)).toBe(40);
  });

  it('ปฏิเสธค่ามาตราส่วนที่ผิด', () => {
    expect(() => new ScaleSystem({ tileSizePx: 0, metersPerTile: 10, mapScaleDenominator: 10000 })).toThrow();
  });
});

describe('DistanceTracker', () => {
  it('นับระยะจากการเคลื่อนที่จริง (รวมแนวทแยง)', () => {
    const t = new DistanceTracker(defaultScale);
    t.teleport(0, 0);
    t.sample(16 * 3, 0); // ตะวันออก 3 ช่อง = 30 ม.
    t.sample(16 * 3, 16 * 4); // ใต้ 4 ช่อง = 40 ม.
    expect(t.totalMeters).toBeCloseTo(70);
    t.sample(0, 0); // ทแยงกลับจุดเดิม 5 ช่อง = 50 ม.
    expect(t.totalMeters).toBeCloseTo(120);
  });

  it('ไม่นับระยะเมื่อไม่ขยับ (เช่น เดินชนกำแพง) หรือวาร์ป', () => {
    const t = new DistanceTracker(defaultScale);
    t.sample(100, 100);
    t.sample(100, 100);
    t.sample(100.001, 100);
    expect(t.totalMeters).toBe(0);
    t.teleport(5000, 5000);
    t.sample(5000, 5016);
    expect(t.totalMeters).toBeCloseTo(10);
  });

  it('รีเซ็ตระยะช่วงได้ โดยระยะรวมไม่หาย', () => {
    const t = new DistanceTracker(defaultScale);
    t.sample(0, 0);
    t.sample(160, 0);
    t.resetTrip();
    t.sample(320, 0);
    expect(t.tripMeters).toBeCloseTo(100);
    expect(t.totalMeters).toBeCloseTo(200);
  });
});
