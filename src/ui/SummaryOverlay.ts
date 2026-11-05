import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { CodePiece } from '../core/progress/ProgressStore';
import type { GameSession } from '../core/session/GameSession';
import { buildSummaryView } from './views/summaryView';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';

/** หน้าจอสรุปผลเมื่อจบด่าน */
export class SummaryOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly skills: Phaser.GameObjects.Text;
  private readonly reward: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.88).setOrigin(0);
    const g = scene.add.graphics();
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(80, 40, GAME_WIDTH - 160, GAME_HEIGHT - 80, 14);
    g.lineStyle(3, COLORS.panelBorder, 1).strokeRoundedRect(80, 40, GAME_WIDTH - 160, GAME_HEIGHT - 80, 14);
    const title = scene.add.text(GAME_WIDTH / 2, 56, 'ภารกิจสำเร็จ!', textStyle(30, COLORS.accent)).setOrigin(0.5, 0);
    this.text = scene.add.text(120, 120, '', { ...textStyle(18), lineSpacing: 6 });
    this.skills = scene.add.text(500, 120, '', { ...textStyle(16), lineSpacing: 6 });
    this.reward = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 170, '', {
      ...textStyle(18, '#9fe3a5'),
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5, 0);
    const hint = scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'Enter / Space: รับภารกิจบทถัดไป · Esc: แผนที่การเดินทาง', textStyle(14, COLORS.textDim))
      .setOrigin(0.5, 1);
    this.root = scene.add
      .container(0, 0, [dim, g, title, this.text, this.skills, this.reward, hint])
      .setDepth(30)
      .setVisible(false);
  }

  render(s: GameSession, unlockedName: string | null, collected: CodePiece[] = []): void {
    if (s.mode !== 'summary') {
      this.root.setVisible(false);
      return;
    }
    const v = buildSummaryView(s, unlockedName, collected);
    this.text.setText([...v.heading, '', ...v.stats].join('\n'));
    // ตัดบรรทัดให้อยู่ในกรอบ (ชื่อทักษะบางข้อยาว)
    this.skills.setText(
      wrapThaiText(['ทักษะภูมิศาสตร์ที่ใช้', ...v.skills.map((k) => `${k.done ? '●' : '○'} ${k.label}`)].join('\n'), GAME_WIDTH - 100 - 500, `16px ${FONT_FAMILY}`),
    );
    this.reward.setText(v.reward.join('\n'));
    this.root.setVisible(true);
  }
}
