import { describe, expect, it } from 'vitest';
import { bearingDeg, bearingToDirection8, directionFromVector } from '../src/core/direction/Compass';

describe('Compass', () => {
  it('แกน y ของจอชี้ลงใต้', () => {
    expect(bearingDeg(0, -1)).toBeCloseTo(0); // เหนือ
    expect(bearingDeg(1, 0)).toBeCloseTo(90); // ตะวันออก
    expect(bearingDeg(0, 1)).toBeCloseTo(180); // ใต้
    expect(bearingDeg(-1, 0)).toBeCloseTo(270); // ตะวันตก
  });

  it('แปลงเป็น 8 ทิศ', () => {
    expect(directionFromVector(1, -1)).toBe('NE');
    expect(directionFromVector(1, 1)).toBe('SE');
    expect(directionFromVector(-1, 1)).toBe('SW');
    expect(directionFromVector(-1, -1)).toBe('NW');
    expect(directionFromVector(0, 0)).toBeNull();
    expect(bearingToDirection8(359)).toBe('N');
    expect(bearingToDirection8(22)).toBe('N');
    expect(bearingToDirection8(23)).toBe('NE');
  });
});
