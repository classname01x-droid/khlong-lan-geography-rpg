/**
 * บทแนะนำแบบโต้ตอบสำหรับผู้เล่นใหม่ (ตรรกะล้วน ไม่ผูกกับ Phaser/DOM — ทดสอบได้)
 *
 * เล่นในฉากแรกของบทที่ 1 (ตำบลสักงาม) โดยแทรกอยู่ในเนื้อเรื่องเดิม: ครูเนมชวนฝึกใช้เครื่องมือ
 * ก่อนออกเดินทางไปศาลาชุมชน — ไม่เปลี่ยนบทพูด ฉาก ปริศนา หรือคำตอบ และไม่บังคับลำดับภารกิจหลัก
 * (ผู้เล่นทำอะไรก่อนก็ได้ ขั้นที่ทำไปแล้วจะผ่านเอง)
 *
 * ข้อความทุกขั้นบอกเฉพาะ "วิธีใช้ปุ่ม/เครื่องมือ" — ไม่บอกตำแหน่งลับ เส้นทางที่ถูก หรือคำตอบปริศนา
 * (unit test ตรวจข้อความทุกขั้นกับชื่อสถานที่ลับและคำตอบของทุกด่าน)
 */

/** ด่านที่มีบทแนะนำ (ด่านแรกของภารกิจหลัก) */
export const TUTORIAL_LEVEL_ID = 'sakngam';
/** NPC ที่บทแนะนำให้เดินไปหา (ผู้มอบภารกิจในฉากที่ 1 — ไม่ใช่ข้อมูลลับ) */
export const TUTORIAL_NPC_ID = 'teacher-nem';

/** ระยะเดินขั้นต่ำของขั้น "ลองเดิน" (เมตร) */
export const TUTORIAL_MOVE_METERS = 15;
/** ระยะที่ต้องเดินหลังกดวัดระยะ (เมตร = 3 ช่อง) */
export const TUTORIAL_MEASURE_METERS = 30;

export type TutorialStepId = 'move' | 'approach' | 'talk' | 'notebook' | 'map' | 'measure' | 'measure-walk' | 'finish';

export const TUTORIAL_STEPS: readonly TutorialStepId[] = ['move', 'approach', 'talk', 'notebook', 'map', 'measure', 'measure-walk', 'finish'];

/** เหตุการณ์ที่บทแนะนำจดไว้ (เปิดแล้วปิดหน้าต่าง · แตะปุ่มเริ่มภารกิจ) */
export type TutorialEvent = 'map' | 'notebook' | 'finish';

/** สิ่งที่ผู้เล่นต้องใช้ในขั้นนี้ (ให้ชั้น UI ไฮไลต์) */
export type TutorialHighlight = 'joystick' | 'interact' | 'next' | 'notebook' | 'map' | 'measure' | 'close' | 'status' | 'tracker';

/**
 * สถานะบทแนะนำที่บันทึกใน ProgressStore (ช่อง `tutorial` — ไม่บังคับ ข้อมูลรุ่นเก่าไม่มีช่องนี้)
 *   active   กำลังเล่นบทแนะนำ
 *   done     ผ่านครบทุกขั้น
 *   skipped  ผู้เล่นกดข้าม (ภารกิจหลักเล่นต่อตามปกติ)
 */
export interface TutorialSave {
  status: 'active' | 'done' | 'skipped';
  /** ขั้นที่ผ่านแล้ว (ตามลำดับ) */
  done: TutorialStepId[];
  events: TutorialEvent[];
  /** เวลาที่จบ/ข้าม (ISO) */
  endedAt?: string;
}

/** สถานะเกมที่บทแนะนำใช้ตัดสินว่าผ่านขั้นหรือยัง (สร้างจาก GameSession) */
export interface TutorialInput {
  mode: string;
  /** ระยะทางเดินรวมในด่าน (เมตร) */
  totalMeters: number;
  /** ระยะที่วัดตั้งแต่กดวัดระยะครั้งล่าสุด (เมตร) */
  tripMeters: number;
  /** ยืนอยู่ในระยะคุยกับครูเนมแล้ว */
  nearNpc: boolean;
  /** คุยกับครูเนมรับภารกิจแล้ว (ผ่านฉากที่ 1) */
  talked: boolean;
  /** เคยกดวัดระยะแล้ว */
  measured: boolean;
}

