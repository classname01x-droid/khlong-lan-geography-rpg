import { LEVEL_SEQUENCE, LEVELS, ALL_LEVELS } from '../../content/registry';
import { CHAPTERS, getChapter, getChapterIntro } from '../../content/story/chapters';
import {
  chapterStates,
  continueTarget,
  IN_DEVELOPMENT_MESSAGE,
  isCampaignComplete,
  type ChapterState,
  type ContinueTarget,
} from '../../core/campaign/Campaign';
import { describeLevel } from '../../core/progress/LevelProgress';
import type { ProgressData } from '../../core/progress/ProgressStore';
import { fmtMeters } from '../format';

/**
 * ข้อมูลของหน้าจอนอกด่าน (เมนูหลัก · แผนที่การเดินทาง · ฉากเชื่อมบท · ฉากจบ) — ข้อมูลล้วน ไม่ผูกกับ Phaser
 * ใช้ร่วมกันระหว่างหน้าจอบน canvas (คอมพิวเตอร์) และหน้าจอ DOM ตัวอักษรใหญ่ (จอสัมผัส) → ข้อความมาจากแหล่งเดียว
 * กติกาลำดับเรื่องทั้งหมดมาจาก core/campaign/Campaign.ts (ไม่เขียนซ้ำ)
 */

/* ======================= เมนูหลัก ======================= */

export type MenuItemId = 'new' | 'continue' | 'journey' | 'howto' | 'settings';

export interface MenuItem {
  id: MenuItemId;
  label: string;
  icon: string;
  enabled: boolean;
  primary: boolean;
}

export const MENU_ITEMS: ReadonlyArray<{ id: MenuItemId; label: string; icon: string }> = [
  { id: 'new', label: 'เริ่มเกมใหม่', icon: '🌱' },
  { id: 'continue', label: 'เล่นต่อ', icon: '▶' },
  { id: 'journey', label: 'แผนที่การเดินทาง', icon: '🧭' },
  { id: 'howto', label: 'วิธีเล่น', icon: '❓' },
  { id: 'settings', label: 'ตั้งค่า', icon: '⚙️' },
];

export const GAME_TITLE = { kicker: 'Geography Mystery RPG', title: 'ปริศนาลับแห่งคลองลาน', subtitle: 'เกมสืบสวนภูมิศาสตร์ 4 ตำบลของอำเภอคลองลาน' };

export const NEW_GAME_CONFIRM = {
  title: 'เริ่มเกมใหม่?',
  message: 'ความคืบหน้าทั้งหมดจะถูกลบ ได้แก่ ด่านที่ผ่านแล้ว คำพิทักษ์ที่สะสม และการเล่นที่ค้างอยู่ (การตั้งค่าจะไม่ถูกลบ)',
  confirm: 'ยืนยัน: ลบและเริ่มใหม่',
  cancel: 'ยกเลิก',
};

/** ข้อความสั้นใต้ปุ่ม "เล่นต่อ": จะได้ไปที่ไหน (ช่วยให้เด็กรู้ว่าเล่นถึงไหนแล้ว) */
export function continueSummary(target: ContinueTarget): string {
  switch (target.kind) {
    case 'complete':
      return 'จบการเดินทางแล้ว — ดูสรุปการเดินทาง';
    case 'resume':
      return `บทที่ ${target.chapter.order} · ${target.chapter.tambon} (มีบันทึกค้างอยู่)`;
    case 'begin':
      return `บทที่ ${target.chapter.order} · ${target.chapter.tambon} (เริ่มบทใหม่)`;
    case 'stage':
      return `บทที่ ${target.chapter.order} · ${target.chapter.tambon}`;
    case 'in-development':
      return `บทที่ ${target.chapter.order}: ${IN_DEVELOPMENT_MESSAGE}`;
  }
}

export function menuView(p: ProgressData, hasSave: boolean): { items: MenuItem[]; continueText: string | null } {
  const items = MENU_ITEMS.map((m) => ({
    ...m,
    // "เล่นต่อ" กดได้เฉพาะเมื่อมีข้อมูลบันทึกจริง · ปุ่มเด่น = สิ่งที่ควรกดต่อ
    enabled: m.id !== 'continue' || hasSave,
    primary: hasSave ? m.id === 'continue' : m.id === 'new',
  }));
  return { items, continueText: hasSave ? continueSummary(continueTarget(CHAPTERS, p)) : null };
}

/* ---------------- วิธีเล่น ---------------- */

