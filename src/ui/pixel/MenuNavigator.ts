import type { PixelButton } from './PixelButton';

/**
 * เลื่อนโฟกัสระหว่างปุ่มด้วยคีย์บอร์ด (↑↓←→ / W S A D, Enter/Space/E ยืนยัน)
 * ปุ่มที่กดไม่ได้จะถูกข้าม · ใช้แบบซ้อนกันได้ (หน้าต่างยืนยันอยู่บนสุดรับปุ่มก่อน)
 */
export class MenuNavigator {
  index = 0;

  constructor(
    readonly buttons: PixelButton[],
    private readonly onCancel: (() => void) | null = null,
  ) {
    buttons.forEach((b, i) => {
      b.onHover = () => this.focus(i);
    });
    const first = buttons.findIndex((b) => b.enabled);
    this.focus(first < 0 ? 0 : first);
  }

  focus(i: number): void {
    this.index = i;
    this.buttons.forEach((b, j) => b.setFocused(j === i));
  }

  /** ทำให้โฟกัสอยู่บนปุ่มที่กดได้ (เรียกหลังเปลี่ยนสถานะ enabled) */
  refresh(): void {
    if (!this.buttons[this.index]?.enabled) this.move(1);
    else this.focus(this.index);
  }

  move(delta: number): void {
    const n = this.buttons.length;
    for (let step = 1; step <= n; step++) {
      const j = (((this.index + delta * step) % n) + n) % n;
      if (this.buttons[j].enabled) {
        this.focus(j);
        return;
      }
    }
  }

  /** คืน true ถ้าจัดการปุ่มนี้แล้ว */
  handleKey(code: string): boolean {
    switch (code) {
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'KeyW':
      case 'KeyA':
        this.move(-1);
        return true;
      case 'ArrowDown':
      case 'ArrowRight':
      case 'KeyS':
      case 'KeyD':
      case 'Tab':
        this.move(1);
        return true;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
      case 'KeyE':
        this.buttons[this.index]?.activate();
        return true;
      case 'Escape':
        if (this.onCancel) {
          this.onCancel();
          return true;
        }
        return false;
      default:
        return false;
    }
  }
}
