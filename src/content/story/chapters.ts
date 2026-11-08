import { FINALE_LEVEL, isPlayableLevel, LEVEL_SEQUENCE } from '../registry';
import type { ChapterSlot } from '../../core/campaign/Campaign';

/**
 * โครงเรื่องหลัก (ตำนานพญาจระเข้ผู้พิทักษ์คลองลาน): Intro 3 ฉาก → ผู้เล่นเป็นผู้นำชุมชนคนใหม่
 * ช่วยชาวบ้าน 4 ตำบลด้วยภูมิศาสตร์ ได้ "คำพิทักษ์" ตำบลละ 1 คำ (ข้อมูลเดิม codePiece)
 * ครบ 4 คำจึงกลับมาชำระมลพิษที่ศาลพญาจระเข้ข้างโรงเรียน (บทที่ 5)
 *
 * ไฟล์นี้เป็น "ข้อมูล" ล้วน (ลำดับบท + บทสนทนาเชื่อมเหตุการณ์) — ตรรกะอยู่ที่ core/campaign/Campaign.ts
 * หมายเหตุ: ตำนานพญาจระเข้และสถานที่เป็นเรื่องแต่ง/ข้อมูลจำลองเพื่อการเรียนรู้ ไม่ใช่ประวัติจริงของชุมชน
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
  /** แสดงช่องคำพิทักษ์ 4 ช่อง (คำที่ได้แล้ว / ?) */
  words?: boolean;
}

/** หมายเหตุว่าตำนานเป็นเรื่องแต่ง (แสดงใน Intro และฉากเชื่อมบท) */
export const INTRO_FICTION_NOTE = 'ตำนานพญาจระเข้เป็นเรื่องแต่งในเกม แต่ปัญหาการตัดไม้และมลพิษในลำน้ำเป็นเรื่องจริงที่เราต้องช่วยกันดูแล';
export const LEGEND_NOTE = 'ตำนานพญาจระเข้เป็นเรื่องแต่งในเกม ไม่ใช่ประวัติจริงของชุมชน';

/** Intro 3 ฉากก่อนเริ่มเกมใหม่ (ภาพอยู่ใน public/intro/) */
export const INTRO_SCENES: readonly { title: string; text: string; image: string }[] = [
  {
    title: 'คลองลานในอดีต',
    text: 'กาลครั้งหนึ่ง คลองลานอุดมสมบูรณ์ ป่าเขียวขจี น้ำตกใส ชาวบ้านทำนา ทอผ้า และเด็ก ๆ เล่นน้ำอย่างมีความสุข โดยมีพญาจระเข้ผู้พิทักษ์คอยดูแลลำน้ำคลองลาน',
    image: 'intro/scene1.jpg',
  },
  {
    title: 'พญาจระเข้พิโรธ',
    text: 'แต่เมื่อมนุษย์ใช้ทรัพยากรอย่างไม่ระวัง ตัดไม้ ทำลายป่า และปล่อยสารเคมีลงสู่ลำน้ำ พญาจระเข้ผู้พิทักษ์จึงพิโรธ ธรรมชาติแปรปรวน และภัยร้ายคุกคามชุมชน…',
    image: 'intro/scene2.jpg',
  },
  {
    title: 'ผู้นำชุมชนคนใหม่',
    text: 'ณ วันนี้ เธอคือผู้นำชุมชนคนใหม่ ช่วยชาวบ้านทั้ง 4 ตำบลด้วยความรู้ภูมิศาสตร์ รวบรวม "คำพิทักษ์" ให้ครบ เพื่อชำระมลพิษและปลดปล่อยพญาจระเข้ให้กลับมาปกป้องคลองลานอีกครั้ง!',
    image: 'intro/scene3.jpg',
  },
];

const NEM = 'ครูเนม';

