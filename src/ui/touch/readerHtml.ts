import type { GridBoardView } from '../../core/site/gridBoard';
import type { NotebookTab } from '../../core/session/GameSession';
import type { NotebookView } from '../views/notebookView';
import type { SummaryView } from '../views/summaryView';

/**
 * HTML ของ "หน้าอ่านตัวอักษรใหญ่" บนจอสัมผัส (สมุด กระดานวิเคราะห์ หลักฐานเปรียบเทียบแผนที่ หน้าสรุป)
 * ฟังก์ชันล้วน (ไม่แตะ DOM) — ข้อความทั้งหมดมาจาก view เดียวกับที่ canvas ใช้ และผ่าน wording (ปุ่มคีย์บอร์ด → ปุ่มสัมผัส)
 * ไม่ย่อทั้งหน้าต่าง: ใช้แท็บแบ่งหน้า และเลื่อนอ่านในหน้า
 */
export type Wording = (text: string) => string;

export interface ReaderTab {
  id: string;
  label: string;
  active: boolean;
  /** data-ui ที่ส่งเมื่อแตะ */
  ui: string;
}

export interface ReaderContent {
  /** ใช้กำหนดสีพื้น: กระดาษ (สมุด) หรือแผงมืด */
  theme: 'paper' | 'dark';
  /** เปลี่ยนเมื่อเปิดหน้าใหม่ → เลื่อนกลับบนสุด */
  pageKey: string;
  title: string;
  tabs: ReaderTab[];
  body: string;
  foot: string;
  /** เลื่อนไปที่ส่วนนี้ (data-anchor) เมื่อเนื้อหาเปลี่ยน เช่น ผลการตรวจคำตอบ */
  focusAnchor?: string;
  /** แผงเล็กกลางจอ (เมนูหยุดเกม) */
  narrow?: boolean;
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const para = (text: string, cls = '', style = '') =>
  `<p class="tl-ln${cls ? ` ${cls}` : ''}"${style ? ` style="${style}"` : ''}>${esc(text)}</p>`;

/* ---------------- สมุดภาคสนาม ---------------- */

export function notebookReader(
  view: NotebookView,
  tabs: readonly NotebookTab[],
  tabLabel: Record<NotebookTab, string>,
  tambon: string,
  w: Wording,
): ReaderContent {
  const body = view.lines
    .map((l, i) => {
      const style = [
        `color:${l.color}`,
        l.indent ? 'padding-left:18px' : '',
        view.spacers[i] ? 'margin-top:10px' : '',
        l.gap >= 8 ? 'margin-bottom:8px' : '',
      ]
        .filter(Boolean)
        .join(';');
      return para(w(l.text), `tl-${l.role}`, style);
    })
    .join('');
  return {
    theme: 'paper',
    pageKey: `nb:${view.tab}`,
    title: `📒 สมุดภาคสนาม · ${tambon}`,
    tabs: tabs.map((t) => ({ id: t, label: tabLabel[t], active: t === view.tab, ui: `nb-tab:${t}` })),
    body,
    foot: view.footer.text ? para(w(view.footer.text), 'tl-foot-text', `color:${view.footer.color}`) : '',
  };
}

/* ---------------- กระดานวิเคราะห์ (บท 3–4) ---------------- */

export type BoardTab = 'evidence' | 'candidates' | 'result';

const TONE_CLASS = { none: '', ok: 'tl-ok', wrong: 'tl-bad', blocked: 'tl-warn' } as const;

/**
 * @param columns จอกว้างพอ → หลักฐานกับตัวเลือกวางคู่กัน (เทียบได้ทันที) · จอแคบ → แยกเป็นแท็บ
 */
export function boardReader(title: string, view: GridBoardView, tab: BoardTab, columns: boolean, w: Wording): ReaderContent {
  const evidence =
    `<section class="tl-sec" data-sec="evidence"><h3>📋 หลักฐานจากบันทึกและเบาะแส</h3>` +
    view.evidence.map((e) => para(w(e))).join('') +
    '</section>';
  const cards = view.candidates
    .map(
      (c) =>
        `<div class="tl-card${c.selected ? ' tl-card-sel' : ''}${c.surveyed ? '' : ' tl-card-dim'}">` +
        `<div class="tl-card-h">${c.selected ? '▶ ' : ''}${esc(`${c.key}) ${c.name}`)}</div>` +
        c.facts.map((f) => para(w(f))).join('') +
        '</div>',
    )
    .join('');
  const candidates = `<section class="tl-sec" data-sec="candidates"><h3>📍 จุดที่เป็นไปได้</h3>${cards}</section>`;
  const result =
    `<section class="tl-sec" data-sec="result" data-anchor="result"><h3>📝 สถานะและผลการตรวจ</h3>` +
    view.status.map((t) => para(w(t), 'tl-accent')).join('') +
    view.result.map((t) => para(w(t), TONE_CLASS[view.resultTone])).join('') +
    '</section>';
  const show = (id: BoardTab, html: string) => (columns || tab === id ? html : '');
  const tabs: ReaderTab[] = columns
    ? []
    : [
        { id: 'evidence', label: '📋 หลักฐาน', active: tab === 'evidence', ui: 'board-tab:evidence' },
        { id: 'candidates', label: '📍 จุด A·B·C', active: tab === 'candidates', ui: 'board-tab:candidates' },
        { id: 'result', label: view.result.length ? '📝 ผลการตรวจ ●' : '📝 สถานะ', active: tab === 'result', ui: 'board-tab:result' },
      ];
  return {
    theme: 'dark',
    pageKey: `board:${columns ? 'cols' : tab}`,
    title,
    tabs,
    body: columns
      ? `<div class="tl-cols">${evidence}${candidates}</div>${result}`
      : show('evidence', evidence) + show('candidates', candidates) + show('result', result),
    foot: '',
    focusAnchor: view.result.length ? 'result' : undefined,
  };
}

