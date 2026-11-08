import { describe, expect, it } from 'vitest';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { canEnterLevel, getLevelSlot, isPlayableLevel, LEVEL_SEQUENCE, LEVELS } from '../src/content/registry';
import { describeLevel, levelState } from '../src/core/progress/LevelProgress';
import { PROGRESS_KEY, ProgressStore, type LevelResult, type StorageLike } from '../src/core/progress/ProgressStore';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SettingsStore } from '../src/core/settings/SettingsStore';
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

const result = (over: Partial<LevelResult> = {}): LevelResult => ({
  levelId: 'sakngam',
  completedAt: '2026-11-04T00:00:00.000Z',
  distanceMeters: 2300,
  cluesFound: 6,
  cluesTotal: 6,
  mistakes: 3,
  elapsedMs: 400_000,
  skills: [],
  codePiece: { index: 1, total: 4, value: 'ลาย' },
  evidenceFound: 2,
  evidenceTotal: 2,
  ...over,
});

const cards = (p: ProgressStore) =>
  LEVEL_SEQUENCE.map((s, i) =>
    describeLevel(s, p.data, i === 0, LEVELS.find((l) => l.id === s.id)?.evidence?.length ?? null),
  );

describe('ลำดับ 4 ตำบล และการกันเข้าด่านที่ยังไม่สร้าง', () => {
  it('มี 4 ตำบลตามลำดับ พร้อมชื่อภารกิจ', () => {
    expect(LEVEL_SEQUENCE.map((s) => `${s.tambon} — ${s.missionTitle}`)).toEqual([
      'ตำบลสักงาม — ปริศนาลวดลายแห่งสักงาม',
      'ตำบลคลองน้ำไหล — ปริศนาสายน้ำแห่งคลองน้ำไหล',
      'ตำบลโป่งน้ำร้อน — ปริศนาเมืองโบราณใต้ผืนดิน',
      'ตำบลคลองลานพัฒนา — ปริศนาแผนที่ลับแห่งคลองลานพัฒนา',
    ]);
    expect(LEVEL_SEQUENCE.map((s) => s.codePieceIndex)).toEqual([1, 2, 3, 4]);
  });

  it('เข้าได้เฉพาะด่านที่มีเนื้อหาจริง และปลดล็อกแล้ว', () => {
    expect(isPlayableLevel('sakngam')).toBe(true);
    expect(isPlayableLevel('level-2')).toBe(true); // ต้นแบบด่าน 2 มีเนื้อหาแล้ว
    expect(isPlayableLevel('level-3')).toBe(true); // ต้นแบบด่าน 3 มีเนื้อหาแล้ว
    expect(isPlayableLevel('level-4')).toBe(true); // ต้นแบบด่าน 4 มีเนื้อหาแล้ว
    const fresh = new ProgressStore(new MemoryStorage(), 'sakngam');
    expect(canEnterLevel('sakngam', fresh.data)).toBe(true);
    expect(canEnterLevel('level-2', fresh.data)).toBe(false); // ยังไม่จบด่าน 1
    fresh.completeLevel(result(), 'level-2');
    expect(canEnterLevel('level-2', fresh.data)).toBe(true);
    expect(canEnterLevel('level-3', fresh.data)).toBe(false); // ยังไม่จบด่าน 2
    expect(canEnterLevel('level-3', { ...fresh.data, unlocked: [...fresh.data.unlocked, 'level-3'] })).toBe(true);
    expect(canEnterLevel('level-4', fresh.data)).toBe(false); // ยังไม่จบด่าน 3
    expect(isPlayableLevel('nope')).toBe(false);
    expect(getLevelSlot(sakNgamLevel.unlocks!)?.id).toBe('level-2');
  });
});

