import type Phaser from 'phaser';

/** สไตล์ตัวอักษรและสีของ UI (รวมไว้ที่เดียว) */
export const FONT_FAMILY = "'Sarabun', 'Noto Sans Thai', 'Leelawadee UI', Tahoma, 'Loma', sans-serif";

export const COLORS = {
  panel: 0x10141f,
  panelBorder: 0xe8d9a8,
  text: '#f4efe1',
  textDim: '#b9b3a3',
  accent: '#ffd84d',
  speaker: '#ffcf70',
} as const;

export function textStyle(size: number, color: string = COLORS.text): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    padding: { top: 4, bottom: 2 }, // เผื่อพื้นที่วรรณยุกต์/สระบนล่าง
  };
}
