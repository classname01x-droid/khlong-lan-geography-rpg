import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { DialogueView } from '../core/dialogue/DialogueRunner';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';

const W = GAME_WIDTH - 120;
const X = 60;
const PAD = 20;
const BODY_SIZE = 19;

/** กล่องบทสนทนา รองรับทั้งบรรทัดธรรมดาและคำถามเลือกตอบ */
export class DialogueBox {
  readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly speaker: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly choices: Phaser.GameObjects.Text;
  private readonly feedback: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.speaker = scene.add.text(PAD, 10, '', textStyle(18, COLORS.speaker));
    this.body = scene.add.text(PAD, 40, '', { ...textStyle(BODY_SIZE), lineSpacing: 4 });
    this.choices = scene.add.text(PAD + 10, 0, '', { ...textStyle(18, COLORS.accent), lineSpacing: 6 });
    this.feedback = scene.add.text(PAD, 0, '', { ...textStyle(16, '#ff9b8a'), lineSpacing: 2 });
    this.hint = scene.add.text(W - 16, 0, '', textStyle(13, COLORS.textDim)).setOrigin(1, 1);
    this.root = scene.add
      .container(X, 0, [this.bg, this.speaker, this.body, this.choices, this.feedback, this.hint])
      .setDepth(10)
      .setVisible(false);
  }

  render(view: DialogueView | null): void {
    if (!view) {
      this.root.setVisible(false);
      return;
    }
    const wrapW = W - PAD * 2;
    this.speaker.setText(view.speaker);
    let y = 40;
    if (view.kind === 'line') {
      this.body.setText(wrapThaiText(view.text, wrapW, `${BODY_SIZE}px ${FONT_FAMILY}`));
      y += this.body.height + 6;
      this.choices.setText('').setVisible(false);
      this.feedback.setText('').setVisible(false);
      this.hint.setText(`${view.step}/${view.total} · กด E หรือ Space เพื่อไปต่อ`);
    } else {
      this.body.setText(wrapThaiText(view.question, wrapW, `${BODY_SIZE}px ${FONT_FAMILY}`));
      y += this.body.height + 6;
      this.choices
        .setText(view.choices.map((c, i) => `${i + 1})  ${c}`).join('\n'))
        .setPosition(PAD + 10, y)
        .setVisible(true);
      y += this.choices.height + 6;
      if (view.feedback) {
        this.feedback
          .setText(wrapThaiText(`ยังไม่ถูก — ${view.feedback}`, wrapW, `16px ${FONT_FAMILY}`))
          .setPosition(PAD, y)
          .setVisible(true);
        y += this.feedback.height + 4;
      } else {
        this.feedback.setText('').setVisible(false);
      }
      this.hint.setText(`กดเลข 1–${view.choices.length} เพื่อตอบ`);
    }
    const h = Math.max(130, y + 26);
    this.hint.setPosition(W - 16, h - 8);
    this.bg.clear();
    this.bg.fillStyle(COLORS.panel, 1).fillRoundedRect(0, 0, W, h, 10);
    this.bg.lineStyle(3, COLORS.panelBorder, 1).strokeRoundedRect(0, 0, W, h, 10);
    this.root.setY(GAME_HEIGHT - h - 44).setVisible(true);
  }
}
