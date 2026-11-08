import { FINALE_LEVEL, isPlayableLevel, LEVEL_SEQUENCE } from '../registry';
import type { ChapterSlot } from '../../core/campaign/Campaign';

/**
 * โครงเรื่องหลัก (ปริศนาหีบสมบัติ): ครูเนมพบหีบไม้เก่าที่โรงเรียนสักงาม มีช่องรหัส 4 ช่อง และแผนที่เก่า
 * ที่ชี้ไปยัง 4 ชุมชน — นักสำรวจเดินทางตามลำดับ ไขปริศนาภูมิศาสตร์ของแต่ละตำบลเพื่อได้รหัส 1 ชิ้น
 * ครบ 4 ชิ้นจึงกลับมาเปิดหีบที่โรงเรียน (บทที่ 5)
 *
 * ไฟล์นี้เป็น "ข้อมูล" ล้วน (ลำดับบท + บทสนทนาเชื่อมเหตุการณ์) — ตรรกะอยู่ที่ core/campaign/Campaign.ts
 * หมายเหตุ: เรื่องหีบและสถานที่เป็นเรื่องแต่ง/ข้อมูลจำลองเพื่อการเรียนรู้ ไม่ใช่ประวัติจริงของชุมชน
 */
export const FINALE_CHAPTER_ID = 'finale';

/** ลำดับบท: 1 สักงาม → 2 คลองน้ำไหล → 3 โป่งน้ำร้อน → 4 คลองลานพัฒนา → 5 ไขปริศนาสุดท้าย */
export const CHAPTERS: readonly ChapterSlot[] = [
  ...LEVEL_SEQUENCE.map((s, i) => ({
    id: s.id,
    levelId: s.id,
    order: i + 1,
    tambon: s.tambon,
    title: s.missionTitle,
    playable: isPlayableLevel(s.id),
  })),
  // บทที่ 5 (บทสรุป ที่โรงเรียนบ้านสักงาม) — เข้าได้เมื่อจบบท 1–4 และมีรหัสครบ 4 ชิ้น
  {
    id: FINALE_CHAPTER_ID,
    levelId: FINALE_LEVEL.id,
    order: 5,
    tambon: FINALE_LEVEL.tambon,
    title: FINALE_LEVEL.title,
    playable: true,
    requiresCodesFrom: LEVEL_SEQUENCE.map((s) => s.id),
  },
];

export interface ChapterLine {
  speaker: string;
  text: string;
}

/** ฉากเชื่อมเรื่องก่อนเข้าแต่ละบท (แสดงเมื่อเริ่มบทใหม่ ไม่แสดงซ้ำตอนเล่นต่อกลางบท) */
export interface ChapterIntro {
  chapterId: string;
  /** ป้ายบท เช่น "บทที่ 2" */
  heading: string;
  /** ตำบลที่เดินทางมาจาก (null = จุดเริ่มต้นเรื่อง) — ใช้วาดเส้นทางบนแผนที่การเดินทาง */
  fromChapterId: string | null;
  lines: ChapterLine[];
  /** แสดงภาพหีบไม้เก่า (placeholder) และช่องรหัส 4 ช่องในฉากนี้ */
  chest?: boolean;
}

/** หมายเหตุว่าเรื่องหีบเป็นเรื่องแต่ง (แสดงในฉากเปิดเรื่องและฉากเปิดหีบ) */
export const CHEST_FICTION_NOTE = 'เรื่องหีบสมบัติเป็นเรื่องแต่งในเกม ไม่ใช่ประวัติจริงของชุมชน';

const NEM = 'ครูเนม';

