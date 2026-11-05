import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { GameSession, NotebookTab } from '../core/session/GameSession';
import { buildNotebookView, NOTEBOOK_TAB_LABEL } from './views/notebookView';
import { wrapThaiText } from './textWrap';
import { FONT_FAMILY, textStyle } from './theme';

const PX = 50;
const PY = 30;
const PW = GAME_WIDTH - PX * 2;
const PH = GAME_HEIGHT - PY * 2;
const INNER_X = PX + 28;
const INNER_W = PW - 56;
const BODY_TOP = PY + 96;
const BODY_BOTTOM = PY + PH - 40;

/** สมุดภาคสนาม: เก็บเบาะแส วิเคราะห์เส้นทาง หลักฐาน และข้อความจากครู (กด N) */
export class NotebookOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly tabTexts: Phaser.GameObjects.Text[];
  private readonly footer: Phaser.GameObjects.Text;
  private y = BODY_TOP;

  /**
   * @param tabs หน้าในสมุดของด่านนี้ (ด่านที่ไม่มีการวิเคราะห์เส้นทางจะไม่มีหน้านั้น)
   * @param tambon ชื่อตำบล — สมุดแยกเบาะแสตามด่าน (เบาะแสมาจาก session ของด่านนี้เท่านั้น)
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tabs: readonly NotebookTab[],
    tambon: string,
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.8).setOrigin(0);
    const paper = scene.add.graphics();
    paper.fillStyle(0xf3ead2, 1).fillRoundedRect(PX, PY, PW, PH, 12);
    paper.lineStyle(4, 0x8a6d3b, 1).strokeRoundedRect(PX, PY, PW, PH, 12);
    paper.lineStyle(1, 0xd8c9a3, 1);
    for (let ly = BODY_TOP + 24; ly < BODY_BOTTOM; ly += 26) paper.lineBetween(PX + 16, ly, PX + PW - 16, ly);
    const title = scene.add.text(PX + 28, PY + 14, 'สมุดภาคสนาม', textStyle(24, '#5a3a1e'));
    const sub = scene.add.text(PX + 30, PY + 50, tambon, textStyle(13, '#7a6448'));
    this.tabTexts = tabs.map((tab, i) =>
      scene.add.text(PX + 200 + i * 160, PY + 20, NOTEBOOK_TAB_LABEL[tab], {
        ...textStyle(16, '#5a3a1e'),
        padding: { x: 10, y: 4, top: 6 },
      }),
    );
    const tabHint = scene.add
      .text(PX + PW - 20, PY + 64, '◀ ▶ หรือ A / D เปลี่ยนหน้า · N หรือ Esc ปิด', textStyle(13, '#7a6448'))
      .setOrigin(1, 0);
    this.body = scene.add.container(0, 0);
    this.footer = scene.add.text(INNER_X, BODY_BOTTOM + 6, '', textStyle(15, '#7a2e1e'));
    this.root = scene.add
      .container(0, 0, [dim, paper, title, sub, ...this.tabTexts, tabHint, this.body, this.footer])
      .setDepth(25)
      .setVisible(false);
  }

  render(s: GameSession): void {
    if (s.mode !== 'notebook') {
      this.root.setVisible(false);
      return;
    }
    this.root.setVisible(true);
    this.tabs.forEach((tab, i) => {
      const active = tab === s.notebookTab;
      this.tabTexts[i]
        .setColor(active ? '#fff6d5' : '#5a3a1e')
        .setBackgroundColor(active ? '#8a6d3b' : 'rgba(0,0,0,0)');
    });
    this.body.removeAll(true);
    this.y = BODY_TOP;
    // เนื้อหามาจาก buildNotebookView (ใช้ร่วมกับหน้าอ่านบนจอสัมผัส)
    const view = buildNotebookView(s);
    view.lines.forEach((l, i) => {
      this.y += view.spacers[i] ?? 0;
      this.line(l.text, l.size, l.color, l.indent, l.gap);
    });
    this.footer.setText(view.footer.text).setColor(view.footer.color);
  }

  private line(text: string, size: number, color: string, indent: number, gap: number): void {
    if (this.y > BODY_BOTTOM - 10) return;
    const t = this.scene.add.text(
      INNER_X + indent,
      this.y,
      wrapThaiText(text, INNER_W - indent, `${size}px ${FONT_FAMILY}`),
      { ...textStyle(size, color), lineSpacing: 2 },
    );
    this.body.add(t);
    this.y += t.height + gap;
  }
}
