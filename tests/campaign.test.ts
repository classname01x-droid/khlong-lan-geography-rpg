import { describe, expect, it } from 'vitest';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { canEnterLevel, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import { BOSS_CHAPTER_ID, CHAPTER_INTROS, CHAPTERS, getChapterIntro, INTRO_SCENES, SHOP_CHAPTER_ID } from '../src/content/story/chapters';
import { canPlayLevel, chapterStates, continueTarget, currentChapter, isCampaignComplete } from '../src/core/campaign/Campaign';
import { ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';
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

const result = (levelId: string): LevelResult => ({ levelId, completedAt: 'x', distanceMeters: 1, cluesFound: 0, cluesTotal: 0, mistakes: 0, elapsedMs: 1, skills: [], codePiece: null });
const finish = (store: ProgressStore, levelId: string) => store.completeLevel(result(levelId), LEVELS.find((l) => l.id === levelId)!.unlocks);
const fresh = () => new ProgressStore(new MemoryStorage(), L1.id);
const cur = (s: ProgressStore) => currentChapter(CHAPTERS, s.data).id;

describe('ลำดับภารกิจหลัก 6 บท: 4 ตำบล → ร้านค้า → พญาจระเข้', () => {
  it('ลำดับและชนิดของบท', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['sakngam', 'level-2', 'level-3', 'level-4', SHOP_CHAPTER_ID, BOSS_CHAPTER_ID]);
    expect(CHAPTERS.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(CHAPTERS.map((c) => c.kind ?? 'level')).toEqual(['level', 'level', 'level', 'level', 'shop', 'boss']);
    expect(LEVELS.map((l) => l.unlocks)).toEqual(['level-2', 'level-3', 'level-4', 'shop']);
    expect(LEVEL_SEQUENCE).toHaveLength(4);
  });

  it('เริ่มเกมใหม่: บทที่ 1 เป็นบทปัจจุบัน · ข้ามบทเล่นไม่ได้', () => {
    const s = fresh();
    expect(cur(s)).toBe('sakngam');
    expect(canPlayLevel(CHAPTERS, s.data, 'level-3')).toBe(false);
    expect(canEnterLevel('level-2', s.data)).toBe(false);
    expect(chapterStates(CHAPTERS, s.data)['level-2']).toBe('next');
  });

  it('จบ 4 ด่าน → ร้านค้า → พญาจระเข้ → จบเกม (ไม่ย้อนเล่นด่านเดิม)', () => {
    const s = fresh();
    for (const id of ['sakngam', 'level-2', 'level-3', 'level-4']) {
      expect(cur(s)).toBe(id);
      expect(canPlayLevel(CHAPTERS, s.data, id)).toBe(true);
      finish(s, id);
      expect(canPlayLevel(CHAPTERS, s.data, id)).toBe(false);
    }
    expect(cur(s)).toBe(SHOP_CHAPTER_ID);
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'stage' });
    s.finishShop();
    expect(cur(s)).toBe(BOSS_CHAPTER_ID);
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'stage' });
    expect(isCampaignComplete(CHAPTERS, s.data)).toBe(false);
    s.finishBoss();
    expect(isCampaignComplete(CHAPTERS, s.data)).toBe(true);
    expect(continueTarget(CHAPTERS, s.data).kind).toBe('complete');
  });

  it('มีบันทึกกลางด่านปัจจุบัน → เล่นต่อจากบันทึก (flag/ตำแหน่งเดิม)', () => {
    const store = fresh();
    const session = newSession();
    const q = session.level.quizzes![0];
    talk(session, 'teacher-nem', [q.choices.findIndex((c) => c.id === q.correctChoiceId)]);
    store.saveInProgress(L1.id, session.toSnapshot());
    expect(continueTarget(CHAPTERS, store.data).kind).toBe('resume');
    const snap = store.loadInProgress(L1.id) as SessionSnapshot;
    expect(snap.flags).toContain('q-school');
  });

  it('ยังไม่เริ่มบทถัดไป (เพิ่งจบบทก่อน) → ฉากเชื่อมเรื่อง', () => {
    const s = fresh();
    finish(s, 'sakngam');
    expect(continueTarget(CHAPTERS, s.data)).toMatchObject({ kind: 'begin' });
  });
});

describe('ฉากเชื่อมบท: สั้น ไม่มีรหัสลับ/คำพิทักษ์/หีบ', () => {
  it('ทุกด่านมีฉากเชื่อม 1–2 บรรทัด เชื่อมจากบทก่อนหน้า', () => {
    expect(CHAPTER_INTROS.map((i) => i.chapterId)).toEqual(['sakngam', 'level-2', 'level-3', 'level-4']);
    expect(CHAPTER_INTROS.map((i) => i.fromChapterId)).toEqual([null, 'sakngam', 'level-2', 'level-3']);
    for (const i of CHAPTER_INTROS) {
      expect(i.lines.length).toBeLessThanOrEqual(2);
      for (const l of i.lines) {
        expect(l.text.length).toBeLessThanOrEqual(90);
        expect(l.text).not.toMatch(/\{\{code|คำพิทักษ์|รหัส|หีบ/);
      }
    }
    expect(getChapterIntro('sakngam')!.lines[0].text).toContain('เหรียญ');
  });
});

describe('Intro ตำนานพญาจระเข้ (3 ภาพก่อนเริ่มเกมใหม่)', () => {
  it('3 ฉาก · ข้อความทีละประโยคตามเรื่อง · มีภาพจริงใน public/intro', () => {
    expect(INTRO_SCENES).toHaveLength(3);
    expect(INTRO_SCENES.map((s) => s.sentences.join(' '))).toEqual([
      'กาลครั้งหนึ่ง คลองลานเคยเป็นดินแดนอันอุดมสมบูรณ์ ผู้คนและธรรมชาติอยู่ร่วมกันอย่างสงบสุข',
      'มนุษย์ทำลายป่าและสายน้ำ จนพญาจระเข้ผู้พิทักษ์ถูกพลังมลพิษครอบงำ',
      'เจ้าคือความหวังของคลองลาน จงรวบรวมพลังศรัทธาและช่วยปลดปล่อยผู้พิทักษ์!',
    ]);
    // ภาพอยู่ใน public/intro/ (ตรวจไฟล์จริงในการทดสอบเบราว์เซอร์)
    for (const s of INTRO_SCENES) expect(s.image).toMatch(/^intro\/scene[123]\.jpg$/);
  });
});