export function newTutorialSave(): TutorialSave {
  return { status: 'active', done: [], events: [] };
}

/** อ่านข้อมูลบทแนะนำที่บันทึกไว้ (ข้อมูลเสีย → null) */
export function parseTutorialSave(raw: unknown): TutorialSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.status !== 'active' && d.status !== 'done' && d.status !== 'skipped') return null;
  const done = Array.isArray(d.done) ? (d.done.filter((s) => TUTORIAL_STEPS.includes(s as TutorialStepId)) as TutorialStepId[]) : [];
  const events = Array.isArray(d.events) ? (d.events.filter((e) => e === 'map' || e === 'notebook' || e === 'finish') as TutorialEvent[]) : [];
  return { status: d.status, done, events, ...(typeof d.endedAt === 'string' ? { endedAt: d.endedAt } : {}) };
}

/**
 * ควรเริ่มบทแนะนำหรือไม่ เมื่อเข้าด่าน
 *   - มีสถานะบันทึกแล้ว → ตามนั้น (active = เล่นต่อจากขั้นเดิม)
 *   - ข้อมูลรุ่นเก่า (ก่อนมีบทแนะนำ) ที่มีความคืบหน้าแล้ว = ผู้เล่นที่เคยเล่น → ไม่แสดง
 *   - ไม่มีบันทึกเลย = ผู้เล่นใหม่ → เริ่มบทแนะนำ
 */
export function shouldRunTutorial(levelId: string, saved: TutorialSave | null, hasAnySave: boolean): boolean {
  if (levelId !== TUTORIAL_LEVEL_ID) return false;
  if (saved) return saved.status === 'active';
  return !hasAnySave;
}

function satisfied(step: TutorialStepId, i: TutorialInput, events: readonly TutorialEvent[]): boolean {
  switch (step) {
    case 'move':
      return i.totalMeters >= TUTORIAL_MOVE_METERS || i.talked;
    case 'approach':
      return i.nearNpc || i.talked;
    case 'talk':
      return i.talked;
    case 'notebook':
      return events.includes('notebook');
    case 'map':
      return events.includes('map');
    case 'measure':
      return i.measured;
    case 'measure-walk':
      return i.measured && i.tripMeters >= TUTORIAL_MEASURE_METERS;
    case 'finish':
      return events.includes('finish');
  }
}

/** ขั้นปัจจุบัน = ขั้นแรกที่ยังไม่ผ่าน (null = จบแล้ว/ข้ามแล้ว) */
export function currentTutorialStep(save: TutorialSave): TutorialStepId | null {
  if (save.status !== 'active') return null;
  return TUTORIAL_STEPS.find((s) => !save.done.includes(s)) ?? null;
}

/**
 * ตัวควบคุมบทแนะนำ: รับสถานะเกมทุกเฟรม → ผ่านขั้นที่ทำสำเร็จแล้ว (ตามลำดับ)
 * update()/event()/skip() คืน true เมื่อสถานะเปลี่ยน (ผู้เรียกควรบันทึก)
 */
export class TutorialRun {
  private prevMode = '';

  constructor(private state: TutorialSave = newTutorialSave()) {}

  get save(): TutorialSave {
    return this.state;
  }

  get active(): boolean {
    return this.state.status === 'active';
  }

  get step(): TutorialStepId | null {
    return currentTutorialStep(this.state);
  }

  /** ลำดับขั้นปัจจุบัน (เริ่ม 1) */
  get stepNumber(): number {
    const s = this.step;
    return s ? TUTORIAL_STEPS.indexOf(s) + 1 : TUTORIAL_STEPS.length;
  }

  /** จดเหตุการณ์ (ไม่ซ้ำ) */
  event(e: TutorialEvent, input?: TutorialInput): boolean {
    if (!this.active || this.state.events.includes(e)) return false;
    this.state = { ...this.state, events: [...this.state.events, e] };
    if (input) this.advance(input);
    return true;
  }

