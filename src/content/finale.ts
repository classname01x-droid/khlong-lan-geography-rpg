import { LEVEL_SEQUENCE, LEVELS } from './registry';

/**
 * ข้อมูลฉากจบเกม — แผนที่ภูมิปัญญา 4 ตำบล (แสดงใน EndingScene และบทที่ 5)
 * รหัสลับแต่ละชิ้นดึงจากข้อมูลตอนจบของแต่ละด่าน (level.ending.codePiece) ไม่เขียนซ้ำที่นี่
 *
 * หมายเหตุ: สถานที่และภูมิปัญญาเป็นข้อมูลจำลองในเกม ต้องตรวจสอบกับชุมชนจริงก่อนนำไปสอน
 */
export interface FinaleEntry {
  levelId: string;
  /** สถานที่ที่ผู้เล่นค้นพบในด่าน (ข้อมูลจำลอง) */
  site: string;
  /** ผลการเรียนรู้หลักของด่าน */
  learning: string;
}

export const FINALE_ENTRIES: readonly FinaleEntry[] = [
  { levelId: 'sakngam', site: 'แหล่งผ้าปักบ้านไหนเจียว (ข้อมูลจำลอง)', learning: 'มาตราส่วน ทิศ 8 ทิศ ระยะเส้นตรงกับระยะตามเส้นทาง' },
  { levelId: 'level-2', site: 'ตาน้ำต้นลำห้วย (ข้อมูลจำลอง)', learning: 'สัญลักษณ์แผนที่ ระดับความสูง ทิศทางน้ำไหล' },
  { levelId: 'level-3', site: 'บ่อน้ำร้อนธรรมชาติ (ข้อมูลจำลอง)', learning: 'พิกัดกริด E/N จุดกำเนิด ตำแหน่งสัมพัทธ์' },
  { levelId: 'level-4', site: 'ศูนย์เรียนรู้ภูมิปัญญาชุมชน (ข้อมูลจำลอง)', learning: 'บูรณาการหลักฐาน: ระยะทาง ภูมิประเทศ และพิกัด' },
];

export interface FinaleRow extends FinaleEntry {
  tambon: string;
  codeIndex: number;
  /** รหัสลับของด่าน (จากข้อมูลตอนจบ) */
  code: string | null;
}

/** แถวของแผนที่ภูมิปัญญา เรียงตามลำดับตำบล พร้อมรหัสลับจากข้อมูลด่าน */
export function finaleRows(): FinaleRow[] {
  return LEVEL_SEQUENCE.map((slot) => {
    const entry = FINALE_ENTRIES.find((e) => e.levelId === slot.id);
    const level = LEVELS.find((l) => l.id === slot.id);
    return {
      levelId: slot.id,
      tambon: slot.tambon,
      site: entry?.site ?? '-',
      learning: entry?.learning ?? '-',
      codeIndex: slot.codePieceIndex,
      code: level?.ending?.codePiece?.value ?? null,
    };
  });
}
