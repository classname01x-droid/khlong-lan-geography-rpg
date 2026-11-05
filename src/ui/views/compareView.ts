import { SHEET_CHECKS } from '../../core/map/BaseMapCheck';
import type { GameSession } from '../../core/session/GameSession';
import { describeSheetProblem, SHEET_CHECK_LABEL } from '../format';

export const COMPARE_TITLE = 'เปรียบเทียบแผนที่ฐาน — ฉบับใดตรงกับหลักฐานจริง?';

/**
 * ข้อความหน้าเปรียบเทียบแผนที่ฐาน (หลักฐานที่มี + ผลการเลือก) — ใช้ร่วมกันระหว่าง CompareOverlay (canvas)
 * และหน้าอ่านบนจอสัมผัส · ข้อความว่าง '' = เว้นบรรทัด
 */
export function buildCompareLines(s: GameSession): { evidence: string[]; status: string[]; result: string[]; resultOk: boolean | null } {
  const evidence: string[] = [];
  const status: string[] = [];
  const result: string[] = [];
  const mc = s.level.mapComparison;
  const missing = s.comparisonMissing();
  const name = (id: string) => s.level.landmarks.find((l) => l.id === id)?.name ?? id;
  if (mc) {
    const elevOk = mc.requiredClueIds.every((id) => s.clues.includes(id));
    const obs = mc.requiredObservations.map((id) => `${name(id)} ${s.discoveredLandmarks.has(id) ? '●' : '○'}`).join('  ');
    evidence.push(
      `หลักฐานที่มี — ${SHEET_CHECK_LABEL.symbol}: ดูคำอธิบายบนแผนที่ (M) ●   ${SHEET_CHECK_LABEL.flow}: ${elevOk ? 'มีข้อมูลแล้ว ●' : 'ยังไม่มี ○'}`,
      `${SHEET_CHECK_LABEL.landmark}: ${obs}`,
    );
  }
  if (s.comparisonSolved && !s.lastCompare) {
    status.push(`วิเคราะห์แล้ว: แผนที่ฐานฉบับ ${s.verifiedSheetId()} ตรงกับหลักฐานทุกข้อ · Esc หรือ C ปิด`);
  } else if (!s.isComparisonOpen()) {
    status.push('ดูเปรียบเทียบได้ตลอด แต่จะตัดสินคำตอบได้ในฉาก 4 (หลังได้ข้อมูลระดับความสูงจากผู้ดูแลแหล่งน้ำ) · Esc ปิด');
  } else {
    status.push('แผนที่ฉบับใดถูกต้องตามหลักฐานทั้ง 3 ชนิด?   กด 1 หรือ 2 เพื่อเลือก · Esc หรือ C ปิด');
  }

  let resultOk: boolean | null = null;
  const r = s.lastCompare;
  if (r) {
    if (r.blocked === 'missing-evidence') {
      const parts: string[] = [];
      if (missing.observations.length) parts.push(`ต้องเดินไปดู ${missing.observations.map(name).join(' และ ')} ด้วยตัวเองก่อน`);
      if (missing.clues.length) parts.push('ต้องได้ข้อมูลระดับความสูงจากผู้ดูแลแหล่งน้ำก่อน');
      result.push(`ยังตัดสินไม่ได้ — ${parts.join(' · ')}`);
    } else if (!r.blocked || r.blocked === 'already-solved') {
      resultOk = r.ok;
      const chosenTitle = s.level.baseMaps?.find((m) => m.id === r.chosenId)?.title ?? '';
      result.push(r.ok ? `ถูกต้อง! ${chosenTitle} ผ่านหลักฐานทั้ง 3 ชนิด` : `ยังไม่ถูก — ${chosenTitle} ขัดกับหลักฐาน ลองดูอีกครั้ง`);
      for (const [id, rep] of Object.entries(r.reports)) {
        const marks = SHEET_CHECKS.map((c) => `${SHEET_CHECK_LABEL[c]} ${rep.failed.includes(c) ? '✗' : '✓'}`).join(' · ');
        result.push(`ฉบับ ${id}: ${marks}`);
        // อธิบายรายละเอียดของฉบับที่เลือก (ถ้าผิด) หรือฉบับที่ผิด (ถ้าเลือกถูก)
        if ((r.ok && rep.failed.length) || (!r.ok && id === r.chosenId)) {
          const texts = [...new Set(rep.problems.map(describeSheetProblem))];
          for (const t of texts.slice(0, 4)) result.push(`   • ${t}`);
        }
      }
    }
  }
  return { evidence, status, result, resultOk };
}
