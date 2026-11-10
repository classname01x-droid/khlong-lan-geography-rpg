import { DIRECTIONS_8, type Direction8 } from '../direction/Compass';

/**
 * การจับคู่คำสั่งผู้เล่น ↔ ปุ่มคีย์บอร์ด ↔ ปุ่มสัมผัส (ตรรกะล้วน ทดสอบได้)
 *
 * ปุ่มสัมผัสทุกปุ่ม "ส่งรหัสปุ่มคีย์บอร์ดเดียวกัน" เข้า WorldScene.dispatchCode() — เกมจึงมีเส้นทางคำสั่งเดียว
 * (กติกาของแต่ละโหมดอยู่ที่เดิม ไม่เขียนซ้ำ) และคีย์บอร์ดเดิมยังใช้ได้ทุกปุ่ม
 */
export type ActionId =
  | 'interact'
  | 'map'
  | 'notebook'
  | 'measure'
  | 'analysis'
  | 'grid'
  | 'menu'
  | 'next'
  | 'confirm'
  | 'close'
  | 'tabPrev'
  | 'tabNext'
  | 'pinHere'
  | 'sheet'
  | 'continue'
  | 'journey'
  | 'choice'
  | 'zoomIn'
  | 'zoomOut'
  | 'legend'
  | 'pinUp'
  | 'pinDown'
  | 'pinLeft'
  | 'pinRight';

/** รหัสปุ่มคีย์บอร์ดของแต่ละคำสั่ง (ตรงกับที่ WorldScene รับอยู่เดิม) */
export const ACTION_KEY: Record<Exclude<ActionId, 'choice' | 'close' | 'zoomIn' | 'zoomOut' | 'legend' | 'pinUp' | 'pinDown' | 'pinLeft' | 'pinRight'>, string> = {
  interact: 'KeyE',
  map: 'KeyM',
  notebook: 'KeyN',
  measure: 'KeyR',
  analysis: 'KeyC',
  grid: 'KeyG',
  menu: 'Escape',
  next: 'Space',
  confirm: 'Enter',
  tabPrev: 'ArrowLeft',
  tabNext: 'ArrowRight',
  pinHere: 'Space',
  sheet: 'Tab',
  continue: 'Enter',
  journey: 'Escape',
};

export const choiceKey = (index: number): string => `Digit${index + 1}`;

/** คำสั่งที่คีย์บอร์ดแต่ละปุ่มหมายถึงในโหมดสำรวจ (ใช้ตรวจว่าแป้นพิมพ์กับปุ่มสัมผัสตรงกัน) */
export function exploreActionForKey(code: string): ActionId | null {
  switch (code) {
    case 'KeyE':
    case 'Space':
    case 'Enter':
    case 'NumpadEnter':
      return 'interact';
    case 'KeyM':
      return 'map';
    case 'KeyN':
      return 'notebook';
    case 'KeyR':
      return 'measure';
    case 'KeyC':
      return 'analysis';
    case 'KeyG':
      return 'grid';
    case 'Escape':
      return 'menu';
    default:
      return null;
  }
}

export interface TouchAction {
  id: ActionId;
  /** ชื่อภาษาไทย (แสดงคู่กับไอคอน) */
  label: string;
  icon: string;
  /** รหัสปุ่มที่ส่งเข้าเกม */
  code: string;
  enabled: boolean;
  /** ปุ่มหลักของสถานการณ์ (แสดงเด่น) */
  primary?: boolean;
  /** ตัวเลือกที่กำลังเลือกอยู่ (เช่น จุดบนกระดานวิเคราะห์) */
  selected?: boolean;
  /**
   * คำสั่งเฉพาะการแสดงผลบนจอสัมผัส (ขยายแผนที่ เปิดคำอธิบายสัญลักษณ์) — ไม่ใช่คำสั่งเกม จึงไม่ผ่าน dispatchCode
   * และไม่มีรหัสคีย์บอร์ด (code = '')
   */
  ui?: string;
  /** ปุ่มครึ่งความกว้าง (วางคู่กันในคอลัมน์) */
  half?: boolean;
}

