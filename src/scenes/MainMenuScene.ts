import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { drawMenuBackground } from '../graphics/MenuArt';
import { MenuNavigator } from '../ui/pixel/MenuNavigator';
import { Modal } from '../ui/pixel/Modal';
import { PixelButton } from '../ui/pixel/PixelButton';
import { drawPixelFrame } from '../ui/pixel/PixelFrame';
import { PIXEL } from '../ui/pixel/theme';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { GAME_TITLE, HOW_TO_GOAL, HOW_TO_SCALE, HOW_TO_TIPS, KEYBOARD_CONTROLS, menuView, NEW_GAME_CONFIRM, SETTINGS_NOTE, type MenuItemId } from '../ui/views/screens';
import { REGISTRY_TOUCH_UI } from './events';
import { continueStory, getProgress, getSettings, goToWorldMap, SCENE } from './navigation';

const text = (scene: Phaser.Scene, x: number, y: number, s: string, size: number, color: string = PIXEL.ink) =>
  scene.add.text(x, y, s, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, lineSpacing: 5, padding: { top: 4 } });

/** หน้าเมนูหลัก: เริ่มเกมใหม่ · เล่นต่อ · แผนที่การเดินทาง · วิธีเล่น · ตั้งค่า */
export class MainMenuScene extends Phaser.Scene {
  private navStack: MenuNavigator[] = [];

  constructor() {
    super(SCENE.menu);
  }

  create(): void {
    this.navStack = [];
    drawMenuBackground(this);
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => this.navStack[this.navStack.length - 1]?.handleKey(ev.code));
    // จอสัมผัส: หัวเกม ปุ่มเมนู วิธีเล่น ตั้งค่า เป็น DOM ตัวอักษรใหญ่ (TouchScreens) — canvas เป็นภาพพื้นหลัง Pixel Art
    if (this.registry.get(REGISTRY_TOUCH_UI) === true) return;

    const banner = this.add.graphics();
    drawPixelFrame(banner, 170, 28, 620, 150, 'wood');
    this.add
      .text(GAME_WIDTH / 2, 50, GAME_TITLE.kicker, { fontFamily: FONT_FAMILY, fontSize: '20px', color: PIXEL.accent, padding: { top: 4 } })
      .setOrigin(0.5, 0);
    this.add
      .text(GAME_WIDTH / 2, 80, GAME_TITLE.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '44px',
        color: PIXEL.light,
        stroke: '#2a1a0c',
        strokeThickness: 6,
        padding: { top: 8 },
      })
      .setOrigin(0.5, 0);
    this.add
      .text(GAME_WIDTH / 2, 140, GAME_TITLE.subtitle, { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#f3ead2', padding: { top: 4 } })
      .setOrigin(0.5, 0);

    const view = menuView(getProgress(this).data, this.hasSave());
    const actions: Record<MenuItemId, () => void> = {
      new: () => this.newGame(),
      continue: () => this.continueGame(),
      journey: () => goToWorldMap(this),
      howto: () => this.showHowToPlay(),
      settings: () => this.showSettings(),
    };
    const buttons = view.items.map(
      (item, i) => new PixelButton(this, GAME_WIDTH / 2 - 150, 200 + i * 60, item.label, { width: 300, height: 50, onClick: actions[item.id] }),
    );
    // "เล่นต่อ" กดได้เฉพาะเมื่อมีข้อมูลบันทึกจริง
    view.items.forEach((item, i) => buttons[i].setEnabled(item.enabled));
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
  }

  /* ---------- คำสั่งที่ใช้ร่วมกัน (ปุ่มบน canvas และปุ่มบนจอสัมผัส) ---------- */

  hasSave(): boolean {
    return getProgress(this).hasAnySave();
  }

  /** เริ่มบทที่ 1 — ถ้ามีบันทึก ต้องผ่านการยืนยันก่อน (confirmed = true) */
  startNewGame(confirmed: boolean): boolean {
    const progress = getProgress(this);
    if (progress.hasAnySave() && !confirmed) return false;
    if (progress.hasAnySave()) progress.resetAll();
    // เกมใหม่: Intro ตำนานพญาจระเข้ 3 ฉาก → บทที่ 1 (IntroScene เรียก beginChapter เอง)
    this.scene.start(SCENE.intro);
    return true;
  }

  openJourney(): void {
    goToWorldMap(this);
  }

  toggleSound(): boolean {
    const settings = getSettings(this);
    settings.update({ soundEnabled: !settings.settings.soundEnabled });
    this.sound.mute = !settings.settings.soundEnabled;
    return settings.settings.soundEnabled;
  }

  toggleControlsHint(): boolean {
    const settings = getSettings(this);
    settings.update({ showControlsHint: !settings.settings.showControlsHint });
    return settings.settings.showControlsHint;
  }

  private pushModal(title: string, message: string, choices: Array<{ label: string; action: () => void }>): void {
    const modal = new Modal(this, title, message, choices, () => this.navStack.pop());
    this.navStack.push(modal.nav);
  }

  private newGame(): void {
    // เริ่มภารกิจตั้งแต่บทที่ 1 (ฉากเปิดเรื่องของครูเนม แล้วเข้าตำบลสักงาม) — มีบันทึกอยู่ต้องยืนยันก่อน
    if (this.startNewGame(false)) return;
    this.pushModal(NEW_GAME_CONFIRM.title, NEW_GAME_CONFIRM.message, [
      { label: NEW_GAME_CONFIRM.confirm, action: () => this.startNewGame(true) },
      { label: NEW_GAME_CONFIRM.cancel, action: () => undefined },
    ]);
  }

  /** เล่นต่อ: กลับไปภารกิจหลักล่าสุด (ตำแหน่งและสถานะปริศนาเดิม) หรือรับภารกิจบทถัดไป */
  continueGame(): void {
    if (!getProgress(this).hasAnySave()) return;
    continueStory(this);
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
      let yy = top;
      for (const [t, size, color] of [
        [HOW_TO_GOAL, 17, PIXEL.ink],
        [HOW_TO_SCALE, 16, PIXEL.good],
        [HOW_TO_TIPS, 16, PIXEL.inkSoft],
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
    KEYBOARD_CONTROLS.forEach(([keys, desc], i) => {
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
          this.toggleSound();
          sound.setLabel(soundLabel());
        },
      });
      const hint: PixelButton = new PixelButton(this, 480, top, hintLabel(), {
        width: 320,
        height: 46,
        fontSize: 17,
        onClick: () => {
          this.toggleControlsHint();
          hint.setLabel(hintLabel());
        },
      });
      root.add(
        text(
          this,
          160,
          top + 56,
          wrapThaiText(SETTINGS_NOTE, GAME_WIDTH - 320, `15px ${FONT_FAMILY}`),
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
