import {
  CLUE_TYPE_LABEL,
  QUEST_KIND_LABEL,
  type GameSession,
  type NotebookTab,
  type QuestStatus,
} from '../../core/session/GameSession';
import { dirName, fmtMeters10 } from '../format';
import { explainSettlementPart } from '../../core/site/SettlementAnalysis';
import { GridSystem } from '../../core/world/GridSystem';
import { hasMicroSteps, microStates, phaseProgress } from '../../core/guide/MicroQuest';
import { guideText } from '../../core/guide/GuideText';
import { guideActionOf } from '../../core/guide/QuestGuide';
import { guideTarget } from '../../core/guide/Navigation';
import type { ClueType } from '../../content/types';

/** ไอคอนประเภทหลักฐาน (ใช้ทั้งสมุดและแถบภารกิจ) */
export const CLUE_ICON: Record<ClueType, string> = {
  direction: '🧭',
  distance: '📏',
  landmark: '📍',
  elevation: '⛰️',
  symbol: '🗺️',
  comparison: '⚖️',
  coordinate: '🔢',
};

/**
 * เนื้อหาสมุดภาคสนาม (ข้อมูลล้วน ไม่ผูกกับ Phaser) — ใช้ร่วมกันระหว่าง
 *   - NotebookOverlay (canvas, คอมพิวเตอร์)
 *   - หน้าอ่านตัวอักษรใหญ่บนจอสัมผัส (TouchLayer)
 * ข้อความจึงมาจากแหล่งเดียว ไม่เขียนซ้ำ
 */
