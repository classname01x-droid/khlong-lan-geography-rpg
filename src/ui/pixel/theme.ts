/**
 * ธีม UI แบบ Pixel Art RPG: เขียวธรรมชาติ · น้ำตาลไม้ · ครีมกระดาษเก่า
 * เปลี่ยนสี/ภาพจริงภายหลังได้ที่ไฟล์นี้และ PixelFrame.ts โดยไม่ต้องแก้ logic ของหน้าจอ
 */
export const PIXEL = {
  px: 4, // ขนาด "พิกเซล" ของกรอบ (จุดภาพบนจอ)
  green: 0x5b9a3c,
  greenDark: 0x2f5a25,
  greenLight: 0x8cc063,
  wood: 0x8a5a2b,
  woodDark: 0x4a2f16,
  woodLight: 0xb98247,
  cream: 0xf3ead2,
  creamDark: 0xdcc9a0,
  stone: 0x8d8d8d,
  stoneDark: 0x5a5a5a,
  ink: '#2b2118',
  inkSoft: '#6b5638',
  inkMuted: '#9a8a72',
  light: '#fff6d5',
  accent: '#ffd84d',
  good: '#2f7a2a',
  warn: '#a2541e',
  bad: '#a23b1e',
} as const;

export type FrameVariant = 'paper' | 'wood' | 'green' | 'stone';