  update(input: TutorialInput, now = new Date()): boolean {
    if (!this.active) return false;
    let changed = false;
    // เปิดแล้วปิดหน้าต่าง (กลับมาเดินต่อ) = ใช้เป็นแล้ว
    if (this.prevMode && this.prevMode !== input.mode) {
      if (this.prevMode === 'map') changed = this.event('map') || changed;
      if (this.prevMode === 'notebook') changed = this.event('notebook') || changed;
    }
    this.prevMode = input.mode;
    return this.advance(input, now) || changed;
  }

  private advance(input: TutorialInput, now = new Date()): boolean {
    let changed = false;
    for (const step of TUTORIAL_STEPS) {
      if (this.state.done.includes(step)) continue;
      if (!satisfied(step, input, this.state.events)) break;
      this.state = { ...this.state, done: [...this.state.done, step] };
      changed = true;
    }
    if (this.state.done.length === TUTORIAL_STEPS.length) {
      this.state = { ...this.state, status: 'done', endedAt: now.toISOString() };
      changed = true;
    }
    return changed;
  }

  /** ข้ามบทแนะนำ — ภารกิจหลัก/ฉากของเนื้อเรื่องไม่ถูกข้าม (บทแนะนำไม่ได้กั้นเนื้อเรื่อง) */
  skip(now = new Date()): boolean {
    if (!this.active) return false;
    this.state = { ...this.state, status: 'skipped', endedAt: now.toISOString() };
    return true;
  }
}

/* ---------------- ข้อความแต่ละขั้น ---------------- */

export interface TutorialView {
  step: TutorialStepId;
  /** ขั้นที่ n จากทั้งหมด */
  index: number;
  total: number;
  title: string;
  /** ข้อความสั้นภาษาไทย (คำในวงเล็บเหลี่ยม [..] = ชื่อปุ่ม/แป้นที่ต้องใช้ — ชั้น UI แสดงเป็นป้ายปุ่ม) */
  text: string;
  /** ความคืบหน้าในขั้นนี้ (เช่น ระยะที่วัด) */
  progress: string | null;
  highlight: TutorialHighlight | null;
  /** ขั้นสุดท้าย: แสดงปุ่ม "เริ่มภารกิจ" */
  finishButton: boolean;
}

interface StepText {
  title: string;
  touch: string;
  keys: string;
  highlight: TutorialHighlight;
}

/** ข้อความขณะสำรวจ */
const EXPLORE_TEXT: Record<TutorialStepId, StepText> = {
  move: {
    title: 'ลองเดิน',
    touch: 'วางนิ้วที่ [จอยสติก] ด้านซ้าย แล้วลากไปทางที่อยากเดิน',
    keys: 'กด [W] [A] [S] [D] หรือ [ลูกศร] เพื่อเดิน',
    highlight: 'joystick',
  },
  approach: {
    title: 'ไปหาครูเนม',
    touch: 'มองหาครูเนม (มีเครื่องหมาย ! เหนือหัว) แล้วเดินเข้าไปใกล้ ๆ',
    keys: 'มองหาครูเนม (มีเครื่องหมาย ! เหนือหัว) แล้วเดินเข้าไปใกล้ ๆ',
    highlight: 'joystick',
  },
  talk: {
    title: 'พูดคุย',
    touch: 'แตะปุ่ม [คุย] สีเหลือง เพื่อพูดคุยกับครูเนม',
    keys: 'กด [E] เพื่อพูดคุยกับครูเนม',
    highlight: 'interact',
  },
  notebook: {
    title: 'สมุดภาคสนาม',
    touch: 'ครูเนมจดเบาะแสไว้ให้แล้ว แตะปุ่ม [สมุด] เพื่อเปิดอ่าน',
    keys: 'ครูเนมจดเบาะแสไว้ให้แล้ว กด [N] เพื่อเปิดสมุดภาคสนาม',
    highlight: 'notebook',
  },
  map: {
    title: 'แผนที่',
    touch: 'แตะปุ่ม [แผนที่] ดูว่าตอนนี้เราอยู่ตรงไหน',
    keys: 'กด [M] เพื่อเปิดแผนที่ ดูว่าตอนนี้เราอยู่ตรงไหน',
    highlight: 'map',
  },
  measure: {
    title: 'เครื่องมือวัดระยะ',
    touch: 'ครูเนมชวนวัดระยะเดินจริง แตะปุ่ม [วัดระยะ] เพื่อเริ่มนับจากจุดนี้',
    keys: 'ครูเนมชวนวัดระยะเดินจริง กด [R] เพื่อเริ่มนับจากจุดนี้',
    highlight: 'measure',
  },
  'measure-walk': {
    title: 'ลองวัดระยะ',
    touch: 'เดินต่ออีก 30 เมตร (3 ช่อง) แล้วดูตัวเลข "วัดระยะ" มุมซ้ายบน',
    keys: 'เดินต่ออีก 30 เมตร (3 ช่อง) แล้วดูตัวเลข "ระยะที่วัด" มุมซ้ายบน',
    highlight: 'status',
  },
  finish: {
    title: 'พร้อมออกสำรวจ!',
    touch: 'เก่งมาก! ต่อจากนี้ดูเป้าหมายและคำแนะนำได้ที่ [แถบภารกิจ] มุมขวาบน',
    keys: 'เก่งมาก! ต่อจากนี้ดูเป้าหมายและคำแนะนำได้ที่ [แถบภารกิจ] มุมขวาบน',
    highlight: 'tracker',
  },
};