/** สถานะเกมที่ใช้ตัดสินว่าจะแสดงปุ่มใด (สร้างจาก GameSession — ไม่ผูกกับ Phaser) */
export interface TouchContextInput {
  mode: 'explore' | 'dialogue' | 'map' | 'notebook' | 'summary' | 'pause' | 'compare' | 'gridcheck';
  /** ข้อความของเป้าหมายที่โต้ตอบได้ (null = ไม่มีอะไรในระยะ) */
  interact: { label: string; verb: string } | null;
  /** ด่านนี้มีหน้าวิเคราะห์ (กระดานวิเคราะห์ หรือ เปรียบเทียบแผนที่) */
  analysis: { available: boolean; label: string } | null;
  dialogue: { kind: 'line' | 'quiz' | 'lesson'; choices: string[]; /** ป้ายปุ่มไปต่อของบรรทัดนี้ */ button?: string; /** บทเรียน: หน้าที่/จำนวนหน้า */ page?: number; pages?: number } | null;
  map: { pinStage: 'none' | 'cursor' | 'wisdom'; canSwitchSheet: boolean; /** เพิ่งได้รับแผนที่: ปุ่มปิดเป็น "ตกลง" */ reveal?: boolean; wisdomChoices: string[]; /** เครื่องมือบนแผนที่ (ไม่ระบุ = ปักหมุด) */ tool?: 'pin' | 'settlement' | null };
  notebook: { routeChoices: string[] };
  compareChoices: string[];
  grid: { choices: string[]; selected: number | null; solved: boolean };
  /** การขยายแผนที่/แผนที่ฐานบนจอสัมผัส (ไม่ระบุ = ไม่มีปุ่มขยาย) */
  view?: { zoomIndex: number; zoomLevels: number; legend: boolean; compareTab: 0 | 1 | 'text' };
  /** รายการเมนูหยุดเกมที่แสดงบนจอสัมผัส (index = ลำดับใน PAUSE_ITEMS) */
  pauseItems?: Array<{ index: number; label: string; icon: string }>;
}

export interface TouchSheet {
  title: string;
  options: TouchAction[];
}

export interface TouchContext {
  /** แสดงจอยสติก (เดินได้เฉพาะโหมดสำรวจ) */
  joystick: boolean;
  /** ปุ่มด้านข้าง */
  actions: TouchAction[];
  /** แผ่นตัวเลือกด้านล่าง (ตัวเลือกที่มีข้อความยาว) */
  sheet: TouchSheet | null;
  /** แตะกล่องบทสนทนาเพื่อไปต่อ */
  tapToAdvance: boolean;
}

const act = (id: Exclude<ActionId, 'choice'>, label: string, icon: string, code: string, enabled = true, primary = false): TouchAction => ({
  id,
  label,
  icon,
  code,
  enabled,
  primary,
});

const uiAct = (id: 'zoomIn' | 'zoomOut' | 'legend', label: string, icon: string, ui: string, enabled = true, selected = false): TouchAction => ({
  id,
  label,
  icon,
  code: '',
  ui,
  enabled,
  selected,
  half: true,
});

/** ปุ่มขยาย/ย่อแผนที่ (ครึ่งความกว้าง วางคู่กัน) */
function zoomActions(v: TouchContextInput['view']): TouchAction[] {
  if (!v) return [];
  return [
    uiAct('zoomIn', 'ขยาย', '＋', 'map-zoom-in', v.zoomIndex < v.zoomLevels - 1),
    uiAct('zoomOut', 'ย่อ', '－', 'map-zoom-out', v.zoomIndex > 0),
  ];
}

const choices = (labels: string[], selected: number | null = null, enabled = true): TouchAction[] =>
  labels.map((label, i) => ({ id: 'choice', label, icon: String(i + 1), code: choiceKey(i), enabled, selected: selected === i }));

