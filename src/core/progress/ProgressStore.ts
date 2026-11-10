/**
 * บันทึกความคืบหน้าของผู้เล่นข้ามการเล่น — ออกแบบให้รองรับทั้ง 4 ตำบล
 *   - completed : ผลการผ่านแต่ละด่าน (เก็บผลรอบแรก)
 *   - unlocked  : ด่านที่ปลดล็อกแล้ว
 *   - codePieces: รหัสลับที่เก็บได้จากแต่ละตำบล (ใช้รวมรหัสตอนจบเกม)
 *   - inProgress: สถานะการเล่นกลางด่าน (เล่นต่อได้หลังปิดเบราว์เซอร์)
 * รับ storage แบบ localStorage — ถ้าใช้ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) จะเก็บในหน่วยความจำแทน
 */
import { parseTutorialSave, type TutorialSave } from '../tutorial/Tutorial';
import { BOSS_HP_BONUS_CAP, buy as buyItem, canBuy, earnReward, emptyRpg, sanitizeRpg, type BuyResult, type RpgState } from '../rpg/Economy';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CodePiece {
  index: number;
  total: number;
  value: string;
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
  codePiece: CodePiece | null;
  /** จำนวนภารกิจที่สำเร็จ แยกตามประเภท (เพิ่มใน v2) */
  quests?: Record<string, { done: number; total: number }>;
  /** จำนวนหลักฐานที่พบ / ทั้งหมด (เพิ่มใน v0.4 — ข้อมูลเก่าไม่มีค่านี้) */
  evidenceFound?: number;
  evidenceTotal?: number;
}

export interface ProgressData {
  version: 2;
  completed: Record<string, LevelResult>;
  unlocked: string[];
  codePieces: Record<string, CodePiece>;
  inProgress: Record<string, unknown>;
  /** ด่านที่เล่นล่าสุด (ใช้กับปุ่ม "เล่นต่อ" — ข้อมูลเก่าอาจไม่มี) */
  lastLevelId?: string;
  /** สถานะบทแนะนำผู้เล่นใหม่ (เพิ่มใน v0.15 — ข้อมูลเก่าไม่มีช่องนี้ ยังเป็น version 2 เหมือนเดิม) */
  tutorial?: TutorialSave;
  /** รุ่นเนื้อเรื่อง (v0.22 = 3: ตำนานพญาจระเข้) — บันทึกรุ่นก่อนหน้าถูกสำรองไว้แล้วเริ่มใหม่อย่างปลอดภัย */
  storyVersion?: number;
  /** เหรียญ พลังศรัทธา อุปกรณ์ Golden Time (ข้อมูลเก่าไม่มี = ค่าเริ่มต้น) */
  rpg?: RpgState;
}

export const PROGRESS_KEY = 'khlonglan-geo-rpg:progress';
/** สำรองบันทึกรุ่นเก่าไว้ที่นี่เมื่อเนื้อเรื่องเปลี่ยน (ไม่ลบข้อมูลผู้เล่น) */
export const LEGACY_PROGRESS_KEY = `${PROGRESS_KEY}:legacy-story-2`;
export const STORY_VERSION = 3;

function emptyProgress(firstLevelId: string): ProgressData {
  return { version: 2, completed: {}, unlocked: [firstLevelId], codePieces: {}, inProgress: {}, storyVersion: STORY_VERSION, rpg: emptyRpg() };
}

/** แปลงข้อมูลรุ่นเก่า (v1: completed + unlocked) เป็นรุ่นปัจจุบัน */
function migrate(raw: unknown, firstLevelId: string): ProgressData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.unlocked) || typeof d.completed !== 'object' || d.completed === null) return null;
  const completed = d.completed as Record<string, LevelResult>;
  if (d.version === 1) {
    const codePieces: Record<string, CodePiece> = {};
    for (const [id, r] of Object.entries(completed)) if (r?.codePiece) codePieces[id] = r.codePiece;
    return { version: 2, completed, unlocked: d.unlocked as string[], codePieces, inProgress: {} };
  }
  if (d.version === 2) {
    const data = d as unknown as ProgressData;
    return {
      ...emptyProgress(firstLevelId),
      ...data,
      codePieces: data.codePieces ?? {},
      inProgress: data.inProgress ?? {},
      // ไม่รับค่าเริ่มต้นของรุ่นปัจจุบันแทนบันทึกเก่า: ไม่มี storyVersion = เนื้อเรื่องเก่า
      storyVersion: data.storyVersion,
    };
  }
  return null;
}

export class ProgressStore {
  private memory: ProgressData;
  /** true = เพิ่งพบบันทึกเนื้อเรื่องเก่าและเริ่มใหม่ (เมนูแจ้งผู้เล่นหนึ่งครั้ง) */
  legacyReset = false;

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
        const data = migrate(JSON.parse(raw), this.firstLevelId);
        if (data) {
          if (data.storyVersion === STORY_VERSION) return { ...data, rpg: sanitizeRpg(data.rpg) };
          // เนื้อเรื่องเก่า (หีบสมบัติ): สำรองไว้ แล้วเริ่มใหม่ — คงสถานะบทแนะนำเดิม ไม่ให้เกมค้างหรือข้ามด่านด้วยข้อมูลที่ไม่ตรงกับเนื้อเรื่องใหม่
          const had = Object.keys(data.completed).length > 0 || Object.keys(data.inProgress ?? {}).length > 0;
          if (had) {
            try {
              if (!this.storage?.getItem(LEGACY_PROGRESS_KEY)) this.storage?.setItem(LEGACY_PROGRESS_KEY, raw);
            } catch {
              /* สำรองไม่ได้ก็ไปต่อ */
            }
            this.legacyReset = true;
          }
          const fresh = emptyProgress(this.firstLevelId);
          if (data.tutorial) fresh.tutorial = data.tutorial;
          return fresh;
        }
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

