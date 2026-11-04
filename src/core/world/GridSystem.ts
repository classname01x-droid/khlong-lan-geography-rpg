import type { ScaleSystem } from '../scale/ScaleSystem';
import type { TilePoint } from './types';

/**
 * ระบบพิกัดกริดจำลอง (Easting/Northing เป็นเมตร) — ไม่ใช่ละติจูด/ลองจิจูดจริง
 *
 *   E (Easting)  เพิ่มไปทางตะวันออก  = แกน x ของ Phaser (ทิศเดียวกัน)
 *   N (Northing) เพิ่มไปทางเหนือ     = **ตรงข้าม** แกน y ของ Phaser (y เพิ่มลงล่างจอ)
 *
 * จุดกำเนิดกริด (falseEasting, falseNorthing) อยู่ที่ "มุมตะวันตกเฉียงใต้" ของแผนที่ (ล่างซ้ายของจอ)
 * พิกัดของช่องหนึ่งช่อง = มุมตะวันตกเฉียงใต้ของช่องนั้น (ความละเอียด 1 ช่อง = 10 ม.)
 * ใช้ ScaleSystem เดิมแปลงหน่วย — ไม่มีมาตราส่วนใหม่
 */
export interface GridDefinition {
  /** ค่า E ที่ขอบตะวันตกของแผนที่ (เมตร) */
  falseEasting: number;
  /** ค่า N ที่ขอบใต้ของแผนที่ (เมตร) */
  falseNorthing: number;
}

export interface GridRef {
  e: number;
  n: number;
}

export class GridSystem {
  constructor(
    readonly def: GridDefinition,
    readonly widthTiles: number,
    readonly heightTiles: number,
    readonly scale: ScaleSystem,
  ) {}

  private get m(): number {
    return this.scale.config.metersPerTile;
  }

  /** ช่อง (x ไปตะวันออก, y ลงล่างจอ) → พิกัดกริดของมุมตะวันตกเฉียงใต้ของช่อง */
  tileToGrid(t: TilePoint): GridRef {
    return {
      e: this.def.falseEasting + t.x * this.m,
      n: this.def.falseNorthing + (this.heightTiles - 1 - t.y) * this.m,
    };
  }

  /** พิกัดกริด → ช่องที่มีจุดนั้นอยู่ (ฟังก์ชันผกผันของ tileToGrid) */
  gridToTile(g: GridRef): TilePoint {
    return {
      x: Math.floor((g.e - this.def.falseEasting) / this.m),
      y: this.heightTiles - 1 - Math.floor((g.n - this.def.falseNorthing) / this.m),
    };
  }

  /** ตำแหน่งพิกเซลในโลกเกม (ต่อเนื่อง) → พิกัดกริด */
  pxToGrid(px: number, py: number): GridRef {
    const heightPx = this.heightTiles * this.scale.config.tileSizePx;
    return {
      e: this.def.falseEasting + this.scale.pxToMeters(px),
      n: this.def.falseNorthing + this.scale.pxToMeters(heightPx - py),
    };
  }

  /** พิกัดกริด → ตำแหน่งพิกเซลในโลกเกม (ฟังก์ชันผกผันของ pxToGrid) */
  gridToPx(g: GridRef): { x: number; y: number } {
    const heightPx = this.heightTiles * this.scale.config.tileSizePx;
    return {
      x: this.scale.metersToPx(g.e - this.def.falseEasting),
      y: heightPx - this.scale.metersToPx(g.n - this.def.falseNorthing),
    };
  }

  /** ระยะจริงระหว่างสองพิกัดกริด (เมตร) */
  distanceMeters(a: GridRef, b: GridRef): number {
    return Math.hypot(b.e - a.e, b.n - a.n);
  }

  /** ค่า N ของเส้นกริดแนวนอนที่ขอบบนของแถว y (ใช้เขียนเลขกำกับบนแผนที่) */
  northingAtRowEdge(y: number): number {
    return this.def.falseNorthing + (this.heightTiles - y) * this.m;
  }

  /** ค่า E ของเส้นกริดแนวตั้งที่ขอบซ้ายของคอลัมน์ x */
  eastingAtColumnEdge(x: number): number {
    return this.def.falseEasting + x * this.m;
  }

  /**
   * ข้อผิดพลาดที่พบบ่อย: นับค่า N "จากขอบบนลงมา" (เหมือนแกน y ของจอ)
   * คืนค่าที่จะถูกเขียนผิดสำหรับช่องนี้ (ใช้สร้างตัวเลือกหลอก/บันทึกที่ผิด)
   */
  tileToTopCountedGrid(t: TilePoint): GridRef {
    return { e: this.def.falseEasting + t.x * this.m, n: this.def.falseNorthing + t.y * this.m };
  }

  /** อ่านค่าที่ถูกบันทึกแบบนับ N จากขอบบน กลับเป็นช่องจริง */
  topCountedGridToTile(g: GridRef): TilePoint {
    return {
      x: Math.floor((g.e - this.def.falseEasting) / this.m),
      y: Math.floor((g.n - this.def.falseNorthing) / this.m),
    };
  }

  static format(g: GridRef): string {
    return `E ${Math.round(g.e).toLocaleString('en-US')} · N ${Math.round(g.n).toLocaleString('en-US')}`;
  }
}
