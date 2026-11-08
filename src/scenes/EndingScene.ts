import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { CHAPTERS } from '../content/story/chapters';
import { isCampaignComplete } from '../core/campaign/Campaign';
import { MenuNavigator } from '../ui/pixel/MenuNavigator';
import { PixelButton } from '../ui/pixel/PixelButton';
import { drawPixelFrame } from '../ui/pixel/PixelFrame';
import { PIXEL } from '../ui/pixel/theme';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { endingSummary, endingView } from '../ui/views/screens';
import { REGISTRY_TOUCH_UI } from './events';
import { getProgress, goToMainMenu, goToWorldMap, SCENE } from './navigation';

/**
 * ฉากจบเกม: แผนที่ภูมิปัญญาครบ 4 ตำบล + สรุปผลการเรียนรู้ทั้งการเดินทาง
 * ตัวเลขทั้งหมดมาจากผลที่บันทึกไว้จริง (summarizeJourney) — ค่าที่บันทึกรุ่นเก่าไม่มีจะระบุว่าทราบจากกี่บท ไม่ประมาณ
 * เปิดได้เฉพาะเมื่อจบเกมแล้วจริง (ผ่านบท 1–5)
 */
export class EndingScene extends Phaser.Scene {
  private nav: MenuNavigator | null = null;

  constructor() {
    super(SCENE.ending);
  }

  create(): void {
    const progress = getProgress(this).data;
    if (!isCampaignComplete(CHAPTERS, progress)) {
      this.time.delayedCall(0, () => goToWorldMap(this));
      return;
    }
    const sum = endingSummary(progress);
    const view = endingView(progress, sum);

    const g = this.add.graphics();
    g.fillStyle(PIXEL.creamDark, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => this.nav?.handleKey(ev.code));
    if (import.meta.env.DEV) (window as unknown as { __ENDING__: unknown }).__ENDING__ = sum;
    // จอสัมผัส: เนื้อหาเป็น DOM ตัวอักษรใหญ่ แบ่งแท็บ เลื่อนอ่านได้ (TouchScreens) — canvas เป็นพื้นหลัง
    if (this.registry.get(REGISTRY_TOUCH_UI) === true) {
      this.nav = new MenuNavigator([], () => goToMainMenu(this));
      return;
    }
    drawPixelFrame(g, 150, 12, 660, 70, 'wood');
    this.add.text(GAME_WIDTH / 2, 20, view.title, this.style(26, PIXEL.light, true)).setOrigin(0.5, 0);
    this.add.text(GAME_WIDTH / 2, 56, view.subtitle, this.style(15, '#f3ead2')).setOrigin(0.5, 0);

    // ---- ซ้าย: แผนที่ภูมิปัญญา 4 ตำบล ----
    drawPixelFrame(g, 16, 92, 470, 470, 'paper');
    let y = 106;
    const left = (text: string, size: number, color: string, gap = 4, width = 438) => {
      const t = this.add.text(32, y, wrapThaiText(text, width, `${size}px ${FONT_FAMILY}`), this.style(size, color));
      y += t.height + gap;
    };
    left('แผนที่ภูมิปัญญา 4 ตำบล', 19, PIXEL.ink, 8);
    for (const w of view.wisdom) {
      left(`${w.index}. ${w.tambon} — ${w.site}`, 15, PIXEL.ink, 2);
      left(`   ทักษะ: ${w.learning}`, 13, PIXEL.inkSoft, 2);
      left(`   คำพิทักษ์คำที่ ${w.index}: "${w.code}"${w.evidence ? ` · ${w.evidence}` : ''}`, 13, PIXEL.good, 10);
    }
    left(`คำพิทักษ์ครบ 4 คำ: ${view.codes.join(' · ')}`, 16, PIXEL.warn, 4);
    left(view.note, 12, PIXEL.inkMuted, 0);

    // ---- ขวา: ผลการเรียนรู้ ----
    drawPixelFrame(g, 498, 92, 446, 470, 'paper');
    y = 106;
    const right = (text: string, size: number, color: string, gap = 4) => {
      const t = this.add.text(514, y, wrapThaiText(text, 414, `${size}px ${FONT_FAMILY}`), this.style(size, color));
      y += t.height + gap;
    };
    right('ผลการเรียนรู้ทั้งการเดินทาง', 19, PIXEL.ink, 8);
    view.stats.forEach((line, i) => right(line, 15, PIXEL.ink, i === view.stats.length - 1 ? 10 : 4));
    right('ทักษะภูมิศาสตร์ที่ได้ใช้', 16, PIXEL.ink, 4);
    right(view.skills.length ? view.skills.map((l) => `• ${l}`).join('\n') : 'ไม่มีข้อมูลในบันทึก', 13, PIXEL.good, 4);

    const map = new PixelButton(this, 230, 576, 'แผนที่การเดินทาง', { width: 240, height: 50, fontSize: 18, onClick: () => this.toJourney() });
    const menu = new PixelButton(this, 490, 576, 'เมนูหลัก', { width: 240, height: 50, fontSize: 18, onClick: () => this.toMenu() });
    this.nav = new MenuNavigator([map, menu], () => goToMainMenu(this));
  }

  toJourney(): void {
    goToWorldMap(this);
  }

  toMenu(): void {
    goToMainMenu(this);
  }

  private style(size: number, color: string, stroke = false): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      color,
      lineSpacing: 2,
      padding: { top: 4 },
      ...(stroke ? { stroke: '#2a1a0c', strokeThickness: 5 } : {}),
    };
  }
}
