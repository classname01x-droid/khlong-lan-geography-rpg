import Phaser from 'phaser';
import { clampPan, screenToTile, type ViewRect } from '../core/ui/MapViewport';

/**
 * ชั้นแผนที่ที่ขยาย/เลื่อนได้ (ใช้บนจอสัมผัส) — วาดเนื้อหาครั้งเดียวที่ขนาดช่องพื้นฐาน แล้วขยายทั้งชั้น
 * กราฟิกเป็นเวกเตอร์จึงคมเมื่อขยาย · ตัวอักษรเพิ่มความละเอียดตามระดับขยาย (sharpenText)
 * พิกัด/มาตราส่วนของแผนที่ไม่เปลี่ยน — ตำแหน่งช่องคำนวณกลับด้วย tileAt
 */
export class ZoomPanLayer {
  readonly content: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private view: ViewRect = { x: 0, y: 0, w: 960, h: 640 };
  private baseCell = 8;
  private gridW = 1;
  private gridH = 1;
  private zoom = 1;
  private sharpAt = 0;

  constructor(scene: Phaser.Scene) {
    this.content = scene.add.container(0, 0);
    this.maskShape = new Phaser.GameObjects.Graphics(scene);
    this.content.setMask(this.maskShape.createGeometryMask());
  }

  get cellPx(): number {
    return this.baseCell * this.zoom;
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  /** ตั้งพื้นที่แสดงผลและขนาดช่องพื้นฐาน (เนื้อหาต้องวาดที่ (0,0) ด้วยขนาดช่อง baseCell) */
  configure(view: ViewRect, baseCell: number, gridW: number, gridH: number): void {
    this.view = view;
    this.baseCell = baseCell;
    this.gridW = gridW;
    this.gridH = gridH;
    this.maskShape.clear().fillStyle(0xffffff, 1).fillRect(view.x, view.y, view.w, view.h);
    this.sharpAt = 0;
  }

  /** ขยายรอบช่อง focus (ให้ช่องนั้นอยู่กลางจอ) */
  setZoom(zoom: number, focus: { x: number; y: number }): void {
    this.zoom = zoom;
    this.content.setScale(zoom);
    // ให้ช่อง focus อยู่กลางพื้นที่แสดงผล แล้วจำกัดไม่ให้เลื่อนเลยขอบ
    this.panTo(this.view.x + this.view.w / 2 - (focus.x + 0.5) * this.cellPx, this.view.y + this.view.h / 2 - (focus.y + 0.5) * this.cellPx);
    this.sharpenText();
  }

  panBy(dx: number, dy: number, from: { x: number; y: number }): void {
    this.panTo(from.x + dx, from.y + dy);
  }

  panTo(x: number, y: number): void {
    const m = this.margin();
    const p = clampPan({ x: x - m, y: y - m }, this.gridW * this.cellPx + 2 * m, this.gridH * this.cellPx + 2 * m, this.view);
    this.content.setPosition(p.x + m, p.y + m);
  }

  get position(): { x: number; y: number } {
    return { x: this.content.x, y: this.content.y };
  }

  tileAt(px: number, py: number): { x: number; y: number } | null {
    return screenToTile(px, py, this.position, this.cellPx, this.gridW, this.gridH, this.view);
  }

  /** ช่องที่อยู่กลางจอตอนนี้ (ใช้คงตำแหน่งเมื่อเปลี่ยนระดับขยาย) */
  centerTile(): { x: number; y: number } {
    const c = this.cellPx;
    const x = Math.floor((this.view.x + this.view.w / 2 - this.content.x) / c);
    const y = Math.floor((this.view.y + this.view.h / 2 - this.content.y) / c);
    return { x: Math.max(0, Math.min(this.gridW - 1, x)), y: Math.max(0, Math.min(this.gridH - 1, y)) };
  }

  /** ตัวอักษรใน canvas เป็นภาพ — เพิ่มความละเอียดตามระดับขยายให้คม (ทำเมื่อระดับขยายหรือเนื้อหาเปลี่ยน) */
  sharpenText(): void {
    const res = Math.max(1, Math.ceil(this.zoom));
    if (this.sharpAt === res) return;
    this.sharpAt = res;
    const walk = (c: Phaser.GameObjects.Container) =>
      c.each((o: Phaser.GameObjects.GameObject) => {
        if (o instanceof Phaser.GameObjects.Text) o.setResolution(res);
        else if (o instanceof Phaser.GameObjects.Container) walk(o);
      });
    walk(this.content);
  }

  /** เนื้อหาถูกวาดใหม่ → ต้องปรับความคมของตัวอักษรใหม่ */
  contentChanged(): void {
    this.sharpAt = 0;
    this.sharpenText();
  }

  /** เผื่อขอบให้เห็นเลขพิกัดที่อยู่นอกกรอบแผนที่ */
  private margin(): number {
    return Math.round(30 * this.zoom);
  }
}
