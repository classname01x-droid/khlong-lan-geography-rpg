import { isPlayableLevel, LEVEL_SEQUENCE } from '../registry';
import type { ChapterSlot } from '../../core/campaign/Campaign';

/**
 * โครงเรื่องหลัก "คลองลาน — ตำนานพญาจระเข้ผู้พิทักษ์":
 * Intro 3 ภาพ → Golden Time (ครั้งเดียว) → 4 ด่านช่วยชาวบ้าน (ได้เหรียญ + ศรัทธา) → ร้านค้า → ต่อสู้พญาจระเข้ → ฉากจบ
 * ผู้เล่นเป็นผู้นำชุมชนที่ช่วยปลดปล่อยพญาจระเข้ผู้พิทักษ์จากมลพิษ (ชำระล้าง ไม่ใช่สังหาร)
 *
 * ไฟล์นี้เป็น "ข้อมูล" ล้วน (ลำดับบท + บทสนทนาเชื่อมเหตุการณ์) — ตรรกะอยู่ที่ core/campaign/Campaign.ts
 * หมายเหตุ: ตำนานพญาจระเข้และสถานที่เป็นเรื่องแต่ง/ข้อมูลจำลองเพื่อการเรียนรู้
 */
export const SHOP_CHAPTER_ID = 'shop';
export const BOSS_CHAPTER_ID = 'boss';

/** ลำดับบท: 1–4 ตำบล → 5 ร้านค้า → 6 พญาจระเข้ */
export const CHAPTERS: readonly ChapterSlot[] = [
  ...LEVEL_SEQUENCE.map((s, i) => ({
    id: s.id,
    levelId: s.id,
    order: i + 1,
    tambon: s.tambon,
    title: s.missionTitle,
    playable: isPlayableLevel(s.id),
  })),
  { id: SHOP_CHAPTER_ID, levelId: null, order: 5, tambon: 'ร้านค้าคลองลาน', title: 'เตรียมอาวุธและเกราะ', playable: true, kind: 'shop' },
  { id: BOSS_CHAPTER_ID, levelId: null, order: 6, tambon: 'น้ำตกคลองลาน', title: 'ชำระมลพิษพญาจระเข้', playable: true, kind: 'boss' },
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

/** หมายเหตุว่าตำนานเป็นเรื่องแต่ง (แสดงในฉากเชื่อมบท) */
export const LEGEND_NOTE = 'ตำนานพญาจระเข้เป็นเรื่องแต่งในเกม ไม่ใช่ประวัติจริงของชุมชน';

/** Intro 3 ฉากก่อนเริ่มเกมใหม่ (ภาพอยู่ใน public/intro/ — ข้อความเรียงทีละประโยคตามฉาก) */
export const INTRO_SCENES: readonly { title: string; sentences: readonly string[]; image: string }[] = [
  {
    title: 'คลองลานในอดีต',
    sentences: ['กาลครั้งหนึ่ง คลองลานเคยเป็นดินแดนอันอุดมสมบูรณ์', 'ผู้คนและธรรมชาติอยู่ร่วมกันอย่างสงบสุข'],
    image: 'intro/scene1.jpg',
  },
  {
    title: 'พญาจระเข้ถูกครอบงำ',
    sentences: ['มนุษย์ทำลายป่าและสายน้ำ', 'จนพญาจระเข้ผู้พิทักษ์ถูกพลังมลพิษครอบงำ'],
    image: 'intro/scene2.jpg',
  },
  {
    title: 'ผู้นำชุมชนคนใหม่',
    sentences: ['เจ้าคือความหวังของคลองลาน', 'จงรวบรวมพลังศรัทธาและช่วยปลดปล่อยผู้พิทักษ์!'],
    image: 'intro/scene3.jpg',
  },
];

const NEM = 'ผู้ใหญ่บ้าน';

export const CHAPTER_INTROS: readonly ChapterIntro[] = [
  {
    chapterId: 'sakngam',
    heading: 'บทที่ 1',
    fromChapterId: null,
    lines: [
      { speaker: NEM, text: 'ช่วยชาวบ้านด้วยความรู้ภูมิศาสตร์ แล้วพวกเขาจะมอบเหรียญและศรัทธาให้เจ้า' },
      { speaker: NEM, text: 'เริ่มที่ตำบลสักงามก่อน ตามลูกศรไปหาชาวบ้านได้เลย' },
    ],
  },
  {
    chapterId: 'level-2',
    heading: 'บทที่ 2',
    fromChapterId: 'sakngam',
    lines: [{ speaker: NEM, text: 'เก่งมาก! ต่อไปที่ตำบลคลองน้ำไหล ชาวบ้านรอความช่วยเหลืออยู่' }],
  },
  {
    chapterId: 'level-3',
    heading: 'บทที่ 3',
    fromChapterId: 'level-2',
    lines: [{ speaker: NEM, text: 'ไปต่อที่ตำบลโป่งน้ำร้อน ดูตัวเลขความสูงบนแผนที่ช่วยตอบได้' }],
  },
  {
    chapterId: 'level-4',
    heading: 'บทที่ 4',
    fromChapterId: 'level-3',
    lines: [{ speaker: NEM, text: 'ตำบลสุดท้าย คลองลานพัฒนา ช่วยเสร็จแล้วไปร้านค้าเตรียมตัวสู้เลย' }],
  },
];

export function getChapter(id: string): ChapterSlot | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

export function getChapterIntro(id: string): ChapterIntro | undefined {
  return CHAPTER_INTROS.find((c) => c.chapterId === id);
}
