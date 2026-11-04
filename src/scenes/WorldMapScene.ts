import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import { LEVEL_SEQUENCE, LEVELS } from '../content/registry';
import { CHAPTERS, FINALE_CHAPTER_ID } from '../content/story/chapters';
import {
  chapterStates,
  continueTarget,
  IN_DEVELOPMENT_MESSAGE,
  isCampaignComplete,
  type ChapterSlot,
  type ChapterState,
} from '../core/campaign/Campaign';
import { describeLevel, type LevelCardModel } from '../core/progress/LevelProgress';
import { drawWorldMapArt } from '../graphics/MenuArt';
import { fmtMeters } from '../ui/format';
import { MenuNavigator } from '../ui/pixel/MenuNavigator';
import { PixelButton } from '../ui/pixel/PixelButton';
import { drawPixelFrame } from '../ui/pixel/PixelFrame';
import { PIXEL } from '../ui/pixel/theme';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { JOURNEY_LAYOUT } from './journeyLayout';
import { continueStory, getProgress, goToMainMenu, SCENE } from './navigation';

const CARD_W = 270;
const CARD_H = 228;

const STATE_LABEL: Record<ChapterState, string> = {
  explored: 'สำรวจแล้ว ✓',
  current: 'ภารกิจปัจจุบัน',
  next: 'เป้าหมายต่อไป',
  locked: 'ยังเดินทางไปไม่ถึง',
};

const STATE_COLOR: Record<ChapterState, string> = {
  explored: PIXEL.good,
  current: PIXEL.warn,
  next: PIXEL.inkSoft,
  locked: PIXEL.inkMuted,
};

/**
 * แผนที่การเดินทาง (เดิมคือหน้าเลือกด่าน) — แสดงตำบลที่สำรวจแล้ว ภารกิจปัจจุบัน และเป้าหมายต่อไป
 * ไม่ใช่หน้าเลือกด่านอิสระ: มีปุ่มเดียว "เดินทางต่อ" ที่พาไปภารกิจหลักปัจจุบันเท่านั้น
 */
