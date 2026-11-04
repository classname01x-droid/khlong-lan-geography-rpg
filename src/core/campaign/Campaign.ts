import type { ProgressData } from '../progress/ProgressStore';

/**
 * ระบบภารกิจหลักต่อเนื่อง (Story-Driven Campaign) — คำนวณจากข้อมูลบันทึกเดิม (ProgressStore v2) ล้วน ๆ
 * ไม่มีข้อมูลบันทึกใหม่: "บทปัจจุบัน" = บทแรกตามลำดับที่ยังไม่ผ่าน (completed)
 *
 * กติกา:
 *   - เล่นได้เฉพาะบทปัจจุบัน — ข้ามไปบทที่สูงกว่า หรือย้อนเล่นบทที่ผ่านแล้ว ไม่ได้ (ลำดับเรื่องไม่ผิด)
 *   - บทปัจจุบันที่ยังไม่มีเนื้อหา (playable = false) → "ภารกิจถัดไปอยู่ระหว่างพัฒนา" และคงความคืบหน้าไว้
 *   - เล่นต่อ: บทปัจจุบันมีบันทึกกลางบท → กลับไปตำแหน่งเดิม; ไม่มี → เปิดฉากเชื่อมเรื่องของบทนั้นก่อนเริ่มบท
 */
export interface ChapterSlot {
  /** id บท (= id ด่าน สำหรับบทที่เป็นตำบล) */
  id: string;
  /** ด่านที่เล่นในบทนี้ (null = บทที่ไม่ใช่ด่าน เช่น ไขปริศนาสุดท้าย) */
  levelId: string | null;
  order: number;
  tambon: string;
  title: string;
  /** มีเนื้อหาให้เล่นจริงหรือไม่ */
  playable: boolean;
  /** (ไม่บังคับ) ต้องมีรหัสลับจากบทเหล่านี้ครบก่อนจึงเข้าได้ (บทสรุป: รหัสครบ 4 ชิ้น) */
  requiresCodesFrom?: string[];
}

/** explored = สำรวจแล้ว · current = ภารกิจปัจจุบัน · next = เป้าหมายต่อไป · locked = ยังไปไม่ถึง */
export type ChapterState = 'explored' | 'current' | 'next' | 'locked';

export const IN_DEVELOPMENT_MESSAGE = 'ภารกิจถัดไปอยู่ระหว่างพัฒนา';

const isDone = (c: ChapterSlot, p: ProgressData) => c.levelId !== null && c.levelId in p.completed;

/** จบเกมแล้ว = ผ่านครบทุกบท (รวมบทสรุป) */
export function isCampaignComplete(chapters: readonly ChapterSlot[], p: ProgressData): boolean {
  return chapters.every((c) => isDone(c, p));
}

/** รหัสลับที่บทนี้ต้องการแต่ยังไม่มี (ว่าง = ครบ) */
export function missingCodes(c: ChapterSlot, p: ProgressData): string[] {
  return (c.requiresCodesFrom ?? []).filter((id) => !p.codePieces[id] && !p.completed[id]?.codePiece);
}

/** บทปัจจุบัน = บทแรกที่ยังไม่ผ่าน (ถ้าผ่านครบทุกบทแล้ว = บทสุดท้าย) */
export function currentChapter(chapters: readonly ChapterSlot[], p: ProgressData): ChapterSlot {
  return chapters.find((c) => !isDone(c, p)) ?? chapters[chapters.length - 1];
}

export function chapterStates(chapters: readonly ChapterSlot[], p: ProgressData): Record<string, ChapterState> {
  const cur = currentChapter(chapters, p);
  const out: Record<string, ChapterState> = {};
  if (isCampaignComplete(chapters, p)) {
    for (const c of chapters) out[c.id] = 'explored';
    return out;
  }
  for (const c of chapters) {
    if (c.id === cur.id) out[c.id] = 'current';
    else if (isDone(c, p)) out[c.id] = 'explored';
    else if (c.order === cur.order + 1) out[c.id] = 'next';
    else out[c.id] = 'locked';
  }
  return out;
}

/** เข้าเล่นด่านนี้ได้หรือไม่ (ทุกทางเข้า: เมนู แผนที่การเดินทาง URL) — ต้องเป็นด่านของบทปัจจุบันและมีเนื้อหา */
export function canPlayLevel(chapters: readonly ChapterSlot[], p: ProgressData, levelId: string): boolean {
  if (isCampaignComplete(chapters, p)) return false; // จบเกมแล้ว: ไม่ย้อนเล่นบทใด
  const cur = currentChapter(chapters, p);
  return cur.playable && cur.levelId === levelId && missingCodes(cur, p).length === 0;
}

export type ContinueTarget =
  /** มีบันทึกกลางบท → เล่นต่อจากตำแหน่งเดิม */
  | { kind: 'resume'; chapter: ChapterSlot; levelId: string }
  /** ยังไม่เริ่มบทนี้ → ฉากเชื่อมเรื่อง แล้วเริ่มบท */
  | { kind: 'begin'; chapter: ChapterSlot }
  /** บทนี้ยังไม่มีเนื้อหา */
  | { kind: 'in-development'; chapter: ChapterSlot }
  /** เงื่อนไขของบทยังไม่ครบ (เช่น รหัสลับไม่ครบ 4 ชิ้น) */
  | { kind: 'blocked'; chapter: ChapterSlot; missingCodes: string[] }
  /** จบเกมแล้ว → สรุปการเดินทาง */
  | { kind: 'complete' };

export function continueTarget(chapters: readonly ChapterSlot[], p: ProgressData): ContinueTarget {
  if (isCampaignComplete(chapters, p)) return { kind: 'complete' };
  const chapter = currentChapter(chapters, p);
  if (!chapter.playable || !chapter.levelId) return { kind: 'in-development', chapter };
  const missing = missingCodes(chapter, p);
  if (missing.length) return { kind: 'blocked', chapter, missingCodes: missing };
  if (p.inProgress[chapter.levelId]) return { kind: 'resume', chapter, levelId: chapter.levelId };
  return { kind: 'begin', chapter };
}

/** บทถัดจากบทนี้ (ใช้ตอนจบบท: ครูมอบภารกิจบทถัดไป) */
export function nextChapter(chapters: readonly ChapterSlot[], id: string): ChapterSlot | null {
  const i = chapters.findIndex((c) => c.id === id);
  return i >= 0 && i + 1 < chapters.length ? chapters[i + 1] : null;
}

/** แทน {{code:<levelId>}} ด้วยรหัสลับที่เก็บได้ (ยังไม่มี = "?") — ใช้ในบทสนทนาเชื่อมเรื่อง */
export function resolveChapterText(text: string, p: ProgressData): string {
  return text.replace(/\{\{code:([\w-]+)\}\}/g, (_m, id: string) => p.codePieces[id]?.value ?? '?');
}
