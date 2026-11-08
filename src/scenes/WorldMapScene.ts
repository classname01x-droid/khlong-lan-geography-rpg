import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import { CHAPTERS } from '../content/story/chapters';
import { chapterStates, type ChapterState } from '../core/campaign/Campaign';
import { drawWorldMapArt } from '../graphics/MenuArt';
import { MenuNavigator } from '../ui/pixel/MenuNavigator';
import { PixelButton } from '../ui/pixel/PixelButton';
import { drawPixelFrame } from '../ui/pixel/PixelFrame';
import { PIXEL } from '../ui/pixel/theme';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { journeyView, type JourneyNode } from '../ui/views/screens';
import { REGISTRY_TOUCH_UI } from './events';
import { JOURNEY_LAYOUT } from './journeyLayout';
import { continueStory, getProgress, goToMainMenu, SCENE } from './navigation';

const CARD_W = 270;
const CARD_H = 228;

const STATE_COLOR: Record<ChapterState, string> = {
  explored: PIXEL.good,
  current: PIXEL.warn,
  next: PIXEL.inkSoft,
  locked: PIXEL.inkMuted,
};

const NOTICE_COLOR = { normal: PIXEL.inkSoft, warn: PIXEL.warn, bad: PIXEL.bad } as const;

/**
 * แผนที่การเดินทาง (เดิมคือหน้าเลือกด่าน) — แสดงตำบลที่สำรวจแล้ว ภารกิจปัจจุบัน และเป้าหมายต่อไป
 * ไม่ใช่หน้าเลือกด่านอิสระ: มีปุ่มเดียว "เดินทางต่อ" ที่พาไปภารกิจหลักปัจจุบันเท่านั้น
 * ข้อความทั้งหมดมาจาก journeyView() (ใช้ร่วมกับหน้าจอสัมผัส) · จอสัมผัส: วาดเฉพาะภาพแผนที่ ข้อมูลเป็น DOM ตัวอักษรใหญ่
 */
export class WorldMapScene extends Phaser.Scene {
  private navStack: MenuNavigator[] = [];

  constructor() {
    super(SCENE.worldMap);
  }

  create(): void {
    this.navStack = [];
    const progress = getProgress(this);
    const states = chapterStates(CHAPTERS, progress.data);
    const view = journeyView(progress.data);

    drawWorldMapArt(
      this,
      JOURNEY_LAYOUT.map((l, i) => ({ ...l.region, icon: l.icon, locked: states[CHAPTERS[i].id] === 'locked' || states[CHAPTERS[i].id] === 'next' })),
    );
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => this.navStack[this.navStack.length - 1]?.handleKey(ev.code));
    // จอสัมผัส: ปุ่ม/ข้อความเป็น DOM (TouchScreens) — คีย์บอร์ดยังใช้ได้ (Enter = เดินทางต่อ · Esc = เมนูหลัก)
    if (this.registry.get(REGISTRY_TOUCH_UI) === true) {
      this.navStack.push(new MenuNavigator([], () => goToMainMenu(this)));
      return;
    }

    const banner = this.add.graphics();
    drawPixelFrame(banner, 230, 16, 500, 56, 'wood');
    this.add
      .text(GAME_WIDTH / 2, 26, view.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: PIXEL.light,
        stroke: '#2a1a0c',
        strokeThickness: 4,
        padding: { top: 4 },
      })
      .setOrigin(0.5, 0);

    view.nodes.slice(0, JOURNEY_LAYOUT.length).forEach((node, i) => this.drawCard(node, i));

    // แถบล่าง: รหัสลับ + บทสุดท้าย · ปุ่มเดินทางต่อ · ปุ่มกลับเมนู
    const bar = this.add.graphics();
    drawPixelFrame(bar, 20, 560, 470, 64, 'paper');
    this.add.text(36, 566, `คำพิทักษ์: ${view.codes.join(' · ')}`, this.style(17, PIXEL.ink));
    this.add.text(36, 596, view.notice.text, this.style(13, NOTICE_COLOR[view.notice.tone]));

    const go = new PixelButton(this, 504, 566, view.primary.label, { width: 290, height: 52, fontSize: 17, onClick: () => this.go() });
    go.setEnabled(view.primary.enabled);
    const back = new PixelButton(this, 806, 566, 'เมนูหลัก', { width: 136, height: 52, fontSize: 17, onClick: () => goToMainMenu(this) });
    this.navStack.push(new MenuNavigator([go, back], () => goToMainMenu(this)));
  }

  private style(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, lineSpacing: 2, padding: { top: 4 } };
  }

  /** การ์ดตำบล (แสดงผลอย่างเดียว ไม่มีปุ่มเข้าด่าน) */
  private drawCard(node: JourneyNode, i: number): void {
    const { x, y } = JOURNEY_LAYOUT[i].card;
    const g = this.add.graphics();
    const state = node.state;
    const dim = state === 'locked' || state === 'next';
    drawPixelFrame(g, x, y, CARD_W, CARD_H, 'paper', dim ? 0xe4dcc6 : state === 'current' ? 0xfff2c4 : undefined);
    if (state === 'current') g.lineStyle(4, 0xd9822b, 1).strokeRect(x - 4, y - 4, CARD_W + 8, CARD_H + 8);
    const left = x + 16;
    const inner = CARD_W - 32;
    let yy = y + 14;
    const line = (s: string, size: number, color: string, gap = 2) => {
      const t = this.add.text(left, yy, wrapThaiText(s, inner, `${size}px ${FONT_FAMILY}`), this.style(size, color));
      yy += t.height + gap;
    };
    line(`บทที่ ${node.order} · ${node.tambon}`, 19, dim ? PIXEL.inkMuted : PIXEL.ink);
    line(node.title, 15, PIXEL.inkSoft, 4);
    line(`สถานะ: ${node.stateLabel}${node.inProgress ? ' · มีบันทึกค้างอยู่' : ''}`, 14, STATE_COLOR[state]);
    if (node.inDevelopment) line('ภารกิจถัดไปอยู่ระหว่างพัฒนา', 14, PIXEL.bad);
    for (const d of node.details) line(d, d.startsWith('ผลสำรวจ') ? 12 : 14, d.startsWith('ผลสำรวจ') ? PIXEL.inkSoft : PIXEL.ink);
  }

  /** ปุ่มหลักปุ่มเดียว: ไปภารกิจหลักปัจจุบัน (เล่นต่อ / เริ่มบทใหม่ / สรุปการเดินทาง) — ใช้ทั้ง canvas และจอสัมผัส */
  go(): void {
    if (!journeyView(getProgress(this).data).primary.enabled) return;
    continueStory(this);
  }

  backToMenu(): void {
    goToMainMenu(this);
  }
}
