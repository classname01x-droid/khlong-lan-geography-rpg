import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import type { GameSession } from '../core/session/GameSession';
import { MAP_COLOR_OBJECT, MAP_COLOR_TERRAIN } from '../graphics/tileIndex';
import type { MapSymbol } from '../core/world/types';
import { drawMapSymbol } from './mapSymbols';
import { drawLegendIcon, legendEntries, legendLabel } from './legend';
import { drawBaseSheet } from './sheetRenderer';
import { mapHint, mapInfo, mapPinLines } from './views/mapText';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';
import { fitCell, MAP_ZOOMS, type ViewRect } from '../core/ui/MapViewport';
import { setTouchView, touchView } from './touch/touchViewState';
import { ZoomPanLayer } from './ZoomPanLayer';

/**
 * ระบบเปิดแผนที่ (M): แสดงเฉพาะพื้นที่ที่สำรวจแล้ว มาตราส่วน 1:10,000
 * และโหมดปักหมุด (เมื่อภารกิจเปิดให้ปัก)
 *
 * ด่านที่มีข้อมูลเพิ่มเติมจะแสดง: เส้นชั้นความสูงทุก 10 ม. + จุดระดับความสูง (▲),
 * สัญลักษณ์แผนที่พร้อมคำอธิบาย และแผ่นที่สอง "แผนที่เก่า" (กด Tab สลับ) — ทั้งหมดใช้พิกัด/มาตราส่วนเดียวกัน
 *
 * จอสัมผัส: แผนที่อยู่ในชั้นที่ขยาย/ลากเลื่อนได้ (ZoomPanLayer) เพื่อให้ชื่อสถานที่อ่านได้บนจอเล็ก
 * หัวแผนที่/มาตราส่วน/สถานะหมุดแสดงเป็นแถบ DOM ตัวอักษรใหญ่ (TouchLayer) และคำอธิบายสัญลักษณ์เปิด/ปิดได้
 */
