import { MAP_SCALE_DENOMINATOR, METERS_PER_TILE, TILE_SIZE_PX } from '../../config/constants';

export interface ScaleConfig {
  tileSizePx: number;
  metersPerTile: number;
  mapScaleDenominator: number;
}

/**
 * แหล่งความจริงเดียว (single source of truth) ของการแปลงหน่วย
 * พิกเซลในโลกเกม ↔ ช่อง ↔ เมตร ↔ เซนติเมตรบนแผนที่กระดาษ
 * ห้ามคูณ/หารด้วยตัวเลขมาตราส่วนตรง ๆ ในส่วนอื่นของโค้ด ให้เรียกผ่านคลาสนี้เสมอ
 */
export class ScaleSystem {
  constructor(readonly config: ScaleConfig) {
    if (config.tileSizePx <= 0 || config.metersPerTile <= 0 || config.mapScaleDenominator <= 0) {
      throw new Error('ScaleSystem: ค่ามาตราส่วนต้องมากกว่า 0');
    }
  }

  get metersPerPixel(): number {
    return this.config.metersPerTile / this.config.tileSizePx;
  }

  pxToMeters(px: number): number {
    return px * this.metersPerPixel;
  }

  metersToPx(meters: number): number {
    return meters / this.metersPerPixel;
  }

  tilesToMeters(tiles: number): number {
    return tiles * this.config.metersPerTile;
  }

  metersToTiles(meters: number): number {
    return meters / this.config.metersPerTile;
  }

  /** ตำแหน่งพิกเซล → เลขช่อง (ปัดลง) */
  pxToTile(px: number): number {
    return Math.floor(px / this.config.tileSizePx);
  }

  /** จุดกึ่งกลางของช่องเป็นพิกเซล */
  tileCenterPx(tile: number): number {
    return (tile + 0.5) * this.config.tileSizePx;
  }

  /** ระยะจริง (เมตร) → ระยะบนแผนที่กระดาษ (เซนติเมตร) */
  metersToMapCm(meters: number): number {
    return (meters * 100) / this.config.mapScaleDenominator;
  }

  /** ระยะบนแผนที่กระดาษ (เซนติเมตร) → ระยะจริง (เมตร) */
  mapCmToMeters(cm: number): number {
    return (cm * this.config.mapScaleDenominator) / 100;
  }

  /** ข้อความมาตราส่วน เช่น "1:10,000" */
  get ratioLabel(): string {
    return `1:${this.config.mapScaleDenominator.toLocaleString('en-US')}`;
  }
}

export const defaultScale = new ScaleSystem({
  tileSizePx: TILE_SIZE_PX,
  metersPerTile: METERS_PER_TILE,
  mapScaleDenominator: MAP_SCALE_DENOMINATOR,
});
