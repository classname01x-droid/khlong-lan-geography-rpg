/**
 * บันทึกความคืบหน้าข้ามการเล่น (ด่านที่ผ่าน และด่านที่ปลดล็อก)
 * รับ storage แบบ localStorage — ถ้าใช้ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) จะเก็บในหน่วยความจำแทน
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LevelResult {
  levelId: string;
  completedAt: string;
  distanceMeters: number;
  cluesFound: number;
  cluesTotal: number;
  mistakes: number;
  elapsedMs: number;
  skills: string[];
  codePiece: { index: number; total: number; value: string } | null;
}

export interface ProgressData {
  version: 1;
  completed: Record<string, LevelResult>;
  unlocked: string[];
}

export const PROGRESS_KEY = 'khlonglan-geo-rpg:progress';

function emptyProgress(firstLevelId: string): ProgressData {
  return { version: 1, completed: {}, unlocked: [firstLevelId] };
}

export class ProgressStore {
  private memory: ProgressData;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly firstLevelId: string,
  ) {
    this.memory = this.read();
  }

  private read(): ProgressData {
    try {
      const raw = this.storage?.getItem(PROGRESS_KEY);
      if (raw) {
        const data = JSON.parse(raw) as ProgressData;
        if (data && data.version === 1 && Array.isArray(data.unlocked) && data.completed) return data;
      }
    } catch {
      /* ข้อมูลเสีย/อ่านไม่ได้ → เริ่มใหม่ */
    }
    return emptyProgress(this.firstLevelId);
  }

  private write(): void {
    try {
      this.storage?.setItem(PROGRESS_KEY, JSON.stringify(this.memory));
    } catch {
      /* เขียนไม่ได้ → ใช้ค่าในหน่วยความจำต่อไป */
    }
  }

  get data(): ProgressData {
    return this.memory;
  }

  isUnlocked(levelId: string): boolean {
    return this.memory.unlocked.includes(levelId);
  }

  isCompleted(levelId: string): boolean {
    return levelId in this.memory.completed;
  }

  /** บันทึกผลการผ่านด่าน และปลดล็อกด่านถัดไป (ถ้ามี) — เก็บผลรอบแรกที่ผ่านไว้ ถ้าเล่นซ้ำจะไม่ทับ */
  completeLevel(result: LevelResult, unlockLevelId?: string): ProgressData {
    if (!this.memory.completed[result.levelId]) this.memory.completed[result.levelId] = result;
    if (unlockLevelId && !this.memory.unlocked.includes(unlockLevelId)) this.memory.unlocked.push(unlockLevelId);
    this.write();
    return this.memory;
  }
}

/** localStorage ของเบราว์เซอร์ (หรือ null ถ้าเข้าถึงไม่ได้) */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
