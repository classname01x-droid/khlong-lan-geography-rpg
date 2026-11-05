/**
 * แปลงคำแนะนำ "ปุ่มคีย์บอร์ด" ในข้อความเกม ให้เป็นชื่อปุ่มสัมผัสที่ผู้เล่นเห็นบนจอ (ใช้เฉพาะจอสัมผัส)
 * เปลี่ยนเฉพาะคำบอกวิธีกดปุ่ม — ไม่แตะเนื้อเรื่อง ตัวเลข พิกัด หรือคำตอบปริศนา
 * ชื่อปุ่มตรงกับ buildTouchContext (core/input/InputMapping.ts)
 */
export interface TouchWordingOptions {
  /** ชื่อปุ่มวิเคราะห์ของด่าน ('วิเคราะห์' หรือ 'เทียบแผนที่') */
  analysisLabel?: string;
}

const BTN = {
  E: '✋',
  M: '🗺️ แผนที่',
  N: '📒 สมุด',
  R: '📏 วัดระยะ',
  G: '# ตาราง',
};

export function touchWording(text: string, opts: TouchWordingOptions = {}): string {
  const C = `🔍 ${opts.analysisLabel ?? 'วิเคราะห์'}`;
  const key: Record<string, string> = { ...BTN, C };
  return (
    text
      // ประโยคคำสั่งทั้งชุด (ต้องแปลงก่อนคำเดี่ยว)
      .replace(/WASD\/ลูกศร: เลื่อน · Space: ปักหมุด/g, 'แตะช่องบนแผนที่เพื่อวางหมุด แล้วแตะ 📍 ปักหมุดตรงนี้')
      .replace(/กดเลข 1[–-]([0-9]) เพื่อเลือก/g, 'แตะตัวเลือกทางขวาเพื่อเลือก')
      .replace(/กด Enter เพื่อยืนยัน/g, 'แตะ ✔ ยืนยัน')
      .replace(/หรือกดเลขอื่นเพื่อเปลี่ยน/g, 'หรือแตะตัวเลือกอื่นเพื่อเปลี่ยน')
      .replace(/กด 1, 2 หรือ 3 เพื่อเลือกเส้นทาง/g, 'แตะปุ่มเส้นทางเพื่อเลือก')
      .replace(/กด 1 หรือ 2 เพื่อเลือก/g, 'แตะปุ่มฉบับที่ 1 หรือ 2 เพื่อเลือก')
      .replace(/ ?· ?(Esc หรือ C|C หรือ Esc|M หรือ Esc|M\/Esc|Esc หรือ M|Esc) ?(ปิด|เพื่อปิด)/g, '')
      .replace(/(Esc|M หรือ Esc|N หรือ Esc)(: | )?(ปิด|เพื่อปิด)/g, 'แตะ ✕ เพื่อปิด')
      .replace(/Esc: กลับไปเลื่อนหมุด/g, 'แตะ ↩ ย้ายหมุด เพื่อเลื่อนหมุด')
      .replace(/◀ ▶ หรือ A \/ D เปลี่ยนหน้า/g, 'แตะแท็บเพื่อเปลี่ยนหน้า')
      .replace(/กด Tab/g, 'แตะ 🔁 สลับแผ่น')
      .replace(/Tab: /g, '🔁 ')
      // ปุ่มเดี่ยว: "กด E" / "(E)" / "(กด E)"
      .replace(/กด ([EMNRCG])(?![A-Za-z])/g, (_, k: string) => `แตะ ${key[k]}`)
      .replace(/\(([EMNRCG])\)/g, (_, k: string) => `(${key[k]})`)
      .replace(/(^|[\s(·])([MNRCG]): /g, (_, pre: string, k: string) => `${pre}${key[k]}: `)
  );
}

/** ข้อความยังมีคำแนะนำปุ่มคีย์บอร์ดเหลืออยู่หรือไม่ (ใช้ในการทดสอบ) */
export const KEYBOARD_HINT_RE = /กด ?[A-Z](?![a-z])|\((E|M|N|R|C|G)\)|\bEsc\b|\bEnter\b|\bTab\b|\bSpace\b|WASD|กดเลข|Delete/;
