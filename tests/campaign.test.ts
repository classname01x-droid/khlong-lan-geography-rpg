import { describe, expect, it } from 'vitest';
import { khlongNamLaiLevel as L2 } from '../src/content/levels/khlongnamlai';
import { khlongLanPattanaLevel as L4 } from '../src/content/levels/khlonglanpattana';
import { pongNamRonLevel as L3 } from '../src/content/levels/pongnamron';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { ALL_LEVELS, canEnterLevel, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import { LEGEND_NOTE, CHAPTER_INTROS, CHAPTERS, FINALE_CHAPTER_ID, getChapterIntro } from '../src/content/story/chapters';
import {
  canPlayLevel,
  chapterStates,
  continueTarget,
  currentChapter,
  IN_DEVELOPMENT_MESSAGE,
  nextChapter,
  resolveChapterText,
  type ChapterSlot,
} from '../src/core/campaign/Campaign';
import { PROGRESS_KEY, ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';
import type { SessionSnapshot } from '../src/core/session/GameSession';
import { newSession, talk } from './helpers';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const result = (levelId: string): LevelResult => {
  const level = LEVELS.find((l) => l.id === levelId)!;
  return {
    levelId,
    completedAt: 'x',
    distanceMeters: 1,
    cluesFound: 1,
    cluesTotal: 1,
    mistakes: 0,
    elapsedMs: 1,
    skills: [],
    codePiece: level.ending?.codePiece ?? null,
  };
};

/** จบบท (ผ่าน ProgressStore เดิม แบบเดียวกับ WorldScene.onMissionComplete) */
const finish = (store: ProgressStore, levelId: string) =>
  store.completeLevel(result(levelId), LEVELS.find((l) => l.id === levelId)!.unlocks);

const fresh = () => new ProgressStore(new MemoryStorage(), L1.id);
const cur = (s: ProgressStore) => currentChapter(CHAPTERS, s.data).id;

describe('ลำดับภารกิจหลัก 5 บท', () => {
  it('สักงาม → คลองน้ำไหล → โป่งน้ำร้อน → คลองลานพัฒนา → ไขปริศนาสุดท้าย', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['sakngam', 'level-2', 'level-3', 'level-4', FINALE_CHAPTER_ID]);
    expect(CHAPTERS.map((c) => c.tambon).slice(0, 4)).toEqual(['ตำบลสักงาม', 'ตำบลคลองน้ำไหล', 'ตำบลโป่งน้ำร้อน', 'ตำบลคลองลานพัฒนา']);
    expect(CHAPTERS.map((c) => c.order)).toEqual([1, 2, 3, 4, 5]);
    // ลำดับบทสอดคล้องกับการปลดล็อกของด่าน (level.unlocks)
    expect([L1.unlocks, L2.unlocks, L3.unlocks]).toEqual(['level-2', 'level-3', 'level-4']);
    expect(L4.unlocks).toBe(FINALE_CHAPTER_ID);
    expect(CHAPTERS.find((c) => c.id === FINALE_CHAPTER_ID)!.playable).toBe(true);
  });

  it('เริ่มเกมใหม่: บทปัจจุบัน = บทที่ 1 และเป้าหมายต่อไป = บทที่ 2', () => {
    const s = fresh();
    expect(cur(s)).toBe('sakngam');
    expect(chapterStates(CHAPTERS, s.data)).toEqual({
      sakngam: 'current',
      'level-2': 'next',
      'level-3': 'locked',
      'level-4': 'locked',
      [FINALE_CHAPTER_ID]: 'locked',
    });
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'begin', chapter: { id: 'sakngam' } });
  });

  it('จบบท 1 → บท 2 → บท 3 → บท 4: บทปัจจุบันเลื่อนตามลำดับ และเล่นได้เฉพาะบทปัจจุบัน', () => {
    const s = fresh();
    const order = ['sakngam', 'level-2', 'level-3', 'level-4'];
    for (let i = 0; i < 3; i++) {
      expect(cur(s)).toBe(order[i]);
      for (const id of order) expect(canPlayLevel(CHAPTERS, s.data, id), `${id} @ บท ${i + 1}`).toBe(id === order[i]);
      finish(s, order[i]);
      expect(nextChapter(CHAPTERS, order[i])?.id).toBe(order[i + 1]);
    }
    expect(cur(s)).toBe('level-4');
    expect(chapterStates(CHAPTERS, s.data)).toEqual({
      sakngam: 'explored',
      'level-2': 'explored',
      'level-3': 'explored',
      'level-4': 'current',
      [FINALE_CHAPTER_ID]: 'next',
    });
  });

  it('ข้ามบทไม่ได้: บทที่ 3 ปลดล็อกในข้อมูลบันทึก (แก้ไขเอง) แต่ยังไม่จบบท 2 → ยังเล่นไม่ได้', () => {
    const s = fresh();
    finish(s, 'sakngam');
    s.data.unlocked.push('level-3', 'level-4');
    expect(canEnterLevel('level-3', s.data)).toBe(true); // กติกาปลดล็อกเดิม
    expect(canPlayLevel(CHAPTERS, s.data, 'level-3')).toBe(false); // กติกาภารกิจหลัก
    expect(canPlayLevel(CHAPTERS, s.data, 'level-4')).toBe(false);
    expect(canPlayLevel(CHAPTERS, s.data, 'level-2')).toBe(true);
  });

  it('ย้อนเล่นบทที่ผ่านแล้วไม่ได้ (ลำดับเรื่องไม่ย้อนกลับ)', () => {
    const s = fresh();
    finish(s, 'sakngam');
    expect(canPlayLevel(CHAPTERS, s.data, 'sakngam')).toBe(false);
    expect(chapterStates(CHAPTERS, s.data).sakngam).toBe('explored');
  });

  it('id ที่ไม่มีอยู่จริงเข้าไม่ได้', () => {
    expect(canPlayLevel(CHAPTERS, fresh().data, 'level-5')).toBe(false);
    expect(canPlayLevel(CHAPTERS, fresh().data, FINALE_CHAPTER_ID)).toBe(false);
  });
});

