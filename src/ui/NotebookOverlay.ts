import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import {
  CLUE_TYPE_LABEL,
  QUEST_KIND_LABEL,
  type GameSession,
  type NotebookTab,
  type QuestStatus,
} from '../core/session/GameSession';
import { dirName, fmtMeters10 } from './format';
import { wrapThaiText } from './textWrap';
import { FONT_FAMILY, textStyle } from './theme';

const TAB_LABEL: Record<NotebookTab, string> = {
  quests: 'ภารกิจ',
  clues: 'เบาะแส',
  routes: 'วิเคราะห์เส้นทาง',
  records: 'หลักฐาน/ข้อความ',
};

const STATUS_LABEL: Record<QuestStatus, string> = {
  locked: 'ล็อก',
  active: 'กำลังทำ',
  completed: 'สำเร็จ',
};
const STATUS_COLOR: Record<QuestStatus, string> = {
  locked: '#8a7a64',
  active: '#7a2e1e',
  completed: '#1f6b2a',
};

const PX = 50;
const PY = 30;
const PW = GAME_WIDTH - PX * 2;
const PH = GAME_HEIGHT - PY * 2;
const INNER_X = PX + 28;
const INNER_W = PW - 56;
const BODY_TOP = PY + 96;
const BODY_BOTTOM = PY + PH - 40;

/** สมุดภาคสนาม: เก็บเบาะแส วิเคราะห์เส้นทาง หลักฐาน และข้อความจากครู (กด N) */
export class NotebookOverlay {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly tabTexts: Phaser.GameObjects.Text[];
  private readonly footer: Phaser.GameObjects.Text;
  private y = BODY_TOP;