/* ---------------- เปรียบเทียบแผนที่ฐาน: หน้าหลักฐานและผล ---------------- */

export function compareReader(
  title: string,
  lines: { evidence: string[]; status: string[]; result: string[]; resultOk: boolean | null },
  w: Wording,
): ReaderContent {
  const tone = lines.resultOk === null ? 'tl-warn' : lines.resultOk ? 'tl-ok' : 'tl-bad';
  return {
    theme: 'dark',
    pageKey: 'compare:text',
    title,
    tabs: [],
    body:
      `<section class="tl-sec"><h3>📋 หลักฐานที่มี</h3>${lines.evidence.map((t) => para(w(t))).join('')}</section>` +
      `<section class="tl-sec"><h3>📝 สถานะ</h3>${lines.status.map((t) => para(w(t), 'tl-accent')).join('')}</section>` +
      (lines.result.length
        ? `<section class="tl-sec" data-anchor="result"><h3>ผลการเลือก</h3>${lines.result.map((t, i) => para(w(t.trim()), i === 0 ? tone : '')).join('')}</section>`
        : ''),
    foot: '',
    focusAnchor: lines.result.length ? 'result' : undefined,
  };
}

/* ---------------- หน้าสรุปผลเมื่อจบบท ---------------- */

export function summaryReader(v: SummaryView): ReaderContent {
  return {
    theme: 'dark',
    pageKey: 'summary',
    title: `🏆 ${v.title}`,
    tabs: [],
    body:
      `<section class="tl-sec"><h3>${esc(v.heading.join(' · '))}</h3>${v.stats.map((t) => para(t.trim())).join('')}</section>` +
      `<section class="tl-sec"><h3>ทักษะภูมิศาสตร์ที่ใช้</h3>${v.skills.map((k) => para(`${k.done ? '●' : '○'} ${k.label}`, k.done ? 'tl-ok' : 'tl-muted')).join('')}</section>` +
      (v.reward.length ? `<section class="tl-sec"><h3>รางวัล</h3>${v.reward.map((t) => para(t, 'tl-ok')).join('')}</section>` : ''),
    foot: '',
  };
}