export const CHAPTER_INTROS: readonly ChapterIntro[] = [
  {
    chapterId: 'sakngam',
    heading: 'บทที่ 1',
    fromChapterId: null,
    chest: true,
    lines: [
      { speaker: NEM, text: 'มาแล้วเหรอ! วันนี้ครูมีเรื่องลึกลับอยากให้ช่วย' },
      { speaker: NEM, text: 'เมื่อเช้าครูเจอหีบไม้เก่าใบนี้ในห้องเก็บเอกสาร แต่เปิดยังไงก็เปิดไม่ได้' },
      { speaker: NEM, text: 'บนหีบเขียนไว้ว่า "ผู้ที่ต้องการเปิดหีบ จงตามหารหัสจากความลับของชุมชนทั้งสี่"' },
      { speaker: NEM, text: 'ครูพบแผนที่เก่าอีกแผ่นหนึ่ง ชี้ไปที่สักงาม คลองน้ำไหล โป่งน้ำร้อน และคลองลานพัฒนา' },
      { speaker: NEM, text: 'ครูคิดว่าแต่ละชุมชนมีปริศนาที่ซ่อนรหัสไว้ ครบ 4 ชิ้นเมื่อไร เราจะกลับมาเปิดหีบด้วยกัน!' },
      { speaker: NEM, text: 'แต่ครูไม่รู้ว่ารหัสอยู่ตรงไหน เราต้องใช้แผนที่ ทิศทาง และเครื่องมือภูมิศาสตร์ช่วยสืบหา' },
    ],
  },
  {
    chapterId: 'level-2',
    heading: 'บทที่ 2',
    fromChapterId: 'sakngam',
    chest: true,
    lines: [
      { speaker: NEM, text: 'เยี่ยมมาก! เราได้รหัสชิ้นแรก "{{code:sakngam}}" แล้ว เหลืออีก 3 ชิ้น' },
      { speaker: NEM, text: 'แผนที่เก่าที่อยู่กับหีบบอกว่าปริศนาต่อไปอยู่ที่ตำบลคลองน้ำไหล' },
      { speaker: NEM, text: 'ข้อมูลแหล่งน้ำที่นั่นขัดแย้งกัน ต้องใช้สัญลักษณ์แผนที่และระดับความสูงตรวจให้ได้' },
      { speaker: NEM, text: 'ไปตามหารหัสชิ้นต่อไปกันเถอะ! ครูจะรอที่โรงเรียนในตำบลคลองน้ำไหล' },
    ],
  },
  {
    chapterId: 'level-3',
    heading: 'บทที่ 3',
    fromChapterId: 'level-2',
    chest: true,
    lines: [
      { speaker: NEM, text: 'รหัสหีบชิ้นที่สอง "{{code:level-2}}" มาแล้ว! เหลืออีก 2 ช่อง' },
      { speaker: NEM, text: 'แผนที่เก่าชี้ต่อไปที่ตำบลโป่งน้ำร้อน มีเรื่องเล่าว่าเคยมีชุมชนโบราณถูกตะกอนทับถมจนหายไป (ในเกมนี้เป็นสถานการณ์จำลอง ไม่ใช่ประวัติศาสตร์จริง)' },
      { speaker: NEM, text: 'เราจะใช้เส้นชั้นความสูงวิเคราะห์ว่าพื้นที่ไหนน่าจะเหมาะกับการตั้งถิ่นฐาน แล้วไปตรวจสอบภาคสนามก่อนสรุป' },
      { speaker: NEM, text: 'ไปตามหารหัสชิ้นที่สามกันเลย!' },
    ],
  },
  {
    chapterId: 'level-4',
    heading: 'บทที่ 4',
    fromChapterId: 'level-3',
    chest: true,
    lines: [
      { speaker: NEM, text: 'รหัสหีบชิ้นที่สาม "{{code:level-3}}" อยู่กับเราแล้ว เหลืออีกเพียงชิ้นเดียว!' },
      { speaker: NEM, text: 'ช่องสุดท้ายของแผนที่เก่าชี้ไปที่ตำบลคลองลานพัฒนา แต่แผนที่ส่วนนั้นโดนน้ำจนข้อมูลบางส่วนเสียหาย' },
      { speaker: NEM, text: 'ต้องใช้ทุกทักษะที่เรียนมา: ระยะทาง ภูมิประเทศ และพิกัด ไปพบครูที่ศูนย์ภาคสนามนะ' },
    ],
  },
  {
    chapterId: FINALE_CHAPTER_ID,
    heading: 'บทที่ 5',
    fromChapterId: 'level-4',
    chest: true,
    lines: [
      { speaker: NEM, text: 'เยี่ยมมาก! รหัสหีบครบ 4 ชิ้นแล้ว: {{code:sakngam}} · {{code:level-2}} · {{code:level-3}} · {{code:level-4}}' },
      { speaker: NEM, text: 'แต่ช่องรหัสบนหีบเรียงตามทักษะภูมิศาสตร์ ไม่ได้เรียงตามลำดับการเดินทาง ต้องจับคู่ให้ถูกจึงจะเปิดได้' },
      { speaker: NEM, text: 'กลับมาพบครูที่โรงเรียนบ้านสักงาม หีบไม้เก่ารอเราอยู่แล้ว!' },
    ],
  },
];

export function getChapter(id: string): ChapterSlot | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function getChapterIntro(id: string): ChapterIntro | undefined {
  return CHAPTER_INTROS.find((c) => c.chapterId === id);
}
