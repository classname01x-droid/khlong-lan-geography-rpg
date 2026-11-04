import type { CodePiece, LevelResult, ProgressData } from './ProgressStore';

/**
 * สถานะของแต่ละด่านสำหรับหน้าเลือกด่าน — คำนวณจากข้อมูลบันทึกล้วน ๆ (ทดสอบได้)
 *
 *   locked          ยังไม่ปลดล็อก
 *   unlocked        ปลดล็อกแล้ว เข้าเล่นได้
 *   in-development  ปลดล็อกแล้ว แต่ยังไม่มีเนื้อหาด่าน → ห้ามเข้า
 *   completed       ผ่านแล้ว (เข้าเล่นซ้ำได้)
 */
export type LevelState = 'locked' | 'unlocked' | 'in-development' | 'completed';

export interface LevelSlotInfo {
  id: string;
  status: 'available' | 'planned';
  codePieceIndex: number;
}

export interface LevelCardModel {
  id: string;
  state: LevelState;
  stateLabel: string;
  /** กดปุ่มเข้าสู่ด่านได้หรือไม่ */
  canEnter: boolean;
  /** มีการเล่นค้างกลางด่าน → ต้องถามว่าจะเล่นต่อหรือเริ่มใหม่ */
  hasInProgress: boolean;
  evidenceText: string;
  codePiece: CodePiece | null;
  result: LevelResult | null;
}

export const LEVEL_STATE_LABEL: Record<LevelState, string> = {
  locked: 'ล็อก',
  unlocked: 'ปลดล็อกแล้ว',
  'in-development': 'ปลดล็อกแล้ว — อยู่ระหว่างพัฒนา',
  completed: 'ผ่านแล้ว',
};

export function levelState(slot: LevelSlotInfo, progress: ProgressData, isFirst: boolean): LevelState {
  const unlocked = isFirst || progress.unlocked.includes(slot.id);
  if (!unlocked) return 'locked';
  if (slot.status === 'planned') return 'in-development';
  return slot.id in progress.completed ? 'completed' : 'unlocked';
}

/** อ่านจำนวนหลักฐานจาก snapshot กลางด่าน (ไม่ผูกกับรูปแบบภายในของ GameSession มากเกินไป) */
function inProgressEvidence(snapshot: unknown): number | null {
  const ev = (snapshot as { evidence?: unknown } | null)?.evidence;
  return Array.isArray(ev) ? ev.length : null;
}

/**
 * สร้างข้อมูลการ์ดของด่าน
 * @param evidenceTotal จำนวนหลักฐานทั้งหมดของด่าน (null = ยังไม่มีเนื้อหาด่าน)
 */
export function describeLevel(
  slot: LevelSlotInfo,
  progress: ProgressData,
  isFirst: boolean,
  evidenceTotal: number | null,
): LevelCardModel {
  const state = levelState(slot, progress, isFirst);
  const result = progress.completed[slot.id] ?? null;
  const snapshot = progress.inProgress[slot.id] ?? null;
  const hasInProgress = snapshot !== null && slot.status === 'available';

  let evidenceText = 'หลักฐาน: —';
  if (evidenceTotal !== null) {
    const live = hasInProgress ? inProgressEvidence(snapshot) : null;
    // ยังไม่เคยเล่น = 0 · ผลจากข้อมูลบันทึกรุ่นเก่าที่ไม่มีจำนวนหลักฐาน = ไม่ทราบ (?)
    const found = live ?? (result ? (result.evidenceFound ?? null) : 0);
    const total = result?.evidenceTotal ?? evidenceTotal;
    evidenceText = found === null ? `หลักฐาน: ?/${total}` : `หลักฐาน: ${found}/${total}`;
  }

  return {
    id: slot.id,
    state,
    stateLabel: hasInProgress && state !== 'locked' ? `${LEVEL_STATE_LABEL[state]} · มีบันทึกค้างอยู่` : LEVEL_STATE_LABEL[state],
    canEnter: state === 'unlocked' || state === 'completed',
    hasInProgress,
    evidenceText,
    codePiece: progress.codePieces[slot.id] ?? result?.codePiece ?? null,
    result,
  };
}
