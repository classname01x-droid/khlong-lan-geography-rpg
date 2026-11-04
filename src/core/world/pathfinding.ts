import type { WorldGrid } from './WorldGrid';
import type { TilePoint } from './types';

export type Passable = (x: number, y: number) => boolean;

const DIRS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** ชุดช่องที่เดินถึงได้จากจุดเริ่ม (BFS 4 ทิศ) — ใช้ตรวจว่าด่านเล่นจบได้จริง */
export function reachableTiles(
  grid: WorldGrid,
  start: TilePoint,
  passable: Passable = (x, y) => !grid.isBlocked(x, y),
): Set<number> {
  const seen = new Set<number>();
  if (!passable(start.x, start.y)) return seen;
  const queue: TilePoint[] = [start];
  seen.add(start.y * grid.width + start.x);
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    for (const [dx, dy] of DIRS_4) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = ny * grid.width + nx;
      if (seen.has(key) || !grid.inBounds(nx, ny) || !passable(nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/** จุดนั้นเดินถึงได้หรือไม่ (หรือยืนข้าง ๆ ได้ ในกรณีที่เป็นประตู/สิ่งกีดขวาง) */
export function isPointReachable(grid: WorldGrid, reachable: Set<number>, p: TilePoint): boolean {
  for (const [dx, dy] of [[0, 0], ...DIRS_4] as const) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (grid.inBounds(x, y) && reachable.has(y * grid.width + x)) return true;
  }
  return false;
}

/**
 * เส้นทางสั้นที่สุดแบบ 4 ทิศ (BFS) — คืนรายการช่องตั้งแต่ from ถึง to (รวมทั้งสองปลาย)
 * หรือ null ถ้าไปไม่ถึง จำนวนก้าว = path.length − 1 ช่อง
 */
export function findPath(
  grid: WorldGrid,
  from: TilePoint,
  to: TilePoint,
  passable: Passable = (x, y) => !grid.isBlocked(x, y),
): TilePoint[] | null {
  if (!grid.inBounds(from.x, from.y) || !grid.inBounds(to.x, to.y)) return null;
  if (!passable(from.x, from.y) || !passable(to.x, to.y)) return null;
  const w = grid.width;
  const prev = new Int32Array(w * grid.height).fill(-2);
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  prev[start] = -1;
  const queue: number[] = [start];
  for (let head = 0; head < queue.length && prev[goal] === -2; head++) {
    const cur = queue[head];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (const [dx, dy] of DIRS_4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const key = ny * w + nx;
      if (prev[key] !== -2 || !passable(nx, ny)) continue;
      prev[key] = cur;
      queue.push(key);
    }
  }
  if (prev[goal] === -2) return null;
  const path: TilePoint[] = [];
  for (let k = goal; k !== -1; k = prev[k]) {
    const x = k % w;
    path.push({ x, y: (k - x) / w });
  }
  return path.reverse();
}
