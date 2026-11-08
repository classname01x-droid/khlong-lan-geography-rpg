import { describe, expect, it } from 'vitest';
import { LEVEL_SEQUENCE } from '../src/content/registry';
import { CHAPTERS, FINALE_CHAPTER_ID } from '../src/content/story/chapters';
import type { CodePiece, LevelResult, ProgressData } from '../src/core/progress/ProgressStore';
import {
  chapterIntroView,
  continueSummary,
  endingView,
  journeyView,
  KEYBOARD_CONTROLS,
  MENU_ITEMS,
  menuView,
  TOUCH_CONTROLS,
} from '../src/ui/views/screens';
import { continueTarget } from '../src/core/campaign/Campaign';

/** ความคืบหน้าจำลอง: ผ่านบทตามรายการ (รหัสลับตามข้อมูลด่าน) */
function progress(done: string[], inProgress: string[] = []): ProgressData {
  const codes: Record<string, CodePiece> = {};
  const completed: Record<string, LevelResult> = {};
  done.forEach((id) => {
    const i = LEVEL_SEQUENCE.findIndex((s) => s.id === id);
    const code = i >= 0 ? { index: i + 1, total: 4, value: ['ลาย', 'น้ำ', 'พิกัด', 'ลาน'][i] } : null;
    if (code) codes[id] = code;
    completed[id] = {
      levelId: id,
      completedAt: '2026-01-01',
      distanceMeters: 1000,
      cluesFound: 3,
      cluesTotal: 4,
      mistakes: 1,
      elapsedMs: 60_000,
      skills: ['scale'],
      codePiece: code,
      evidenceFound: 2,
      evidenceTotal: 3,
    };
  });
  return {
    version: 2,
    completed,
    unlocked: ['sakngam', ...done],
    codePieces: codes,
    inProgress: Object.fromEntries(inProgress.map((id) => [id, {}])),
  };
}

const ORDER = CHAPTERS.map((c) => c.id);

describe('เมนูหลัก (ข้อมูลร่วม canvas/จอสัมผัส)', () => {
  it('ครั้งแรก: "เล่นต่อ" กดไม่ได้ ปุ่มเด่นคือ "เริ่มเกมใหม่"', () => {
    const v = menuView(progress([]), false);
    expect(v.items.map((i) => i.id)).toEqual(['new', 'continue', 'journey', 'howto', 'settings']);
    expect(v.items.find((i) => i.id === 'continue')!.enabled).toBe(false);
    expect(v.items.filter((i) => i.primary).map((i) => i.id)).toEqual(['new']);
    expect(v.continueText).toBeNull();
  });

  it('มีบันทึก: ปุ่มเด่นคือ "เล่นต่อ" และบอกว่าจะไปบทไหน', () => {
    const v = menuView(progress(['sakngam'], ['level-2']), true);
    expect(v.items.filter((i) => i.primary).map((i) => i.id)).toEqual(['continue']);
    expect(v.continueText).toContain('บทที่ 2');
    expect(v.continueText).toContain('มีบันทึกค้างอยู่');
  });

  it('ข้อความ "เล่นต่อ" ครอบคลุมทุกสถานะของภารกิจหลัก', () => {
    expect(continueSummary(continueTarget(CHAPTERS, progress(['sakngam'])))).toContain('เริ่มบทใหม่');
    expect(continueSummary(continueTarget(CHAPTERS, progress(ORDER)))).toContain('จบการเดินทางแล้ว');
  });

  it('วิธีเล่น: มีปุ่มบนจอสัมผัสครบทุกปุ่ม และปุ่มคีย์บอร์ดเดิม', () => {
    const touch = TOUCH_CONTROLS.map(([k]) => k).join(' ');
    for (const name of ['จอยสติก', 'ปุ่มเหลือง', 'แถบภารกิจ', 'แผนที่', 'สมุด', 'วัดระยะ', 'วิเคราะห์', 'เมนู']) expect(touch).toContain(name);
    expect(KEYBOARD_CONTROLS.length).toBe(8);
    expect(MENU_ITEMS.length).toBe(5);
  });
});

