import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { GameSession } from '../core/session/GameSession';
import { buildCompareLines, COMPARE_TITLE } from './views/compareView';
import { drawBaseSheet } from './sheetRenderer';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';
import { fitCell, MAP_ZOOMS, type ViewRect } from '../core/ui/MapViewport';
import { setTouchView, touchView } from './touch/touchViewState';
import { legendEntries } from './legend';
import { ZoomPanLayer } from './ZoomPanLayer';

const CELL = 5;
const PANEL_Y = 62;

/**
 * หน้าจอเปรียบเทียบแผนที่ฐาน (กด C) — วางสองฉบับเทียบกันในพิกัดเดียวกัน
 * แสดงหลักฐานที่ผู้เล่นมี และอธิบายผลการเลือกจากการตรวจจริง (GameSession.chooseSheet)
 */
export class CompareOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  /** จอสัมผัส: ดูทีละฉบับแบบขยาย/ลากเลื่อนได้ (หัวข้อ แท็บ และข้อความหลักฐานเป็น DOM ตัวอักษรใหญ่) */
  private readonly zp: ZoomPanLayer | null = null;
  private readonly zg: Phaser.GameObjects.Graphics | null = null;
  private readonly zlabels: Phaser.GameObjects.Container | null = null;
  private drawnKey = '';
  private appliedZoom = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    touch = false,
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.93).setOrigin(0);
    const title = scene.add
      .text(GAME_WIDTH / 2, 10, COMPARE_TITLE, textStyle(20, COLORS.accent))
      .setOrigin(0.5, 0);
    this.title = title;
    this.g = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.body = scene.add.text(40, 0, '', { ...textStyle(14), lineSpacing: 3 });
    this.root = scene.add.container(0, 0, [dim, title, this.g, this.labels, this.body]).setDepth(22).setVisible(false);
    if (touch) {
      this.zp = new ZoomPanLayer(scene);
      this.zg = scene.add.graphics();
      this.zlabels = scene.add.container(0, 0);
      this.zp.content.add([this.zg, this.zlabels]).setDepth(23).setVisible(false);
    }
  }

  /** ช่องแผนที่ใต้จุดที่แตะ (ไม่ใช้เลือกคำตอบ — ใช้แค่ลากเลื่อน) */
  get panPosition(): { x: number; y: number } | null {
    return this.zp && this.zp.content.visible ? this.zp.position : null;
  }

  panFrom(start: { x: number; y: number }, dx: number, dy: number): void {
    this.zp?.panBy(dx, dy, start);
  }

  /** จอสัมผัส: แสดงแผนที่ฐานทีละฉบับเต็มพื้นที่ (แท็บ "ฉบับ 1 / ฉบับ 2") หรือซ่อนเมื่ออ่านหน้าหลักฐาน */
  private renderTouch(s: GameSession): void {
    const zp = this.zp!;
    this.title.setVisible(false);
    this.body.setVisible(false);
    this.g.clear();
    this.labels.removeAll(true);
    const sheets = s.availableSheets().slice(0, 2);
    const tab = touchView.compareTab;
    const sheet = tab === 'text' ? undefined : sheets[tab];
    if (!sheet) {
      zp.content.setVisible(false);
      this.drawnKey = '';
      return;
    }
    const ins = touchView.mapInsets;
    const view: ViewRect = {
      x: Math.round(ins.left),
      y: Math.round(ins.top),
      w: Math.max(200, Math.round(GAME_WIDTH - ins.left - ins.right)),
      h: Math.max(160, Math.round(GAME_HEIGHT - ins.top - ins.bottom)),
    };
    const key = `${sheet.id}|${JSON.stringify(view)}`;
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      const cell = fitCell(s.grid.width, s.grid.height, view);
      zp.configure(view, cell, s.grid.width, s.grid.height);
      this.zg!.clear();
      this.zlabels!.removeAll(true);
      const symbols = drawBaseSheet(this.scene, this.zg!, this.zlabels!, sheet, { x: 0, y: 0, cell, width: s.grid.width, height: s.grid.height }, { labelSize: 14, showNote: false });
      setTouchView({ legendItems: legendEntries(this.scene, sheet.flowArrows?.length ? [...symbols, 'flow'] : symbols) });
      zp.contentChanged();
      this.appliedZoom = -1;
    }
    const zi = touchView.mapZoomIndex;
    if (zi !== this.appliedZoom) {
      zp.setZoom(MAP_ZOOMS[zi], this.appliedZoom < 0 ? s.playerTile : zp.centerTile());
      this.appliedZoom = zi;
    }
    zp.content.setVisible(true);
  }

  render(s: GameSession): void {
    if (s.mode !== 'compare') {
      this.root.setVisible(false);
      this.zp?.content.setVisible(false);
      this.drawnKey = '';
      return;
    }
    this.root.setVisible(true);
    if (this.zp) {
      this.renderTouch(s);
      return;
    }
    this.g.clear();
    this.labels.removeAll(true);
    const sheets = s.availableSheets().slice(0, 2);
    const w = s.grid.width * CELL;
    const h = s.grid.height * CELL;
    sheets.forEach((sheet, i) => {
      const x = i === 0 ? 40 : GAME_WIDTH - 40 - w;
      drawBaseSheet(this.scene, this.g, this.labels, sheet, { x, y: PANEL_Y, cell: CELL, width: s.grid.width, height: s.grid.height }, {
        labelSize: 10,
        showGridNumbers: false,
        showNote: false,
      });
      this.labels.add(
        this.scene.add
          .text(x + 6, PANEL_Y + 4, `${i + 1}) ${sheet.title}`, { ...textStyle(13, '#3a2a1a'), backgroundColor: '#f3ead2cc' })
          .setOrigin(0, 0),
      );
    });

    // ข้อความมาจาก buildCompareLines (ใช้ร่วมกับหน้าอ่านบนจอสัมผัส)
    const v = buildCompareLines(s);
    const lines = [...v.evidence, ...v.status, ...(v.result.length ? ['', ...v.result] : [])];
    this.body
      .setText(wrapThaiText(lines.join('\n'), GAME_WIDTH - 80, `14px ${FONT_FAMILY}`))
      .setPosition(40, PANEL_Y + h + 12);
  }
}