describe('สถานะด่านในหน้าเลือกด่าน', () => {
  it('เริ่มเกมใหม่: ด่าน 1 ปลดล็อก ด่าน 2–4 ล็อก', () => {
    const c = cards(new ProgressStore(new MemoryStorage(), 'sakngam'));
    expect(c.map((x) => x.state)).toEqual(['unlocked', 'locked', 'locked', 'locked']);
    expect(c.map((x) => x.canEnter)).toEqual([true, false, false, false]);
    expect(c[0].evidenceText).toBe('หลักฐาน: 0/2');
    expect(c[1].evidenceText).toBe('หลักฐาน: 0/6');
    expect(c[2].evidenceText).toBe('หลักฐาน: 0/2');
    expect(c[3].evidenceText).toBe('หลักฐาน: 0/6');
  });

  it('ด่าน 1 เข้าได้เสมอ แม้ข้อมูลบันทึกไม่มีในรายการปลดล็อก', () => {
    const p = new ProgressStore(new MemoryStorage(), 'sakngam');
    p.data.unlocked.length = 0;
    expect(levelState(LEVEL_SEQUENCE[0], p.data, true)).toBe('unlocked');
  });

  it('มีบันทึกค้างกลางด่าน → ต้องถามเล่นต่อ/เริ่มใหม่ และแสดงหลักฐานที่พบแล้ว', () => {
    const p = new ProgressStore(new MemoryStorage(), 'sakngam');
    const s = newSession();
    talk(s, 'teacher-nem');
    p.saveInProgress('sakngam', s.toSnapshot());
    const c = cards(p)[0];
    expect(c.hasInProgress).toBe(true);
    expect(c.stateLabel).toBe('ปลดล็อกแล้ว · มีบันทึกค้างอยู่');
    expect(c.evidenceText).toBe('หลักฐาน: 0/2');
  });

  it('จบด่าน 1: ผ่านแล้ว + รหัสลับ, ด่าน 2 ปลดล็อกและเข้าได้, ด่าน 3–4 ยังล็อก', () => {
    const p = new ProgressStore(new MemoryStorage(), 'sakngam');
    p.completeLevel(result(), 'level-2');
    const c = cards(p);
    expect(c.map((x) => x.state)).toEqual(['completed', 'unlocked', 'locked', 'locked']);
    expect(c[1].stateLabel).toBe('ปลดล็อกแล้ว');
    expect(c.map((x) => x.canEnter)).toEqual([true, true, false, false]);
    expect(c[0].codePiece?.value).toBe('ลาย');
    expect(c[0].evidenceText).toBe('หลักฐาน: 2/2');
    expect(c[0].hasInProgress).toBe(false);
  });

  it('ข้อมูลบันทึก v1 (รุ่นแรก) ยังแสดงผลได้ แม้ไม่มีจำนวนหลักฐาน', () => {
    const storage = new MemoryStorage();
    const old = result();
    delete old.evidenceFound;
    delete old.evidenceTotal;
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, completed: { sakngam: old }, unlocked: ['sakngam', 'level-2'] }));
    const p = new ProgressStore(storage, 'sakngam');
    const c = cards(p);
    expect(c[0].state).toBe('completed');
    expect(c[0].evidenceText).toBe('หลักฐาน: ?/2');
    expect(c[0].codePiece?.value).toBe('ลาย');
    expect(c[1].state).toBe('unlocked'); // ข้อมูลเก่าที่ปลดล็อก level-2 ไว้ → เข้าด่าน 2 ได้ทันที
    expect(p.hasAnySave()).toBe(true);
    expect(p.continueLevelId()).toBeNull(); // ไม่มีด่านค้าง → "เล่นต่อ" พาไปหน้าเลือกด่าน
  });
});

describe('ปุ่ม "เล่นต่อ" และ "เริ่มเกมใหม่"', () => {
  it('ไม่มีบันทึก → เล่นต่อกดไม่ได้', () => {
    const p = new ProgressStore(new MemoryStorage(), 'sakngam');
    expect(p.hasAnySave()).toBe(false);
    expect(p.continueLevelId()).toBeNull();
  });

  it('เล่นต่อไปยังด่านที่เล่นล่าสุด (รองรับข้อมูล v2 เดิมที่ไม่มี lastLevelId)', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 2, completed: {}, unlocked: ['sakngam'], codePieces: {}, inProgress: { sakngam: {} } }),
    );
    const p = new ProgressStore(storage, 'sakngam');
    expect(p.hasAnySave()).toBe(true);
    expect(p.continueLevelId()).toBe('sakngam');
    p.saveInProgress('sakngam', { x: 1 });
    expect(new ProgressStore(storage, 'sakngam').data.lastLevelId).toBe('sakngam');
  });

  it('เริ่มเกมใหม่ลบความคืบหน้าทั้งหมด แต่ไม่ลบการตั้งค่า', () => {
    const storage = new MemoryStorage();
    const settings = new SettingsStore(storage);
    settings.update({ showControlsHint: false });
    const p = new ProgressStore(storage, 'sakngam');
    p.completeLevel(result(), 'level-2');
    p.saveInProgress('sakngam', { x: 1 });
    p.resetAll();
    const reloaded = new ProgressStore(storage, 'sakngam');
    expect(reloaded.hasAnySave()).toBe(false);
    expect(reloaded.data.unlocked).toEqual(['sakngam']);
    expect(reloaded.collectedCodePieces()).toEqual([]);
    expect(new SettingsStore(storage).settings.showControlsHint).toBe(false);
  });
});

describe('SettingsStore', () => {
  it('ค่าเริ่มต้น บันทึก และโหลดกลับ', () => {
    const storage = new MemoryStorage();
    expect(new SettingsStore(storage).settings).toEqual(DEFAULT_SETTINGS);
    new SettingsStore(storage).update({ soundEnabled: false });
    expect(new SettingsStore(storage).settings).toEqual({ soundEnabled: false, showControlsHint: true });
  });

  it('ข้อมูลเสียหรือ storage ใช้ไม่ได้ → ใช้ค่าเริ่มต้น', () => {
    const bad = new MemoryStorage();
    bad.setItem(SETTINGS_KEY, '{oops');
    expect(new SettingsStore(bad).settings).toEqual(DEFAULT_SETTINGS);
    bad.setItem(SETTINGS_KEY, JSON.stringify({ soundEnabled: 'yes' }));
    expect(new SettingsStore(bad).settings.soundEnabled).toBe(true);
    const s = new SettingsStore(null);
    expect(s.update({ showControlsHint: false }).showControlsHint).toBe(false);
  });
});
