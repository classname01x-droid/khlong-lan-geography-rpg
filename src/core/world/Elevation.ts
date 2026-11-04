import type { TilePoint } from './types';

/**
 * ระดับความสูงของภูมิประเทศ (เมตร จากระดับทะเลปานกลาง) — ข้อมูลเชิงภูมิประเทศสำหรับด่านที่ต้องใช้
 * เช่น หาทิศทางน้ำไหล (น้ำไหลจากที่สูงไปที่ต่ำ) ไม่เกี่ยวกับตำแหน่งบนจอ
 *
 *   h(x, y) = base + slope.dx·x + slope.dy·y + Σ เนิน (ยกตัวแบบพาราโบลาภายในรัศมี)
 *
 * แกนเดียวกับโลกเกม (ช่อง) จึงใช้ร่วมกับ ScaleSystem เดิมได้โดยไม่ต้องมีมาตราส่วนใหม่
 */
export interface ElevationDefinition {
  baseMeters: number;
  /** ความสูงที่เปลี่ยนต่อ 1 ช่อง (เมตร/ช่อง) ตามแกน x (ตะวันออก) และ y (ใต้) */
  slope: { dx: number; dy: number };
  hills?: Array<{ at: TilePoint; radiusTiles: number; meters: number }>;
}

export class ElevationModel {
  constructor(readonly def: ElevationDefinition) {}

  heightAt(x: number, y: number): number {
    const d = this.def;
    let h = d.baseMeters + d.slope.dx * x + d.slope.dy * y;
    for (const hill of d.hills ?? []) {
      const r = Math.hypot(x - hill.at.x, y - hill.at.y) / hill.radiusTiles;
      if (r < 1) h += hill.meters * (1 - r * r);
    }
    return h;
  }

  /** ความสูงปัดเป็นเมตรเต็ม (ใช้แสดงผล) */
  meters(p: TilePoint): number {
    return Math.round(this.heightAt(p.x, p.y));
  }

  /** ช่วงชั้นความสูง (ใช้วาดเส้นชั้นความสูงทุก interval เมตร) */
  band(x: number, y: number, interval: number): number {
    return Math.floor(this.heightAt(x, y) / interval);
  }
}