export const CHAPTER_INTROS: readonly ChapterIntro[] = [
  {
    chapterId: 'sakngam',
    heading: 'บทที่ 1',
    fromChapterId: null,
    words: true,
    lines: [
      { speaker: NEM, text: 'ยินดีต้อนรับ ผู้นำชุมชนคนใหม่! ครูเนมจะคอยช่วยเธอเอง' },
      { speaker: NEM, text: 'ตำนานเล่าว่า พญาจระเข้จะสงบลงได้ด้วย "คำพิทักษ์" 4 คำ จากภูมิปัญญาของ 4 ชุมชน' },
      { speaker: NEM, text: 'สักงาม คลองน้ำไหล โป่งน้ำร้อน คลองลานพัฒนา — ช่วยชาวบ้านแต่ละตำบล จะได้คำพิทักษ์ทีละคำ' },
      { speaker: NEM, text: 'ครบ 4 คำเมื่อไร เราจะกลับมาที่ศาลพญาจระเข้ข้างโรงเรียน ชำระมลพิษด้วยกัน!' },
      { speaker: NEM, text: 'เริ่มที่สักงามก่อน ใช้แผนที่ ทิศทาง และเครื่องมือภูมิศาสตร์ช่วยชาวบ้านนะ' },
    ],
  },
  {
    chapterId: 'level-2',
    heading: 'บทที่ 2',
    fromChapterId: 'sakngam',
    words: true,
    lines: [
      { speaker: NEM, text: 'เยี่ยมมาก! ได้คำพิทักษ์คำแรก "{{code:sakngam}}" แล้ว เหลืออีก 3 คำ' },
      { speaker: NEM, text: 'ชาวบ้านตำบลคลองน้ำไหลกำลังเดือดร้อน ข้อมูลแหล่งน้ำที่นั่นขัดแย้งกัน' },
      { speaker: NEM, text: 'ต้องใช้สัญลักษณ์แผนที่และระดับความสูงตรวจให้ได้ ครูจะรอที่โรงเรียนในตำบลคลองน้ำไหล' },
    ],
  },
  {
    chapterId: 'level-3',
    heading: 'บทที่ 3',
    fromChapterId: 'level-2',
    words: true,
    lines: [
      { speaker: NEM, text: 'คำพิทักษ์คำที่สอง "{{code:level-2}}" มาแล้ว! เหลืออีก 2 คำ' },
      { speaker: NEM, text: 'ที่ตำบลโป่งน้ำร้อน มีเรื่องเล่าว่าเคยมีชุมชนโบราณถูกตะกอนทับถมจนหายไป (ในเกมนี้เป็นสถานการณ์จำลอง ไม่ใช่ประวัติศาสตร์จริง)' },
      { speaker: NEM, text: 'เราจะใช้เส้นชั้นความสูงหาพื้นที่ที่เหมาะกับการตั้งถิ่นฐาน แล้วไปตรวจสอบภาคสนามก่อนสรุป' },
    ],
  },
  {
    chapterId: 'level-4',
    heading: 'บทที่ 4',
    fromChapterId: 'level-3',
    words: true,
    lines: [
      { speaker: NEM, text: 'คำพิทักษ์คำที่สาม "{{code:level-3}}" อยู่กับเราแล้ว เหลืออีกเพียงคำเดียว!' },
      { speaker: NEM, text: 'ตำบลคลองลานพัฒนาต้องการให้ช่วยหาแหล่งเรียนรู้ แต่แผนที่ส่วนนั้นโดนน้ำจนข้อมูลบางส่วนเสียหาย' },
      { speaker: NEM, text: 'ต้องใช้ทุกทักษะที่เรียนมา: ระยะทาง ภูมิประเทศ และพิกัด ไปพบครูที่ศูนย์ภาคสนามนะ' },
    ],
  },
  {
    chapterId: FINALE_CHAPTER_ID,
    heading: 'บทที่ 5',
    fromChapterId: 'level-4',
    words: true,
    lines: [
      { speaker: NEM, text: 'เยี่ยมมาก! คำพิทักษ์ครบ 4 คำแล้ว: {{code:sakngam}} · {{code:level-2}} · {{code:level-3}} · {{code:level-4}}' },
      { speaker: NEM, text: 'แต่ช่องบนศาลพญาจระเข้เรียงตามทักษะภูมิศาสตร์ ไม่ได้เรียงตามลำดับการเดินทาง ต้องวางให้ถูกช่อง' },
      { speaker: NEM, text: 'กลับมาที่โรงเรียนบ้านสักงาม แล้วไปชำระมลพิษที่ศาลพญาจระเข้ด้วยกัน!' },
    ],
  },
];

export function getChapter(id: string): ChapterSlot | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function getChapterIntro(id: string): ChapterIntro | undefined {
  return CHAPTER_INTROS.find((c) => c.chapterId === id);
}