const CONTOUR_INTERVAL_M = 10;
export class MapOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Container;
  private readonly playerDot: Phaser.GameObjects.Rectangle;
  private readonly cursor: Phaser.GameObjects.Rectangle;
  private readonly pinPanel: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private geom: { x: number; y: number; cell: number };
  /** ชั้นที่มีตัวแผนที่ (คอมพิวเตอร์: อยู่ใน root ที่ตำแหน่งเดิม · จอสัมผัส: ชั้นขยาย/เลื่อนได้) */
  private readonly layer: Phaser.GameObjects.Container;
  private readonly zp: ZoomPanLayer | null = null;
  private readonly legendRoot: Phaser.GameObjects.Container;
  private readonly legendG: Phaser.GameObjects.Graphics;
  private readonly legendLabels: Phaser.GameObjects.Container;
  private touchKey = '';
  private appliedZoom = -1;
  private open = false;
  private drawnSheet = 'current';
  private readonly title: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    private readonly s: GameSession,
    touch = false,
  ) {
    const { width, height } = s.grid;
    const cell = Math.floor(Math.min((GAME_WIDTH - 160) / width, (GAME_HEIGHT - 210) / height));
    const mw = width * cell;
    const mh = height * cell;
    const mx = Math.floor((GAME_WIDTH - mw) / 2);
    const my = 92;
    this.geom = { x: mx, y: my, cell };

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.9).setOrigin(0);
    this.title = scene.add
      .text(GAME_WIDTH / 2, 16, `แผนที่สำรวจ ${s.level.tambon}`, textStyle(22, COLORS.accent))
      .setOrigin(0.5, 0);
    const title = this.title;
    const info = scene.add
      .text(
        GAME_WIDTH / 2,
        52,
        mapInfo(s),
        textStyle(14, COLORS.text),
      )
      .setOrigin(0.5, 0);
    this.graphics = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.playerDot = scene.add.rectangle(0, 0, cell + 2, cell + 2, 0xff4d4d).setStrokeStyle(2, 0xffffff);
    scene.tweens.add({ targets: this.playerDot, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
    this.cursor = scene.add
      .rectangle(0, 0, cell * 3, cell * 3)
      .setStrokeStyle(2, 0xffd84d)
      .setFillStyle(0xffd84d, 0.25)
      .setVisible(false);

    // แถบมาตราส่วน: 100 ม. = 10 ช่อง (คำนวณจาก ScaleSystem)
    const barTiles = s.scale.metersToTiles(100);
    const bx = mx;
    const by = my + mh + 14;
    const bar = scene.add.graphics();
    bar.fillStyle(0xf4efe1, 1).fillRect(bx, by, barTiles * cell * 2, 6);
    bar.fillStyle(0x10141f, 1).fillRect(bx + barTiles * cell + 1, by + 1, barTiles * cell - 2, 4);
    const barText = scene.add.container(0, 0, [
      scene.add.text(bx, by + 8, '0', textStyle(12)).setOrigin(0.5, 0),
      scene.add.text(bx + barTiles * cell, by + 8, '100 ม.', textStyle(12)).setOrigin(0.5, 0),
      scene.add.text(bx + 2 * barTiles * cell, by + 8, '200 ม.', textStyle(12)).setOrigin(0.5, 0),
    ]);
    this.hint = scene.add.text(mx + mw, by + 4, '', textStyle(13, COLORS.textDim)).setOrigin(1, 0);
    const north = scene.add.text(mx + mw + 18, my, '▲\nN\nเหนือ', { ...textStyle(14, COLORS.accent), align: 'center' });
    this.pinPanel = scene.add.text(40, by + 28, '', { ...textStyle(15), lineSpacing: 2 });
    this.legendG = scene.add.graphics();
    this.legendLabels = scene.add.container(0, 0);
    this.legendRoot = scene.add.container(0, 0, [this.legendG, this.legendLabels]);

    const mapParts = [this.graphics, this.labels, this.playerDot, this.cursor];
    if (touch) {
      // ข้อความหัว/มาตราส่วน/สถานะหมุด → แถบ DOM (TouchLayer) · ตัวแผนที่ → ชั้นขยาย/เลื่อนได้ (อยู่ชั้นบนสุด ไม่ซ้อนใน container อื่นเพื่อให้ mask ทำงาน)
      this.zp = new ZoomPanLayer(scene);
      this.layer = this.zp.content;
      this.layer.add(mapParts);
      this.layer.setDepth(21).setVisible(false);
      this.legendRoot.setVisible(false);
      this.root = scene.add.container(0, 0, [dim]).setDepth(20).setVisible(false);
      for (const o of [title, info, bar, barText, this.hint, north, this.pinPanel]) o.setVisible(false);
    } else {
      this.layer = scene.add.container(0, 0, mapParts);
      this.root = scene.add
        .container(0, 0, [dim, title, info, this.layer, this.legendRoot, bar, barText, this.hint, north, this.pinPanel])
        .setDepth(20)
        .setVisible(false);
    }
  }

  /** จอสัมผัส: พื้นที่แสดงแผนที่ = ภาพเกมลบส่วนที่แถบ DOM บัง แล้วตั้งขนาดช่องให้ทั้งแผนที่พอดีที่ระดับ 1× */
  private syncTouchGeometry(): void {
    const ins = touchView.mapInsets;
    const view: ViewRect = {
      x: Math.round(ins.left),
      y: Math.round(ins.top),
      w: Math.max(200, Math.round(GAME_WIDTH - ins.left - ins.right)),
      h: Math.max(160, Math.round(GAME_HEIGHT - ins.top - ins.bottom)),
    };
    const key = JSON.stringify(view);
    if (key === this.touchKey) return;
    this.touchKey = key;
    const cell = fitCell(this.s.grid.width, this.s.grid.height, view);
    this.geom = { x: 0, y: 0, cell };
    this.zp!.configure(view, cell, this.s.grid.width, this.s.grid.height);
    this.playerDot.setSize(cell + 2, cell + 2);
    this.cursor.setSize(cell * 3, cell * 3);
    this.open = false; // วาดใหม่ด้วยขนาดช่องใหม่
    this.appliedZoom = -1;
  }

  /** ขนาดตัวอักษรบนแผนที่ — จอสัมผัสใหญ่ขึ้น (ก่อนขยาย) ให้อ่านได้บนจอ 5–6 นิ้ว */
  private labelSize(desktop: number): number {
    return this.zp ? desktop + 2 : desktop;
  }

  /** ลากเลื่อนแผนที่ (จอสัมผัส) */
  panFrom(start: { x: number; y: number }, dx: number, dy: number): void {
    this.zp?.panBy(dx, dy, start);
  }

  get panPosition(): { x: number; y: number } | null {
    return this.zp ? this.zp.position : null;
  }

  /** ช่องแผนที่ ณ ตำแหน่งบนจอ (ใช้กับการแตะ/คลิกเพื่อวางหมุด) — นอกแผนที่ = null */
  tileAt(px: number, py: number): { x: number; y: number } | null {
    if (this.zp) return this.zp.tileAt(px, py);
    const { x: mx, y: my, cell } = this.geom;
    const x = Math.floor((px - mx) / cell);
    const y = Math.floor((py - my) / cell);
    return x >= 0 && y >= 0 && x < this.s.grid.width && y < this.s.grid.height ? { x, y } : null;
  }

  render(): void {
    const s = this.s;
    if (s.mode !== 'map') {
      if (this.open && this.zp) setTouchView({ mapCellPx: 0 });
      this.open = false;
      this.appliedZoom = -1;
      this.root.setVisible(false);
      this.layer.setVisible(false);
      this.legendRoot.setVisible(false);
      return;
    }
    if (this.zp) this.syncTouchGeometry();
    const opening = !this.open;
    if (!this.open || this.drawnSheet !== s.mapSheet) {
      this.drawnSheet = s.mapSheet;
      if (s.mapSheet !== 'current' && s.availableSheets().some((m) => m.id === s.mapSheet)) this.drawSheet(s.mapSheet);
      else this.drawBase();
      this.open = true;
      this.zp?.contentChanged();
    }
    this.root.setVisible(true);
    this.layer.setVisible(true);
    // คอมพิวเตอร์: คำอธิบายสัญลักษณ์อยู่ข้างแผนที่เสมอ · จอสัมผัส: แผง DOM (เปิดจากปุ่ม)
    this.legendRoot.setVisible(!this.zp);
    if (this.zp) {
      // ขยายครั้งแรกรอบหมุด/ตัวผู้เล่น · เปลี่ยนระดับขยายรอบจุดกลางจอเดิม
      const zi = touchView.mapZoomIndex;
      if (opening || this.appliedZoom < 0) this.zp.setZoom(MAP_ZOOMS[zi], s.pinCursor ?? s.playerTile);
      else if (zi !== this.appliedZoom) this.zp.setZoom(MAP_ZOOMS[zi], this.zp.centerTile());
      this.appliedZoom = zi;
      setTouchView({ mapCellPx: this.zp.cellPx });
    }
    this.updatePlayer();
    const { x: mx, y: my, cell } = this.geom;

    const pinning = s.pinStage !== 'none' && s.pinCursor;
    this.cursor.setVisible(!!pinning);
    if (s.pinCursor) {
      this.cursor.setPosition(mx + (s.pinCursor.x + 0.5) * cell, my + (s.pinCursor.y + 0.5) * cell);
    }
    this.hint.setText(mapHint(s));
    const pin = mapPinLines(s);
    this.pinPanel.setText(wrapThaiText(pin.lines.join('\n'), GAME_WIDTH - 80, `15px ${FONT_FAMILY}`));
    this.pinPanel.setColor(pin.problem ? '#ffb4a3' : COLORS.text);
  }

  /** วาดแผนที่จากข้อมูลหมอก (เฉพาะตอนเปิด) */
  private drawBase(): void {
    const s = this.s;
    const { x: mx, y: my, cell } = this.geom;
    const g = this.graphics;
    const { width, height } = s.grid;
    const scene = this.root.scene;
    this.title.setText(`แผนที่สำรวจ ${s.level.tambon}`);
    g.clear();
    g.fillStyle(0x1b2233, 1).fillRect(mx, my, width * cell, height * cell);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!s.fog.isExplored(x, y)) continue;
        const obj = s.grid.getObject(x, y);
        const color = obj ? MAP_COLOR_OBJECT[obj] : MAP_COLOR_TERRAIN[s.grid.getTerrain(x, y)!];
        g.fillStyle(color, 1).fillRect(mx + x * cell, my + y * cell, cell, cell);
      }
    }
    // เส้นตารางทุก 10 ช่อง (100 ม.) พร้อมเลขพิกัด
    g.lineStyle(1, 0xffffff, 0.25);
    this.labels.removeAll(true);
    for (let x = 0; x <= width; x += 10) {
      g.lineBetween(mx + x * cell, my, mx + x * cell, my + height * cell);
      const xl = s.coords ? `E${s.coords.eastingAtColumnEdge(x)}` : `${x}`;
      this.labels.add(scene.add.text(mx + x * cell, my - 4, xl, textStyle(this.labelSize(s.coords ? 9 : 11), COLORS.textDim)).setOrigin(0.5, 1));
    }
    for (let y = 0; y <= height; y += 10) {
      g.lineBetween(mx, my + y * cell, mx + width * cell, my + y * cell);
      const yl = s.coords ? `N${s.coords.northingAtRowEdge(y)}` : `${y}`;
      this.labels.add(scene.add.text(mx - 6, my + y * cell, yl, textStyle(this.labelSize(s.coords ? 9 : 11), COLORS.textDim)).setOrigin(1, 0.5));
    }
    g.lineStyle(2, COLORS.panelBorder, 1).strokeRect(mx, my, width * cell, height * cell);

    // เส้นชั้นความสูงทุก 10 ม. (เฉพาะพื้นที่ที่สำรวจแล้ว)
    const elev = s.elevation;
    const legend: Array<MapSymbol | 'contour' | 'spot'> = [];
    if (elev) {
      legend.push('contour', 'spot');
      g.lineStyle(1.5, 0xf0c27a, 0.9);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!s.fog.isExplored(x, y)) continue;
          const b = elev.band(x + 0.5, y + 0.5, CONTOUR_INTERVAL_M);
          if (x + 1 < width && s.fog.isExplored(x + 1, y) && elev.band(x + 1.5, y + 0.5, CONTOUR_INTERVAL_M) !== b) {
            g.lineBetween(mx + (x + 1) * cell, my + y * cell, mx + (x + 1) * cell, my + (y + 1) * cell);
          }
          if (y + 1 < height && s.fog.isExplored(x, y + 1) && elev.band(x + 0.5, y + 1.5, CONTOUR_INTERVAL_M) !== b) {
            g.lineBetween(mx + x * cell, my + (y + 1) * cell, mx + (x + 1) * cell, my + (y + 1) * cell);
          }
        }
      }
      // จุดระดับความสูง (▲ + ค่าความสูงที่คำนวณจากแบบจำลอง)
      for (const p of s.level.spotHeights ?? []) {
        if (!s.fog.isExplored(p.x, p.y)) continue;
        const px = mx + (p.x + 0.5) * cell;
        const py = my + (p.y + 0.5) * cell;
        g.fillStyle(0x10141f, 1).fillTriangle(px - 4, py + 3, px + 4, py + 3, px, py - 4);
        this.labels.add(
          scene.add
            .text(px + 5, py - 2, `${elev.meters(p)}`, { ...textStyle(this.labelSize(11), '#fff6d5'), stroke: '#10141f', strokeThickness: 3 })
            .setOrigin(0, 0.5),
        );
      }
    }

    for (const lm of s.level.landmarks) {
      if (!s.isLandmarkVisible(lm)) continue;
      const lx = mx + (lm.at.x + 0.5) * cell;
      const ly = my + (lm.at.y + 0.5) * cell;
      if (lm.symbol) {
        g.fillStyle(0xf4efe1, 0.9).fillCircle(lx, ly, 8);
        drawMapSymbol(g, lm.symbol, lx, ly);
        if (!legend.includes(lm.symbol)) legend.push(lm.symbol);
      } else {
        g.fillStyle(0xffd84d, 1).fillCircle(lx, ly, 4);
      }
      const side = lm.mapLabelAt ?? 'above';
      const [tx, ty, ox, oy] =
        side === 'left' ? [lx - 10, ly, 1, 0.5] : side === 'right' ? [lx + 10, ly, 0, 0.5] : side === 'below' ? [lx, ly + 8, 0.5, 0] : [lx, ly - 6, 0.5, 1];
      this.labels.add(
        scene.add
          .text(tx, ty, lm.name, { ...textStyle(this.labelSize(12), '#ffffff'), stroke: '#10141f', strokeThickness: 3 })
          .setOrigin(ox, oy),
      );
    }
    if (s.pinnedAt) {
      g.fillStyle(0xff4dd2, 1).fillCircle(mx + (s.pinnedAt.x + 0.5) * cell, my + (s.pinnedAt.y + 0.5) * cell, 5);
    }
    this.drawLegend(legend);
  }

  /** คำอธิบายสัญลักษณ์ (เฉพาะสัญลักษณ์ที่ปรากฏบนแผ่นนี้) */
  private drawLegend(input: Array<MapSymbol | 'contour' | 'spot' | 'flow'>): void {
    this.legendG.clear();
    this.legendLabels.removeAll(true);
    if (this.zp) {
      // จอสัมผัส: แผงคำอธิบาย DOM ตัวอักษรใหญ่ (เปิดจากปุ่ม "สัญลักษณ์") ใช้ไอคอนที่วาดด้วยโค้ดเดียวกับแผนที่
      setTouchView({ legendItems: legendEntries(this.root.scene, ['you', 'dot', 'pinned', ...input]) });
      return;
    }
    if (input.length === 0) return;
    const scene = this.root.scene;
    const g = this.legendG;
    const { x: mx, y: my, cell } = this.geom;
    const x = mx + this.s.grid.width * cell + 10;
    let y = my + 78;
    this.legendLabels.add(scene.add.text(x, y, 'สัญลักษณ์', textStyle(13, COLORS.accent)));
    y += 24;
    for (const item of input) {
      drawLegendIcon(g, item, x + 9, y + 9, x);
      this.legendLabels.add(scene.add.text(x + 22, y, legendLabel(item), textStyle(11, COLORS.text)));
      y += 21;
    }
  }

  /** แผนที่ฐาน (กระดาษ) — แสดงทั้งแผ่น ไม่ขึ้นกับหมอก และไม่มีเส้นชั้นความสูง */
  private drawSheet(sheetId: string): void {
    const s = this.s;
    const sheet = s.level.baseMaps!.find((m) => m.id === sheetId)!;
    const { x, y, cell } = this.geom;
    this.title.setText(sheet.title);
    this.graphics.clear();
    this.labels.removeAll(true);
    const legend = drawBaseSheet(
      this.root.scene,
      this.graphics,
      this.labels,
      sheet,
      { x, y, cell, width: s.grid.width, height: s.grid.height },
      { labelSize: this.labelSize(12) },
    );
    this.drawLegend(sheet.flowArrows?.length ? [...legend, 'flow'] : legend);
  }

  updatePlayer(): void {
    const { x: mx, y: my, cell } = this.geom;
    const t = this.s.playerTile;
    this.playerDot.setPosition(mx + (t.x + 0.5) * cell, my + (t.y + 0.5) * cell);
  }
}