export const HOW_TO_GOAL =
  'คุณคือผู้นำชุมชนคนใหม่ ช่วยชาวบ้าน 4 ตำบลของอำเภอคลองลานตามลำดับ พูดคุยกับชาวบ้าน เก็บเบาะแสลงสมุดภาคสนาม ใช้ทิศทาง ระยะทาง และจุดสังเกตแก้ปัญหา รับคำพิทักษ์ตำบลละ 1 คำ แล้วปลดปล่อยพญาจระเข้ผู้พิทักษ์จากมลพิษ';
export const HOW_TO_SCALE =
  'มาตราส่วน: 1 ช่องในเกม = 10 เมตร · แผนที่ 1:10,000 → 1 ซม. บนแผนที่ = 100 เมตร (เช่น 3 ซม. = 300 ม., 4 ซม. = 400 ม.)';
export const HOW_TO_TIPS =
  'พื้นที่ที่ยังไม่สำรวจถูกหมอกบัง · ตอบผิดจะได้คำใบ้และลองใหม่ได้ · เกมบันทึกความคืบหน้าอัตโนมัติ · ' +
  'มือถือ (แนวนอน): จอยสติกซ้าย = เดิน · ปุ่มขวา = คุย/สำรวจ แผนที่ สมุด วัดระยะ วิเคราะห์ เมนู · แตะตัวเลือกเพื่อตอบ';

/** ปุ่มคีย์บอร์ด (คอมพิวเตอร์) */
export const KEYBOARD_CONTROLS: ReadonlyArray<[string, string]> = [
  ['W A S D / ปุ่มลูกศร', 'เดิน (เดินทแยงได้)'],
  ['E / Space / Enter', 'คุยกับ NPC · ตรวจค้น · ไปบทพูดถัดไป'],
  ['M', 'เปิดแผนที่สำรวจ (มาตราส่วน 1:10,000) · ปักหมุด'],
  ['R', 'เริ่มวัดระยะเดินจริงจากจุดที่ยืน'],
  ['N', 'สมุดภาคสนาม: ภารกิจ เบาะแส วิเคราะห์เส้นทาง หลักฐาน'],
  ['G', 'เปิด/ปิดเส้นตาราง (1 ช่อง = 10 ม.)'],
  ['1 2 3', 'เลือกคำตอบ / เลือกเส้นทาง / เลือกประเภทภูมิปัญญา'],
  ['Esc', 'เมนูหยุดเกม (แผนที่การเดินทาง / เมนูหลัก)'],
];

/** ปุ่มบนจอสัมผัส (ชื่อตรงกับปุ่มจริงใน core/input/InputMapping.ts) */
export const TOUCH_CONTROLS: ReadonlyArray<[string, string]> = [
  ['🕹️ จอยสติก (ซ้าย)', 'แตะค้างแล้วลากเพื่อเดิน 8 ทิศ · ยกนิ้วเพื่อหยุด'],
  ['✋ ปุ่มเหลือง (ขวาล่าง)', 'คุย / สำรวจ / ตรวจสอบ สิ่งที่อยู่ใกล้ — ข้อความด้านล่างบอกว่าจะทำอะไร'],
  ['📜 แถบภารกิจ (ขวาบน)', 'บอกภารกิจ เป้าหมาย ความคืบหน้า และคำแนะนำ · แตะ "ช่วยหน่อย" เมื่อติด'],
  ['🗺️ แผนที่', 'ดูพื้นที่ที่สำรวจแล้ว · ＋/－ ขยาย · ลากนิ้วเลื่อน · แตะช่องเพื่อวางหมุด'],
  ['📒 สมุด', 'เบาะแส ภารกิจ วิเคราะห์เส้นทาง หลักฐาน (แตะแท็บ · ลากขึ้นลงเพื่ออ่าน)'],
  ['📏 วัดระยะ', 'เริ่มวัดระยะเดินจริงจากจุดที่ยืน'],
  ['🔍 วิเคราะห์', 'กระดานวิเคราะห์ / เปรียบเทียบแผนที่ (เฉพาะบทที่ใช้)'],
  ['☰ เมนู', 'หยุดเกม · แผนที่การเดินทาง · กลับเมนูหลัก (บันทึกอัตโนมัติ)'],
];

export const SETTINGS_NOTE = 'ตอนนี้เกมยังไม่มีไฟล์เสียง การปรับระดับเสียงจะเพิ่มเมื่อมีระบบเสียงจริง';

/* ======================= แผนที่การเดินทาง ======================= */

export const CHAPTER_STATE_LABEL: Record<ChapterState, string> = {
  explored: 'สำรวจแล้ว ✓',
  current: 'ภารกิจปัจจุบัน',
  next: 'เป้าหมายต่อไป',
  locked: 'ยังเดินทางไปไม่ถึง',
};