export class WorldMapScene extends Phaser.Scene {
  private navStack: MenuNavigator[] = [];
  private notice!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE.worldMap);
  }

  create(): void {
    this.navStack = [];
    const progress = getProgress(this);
    const states = chapterStates(CHAPTERS, progress.data);
    const complete = isCampaignComplete(CHAPTERS, progress.data);
    const models = LEVEL_SEQUENCE.map((slot, i) =>
      describeLevel(slot, progress.data, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null),
    );

    drawWorldMapArt(
      this,
      JOURNEY_LAYOUT.map((l, i) => ({ ...l.region, icon: l.icon, locked: states[CHAPTERS[i].id] === 'locked' || states[CHAPTERS[i].id] === 'next' })),
    );

    const banner = this.add.graphics();
    drawPixelFrame(banner, 230, 16, 500, 56, 'wood');
    this.add
      .text(GAME_WIDTH / 2, 26, complete ? 'แผนที่การเดินทาง — สำรวจครบทั้ง 4 ตำบล ✓' : 'แผนที่การเดินทาง — อำเภอคลองลาน', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: PIXEL.light,
        stroke: '#2a1a0c',
        strokeThickness: 4,
        padding: { top: 4 },
      })
      .setOrigin(0.5, 0);

    LEVEL_SEQUENCE.forEach((_slot, i) => this.drawCard(CHAPTERS[i], states[CHAPTERS[i].id], models[i], i));

    // แถบล่าง: รหัสลับ + บทสุดท้าย · ปุ่มเดินทางต่อ · ปุ่มกลับเมนู
    const bar = this.add.graphics();
    drawPixelFrame(bar, 20, 560, 470, 64, 'paper');
    const pieces = LEVEL_SEQUENCE.map((s) => progress.data.codePieces[s.id]?.value ?? '?').join(' · ');
    this.add.text(36, 566, `รหัสลับ: ${pieces}`, this.style(17, PIXEL.ink));
    const finale = CHAPTERS.find((c) => c.id === FINALE_CHAPTER_ID)!;
    const finaleText = complete
      ? 'บทที่ 5 ปริศนาสุดท้าย: สำเร็จแล้ว — แผนที่ภูมิปัญญาฉบับสมบูรณ์'
      : states[finale.id] === 'current'
        ? `บทที่ 5 พร้อมแล้ว: ${finale.tambon} (รหัสครบ 4 ชิ้น)`
        : 'บทที่ 5 ปริศนาสุดท้าย: ต้องจบบท 1–4 และมีรหัสครบ 4 ชิ้น';
    this.notice = this.add.text(36, 596, finaleText, this.style(13, PIXEL.inkSoft));

    const target = continueTarget(CHAPTERS, progress.data);
    const label =
      target.kind === 'complete'
        ? 'ดูสรุปการเดินทาง'
        : target.kind === 'resume'
          ? `เล่นต่อ: บทที่ ${target.chapter.order}`
          : target.kind === 'begin'
            ? `เดินทางต่อ: บทที่ ${target.chapter.order}`
            : target.kind === 'blocked'
              ? 'รหัสลับยังไม่ครบ'
              : IN_DEVELOPMENT_MESSAGE;
    const go = new PixelButton(this, 504, 566, label, { width: 290, height: 52, fontSize: 17, onClick: () => this.go() });
    go.setEnabled(target.kind !== 'in-development' && target.kind !== 'blocked');
    if (target.kind === 'in-development') this.notice.setText(`บทที่ ${target.chapter.order}: ${IN_DEVELOPMENT_MESSAGE} — ความคืบหน้าถูกบันทึกไว้แล้ว`).setColor(PIXEL.warn);
    if (target.kind === 'blocked') this.notice.setText(`บทที่ ${target.chapter.order}: ต้องมีรหัสลับครบ 4 ชิ้นก่อน (ยังขาด ${target.missingCodes.length} ชิ้น)`).setColor(PIXEL.bad);
    const back = new PixelButton(this, 806, 566, 'เมนูหลัก', { width: 136, height: 52, fontSize: 17, onClick: () => goToMainMenu(this) });

    this.navStack.push(new MenuNavigator([go, back], () => goToMainMenu(this)));
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => this.navStack[this.navStack.length - 1]?.handleKey(ev.code));
  }

  private style(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, lineSpacing: 2, padding: { top: 4 } };
  }

  /** การ์ดตำบล (แสดงผลอย่างเดียว ไม่มีปุ่มเข้าด่าน) */
  private drawCard(chapter: ChapterSlot, state: ChapterState, m: LevelCardModel, i: number): void {
    const { x, y } = JOURNEY_LAYOUT[i].card;
    const g = this.add.graphics();
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
    line(`บทที่ ${chapter.order} · ${chapter.tambon}`, 19, dim ? PIXEL.inkMuted : PIXEL.ink);
    line(chapter.title, 15, PIXEL.inkSoft, 4);
    line(`สถานะ: ${STATE_LABEL[state]}${state === 'current' && m.hasInProgress ? ' · มีบันทึกค้างอยู่' : ''}`, 14, STATE_COLOR[state]);
    if (state === 'current' && !chapter.playable) line(IN_DEVELOPMENT_MESSAGE, 14, PIXEL.bad);
    if (state === 'explored' || state === 'current') line(m.evidenceText, 14, PIXEL.ink);
    line(`รหัสลับ: ${m.codePiece ? `ชิ้นที่ ${m.codePiece.index} "${m.codePiece.value}"` : 'ยังไม่พบ'}`, 14, PIXEL.ink);
    if (m.result) {
      const sec = Math.floor(m.result.elapsedMs / 1000);
      const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      line(`ผลสำรวจ: ${fmtMeters(m.result.distanceMeters)} · ผิด ${m.result.mistakes} · ${time} นาที`, 12, PIXEL.inkSoft);
    }
  }

  private go(): void {
    continueStory(this);
  }
}
