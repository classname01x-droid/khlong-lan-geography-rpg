/** ทักษะภูมิศาสตร์ที่ระบบติดตามว่าผู้เล่นได้ใช้ (แสดงในหน้าสรุปผล) */
export type SkillId = 'direction' | 'scale' | 'straight-vs-route' | 'landmark' | 'grid-coordinates' | 'odometer';

export const SKILL_LABEL: Record<SkillId, string> = {
  direction: 'การใช้ทิศทาง 8 ทิศ',
  scale: 'การแปลงมาตราส่วนแผนที่ (ซม. → เมตร)',
  'straight-vs-route': 'การเปรียบเทียบระยะเส้นตรงกับระยะตามเส้นทาง',
  landmark: 'การใช้จุดสังเกตยืนยันเส้นทาง',
  'grid-coordinates': 'การระบุตำแหน่งด้วยพิกัดตาราง',
  odometer: 'การวัดระยะทางจากการเดินจริง',
};

export const ALL_SKILLS = Object.keys(SKILL_LABEL) as SkillId[];
