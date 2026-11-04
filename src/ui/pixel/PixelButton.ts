import Phaser from 'phaser';
import { FONT_FAMILY } from '../theme';
import { drawPixelFrame } from './PixelFrame';
import { PIXEL } from './theme';

export interface PixelButtonOptions {
  width: number;
  height?: number;
  fontSize?: number;
  onClick: () => void;
}

/** ปุ่มแบบ Pixel Art: กดได้ทั้งคีย์บอร์ด (ผ่าน MenuNavigator) และเมาส์ */
export class PixelButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly cursorMark: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  readonly bw: number;
  readonly bh: number;
  enabled = true;
  focused = false;
  /** เรียกเมื่อเมาส์ชี้ (ให้ navigator ย้ายโฟกัสมาที่ปุ่มนี้) */
  onHover: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    private readonly opts: PixelButtonOptions,
  ) {
    super(scene, x, y);
    this.bw = opts.width;
    this.bh = opts.height ?? 48;
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(this.bw / 2, this.bh / 2, label, {
        fontFamily: FONT_FAMILY,
        fontSize: `${opts.fontSize ?? 20}px`,
        color: PIXEL.light,
        stroke: '#2a1a0c',
        strokeThickness: 3,
        padding: { top: 4, bottom: 2 },
      })
      .setOrigin(0.5);
    this.cursorMark = scene.add
      .text(14, this.bh / 2, '▶', { fontFamily: FONT_FAMILY, fontSize: '16px', color: PIXEL.accent })
      .setOrigin(0.5)
      .setVisible(false);
    this.zone = scene.add.zone(0, 0, this.bw, this.bh).setOrigin(0).setInteractive({ useHandCursor: true });
    this.zone.on('pointerover', () => this.enabled && this.onHover?.());
    this.zone.on('pointerdown', () => this.activate());
    this.add([this.bg, this.text, this.cursorMark, this.zone]);
    scene.add.existing(this);
    this.redraw();
  }

  setLabel(label: string): this {
    this.text.setText(label);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.redraw();
    return this;
  }

  setFocused(focused: boolean): this {
    this.focused = focused;
    this.redraw();
    return this;
  }

  activate(): void {
    if (this.enabled && this.visible) this.opts.onClick();
  }

  private redraw(): void {
    this.bg.clear();
    const variant = !this.enabled ? 'stone' : this.focused ? 'green' : 'wood';
    drawPixelFrame(this.bg, 0, 0, this.bw, this.bh, variant);
    this.text.setColor(this.enabled ? PIXEL.light : '#d0d0d0').setAlpha(this.enabled ? 1 : 0.75);
    this.cursorMark.setVisible(this.focused && this.enabled);
  }
}
