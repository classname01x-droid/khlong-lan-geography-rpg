import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { ALL_SKILLS, SKILL_LABEL } from '../core/mission/skills';
import type { CodePiece } from '../core/progress/ProgressStore';
import type { GameSession } from '../core/session/GameSession';
import { fmtDuration, fmtMeters } from './format';
import { COLORS, textStyle } from './theme';

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
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'กด Space หรือ Enter เพื่อสำรวจต่อ (อ่านย้อนหลังได้ในสมุดภาคสนาม)', textStyle(14, COLORS.textDim))
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
    const sum = s.summary();
    this.text.setText(
      [
        `${s.level.tambon}`,
        `${s.level.title}`,
        '',
        `ระยะทางเดินทั้งหมด: ${fmtMeters(sum.distanceMeters)}`,
        `เบาะแสที่ค้นพบ: ${sum.cluesFound}/${sum.cluesTotal}`,
        `จำนวนครั้งที่ตอบผิด: ${sum.mistakes}`,
        `   (ปริศนา ${sum.mistakesBy.quiz} · เส้นทาง ${sum.mistakesBy.route} · ปักหมุด ${sum.mistakesBy.pin})`,
        `เวลาที่ใช้: ${fmtDuration(sum.elapsedMs)}`,
        `ภารกิจ: หลัก ${sum.quests.main.done}/${sum.quests.main.total} · รอง ${sum.quests.side.done}/${sum.quests.side.total} · ปริศนา ${sum.quests.mystery.done}/${sum.quests.mystery.total}`,
      ].join('\n'),
    );
    this.skills.setText(
      ['ทักษะภูมิศาสตร์ที่ใช้', ...ALL_SKILLS.map((k) => `${sum.skills.includes(k) ? '●' : '○'} ${SKILL_LABEL[k]}`)].join(
        '\n',
      ),
    );
    const e = s.level.ending;
    this.reward.setText(
      [
        e ? `ได้รับรหัสลับชิ้นที่ ${e.codePiece.index}/${e.codePiece.total}: "${e.codePiece.value}"  ·  ${e.rewardItem}` : '',
        e && collected.length > 0
          ? `รหัสลับที่สะสม: ${Array.from({ length: e.codePiece.total }, (_, i) => collected.find((c) => c.index === i + 1)?.value ?? '?').join(' · ')}`
          : '',
        unlockedName ? `ปลดล็อก: ${unlockedName}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    this.root.setVisible(true);
  }
}
