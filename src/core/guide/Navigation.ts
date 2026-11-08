import type { TilePoint } from '../world/types';
import type { GameSession } from '../session/GameSession';
import { overlaps, type Box } from '../ui/LabelLayout';
import { currentMicro } from './MicroQuest';

/**
 * นำทางไปหา "เป้าหมายที่รู้ตำแหน่งแล้ว" ของขั้นปัจจุบัน (ตรรกะล้วน ทดสอบได้)
 *
 * แยกจากการค้นหาสถานที่ปริศนา:
 *   - NPC/สถานที่ที่มีคนบอกตำแหน่งแล้ว → หาง่าย: เครื่องหมาย ! · ลูกศรขอบจอ · จุดบนแผนที่ · ปุ่มคุยเมื่อเข้าใกล้
 *   - สถานที่ลับ/คำตอบของปริศนา → ไม่มีเป้าหมายนำทางเลย (ผู้เขียนด่านไม่ตั้ง target)
 *     และกันซ้ำที่นี่: สถานที่ที่มี revealFlag ต้องเปิดเผยแล้ว · NPC/สถานที่ต้องผ่านเงื่อนไข when ก่อน
 */
export interface GuideTarget {
  kind: 'npc' | 'landmark';
  id: string;
  name: string;
  at: TilePoint;
}

export function guideTarget(s: GameSession): GuideTarget | null {
  const m = currentMicro(s);
  const t = m?.step.target;
  if (!t) return null;
  if (t.when && !s.objectiveDone(t.when)) return null;
  if (t.npcId) {
    const npc = s.level.npcs.find((n) => n.id === t.npcId);
    return npc ? { kind: 'npc', id: npc.id, name: npc.name, at: { ...npc.at } } : null;
  }
  if (t.landmarkId) {
    const lm = s.level.landmarks.find((l) => l.id === t.landmarkId);
    if (!lm || (lm.revealFlag && !s.flags.has(lm.revealFlag))) return null;
    return { kind: 'landmark', id: lm.id, name: lm.name.replace(/\s*\(.*\)\s*$/, ''), at: { ...lm.at } };
  }
  return null;
}

export interface EdgeIndicator {
  /** เป้าหมายอยู่ในจอ (ไม่ต้องแสดงลูกศรขอบจอ) */
  onScreen: boolean;
  /** จุดกึ่งกลางของป้ายลูกศร (พิกัดเดียวกับ view) */
  x: number;
  y: number;
  /** มุมของลูกศร (เรเดียน, 0 = ชี้ไปทางขวา/ตะวันออก, π/2 = ชี้ลง/ใต้) */
  angle: number;
}

/**
 * ป้ายลูกศรที่ขอบจอชี้ไปยังเป้าหมายนอกจอ
 *   view      พื้นที่ที่มองเห็น · target จุดเป้าหมาย · size ขนาดป้าย · margin ระยะห่างจากขอบ
 *   obstacles แถบบนจอที่ห้ามทับ (แถบภารกิจ ฯลฯ) — ถ้าจุดบนขอบถูกบัง เลื่อนไปตามขอบจนพ้น
 */
export function edgeIndicator(view: Box, target: { x: number; y: number }, size: { w: number; h: number }, margin: number, obstacles: Box[] = []): EdgeIndicator {
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const angle = Math.atan2(dy, dx);
  const inside = target.x >= view.x && target.x <= view.x + view.w && target.y >= view.y && target.y <= view.y + view.h;
  // กรอบที่จุดกึ่งกลางป้ายอยู่ได้ (ป้ายทั้งป้ายยังอยู่ในจอ)
  const hw = view.w / 2 - margin - size.w / 2;
  const hh = view.h / 2 - margin - size.h / 2;
  if (inside || (dx === 0 && dy === 0)) return { onScreen: true, x: target.x, y: target.y, angle };
  const k = Math.min(hw / Math.max(1e-6, Math.abs(dx)), hh / Math.max(1e-6, Math.abs(dy)));
  let x = cx + dx * k;
  let y = cy + dy * k;
  const boxAt = (px: number, py: number): Box => ({ x: px - size.w / 2, y: py - size.h / 2, w: size.w, h: size.h });
  if (obstacles.some((o) => overlaps(boxAt(x, y), o))) {
    // ขอบด้านนั้นถูกแถบบนจอบัง → หาจุดว่างรอบขอบจอทั้งหมด เลือกจุดที่ทิศ (จากกลางจอ) ใกล้ทิศของเป้าหมายที่สุด
    const want = Math.atan2(dy, dx);
    const step = Math.max(4, Math.min(size.w, size.h) / 2);
    let best: { x: number; y: number; d: number } | null = null;
    const consider = (px: number, py: number) => {
      if (obstacles.some((o) => overlaps(boxAt(px, py), o))) return;
      let d = Math.abs(Math.atan2(py - cy, px - cx) - want);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (!best || d < best.d) best = { x: px, y: py, d };
    };
    for (let u = -hw; u <= hw; u += step) {
      consider(cx + u, cy - hh);
      consider(cx + u, cy + hh);
    }
    for (let v = -hh; v <= hh; v += step) {
      consider(cx - hw, cy + v);
      consider(cx + hw, cy + v);
    }
    const b = best as { x: number; y: number; d: number } | null;
    if (b) {
      x = b.x;
      y = b.y;
    }
  }
  return { onScreen: false, x, y, angle: Math.atan2(target.y - y, target.x - x) };
}
