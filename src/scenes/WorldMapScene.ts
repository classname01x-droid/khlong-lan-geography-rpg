import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import { LEVEL_SEQUENCE, LEVELS, type LevelSlot } from '../content/registry';
import { describeLevel, type LevelCardModel, type LevelState } from '../core/progress/LevelProgress';
import { drawWorldMapArt } from '../graphics/MenuArt';
import { OBJECT_TILE, TERRAIN_TILE } from '../graphics/tileIndex';
import { fmtMeters } from '../ui/format';
import { MenuNavigator } from '../ui/pixel/MenuNavigator';
import { Modal } from '../ui/pixel/Modal';
import { PixelButton } from '../ui/pixel/PixelButton';
import { drawPixelFrame } from '../ui/pixel/PixelFrame';
import { PIXEL } from '../ui/pixel/theme';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { getProgress, goToMainMenu, SCENE, startLevel } from './navigation';

/**
 * ตำแหน่งบนแผนที่โลกเป็น "ภาพประกอบ" เท่านั้น (ไม่ใช่มาตราส่วนหรือตำแหน่งจริง)
 * ห้ามใช้หน้านี้คำนวณระยะทาง — แผนที่เพื่อการเรียนรู้อยู่ในแต่ละด่าน (ScaleSystem 1:10,000)
 * เรียงตามลำดับด่าน: บนซ้าย → บนขวา → ล่างขวา → ล่างซ้าย
 */
const LAYOUT = [
  { region: { x: 100, y: 190 }, card: { x: 196, y: 84 }, icon: OBJECT_TILE.roofRed },
  { region: { x: 860, y: 190 }, card: { x: 494, y: 84 }, icon: TERRAIN_TILE.water },
  { region: { x: 860, y: 430 }, card: { x: 494, y: 324 }, icon: OBJECT_TILE.rock },
  { region: { x: 100, y: 430 }, card: { x: 196, y: 324 }, icon: OBJECT_TILE.flagpole },
];
const CARD_W = 270;
const CARD_H = 228;

const STATE_COLOR: Record<LevelState, string> = {
  locked: PIXEL.inkMuted,
  unlocked: PIXEL.good,
  'in-development': PIXEL.warn,
  completed: PIXEL.good,
};

const BUTTON_LABEL: Record<LevelState, string> = {
  locked: 'ล็อก',
  unlocked: 'เข้าสู่ด่าน',
  'in-development': 'อยู่ระหว่างพัฒนา',
  completed: 'เข้าสู่ด่าน (เล่นอีกครั้ง)',
};

