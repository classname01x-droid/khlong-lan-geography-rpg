/**
 * จัดวางป้ายในโลกเกมไม่ให้ทับกัน และไม่ให้ถูกแถบบนจอ (DOM) บัง — ตรรกะล้วน ทดสอบได้
 * ทุกค่าเป็นหน่วยเดียวกัน (พิกเซลโลกเกม) — ผู้เรียกแปลงพื้นที่ของแถบบนจอเป็นพิกัดโลกเกมก่อน
 *
 * หลักการ:
 *   - ป้ายชื่อ: เรียงตามความสำคัญ (เป้าหมายที่คุยได้ → NPC ใกล้ผู้เล่น → สถานที่ใกล้ผู้เล่น)
 *     ป้ายที่ชนกับป้ายที่วางแล้ว → ลองเลื่อนขึ้น/ลง · ไม่มีที่ว่าง → ซ่อนชั่วคราว (ป้ายที่อยู่ไกลกว่าจะถูกซ่อนก่อน)
 *   - ระบบนี้ "ซ่อน/เลื่อน" ได้อย่างเดียว ไม่เคยแสดงป้ายที่ผู้เรียกไม่ได้ส่งมา
 *     (ป้ายสถานที่ลับที่ยังไม่ค้นพบไม่ถูกส่งมา จึงไม่มีทางปรากฏ)
 *   - ป้าย "คุย": ลองวางรอบเป้าหมาย (เหนือ/ขวา/ซ้าย/ใต้ และเลื่อนตามขอบได้เล็กน้อย) เลือกตำแหน่งที่ใกล้ที่สุดที่อยู่ในจอและไม่ถูกแถบบนจอบัง
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Box, b: Box, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function inside(a: Box, outer: Box): boolean {
  return a.x >= outer.x && a.y >= outer.y && a.x + a.w <= outer.x + outer.w && a.y + a.h <= outer.y + outer.h;
}

export function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/* ---------------- ป้าย "คุย/สำรวจ" ---------------- */

export type CueSide = 'above' | 'right' | 'left' | 'below';
export const CUE_SIDES: readonly CueSide[] = ['above', 'right', 'left', 'below'];

export interface CueInput {
  /** พื้นที่ของเป้าหมาย (ตัวละคร + ชื่อ หรือจุดสำรวจ) */
  target: Box;
  /** ขนาดป้าย */
  size: { w: number; h: number };
  /** ระยะห่างจากเป้าหมาย */
  gap: number;
  /** พื้นที่ที่มองเห็นบนจอ */
  view: Box;
  /** แถบบนจอที่บังภาพเกม (แถบภารกิจ แถบสถานะ การ์ดบทแนะนำ ปุ่มที่ซ้อนบนภาพ) — ห้ามทับ */
  obstacles: Box[];
  /** สิ่งที่ไม่ควรทับถ้าเลี่ยงได้ (เช่น ตัวผู้เล่น) */
  avoid?: Box[];
}

export function cueBox(side: CueSide, i: Pick<CueInput, 'target' | 'size' | 'gap'>): Box {
  const { target: t, size: s, gap } = i;
  const cx = t.x + t.w / 2 - s.w / 2;
  const cy = t.y + t.h / 2 - s.h / 2;
  switch (side) {
    case 'above':
      return { x: cx, y: t.y - gap - s.h, ...s };
    case 'below':
      return { x: cx, y: t.y + t.h + gap, ...s };
    case 'right':
      return { x: t.x + t.w + gap, y: cy, ...s };
    case 'left':
      return { x: t.x - gap - s.w, y: cy, ...s };
  }
}

/** ความชอบของแต่ละด้าน (หน่วยเดียวกับระยะ) — เหนือ NPC ดีที่สุด ใต้ NPC (ทับชื่อ/ใกล้ผู้เล่น) รองสุดท้าย */
const SIDE_BIAS: Record<CueSide, number> = { above: 0, right: 4, left: 4, below: 12 };

/**
 * ตำแหน่งที่ลองได้ทั้งหมด: แต่ละด้านเลื่อนไปตามขอบเป้าหมายได้เล็กน้อย (ยังติดเป้าหมาย)
 * เพื่อหาที่ว่างเมื่อแถบบนจอบังตำแหน่งกึ่งกลางของด้านนั้น
 */
