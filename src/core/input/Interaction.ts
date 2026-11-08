import type { InspectPoint } from '../../content/types';
import type { GameSession } from '../session/GameSession';

/**
 * เป้าหมายที่ผู้เล่นโต้ตอบได้ ณ ตำแหน่งปัจจุบัน — ใช้ทั้งปุ่ม E และปุ่มสัมผัส (จึงโต้ตอบกับสิ่งเดียวกับที่ข้อความบอก)
 *
 * หลักเกณฑ์เลือกเมื่อมีหลายสิ่งในระยะ (ไม่สุ่ม):
 *   1) ใกล้ที่สุดก่อน  2) ระยะเท่ากัน: NPC → จุดสำรวจ → จุดตรวจยืนยัน  3) ลำดับในข้อมูลด่าน
 */
export type InteractionKind = 'npc' | 'inspect' | 'verify';

export interface InteractionTarget {
  kind: InteractionKind;
  id: string;
  /** ข้อความบอกผู้เล่น เช่น "พูดคุยกับครูเนม" */
  label: string;
  /** คำกริยาสั้นบนปุ่ม */
  verb: string;
  distance: number;
}

const KIND_ORDER: Record<InteractionKind, number> = { npc: 0, inspect: 1, verify: 2 };

/** ชื่อจุดสำรวจ: ผู้พูดบรรทัดแรก (เช่น "หมุดอ้างอิง RP-1") ตัดคำนำ "สมุดภาคสนาม —" ออก */
export function inspectName(p: InspectPoint): string {
  const first = p.nodes.find((n): n is { speaker: string; text: string } => 'speaker' in n);
  const raw = first?.speaker ?? 'จุดนี้';
  return raw.replace(/^สมุดภาคสนาม\s*—\s*/, '').trim();
}

export function interactionTargets(s: GameSession, npcRadiusTiles: number): InteractionTarget[] {
  const t = s.playerTile;
  const out: InteractionTarget[] = [];
  s.level.npcs.forEach((npc) => {
    const d = Math.hypot(npc.at.x - t.x, npc.at.y - t.y);
    if (d <= npcRadiusTiles) out.push({ kind: 'npc', id: npc.id, label: `พูดคุยกับ${npc.name}`, verb: 'คุย', distance: d });
  });
  for (const p of s.level.inspectPoints ?? []) {
    const d = Math.hypot(p.at.x - t.x, p.at.y - t.y);
    if (d <= p.radiusTiles && s.matches(p.when)) {
      out.push({ kind: 'inspect', id: p.id, label: `สำรวจ${inspectName(p)}`, verb: 'สำรวจ', distance: d });
    }
  }
  const verifyId = s.gridVerifyAt(t) ?? s.integratedVerifyAt(t);
  if (verifyId) {
    const def = s.level.integratedSiteAnalysis ?? s.level.gridSiteAnalysis;
    const label = def?.candidates.find((c) => c.landmarkId === verifyId)?.label ?? 'จุดนี้';
    const at = s.landmarkPoints[verifyId];
    out.push({
      kind: 'verify',
      id: verifyId,
      label: `ตรวจสอบหลักฐานที่${label}`,
      verb: 'ตรวจสอบ',
      distance: at ? Math.hypot(at.x - t.x, at.y - t.y) : 0,
    });
  }
  // ตรวจสอบภาคสนามที่พื้นที่ซึ่งผู้เล่นเลือกจากการวิเคราะห์ (บทที่ 3)
  if (s.fieldCheckAvailable(t) && s.settlementChosen) {
    const c = s.settlementChosen;
    out.push({ kind: 'verify', id: 'field-check', label: 'ตรวจสอบพื้นที่ที่เลือก', verb: 'ตรวจสอบ', distance: Math.hypot(c.x - t.x, c.y - t.y) });
  }
  // sort เสถียร: ลำดับในข้อมูลด่านคงอยู่เมื่อระยะและชนิดเท่ากัน
  return out.sort((a, b) => a.distance - b.distance || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

export function pickInteraction(s: GameSession, npcRadiusTiles: number): InteractionTarget | null {
  return interactionTargets(s, npcRadiusTiles)[0] ?? null;
}
