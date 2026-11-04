import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/content/registry';
import { validateLevel } from '../src/content/validateLevel';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { buildWorld } from '../src/core/world/MapBuilder';
import { resolveGeoTemplate } from '../src/core/text/geoTemplate';
import { defaultScale } from '../src/core/scale/ScaleSystem';

describe('เนื้อหาด่าน', () => {
  for (const level of LEVELS) {
    it(`${level.id}: ผ่านการตรวจสอบ (จุดเกิด จุดสังเกต NPC เดินถึงได้)`, () => {
      expect(validateLevel(level)).toEqual([]);
    });
  }

  it('สร้างแผนที่ได้ผลเหมือนเดิมทุกครั้ง (seed คงที่)', () => {
    const a = buildWorld(sakNgamLevel.map);
    const b = buildWorld(sakNgamLevel.map);
    expect(a.objects).toEqual(b.objects);
    expect(a.ground).toEqual(b.ground);
  });

  it('ถนนข้ามลำห้วยกลายเป็นสะพาน', () => {
    const grid = buildWorld(sakNgamLevel.map);
    expect(grid.getTerrain(32, 48)).toBe('bridge');
    expect(grid.isBlocked(32, 48)).toBe(false);
  });

  it('ด่านแรกมี 6 ฉากตามโครงเรื่อง', () => {
    expect(sakNgamLevel.story.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('บทพูดคำนวณระยะ/ทิศจากแผนที่จริง', () => {
  const points = { a: { x: 0, y: 0 }, b: { x: 30, y: 0 }, c: { x: 3, y: -4 } };

  it('แทนค่าระยะทางและทิศ', () => {
    expect(resolveGeoTemplate('{{dir:a>b}} {{dist:a>b}} ม.', points, defaultScale)).toBe('ทิศตะวันออก 300 ม.');
    expect(resolveGeoTemplate('{{dir:a>c}} {{dist:a>c}}', points, defaultScale)).toBe('ทิศตะวันออกเฉียงเหนือ 50');
  });

  it('ไม่แตะข้อความที่อ้างจุดไม่มีจริง', () => {
    expect(resolveGeoTemplate('{{dist:a>zzz}}', points, defaultScale)).toBe('{{dist:a>zzz}}');
  });
});