  /**
   * บันทึกผลการผ่านด่าน เก็บรหัสลับ และปลดล็อกด่านถัดไป (ถ้ามี)
   * เก็บผลรอบแรกที่ผ่านไว้ ถ้าเล่นซ้ำจะไม่ทับ และล้างสถานะกลางด่านของด่านนั้น
   */
  completeLevel(result: LevelResult, unlockLevelId?: string): ProgressData {
    if (!this.memory.completed[result.levelId]) this.memory.completed[result.levelId] = result;
    if (result.codePiece && !this.memory.codePieces[result.levelId]) {
      this.memory.codePieces[result.levelId] = result.codePiece;
    }
    if (unlockLevelId && !this.memory.unlocked.includes(unlockLevelId)) this.memory.unlocked.push(unlockLevelId);
    delete this.memory.inProgress[result.levelId];
    this.write();
    return this.memory;
  }

  /** รหัสลับที่เก็บได้ เรียงตามลำดับชิ้น */
  collectedCodePieces(): CodePiece[] {
    return Object.values(this.memory.codePieces).sort((a, b) => a.index - b.index);
  }

  saveInProgress(levelId: string, snapshot: unknown): void {
    this.memory.inProgress[levelId] = snapshot;
    this.memory.lastLevelId = levelId;
    this.write();
  }

  /** มีข้อมูลบันทึกจริงหรือไม่ (ด่านที่ผ่านแล้ว หรือการเล่นกลางด่าน) */
  hasAnySave(): boolean {
    return Object.keys(this.memory.completed).length > 0 || Object.keys(this.memory.inProgress).length > 0 || this.rpg.goldenDone;
  }

  /** เหรียญ/ศรัทธา/อุปกรณ์ (อ่านอย่างเดียว — แก้ผ่านเมธอดด้านล่างเพื่อบันทึกทุกครั้ง) */
  get rpg(): RpgState {
    return (this.memory.rpg ??= emptyRpg());
  }

  /** รางวัลภารกิจ: ครั้งแรกต่อรหัสเท่านั้น — true = ได้รางวัลครั้งนี้ */
  earn(id: string, coins: number, faith: number): boolean {
    const ok = earnReward(this.rpg, id, coins, faith);
    if (ok) this.write();
    return ok;
  }

  buy(id: string): BuyResult {
    const r = buyItem(this.rpg, id);
    if (r === 'ok') this.write();
    return r;
  }

  canBuy(id: string): BuyResult {
    return canBuy(this.rpg, id);
  }

  /** จบ Golden Time: เก็บเหรียญที่ได้ และจดว่าเล่นแล้ว (เข้าได้ครั้งเดียวต่อเกมใหม่) */
  finishGolden(coins: number): void {
    const r = this.rpg;
    if (r.goldenDone) return;
    r.goldenDone = true;
    r.goldenCoins = coins;
    r.coins += Math.max(0, coins);
    this.write();
  }

  finishShop(): void {
    this.rpg.shopDone = true;
    this.write();
  }

  /** แพ้พญาจระเข้ (นับเพื่อผ่อนแรงบอสเล็กน้อย) */
  bossLost(): void {
    this.rpg.bossLosses = Math.min(5, this.rpg.bossLosses + 1);
    this.write();
  }

  /** ตอบคำถามแนะนำผิด → HP พญาจระเข้เพิ่ม (รวมไม่เกิน cap) — คืนจำนวนที่เพิ่มจริง · บันทึกทันที */
  addBossHp(amount: number, cap: number): number {
    const r = this.rpg;
    const add = Math.max(0, Math.min(amount, Math.min(cap, BOSS_HP_BONUS_CAP) - r.bossHpBonus));
    if (add > 0) {
      r.bossHpBonus += add;
      this.write();
    }
    return add;
  }

  finishBoss(): void {
    this.rpg.bossDone = true;
    this.write();
  }

  /** บันทึกค่า rpg ที่ถูกแก้โดยตรง (เช่น ยา/ศรัทธาที่เหลือหลังชนะบอส) */
  saveRpg(): void {
    this.write();
  }

  /** ด่านที่ควร "เล่นต่อ": ด่านล่าสุดที่ยังเล่นค้าง หรือด่านค้างด่านแรกที่พบ (ข้อมูลเก่าไม่มี lastLevelId) */
  continueLevelId(): string | null {
    const ids = Object.keys(this.memory.inProgress);
    if (this.memory.lastLevelId && ids.includes(this.memory.lastLevelId)) return this.memory.lastLevelId;
    return ids[0] ?? null;
  }

  /** ลบความคืบหน้าทั้งหมด (ใช้กับ "เริ่มเกมใหม่" หลังผู้เล่นยืนยันแล้ว) */
  resetAll(): void {
    this.memory = emptyProgress(this.firstLevelId);
    this.legacyReset = false;
    this.write();
  }

  /** สถานะบทแนะนำที่บันทึกไว้ (ไม่มี/ข้อมูลเสีย = null) */
  tutorialSave(): TutorialSave | null {
    return parseTutorialSave(this.memory.tutorial);
  }

  saveTutorial(t: TutorialSave): void {
    this.memory.tutorial = t;
    this.write();
  }

  loadInProgress(levelId: string): unknown {
    return this.memory.inProgress[levelId] ?? null;
  }

  clearInProgress(levelId: string): void {
    if (!(levelId in this.memory.inProgress)) return;
    delete this.memory.inProgress[levelId];
    this.write();
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
