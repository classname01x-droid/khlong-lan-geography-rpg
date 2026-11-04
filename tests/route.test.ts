import { describe, expect, it } from 'vitest';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { validateLevel } from '../src/content/validateLevel';
import type { LevelDefinition } from '../src/content/types';
import { evaluateRoute, isRoadLike, measureRoute } from '../src/core/route/RouteAnalysis';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import { formatCm, resolveGeoTemplate } from '../src/core/text/geoTemplate';
import { buildWorld } from '../src/core/world/MapBuilder';
import { findPath, reachableTiles } from '../src/core/world/pathfinding';
import { newSession } from './helpers';

const level = sakNgamLevel;
const grid = buildWorld(level.map);
const at = Object.fromEntries(level.landmarks.map((l) => [l.id, l.at]));

describe('มาตราส่วนของเบาะแสระยะทาง', () => {
  it('4 ซม. บนแผนที่ 1:10,000 = 400 ม. จริง = 40 ช่อง', () => {
    expect(defaultScale.mapCmToMeters(4)).toBe(400);
    expect(defaultScale.metersToTiles(400)).toBe(40);
  });

  it('3 ซม. บนแผนที่ 1:10,000 = 300 ม. จริง = 30 ช่อง', () => {
    expect(defaultScale.mapCmToMeters(3)).toBe(300);
    expect(defaultScale.metersToMapCm(300)).toBe(3);
    expect(defaultScale.metersToTiles(300)).toBe(30);
  });

  it('จุดลับภารกิจปริศนาอยู่ทิศตะวันตกของบ้านไหนเจียว 300 ม. (3 ซม.) ตามเบาะแส', () => {
    expect(resolveGeoTemplate('{{dir:nai-chiao>old-banyan}} {{dist:nai-chiao>old-banyan}} {{mapcm:nai-chiao>old-banyan}}', at, defaultScale)).toBe(
      'ทิศตะวันตก 300 3',
    );
    const key = at['old-banyan'].y * grid.width + at['old-banyan'].x;
    expect(reachableTiles(grid, level.spawn).has(key)).toBe(true);
  });

  it('ตัวเลือกคำถามมาตราส่วนคำนวณจากระยะจริง (×10, ×0.1, ×1)', () => {
    const s = newSession();
    const quiz = level.quizzes!.find((q) => q.id === 'scale')!;
    expect(quiz.choices.map((c) => s.resolveText(c.label))).toEqual(['4,000 เมตร', '40 เมตร', '400 เมตร']);
  });

  it('ระยะเส้นตรงศาลา→บ้านไหนเจียวคำนวณจากแผนที่ได้ 400 ม. และเบาะแสแสดง 4 ซม.', () => {
    const s = newSession();
    expect(s.routeExpectation()!.straightMeters).toBeCloseTo(400);
    const clue = s.getClue('clue-distance')!;
    expect(s.resolveText(clue.text)).toContain('วัดได้ 4 เซนติเมตร');
    expect(resolveGeoTemplate('{{mapcm:sala>nai-chiao}}={{dist:sala>nai-chiao}}', at, defaultScale)).toBe('4=400');
    expect(formatCm(3.92)).toBe('3.9');
  });
});

describe('ภูมิศาสตร์ที่เบาะแสอ้างถึง', () => {
  it('ห้วยสาขากั้นบ้านไหนเจียวไว้ ต้องข้ามสะพานไม้เท่านั้น', () => {
    const wood = at['wood-bridge'];
    const nearWood = (x: number, y: number) => Math.abs(x - wood.x) <= 2 && Math.abs(y - wood.y) <= 2;
    expect(grid.getTerrain(wood.x, wood.y)).toBe('bridge');
    const target = at['nai-chiao'];
    const key = target.y * grid.width + target.x;
    expect(reachableTiles(grid, level.spawn).has(key)).toBe(true);
    const withoutWoodBridge = reachableTiles(
      grid,
      level.spawn,
      (x, y) => !grid.isBlocked(x, y) && !(grid.getTerrain(x, y) === 'bridge' && nearWood(x, y)),
    );
    expect(withoutWoodBridge.has(key)).toBe(false);
  });

  it('สะพานไม้มีแห่งเดียวบนห้วยสาขา (สะพานอื่นคือสะพานถนนหลัก)', () => {
    const bridges: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) if (grid.getTerrain(x, y) === 'bridge') bridges.push({ x, y });
    const wood = bridges.filter((b) => b.y < 30);
    const main = bridges.filter((b) => b.y >= 30);
    expect(wood.length).toBe(4); // ถนนกว้าง 2 × ห้วยกว้าง 2
    expect(main.every((b) => b.y === 48 || b.y === 49)).toBe(true);
  });
});

