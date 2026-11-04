import { THAI_DIRECTION } from '../direction/Compass';
import type { GameSession, GridChoiceResult } from '../session/GameSession';
import { GridSystem } from '../world/GridSystem';
import type { GridSiteCheck } from './GridSiteAnalysis';

/**
 * ข้อความของกระดานวิเคราะห์พิกัด (ฉาก 4) — แยกจาก UI เพื่อทดสอบได้
 * ก่อนผู้เล่นกดยืนยัน แสดงเฉพาะ "ข้อมูล" (ไม่มีเครื่องหมายถูก/ผิด) · หลังยืนยันจึงอธิบายผลจาก GameSession.chooseGridSite
 * ทุกตัวเลขคำนวณจากแผนที่และข้อมูลบันทึกของด่าน ไม่ได้เขียนคำตอบไว้ในโค้ด
 */

export const GRID_CHECK_LABEL: Record<GridSiteCheck, string> = {
  grid: 'พิกัดกริด',
  relative: 'ทิศและระยะจากจุดอ้างอิง',
  field: 'หลักฐานภาคสนาม',
};

export interface GridBoardCandidate {
  key: number;
  label: string;
  name: string;
  surveyed: boolean;
  /** ข้อมูลที่ผู้เล่นเก็บได้จากการสำรวจ (ว่างถ้ายังไม่ได้สำรวจ) */
  facts: string[];
  selected: boolean;
}

export interface GridBoardView {
  /** หลักฐานจากบันทึกและเบาะแส */
  evidence: string[];
  candidates: GridBoardCandidate[];
  /** สถานะ / วิธีใช้ */
  status: string[];
  /** ผลหลังกดยืนยัน (ว่างถ้ายังไม่ได้ยืนยัน) */
  result: string[];
  resultTone: 'none' | 'ok' | 'wrong' | 'blocked';
}

const meters10 = (m: number) => `${(Math.round(m / 10) * 10).toLocaleString('en-US')} ม.`;

export function buildGridBoard(s: GameSession): GridBoardView | null {
  const ga = s.level.gridSiteAnalysis;
  const g = s.coords;
  const ev = s.gridSiteEvidence();
  if (!ga || !g || !ev) return null;
  const fmt = GridSystem.format;
  const lm = (id: string) => s.level.landmarks.find((l) => l.id === id);
  const fromName = lm(ga.relative.fromId)?.name ?? ga.relative.fromId;
  const corrected = s.gridCorrectedRecord()!;
  const topRowN = g.tileToGrid({ x: 0, y: 0 }).n;

  const evidence = [`บันทึกพิกัดเก่า (ตามที่เขียน): ${fmt(ga.record)}`];
  if (ga.recordConvention === 'top-counted') {
    evidence.push(
      `พิกัดที่แก้ไขแล้ว: ${fmt(corrected)}`,
      `   (บันทึกนับ N จากขอบบน → N = ${topRowN.toLocaleString('en-US')} − (${ga.record.n.toLocaleString('en-US')} − ${g.def.falseNorthing.toLocaleString('en-US')}) = ${corrected.n.toLocaleString('en-US')})`,
    );
  } else {
    evidence.push(`พิกัดที่แก้ไขแล้ว: ${fmt(corrected)} (บันทึกนับถูกวิธีอยู่แล้ว)`);
  }
  const from = lm(ga.relative.fromId);
  evidence.push(
    `${fromName}: ${from ? fmt(g.tileToGrid(from.at)) : '-'}`,
    `ทิศและระยะในบันทึก: จาก${fromName} ไปทาง${THAI_DIRECTION[ga.relative.direction]} ราว ${ga.relative.meters} ม.`,
    `หลักฐานภาคสนามที่ต้องพบ: ${ga.requiredFeatures.map((f) => ga.featureLabels[f] ?? f).join(' และ ')}`,
  );

  const rows = new Map(s.evaluateGridSites().map((r) => [r.landmarkId, r.report]));
  const candidates: GridBoardCandidate[] = ga.candidates.map((c, i) => {
    const l = lm(c.landmarkId)!;
    const surveyed = !c.evidenceId || s.evidence.includes(c.evidenceId);
    const rep = rows.get(c.landmarkId)!;
    const found = (l.features ?? []).map((f) => ga.featureLabels[f] ?? f);
    return {
      key: i + 1,
      label: c.label,
      name: l.name,
      surveyed,
      selected: s.gridSelection === i,
      facts: surveyed
        ? [
            `พิกัด ${fmt(g.tileToGrid(l.at))}`,
            `จาก${fromName}: ทาง${THAI_DIRECTION[rep.actualDirection]} ~${meters10(rep.actualMeters)}`,
            `สิ่งที่พบ: ${found.length ? found.join(', ') : '-'}`,
          ]
        : ['ยังไม่ได้สำรวจ — เดินไปกด E ที่จุดนั้นก่อน'],
    };
  });

  const status: string[] = [];
  const attempts = s.gridAttempts;
  if (s.gridCheckSolved) {
    const okAt = attempts.find((a) => a.ok);
    const label = ga.candidates.find((c) => c.landmarkId === okAt?.landmarkId)?.label ?? '';
    status.push(`วิเคราะห์แล้ว: ${label} ตรงกับหลักฐานครบทั้ง 3 ชนิด · เปิดอ่านย้อนหลังได้ตลอด · Esc หรือ C ปิด`);
  } else if (!s.isGridCheckOpen()) {
    status.push('ดูข้อมูลได้ แต่จะยืนยันคำตอบได้หลังฟังเบาะแสจากผู้เก็บบันทึก (ฉาก 4) · Esc ปิด');
  } else if (s.gridSelection === null) {
    status.push('จุดใดตรงกับหลักฐานครบทั้ง 3 ชนิด? กดเลข 1–3 เพื่อเลือก · Esc หรือ C ปิด');
  } else {
    status.push(`เลือก ${ga.candidates[s.gridSelection].label} — กด Enter เพื่อยืนยัน หรือกดเลขอื่นเพื่อเปลี่ยน`);
  }
  const wrong = s.mistakes.compare;
  const history = attempts.map((a) => `${ga.candidates.find((c) => c.landmarkId === a.landmarkId)?.label ?? a.landmarkId} ${a.ok ? '✓' : '✗'}`);
  status.push(`ตอบผิดแล้ว ${wrong} ครั้ง${history.length ? ` · ประวัติ: ${history.join(' → ')}` : ''}`);

  const r = s.lastGridChoice;
  const explained = r ? explainGridChoice(s, r) : null;
  return {
    evidence,
    candidates,
    status,
    result: explained?.lines ?? [],
    resultTone: explained?.tone ?? 'none',
  };
}

