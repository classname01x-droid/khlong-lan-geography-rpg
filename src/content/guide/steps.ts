import type { MicroStep, ObjectiveCondition } from '../types';

/**
 * ตัวช่วยเขียนขั้นย่อยแบบ "นำทางด้วยการกระทำ" ที่ใช้ซ้ำในทุกตำบล — ข้อความรูปแบบเดียวกันทั้งเกม
 * ทุกขั้นมี: เป้าหมาย · เครื่องมือ · วิธีทำ (กด/แตะอะไร) · ผลเมื่อสำเร็จ · คำแนะนำระดับ 2 (เครื่องมือ) · ระดับ 3 (คำถามช่วยคิด)
 * ตัวแปรปุ่ม {tap:...} {walk} {choose} {next} {tapmap} แปลงตามอุปกรณ์ใน core/guide/GuideText.ts
 */
type Extra = Partial<MicroStep>;

/** เดินไปพบ NPC ที่รู้ตำแหน่งแล้ว แล้วคุยจนจบ */
export function talkTo(o: {
  id: string;
  npcId: string;
  name: string;
  where: string;
  result: string;
  think: string;
  done: ObjectiveCondition;
  goal?: string;
  doneText?: string;
} & Extra): MicroStep {
  const { id, npcId, name, where, result, think, done, goal, doneText, ...rest } = o;
  return {
    id,
    goal: goal ?? `ไปคุยกับ${name}`,
    tools: ['ลูกศรนำทาง', 'ปุ่มคุย'],
    steps: [`${name}อยู่${where} — ดูลูกศรสีเหลืองที่ขอบจอ หรือเครื่องหมาย ! เหนือหัว`, '{walk} ไปใกล้ ๆ จนมีป้าย "คุย" ขึ้น', '{tap:talk} แล้ว{next}จนจบ'],
    result,
    tool: `{tap:guide} ดูตำแหน่ง${name}บนแผนที่ (จุด ! สีเหลือง) เทียบกับจุดสีแดงที่เป็นตัวเรา`,
    think,
    doneText: doneText ?? `✓ คุยกับ${name}แล้ว!`,
    target: { npcId },
    done,
    ...rest,
  };
}

/** ตอบคำถามในบทสนทนา (ตอบผิดได้คำใบ้ แล้วตอบใหม่) */
export function answerQuiz(o: {
  id: string;
  npcId: string;
  name: string;
  goal: string;
  result: string;
  tool: string;
  think: string;
  done: ObjectiveCondition;
  doneText?: string;
} & Extra): MicroStep {
  const { id, npcId, name, goal, result, tool, think, done, doneText, ...rest } = o;
  return {
    id,
    goal,
    tools: ['กล่องคำถาม'],
    steps: [`ถ้ายังไม่ได้คุย ไปหา${name}แล้ว{tap:talk}`, 'อ่านคำถามให้ครบ แล้ว{choose}ที่คิดว่าถูก', 'ถ้าผิด จะได้คำใบ้ แล้วเลือกใหม่ได้'],
    result,
    tool,
    think,
    doneText: doneText ?? '✓ ตอบถูกแล้ว!',
    target: { npcId },
    done,
    ...rest,
  };
}

/** กด "สำรวจ/ตรวจ" ที่จุดหนึ่ง (หมุด ป้าย จุดสำรวจ) */
export function inspectAt(o: {
  id: string;
  goal: string;
  find: string;
  result: string;
  tool: string;
  think: string;
  done: ObjectiveCondition;
  doneText?: string;
} & Extra): MicroStep {
  const { id, goal, find, result, tool, think, done, doneText, ...rest } = o;
  return {
    id,
    goal,
    tools: ['แผนที่', 'ปุ่มสำรวจ'],
    steps: [find, '{walk} ไปใกล้ ๆ จนมีป้าย "สำรวจ" ขึ้น', '{tap:inspect} แล้ว{next}'],
    result,
    tool,
    think,
    doneText: doneText ?? '✓ บันทึกลงสมุดแล้ว!',
    done,
    ...rest,
  };
}

/** เปิดกระดาน/หน้าเครื่องมือ (ขั้นแยกจาก "เลือกคำตอบ") */
export function openTool(o: {
  id: string;
  goal: string;
  button: 'routes' | 'analysis' | 'compare';
  look: string[];
  result: string;
  tool: string;
  think: string;
  done: ObjectiveCondition;
  doneText?: string;
} & Extra): MicroStep {
  const { id, goal, button, look, result, tool, think, done, doneText, ...rest } = o;
  return {
    id,
    goal,
    tools: [button === 'routes' ? 'กระดานวิเคราะห์เส้นทาง' : button === 'compare' ? 'หน้าเทียบแผนที่' : 'กระดานวิเคราะห์'],
    steps: [`{tap:guide} (หรือ{tap:${button}})`, ...look],
    result,
    tool,
    think,
    doneText: doneText ?? '✓ เปิดแล้ว!',
    action: button,
    done,
    ...rest,
  };
}

/** ปักหมุดบนแผนที่ (เลื่อนหมุด → ปัก → เลือกประเภท) */
export function pinOnMap(o: { id: string; place: string; kind: string; think: string; done: ObjectiveCondition } & Extra): MicroStep {
  const { id, place, kind, think, done, ...rest } = o;
  return {
    id,
    goal: `ปักหมุด${place}บนแผนที่`,
    tools: ['แผนที่', 'หมุด'],
    steps: [`ยืนใกล้${place} แล้ว{tap:guide}`, `{tapmap} ให้หมุดอยู่ตรง${place}`, `{tap:pinHere} แล้ว{choose}${kind}`],
    result: 'ครูเนมได้รับตำแหน่งผ่านสมุดภาคสนาม · ถ้ายังไม่ถูก ระบบบอกว่าข้อใดยังไม่ตรง (ตำแหน่ง ประเภท หรือหลักฐาน)',
    tool: 'ป้ายเหนือหมุดบอกพิกัดของหมุด — เทียบกับจุดสีแดงที่เป็นตัวเรา · ต้องยืนใกล้จุดที่ปัก',
    think,
    doneText: '✓ ปักหมุดสำเร็จ!',
    action: 'pin',
    done,
    ...rest,
  };
}

/** ฟังครูเนมสรุปผลและรับรหัส (เริ่มเองหลังปักหมุดสำเร็จ) */
export function hearReport(o: { id: string; code: string; done: ObjectiveCondition } & Extra): MicroStep {
  const { id, code, done, ...rest } = o;
  return {
    id,
    goal: `ฟังครูเนมสรุปผล แล้วรับ${code}`,
    tools: ['สมุดภาคสนาม'],
    steps: ['ครูเนมติดต่อมาทางสมุดภาคสนามเอง', '{next}จนจบ'],
    result: `ได้${code} และไปบทถัดไปได้`,
    tool: 'ถ้าข้อความหายไป {tap:notebook} ดูหน้า "หลักฐาน/ข้อความ"',
    think: 'บทนี้เราใช้ทักษะภูมิศาสตร์อะไรบ้าง?',
    doneText: '✓ จบบทแล้ว!',
    done,
    ...rest,
  };
}
