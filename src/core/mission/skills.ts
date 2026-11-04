/** ทักษะภูมิศาสตร์ที่ระบบติดตามว่าผู้เล่นได้ใช้ (แสดงในหน้าสรุปผล) */
export type SkillId =
  | 'direction'
  | 'scale'
  | 'straight-vs-route'
  | 'landmark'
  | 'grid-coordinates'
  | 'odometer'
  | 'elevation'
  | 'map-symbols'
  | 'map-compare'
  | 'grid-reference'
  | 'relative-position';

export const SKILL_LABEL: Record<SkillId, string> = {
  direction: 'การใช้ทิศทาง 8 ทิศ',
  scale: 'การแปลงมาตราส่วนแผนที่ (ซม. → เมตร)',
  'straight-vs-route': 'การเปรียบเทียบระยะเส้นตรงกับระยะตามเส้นทาง',
  landmark: 'การใช้จุดสังเกตยืนยันเส้นทาง',
  'grid-coordinates': 'การระบุตำแหน่งด้วยพิกัดตาราง',
  odometer: 'การวัดระยะทางจากการเดินจริง',
  elevation: 'การอ่านระดับความสูงเพื่อหาทิศทางน้ำไหล',
  'map-symbols': 'การอ่านสัญลักษณ์แผนที่',
  'map-compare': 'การเปรียบเทียบข้อมูลจากแผนที่สองแผ่น',
  'grid-reference': 'การอ่านพิกัดกริด (E เพิ่มไปตะวันออก · N เพิ่มไปเหนือ)',
  'relative-position': 'การบอกตำแหน่งสัมพัทธ์ด้วยทิศและระยะจากจุดอ้างอิง',
};

export const ALL_SKILLS = Object.keys(SKILL_LABEL) as SkillId[];

/** ชุดทักษะเดิมของด่าน 1 (ใช้เมื่อด่านไม่ได้กำหนด skills เอง — หน้าสรุปผลด่าน 1 จึงไม่เปลี่ยน) */
export const DEFAULT_LEVEL_SKILLS: SkillId[] = [
  'direction',
  'scale',
  'straight-vs-route',
  'landmark',
  'grid-coordinates',
  'odometer',
];