/** ข้อความเมื่อเปิดหน้าต่างอื่นอยู่ (บทสนทนา/สมุด/แผนที่) — บอกวิธีอ่านต่อและวิธีปิด */
function modeText(step: TutorialStepId, mode: string, touch: boolean): { text: string; highlight: TutorialHighlight } | null {
  if (mode === 'dialogue') {
    return touch
      ? { text: 'แตะกล่องข้อความ หรือปุ่ม [ไปต่อ] เพื่ออ่านต่อ', highlight: 'next' }
      : { text: 'กด [Space] หรือ [E] เพื่ออ่านต่อ', highlight: 'next' };
  }
  if (mode === 'notebook') {
    return touch
      ? { text: 'เบาะแสทุกอย่างถูกจดไว้ที่นี่ อ่านแล้วแตะ [ปิดสมุด] เพื่อกลับไปเดิน', highlight: 'close' }
      : { text: 'เบาะแสทุกอย่างถูกจดไว้ที่นี่ อ่านแล้วกด [N] เพื่อปิดสมุด', highlight: 'close' };
  }
  if (mode === 'map') {
    const base = 'ทิศเหนืออยู่ด้านบนเสมอ ส่วนที่ยังไม่ได้สำรวจยังมืดอยู่';
    return touch ? { text: `${base} แตะ [ปิดแผนที่] เพื่อกลับไปเดิน`, highlight: 'close' } : { text: `${base} กด [M] เพื่อปิด`, highlight: 'close' };
  }
  // หน้าต่างอื่นที่ไม่เกี่ยวกับขั้นนี้: ไม่แสดงบทแนะนำ (ไม่บังเนื้อหา)
  void step;
  return null;
}

export function tutorialView(run: TutorialRun, input: Pick<TutorialInput, 'mode' | 'tripMeters' | 'measured'>, touch: boolean): TutorialView | null {
  const step = run.step;
  if (!step) return null;
  const base = EXPLORE_TEXT[step];
  const index = TUTORIAL_STEPS.indexOf(step) + 1;
  const common = { step, index, total: TUTORIAL_STEPS.length, title: base.title };
  if (input.mode !== 'explore') {
    const m = modeText(step, input.mode, touch);
    return m ? { ...common, text: m.text, highlight: m.highlight, progress: null, finishButton: false } : null;
  }
  const progress =
    step === 'measure-walk' && input.measured
      ? `วัดได้ ${Math.min(TUTORIAL_MEASURE_METERS, Math.floor(input.tripMeters))}/${TUTORIAL_MEASURE_METERS} ม.`
      : null;
  return { ...common, text: touch ? base.touch : base.keys, highlight: base.highlight, progress, finishButton: step === 'finish' };
}

/** ข้อความทั้งหมดของบทแนะนำ (ใช้ตรวจว่าไม่เฉลยในการทดสอบ) */
export function allTutorialText(): string[] {
  const out: string[] = [];
  for (const s of TUTORIAL_STEPS) {
    const t = EXPLORE_TEXT[s];
    out.push(t.title, t.touch, t.keys);
    for (const mode of ['dialogue', 'notebook', 'map'])
      for (const touch of [true, false]) {
        const m = modeText(s, mode, touch);
        if (m) out.push(m.text);
      }
  }
  return out;
}
