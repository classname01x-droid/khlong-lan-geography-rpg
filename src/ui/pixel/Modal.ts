import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/constants';
import { wrapThaiText } from '../textWrap';
import { FONT_FAMILY } from '../theme';
import { MenuNavigator } from './MenuNavigator';
import { PixelButton } from './PixelButton';
import { drawPixelFrame } from './PixelFrame';
import { PIXEL } from './theme';

export interface ModalChoice {
  label: string;
  action: () => void;
}

/**
 * หน้าต่างยืนยัน (modal) — บังเมาส์ที่อยู่ด้านล่าง และรับคีย์บอร์ดผ่าน navigator ของตัวเอง
 * Esc = ตัวเลือกสุดท้าย (ควรเป็น "ยกเลิก")
 */
export class Modal {
  readonly root: Phaser.GameObjects.Container;
  readonly nav: MenuNavigator;

  constructor(scene: Phaser.Scene, title: string, message: string, choices: ModalChoice[], onClose: () => void) {
    const w = 640;
    const bodyFont = `18px ${FONT_FAMILY}`;
    const body = wrapThaiText(message, w - 64, bodyFont);
    const msg = scene.add.text(0, 0, body, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: PIXEL.ink,
      lineSpacing: 6,
      padding: { top: 4 },
      align: 'center',
    });
    const btnH = 46;
    const h = 96 + msg.height + choices.length * (btnH + 10) + 20;
    const x = (GAME_WIDTH - w) / 2;
    const y = Math.max(20, (GAME_HEIGHT - h) / 2);

    const blocker = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.7).setOrigin(0).setInteractive();
    const g = scene.add.graphics();
    drawPixelFrame(g, x, y, w, h, 'paper');
    const titleText = scene.add
      .text(GAME_WIDTH / 2, y + 22, title, {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: PIXEL.ink,
        padding: { top: 4 },
      })
      .setOrigin(0.5, 0);
    msg.setPosition(GAME_WIDTH / 2, y + 70).setOrigin(0.5, 0);

    const close = (action: () => void) => () => {
      this.root.destroy();
      onClose();
      action();
    };
    const buttons = choices.map(
      (c, i) =>
        new PixelButton(scene, x + 80, y + 86 + msg.height + i * (btnH + 10), c.label, {
          width: w - 160,
          height: btnH,
          fontSize: 18,
          onClick: close(c.action),
        }),
    );
    this.root = scene.add.container(0, 0, [blocker, g, titleText, msg, ...buttons]).setDepth(100);
    this.nav = new MenuNavigator(buttons, () => buttons[buttons.length - 1].activate());
  }
}
