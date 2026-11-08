/**
 * จัดวางหน้าจอสำหรับมือถือ (ตรรกะล้วน ทดสอบได้)
 *
 * เกมใช้พื้นที่ 960×640 (3:2) และย่อ/ขยายแบบรักษาสัดส่วนเสมอ (Pixel Art ไม่ถูกบีบ)
 * โทรศัพท์แนวนอนส่วนใหญ่กว้างกว่า 3:2 จึงมีที่ว่างซ้าย–ขวาของภาพเกม → วางจอยสติก/ปุ่มไว้ตรงนั้น ไม่ทับฉาก
 * ถ้าจอแคบจนไม่มีที่ว่างพอ (เช่น แท็บเล็ต 4:3) ปุ่มจะซ้อนบนขอบภาพเกมแบบโปร่งใส
 * เว้นขอบรอยบาก/มุมโค้งตาม safe-area-inset ของเครื่อง
 */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MobileLayout {
  portrait: boolean;
  /** พื้นที่ของภาพเกม (CSS px) */
  game: Rect;
  /** มีที่ว่างพอวางปุ่มข้างภาพเกมโดยไม่ทับ */
  sideColumns: boolean;
  left: Rect;
  right: Rect;
  /** จอเตี้ย (แนวนอนบนมือถือ) — แถบภารกิจแสดงแบบย่อ */
  compact: boolean;
  /** ขนาดปุ่มสัมผัส (CSS px) */
  button: number;
  /** ขอบปลอดภัยของเครื่อง (รอยบาก/มุมโค้ง) — หน้าจอเมนูเว้นตามนี้ */
  insets: Insets;
}

export const GAME_ASPECT = 960 / 640;
/** ความกว้างขั้นต่ำของคอลัมน์ปุ่มข้างภาพเกม — พอวางปุ่ม 2 ปุ่มต่อแถว (ปุ่มละ ≥ 52 px) */
export const MIN_COLUMN = 116;

export function computeMobileLayout(vw: number, vh: number, insets: Insets, touch: boolean): MobileLayout {
  const portrait = vh > vw;
  const availW = Math.max(0, vw - insets.left - insets.right);
  const availH = Math.max(0, vh - insets.top - insets.bottom);
  const compact = vh < 520;
  // ปุ่มอย่างน้อย 44 px (ขนาดสัมผัสที่แนะนำ) และโตตามความสูงจอแต่ไม่เกิน 64
  const button = Math.round(Math.max(44, Math.min(64, availH / 7.5)));

  if (!touch) {
    const w = Math.min(availW, availH * GAME_ASPECT);
    const h = w / GAME_ASPECT;
    const game = { x: insets.left + (availW - w) / 2, y: insets.top + (availH - h) / 2, w, h };
    const empty = { x: 0, y: 0, w: 0, h: 0 };
    return { portrait, game, sideColumns: false, left: empty, right: empty, compact, button, insets };
  }

  // ลองให้ภาพเกมสูงเต็มจอ แล้วดูว่าเหลือที่ว่างข้างละเท่าไร
  const fullW = availH * GAME_ASPECT;
  const side = (availW - fullW) / 2;
  let game: Rect;
  let sideColumns: boolean;
  const withColumns = availW - 2 * MIN_COLUMN;
  if (side >= MIN_COLUMN) {
    sideColumns = true;
    game = { x: insets.left + side, y: insets.top, w: fullW, h: availH };
  } else if (withColumns >= fullW * 0.82) {
    // ย่อภาพเกมลงเล็กน้อย (ไม่เกิน 18%) เพื่อให้ปุ่มไม่ทับฉาก เช่น เครื่องที่มีรอยบากกินขอบซ้าย–ขวา
    sideColumns = true;
    const w = withColumns;
    const h = w / GAME_ASPECT;
    game = { x: insets.left + MIN_COLUMN, y: insets.top + (availH - h) / 2, w, h };
  } else {
    sideColumns = false;
    const w = Math.min(availW, fullW);
    const h = w / GAME_ASPECT;
    game = { x: insets.left + (availW - w) / 2, y: insets.top + (availH - h) / 2, w, h };
  }
  const colW = sideColumns ? Math.max(MIN_COLUMN, game.x - insets.left) : Math.max(MIN_COLUMN, button * 2 + 24);
  const left = { x: insets.left, y: insets.top, w: colW, h: availH };
  const right = { x: insets.left + availW - colW, y: insets.top, w: colW, h: availH };
  return { portrait, game, sideColumns, left, right, compact, button, insets };
}

/**
 * ความกว้างของแถบด้านบนภาพเกม (CSS px): แถบสถานะซ้ายบน + แถบติดตามภารกิจขวาบน
 * รับประกันว่าทั้งสองไม่ทับกัน (รวมระยะขอบ 8 px สามช่วง) · จอแคบ → แถบสถานะแบบย่อ
 */
export function hudWidths(canvasW: number, compact: boolean): { tracker: number; status: number; tightStatus: boolean } {
  const gap = 8;
  // v0.19: แถบภารกิจแสดงวิธีทำทีละข้อ (ยาวขึ้น) — ต้องไม่บังตัวผู้เล่นที่อยู่กลางภาพเกม:
  //   จอเตี้ย: กว้างไม่เกินครึ่งภาพลบ 16 px (สูงได้มากแทน) · จอใหญ่: กว้างได้ถึง 360 px (ยังอยู่ขวาของกลางภาพ)
  const tracker = Math.round(compact ? Math.min(300, canvasW / 2 - 16) : Math.min(360, canvasW * 0.46));
  const status = Math.max(0, Math.floor(canvasW - tracker - gap * 3));
  return { tracker, status, tightStatus: status < 250 };
}