describe('เล่นต่อ (ภารกิจหลักล่าสุด ตำแหน่งเดิม สถานะปริศนาเดิม)', () => {
  it('มีบันทึกกลางบทปัจจุบัน → เล่นต่อจากบันทึก (ตำแหน่ง/ฉาก/เบาะแสเดิม)', () => {
    const s = fresh();
    finish(s, 'sakngam');
    const a = newSession(L2);
    talk(a, 'teacher-nem');
    a.playerTile = { x: 20, y: 20 };
    s.saveInProgress('level-2', JSON.parse(JSON.stringify(a.toSnapshot())));
    const t = continueTarget(CHAPTERS, s.data);
    expect(t).toMatchObject({ kind: 'resume', levelId: 'level-2' });
    const b = newSession(L2);
    expect(b.restore(s.loadInProgress('level-2') as SessionSnapshot)).toBe(true);
    expect(b.playerTile).toEqual({ x: 20, y: 20 });
    expect(b.clues).toEqual(a.clues);
    expect(b.currentStepOrder).toBe(a.currentStepOrder);
  });

  it('ยังไม่เริ่มบทถัดไป (เพิ่งจบบทก่อน) → ฉากเชื่อมเรื่องของบทนั้นก่อน', () => {
    const s = fresh();
    finish(s, 'sakngam');
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'begin', chapter: { id: 'level-2' } });
  });

  it('บันทึกค้างของบทที่ผ่านแล้ว (จากรุ่นก่อนที่เล่นซ้ำได้) ไม่ถูกลบ แต่เล่นต่อจะไปบทปัจจุบัน', () => {
    const s = fresh();
    finish(s, 'sakngam');
    s.saveInProgress('sakngam', newSession(L1).toSnapshot()); // lastLevelId ชี้บทที่ผ่านแล้ว
    expect(s.continueLevelId()).toBe('sakngam'); // ข้อมูลเดิมยังอยู่ครบ
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'begin', chapter: { id: 'level-2' } });
    expect(s.loadInProgress('sakngam')).not.toBeNull();
  });

  it('ภารกิจรองไม่ทำให้ลำดับเรื่องเปลี่ยน (บทปัจจุบันขึ้นกับการจบภารกิจหลักเท่านั้น)', () => {
    const s = fresh();
    const a = newSession(L1);
    for (const q of L1.quests ?? []) if (q.kind !== 'main') a.questStatus.set(q.id, 'completed');
    s.saveInProgress('sakngam', a.toSnapshot());
    expect(cur(s)).toBe('sakngam');
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'resume', levelId: 'sakngam' });
  });
});

