import { describe, expect, it } from 'vitest';
import { LEVEL_SEQUENCE } from '../src/content/registry';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { PROGRESS_KEY, ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const result = (over: Partial<LevelResult> = {}): LevelResult => ({
  levelId: 'sakngam',
  completedAt: '2026-11-04T00:00:00.000Z',
  distanceMeters: 1500,
  cluesFound: 5,
  cluesTotal: 5,
  mistakes: 1,
  elapsedMs: 300_000,
  skills: ['direction'],
  codePiece: { index: 1, total: 4, value: 'ลาย' },
  ...over,
});

describe('ProgressStore', () => {
  it('เริ่มต้นปลดล็อกเฉพาะด่านแรก', () => {
    const p = new ProgressStore(new MemoryStorage(), 'sakngam');
    expect(p.isUnlocked('sakngam')).toBe(true);
    expect(p.isUnlocked('level-2')).toBe(false);
    expect(p.isCompleted('sakngam')).toBe(false);
  });

  it('บันทึกการผ่านด่าน ปลดล็อกด่านถัดไป และโหลดกลับได้', () => {
    const storage = new MemoryStorage();
    new ProgressStore(storage, 'sakngam').completeLevel(result(), 'level-2');
    const reloaded = new ProgressStore(storage, 'sakngam');
    expect(reloaded.isCompleted('sakngam')).toBe(true);
    expect(reloaded.isUnlocked('level-2')).toBe(true);
    expect(reloaded.data.completed.sakngam.codePiece?.value).toBe('ลาย');
  });

  it('เล่นซ้ำไม่ทับผลรอบแรก และไม่ปลดล็อกซ้ำ', () => {
    const p = new ProgressStore(new MemoryStorage(), 'sakngam');
    p.completeLevel(result(), 'level-2');
    p.completeLevel(result({ mistakes: 9 }), 'level-2');
    expect(p.data.completed.sakngam.mistakes).toBe(1);
    expect(p.data.unlocked).toEqual(['sakngam', 'level-2']);
  });

  it('ข้อมูลเสียหรือ storage ใช้ไม่ได้ ยังเล่นต่อได้', () => {
    const bad = new MemoryStorage();
    bad.setItem(PROGRESS_KEY, '{not json');
    expect(new ProgressStore(bad, 'sakngam').isUnlocked('sakngam')).toBe(true);
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const p = new ProgressStore(throwing, 'sakngam');
    p.completeLevel(result(), 'level-2');
    expect(p.isUnlocked('level-2')).toBe(true);
    expect(new ProgressStore(null, 'sakngam').isUnlocked('sakngam')).toBe(true);
  });

  it('ด่านสักงามปลดล็อกด่านที่มีอยู่ในลำดับด่าน (Map 2 ยังเป็น planned)', () => {
    const slot = LEVEL_SEQUENCE.find((s) => s.id === sakNgamLevel.unlocks);
    expect(slot?.status).toBe('planned');
    expect(LEVEL_SEQUENCE[0].id).toBe(sakNgamLevel.id);
  });
});