/**
 * อธิบายผลการเลือกจุด — ถ้าผิด บอกเฉพาะหลักฐานที่ขัดแย้งของจุดที่เลือก พร้อมคำใบ้ (ไม่บอกว่าจุดใดถูก)
 * ถ้าถูก สรุปเหตุผลจากข้อมูลจริงครบ 3 ข้อ
 */
export function explainGridChoice(
  s: GameSession,
  r: GridChoiceResult,
): { tone: 'ok' | 'wrong' | 'blocked'; lines: string[] } {
  const ga = s.level.gridSiteAnalysis!;
  const g = s.coords!;
  const fmt = GridSystem.format;
  const cand = ga.candidates.find((c) => c.landmarkId === r.chosenId);
  const label = cand?.label ?? '';
  const fromName = s.level.landmarks.find((l) => l.id === ga.relative.fromId)?.name ?? ga.relative.fromId;
  const corrected = s.gridCorrectedRecord()!;

  if (r.blocked === 'not-available') {
    return { tone: 'blocked', lines: ['ยังยืนยันไม่ได้ — ต้องฟังเบาะแสจากผู้เก็บบันทึกให้ครบก่อน (ไม่นับเป็นการตอบผิด)'] };
  }
  if (r.blocked === 'missing-evidence') {
    const lines = ['ยังยืนยันไม่ได้ (ไม่นับเป็นการตอบผิด):'];
    if (r.missingClues.length) lines.push(`• ยังขาดเบาะแส ${r.missingClues.length} ข้อจากผู้เก็บบันทึก`);
    for (const id of r.notSurveyed) {
      const lab = ga.candidates.find((c) => c.landmarkId === id)?.label ?? id;
      lines.push(`• ต้องเดินไปสำรวจ ${lab} ด้วยตัวเองก่อน (กด E ที่จุดนั้น) จึงจะรู้ว่ามีอะไรอยู่จริง`);
    }
    return { tone: 'blocked', lines };
  }

  const rep = r.chosenId ? r.reports[r.chosenId] : undefined;
  const at = r.chosenId ? s.landmarkPoints[r.chosenId] : undefined;
  if (!rep || !at) return { tone: 'blocked', lines: [] };
  const site = g.tileToGrid(at);
  const feats = s.level.landmarks.find((l) => l.id === r.chosenId)?.features ?? [];
  const relText = `จาก${fromName} ${label} อยู่ทาง${THAI_DIRECTION[rep.actualDirection]} ~${meters10(rep.actualMeters)}`;
  const recText = `ทาง${THAI_DIRECTION[ga.relative.direction]} ราว ${ga.relative.meters} ม.`;

  if (r.ok) {
    return {
      tone: 'ok',
      lines: [
        `ถูกต้อง! ${label} ตรงกับหลักฐานครบทั้ง 3 ชนิด`,
        `① ${GRID_CHECK_LABEL.grid}: ${label} อยู่ที่ ${fmt(site)} ตรงกับบันทึกที่แก้ไขแล้ว (${fmt(corrected)})`,
        `② ${GRID_CHECK_LABEL.relative}: ${relText} ตรงกับบันทึก (${recText})`,
        `③ ${GRID_CHECK_LABEL.field}: พบ${ga.requiredFeatures.map((f) => ga.featureLabels[f] ?? f).join('และ')}ครบตามบันทึก`,
        `ฉาก 5: เดินไปยืนยันที่ ${label} (กด E) แล้วเปิดแผนที่ (M) เพื่อปักหมุด`,
      ],
    };
  }

  const lines = [`ยังไม่ถูก — ${label} ขัดกับหลักฐาน ${rep.failed.length} ชนิด:`];
  if (rep.failed.includes('grid')) {
    const literal = g.gridToTile(ga.record);
    const matchesLiteral = Math.hypot(at.x - literal.x, at.y - literal.y) <= ga.toleranceTiles;
    lines.push(
      `✗ ${GRID_CHECK_LABEL.grid}: ${label} อยู่ที่ ${fmt(site)} แต่บันทึกที่แก้ไขแล้วคือ ${fmt(corrected)}` +
        (matchesLiteral ? ' (ตรงกับตัวเลขในบันทึกเฉพาะเมื่ออ่านตามที่เขียน โดยไม่แก้การนับ N)' : ''),
    );
  }
  if (rep.failed.includes('relative')) lines.push(`✗ ${GRID_CHECK_LABEL.relative}: ${relText} แต่บันทึกบอก${recText}`);
  if (rep.failed.includes('field')) {
    const missing = rep.missingFeatures.map((f) => ga.featureLabels[f] ?? f).join('และ');
    lines.push(`✗ ${GRID_CHECK_LABEL.field}: ไม่พบ${missing}ที่ ${label}`);
  }
  // ข้อที่ตรง (ให้เห็นว่าทำไมจุดนี้ดูเหมือนคำตอบ)
  const passed = (['grid', 'relative', 'field'] as const).filter((c) => !rep.failed.includes(c));
  if (passed.length) lines.push(`ข้อที่ตรง: ${passed.map((c) => GRID_CHECK_LABEL[c]).join(', ')} — แต่ยังไม่ครบทุกชนิด`);
  else if (feats.length) lines.push('จุดนี้ไม่ตรงหลักฐานชนิดใดเลย');
  lines.push(`คำใบ้: ${gridHint(rep.failed)}`);
  return { tone: 'wrong', lines };
}

/** คำใบ้ตามหลักฐานแรกที่ขัดแย้ง — ไม่ระบุว่าจุดใดถูก */
export function gridHint(failed: GridSiteCheck[]): string {
  if (failed.includes('grid')) return 'ตรวจว่าแปลงค่า N ในบันทึกแล้วหรือยัง (N ต้องเพิ่มไปทางเหนือ) แล้วเทียบกับพิกัดของจุดที่สำรวจ';
  if (failed.includes('relative')) return 'วัดทิศและระยะจากจุดอ้างอิงอีกครั้ง จุดที่ถูกต้องต้องอยู่ทั้งทิศและระยะตามบันทึก';
  return 'จุดที่ถูกต้องต้องมีสิ่งที่บันทึกบอกครบทุกอย่าง ไม่ใช่แค่บางอย่าง — ลองสำรวจจุดอื่นที่ยังไม่ได้ตรวจ';
}