/** หน้าเลือกด่าน / แผนที่โลกของ 4 ตำบล */
export class WorldMapScene extends Phaser.Scene {
  private navStack: MenuNavigator[] = [];
  private notice!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE.worldMap);
  }

  create(): void {
    this.navStack = [];
    const progress = getProgress(this);
    const models = LEVEL_SEQUENCE.map((slot, i) =>
      describeLevel(slot, progress.data, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null),
    );

    drawWorldMapArt(
      this,
      LAYOUT.map((l, i) => ({ ...l.region, icon: l.icon, locked: models[i].state === 'locked' })),
    );

    const banner = this.add.graphics();
    drawPixelFrame(banner, 230, 16, 500, 56, 'wood');
    this.add
      .text(GAME_WIDTH / 2, 26, 'เลือกด่าน — แผนที่อำเภอคลองลาน', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: PIXEL.light,
        stroke: '#2a1a0c',
        strokeThickness: 4,
        padding: { top: 4 },
      })
      .setOrigin(0.5, 0);

    const enterButtons = LEVEL_SEQUENCE.map((slot, i) => this.drawCard(slot, models[i], i));

    // แถบล่าง: รหัสลับที่สะสม + หมายเหตุ + ปุ่มกลับ
    const bar = this.add.graphics();
    drawPixelFrame(bar, 20, 560, 640, 64, 'paper');
    const pieces = LEVEL_SEQUENCE.map((s) => progress.data.codePieces[s.id]?.value ?? '?').join(' · ');
    this.add.text(40, 568, `รหัสลับที่ค้นพบ: ${pieces}`, this.style(18, PIXEL.ink));
    this.notice = this.add.text(40, 596, 'แผนที่ภาพรวม ไม่ใช่มาตราส่วนจริง — ใช้เลือกตำบลเท่านั้น', this.style(13, PIXEL.inkMuted));
    const back = new PixelButton(this, 690, 568, 'กลับเมนูหลัก', { width: 250, height: 50, onClick: () => goToMainMenu(this) });

    this.navStack.push(new MenuNavigator([...enterButtons, back], () => goToMainMenu(this)));
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => this.navStack[this.navStack.length - 1]?.handleKey(ev.code));
  }

  private style(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, lineSpacing: 2, padding: { top: 4 } };
  }

  private drawCard(slot: LevelSlot, m: LevelCardModel, i: number): PixelButton {
    const { x, y } = LAYOUT[i].card;
    const g = this.add.graphics();
    drawPixelFrame(g, x, y, CARD_W, CARD_H, 'paper', m.state === 'locked' ? 0xe4dcc6 : undefined);
    const left = x + 16;
    const inner = CARD_W - 32;
    let yy = y + 14;
    const line = (s: string, size: number, color: string, gap = 2) => {
      const t = this.add.text(left, yy, wrapThaiText(s, inner, `${size}px ${FONT_FAMILY}`), this.style(size, color));
      yy += t.height + gap;
    };
    line(`${i + 1}. ${slot.tambon}`, 19, m.state === 'locked' ? PIXEL.inkMuted : PIXEL.ink);
    line(slot.missionTitle, 15, PIXEL.inkSoft, 4);
    line(`สถานะ: ${m.stateLabel}`, 14, STATE_COLOR[m.state]);
    line(m.evidenceText, 14, PIXEL.ink);
    line(`รหัสลับ: ${m.codePiece ? `ชิ้นที่ ${m.codePiece.index} "${m.codePiece.value}"` : 'ยังไม่พบ'}`, 14, PIXEL.ink);
    if (m.result) {
      const sec = Math.floor(m.result.elapsedMs / 1000);
      const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      line(`รอบแรก: ${fmtMeters(m.result.distanceMeters)} · ผิด ${m.result.mistakes} ครั้ง · เวลา ${time}`, 12, PIXEL.inkSoft);
    }
    const button = new PixelButton(this, x + 16, y + CARD_H - 56, BUTTON_LABEL[m.state], {
      width: CARD_W - 32,
      height: 42,
      fontSize: 16,
      onClick: () => this.enter(slot, m),
    });
    button.setEnabled(m.canEnter);
    return button;
  }

  private enter(slot: LevelSlot, m: LevelCardModel): void {
    if (!m.canEnter) {
      this.notice.setText(`${slot.tambon}: ${m.stateLabel}`).setColor(PIXEL.bad);
      return;
    }
    if (!m.hasInProgress) {
      if (!startLevel(this, slot.id, 'fresh')) this.notice.setText(`${slot.tambon}: ยังไม่มีเนื้อหาด่าน`).setColor(PIXEL.bad);
      return;
    }
    const progress = getProgress(this);
    const modal = new Modal(
      this,
      'พบบันทึกที่เล่นค้างไว้',
      `${slot.tambon} — ${slot.missionTitle} มีความคืบหน้าที่บันทึกไว้ ต้องการเล่นต่อ หรือเริ่มด่านนี้ใหม่?`,
      [
        { label: 'เล่นต่อจากที่บันทึกไว้', action: () => startLevel(this, slot.id, 'resume') },
        {
          label: 'เริ่มด่านใหม่ (ลบบันทึกค้างของด่านนี้)',
          action: () => {
            progress.clearInProgress(slot.id);
            startLevel(this, slot.id, 'fresh');
          },
        },
        { label: 'ยกเลิก', action: () => undefined },
      ],
      () => this.navStack.pop(),
    );
    this.navStack.push(modal.nav);
  }
}

