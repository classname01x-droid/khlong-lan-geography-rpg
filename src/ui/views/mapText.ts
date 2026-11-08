import type { GameSession } from '../../core/session/GameSession';
import { explainSettlementPart } from '../../core/site/SettlementAnalysis';
import { GridSystem } from '../../core/world/GridSystem';

/** ข้อความประกอบหน้าแผนที่ (M) — ใช้ร่วมกันระหว่าง MapOverlay (canvas) และแถบข้อความบนจอสัมผัส */
export function mapTitle(s: GameSession): string {
  if (s.mapSheet !== 'current') {
    const sheet = s.level.baseMaps?.find((m) => m.id === s.mapSheet);
    if (sheet) return sheet.title;
  }
  return `แผนที่สำรวจ ${s.level.tambon}`;
}

export function mapInfo(s: GameSession): string {
  return s.coords
    ? `มาตราส่วน ${s.scale.ratioLabel} · 1 ช่อง = ${s.scale.config.metersPerTile} ม. · เส้นกริดทุก 100 ม. · ` +
        `พิกัดจำลอง: E เพิ่มไปทางตะวันออก · N เพิ่มไปทางเหนือ`
    : `มาตราส่วน ${s.scale.ratioLabel} · 1 ช่อง = ${s.scale.config.metersPerTile} ม. · ` +
        `1 ซม. บนแผนที่ = ${s.scale.mapCmToMeters(1)} ม. · เส้นตารางหนา = ทุก 100 ม.`;
}

/** ข้อมูลมาตราส่วนแบบสั้น (แถบหัวแผนที่บนจอเล็ก) */
export function mapInfoShort(s: GameSession): string {
  return `มาตราส่วน ${s.scale.ratioLabel} · 1 ช่อง = ${s.scale.config.metersPerTile} ม.`;
}

export function mapHint(s: GameSession): string {
  return s.pinStage === 'wisdom'
    ? 'Esc: กลับไปเลื่อนหมุด'
    : s.availableSheets().length >= 2
      ? 'Tab: สลับแผนที่ (สำรวจ → A → B) · C: เปรียบเทียบ · M/Esc: ปิด'
      : s.availableSheets().length === 1
        ? 'Tab: สลับแผนที่ · M หรือ Esc: ปิด'
        : 'กด M หรือ Esc เพื่อปิด';
}

/**
 * วิเคราะห์พื้นที่ตั้งถิ่นฐาน (บทที่ 3): สถานะเครื่องมือ · ผลคะแนนล่าสุด · เหตุที่ยังวิเคราะห์ไม่ได้
 * จอสัมผัสแสดงสั้น (3 บรรทัด — ไม่แย่งพื้นที่แผนที่) ส่วนรายละเอียดอยู่ในสมุด หน้า "หลักฐาน/ข้อความ"
 */
export function settlementLines(s: GameSession, opts: { touch?: boolean } = {}): { lines: string[]; problem: boolean } {
  const d = s.level.settlementAnalysis;
  if (!d) return { lines: [], problem: false };
  const lines: string[] = [];
  const last = s.latestSettlementReport();
  const radiusM = s.scale.tilesToMeters(d.radiusTiles);
  const teacherName = (id: string) => s.level.npcs.find((n) => n.id === id)?.name ?? id;
  const where = (t: { x: number; y: number }) => (s.coords ? GridSystem.format(s.coords.tileToGrid(t)) : `ช่อง X ${t.x}, Y ${t.y}`);
  if (last) {
    lines.push(`🔍 วงที่ ${where(last.center)}: ${last.percent}% (${last.total}/100) — ${last.passed ? `ผ่าน ✓ (มากกว่า ${d.passPercent}%)` : `ยังไม่ผ่าน (ต้องมากกว่า ${d.passPercent}%)`}`);
    if (opts.touch) {
      lines.push(last.parts.map((p) => `${d.topics[p.id].label} ${p.score}/${p.max}`).join(' · '));
    } else {
      for (const p of last.parts) lines.push(`• ${d.topics[p.id].label} ${p.score}/${p.max} — ${explainSettlementPart(last, d, p.id)}`);
    }
  }
  const lock = s.settlementLock();
  if (lock?.kind === 'lessons') {
    const by = new Map<string, string[]>();
    for (const t of lock.topics) by.set(d.topics[t].teacherId, [...(by.get(d.topics[t].teacherId) ?? []), d.topics[t].label]);
    lines.push(`🔒 กลับไปเรียนก่อนวิเคราะห์ใหม่: ${[...by].map(([id, ts]) => `${teacherName(id)} (${ts.join(' · ')})`).join(' · ')}`);
  } else if (lock?.kind === 'early') {
    lines.push('🔒 เครื่องมือวิเคราะห์จะเปิดหลังเรียนรู้เรื่องเส้นชั้นความสูงและข้อมูลแหล่งน้ำ');
  } else if (s.mapTool === 'settlement' && s.pinCursor) {
    lines.push(
      opts.touch
        ? `โหมดวิเคราะห์ · วงรัศมี ${d.radiusTiles} ช่อง (${radiusM} ม.) ที่ ${where(s.pinCursor)} · แตะแผนที่/ลากวง/ลูกศร แล้วแตะ "วิเคราะห์พื้นที่นี้"`
        : `โหมดวิเคราะห์พื้นที่ · วงกลมรัศมี ${d.radiusTiles} ช่อง (${radiusM} ม.) ที่ ${where(s.pinCursor)} · คลิก/ลากวง หรือ WASD/ลูกศร: เลื่อน · Space: วิเคราะห์พื้นที่นี้`,
    );
  } else if (s.settlementSolved && s.settlementChosen) {
    lines.push(`✓ พื้นที่ที่เลือก: ${where(s.settlementChosen)} — เดินทางไปตรวจสอบภาคสนาม (วงสีเขียวบนแผนที่)`);
  }
  return { lines, problem: !!last && !last.passed };
}

/** สถานะการปักหมุด + ผลการปัก (บรรทัดว่าง = ไม่มีอะไรแสดง) */
export function mapPinLines(s: GameSession, opts: { touch?: boolean } = {}): { lines: string[]; problem: boolean } {
  if (s.level.settlementAnalysis && !s.level.pinTask) return settlementLines(s, opts);
  const lines: string[] = [];
  const pinning = s.pinStage !== 'none' && s.pinCursor;
  if (pinning && s.pinCursor) {
    const pin = s.level.pinTask!;
    const where = s.coords
      ? `พิกัดหมุด: ${GridSystem.format(s.coords.tileToGrid(s.pinCursor))}`
      : `ตำแหน่งหมุด: ช่อง X ${s.pinCursor.x}, Y ${s.pinCursor.y}`;
    if (s.pinStage === 'cursor') {
      lines.push(
        opts.touch
          ? `โหมดปักหมุด · ${where} · แตะแผนที่หรือลากหมุด · ปุ่มลูกศรเลื่อนทีละช่อง`
          : `โหมดปักหมุด · ${where} · คลิก/ลากหมุด หรือ WASD/ลูกศร: เลื่อน · Space: ปักหมุด`,
      );
    } else {
      lines.push(`โหมดปักหมุด · ${where}`);
      lines.push(`${pin.wisdomPrompt}:  ${pin.wisdomChoices.map((c, i) => `${i + 1}) ${c.label}`).join('    ')}`);
    }
  }
  if (s.pinFeedback) lines.push(s.pinFeedback);
  return { lines, problem: !!s.pinFeedback && s.pinStage === 'cursor' };
}
