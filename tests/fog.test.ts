import { describe, expect, it } from 'vitest';
import { FogOfWar } from '../src/core/fog/FogOfWar';

describe('FogOfWar', () => {
  it('เปิดหมอกเป็นวงกลม และไม่นับซ้ำ', () => {
    const fog = new FogOfWar(20, 20);
    const first = fog.reveal(10, 10, 2);
    expect(first.length).toBe(13); // วงกลมรัศมี 2 บนตาราง
    expect(fog.isExplored(10, 12)).toBe(true);
    expect(fog.isExplored(12, 12)).toBe(false);
    expect(fog.reveal(10, 10, 2)).toHaveLength(0);
    expect(fog.exploredCount).toBe(13);
  });

  it('ไม่ล้นขอบแผนที่ และหาขอบหมอกได้', () => {
    const fog = new FogOfWar(5, 5);
    fog.reveal(0, 0, 1);
    expect(fog.exploredCount).toBe(3);
    expect(fog.isFrontier(2, 0)).toBe(true);
    expect(fog.isFrontier(4, 4)).toBe(false);
    expect(fog.isFrontier(0, 0)).toBe(false);
  });
});