describe('บทที่ยังไม่ถูกสร้าง', () => {
  it('จบบท 4 → บท 5 (ปริศนาสุดท้าย) เปิดด้วยฉากเชื่อมเรื่อง และบท 1–4 เล่นซ้ำไม่ได้', () => {
    const s = fresh();
    for (const id of ['sakngam', 'level-2', 'level-3', 'level-4']) finish(s, id);
    expect(cur(s)).toBe(FINALE_CHAPTER_ID);
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'begin', chapter: { id: FINALE_CHAPTER_ID } });
    expect(canPlayLevel(CHAPTERS, s.data, FINALE_CHAPTER_ID)).toBe(true);
    expect(IN_DEVELOPMENT_MESSAGE).toBe('ภารกิจถัดไปอยู่ระหว่างพัฒนา');
    expect(s.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย', 'น้ำ', 'พิกัด', 'ลาน']);
    for (const id of ['sakngam', 'level-2', 'level-3', 'level-4']) expect(canPlayLevel(CHAPTERS, s.data, id)).toBe(false);
  });

  it('ช่องบทที่ยังเป็น planned (ไม่มีด่าน) → ไม่เปิดฉาก และคงความคืบหน้าเดิม', () => {
    const chapters: ChapterSlot[] = CHAPTERS.map((c) => (c.id === 'level-2' ? { ...c, playable: false } : c));
    const s = fresh();
    finish(s, 'sakngam');
    expect(continueTarget(chapters, s.data)).toMatchObject({ kind: 'in-development', chapter: { id: 'level-2' } });
    expect(canPlayLevel(chapters, s.data, 'level-2')).toBe(false);
    expect(s.isCompleted('sakngam')).toBe(true);
  });

  it('ทุกฉากของบท 1–5 สร้างแล้ว (ไม่มีฉาก planned เหลือ)', () => {
    for (const L of ALL_LEVELS) expect(L.story.filter((st) => st.status === 'planned').map((st) => st.order), L.id).toEqual([]);
  });
});

describe('ฉากเชื่อมเรื่อง (Chapter Transition) — ข้อมูลแยกจากตรรกะ', () => {
  it('มีฉากเชื่อมเรื่องครบทุกบท และเชื่อมจากบทก่อนหน้าตามลำดับ', () => {
    expect(CHAPTER_INTROS.map((c) => c.chapterId)).toEqual(CHAPTERS.map((c) => c.id));
    CHAPTER_INTROS.forEach((intro, i) => {
      expect(intro.fromChapterId).toBe(i === 0 ? null : CHAPTERS[i - 1].id);
      expect(intro.heading).toBe(`บทที่ ${i + 1}`);
      expect(intro.lines.length).toBeGreaterThanOrEqual(2);
      for (const l of intro.lines) expect(l.speaker).toBe('ครูเนม');
    });
  });

  it('ครูเนมมอบภารกิจบทถัดไป พร้อมรหัสที่ได้จากบทก่อน (ดึงจากข้อมูลบันทึก)', () => {
    const s = fresh();
    finish(s, 'sakngam');
    const text = getChapterIntro('level-2')!.lines.map((l) => resolveChapterText(l.text, s.data)).join('\n');
    expect(text).toContain('"ลาย"');
    expect(text).toContain('ตำบลคลองน้ำไหล');
    // รหัสที่ยังไม่ได้ → "?"
    expect(resolveChapterText('{{code:level-4}}', s.data)).toBe('?');
  });

  it('บทนำบทที่ 1: ผู้นำชุมชนคนใหม่ · คำพิทักษ์ 4 คำจาก 4 ชุมชน · พญาจระเข้ (บอกว่าเป็นเรื่องแต่ง)', () => {
    const intro = getChapterIntro('sakngam')!;
    const text = intro.lines.map((l) => l.text).join(' ');
    expect(text).toContain('ผู้นำชุมชนคนใหม่');
    expect(text).toContain('คำพิทักษ์');
    expect(text).toContain('พญาจระเข้');
    expect(text).not.toContain('หีบ');
    for (const t of ['สักงาม', 'คลองน้ำไหล', 'โป่งน้ำร้อน', 'คลองลานพัฒนา']) expect(text).toContain(t);
    expect(intro.words).toBe(true);
    expect(LEGEND_NOTE).toContain('เรื่องแต่ง');
    // บทสนทนาสั้น: ไม่เกิน 2 ประโยคยาวต่อกล่อง
    for (const l of intro.lines) expect(l.text.length, l.text).toBeLessThanOrEqual(90);
  });

  it('ทุกบทต่อตำนาน: บอกคำพิทักษ์ที่ได้และจำนวนที่เหลือ · บทสุดท้ายกลับมาที่ศาลพญาจระเข้', () => {
    expect(getChapterIntro('level-2')!.lines[0].text).toContain('เหลืออีก 3 คำ');
    for (const id of ['level-2', 'level-3', 'level-4', 'finale']) {
      const t = getChapterIntro(id)!.lines.map((l) => l.text).join(' ');
      expect(t).toContain('คำพิทักษ์');
      expect(t).not.toContain('หีบ');
    }
    expect(getChapterIntro('finale')!.lines.map((l) => l.text).join(' ')).toContain('ศาลพญาจระเข้');
  });
});

