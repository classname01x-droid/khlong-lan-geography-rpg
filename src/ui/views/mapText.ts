import type { GameSession } from '../../core/session/GameSession';
import { explainSettlementPart, PART_TITLE } from '../../core/site/SettlementAnalysis';
import { GridSystem } from '../../core/world/GridSystem';

/** ข้อความประกอบหน้าแผนที่ (M) — ใช้ร่วมกันระหว่าง MapOverlay (canvas) และแถบข้อความบนจอสัมผัส */
export function mapTitle(s: GameSession): string {
  if (s.mapRevealTitle) return s.mapRevealTitle;
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
 * เลือกพื้นที่และผลวิเคราะห์ (บทที่ 3) — ข้อความเดียวกันทั้งจอสัมผัสและคอมพิวเตอร์ (สั้น อ่านง่าย)
 *   ระหว่างเลือก: ตำแหน่ง + ขนาดวง + วิธียืนยัน/ยกเลิก · หลังยืนยัน: ค่าที่วัดได้ คะแนนรายเกณฑ์ คะแนนรวม และผล
 */
export function settlementLines(s: GameSession, opts: { touch?: boolean } = {}): { lines: string[]; problem: boolean } {
  const d = s.level.settlementAnalysis;
  if (!d) return { lines: [], problem: false };
  const lines: string[] = [];
  const last = s.latestSettlementReport();
  const radiusM = s.scale.tilesToMeters(d.radiusTiles);
  const where = (t: { x: number; y: number }) => (s.coords ? GridSystem.format(s.coords.tileToGrid(t)).replace(' · ', ' / ') : `ช่อง X ${t.x}, Y ${t.y}`);
  const selecting = s.mapTool === 'settlement' && s.pinStage === 'cursor' && !!s.pinCursor;
  if (selecting) {
    lines.push(`🔍 เลือกพื้นที่: ${where(s.pinCursor!)} · วงกลมรัศมี ${radiusM} ม.`);
    lines.push(
      opts.touch
        ? 'แตะที่อื่นเพื่อเลือกใหม่ · แตะ "วิเคราะห์พื้นที่นี้" เพื่อยืนยัน · "ปิดแผนที่" = ยกเลิก'
        : 'คลิกที่อื่น/ลูกศร: เลือกใหม่ · Space: วิเคราะห์พื้นที่นี้ · M/Esc: ยกเลิก',
    );
    if (last) lines.push(`ครั้งก่อน: ${where(last.center)} ได้ ${last.total}/100 (${last.passed ? 'ผ่าน' : 'ไม่ผ่าน'})`);
    return { lines, problem: false };
  }
  if (last) {
    lines.push(`พื้นที่ที่เลือก: ${where(last.center)} (วงรัศมี ${radiusM} ม.)`);
    for (const p of last.parts) lines.push(`${PART_TITLE[p.id]}: ${explainSettlementPart(last, d, p.id)} ${p.score}/${p.max}`);
    lines.push(`คะแนนรวม: ${last.total}/100`);
    if (last.passed) lines.push('ผลการวิเคราะห์: ผ่าน ✓ นำพื้นที่นี้ไปสำรวจต่อได้ (ยังไม่ใช่การพบเมืองโบราณ)');
    else {
      const review = last.weakTopics.map((t) => d.topics[t].label).join(' · ');
      const lock = s.settlementLock();
      lines.push(
        lock?.kind === 'lessons'
          ? `ผลการวิเคราะห์: ไม่ผ่าน (ต้องมากกว่า ${d.passPercent}) — ทบทวน ${review} · กลับไปพบครูเนม`
          : `ผลการวิเคราะห์: ไม่ผ่าน (ต้องมากกว่า ${d.passPercent}) — ทบทวนแล้ว เลือกพื้นที่ใหม่ได้`,
      );
    }
  } else if (s.settlementLock()?.kind === 'early') {
    lines.push('🔒 เลือกพื้นที่ได้หลังคุยกับลุงสอนและป้าจันทร์');
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
