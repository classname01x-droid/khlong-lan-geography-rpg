import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { boardTitle, buildBoardView } from './views/boardView';
import type { GameSession } from '../core/session/GameSession';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';

const PAD = 24;
const TOP = 46;
const COL_GAP = 16;
const LEFT_W = 430;
const RIGHT_X = PAD + LEFT_W + COL_GAP;
const RIGHT_W = GAME_WIDTH - RIGHT_X - PAD;
const FONT = 14;
const SMALL = 13;

const TONE_COLOR = { none: COLORS.text, ok: '#9be08a', wrong: '#ff9b7a', blocked: COLORS.accent } as const;

/**
 * กระดานวิเคราะห์พิกัด (ฉาก 4 ด่าน 3, กด C) — ข้อความทั้งหมดมาจาก buildGridBoard (core)
 * ก่อนกดยืนยันแสดงเฉพาะข้อมูล ไม่บอกว่าจุดใดถูก · หลังยืนยันแสดงคำอธิบายผลจาก GameSession.chooseGridSite
 */
export class GridBoardOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly content: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.94).setOrigin(0);
    this.title = scene.add
      .text(GAME_WIDTH / 2, 10, '', textStyle(20, COLORS.accent))
      .setOrigin(0.5, 0);
    const title = this.title;
    this.g = scene.add.graphics();
    this.content = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [dim, title, this.g, this.content]).setDepth(22).setVisible(false);
  }

  private text(x: number, y: number, body: string, width: number, size = FONT, color: string = COLORS.text) {
    const t = this.scene.add.text(x, y, wrapThaiText(body, width, `${size}px ${FONT_FAMILY}`), {
      ...textStyle(size, color),
      lineSpacing: 2,
    });
    this.content.add(t);
    return t;
  }

  private panel(x: number, y: number, w: number, h: number, border: number, fill: number = COLORS.panel): void {
    this.g.fillStyle(fill, 0.96).fillRect(x, y, w, h);
    this.g.lineStyle(2, border, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  render(s: GameSession): void {
    if (s.mode !== 'gridcheck') {
      this.root.setVisible(false);
      return;
    }
    // ด่านพิกัด (บท 3) และด่านหลักฐานรวม (บท 4) ใช้หน้าจอเดียวกัน ต่างกันที่ข้อมูล
    this.title.setText(boardTitle(s));
    const view = buildBoardView(s);
    this.root.setVisible(true);
    this.g.clear();
    this.content.removeAll(true);
    if (!view) return;

    // ---- ซ้าย: หลักฐานจากบันทึก ----
    const head = this.text(PAD + 12, TOP + 8, 'หลักฐานจากบันทึกและเบาะแส', LEFT_W - 24, 15, COLORS.speaker);
    const body = this.text(PAD + 12, head.y + head.height + 4, view.evidence.join('\n'), LEFT_W - 24, SMALL);
    const leftH = body.y + body.height + 10 - TOP;

    // ---- ขวา: ตัวเลือก A/B/C ----
    let y = TOP;
    const cards: Array<{ y: number; h: number; selected: boolean }> = [];
    for (const c of view.candidates) {
      const t1 = this.text(RIGHT_X + 12, y + 6, `${c.key}) ${c.name}`, RIGHT_W - 24, 15, c.selected ? COLORS.accent : COLORS.speaker);
      const t2 = this.text(RIGHT_X + 24, t1.y + t1.height, c.facts.join('\n'), RIGHT_W - 36, SMALL, c.surveyed ? COLORS.text : COLORS.textDim);
      const h = t2.y + t2.height + 6 - y;
      cards.push({ y, h, selected: c.selected });
      y += h + 6;
    }
    const rightBottom = y - 6;

    const midBottom = Math.max(TOP + leftH, rightBottom);
    // วาดกรอบหลังวางข้อความ (ข้อความอยู่ใน container ที่วาดทับ graphics)
    this.panel(PAD, TOP, LEFT_W, midBottom - TOP, COLORS.panelBorder);
    for (const card of cards) {
      this.panel(RIGHT_X, card.y, RIGHT_W, card.h, card.selected ? 0xffd84d : 0x6f6a5c, card.selected ? 0x2a2a18 : COLORS.panel);
      if (card.selected) this.text(RIGHT_X - 14, card.y + 6, '▶', 14, 15, COLORS.accent);
    }

    // ---- ล่าง: สถานะ + ผลการตอบ ----
    const by = midBottom + 10;
    const bw = GAME_WIDTH - PAD * 2;
    const st = this.text(PAD + 12, by + 8, view.status.join('\n'), bw - 24, SMALL, COLORS.accent);
    let bottom = st.y + st.height;
    if (view.result.length) {
      const res = this.text(PAD + 12, bottom + 6, view.result.join('\n'), bw - 24, SMALL, TONE_COLOR[view.resultTone]);
      bottom = res.y + res.height;
    }
    const border = view.resultTone === 'ok' ? 0x9be08a : view.resultTone === 'wrong' ? 0xff9b7a : COLORS.panelBorder;
    this.panel(PAD, by, bw, Math.min(bottom + 8, GAME_HEIGHT - 6) - by, border);
  }
}
