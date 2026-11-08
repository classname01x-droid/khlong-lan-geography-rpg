/**
 * คำบอก "กด/แตะอะไร" ในคำแนะนำภารกิจ — เขียนครั้งเดียว แปลงตามอุปกรณ์ (ตรรกะล้วน ทดสอบได้)
 *
 *   {tap:map}    จอสัมผัส: แตะปุ่ม "🗺️ แผนที่"       คอมพิวเตอร์: กด M (แผนที่)
 *   {tap:guide}  ปุ่มลัดของขั้นนี้บนแถบภารกิจ (ชื่อปุ่มตามขั้น)
 *   {walk}       จอสัมผัส: ลากจอยสติกซ้ายล่างเพื่อเดิน   คอมพิวเตอร์: เดินด้วย W A S D หรือปุ่มลูกศร
 *   {tapmap}     แตะช่องบนแผนที่ / คลิกช่องบนแผนที่ หรือกดลูกศร
 *   {choose}     แตะตัวเลือก / กดเลขของตัวเลือก
 *   {next}       แตะกล่องข้อความเพื่ออ่านต่อ / กด Space อ่านต่อ
 *
 * ชื่อปุ่มตรงกับปุ่มจริงบนจอสัมผัส (core/input/InputMapping.ts) และปุ่มคีย์บอร์ดเดิม
 */
export interface GuideButton {
  icon: string;
  /** ชื่อปุ่มบนจอสัมผัส (ตรงกับปุ่มจริง) */
  label: string;
  /** ปุ่มคีย์บอร์ด */
  key: string;
  /** ชื่อที่ใช้คู่กับคีย์บอร์ด (ไม่ใส่ = label) */
  desk?: string;
}

export const GUIDE_BUTTONS: Record<string, GuideButton> = {
  map: { icon: '🗺️', label: 'แผนที่', key: 'M' },
  notebook: { icon: '📒', label: 'สมุด', key: 'N' },
  measure: { icon: '📏', label: 'วัดระยะ', key: 'R' },
  // บทที่ 1 ปุ่ม 🔍 วิเคราะห์ เปิดกระดานวิเคราะห์เส้นทาง
  routes: { icon: '🔍', label: 'วิเคราะห์', key: 'C', desk: 'กระดานวิเคราะห์เส้นทาง' },
  analysis: { icon: '🔍', label: 'วิเคราะห์', key: 'C' },
  compare: { icon: '🔍', label: 'เทียบแผนที่', key: 'C' },
  talk: { icon: '✋', label: 'คุย', key: 'E' },
  inspect: { icon: '✋', label: 'สำรวจ', key: 'E' },
  check: { icon: '✋', label: 'ตรวจสอบ', key: 'E' },
  pinHere: { icon: '📍', label: 'ปักหมุดตรงนี้', key: 'Space' },
  sheet: { icon: '🔁', label: 'สลับแผ่น', key: 'Tab' },
  closeMap: { icon: '✕', label: 'ปิดแผนที่', key: 'M' },
  closeBook: { icon: '✕', label: 'ปิดสมุด', key: 'N' },
  confirm: { icon: '✔', label: 'ยืนยัน', key: 'Enter' },
  grid: { icon: '#', label: 'ตาราง', key: 'G' },
};

export interface GuideTextOptions {
  touch: boolean;
  /** ชื่อปุ่มลัดของขั้นนี้ (สำหรับ {tap:guide}) */
  guideLabel?: string;
}

export function guideText(text: string, o: GuideTextOptions): string {
  return text
    .replace(/\{tap:guide\}/g, () =>
      o.guideLabel ? `${o.touch ? 'แตะ' : 'คลิก'}ปุ่ม "${o.guideLabel}" บนแถบภารกิจนี้` : `${o.touch ? 'แตะ' : 'คลิก'}ปุ่มบนแถบภารกิจนี้`,
    )
    .replace(/\{tap:(\w+)\}/g, (m, id: string) => {
      const b = GUIDE_BUTTONS[id];
      if (!b) return m;
      return o.touch ? `แตะปุ่ม "${b.icon} ${b.label}"` : `กด ${b.key} (${b.desk ?? b.label})`;
    })
    .replace(/\{walk\}/g, o.touch ? 'ลากจอยสติกซ้ายล่างเพื่อเดิน' : 'เดินด้วยปุ่ม W A S D หรือปุ่มลูกศร')
    .replace(/\{tapmap\}/g, o.touch ? 'แตะช่องบนแผนที่ (หรือลากหมุดด้วยนิ้ว)' : 'คลิกช่องบนแผนที่ หรือกดปุ่มลูกศรเลื่อนหมุด')
    .replace(/\{choose\}/g, o.touch ? 'แตะตัวเลือก' : 'กดเลขของตัวเลือก (1, 2, 3)')
    .replace(/\{next\}/g, o.touch ? 'แตะกล่องข้อความเพื่ออ่านต่อ' : 'กด Space เพื่ออ่านต่อ');
}

/** ตัวแปรปุ่มที่ยังไม่ถูกแปลง (ใช้ตรวจเนื้อหาในการทดสอบ) */
export const GUIDE_TOKEN_RE = /\{(tap:\w+|walk|tapmap|choose|next)\}/;
