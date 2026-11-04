import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { GameSession } from '../core/session/GameSession';
import { PixelButton } from './pixel/PixelButton';
import { drawPixelFrame } from './pixel/PixelFrame';
import { PIXEL } from './pixel/theme';
import { FONT_FAMILY } from './theme';

/**
 * เมนูหยุดเกม (Esc) — แสดงผลอย่างเดียว: คีย์บอร์ดจัดการโดย WorldScene,
 * การคลิกเมาส์ส่งต่อให้ WorldScene ผ่าน onSelect
 */
export class PauseOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly buttons: PixelButton[];

  constructor(
    scene: Phaser.Scene,
    labels: readonly string[],
    onSelect: (index: number) => void,
  ) {
    const w = 420;
    const h = 120 + labels.length * 60;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.65).setOrigin(0).setInteractive();
    const g = scene.add.graphics();
    drawPixelFrame(g, x, y, w, h, 'paper');
    const title = scene.add
      .text(GAME_WIDTH / 2, y + 20, 'หยุดเกม', { fontFamily: FONT_FAMILY, fontSize: '26px', color: PIXEL.ink, padding: { top: 4 } })
      .setOrigin(0.5, 0);
    const note = scene.add
      .text(GAME_WIDTH / 2, y + h - 34, 'ความคืบหน้าบันทึกอัตโนมัติ · Esc กลับไปเล่น', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: PIXEL.inkSoft,
        padding: { top: 4 },
      })
      .setOrigin(0.5, 0);
    this.buttons = labels.map(
      (label, i) => new PixelButton(scene, x + 50, y + 70 + i * 60, label, { width: w - 100, height: 48, fontSize: 18, onClick: () => onSelect(i) }),
    );
    this.buttons.forEach((b, i) => {
      b.onHover = () => this.buttons.forEach((o, j) => o.setFocused(i === j));
    });
    this.root = scene.add.container(0, 0, [dim, g, title, note, ...this.buttons]).setDepth(35).setVisible(false);
  }

  render(s: GameSession, hintShown: boolean): void {
    if (s.mode !== 'pause') {
      this.root.setVisible(false);
      return;
    }
    this.buttons[1].setLabel(`คำแนะนำการควบคุม: ${hintShown ? 'แสดง' : 'ซ่อน'}`);
    this.buttons.forEach((b, i) => b.setFocused(i === s.pauseIndex));
    this.root.setVisible(true);
  }
}