/** ปุ่มที่ควรแสดงในสถานการณ์ปัจจุบัน — ปุ่มที่ใช้ไม่ได้ถูกซ่อนหรือปิด */
export function buildTouchContext(i: TouchContextInput): TouchContext {
  const none: TouchContext = { joystick: false, actions: [], sheet: null, tapToAdvance: false };
  switch (i.mode) {
    case 'explore': {
      const actions = [
        act('interact', i.interact ? i.interact.verb : 'โต้ตอบ', '✋', ACTION_KEY.interact, !!i.interact, true),
        act('map', 'แผนที่', '🗺️', ACTION_KEY.map),
        act('notebook', 'สมุด', '📒', ACTION_KEY.notebook),
        act('measure', 'วัดระยะ', '📏', ACTION_KEY.measure),
      ];
      if (i.analysis) actions.push(act('analysis', i.analysis.label, '🔍', ACTION_KEY.analysis, i.analysis.available));
      actions.push(act('grid', 'ตาราง', '#', ACTION_KEY.grid), act('menu', 'เมนู', '☰', ACTION_KEY.menu));
      return { joystick: true, actions, sheet: null, tapToAdvance: false };
    }
    case 'dialogue':
      if (!i.dialogue) return none;
      if (i.dialogue.kind === 'quiz') return { ...none, sheet: { title: 'เลือกคำตอบ', options: choices(i.dialogue.choices) } };
      if (i.dialogue.kind === 'lesson') {
        // บทเรียนทีละหน้า: ย้อนกลับ / ถัดไป (หน้าสุดท้าย = เข้าใจแล้ว)
        const page = i.dialogue.page ?? 1;
        const last = page >= (i.dialogue.pages ?? 1);
        return {
          ...none,
          sheet: {
            title: '',
            options: [
              act('tabPrev', 'ย้อนกลับ', '◀', ACTION_KEY.tabPrev, page > 1),
              act('next', last ? 'เข้าใจแล้ว' : 'ถัดไป', last ? '✔' : '▶', ACTION_KEY.next, true, true),
            ],
          },
        };
      }
      return { ...none, tapToAdvance: true, sheet: { title: '', options: [act('next', i.dialogue.button ?? 'ไปต่อ', '▶', ACTION_KEY.next, true, true)] } };
    case 'map': {
      if (i.map.pinStage === 'wisdom') {
        return {
          ...none,
          sheet: { title: 'สถานที่ที่ปักหมุดคืออะไร?', options: choices(i.map.wisdomChoices) },
          actions: [act('close', 'ย้ายหมุด', '↩', 'Escape')],
        };
      }
      const actions: TouchAction[] = [...zoomActions(i.view)];
      if (i.map.pinStage === 'cursor') {
        // ปุ่มลูกศร 4 ทิศ: กด 1 ครั้ง = เลื่อนหมุด 1 ช่อง (ส่งรหัสลูกศรเดียวกับคีย์บอร์ด) · ชื่อปุ่มตามทิศบนแผนที่ (เหนืออยู่ด้านบน)
        const arrow = (id: 'pinUp' | 'pinDown' | 'pinLeft' | 'pinRight', label: string, icon: string, code: string): TouchAction => ({
          ...act(id, label, icon, code),
          half: true,
        });
        actions.push(
          arrow('pinUp', 'เหนือ', '▲', 'ArrowUp'),
          arrow('pinDown', 'ใต้', '▼', 'ArrowDown'),
          arrow('pinLeft', 'ตก', '◀', 'ArrowLeft'),
          arrow('pinRight', 'ออก', '▶', 'ArrowRight'),
          i.map.tool === 'settlement'
            ? act('pinHere', 'วิเคราะห์พื้นที่นี้', '🔍', ACTION_KEY.pinHere, true, true)
            : act('pinHere', 'ปักหมุดตรงนี้', '📍', ACTION_KEY.pinHere, true, true),
        );
      }
      // ปุ่มรองเป็นครึ่งความกว้าง (วางคู่กัน) ให้คอลัมน์ปุ่มพอดีจอเตี้ย
      const half = (a: TouchAction): TouchAction => ({ ...a, half: true });
      if (i.view) actions.push(half(uiAct('legend', 'สัญลักษณ์', '📖', 'map-legend', true, i.view.legend)));
      if (i.map.canSwitchSheet) actions.push(half(act('sheet', 'สลับแผ่น', '🔁', ACTION_KEY.sheet)));
      if (i.analysis) actions.push(half(act('analysis', i.analysis.label, '🔍', ACTION_KEY.analysis, i.analysis.available)));
      actions.push(half(act('close', i.map.reveal ? 'ตกลง' : 'ปิดแผนที่', i.map.reveal ? '✔' : '✕', 'KeyM')));
      return { ...none, actions };
    }
    case 'notebook':
      return {
        ...none,
        actions: [act('tabPrev', 'หน้าก่อน', '◀', ACTION_KEY.tabPrev), act('tabNext', 'หน้าถัดไป', '▶', ACTION_KEY.tabNext), act('close', 'ปิดสมุด', '✕', 'KeyN')],
        sheet: i.notebook.routeChoices.length ? { title: 'เลือกเส้นทางที่ตรงกับเบาะแส', options: choices(i.notebook.routeChoices) } : null,
      };
    case 'compare': {
      // จอสัมผัส: ขยายได้เมื่อกำลังดูแผนที่ฐานทีละฉบับ (แท็บ ฉบับ 1/2)
      const zoom =
        i.view && i.view.compareTab !== 'text'
          ? [...zoomActions(i.view), { ...uiAct('legend', 'สัญลักษณ์', '📖', 'map-legend', true, i.view.legend), half: false }]
          : [];
      return { ...none, actions: [...zoom, ...choices(i.compareChoices), act('close', 'ปิด', '✕', 'Escape')] };
    }
    case 'gridcheck': {
      const solved = i.grid.solved;
      return {
        ...none,
        actions: [
          ...choices(i.grid.choices, i.grid.selected, !solved),
          act('confirm', 'ยืนยัน', '✔', ACTION_KEY.confirm, !solved && i.grid.selected !== null, true),
          act('close', 'ปิด', '✕', 'Escape'),
        ],
      };
    }
    case 'summary':
      return {
        ...none,
        actions: [act('continue', 'รับภารกิจถัดไป', '▶', ACTION_KEY.continue, true, true), act('journey', 'แผนที่การเดินทาง', '🧭', ACTION_KEY.journey)],
      };
    case 'pause':
      // จอสัมผัส: เมนูหยุดเกมเป็นปุ่มใหญ่กลางจอ (ส่งเลขรายการ — คีย์บอร์ดกดเลขได้เช่นกัน)
      return i.pauseItems?.length
        ? {
            ...none,
            sheet: {
              title: 'หยุดเกม',
              options: i.pauseItems.map((p) => ({ id: 'choice' as const, label: p.label, icon: p.icon, code: choiceKey(p.index), enabled: true })),
            },
          }
        : none;
  }
}