export interface JourneyNode {
  id: string;
  order: number;
  tambon: string;
  title: string;
  state: ChapterState;
  stateLabel: string;
  inProgress: boolean;
  /** บรรทัดรายละเอียด (หลักฐาน รหัส ผลสำรวจ) */
  details: string[];
  inDevelopment: boolean;
}

export interface JourneyView {
  title: string;
  complete: boolean;
  /** 4 ตำบล + บทที่ 5 ตามลำดับเรื่อง */
  nodes: JourneyNode[];
  notice: { text: string; tone: 'normal' | 'warn' | 'bad' };
  /** ปุ่มหลักปุ่มเดียว: พาไปภารกิจหลักปัจจุบันเท่านั้น */
  primary: { label: string; enabled: boolean };
}

export function journeyView(p: ProgressData): JourneyView {
  const states = chapterStates(CHAPTERS, p);
  const complete = isCampaignComplete(CHAPTERS, p);
  const models = LEVEL_SEQUENCE.map((slot, i) =>
    describeLevel(slot, p, i === 0, LEVELS.find((l) => l.id === slot.id)?.evidence?.length ?? null),
  );
  const nodes: JourneyNode[] = CHAPTERS.map((c, i) => {
    const state = states[c.id];
    const m = i < models.length ? models[i] : null;
    const details: string[] = [];
    if (m) {
      if (state === 'explored' || state === 'current') details.push(m.evidenceText);
      if (m.result) {
        const sec = Math.floor(m.result.elapsedMs / 1000);
        details.push(`ผลสำรวจ: ${fmtMeters(m.result.distanceMeters)} · ผิด ${m.result.mistakes} · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} นาที`);
      }
    } else {
      details.push(c.kind === 'shop' ? 'ใช้เหรียญซื้ออาวุธ เกราะ และยารักษา' : 'ชำระมลพิษพญาจระเข้ด้วยพลังศรัทธา');
    }
    return {
      id: c.id,
      order: c.order,
      tambon: c.tambon,
      title: c.title,
      state,
      stateLabel: CHAPTER_STATE_LABEL[state],
      inProgress: state === 'current' && !!m?.hasInProgress,
      details: details.filter(Boolean),
      inDevelopment: state === 'current' && !c.playable,
    };
  });
  let notice: JourneyView['notice'] = {
    text: complete ? 'ชำระมลพิษสำเร็จ — คลองลานกลับมาสงบสุข' : `เหรียญ ${p.rpg?.coins ?? 0} · ศรัทธา ${p.rpg?.faith ?? 0}`,
    tone: 'normal',
  };
  const target = continueTarget(CHAPTERS, p);
  const label =
    target.kind === 'complete'
      ? 'ดูสรุปการเดินทาง'
      : target.kind === 'resume'
        ? `เล่นต่อ: บทที่ ${target.chapter.order}`
        : target.kind === 'begin'
          ? `เดินทางต่อ: บทที่ ${target.chapter.order}`
          : target.kind === 'stage'
            ? `ไปต่อ: ${target.chapter.tambon}`
            : IN_DEVELOPMENT_MESSAGE;
  if (target.kind === 'in-development') {
    notice = { text: `บทที่ ${target.chapter.order}: ${IN_DEVELOPMENT_MESSAGE} — ความคืบหน้าถูกบันทึกไว้แล้ว`, tone: 'warn' };
  }
  return {
    title: complete ? 'แผนที่การเดินทาง — ภารกิจสำเร็จ ✓' : 'แผนที่การเดินทาง — อำเภอคลองลาน',
    complete,
    nodes,
    notice,
    primary: { label, enabled: target.kind !== 'in-development' },
  };
}

/* ======================= ฉากเชื่อมบท ======================= */

export interface ChapterIntroView {
  heading: string;
  tambon: string;
  title: string;
  /** เป้าหมายภารกิจใหม่ของบท (จากภารกิจหลักของด่าน) */
  goal: string;
  lines: Array<{ speaker: string; text: string }>;
  playable: boolean;
}

export function chapterIntroView(chapterId: string, _p: ProgressData): ChapterIntroView | null {
  const chapter = getChapter(chapterId);
  const intro = getChapterIntro(chapterId);
  if (!chapter || !intro) return null;
  const level = ALL_LEVELS.find((l) => l.id === chapter.levelId);
  const main = level?.quests?.find((q) => q.kind === 'main');
  return {
    heading: intro.heading,
    tambon: chapter.tambon,
    title: chapter.title,
    goal: main?.description ?? chapter.title,
    lines: intro.lines.map((l) => ({ speaker: l.speaker, text: l.text })),
    playable: chapter.playable && !!chapter.levelId,
  };
}
