import type { WorldGrid } from './WorldGrid';
import type { TilePoint } from './types';

/** ชุดช่องที่เดินถึงได้จากจุดเริ่ม (BFS 4 ทิศ) — ใช้ตรวจว่าด่านเล่นจบได้จริง */
export function reachableTiles(grid: WorldGrid, start: TilePoint): Set<number> {
  const seen = new Set<number>();
  if (grid.isBlocked(start.x, start.y)) return seen;
  const queue: TilePoint[] = [start];
  seen.add(start.y * grid.width + start.x);
  while (queue.length > 0) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = ny * grid.width + nx;
      if (seen.has(key) || grid.isBlocked(nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/** จุดนั้นเดินถึงได้หรือไม่ (หรือยืนข้าง ๆ ได้ ในกรณีที่เป็นประตู/สิ่งกีดขวาง) */
export function isPointReachable(grid: WorldGrid, reachable: Set<number>, p: TilePoint): boolean {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (grid.inBounds(x, y) && reachable.has(y * grid.width + x)) return true;
  }
  return false;
}
