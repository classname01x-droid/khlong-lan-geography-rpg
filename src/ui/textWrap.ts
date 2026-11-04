/**
 * ตัดบรรทัดภาษาไทย — ภาษาไทยไม่เว้นวรรคระหว่างคำ ระบบ word wrap ของ Phaser
 * (ตัดที่ช่องว่าง) จึงใช้ไม่ได้ ใช้ Intl.Segmenter ตัดคำแล้ววัดความกว้างจริงแทน
 */
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) throw new Error('ไม่สามารถสร้าง canvas สำหรับวัดตัวอักษร');
    measureCtx = ctx;
  }
  return measureCtx;
}

function segmentWords(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('th', { granularity: 'word' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  // fallback: ตัดตามกลุ่มตัวอักษร (ไม่แยกสระ/วรรณยุกต์ออกจากพยัญชนะ)
  return text.match(/[฀-๿]|[^฀-๿]+/g) ?? [text];
}

export function wrapThaiText(text: string, maxWidthPx: number, font: string): string {
  const ctx = getMeasureContext();
  ctx.font = font;
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of segmentWords(paragraph)) {
      const candidate = line + word;
      if (line !== '' && ctx.measureText(candidate).width > maxWidthPx) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}
