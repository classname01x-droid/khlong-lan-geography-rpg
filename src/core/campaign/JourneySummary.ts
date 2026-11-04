import type { CodePiece, LevelResult, ProgressData } from '../progress/ProgressStore';

/**
 * สรุปผลการเรียนรู้ทั้งเกม — รวมจากผลที่บันทึกไว้จริงใน ProgressStore (ผลรอบแรกของแต่ละบท)
 * ค่าที่บันทึกรุ่นเก่าไม่มี (เช่น จำนวนหลักฐาน/ภารกิจ) จะไม่ถูกประมาณ: รายงานเป็น "ทราบจาก n บท" แทน
 */
export interface Known<T> {
  value: T;
  /** จำนวนบทที่มีข้อมูลนี้ */
  from: number;
  /** จำนวนบทที่จบแล้วทั้งหมด */
  of: number;
}

export interface JourneySummary {
  chapters: Array<{ id: string; result: LevelResult | null; code: CodePiece | null }>;
  completedCount: number;
  distanceMeters: Known<number>;
  elapsedMs: Known<number>;
  mistakes: Known<number>;
  quests: Known<{ done: number; total: number }> | null;
  evidence: Known<{ found: number; total: number }> | null;
  skills: string[];
  codes: Array<CodePiece | null>;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * @param chapterIds บททั้งหมดตามลำดับ (4 ตำบล + บทสรุป)
 * @param codeIds บทที่ให้รหัสลับ (4 ตำบล)
 */
export function summarizeJourney(chapterIds: readonly string[], codeIds: readonly string[], p: ProgressData): JourneySummary {
  const chapters = chapterIds.map((id) => ({ id, result: p.completed[id] ?? null, code: p.codePieces[id] ?? p.completed[id]?.codePiece ?? null }));
  const results = chapters.flatMap((c) => (c.result ? [c.result] : []));
  const of = results.length;
  const numeric = (pick: (r: LevelResult) => number | undefined): Known<number> => {
    const vals = results.map(pick).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    return { value: sum(vals), from: vals.length, of };
  };

  const withQuests = results.filter((r) => r.quests);
  const quests = withQuests.length
    ? {
        value: {
          done: sum(withQuests.flatMap((r) => Object.values(r.quests!).map((q) => q.done))),
          total: sum(withQuests.flatMap((r) => Object.values(r.quests!).map((q) => q.total))),
        },
        from: withQuests.length,
        of,
      }
    : null;
  const withEvidence = results.filter((r) => typeof r.evidenceFound === 'number' && typeof r.evidenceTotal === 'number');
  const evidence = withEvidence.length
    ? {
        value: { found: sum(withEvidence.map((r) => r.evidenceFound!)), total: sum(withEvidence.map((r) => r.evidenceTotal!)) },
        from: withEvidence.length,
        of,
      }
    : null;

  return {
    chapters,
    completedCount: of,
    distanceMeters: numeric((r) => r.distanceMeters),
    elapsedMs: numeric((r) => r.elapsedMs),
    mistakes: numeric((r) => r.mistakes),
    quests,
    evidence,
    skills: [...new Set(results.flatMap((r) => r.skills ?? []))],
    codes: codeIds.map((id) => p.codePieces[id] ?? p.completed[id]?.codePiece ?? null),
  };
}