describe('แผนที่การเดินทาง: แสดงความคืบหน้าตามลำดับเรื่อง ไม่ใช่หน้าเลือกด่าน', () => {
  it('ลำดับ สักงาม → คลองน้ำไหล → โป่งน้ำร้อน → คลองลานพัฒนา → ปริศนาสุดท้าย', () => {
    const v = journeyView(progress([]));
    expect(v.nodes.map((n) => n.id)).toEqual(ORDER);
    expect(v.nodes.map((n) => n.order)).toEqual([1, 2, 3, 4, 5]);
    expect(ORDER[ORDER.length - 1]).toBe(FINALE_CHAPTER_ID);
  });

  it('สถานะ: สำรวจแล้ว · ภารกิจปัจจุบัน 1 บทเท่านั้น · เป้าหมายต่อไป · ยังไปไม่ถึง', () => {
    const v = journeyView(progress(['sakngam', 'level-2']));
    expect(v.nodes.map((n) => n.state)).toEqual(['explored', 'explored', 'current', 'next', 'locked']);
    expect(v.nodes.filter((n) => n.state === 'current')).toHaveLength(1);
    expect(v.codes).toEqual(['ลาย', 'น้ำ', '?', '?']);
  });

  it('ปุ่มหลักปุ่มเดียว พาไปบทปัจจุบันเท่านั้น (เล่นต่อ/เริ่มบท)', () => {
    expect(journeyView(progress(['sakngam'])).primary).toEqual({ label: 'เดินทางต่อ: บทที่ 2', enabled: true });
    expect(journeyView(progress(['sakngam'], ['level-2'])).primary.label).toBe('เล่นต่อ: บทที่ 2');
  });

  it('รหัสไม่ครบ → บทที่ 5 เข้าไม่ได้ (ปุ่มกดไม่ได้ พร้อมบอกเหตุผล)', () => {
    const p = progress(['sakngam', 'level-2', 'level-3', 'level-4']);
    delete p.codePieces['level-3'];
    p.completed['level-3'].codePiece = null;
    const v = journeyView(p);
    expect(v.primary.enabled).toBe(false);
    expect(v.notice.tone).toBe('bad');
    expect(v.notice.text).toContain('คำพิทักษ์ครบ 4 คำ');
  });

  it('จบเกมแล้ว: ทุกบทสำรวจแล้ว ปุ่มหลัก = ดูสรุปการเดินทาง', () => {
    const v = journeyView(progress(ORDER));
    expect(v.complete).toBe(true);
    expect(v.nodes.every((n) => n.state === 'explored')).toBe(true);
    expect(v.primary.label).toBe('ดูสรุปการเดินทาง');
  });
});

describe('ฉากเชื่อมบท: ชื่อบท เป้าหมายภารกิจใหม่ และบทสนทนา', () => {
  it('ทุกบทมีหัวบท ตำบล เป้าหมายภารกิจใหม่ และบทสนทนา', () => {
    for (const c of CHAPTERS) {
      const v = chapterIntroView(c.id, progress([]))!;
      expect(v.heading).toBe(`บทที่ ${c.order}`);
      expect(v.tambon).toBe(c.tambon);
      expect(v.goal.length, c.id).toBeGreaterThan(10);
      expect(v.lines.length).toBeGreaterThan(1);
    }
  });

  it('แทนรหัสลับที่เก็บได้ในบทสนทนา (ยังไม่มี = ?)', () => {
    const v = chapterIntroView('level-2', progress(['sakngam']))!;
    expect(v.lines[0].text).toContain('"ลาย"');
    expect(v.lines.some((l) => l.text.includes('{{'))).toBe(false);
  });
});

describe('ฉากจบ: แผนที่ภูมิปัญญา 4 ตำบล รหัสลับ 4 ชิ้น ผลการเรียนรู้', () => {
  it('ข้อมูลครบและมาจากบันทึกจริง', () => {
    const v = endingView(progress(ORDER));
    expect(v.wisdom.map((w) => w.tambon)).toEqual(LEVEL_SEQUENCE.map((s) => s.tambon));
    expect(v.codes).toEqual(['ลาย', 'น้ำ', 'พิกัด', 'ลาน']);
    expect(v.wisdom.every((w) => w.evidence === 'หลักฐาน 2/3')).toBe(true);
    expect(v.stats[0]).toBe(`บทที่ผ่าน: 5/${CHAPTERS.length}`);
    expect(v.stats.join(' ')).toContain('ระยะทางเดินรวม: 5,000 ม.');
    expect(v.skills.length).toBeGreaterThan(0);
  });
});
