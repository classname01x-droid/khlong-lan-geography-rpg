/** ชนิดพื้น (ชั้น ground) */
export type Terrain = 'grass' | 'flowers' | 'road' | 'water' | 'bridge' | 'rice' | 'paving';

/** ชนิดวัตถุที่วางบนพื้น (ชั้น objects) — ทุกชนิดเป็นสิ่งกีดขวาง */
export type WorldObject =
  | 'tree'
  | 'rock'
  | 'fence'
  | 'roofRed'
  | 'roofBlue'
  | 'roofOrange'
  | 'door'
  | 'flagpole';

export const BLOCKING_TERRAIN: ReadonlySet<Terrain> = new Set<Terrain>(['water']);

export interface TilePoint {
  x: number;
  y: number;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * องค์ประกอบของแผนที่แบบประกาศ (declarative) — เนื้อหาด่านเขียนแค่นี้
 * แล้ว MapBuilder จะแปลงเป็นตารางช่องตามลำดับในอาร์เรย์
 */
export type MapFeature =
  | { kind: 'rect'; terrain: Terrain; area: TileRect }
  /** เส้นทาง/ลำน้ำ ลากผ่านจุดตามลำดับ ความกว้าง width ช่อง; ถนนทับน้ำจะกลายเป็นสะพานอัตโนมัติ */
  | { kind: 'path'; terrain: Terrain; width: number; points: TilePoint[] }
  /** อาคาร: หลังคาเป็นสิ่งกีดขวาง มีประตูอยู่บนขอบอาคาร */
  | { kind: 'building'; area: TileRect; roof: 'roofRed' | 'roofBlue' | 'roofOrange'; door: TilePoint }
  /** รั้วรอบพื้นที่ เว้นช่องว่างเป็นทางเข้า */
  | { kind: 'fence'; area: TileRect; gaps: TilePoint[] }
  | { kind: 'object'; object: WorldObject; at: TilePoint }
  /** โปรยวัตถุแบบสุ่ม (มี seed) เฉพาะบนพื้นหญ้าที่ว่าง */
  | { kind: 'scatter'; object: WorldObject; area: TileRect; density: number; exclude?: TileRect[] }
  /** แนวต้นไม้ล้อมขอบแผนที่ (ไม่ทับถนน) */
  | { kind: 'border'; object: WorldObject; thickness: number };

export interface MapDefinition {
  widthTiles: number;
  heightTiles: number;
  seed: number;
  baseTerrain: Terrain;
  features: MapFeature[];
}
