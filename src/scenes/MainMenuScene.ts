import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { DEFAULT_LEVEL_ID, isPlayableLevel } from '../content/registry';
import { drawMenuBackground } from '../graphics/MenuArt';
import { MenuNavigator } from '../ui/pixel/MenuNavigator';
import { Modal } from '../ui/pixel/Modal';
import { PixelButton } from '../ui/pixel/PixelButton';
import { drawPixelFrame } from '../ui/pixel/PixelFrame';
import { PIXEL } from '../ui/pixel/theme';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { getProgress, getSettings, goToWorldMap, SCENE, startLevel } from './navigation';

const CONTROLS: Array<[string, string]> = [
  ['W A S D / ปุ่มลูกศร', 'เดิน (เดินทแยงได้)'],
  ['E / Space / Enter', 'คุยกับ NPC · ตรวจค้น · ไปบทพูดถัดไป'],
  ['M', 'เปิดแผนที่สำรวจ (มาตราส่วน 1:10,000) · ปักหมุด'],
  ['R', 'เริ่มวัดระยะเดินจริงจากจุดที่ยืน'],
  ['N', 'สมุดภาคสนาม: ภารกิจ เบาะแส วิเคราะห์เส้นทาง หลักฐาน'],
  ['G', 'เปิด/ปิดเส้นตาราง (1 ช่อง = 10 ม.)'],
  ['1 2 3', 'เลือกคำตอบ / เลือกเส้นทาง / เลือกประเภทภูมิปัญญา'],
  ['Esc', 'เมนูหยุดเกม (กลับหน้าเลือกด่าน / เมนูหลัก)'],
];

const text = (scene: Phaser.Scene, x: number, y: number, s: string, size: number, color: string = PIXEL.ink) =>
  scene.add.text(x, y, s, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, lineSpacing: 5, padding: { top: 4 } });

/** หน้าเมนูหลัก: เริ่มเกมใหม่ · เล่นต่อ · เลือกด่าน · วิธีเล่น · ตั้งค่า */
export class MainMenuScene extends Phaser.Scene {
  private navStack: MenuNavigator[] = [];
  private continueButton!: PixelButton;

  constructor() {
    super(SCENE.menu);
  }

