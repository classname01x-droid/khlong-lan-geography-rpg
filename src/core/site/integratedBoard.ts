import { THAI_DIRECTION } from '../direction/Compass';
import type { GameSession, IntegratedChoiceResult } from '../session/GameSession';
import { GridSystem } from '../world/GridSystem';
import type { GridBoardCandidate, GridBoardView } from './gridBoard';
import type { IntegratedCheck, IntegratedReport, SiteFacts } from './IntegratedSiteAnalysis';

/**
 * ข้อความกระดานวิเคราะห์หลักฐานรวม (ด่านสุดท้าย ฉาก 5) — ใช้หน้าจอเดียวกับกระดานวิเคราะห์พิกัด (GridBoardOverlay)
 * ก่อนกดยืนยันแสดงเฉพาะข้อมูล ไม่มีเครื่องหมายถูก/ผิด · หลังยืนยันอธิบายผลจาก GameSession.chooseIntegratedSite
 */
export const INTEGRATED_CHECK_LABEL: Record<IntegratedCheck, string> = {
  distance: 'ทิศและระยะทาง',
  terrain: 'ภูมิประเทศและสัญลักษณ์แผนที่',
  grid: 'พิกัดกริด E/N',
};

const m10 = (m: number) => (Math.round(m / 10) * 10).toLocaleString('en-US');

function water(rel: SiteFacts['waterRelation']): string {
  return rel === 'upstream' ? 'ต้นน้ำ' : rel === 'downstream' ? 'ปลายน้ำ' : 'ระดับเดียวกับ';
}

export function buildIntegratedBoard(s: GameSession): GridBoardView | null {
  const ia = s.level.integratedSiteAnalysis;
  const ev = s.integratedEvidence();
  if (!ia || !ev || !s.coords) return null;
  const name = (id: string) => s.level.landmarks.find((l) => l.id === id)?.name ?? id;
  const sym = (x: string | null) => (x ? (ia.symbolLabels[x] ?? x) : '-');
  const has = (id: string) => s.clues.includes(id);
  const [cDist, cTerrain, cGrid] = ia.requiredClueIds;
  const rp = s.landmarkPoints[ia.grid.fromId];

  const evidence = [
    has(cDist)
      ? `① ${INTEGRATED_CHECK_LABEL.distance}: จาก${name(ia.distance.fromId)} ไปทาง${THAI_DIRECTION[ev.distance.direction]} · เส้นตรง ~${ev.distance.straightMeters} ม. · ตามถนน ~${ev.distance.roadMeters} ม.`
      : `① ${INTEGRATED_CHECK_LABEL.distance}: ยังไม่มีข้อมูล`,
    has(cTerrain)
      ? `② ${INTEGRATED_CHECK_LABEL.terrain}: ${sym(ev.terrain.symbol)} · สูงกว่า ${ev.terrain.minElevationMeters} ม. · อยู่ทาง${water(ev.terrain.relation)}ของ${name(ia.terrain.ofId)}`
      : `② ${INTEGRATED_CHECK_LABEL.terrain}: ยังไม่มีข้อมูล`,
    has(cGrid)
      ? `③ ${INTEGRATED_CHECK_LABEL.grid}: N = N ของ${name(ia.grid.fromId)} (${rp ? GridSystem.format(s.coords.tileToGrid(rp)) : '-'}) + ${ia.grid.dN} = N ${ev.grid.nMeters.toLocaleString('en-US')} · E อ่านได้ ${ev.grid.eMask}`
      : `③ ${INTEGRATED_CHECK_LABEL.grid}: ยังไม่มีข้อมูล`,
    'หลักฐานแต่ละชนิดอาจตรงได้หลายจุด — จุดที่ถูกต้องต้องตรงครบทั้ง 3 ชนิดพร้อมกัน',
  ];

  const rows = new Map(s.evaluateIntegratedSites().map((r) => [r.landmarkId, r.facts]));
  const candidates: GridBoardCandidate[] = ia.candidates.map((c, i) => {
    const f = rows.get(c.landmarkId)!;
    const surveyed = !c.evidenceId || s.evidence.includes(c.evidenceId);
    return {
      key: i + 1,
      label: c.label,
      name: name(c.landmarkId),
      surveyed,
      selected: s.gridSelection === i,
      facts: surveyed
        ? [
            `จาก${name(ia.distance.fromId)}: ทาง${THAI_DIRECTION[f.direction]} · เส้นตรง ~${m10(f.straightMeters)} ม. · ตามถนน ${f.roadMeters === null ? '-' : `~${m10(f.roadMeters)} ม.`}`,
            `สัญลักษณ์${sym(f.symbol)} · สูง ${Math.round(f.elevationMeters)} ม. · ทาง${water(f.waterRelation)}ของ${name(ia.terrain.ofId)}`,
            `พิกัด ${GridSystem.format({ e: f.e, n: f.n })}`,
          ]
        : ['ยังไม่ได้สำรวจ — เดินไปกด E ที่จุดนั้นก่อน'],
    };
  });

  const status: string[] = [];
  if (s.analysisSolved) {
    const okAt = s.gridAttempts.find((a) => a.ok);
    const label = ia.candidates.find((c) => c.landmarkId === okAt?.landmarkId)?.label ?? '';
    status.push(`วิเคราะห์แล้ว: ${label} ตรงกับหลักฐานครบทั้ง 3 ชนิด · เปิดอ่านย้อนหลังได้ตลอด · Esc หรือ C ปิด`);
  } else if (!s.isAnalysisOpen()) {
    status.push('ดูข้อมูลได้ แต่จะยืนยันคำตอบได้ในฉาก 5 (หลังได้หลักฐานพิกัดจากลุงจำรัส) · Esc ปิด');
  } else if (s.gridSelection === null) {
    status.push('จุดใดตรงกับหลักฐานครบทั้ง 3 ชนิด? กดเลข 1–3 เพื่อเลือก · Esc หรือ C ปิด');
  } else {
    status.push(`เลือก ${ia.candidates[s.gridSelection].label} — กด Enter เพื่อยืนยัน หรือกดเลขอื่นเพื่อเปลี่ยน`);
  }
  const history = s.gridAttempts.map((a) => `${ia.candidates.find((c) => c.landmarkId === a.landmarkId)?.label ?? a.landmarkId} ${a.ok ? '✓' : '✗'}`);
  status.push(`ตอบผิดแล้ว ${s.mistakes.compare} ครั้ง${history.length ? ` · ประวัติ: ${history.join(' → ')}` : ''}`);

  const r = s.lastIntegratedChoice;
  const explained = r ? explainIntegratedChoice(s, r) : null;
  return { evidence, candidates, status, result: explained?.lines ?? [], resultTone: explained?.tone ?? 'none' };
}

