import { BLOCKING_TERRAIN, type Terrain, type TilePoint, type WorldObject } from './types';

/** ตารางโลกเกม (ข้อมูลล้วน ไม่มีการแสดงผล) */
export class WorldGrid {
  readonly ground: Terrain[];
  readonly objects: Array<WorldObject | null>;

  constructor(readonly width: number, readonly height: number, base: Terrain) {
    this.ground = new Array<Terrain>(width * height).fill(base);
    this.objects = new Array<WorldObject | null>(width * height).fill(null);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  getTerrain(x: number, y: number): Terrain | null {
    return this.inBounds(x, y) ? this.ground[this.idx(x, y)] : null;
  }

  setTerrain(x: number, y: number, t: Terrain): void {
    if (this.inBounds(x, y)) this.ground[this.idx(x, y)] = t;
  }

  getObject(x: number, y: number): WorldObject | null {
    return this.inBounds(x, y) ? this.objects[this.idx(x, y)] : null;
  }

  setObject(x: number, y: number, o: WorldObject | null): void {
    if (this.inBounds(x, y)) this.objects[this.idx(x, y)] = o;
  }

  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const t = this.ground[this.idx(x, y)];
    return BLOCKING_TERRAIN.has(t) || this.objects[this.idx(x, y)] !== null;
  }

  isWalkable(p: TilePoint): boolean {
    return !this.isBlocked(p.x, p.y);
  }
}
