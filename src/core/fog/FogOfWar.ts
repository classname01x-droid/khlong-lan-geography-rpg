/**
 * สถานะ Fog of War แบบตารางช่อง (ไม่ผูกกับการแสดงผล)
 * ช่องที่ "สำรวจแล้ว" จะคงอยู่ตลอด และใช้เป็นข้อมูลของระบบเปิดแผนที่
 */
export class FogOfWar {
  private readonly explored: Uint8Array;
  private exploredTotal = 0;

  constructor(readonly width: number, readonly height: number) {
    this.explored = new Uint8Array(width * height);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isExplored(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.explored[y * this.width + x] === 1;
  }

  /**
   * เปิดหมอกเป็นวงกลมรัศมี radius ช่อง รอบช่อง (cx, cy)
   * @returns รายการช่องที่เพิ่งถูกเปิดในครั้งนี้
   */
  reveal(cx: number, cy: number, radius: number): Array<{ x: number; y: number }> {
    const revealed: Array<{ x: number; y: number }> = [];
    const r = Math.ceil(radius);
    const r2 = radius * radius;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.width + x;
        if (this.explored[i] === 0) {
          this.explored[i] = 1;
          this.exploredTotal++;
          revealed.push({ x, y });
        }
      }
    }
    return revealed;
  }

  /** ช่องที่ยังไม่สำรวจแต่ติดกับช่องที่สำรวจแล้ว (ใช้วาดขอบหมอกแบบโปร่ง) */
  isFrontier(x: number, y: number): boolean {
    if (!this.inBounds(x, y) || this.isExplored(x, y)) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx !== 0 || dy !== 0) && this.isExplored(x + dx, y + dy)) return true;
      }
    }
    return false;
  }

  get exploredCount(): number {
    return this.exploredTotal;
  }

  /** สัดส่วนพื้นที่ที่สำรวจแล้ว 0–1 */
  get exploredRatio(): number {
    return this.exploredTotal / (this.width * this.height);
  }
}
