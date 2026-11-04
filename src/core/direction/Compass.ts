/**
 * ระบบทิศ 8 ทิศ
 * แกนของโลกเกม: x เพิ่มไปทางตะวันออก, y เพิ่มไปทางใต้ (ทิศเหนืออยู่ด้านบนจอเสมอ)
 */
export type Direction8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const DIRECTIONS_8: readonly Direction8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const THAI_DIRECTION: Record<Direction8, string> = {
  N: 'ทิศเหนือ',
  NE: 'ทิศตะวันออกเฉียงเหนือ',
  E: 'ทิศตะวันออก',
  SE: 'ทิศตะวันออกเฉียงใต้',
  S: 'ทิศใต้',
  SW: 'ทิศตะวันตกเฉียงใต้',
  W: 'ทิศตะวันตก',
  NW: 'ทิศตะวันตกเฉียงเหนือ',
};

/**
 * มุมแบริ่ง (องศา วัดตามเข็มนาฬิกาจากทิศเหนือ 0–360)
 * @param dx ระยะไปทางตะวันออก
 * @param dySouth ระยะไปทางใต้ (แกน y ของจอ)
 */
export function bearingDeg(dx: number, dySouth: number): number {
  const deg = (Math.atan2(dx, -dySouth) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function bearingToDirection8(bearing: number): Direction8 {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return DIRECTIONS_8[index];
}

/** ทิศจากเวกเตอร์; คืน null ถ้าเวกเตอร์เป็นศูนย์ */
export function directionFromVector(dx: number, dySouth: number): Direction8 | null {
  if (dx === 0 && dySouth === 0) return null;
  return bearingToDirection8(bearingDeg(dx, dySouth));
}