/** อธิบายข้อที่ขัดแย้งของจุดที่เลือก (ผิด) พร้อมคำใบ้ที่ไม่บอกคำตอบ หรือสรุปเหตุผลเมื่อถูก */
export function explainIntegratedChoice(
  s: GameSession,
  r: IntegratedChoiceResult,
): { tone: 'ok' | 'wrong' | 'blocked'; lines: string[] } {
  const ia = s.level.integratedSiteAnalysis!;
  const ev = s.integratedEvidence()!;
  const label = ia.candidates.find((c) => c.landmarkId === r.chosenId)?.label ?? '';
  const name = (id: string) => s.level.landmarks.find((l) => l.id === id)?.name ?? id;
  const sym = (x: string | null) => (x ? (ia.symbolLabels[x] ?? x) : 'ไม่มีสัญลักษณ์');

  if (r.blocked === 'not-available') {
    return { tone: 'blocked', lines: ['ยังยืนยันไม่ได้ — ต้องได้หลักฐานครบทั้ง 3 ชนิดก่อน (ไม่นับเป็นการตอบผิด)'] };
  }
  if (r.blocked === 'missing-evidence') {
    const lines = ['ยังยืนยันไม่ได้ (ไม่นับเป็นการตอบผิด):'];
    if (r.missingClues.length) lines.push(`• ยังขาดหลักฐาน ${r.missingClues.length} ชนิด`);
    for (const id of r.notSurveyed) {
      lines.push(`• ต้องเดินไปสำรวจ ${ia.candidates.find((c) => c.landmarkId === id)?.label ?? id} ด้วยตัวเองก่อน (กด E ที่จุดนั้น)`);
    }
    return { tone: 'blocked', lines };
  }
  const f = r.chosenId ? r.facts[r.chosenId] : undefined;
  const rep: IntegratedReport | undefined = r.chosenId ? r.reports[r.chosenId] : undefined;
  if (!f || !rep) return { tone: 'blocked', lines: [] };

  if (r.ok) {
    return {
      tone: 'ok',
      lines: [
        `ถูกต้อง! ${label} ตรงกับหลักฐานครบทั้ง 3 ชนิด`,
        `① ${INTEGRATED_CHECK_LABEL.distance}: ทาง${THAI_DIRECTION[f.direction]} เส้นตรง ~${m10(f.straightMeters)} ม. ตามถนน ~${m10(f.roadMeters ?? 0)} ม. ตรงกับบันทึก`,
        `② ${INTEGRATED_CHECK_LABEL.terrain}: ${sym(f.symbol)} สูง ${Math.round(f.elevationMeters)} ม. ทาง${water(f.waterRelation)}ของ${name(ia.terrain.ofId)} ตรงกับบันทึก`,
        `③ ${INTEGRATED_CHECK_LABEL.grid}: ${GridSystem.format({ e: f.e, n: f.n })} ตรงทั้ง N และตัวเลข E ที่อ่านได้`,
        `ฉาก 6: เดินไปที่ ${label} กด E ตรวจยืนยันและบันทึกภูมิปัญญา แล้วเปิดแผนที่ (M) ปักหมุด`,
      ],
    };
  }

  const lines = [`ยังไม่ถูก — ${label} ขัดกับหลักฐาน ${rep.failed.length} ชนิด:`];
  const why = (x: IntegratedReport['reasons'][number]) => rep.reasons.includes(x);
  if (rep.failed.includes('distance')) {
    const parts: string[] = [];
    if (why('direction')) parts.push(`อยู่ทาง${THAI_DIRECTION[f.direction]} แต่บันทึกบอกทาง${THAI_DIRECTION[ev.distance.direction]}`);
    if (why('straight')) parts.push(`เส้นตรง ~${m10(f.straightMeters)} ม. แต่บันทึก ~${ev.distance.straightMeters} ม.`);
    if (why('road')) parts.push(`ตามถนน ~${m10(f.roadMeters ?? 0)} ม. แต่บันทึก ~${ev.distance.roadMeters} ม.`);
    if (why('no-road')) parts.push('ไม่มีถนนเชื่อม');
    lines.push(`✗ ${INTEGRATED_CHECK_LABEL.distance}: ${parts.join(' · ')}`);
  }
  if (rep.failed.includes('terrain')) {
    const parts: string[] = [];
    if (why('symbol')) parts.push(`เป็น${sym(f.symbol)} แต่บันทึกใช้สัญลักษณ์${sym(ev.terrain.symbol)}`);
    if (why('elevation')) parts.push(`สูง ${Math.round(f.elevationMeters)} ม. ไม่ถึง ${ev.terrain.minElevationMeters} ม.`);
    if (why('water-relation')) parts.push(`อยู่ทาง${water(f.waterRelation)} ไม่ใช่ทาง${water(ev.terrain.relation)}`);
    lines.push(`✗ ${INTEGRATED_CHECK_LABEL.terrain}: ${parts.join(' · ')}`);
  }
  if (rep.failed.includes('grid')) {
    const parts: string[] = [];
    if (why('n')) parts.push(`N ${f.n.toLocaleString('en-US')} ไม่ตรงกับ N ${ev.grid.nMeters.toLocaleString('en-US')}`);
    if (why('e-mask')) parts.push(`E ${f.e.toLocaleString('en-US')} ไม่ตรงรูปแบบ ${ev.grid.eMask}`);
    lines.push(`✗ ${INTEGRATED_CHECK_LABEL.grid}: ${parts.join(' · ')}`);
  }
  const passed = (['distance', 'terrain', 'grid'] as const).filter((c) => !rep.failed.includes(c));
  if (passed.length) lines.push(`ข้อที่ตรง: ${passed.map((c) => INTEGRATED_CHECK_LABEL[c]).join(', ')} — แต่ยังไม่ครบทุกชนิด`);
  lines.push(`คำใบ้: ${integratedHint(rep.failed)}`);
  return { tone: 'wrong', lines };
}

/** คำใบ้ตามหลักฐานแรกที่ขัดแย้ง — ไม่ระบุว่าจุดใดถูก */
export function integratedHint(failed: IntegratedCheck[]): string {
  if (failed.includes('distance')) return 'วัดทิศจากสะพานใหม่ และแยกระยะเส้นตรงกับระยะตามถนนให้ชัด (กด R ที่สะพานแล้วเดินตามถนนวัดได้)';
  if (failed.includes('terrain')) return 'ดูสัญลักษณ์บนแผนที่ (M) ให้ดี และเทียบความสูงกับเส้นชั้นความสูง จุดที่ถูกต้องต้องใช้สัญลักษณ์ตามบันทึก';
  return 'คำนวณ N จากหมุด RP-2 อีกครั้ง และตรวจว่าตัวเลข E ที่อ่านได้ตรงทุกหลัก';
}