/* ---------------- จอยสติก ---------------- */

/** เวกเตอร์หนึ่งหน่วยของ 8 ทิศ (y บวก = ลงด้านล่างจอ = ทิศใต้) */
const UNIT: Record<Direction8, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  NE: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  E: { x: 1, y: 0 },
  SE: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  S: { x: 0, y: 1 },
  SW: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  W: { x: -1, y: 0 },
  NW: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
};

export interface JoystickState {
  dir: Direction8 | null;
  x: number;
  y: number;
}

/**
 * แปลงระยะที่ลากนิ้วจากจุดกึ่งกลางจอยสติก (พิกเซลหน้าจอ) เป็นทิศเดิน 8 ทิศ
 * ลากไม่ถึง deadzone (สัดส่วนของรัศมี) = หยุด · ปัดเป็นทิศที่ใกล้ที่สุดทุก 45°
 */
export function joystickVector(dx: number, dy: number, radius: number, deadzone = 0.25): JoystickState {
  const dist = Math.hypot(dx, dy);
  if (radius <= 0 || dist < radius * deadzone) return { dir: null, x: 0, y: 0 };
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = ขึ้น (เหนือ) ตามเข็มนาฬิกา
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  const dir = DIRECTIONS_8[idx];
  return { dir, ...UNIT[dir] };
}

/**
 * กันการส่งคำสั่งซ้ำจากการแตะครั้งเดียว (เช่น touch + mouse จำลอง หรือ pointerdown ซ้ำ)
 * — ปุ่มเดียวกันรับได้ครั้งเดียวภายในช่วงเวลา gapMs
 */
export class TapGuard {
  private readonly last = new Map<string, number>();

  constructor(private readonly gapMs = 150) {}

  accept(key: string, now: number): boolean {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < this.gapMs) return false;
    this.last.set(key, now);
    return true;
  }
}