  /**
   * @param tabs หน้าในสมุดของด่านนี้ (ด่านที่ไม่มีการวิเคราะห์เส้นทางจะไม่มีหน้านั้น)
   * @param tambon ชื่อตำบล — สมุดแยกเบาะแสตามด่าน (เบาะแสมาจาก session ของด่านนี้เท่านั้น)
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tabs: readonly NotebookTab[],
    tambon: string,
  ) {
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d, 0.8).setOrigin(0);
    const paper = scene.add.graphics();
    paper.fillStyle(0xf3ead2, 1).fillRoundedRect(PX, PY, PW, PH, 12);
    paper.lineStyle(4, 0x8a6d3b, 1).strokeRoundedRect(PX, PY, PW, PH, 12);
    paper.lineStyle(1, 0xd8c9a3, 1);
    for (let ly = BODY_TOP + 24; ly < BODY_BOTTOM; ly += 26) paper.lineBetween(PX + 16, ly, PX + PW - 16, ly);
    const title = scene.add.text(PX + 28, PY + 14, 'สมุดภาคสนาม', textStyle(24, '#5a3a1e'));
    const sub = scene.add.text(PX + 30, PY + 50, tambon, textStyle(13, '#7a6448'));
    this.tabTexts = tabs.map((tab, i) =>
      scene.add.text(PX + 200 + i * 160, PY + 20, TAB_LABEL[tab], {
        ...textStyle(16, '#5a3a1e'),
        padding: { x: 10, y: 4, top: 6 },
      }),
    );
    const tabHint = scene.add
      .text(PX + PW - 20, PY + 64, '◀ ▶ หรือ A / D เปลี่ยนหน้า · N หรือ Esc ปิด', textStyle(13, '#7a6448'))
      .setOrigin(1, 0);
    this.body = scene.add.container(0, 0);
    this.footer = scene.add.text(INNER_X, BODY_BOTTOM + 6, '', textStyle(15, '#7a2e1e'));
    this.root = scene.add
      .container(0, 0, [dim, paper, title, sub, ...this.tabTexts, tabHint, this.body, this.footer])
      .setDepth(25)
      .setVisible(false);
  }

  render(s: GameSession): void {
    if (s.mode !== 'notebook') {
      this.root.setVisible(false);
      return;
    }
    this.root.setVisible(true);
    this.tabs.forEach((tab, i) => {
      const active = tab === s.notebookTab;
      this.tabTexts[i]
        .setColor(active ? '#fff6d5' : '#5a3a1e')
        .setBackgroundColor(active ? '#8a6d3b' : 'rgba(0,0,0,0)');
    });
    this.body.removeAll(true);
    this.footer.setText('');
    this.y = BODY_TOP;
    if (s.notebookTab === 'quests') this.renderQuests(s);
    else if (s.notebookTab === 'clues') this.renderClues(s);
    else if (s.notebookTab === 'routes') this.renderRoutes(s);
    else this.renderRecords(s);
  }

  private line(text: string, size = 15, color = '#2b2118', indent = 0, gap = 4): void {
    if (this.y > BODY_BOTTOM - 10) return;
    const t = this.scene.add.text(
      INNER_X + indent,
      this.y,
      wrapThaiText(text, INNER_W - indent, `${size}px ${FONT_FAMILY}`),
      { ...textStyle(size, color), lineSpacing: 2 },
    );
    this.body.add(t);
    this.y += t.height + gap;
  }

  private renderQuests(s: GameSession): void {
    for (const q of s.quests()) {
      const locked = q.status === 'locked';
      const title = locked && q.def.kind === 'mystery' ? '???' : q.def.title;
      this.line(
        `[${QUEST_KIND_LABEL[q.def.kind]}]  ${title}  —  ${STATUS_LABEL[q.status]}`,
        16,
        STATUS_COLOR[q.status],
        0,
        2,
      );
      if (locked) {
        this.line(`ปลดล็อก: ${q.def.lockedHint}`, 13, '#8a7a64', 22, 8);
        continue;
      }
      if (q.def.kind === 'main') {
        // ภารกิจหลักแสดงเฉพาะเป้าหมายถัดไป เพื่อให้หน้ากระชับ
        const next = q.def.objectives.findIndex((_, i) => !q.objectivesDone[i]);
        const done = q.objectivesDone.filter(Boolean).length;
        this.line(
          next < 0
            ? `ครบ ${done}/${q.def.objectives.length} เป้าหมาย`
            : `ความคืบหน้า ${done}/${q.def.objectives.length} — ถัดไป: ${q.def.objectives[next].text}`,
          14,
          '#2b2118',
          22,
          8,
        );
        continue;
      }
      if (q.status === 'active') this.line(q.def.description, 13, '#5a4a38', 22, 2);
      q.def.objectives.forEach((o, i) => {
        this.line(`${q.objectivesDone[i] ? '●' : '○'} ${o.text}`, 14, '#2b2118', 22, 1);
      });
      if (q.status === 'completed' && q.def.reward) this.line(`รางวัล: ${q.def.reward.text}`, 13, '#1f6b2a', 22, 0);
      this.y += 8;
    }
    const c = s.questCounts();
    this.footer
      .setText(
        `สำเร็จแล้ว — หลัก ${c.main.done}/${c.main.total} · รอง ${c.side.done}/${c.side.total} · ปริศนา ${c.mystery.done}/${c.mystery.total}`,
      )
      .setColor('#5a3a1e');
  }

  private renderClues(s: GameSession): void {
    const status = s.requiredClueStatus();
    if (status.length > 0) {
      const byType = (['direction', 'distance', 'landmark'] as const).map((type) => {
        const ok = status.some((x) => x.clue.type === type && x.collected);
        return `${CLUE_TYPE_LABEL[type]}: ${ok ? 'มีแล้ว ●' : 'ยังไม่มี ○'}`;
      });
      this.line(`เบาะแสที่ต้องใช้วิเคราะห์เส้นทาง —  ${byType.join('   ·   ')}`, 15, '#5a3a1e', 0, 10);
    }
    if (s.clues.length === 0) {
      this.line('ยังไม่มีเบาะแส — ลองคุยกับตัวละครที่มีเครื่องหมาย ! เหนือหัว', 15, '#7a6448');
    }
    for (const id of s.clues) {
      const c = s.getClue(id);
      if (!c) continue;
      this.line(`[${CLUE_TYPE_LABEL[c.type]}]  ${c.source}: ${s.resolveText(c.text)}`, 15, '#2b2118', 0, 8);
    }
    this.footer.setText(`เบาะแสที่ค้นพบ ${s.clues.length}/${s.level.clues?.length ?? 0}`).setColor('#5a3a1e');
  }

  private renderRoutes(s: GameSession): void {
    const ra = s.level.routeAnalysis;
    if (!ra) {
      this.line('ด่านนี้ไม่มีการวิเคราะห์เส้นทาง');
      return;
    }
    const origin = s.level.landmarks.find((l) => l.id === ra.originId)?.name ?? ra.originId;
    this.line(
      `ต้นทาง: ${origin} — ข้อมูลด้านล่างคำนวณจากแผนที่ (ระยะปัดเป็นหลักสิบเมตร) จะบันทึกเมื่อสำรวจถึงปลายทางแล้ว`,
      14,
      '#7a6448',
      0,
      10,
    );
    s.routeRows().forEach((row, i) => {
      const chosen = s.routeSolved && row.def.id === ra.correctRouteId;
      this.line(
        `${i + 1}) เส้นทาง ${row.def.label}${chosen ? '  (เลือกแล้ว — สอดคล้องกับหลักฐาน)' : ''}: ${row.def.description}`,
        16,
        chosen ? '#1f6b2a' : '#2b2118',
        0,
        2,
      );
      if (!row.explored) {
        this.line('ยังไม่ได้สำรวจถึงปลายทาง — เดินตามเส้นทางนี้ไปให้ถึงก่อน', 14, '#7a6448', 26, 10);
        return;
      }
      const m = row.metrics;
      const dest = s.level.landmarks.find((l) => l.id === row.def.to)?.name ?? row.def.to;
      const seen = row.seenLandmarks
        .map((id) => s.level.landmarks.find((l) => l.id === id)?.name ?? id)
        .join(', ');
      this.line(
        `ปลายทาง: ${dest} · อยู่${dirName(m.direction)}ของ${origin} · ระยะเส้นตรง ${fmtMeters10(m.straightMeters)} · ระยะตามถนน ${fmtMeters10(m.roadMeters)}`,
        14,
        '#2b2118',
        26,
        2,
      );
      this.line(`จุดสังเกตระหว่างทางที่พบ: ${seen || 'ไม่พบ'}`, 14, '#2b2118', 26, 10);
    });

    if (s.routeSolved) {
      this.footer.setText('วิเคราะห์เส้นทางสำเร็จ — เดินทางไปสำรวจปลายทางได้เลย').setColor('#1f6b2a');
    } else if (s.canChooseRoute()) {
      this.footer
        .setText(s.routeFeedback ?? 'กด 1, 2 หรือ 3 เพื่อเลือกเส้นทางที่สอดคล้องกับเบาะแสทั้ง 3 ประเภท')
        .setColor(s.routeFeedback ? '#a23b1e' : '#5a3a1e');
    } else {
      this.footer
        .setText('ต้องมีเบาะแสครบ 3 ประเภท (ทิศทาง ระยะทาง จุดสังเกต) ก่อนจึงจะเลือกเส้นทางได้')
        .setColor('#7a6448');
    }
  }

  private renderRecords(s: GameSession): void {
    this.footer.setText('กด Delete 2 ครั้ง เพื่อเริ่มด่านนี้ใหม่ (ความคืบหน้าบันทึกอัตโนมัติ)').setColor('#8a7a64');
    this.line('หลักฐานการสำรวจ', 17, '#5a3a1e', 0, 4);
    if (s.evidence.length === 0) this.line('ยังไม่มี', 14, '#7a6448', 20, 8);
    for (const id of s.evidence) {
      const ev = s.level.evidence?.find((e) => e.id === id);
      if (ev) this.line(`• ${ev.name} — ${ev.description}`, 14, '#2b2118', 20, 6);
    }
    if (s.pinnedAt) {
      this.line(`• หมุดตำแหน่งที่บันทึก: ช่อง X ${s.pinnedAt.x}, Y ${s.pinnedAt.y}`, 14, '#2b2118', 20, 6);
    }
    this.y += 6;
    this.line('ข้อความจากครู', 17, '#5a3a1e', 0, 4);
    if (s.messages.length === 0) this.line('ยังไม่มีข้อความ', 14, '#7a6448', 20, 8);
    for (const m of s.messages) this.line(`${m.speaker}: ${m.text}`, 14, '#2b2118', 20, 6);
    const ending = s.level.ending;
    if (s.completed && ending) {
      this.y += 6;
      this.line('รางวัล', 17, '#5a3a1e', 0, 4);
      this.line(
        ending.codePiece
          ? `• รหัสลับชิ้นที่ ${ending.codePiece.index}/${ending.codePiece.total}: "${ending.codePiece.value}"   • ${ending.rewardItem}`
          : `• ${ending.rewardItem}`,
        15,
        '#1f6b2a',
        20,
      );
    }
  }
}