  create(): void {
    this.navStack = [];
    drawMenuBackground(this);

    const banner = this.add.graphics();
    drawPixelFrame(banner, 170, 28, 620, 150, 'wood');
    this.add
      .text(GAME_WIDTH / 2, 50, 'Geography Mystery RPG', { fontFamily: FONT_FAMILY, fontSize: '20px', color: PIXEL.accent, padding: { top: 4 } })
      .setOrigin(0.5, 0);
    this.add
      .text(GAME_WIDTH / 2, 80, 'ปริศนาลับแห่งคลองลาน', {
        fontFamily: FONT_FAMILY,
        fontSize: '44px',
        color: PIXEL.light,
        stroke: '#2a1a0c',
        strokeThickness: 6,
        padding: { top: 8 },
      })
      .setOrigin(0.5, 0);
    this.add
      .text(GAME_WIDTH / 2, 140, 'เกมสืบสวนภูมิศาสตร์ 4 ตำบลของอำเภอคลองลาน', { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#f3ead2', padding: { top: 4 } })
      .setOrigin(0.5, 0);

    const progress = getProgress(this);
    const items: Array<[string, () => void]> = [
      ['เริ่มเกมใหม่', () => this.newGame()],
      ['เล่นต่อ', () => this.continueGame()],
      ['เลือกด่าน', () => goToWorldMap(this)],
      ['วิธีเล่น', () => this.showHowToPlay()],
      ['ตั้งค่า', () => this.showSettings()],
    ];
    const buttons = items.map(
      ([label, fn], i) => new PixelButton(this, GAME_WIDTH / 2 - 150, 200 + i * 60, label, { width: 300, height: 50, onClick: fn }),
    );
    this.continueButton = buttons[1];
    // "เล่นต่อ" กดได้เฉพาะเมื่อมีข้อมูลบันทึกจริง
    this.continueButton.setEnabled(progress.hasAnySave());
    this.navStack.push(new MenuNavigator(buttons));

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 12, '↑ ↓ เลือก · Enter / Space ยืนยัน · ใช้เมาส์คลิกได้', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: PIXEL.light,
        backgroundColor: '#2a1a0ccc',
        padding: { x: 12, y: 4, top: 6 },
      })
      .setOrigin(0.5, 1);

    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => this.navStack[this.navStack.length - 1]?.handleKey(ev.code));
  }

  private pushModal(title: string, message: string, choices: Array<{ label: string; action: () => void }>): void {
    const modal = new Modal(this, title, message, choices, () => this.navStack.pop());
    this.navStack.push(modal.nav);
  }

  private newGame(): void {
    const progress = getProgress(this);
    if (!progress.hasAnySave()) {
      startLevel(this, DEFAULT_LEVEL_ID, 'fresh');
      return;
    }
    this.pushModal(
      'เริ่มเกมใหม่?',
      'ความคืบหน้าทั้งหมดจะถูกลบ ได้แก่ ด่านที่ผ่านแล้ว รหัสลับที่สะสม และการเล่นที่ค้างอยู่ (การตั้งค่าจะไม่ถูกลบ)',
      [
        {
          label: 'ยืนยัน: ลบและเริ่มใหม่',
          action: () => {
            progress.resetAll();
            startLevel(this, DEFAULT_LEVEL_ID, 'fresh');
          },
        },
        { label: 'ยกเลิก', action: () => undefined },
      ],
    );
  }

  private continueGame(): void {
    const progress = getProgress(this);
    if (!progress.hasAnySave()) return;
    const id = progress.continueLevelId();
    // มีด่านที่เล่นค้าง → เข้าด่านนั้นต่อ; ไม่มี (ผ่านด่านไปแล้ว) → ไปหน้าเลือกด่าน
    if (id && isPlayableLevel(id)) startLevel(this, id, 'resume');
    else goToWorldMap(this);
  }

  /** หน้าต่างแบบกระดาษพร้อมปุ่ม "กลับ" — ใช้กับ วิธีเล่น และ ตั้งค่า */
  private openPanel(title: string, build: (root: Phaser.GameObjects.Container, top: number) => PixelButton[]): void {
    const x = 90;
    const y = 30;
    const w = GAME_WIDTH - 180;
    const h = GAME_HEIGHT - 60;
    const blocker = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPixelFrame(g, x, y, w, h, 'paper');
    const root = this.add.container(0, 0, [blocker, g, text(this, x + 32, y + 22, title, 26, PIXEL.ink)]).setDepth(50);
    const close = () => {
      root.destroy();
      this.navStack.pop();
    };
    const extra = build(root, y + 72);
    const back = new PixelButton(this, GAME_WIDTH / 2 - 110, y + h - 70, 'กลับ', { width: 220, height: 46, onClick: close });
    root.add([...extra, back]);
    this.navStack.push(new MenuNavigator([...extra, back], close));
  }

  private showHowToPlay(): void {
    this.openPanel('วิธีเล่น', (root, top) => {
      const left = 122;
      const width = GAME_WIDTH - 260;
      const goal =
        'สำรวจ 4 ตำบลของอำเภอคลองลาน พูดคุยกับชาวบ้าน เก็บเบาะแสลงสมุดภาคสนาม แล้วใช้ ทิศทาง ระยะทาง และจุดสังเกต ร่วมกันเพื่อไขปริศนา รับรหัสลับตำบลละ 1 ชิ้น';
      const scale =
        'มาตราส่วน: 1 ช่องในเกม = 10 เมตร · แผนที่ 1:10,000 → 1 ซม. บนแผนที่ = 100 เมตร (เช่น 3 ซม. = 300 ม., 4 ซม. = 400 ม.)';
      const tips = 'พื้นที่ที่ยังไม่สำรวจถูกหมอกบัง · ตอบผิดจะได้คำใบ้และลองใหม่ได้ · เกมบันทึกความคืบหน้าอัตโนมัติ';
      let yy = top;
      for (const [t, size, color] of [
        [goal, 17, PIXEL.ink],
        [scale, 16, PIXEL.good],
        [tips, 16, PIXEL.inkSoft],
      ] as const) {
        const node = text(this, left, yy, wrapThaiText(t, width, `${size}px ${FONT_FAMILY}`), size, color);
        root.add(node);
        yy += node.height + 10;
      }
      root.add(this.controlsTable(left, yy + 4));
      return [];
    });
  }

  private controlsTable(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    CONTROLS.forEach(([keys, desc], i) => {
      c.add(text(this, x, y + i * 27, keys, 16, PIXEL.warn));
      c.add(text(this, x + 230, y + i * 27, desc, 16, PIXEL.ink));
    });
    return c;
  }

  private showSettings(): void {
    const settings = getSettings(this);
    this.openPanel('ตั้งค่า', (root, top) => {
      const soundLabel = () => `เสียง: ${settings.settings.soundEnabled ? 'เปิด' : 'ปิด'}`;
      const hintLabel = () => `คำแนะนำการควบคุมในเกม: ${settings.settings.showControlsHint ? 'แสดง' : 'ซ่อน'}`;
      const sound: PixelButton = new PixelButton(this, 160, top, soundLabel(), {
        width: 300,
        height: 46,
        fontSize: 18,
        onClick: () => {
          settings.update({ soundEnabled: !settings.settings.soundEnabled });
          this.sound.mute = !settings.settings.soundEnabled;
          sound.setLabel(soundLabel());
        },
      });
      const hint: PixelButton = new PixelButton(this, 480, top, hintLabel(), {
        width: 320,
        height: 46,
        fontSize: 17,
        onClick: () => {
          settings.update({ showControlsHint: !settings.settings.showControlsHint });
          hint.setLabel(hintLabel());
        },
      });
      root.add(
        text(
          this,
          160,
          top + 56,
          wrapThaiText('ตอนนี้เกมยังไม่มีไฟล์เสียง การปรับระดับเสียงจะเพิ่มเมื่อมีระบบเสียงจริง', GAME_WIDTH - 320, `15px ${FONT_FAMILY}`),
          15,
          PIXEL.inkMuted,
        ),
      );
      root.add(text(this, 160, top + 92, 'ปุ่มควบคุม', 19, PIXEL.ink));
      root.add(this.controlsTable(160, top + 124));
      return [sound, hint];
    });
  }
}