export function cueCandidates(i: Pick<CueInput, 'target' | 'size' | 'gap'>): Array<{ side: CueSide; box: Box; score: number }> {
  const out: Array<{ side: CueSide; box: Box; score: number }> = [];
  const tc = { x: i.target.x + i.target.w / 2, y: i.target.y + i.target.h / 2 };
  const { w, h } = i.size;
  for (const side of CUE_SIDES) {
    const base = cueBox(side, i);
    const slides: Array<[number, number]> =
      side === 'above' || side === 'below'
        ? [[0, 0], [-w / 2, 0], [w / 2, 0], [-w, 0], [w, 0]]
        : [[0, 0], [0, -h], [0, h], [side === 'left' ? -w / 2 : w / 2, 0], [side === 'left' ? -w / 2 : w / 2, -h], [side === 'left' ? -w / 2 : w / 2, h]];
    for (const [dx, dy] of slides) {
      const box = { ...base, x: base.x + dx, y: base.y + dy };
      const dist = Math.hypot(box.x + w / 2 - tc.x, box.y + h / 2 - tc.y);
      out.push({ side, box, score: dist + SIDE_BIAS[side] });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}

/**
 * เลือกตำแหน่งป้าย (ใกล้เป้าหมายที่สุดก่อน · ชอบด้านบน):
 *   (1) อยู่ในจอ ไม่ถูกบัง และไม่ทับผู้เล่น → (2) อยู่ในจอและไม่ถูกบัง → (3) ถูกบังน้อยที่สุด
 */
export function placeCue(i: CueInput): { side: CueSide; box: Box; blocked: boolean } {
  const cands = cueCandidates(i);
  const covered = (b: Box) => i.obstacles.some((o) => overlaps(b, o));
  const clear = cands.filter((c) => inside(c.box, i.view) && !covered(c.box));
  const best = clear.find((c) => !(i.avoid ?? []).some((a) => overlaps(c.box, a))) ?? clear[0];
  if (best) return { side: best.side, box: best.box, blocked: false };
  // ไม่มีตำแหน่งว่างเลย (จอเล็กมาก): เลือกตำแหน่งที่ถูกบังน้อยที่สุด
  const hidden = (b: Box) =>
    i.obstacles.reduce((a, o) => a + overlapArea(b, o), 0) + (b.w * b.h - visibleArea(b, i.view));
  const fallback = cands.reduce((a, c) => (hidden(c.box) < hidden(a.box) ? c : a));
  return { side: fallback.side, box: fallback.box, blocked: true };
}

function visibleArea(b: Box, view: Box): number {
  return overlapArea(b, view);
}

/* ---------------- ป้ายชื่อ ---------------- */

export interface LabelRequest {
  id: string;
  /** ตำแหน่งปกติ */
  box: Box;
  /** น้อย = สำคัญกว่า (วางก่อน) */
  priority: number;
  /** ระยะเลื่อนแนวตั้งที่ลองได้ (ไม่ใส่ = ลองเฉพาะตำแหน่งปกติ) */
  shifts?: number[];
}

export interface LabelPlacement {
  id: string;
  shown: boolean;
  dy: number;
  box: Box;
}

/**
 * วางป้ายชื่อทีละป้ายตามความสำคัญ: ตำแหน่งปกติ → เลื่อนตาม shifts → ซ่อน
 * blockers: สิ่งที่ป้ายห้ามทับ (ตัว NPC เครื่องหมาย ! ป้าย "คุย")
 */
export function layoutLabels(requests: LabelRequest[], blockers: Box[] = [], pad = 1): LabelPlacement[] {
  const placed: Box[] = [];
  const out: LabelPlacement[] = [];
  const order = [...requests].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  for (const r of order) {
    let done = false;
    for (const dy of [0, ...(r.shifts ?? [])]) {
      const box = { ...r.box, y: r.box.y + dy };
      if (placed.some((p) => overlaps(box, p, pad)) || blockers.some((b) => overlaps(box, b))) continue;
      placed.push(box);
      out.push({ id: r.id, shown: true, dy, box });
      done = true;
      break;
    }
    if (!done) out.push({ id: r.id, shown: false, dy: 0, box: r.box });
  }
  return out;
}