export const NOTEBOOK_TAB_LABEL: Record<NotebookTab, string> = {
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

/** หนึ่งบรรทัดในสมุด — size/indent/gap เป็นหน่วยของ canvas (960×640); หน้าจอสัมผัสใช้ role เลือกขนาดตัวอักษรเอง */
export interface NoteLine {
  text: string;
  size: number;
  color: string;
  indent: number;
  gap: number;
  role: 'heading' | 'body' | 'note';
}

export interface NotebookView {
  tab: NotebookTab;
  lines: NoteLine[];
  /** เว้นบรรทัดเพิ่ม (หน่วย canvas) ก่อนบรรทัดที่ index นี้ */
  spacers: Record<number, number>;
  footer: { text: string; color: string };
}

const roleOf = (size: number): NoteLine['role'] => (size >= 16 ? 'heading' : size >= 14 ? 'body' : 'note');

export function buildNotebookView(s: GameSession, opts: { touch?: boolean } = {}): NotebookView {
  const lines: NoteLine[] = [];
  const spacers: Record<number, number> = {};
  const footer = { text: '', color: '#5a3a1e' };
  const line = (text: string, size = 15, color = '#2b2118', indent = 0, gap = 4) =>
    lines.push({ text, size, color, indent, gap, role: roleOf(size) });
  const space = (px: number) => (spacers[lines.length] = (spacers[lines.length] ?? 0) + px);

  if (s.notebookTab === 'quests') {
    for (const q of s.quests()) {
      const locked = q.status === 'locked';
      const title = locked && q.def.kind === 'mystery' ? '???' : q.def.title;
      line(`[${QUEST_KIND_LABEL[q.def.kind]}]  ${title}  —  ${STATUS_LABEL[q.status]}`, 16, STATUS_COLOR[q.status], 0, 2);
      if (locked) {
        line(`ปลดล็อก: ${q.def.lockedHint}`, 13, '#8a7a64', 22, 8);
        continue;
      }
      if (q.def.kind === 'main' && hasMicroSteps(s)) {
        // บทที่มีขั้นย่อย: แยกตามช่วงภารกิจ · ขั้นที่ทำแล้ว ✓ · ขั้นที่กำลังทำ ▶ พร้อมวิธีทำ เครื่องมือ และผลเมื่อสำเร็จ
        const ms = microStates(s);
        const prog = phaseProgress(ms);
        const gt = (t: string, label?: string) => guideText(s.resolveText(t), { touch: !!opts.touch, guideLabel: label });
        const phases = s.level.guidePhases ?? [{ id: '', title: '' }];
        for (const ph of phases) {
          const inPhase = ms.filter((m) => m.phase === ph.id);
          if (inPhase.length === 0) continue;
          const total = Math.max(...inPhase.map((m) => m.num));
          const done = new Set(inPhase.filter((m) => inPhase.filter((x) => x.num === m.num).every((x) => x.done)).map((m) => m.num)).size;
          line(`${ph.title ? `${ph.title} — ` : ''}ทำแล้ว ${done}/${total} ขั้น`, 14, '#5a3a1e', 22, 2);
          for (const m of inPhase) {
            const no = m.parts > 1 ? `${m.num}.${m.part}` : `${m.num}`;
            if (m.done) line(`✓ ${no}. ${m.step.goal}`, 14, '#1f6b2a', 30, 1);
            else if (m.current) {
              const action = guideActionOf(m.step, guideTarget(s));
              line(`▶ ${no}. ตอนนี้: ${m.step.goal}`, 15, '#7a2e1e', 30, 1);
              line(`วิธีทำ: ${m.step.steps.map((x, i) => `(${i + 1}) ${gt(x, action?.label)}`).join(' ')}`, 14, '#2b2118', 48, 1);
              line(`เครื่องมือ: ${m.step.tools.join(' · ')}`, 14, '#5a3a1e', 48, 1);
              line(`เมื่อสำเร็จ: ${gt(m.step.result, action?.label)}`, 13, '#5a4a38', 48, 1);
            } else line(`○ ${no}. ${m.step.goal}`, 14, '#8a7a64', 30, 1);
          }
          space(4);
        }
        if (prog.total === 0) line('ยังไม่มีขั้นภารกิจ', 14, '#7a6448', 22, 2);
        space(8);
        continue;
      }
      if (q.def.kind === 'main') {
        // ภารกิจหลักแสดงเฉพาะเป้าหมายถัดไป เพื่อให้หน้ากระชับ
        const next = q.def.objectives.findIndex((_, i) => !q.objectivesDone[i]);
        const done = q.objectivesDone.filter(Boolean).length;
        line(
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
      if (q.status === 'active') line(q.def.description, 13, '#5a4a38', 22, 2);
      q.def.objectives.forEach((o, i) => line(`${q.objectivesDone[i] ? '●' : '○'} ${o.text}`, 14, '#2b2118', 22, 1));
      if (q.status === 'completed' && q.def.reward) line(`รางวัล: ${q.def.reward.text}`, 13, '#1f6b2a', 22, 0);
      space(8);
    }
    const c = s.questCounts();
    footer.text = `สำเร็จแล้ว — หลัก ${c.main.done}/${c.main.total} · รอง ${c.side.done}/${c.side.total} · ปริศนา ${c.mystery.done}/${c.mystery.total}`;
  } else if (s.notebookTab === 'clues') {
    const status = s.requiredClueStatus();
    if (status.length > 0) {
      const byType = (['direction', 'distance', 'landmark'] as const).map((type) => {
        const ok = status.some((x) => x.clue.type === type && x.collected);
        return `${CLUE_TYPE_LABEL[type]}: ${ok ? 'มีแล้ว ●' : 'ยังไม่มี ○'}`;
      });
      line(`เบาะแสที่ต้องใช้วิเคราะห์เส้นทาง —  ${byType.join('   ·   ')}`, 15, '#5a3a1e', 0, 10);
    }
    if (s.clues.length === 0) line('ยังไม่มีเบาะแส — ลองคุยกับตัวละครที่มีเครื่องหมาย ! เหนือหัว', 15, '#7a6448');
    else line('จดให้อัตโนมัติ เรียงตามลำดับที่ได้รับ (ล่าสุดอยู่ล่างสุด) · ★ = เพิ่งได้', 13, '#7a6448', 0, 6);
    s.clues.forEach((id, i) => {
      const c = s.getClue(id);
      if (!c) return;
      const fresh = s.newClues.includes(id);
      line(`${i + 1}. ${CLUE_ICON[c.type]} ${CLUE_TYPE_LABEL[c.type]} — จาก${c.source}${fresh ? '   ★ ใหม่' : ''}`, 15, fresh ? '#a2541e' : '#5a3a1e', 0, 1);
      line(s.resolveText(c.text), 15, '#2b2118', 26, 8);
    });
    footer.text = `เบาะแสที่ค้นพบ ${s.clues.length}/${s.level.clues?.length ?? 0}`;
  } else if (s.notebookTab === 'routes') {
    buildRoutes(s, line, footer);
  } else {
    footer.text = opts.touch
      ? 'ความคืบหน้าบันทึกอัตโนมัติ · เริ่มเกมใหม่ได้จากเมนูหลัก'
      : 'กด Delete 2 ครั้ง เพื่อเริ่มด่านนี้ใหม่ (ความคืบหน้าบันทึกอัตโนมัติ)';
    footer.color = '#8a7a64';
    // สถิติการสำรวจ (ย้ายมาจากแถบบนจอ เพื่อให้หน้าจอระหว่างเดินไม่รก)
    line('สถิติการสำรวจ', 17, '#5a3a1e', 0, 4);
    line(
      `ระยะเดินสะสมทั้งบท ${fmtMeters10(s.odometer.totalMeters)} · สำรวจแล้ว ${Math.round(s.fog.exploredRatio * 100)}% ของพื้นที่ · ` +
        `เบาะแส ${s.clues.length}/${s.level.clues?.length ?? 0} · เวลา ${Math.floor(s.elapsedMs / 60_000)} นาที`,
      14,
      '#2b2118',
      20,
      8,
    );
    // ผลวิเคราะห์พื้นที่ตั้งถิ่นฐาน (บทที่ 3): ประวัติทุกครั้ง + รายละเอียดครั้งล่าสุด
    const sa = s.level.settlementAnalysis;
    if (sa && s.settlementAttempts.length > 0) {
      line(`ผลวิเคราะห์พื้นที่ (คะแนนเต็ม 100 · ผ่านเมื่อมากกว่า ${sa.passPercent}%)`, 17, '#5a3a1e', 0, 4);
      const where = (a: { x: number; y: number }) => (s.coords ? GridSystem.format(s.coords.tileToGrid(a)) : `ช่อง ${a.x},${a.y}`);
      s.settlementAttempts.forEach((a, i) =>
        line(
          `ครั้งที่ ${i + 1} · วงที่ ${where(a)}: ${a.percent}% ${a.passed ? 'ผ่าน ✓' : `ไม่ผ่าน ✗ — ต้องทบทวน: ${a.weak.map((t) => sa.topics[t].label).join(' · ') || '-'}`}`,
          14,
          a.passed ? '#1f6b2a' : '#7a2e1e',
          20,
          2,
        ),
      );
      const rep = s.latestSettlementReport();
      if (rep) {
        space(2);
        line('รายละเอียดครั้งล่าสุด (คำนวณจากแผนที่)', 15, '#5a3a1e', 20, 2);
        for (const p of rep.parts) line(`• ${sa.topics[p.id].label} ${p.score}/${p.max} — ${explainSettlementPart(rep, sa, p.id)}`, 14, p.weak ? '#7a2e1e' : '#2b2118', 30, 2);
        line('คะแนนนี้คือความเหมาะสมตามเกณฑ์จำลอง ไม่ใช่ความน่าจะเป็นที่จะพบเมืองโบราณจริง', 13, '#7a6448', 20, 8);
      }
    }
    line('หลักฐานการสำรวจ', 17, '#5a3a1e', 0, 4);
    if (s.evidence.length === 0) line('ยังไม่มี', 14, '#7a6448', 20, 8);
    for (const id of s.evidence) {
      const ev = s.level.evidence?.find((e) => e.id === id);
      if (ev) line(`• ${ev.name} — ${ev.description}`, 14, '#2b2118', 20, 6);
    }
    if (s.pinnedAt) line(`• หมุดตำแหน่งที่บันทึก: ช่อง X ${s.pinnedAt.x}, Y ${s.pinnedAt.y}`, 14, '#2b2118', 20, 6);
    space(6);
    line('ข้อความจากครู', 17, '#5a3a1e', 0, 4);
    if (s.messages.length === 0) line('ยังไม่มีข้อความ', 14, '#7a6448', 20, 8);
    for (const m of s.messages) line(`${m.speaker}: ${m.text}`, 14, '#2b2118', 20, 6);
    const ending = s.level.ending;
    if (s.completed && ending) {
      space(6);
      line('รางวัล', 17, '#5a3a1e', 0, 4);
      line(
        ending.codePiece
          ? `• รหัสลับชิ้นที่ ${ending.codePiece.index}/${ending.codePiece.total}: "${ending.codePiece.value}"   • ${ending.rewardItem}`
          : `• ${ending.rewardItem}`,
        15,
        '#1f6b2a',
        20,
      );
    }
  }
  return { tab: s.notebookTab, lines, spacers, footer };
}

function buildRoutes(
  s: GameSession,
  line: (text: string, size?: number, color?: string, indent?: number, gap?: number) => void,
  footer: { text: string; color: string },
): void {
  const ra = s.level.routeAnalysis;
  if (!ra) {
    line('ด่านนี้ไม่มีการวิเคราะห์เส้นทาง');
    return;
  }
  const origin = s.level.landmarks.find((l) => l.id === ra.originId)?.name ?? ra.originId;
  // ข้อมูลที่ใช้เทียบ: เบาะแสที่ผู้เล่นได้รับจริง (ทิศ · ระยะ · จุดสังเกต) — วางไว้บนสุดของกระดาน ไม่ต้องสลับหน้าไปมา
  line('ข้อมูลที่ใช้เปรียบเทียบ (จากเบาะแสที่ได้รับ)', 16, '#5a3a1e', 0, 2);
  for (const { clue, collected } of s.requiredClueStatus()) {
    line(
      collected
        ? `${CLUE_ICON[clue.type]} ${CLUE_TYPE_LABEL[clue.type]} (${clue.source}): ${s.resolveText(clue.text)}`
        : `${CLUE_ICON[clue.type]} ${CLUE_TYPE_LABEL[clue.type]}: ยังไม่มี — ฟังจาก${clue.source}ก่อน`,
      14,
      collected ? '#2b2118' : '#8a7a64',
      14,
      2,
    );
  }
  for (const id of s.clues) {
    const c = s.getClue(id);
    if (c && !ra.requiredClueIds.includes(id) && c.type === 'landmark') line(`${CLUE_ICON[c.type]} ${CLUE_TYPE_LABEL[c.type]} (${c.source}): ${s.resolveText(c.text)}`, 14, '#2b2118', 14, 2);
  }
  line(`ต้นทาง: ${origin} — ตัวเลขของแต่ละเส้นทางคำนวณจากแผนที่ (ระยะปัดเป็นหลักสิบเมตร) จะบันทึกเมื่อสำรวจถึงปลายทางแล้ว`, 14, '#7a6448', 0, 10);
  s.routeRows().forEach((row, i) => {
    const chosen = s.routeSolved && row.def.id === ra.correctRouteId;
    line(
      `${i + 1}) เส้นทาง ${row.def.label}${chosen ? '  (เลือกแล้ว — สอดคล้องกับหลักฐาน)' : ''}: ${row.def.description}`,
      16,
      chosen ? '#1f6b2a' : '#2b2118',
      0,
      2,
    );
    if (!row.explored) {
      line('ยังไม่ได้สำรวจถึงปลายทาง — เดินตามเส้นทางนี้ไปให้ถึงก่อน', 14, '#7a6448', 26, 10);
      return;
    }
    const m = row.metrics;
    const dest = s.level.landmarks.find((l) => l.id === row.def.to)?.name ?? row.def.to;
    const seen = row.seenLandmarks.map((id) => s.level.landmarks.find((l) => l.id === id)?.name ?? id).join(', ');
    line(
      `ปลายทาง: ${dest} · อยู่${dirName(m.direction)}ของ${origin} · ระยะเส้นตรง ${fmtMeters10(m.straightMeters)} · ระยะตามถนน ${fmtMeters10(m.roadMeters)}`,
      14,
      '#2b2118',
      26,
      2,
    );
    line(`จุดสังเกตระหว่างทางที่พบ: ${seen || 'ไม่พบ'}`, 14, '#2b2118', 26, 10);
  });
  if (s.routeSolved) {
    footer.text = 'วิเคราะห์เส้นทางสำเร็จ — เดินทางไปสำรวจปลายทางได้เลย';
    footer.color = '#1f6b2a';
  } else if (s.canChooseRoute()) {
    footer.text = s.routeFeedback ?? 'กด 1, 2 หรือ 3 เพื่อเลือกเส้นทางที่สอดคล้องกับเบาะแสทั้ง 3 ประเภท';
    footer.color = s.routeFeedback ? '#a23b1e' : '#5a3a1e';
  } else {
    footer.text = 'ต้องมีเบาะแสครบ 3 ประเภท (ทิศทาง ระยะทาง จุดสังเกต) ก่อนจึงจะเลือกเส้นทางได้';
    footer.color = '#7a6448';
  }
}
