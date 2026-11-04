import { WorldGrid } from './WorldGrid';
import type { MapDefinition, MapFeature, Terrain, TilePoint, TileRect } from './types';

/** ตัวสุ่มแบบกำหนด seed ได้ (mulberry32) → แผนที่เหมือนเดิมทุกครั้ง */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** จุดบนเส้นตรงระหว่าง a กับ b (Bresenham) */
export function lineTiles(a: TilePoint, b: TilePoint): TilePoint[] {
  const out: TilePoint[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const dx = Math.abs(b.x - x0);
  const dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1;
  const sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x: x0, y: y0 });
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

function forRect(r: TileRect, fn: (x: number, y: number) => void): void {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) fn(x, y);
}

function inRect(r: TileRect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

const OPEN_GROUND: ReadonlySet<Terrain> = new Set<Terrain>(['grass', 'flowers']);

function applyFeature(grid: WorldGrid, f: MapFeature, rng: () => number): void {
  switch (f.kind) {
    case 'rect':
      forRect(f.area, (x, y) => grid.setTerrain(x, y, f.terrain));
      return;

    case 'path': {
      for (let i = 0; i < f.points.length - 1; i++) {
        for (const p of lineTiles(f.points[i], f.points[i + 1])) {
          for (let oy = 0; oy < f.width; oy++) {
            for (let ox = 0; ox < f.width; ox++) {
              const x = p.x + ox;
              const y = p.y + oy;
              const current = grid.getTerrain(x, y);
              if (current === null) continue;
              const isCrossing = f.terrain === 'road' && (current === 'water' || current === 'bridge');
              grid.setTerrain(x, y, isCrossing ? 'bridge' : f.terrain);
              grid.setObject(x, y, null); // ถนนตัดผ่านต้นไม้
            }
          }
        }
      }
      return;
    }

    case 'building':
      forRect(f.area, (x, y) => {
        grid.setTerrain(x, y, 'paving');
        grid.setObject(x, y, f.roof);
      });
      grid.setObject(f.door.x, f.door.y, 'door');
      return;

    case 'fence': {
      const { x, y, w, h } = f.area;
      const isGap = (px: number, py: number) => f.gaps.some((g) => g.x === px && g.y === py);
      for (let px = x; px < x + w; px++) {
        for (const py of [y, y + h - 1]) if (!isGap(px, py)) grid.setObject(px, py, 'fence');
      }
      for (let py = y; py < y + h; py++) {
        for (const px of [x, x + w - 1]) if (!isGap(px, py)) grid.setObject(px, py, 'fence');
      }
      return;
    }

    case 'object':
      grid.setObject(f.at.x, f.at.y, f.object);
      return;

    case 'scatter':
      forRect(f.area, (x, y) => {
        if (f.exclude?.some((r) => inRect(r, x, y))) return;
        const t = grid.getTerrain(x, y);
        if (t === null || !OPEN_GROUND.has(t) || grid.getObject(x, y) !== null) return;
        if (rng() < f.density) grid.setObject(x, y, f.object);
      });
      return;

    case 'border':
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const edge = Math.min(x, y, grid.width - 1 - x, grid.height - 1 - y);
          if (edge >= f.thickness) continue;
          const t = grid.getTerrain(x, y);
          if (t !== null && OPEN_GROUND.has(t) && grid.getObject(x, y) === null) {
            grid.setObject(x, y, f.object);
          }
        }
      }
      return;
  }
}

/** แปลงนิยามแผนที่ของด่าน → WorldGrid */
export function buildWorld(def: MapDefinition): WorldGrid {
  const grid = new WorldGrid(def.widthTiles, def.heightTiles, def.baseTerrain);
  const rng = createRng(def.seed);
  // แต่งหญ้าให้มีดอกไม้ประปรายเพื่อไม่ให้พื้นดูเรียบเกินไป
  for (let i = 0; i < grid.ground.length; i++) {
    if (grid.ground[i] === 'grass' && rng() < 0.06) grid.ground[i] = 'flowers';
  }
  for (const f of def.features) applyFeature(grid, f, rng);
  return grid;
}
