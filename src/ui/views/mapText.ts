import type { GameSession } from '../../core/session/GameSession';
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

/** สถานะการปักหมุด + ผลการปัก (บรรทัดว่าง = ไม่มีอะไรแสดง) */
export function mapPinLines(s: GameSession, opts: { touch?: boolean } = {}): { lines: string[]; problem: boolean } {
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
