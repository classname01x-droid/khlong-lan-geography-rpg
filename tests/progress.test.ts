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

  it('ลำดับด่านรองรับ 4 ตำบล = รหัสลับ 4 ชิ้น และด่าน 1 มอบชิ้นที่ 1', () => {
    expect(LEVEL_SEQUENCE.map((s) => s.codePieceIndex)).toEqual([1, 2, 3, 4]);
    expect(sakNgamLevel.ending!.codePiece).toMatchObject({ index: 1, total: 4 });
  });

  it('ย้ายข้อมูลบันทึกรุ่น v1 เป็น v2 โดยไม่สูญหาย', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, completed: { sakngam: result() }, unlocked: ['sakngam', 'level-2'] }),
    );
    const p = new ProgressStore(storage, 'sakngam');
    expect(p.data.version).toBe(2);
    expect(p.isCompleted('sakngam')).toBe(true);
    expect(p.isUnlocked('level-2')).toBe(true);
    expect(p.collectedCodePieces()).toEqual([{ index: 1, total: 4, value: 'ลาย' }]);
  });

  it('บันทึก/โหลด/ล้าง การเล่นกลางด่าน และล้างอัตโนมัติเมื่อผ่านด่าน', () => {
    const storage = new MemoryStorage();
    const p = new ProgressStore(storage, 'sakngam');
    expect(p.loadInProgress('sakngam')).toBeNull();
    p.saveInProgress('sakngam', { step: 3 });
    expect(new ProgressStore(storage, 'sakngam').loadInProgress('sakngam')).toEqual({ step: 3 });
    p.completeLevel(result(), 'level-2');
    expect(new ProgressStore(storage, 'sakngam').loadInProgress('sakngam')).toBeNull();
    p.saveInProgress('sakngam', { step: 1 });
    p.clearInProgress('sakngam');
    expect(p.loadInProgress('sakngam')).toBeNull();
  });

  it('เก็บรหัสลับจากหลายตำบลเรียงตามลำดับชิ้น', () => {
    const p = new ProgressStore(new MemoryStorage(), 'sakngam');
    p.completeLevel(result({ levelId: 'level-3', codePiece: { index: 3, total: 4, value: 'C' } }));
    p.completeLevel(result());
    expect(p.collectedCodePieces().map((c) => c.index)).toEqual([1, 3]);
  });
});
