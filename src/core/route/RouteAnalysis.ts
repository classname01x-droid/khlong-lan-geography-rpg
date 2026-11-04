import { bearingDeg, bearingToDirection8, type Direction8 } from '../direction/Compass';
import type { ScaleSystem } from '../scale/ScaleSystem';
import { findPath } from '../world/pathfinding';
import type { Terrain, TilePoint } from '../world/types';
import type { WorldGrid } from '../world/WorldGrid';

/**
 * ระบบวิเคราะห์เส้นทาง — ทุกตัวเลขคำนวณจากข้อมูลแผนที่ (WorldGrid) ไม่มีค่าที่เขียนตายตัว
 *
 * แยก "ระยะเส้นตรง" (ระยะกระจัดระหว่างจุดต้นทาง–ปลายทาง) ออกจาก
 * "ระยะตามเส้นทาง" (ความยาวทางเดินบนถนน/สะพาน/ลานที่สั้นที่สุด) อย่างชัดเจน
 */
export const ROAD_LIKE: ReadonlySet<Terrain> = new Set<Terrain>(['road', 'bridge', 'paving']);

export function isRoadLike(grid: WorldGrid, x: number, y: number): boolean {
  const t = grid.getTerrain(x, y);
  return t !== null && ROAD_LIKE.has(t) && !grid.isBlocked(x, y);
}

export interface NamedPoint {
  id: string;
  at: TilePoint;
}

export interface RouteMetrics {
  /** ไปถึงปลายทางตามถนนได้หรือไม่ */
  connected: boolean;
  /** ทางเดินบนถนน (ช่อง) ตั้งแต่ต้นทางถึงปลายทาง */
  path: TilePoint[];
  /** ระยะตามเส้นทาง (เมตร) */
  roadMeters: number;
  /** ระยะเส้นตรงต้นทาง→ปลายทาง (เมตร) */
  straightMeters: number;
  /** ระยะเส้นตรงบนแผนที่กระดาษ (ซม.) */
  mapCm: number;
  bearing: number;
  direction: Direction8;
  /** id จุดสังเกตที่เส้นทางผ่าน (ไม่รวมต้นทาง/ปลายทาง) */
  passes: string[];
}

/** จุดสังเกตถือว่า "อยู่บนเส้นทาง" ถ้าห่างจากช่องใดช่องหนึ่งของทางเดินไม่เกินค่านี้ (ช่อง, แบบ Chebyshev) */
export const PASS_RADIUS_TILES = 2;

export function straightMeters(a: TilePoint, b: TilePoint, scale: ScaleSystem): number {
  return scale.tilesToMeters(Math.hypot(b.x - a.x, b.y - a.y));
}

/**
 * วัดเส้นทางบนถนนจาก origin ผ่าน via (ถ้ามี) ไปยัง destination
 * ใช้ BFS บนช่องที่เป็นถนน/สะพาน/ลาน ความยาว = จำนวนก้าว × เมตรต่อช่อง
 */
export function measureRoute(
  grid: WorldGrid,
  scale: ScaleSystem,
  origin: TilePoint,
  destination: TilePoint,
  via: TilePoint[],
  landmarks: NamedPoint[],
  excludeIds: string[] = [],
): RouteMetrics {
  const stops = [origin, ...via, destination];
  const path: TilePoint[] = [];
  let connected = true;
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = findPath(grid, stops[i], stops[i + 1], (x, y) => isRoadLike(grid, x, y));
    if (!leg) {
      connected = false;
      break;
    }
    path.push(...(i === 0 ? leg : leg.slice(1)));
  }
  const steps = connected ? path.length - 1 : 0;
  const straight = straightMeters(origin, destination, scale);
  const bearing = bearingDeg(destination.x - origin.x, destination.y - origin.y);
  const passes = connected
    ? landmarks
        .filter((lm) => !excludeIds.includes(lm.id))
        .filter((lm) =>
          path.some((p) => Math.max(Math.abs(p.x - lm.at.x), Math.abs(p.y - lm.at.y)) <= PASS_RADIUS_TILES),
        )
        .map((lm) => lm.id)
    : [];
  return {
    connected,
    path: connected ? path : [],
    roadMeters: scale.tilesToMeters(steps),
    straightMeters: straight,
    mapCm: scale.metersToMapCm(straight),
    bearing,
    direction: bearingToDirection8(bearing),
    passes,
  };
}

export type RouteCheck = 'direction' | 'distance' | 'landmark';

export interface RouteExpectation {
  direction: Direction8;
  straightMeters: number;
  toleranceMeters: number;
  landmarkId: string;
}

/** ตรวจว่าเส้นทางสอดคล้องกับหลักฐาน 3 อย่าง; คืนรายการที่ "ไม่ผ่าน" (ว่าง = ถูกต้องทั้งหมด) */
export function evaluateRoute(m: RouteMetrics, expected: RouteExpectation): RouteCheck[] {
  const failed: RouteCheck[] = [];
  if (!m.connected || m.direction !== expected.direction) failed.push('direction');
  if (!m.connected || Math.abs(m.straightMeters - expected.straightMeters) > expected.toleranceMeters) {
    failed.push('distance');
  }
  if (!m.passes.includes(expected.landmarkId)) failed.push('landmark');
  return failed;
}
