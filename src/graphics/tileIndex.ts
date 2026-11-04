import type { Terrain, WorldObject } from '../core/world/types';

/** ลำดับช่องใน tileset ที่สร้างขึ้นเอง (ดู PlaceholderTextures.ts) */
export const TILESET_KEY = 'tiles';

export const TERRAIN_TILE: Record<Terrain, number> = {
  grass: 0,
  flowers: 1,
  road: 2,
  water: 3,
  bridge: 4,
  rice: 5,
  paving: 6,
};

export const OBJECT_TILE: Record<WorldObject, number> = {
  tree: 7,
  rock: 8,
  fence: 9,
  roofRed: 10,
  roofBlue: 11,
  roofOrange: 12,
  door: 13,
  flagpole: 14,
};

export const FOG_SOLID_TILE = 15;
export const FOG_EDGE_TILE = 16;
export const TILE_COUNT = 17;

/** สีของแต่ละชนิดบนแผนที่ย่อ (ระบบเปิดแผนที่) */
export const MAP_COLOR_TERRAIN: Record<Terrain, number> = {
  grass: 0x6aa84f,
  flowers: 0x6aa84f,
  road: 0xd9b26f,
  water: 0x3d85c6,
  bridge: 0x8b5a2b,
  rice: 0xb5d36b,
  paving: 0xcfc8b8,
};

export const MAP_COLOR_OBJECT: Record<WorldObject, number> = {
  tree: 0x2e6b1f,
  rock: 0x8d8d8d,
  fence: 0xb85c3c,
  roofRed: 0xc0392b,
  roofBlue: 0x2c6fb3,
  roofOrange: 0xe67e22,
  door: 0x7a4b26,
  flagpole: 0xffffff,
};
