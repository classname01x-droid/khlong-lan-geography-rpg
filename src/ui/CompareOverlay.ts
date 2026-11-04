import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { SHEET_CHECKS } from '../core/map/BaseMapCheck';
import type { GameSession } from '../core/session/GameSession';
import { describeSheetProblem, SHEET_CHECK_LABEL } from './format';
import { drawBaseSheet } from './sheetRenderer';
import { wrapThaiText } from './textWrap';
import { COLORS, FONT_FAMILY, textStyle } from './theme';

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

  constructor(private readonly scene: Phaser.Scene) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.93).setOrigin(0);
    const title = scene.add
      .text(GAME_WIDTH / 2, 10, 'เปรียบเทียบแผนที่ฐาน — ฉบับใดตรงกับหลักฐานจริง?', textStyle(20, COLORS.accent))
      .setOrigin(0.5, 0);
    this.g = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.body = scene.add.text(40, 0, '', { ...textStyle(14), lineSpacing: 3 });
    this.root = scene.add.container(0, 0, [dim, title, this.g, this.labels, this.body]).setDepth(22).setVisible(false);
  }

  render(s: GameSession): void {
    if (s.mode !== 'compare') {
      this.root.setVisible(false);
      return;
    }
    this.root.setVisible(true);
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

    const lines: string[] = [];
    const mc = s.level.mapComparison;
    const missing = s.comparisonMissing();
    const name = (id: string) => s.level.landmarks.find((l) => l.id === id)?.name ?? id;
    if (mc) {
      const elevOk = mc.requiredClueIds.every((id) => s.clues.includes(id));
      const obs = mc.requiredObservations.map((id) => `${name(id)} ${s.discoveredLandmarks.has(id) ? '●' : '○'}`).join('  ');
      lines.push(
        `หลักฐานที่มี — ${SHEET_CHECK_LABEL.symbol}: ดูคำอธิบายบนแผนที่ (M) ●   ${SHEET_CHECK_LABEL.flow}: ${elevOk ? 'มีข้อมูลแล้ว ●' : 'ยังไม่มี ○'}`,
        `${SHEET_CHECK_LABEL.landmark}: ${obs}`,
      );
    }
    if (s.comparisonSolved && !s.lastCompare) {
      lines.push(`วิเคราะห์แล้ว: แผนที่ฐานฉบับ ${s.verifiedSheetId()} ตรงกับหลักฐานทุกข้อ · Esc หรือ C ปิด`);
    } else if (!s.isComparisonOpen()) {
      lines.push('ดูเปรียบเทียบได้ตลอด แต่จะตัดสินคำตอบได้ในฉาก 4 (หลังได้ข้อมูลระดับความสูงจากผู้ดูแลแหล่งน้ำ) · Esc ปิด');
    } else {
      lines.push('แผนที่ฉบับใดถูกต้องตามหลักฐานทั้ง 3 ชนิด?   กด 1 หรือ 2 เพื่อเลือก · Esc หรือ C ปิด');
    }

    const r = s.lastCompare;
    if (r) {
      lines.push('');
      if (r.blocked === 'missing-evidence') {
        const parts: string[] = [];
        if (missing.observations.length) parts.push(`ต้องเดินไปดู ${missing.observations.map(name).join(' และ ')} ด้วยตัวเองก่อน`);
        if (missing.clues.length) parts.push('ต้องได้ข้อมูลระดับความสูงจากผู้ดูแลแหล่งน้ำก่อน');
        lines.push(`ยังตัดสินไม่ได้ — ${parts.join(' · ')}`);
      } else if (!r.blocked || r.blocked === 'already-solved') {
        const chosenTitle = s.level.baseMaps?.find((m) => m.id === r.chosenId)?.title ?? '';
        lines.push(r.ok ? `ถูกต้อง! ${chosenTitle} ผ่านหลักฐานทั้ง 3 ชนิด` : `ยังไม่ถูก — ${chosenTitle} ขัดกับหลักฐาน ลองดูอีกครั้ง`);
        for (const [id, rep] of Object.entries(r.reports)) {
          const marks = SHEET_CHECKS.map((c) => `${SHEET_CHECK_LABEL[c]} ${rep.failed.includes(c) ? '✗' : '✓'}`).join(' · ');
          lines.push(`ฉบับ ${id}: ${marks}`);
          // อธิบายรายละเอียดของฉบับที่เลือก (ถ้าผิด) หรือฉบับที่ผิด (ถ้าเลือกถูก)
          if ((r.ok && rep.failed.length) || (!r.ok && id === r.chosenId)) {
            const texts = [...new Set(rep.problems.map(describeSheetProblem))];
            for (const t of texts.slice(0, 4)) lines.push(`   • ${t}`);
          }
        }
      }
    }
    this.body
      .setText(wrapThaiText(lines.join('\n'), GAME_WIDTH - 80, `14px ${FONT_FAMILY}`))
      .setPosition(40, PANEL_Y + h + 12);
  }
}