describe('ระบบวิเคราะห์เส้นทาง', () => {
  const s = newSession();
  const metrics = (id: string) => s.routeMetrics.get(id)!;
  const expected = s.routeExpectation()!;

  it('ระยะตามเส้นทางมาจากทางเดินบนถนนจริง และแยกจากระยะเส้นตรง', () => {
    for (const [, m] of s.routeMetrics) {
      expect(m.connected).toBe(true);
      // ทางเดินต่อเนื่องทีละช่อง และทุกช่องเป็นถนน/สะพาน/ลาน
      for (let i = 1; i < m.path.length; i++) {
        const a = m.path[i - 1];
        const b = m.path[i];
        expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
        expect(isRoadLike(grid, b.x, b.y)).toBe(true);
      }
      expect(m.roadMeters).toBe(defaultScale.tilesToMeters(m.path.length - 1));
      expect(m.roadMeters).toBeGreaterThan(m.straightMeters);
    }
  });

  it('เส้นทางที่ถูกต้อง (ข) สอดคล้องกับหลักฐานทั้ง 3 อย่าง', () => {
    const m = metrics('route-north');
    expect(m.direction).toBe('NE');
    expect(m.passes).toContain('wood-bridge');
    expect(evaluateRoute(m, expected)).toEqual([]);
  });

  it('เส้นทางหลอก ค มีทิศและระยะใกล้เคียง แต่ไม่ผ่านสะพานไม้', () => {
    const m = metrics('route-east');
    expect(m.direction).toBe(expected.direction);
    expect(Math.abs(m.straightMeters - expected.straightMeters)).toBeLessThanOrEqual(expected.toleranceMeters);
    expect(m.passes).not.toContain('wood-bridge');
    expect(evaluateRoute(m, expected)).toEqual(['landmark']);
  });

  it('ระยะเดินของเส้นทาง ข กับ ค "พอ ๆ กัน" ตามที่ป้าศรีบอก (ต่างกันไม่เกิน 10%)', () => {
    const north = metrics('route-north').roadMeters;
    const east = metrics('route-east').roadMeters;
    expect(Math.abs(north - east) / north).toBeLessThan(0.1);
  });

  it('เส้นทางหลอก ก ผิดทั้งทิศและระยะ และไม่ผ่านสะพานไม้', () => {
    expect(evaluateRoute(metrics('route-west'), expected)).toEqual(['direction', 'distance', 'landmark']);
  });

  it('measureRoute คืน connected=false เมื่อถนนไม่เชื่อมกัน', () => {
    const m = measureRoute(grid, defaultScale, at['sala'], { x: 5, y: 5 }, [], []);
    expect(m.connected).toBe(false);
  });

  it('findPath คืนเส้นทางที่สั้นที่สุดแบบ 4 ทิศ', () => {
    const p = findPath(grid, { x: 46, y: 48 }, { x: 50, y: 48 })!;
    expect(p.length).toBe(5);
  });
});

describe('validateLevel จับการแก้แผนที่/เบาะแสที่ไม่สอดคล้องกัน', () => {
  it('ถ้าเปลี่ยนจุดสังเกตที่ต้องผ่านเป็นต้นสักใหญ่ เส้นทางหลอก ค จะแยกไม่ออก', () => {
    const broken: LevelDefinition = {
      ...level,
      routeAnalysis: { ...level.routeAnalysis!, requiredLandmarkId: 'big-teak' },
    };
    expect(validateLevel(broken).some((e) => e.includes('route-east'))).toBe(true);
  });

  it('ถ้าย้ายบ้านไหนเจียวโดยไม่ตรวจเบาะแส เส้นทางที่ถูกต้องจะขัดกับหลักฐาน', () => {
    const broken: LevelDefinition = {
      ...level,
      routeAnalysis: { ...level.routeAnalysis!, requiredClueIds: ['clue-direction', 'clue-bridge'] },
    };
    expect(validateLevel(broken)).toContain('เบาะแสที่จำเป็นขาดประเภท: distance');
  });
});
