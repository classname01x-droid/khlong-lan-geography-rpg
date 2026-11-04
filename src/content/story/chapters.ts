import { isPlayableLevel, LEVEL_SEQUENCE } from '../registry';
import type { ChapterSlot } from '../../core/campaign/Campaign';

/**
 * โครงเรื่องหลัก: ผู้เล่นเป็นนักสำรวจของครูเนม ได้รับภารกิจสร้าง "แผนที่ภูมิปัญญาอำเภอคลองลาน"
 * เดินทางตามลำดับ 4 ตำบล แล้วไขปริศนาสุดท้ายด้วยรหัส 4 ชิ้น
 *
 * ไฟล์นี้เป็น "ข้อมูล" ล้วน (ลำดับบท + บทสนทนาเชื่อมเหตุการณ์) — ตรรกะอยู่ที่ core/campaign/Campaign.ts
 * หมายเหตุ: เรื่องราวและสถานที่เป็นข้อมูลจำลองเพื่อการเรียนรู้
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
  // บทที่ 5 ยังไม่มีฉาก (ไม่ใช่ด่าน) → แสดง "ภารกิจถัดไปอยู่ระหว่างพัฒนา"
  { id: FINALE_CHAPTER_ID, levelId: null, order: 5, tambon: 'อำเภอคลองลาน', title: 'ไขปริศนาสุดท้าย', playable: false },
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
}

const NEM = 'ครูเนม';

export const CHAPTER_INTROS: readonly ChapterIntro[] = [
  {
    chapterId: 'sakngam',
    heading: 'บทที่ 1',
    fromChapterId: null,
    lines: [
      { speaker: NEM, text: 'ยินดีต้อนรับ นักสำรวจคนใหม่ของครู! ครูกำลังทำ "แผนที่ภูมิปัญญาอำเภอคลองลาน" เพื่อให้นักเรียนรุ่นต่อไปได้เรียนรู้' },
      { speaker: NEM, text: 'เราจะเดินทางผ่าน 4 ตำบลตามลำดับ แต่ละตำบลมีปริศนาภูมิศาสตร์ ไขได้จะได้รหัสลับ 1 ชิ้น ครบ 4 ชิ้นจึงไขปริศนาสุดท้ายได้' },
      { speaker: NEM, text: 'จุดแรกคือตำบลสักงาม ไปพบครูที่โรงเรียนได้เลย — ใช้ทิศ มาตราส่วน และระยะทางให้ดีนะ' },
    ],
  },
  {
    chapterId: 'level-2',
    heading: 'บทที่ 2',
    fromChapterId: 'sakngam',
    lines: [
      { speaker: NEM, text: 'เยี่ยมมาก! รหัสชิ้นแรก "{{code:sakngam}}" บันทึกลงแผนที่ภูมิปัญญาแล้ว ตำบลสักงามสำรวจเสร็จ' },
      { speaker: NEM, text: 'ภารกิจต่อไปอยู่ที่ตำบลคลองน้ำไหล ข้อมูลแหล่งน้ำของที่นั่นขัดแย้งกัน ต้องใช้สัญลักษณ์แผนที่และระดับความสูงตรวจให้ได้' },
      { speaker: NEM, text: 'เก็บของแล้วออกเดินทางกันเลย ครูจะรอที่โรงเรียนในตำบลคลองน้ำไหล' },
    ],
  },
  {
    chapterId: 'level-3',
    heading: 'บทที่ 3',
    fromChapterId: 'level-2',
    lines: [
      { speaker: NEM, text: 'รหัสชิ้นที่สอง "{{code:level-2}}" มาแล้ว! ตอนนี้แผนที่ภูมิปัญญามีสองตำบลแล้ว' },
      { speaker: NEM, text: 'ตำบลโป่งน้ำร้อนมีบันทึกสำรวจเก่าที่บอกพิกัดบ่อน้ำร้อนธรรมชาติ แต่อาจบันทึกผิด ต้องใช้พิกัดกริด E/N ตรวจสอบ' },
      { speaker: NEM, text: 'จำไว้ว่าพิกัดอย่างเดียวไม่พอ ต้องตรวจทิศ ระยะ และของจริงด้วย ไปกันเถอะ!' },
    ],
  },
  {
    chapterId: 'level-4',
    heading: 'บทที่ 4',
    fromChapterId: 'level-3',
    lines: [
      { speaker: NEM, text: 'รหัสชิ้นที่สาม "{{code:level-3}}" ครบสามตำบลแล้ว เหลืออีกเพียงตำบลเดียว!' },
      { speaker: NEM, text: 'ครูได้รับแผนที่ภูมิปัญญาของตำบลคลองลานพัฒนา แต่โดนน้ำจนข้อมูลบางส่วนเสียหาย (แหล่งเรียนรู้ในแผนที่เป็นข้อมูลจำลอง)' },
      { speaker: NEM, text: 'ต้องใช้ทุกทักษะที่เรียนมา: ระยะทาง ภูมิประเทศ และพิกัด ไปพบครูที่ศูนย์ภาคสนามนะ' },
    ],
  },
  {
    chapterId: FINALE_CHAPTER_ID,
    heading: 'บทที่ 5',
    fromChapterId: 'level-4',
    lines: [
      { speaker: NEM, text: 'รหัสครบทั้ง 4 ชิ้นแล้ว: {{code:sakngam}} · {{code:level-2}} · {{code:level-3}} · {{code:level-4}}' },
      { speaker: NEM, text: 'ถึงเวลาไขปริศนาสุดท้ายของอำเภอคลองลาน และประกอบแผนที่ภูมิปัญญาให้ครบทั้ง 4 ตำบล' },
    ],
  },
];

export function getChapter(id: string): ChapterSlot | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function getChapterIntro(id: string): ChapterIntro | undefined {
  return CHAPTER_INTROS.find((c) => c.chapterId === id);
}