describe('ความเข้ากันได้ของข้อมูลบันทึกเดิม', () => {
  it('ข้อมูลรุ่น v1 (completed + unlocked) → บทปัจจุบันคำนวณได้ถูกต้อง', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, completed: { sakngam: result('sakngam') }, unlocked: ['sakngam', 'level-2'] }));
    const s = new ProgressStore(storage, L1.id);
    expect(cur(s)).toBe('level-2');
    expect(s.collectedCodePieces().map((c) => c.value)).toEqual(['ลาย']);
  });

  it('ข้อมูล v2 ที่เล่นค้างกลางบท 3 → เล่นต่อที่บท 3 และไม่มีข้อมูลหาย', () => {
    const storage = new MemoryStorage();
    const old = new ProgressStore(storage, L1.id);
    finish(old, 'sakngam');
    finish(old, 'level-2');
    const a = newSession(L3);
    talk(a, 'teacher-nem', [2]);
    old.saveInProgress('level-3', a.toSnapshot());
    const raw = storage.getItem(PROGRESS_KEY)!;
    const again = new MemoryStorage();
    again.setItem(PROGRESS_KEY, raw);
    const s = new ProgressStore(again, L1.id);
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'resume', levelId: 'level-3' });
    expect(JSON.stringify(s.data)).toBe(raw); // อ่านแล้วไม่แก้ข้อมูล
  });

  it('LEVEL_SEQUENCE และการ์ด 4 ตำบลยังอยู่ (ใช้เป็นแผนที่การเดินทาง)', () => {
    expect(LEVEL_SEQUENCE.map((s) => s.id)).toEqual(CHAPTERS.slice(0, 4).map((c) => c.id));
  });
});

describe('Intro ตำนานพญาจระเข้ (3 ฉากก่อนเริ่มเกมใหม่)', () => {
  it('3 ฉากตามลำดับเรื่อง · มีภาพจริงใน public/intro · บอกว่าเป็นเรื่องแต่ง', async () => {
    const { existsSync } = (await import('node:' + 'fs')) as { existsSync: (p: string) => boolean };
    const { INTRO_SCENES, INTRO_FICTION_NOTE } = await import('../src/content/story/chapters');
    expect(INTRO_SCENES).toHaveLength(3);
    expect(INTRO_SCENES[0].text).toContain('อุดมสมบูรณ์');
    expect(INTRO_SCENES[1].text).toContain('สารเคมี');
    expect(INTRO_SCENES[1].text).toContain('พิโรธ');
    expect(INTRO_SCENES[2].text).toContain('ผู้นำชุมชนคนใหม่');
    expect(INTRO_SCENES[2].text).toContain('ปลดปล่อยพญาจระเข้');
    for (const s of INTRO_SCENES) expect(existsSync(`public/${s.image}`), s.image).toBe(true);
    expect(INTRO_FICTION_NOTE).toContain('เรื่องแต่ง');
  });
});
