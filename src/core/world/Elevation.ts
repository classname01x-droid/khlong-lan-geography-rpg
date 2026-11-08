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
  /**
   * (ไม่บังคับ) ร่องหุบ/ลำห้วย: ลดความสูงตามแนวเส้นทาง — ลึก depthMeters ที่แนวกลาง และค่อย ๆ ขึ้นจนเท่าพื้นเดิมที่ระยะ widthTiles
   * โปรไฟล์ (1 − r²)² ที่ r = ระยะ/widthTiles — ผนังหุบลาดเอียงและเรียบต่อเนื่องกับพื้นเดิมที่ขอบ (ไม่มีรอยหัก)
   */
  channels?: Array<{ points: TilePoint[]; widthTiles: number; depthMeters: number }>;
}

/** ระยะจากจุดถึงเส้นหักมุม (ช่อง) */
function distanceToPolyline(x: number, y: number, pts: TilePoint[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
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
    for (const ch of d.channels ?? []) {
      const r = distanceToPolyline(x, y, ch.points) / ch.widthTiles;
      if (r < 1) h -= ch.depthMeters * (1 - r * r) * (1 - r * r);
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
