import { describe, expect, it } from 'vitest';
import { sakNgamLevel as L1 } from '../src/content/levels/sakngam';
import { ALL_LEVELS } from '../src/content/registry';
import { validateLevel } from '../src/content/validateLevel';
import { guideText, GUIDE_TOKEN_RE } from '../src/core/guide/GuideText';
import { currentMicro, microStates } from '../src/core/guide/MicroQuest';
import { edgeIndicator, guideTarget } from '../src/core/guide/Navigation';
import { buildQuestTracker } from '../src/core/guide/QuestGuide';
import { measureDetail, measureHeadline, readMeasure } from '../src/core/measure/Measure';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import { buildNotebookView } from '../src/ui/views/notebookView';
import { KEYBOARD_HINT_RE, touchWording } from '../src/ui/views/touchWording';
import { explore, newSession, talk } from './helpers';

const HEADMAN_OK = [1, 2];
const goal = (s: ReturnType<typeof newSession>) => currentMicro(s)?.step.goal;
const allMicro = () => ALL_LEVELS.flatMap((L) => L.story.flatMap((st) => (st.micro ?? []).map((m) => ({ L, st, m }))));
/** พาผู้เล่นไปถึงขั้น "เริ่มวัดระยะจากศาลา" */
function atMeasureStep() {
  const s = newSession();
  talk(s, 'teacher-nem');
  talk(s, 'headman', HEADMAN_OK);
  talk(s, 'villager-sri');
  talk(s, 'fisher-kham');
  s.notebookTab = 'clues';
  s.markNotebookViewed();
  return s;
}
const px = (tile: { x: number; y: number }) => ({ x: defaultScale.tileCenterPx(tile.x), y: defaultScale.tileCenterPx(tile.y) });

describe('คำบอกปุ่มตามอุปกรณ์ ({tap:...})', () => {
  it('จอสัมผัส = แตะปุ่มบนจอ · คอมพิวเตอร์ = ปุ่มคีย์บอร์ด · ปุ่มลัดของขั้น', () => {
    expect(guideText('{tap:map}', { touch: true })).toBe('แตะปุ่ม "🗺️ แผนที่"');
    expect(guideText('{tap:map}', { touch: false })).toBe('กด M (แผนที่)');
    expect(guideText('{tap:routes}', { touch: true })).toBe('แตะปุ่ม "🔍 วิเคราะห์"');
    expect(guideText('{tap:routes}', { touch: false })).toBe('กด C (กระดานวิเคราะห์เส้นทาง)');
    expect(guideText('{tap:guide}', { touch: true, guideLabel: '🔍 เปิดกระดานวิเคราะห์เส้นทาง' })).toBe(
      'แตะปุ่ม "🔍 เปิดกระดานวิเคราะห์เส้นทาง" บนแถบภารกิจนี้',
    );
    expect(guideText('{walk}', { touch: true })).toContain('จอยสติก');
    expect(guideText('{walk}', { touch: false })).toContain('W A S D');
  });

  it('ทุกขั้นของทุกตำบล: ตัวแปรปุ่มแปลงครบ · บนจอสัมผัสไม่มีคำสั่งคีย์บอร์ดเลย', () => {
    for (const { L, m } of allMicro()) {
      for (const touch of [true, false]) {
        const texts = [m.goal, ...m.steps, m.result, m.tool, m.think].map((t) => guideText(t, { touch, guideLabel: 'ปุ่มลัด' }));
        for (const t of texts) {
          expect(t, `${L.id} ${m.id}`).not.toMatch(GUIDE_TOKEN_RE);
          if (touch) expect(t, `${L.id} ${m.id}`).not.toMatch(KEYBOARD_HINT_RE);
        }
      }
    }
  });
});

describe('ทุกขั้นบอก "การกระทำ" (ทั้ง 4 ตำบล + บทสุดท้าย)', () => {
  it('ทุกตำบลมีขั้นย่อยครบทุกฉาก และผ่านการตรวจเนื้อหา (ครบ 4 ส่วน · เป้าหมายนำทางไม่ใช่สถานที่ลับ)', () => {
    for (const L of ALL_LEVELS) {
      for (const st of L.story) expect(st.micro?.length ?? 0, `${L.id} ฉาก ${st.order}`).toBeGreaterThan(0);
      expect(validateLevel(L), L.id).toEqual([]);
    }
  });

  it('ทุกขั้น: เป้าหมาย · เครื่องมือ · วิธีทำที่ระบุปุ่ม/การกระทำ · ผลเมื่อสำเร็จ — ไม่มีคำสั่งกว้าง ๆ', () => {
    const BROAD = ['รวบรวมเบาะแส', 'วิเคราะห์ข้อมูล', 'เลือกเส้นทาง', 'ตรวจสอบหลักฐาน', 'รวบรวมเบาะแสและเปรียบเทียบเส้นทาง'];
    for (const { L, m } of allMicro()) {
      const where = `${L.id} ${m.id}`;
      expect(BROAD, where).not.toContain(m.goal.trim());
      expect(m.tools.length, where).toBeGreaterThan(0);
      expect(m.result.length, where).toBeGreaterThan(8);
      // อย่างน้อยหนึ่งข้อบอกว่าต้องกด/แตะ/เดิน/เลือกอะไร
      expect(m.steps.some((x) => GUIDE_TOKEN_RE.test(x)), where).toBe(true);
    }
  });

  it('ขั้นที่ต้อง "เปิด" เครื่องมือ มีปุ่มลัดบนแถบภารกิจ (ไม่ต้องจำปุ่ม C/N/M)', () => {
    for (const { L, m } of allMicro()) {
      if (/^เปิด/.test(m.goal) || /^ปักหมุด/.test(m.goal) || /^เริ่มวัด/.test(m.goal)) expect(m.action, `${L.id} ${m.id}`).toBeDefined();
    }
  });

  it('บทที่ 1 ขั้นวิเคราะห์เส้นทางแยกเป็น "เปิดกระดาน" แล้ว "เลือกเส้นทาง" · ปุ่มลัดเปิดกระดานวิเคราะห์เส้นทาง', () => {
    const ids = L1.story.flatMap((st) => st.micro ?? []).map((m) => m.id);
    expect(ids.indexOf('open-routes')).toBe(ids.indexOf('choose-route') - 1);
    const s = atMeasureStep();
    s.startMeasure();
    const t = buildQuestTracker(s, { touch: true });
    expect(t.objective).toBe('เปิดกระดานวิเคราะห์เส้นทาง');
    expect(t.action).toEqual({ id: 'routes', label: '🔍 เปิดกระดานวิเคราะห์เส้นทาง' });
    expect(t.steps[0]).toBe('แตะปุ่ม "🔍 เปิดกระดานวิเคราะห์เส้นทาง" บนแถบภารกิจนี้ (หรือแตะปุ่ม "🔍 วิเคราะห์")');
    expect(t.tools).toEqual(['กระดานวิเคราะห์เส้นทาง']);
    expect(t.result).toContain('เลือกเส้นทาง');
  });
});

describe('นำทางไป NPC เป้าหมาย (เฉพาะที่รู้ตำแหน่งแล้ว)', () => {
  it('เป้าหมายเปลี่ยนตามขั้น และตำแหน่งตรงกับข้อมูล NPC จริง (ไม่มี NPC ซ้ำ)', () => {
    const s = newSession();
    expect(guideTarget(s)).toMatchObject({ kind: 'npc', id: 'teacher-nem', at: L1.npcs.find((n) => n.id === 'teacher-nem')!.at });
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    const sri = L1.npcs.find((n) => n.id === 'villager-sri')!;
    expect(guideTarget(s)).toEqual({ kind: 'npc', id: 'villager-sri', name: 'ป้าศรี', at: sri.at });
    expect(L1.npcs.filter((n) => n.name === 'ป้าศรี')).toHaveLength(1);
  });

  it('ไม่นำทางไปบ้านผ้าปัก/จุดปริศนา: ระหว่างออกสำรวจไม่มีเป้าหมาย · ป้านวลนำทางได้หลังค้นพบบ้านผ้าปักเองแล้วเท่านั้น', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'fisher-kham');
    talk(s, 'villager-sri');
    s.chooseRoute(1);
    expect(goal(s)).toBe('ออกสำรวจตามเส้นทางที่เลือก');
    expect(guideTarget(s)).toBeNull();
    explore(s, 'wood-bridge');
    expect(guideTarget(s)).toBeNull();
    // ข้ามไปขั้นคุยกับป้านวลโดยตรง (เช่น บันทึกเก่า) แต่ยังไม่ค้นพบบ้านผ้าปัก → ยังไม่นำทาง
    const step = microStates(s).find((m) => m.step.id === 'talk-nuan')!.step;
    expect(step.target?.when).toEqual({ type: 'discover', landmarkId: 'nai-chiao' });
    explore(s, 'nai-chiao');
    expect(guideTarget(s)?.id).toBe('embroiderer-nuan');
  });

  it('ทุกตำบล: ไม่มีขั้นใดนำทางไปสถานที่ลับ หรือจุดคำตอบของการปักหมุด/กระดานวิเคราะห์', () => {
    for (const { L, m } of allMicro()) {
      const lm = m.target?.landmarkId;
      if (!lm) continue;
      const answer = (L.integratedSiteAnalysis ?? L.gridSiteAnalysis ?? L.siteAnalysis)?.correctLandmarkId;
      expect(lm, `${L.id} ${m.id}`).not.toBe(answer);
      expect(lm).not.toBe(L.pinTask?.targetId);
      expect(L.landmarks.find((l) => l.id === lm)!.revealFlag, `${L.id} ${m.id}`).toBeUndefined();
    }
  });

  it('ลูกศรขอบจอ: เป้าหมายนอกจอ → ป้ายอยู่ที่ขอบด้านนั้นและชี้ไปทางเป้าหมาย · ในจอ → ไม่ต้องใช้ลูกศร', () => {
    const view = { x: 0, y: 0, w: 300, h: 200 };
    const size = { w: 40, h: 12 };
    const east = edgeIndicator(view, { x: 900, y: 100 }, size, 2);
    expect(east.onScreen).toBe(false);
    expect(east.x).toBeCloseTo(300 - 2 - 20);
    expect(east.y).toBeCloseTo(100);
    expect(Math.abs(east.angle)).toBeLessThan(0.01);
    const north = edgeIndicator(view, { x: 150, y: -400 }, size, 2);
    expect(north.y).toBeCloseTo(2 + 6);
    expect(north.angle).toBeCloseTo(-Math.PI / 2);
    expect(edgeIndicator(view, { x: 120, y: 80 }, size, 2).onScreen).toBe(true);
  });

  it('ลูกศรขอบจอไม่ซ้อนใต้แถบภารกิจ: ถ้าจุดบนขอบถูกบัง เลื่อนไปตามขอบจนพ้น', () => {
    const view = { x: 0, y: 0, w: 300, h: 200 };
    const tracker = { x: 180, y: 0, w: 120, h: 120 };
    const ind = edgeIndicator(view, { x: 900, y: 60 }, { w: 40, h: 12 }, 2, [tracker]);
    const box = { x: ind.x - 20, y: ind.y - 6, w: 40, h: 12 };
    const overlap = box.x < tracker.x + tracker.w && tracker.x < box.x + box.w && box.y < tracker.y + tracker.h && tracker.y < box.y + box.h;
    expect(overlap).toBe(false);
    expect(ind.x).toBeCloseTo(300 - 2 - 20);
    // ยังชี้ไปทางเป้าหมาย (ทิศตะวันออก)
    expect(Math.cos(ind.angle)).toBeGreaterThan(0.9);
  });

  it('เดินถึงใกล้ NPC (≤ 4 ช่อง) → จด near:<npc> ครั้งเดียว และเก็บในบันทึกเดิม', () => {
    const s = newSession();
    expect(s.notePlayerNear({ x: 58, y: 36 })).toBe(true);
    expect(s.notePlayerNear({ x: 58, y: 36 })).toBe(false);
    expect(s.toSnapshot().flags).toContain('near:villager-sri');
  });
});

describe('วัดระยะจากจุดอ้างอิงของภารกิจ (เรียลไทม์ · แยกจากระยะเดินสะสม)', () => {
  it('ขั้นวัดระยะ: เริ่มวัดจากศาลาชุมชน (ข้อมูลภารกิจ) ไม่ใช่จากจุดที่ยืน', () => {
    const s = atMeasureStep();
    s.playerTile = { x: 30, y: 47 };
    s.playerPx = px(s.playerTile);
    expect(s.questMeasureSpec()).toMatchObject({ from: 'sala', label: 'ศาลาชุมชน', allowReset: false });
    const m = s.startMeasure();
    expect(m.origin).toEqual(L1.landmarks.find((l) => l.id === 'sala')!.at);
    expect(s.flags.has('measured:sala')).toBe(true);
  });

  it('ระยะเปลี่ยนตามตำแหน่งจริง: 12 ช่องทางเหนือของศาลา = 120 เมตร = 1.2 ซม. บนแผนที่ 1:10,000', () => {
    const s = atMeasureStep();
    s.startMeasure();
    const sala = L1.landmarks.find((l) => l.id === 'sala')!.at;
    s.playerPx = px({ x: sala.x, y: sala.y - 12 });
    let r = s.measureReading()!;
    expect(r.roundedMeters).toBe(120);
    expect(r.tiles).toBe(12);
    expect(r.mapCm).toBeCloseTo(1.2);
    expect(measureHeadline(r)).toBe('ระยะจากศาลาชุมชน: 120 เมตร');
    expect(measureDetail(r)).toContain('12 ช่อง = 1.2 ซม. บนแผนที่ 1:10,000');
    // เดินต่อ (เส้นตรง 3-4-5): 30 ช่องตะวันออก 40 ช่องเหนือ = 50 ช่อง = 500 ม.
    s.playerPx = px({ x: sala.x + 30, y: sala.y - 40 });
    r = s.measureReading()!;
    expect(r.roundedMeters).toBe(500);
    expect(r.mapCm).toBeCloseTo(5);
  });

  it('แยกระยะ: ระยะเดินสะสมทั้งบท ≠ ระยะวัดจากจุดอ้างอิง ≠ เดินจริงตั้งแต่เริ่มวัด', () => {
    const s = atMeasureStep();
    s.odometer.restoreTotal(800); // เดินมาแล้วทั้งบท 800 ม.
    s.startMeasure();
    const sala = L1.landmarks.find((l) => l.id === 'sala')!.at;
    s.odometer.sample(px(sala).x, px(sala).y);
    // เดินอ้อม: ไปทางตะวันออก 10 ช่อง แล้วขึ้นเหนือ 10 ช่อง (เดินจริง 200 ม. · เส้นตรง ~141 ม.)
    for (const t of [{ x: sala.x + 10, y: sala.y }, { x: sala.x + 10, y: sala.y - 10 }]) {
      const p = px(t);
      s.odometer.sample(p.x, p.y);
      s.playerPx = p;
    }
    const r = s.measureReading()!;
    expect(r.walkedMeters).toBe(200);
    expect(r.roundedMeters).toBe(140);
    expect(Math.round(s.odometer.totalMeters)).toBe(1000);
    // ข้อมูลที่แสดงระหว่างเล่นคือระยะจากศาลา ไม่ใช่ระยะเดินสะสม
    expect(measureHeadline(r)).not.toContain('1,000');
  });

  it('เริ่มวัดใหม่: จุดอ้างอิงของภารกิจ (ศาลา) ไม่ให้ย้ายเอง · ปริศนาลายผ้า (บ้านไหนเจียว) ให้ "เริ่มวัดใหม่จากตรงนี้" ได้', () => {
    const s = atMeasureStep();
    s.startMeasure();
    expect(s.restartMeasureHere()).toBe(false);
    expect(s.measure?.originId).toBe('sala');
    // ไปถึงขั้นปริศนา
    s.noteSkill('straight-vs-route');
    s.chooseRoute(1);
    explore(s, 'nai-chiao');
    talk(s, 'embroiderer-nuan');
    s.submitPin({ x: 70, y: 13 }, 1);
    s.notebookTab = 'clues';
    s.markNotebookViewed();
    s.syncQuestMeasure(); // ยังไม่ได้เริ่มวัดจากบ้านไหนเจียว → ไม่สลับเอง
    expect(s.measure?.originId).toBe('sala');
    s.startMeasure();
    expect(s.measure).toMatchObject({ originId: 'nai-chiao', allowReset: true });
    s.playerTile = { x: 55, y: 13 };
    expect(s.restartMeasureHere()).toBe(true);
    expect(s.measure).toMatchObject({ originId: null, origin: { x: 55, y: 13 }, label: 'จุดที่เริ่มวัด' });
    s.stopMeasure();
    expect(s.measureReading()).toBeNull();
  });

  it('นอกขั้นที่ภารกิจกำหนด: ปุ่มวัดระยะวัดจากจุดที่ยืน (ใช้กับภารกิจรอง "นักวัดระยะ")', () => {
    const s = newSession();
    s.playerTile = { x: 14, y: 44 };
    const m = s.startMeasure();
    expect(m).toMatchObject({ originId: null, origin: { x: 14, y: 44 }, allowReset: true });
    expect(s.skills.has('odometer')).toBe(true);
  });

  it('คำนวณผ่าน ScaleSystem: 1 ช่อง = 10 ม. · 1:10,000', () => {
    const r = readMeasure({ originId: null, origin: { x: 0, y: 0 }, label: 'x', walkedAtStart: 0, allowReset: true }, px({ x: 0, y: 30 }), 0, defaultScale);
    expect(r.roundedMeters).toBe(300);
    expect(r.mapCm).toBeCloseTo(3);
  });
});

describe('สมุดภาคสนาม: เปิดหน้าที่เกี่ยวข้อง · เบาะแสจดอัตโนมัติ', () => {
  it('ขั้น "เปิดสมุด" ระบุหน้าเบาะแส และปุ่มลัดเปิดหน้านั้น · ขั้นเลือกเส้นทางเปิดหน้ากระดานวิเคราะห์เส้นทาง', () => {
    const steps = L1.story.flatMap((st) => st.micro ?? []);
    expect(steps.find((m) => m.id === 'read-clues')).toMatchObject({ notebookTab: 'clues', action: 'clues' });
    expect(steps.find((m) => m.id === 'read-riddle')).toMatchObject({ notebookTab: 'clues', action: 'clues' });
    expect(steps.find((m) => m.id === 'choose-route')).toMatchObject({ notebookTab: 'routes', action: 'routes' });
  });

  it('เบาะแสเรียงตามลำดับที่ได้รับ · ระบุผู้ให้ข้อมูล · มีไอคอนประเภท · เบาะแสที่เพิ่งได้มีป้าย "ใหม่"', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    talk(s, 'villager-sri');
    talk(s, 'fisher-kham');
    s.notebookTab = 'clues';
    s.newClues.length = 0;
    s.markNotebookViewed();
    const lines = buildNotebookView(s, { touch: true }).lines.map((l) => l.text);
    const heads = lines.filter((t) => /^\d+\. /.test(t));
    expect(heads.map((t) => t.split(' — ')[1].replace(/\s+★ ใหม่$/, ''))).toEqual(['จากครูเนม', 'จากผู้ใหญ่บ้าน', 'จากผู้ใหญ่บ้าน', 'จากป้าศรี', 'จากลุงคำ']);
    expect(heads[3]).toContain('📍 จุดสังเกต');
    expect(heads[3]).toContain('★ ใหม่');
    // เปิดสมุดอีกครั้ง (ไม่มีเบาะแสใหม่) → ไม่มีป้าย "ใหม่"
    s.newClues.length = 0;
    s.markNotebookViewed();
    expect(buildNotebookView(s).lines.some((l) => l.text.includes('★ ใหม่'))).toBe(false);
    // ไม่จดซ้ำเมื่อคุยซ้ำ
    talk(s, 'villager-sri');
    expect(s.clues.filter((c) => c === 'clue-fork')).toHaveLength(1);
  });

  it('หน้าภารกิจแสดงช่วงภารกิจ ขั้นปัจจุบัน วิธีทำ เครื่องมือ และผลเมื่อสำเร็จ', () => {
    const s = newSession();
    talk(s, 'teacher-nem');
    talk(s, 'headman', HEADMAN_OK);
    s.notebookTab = 'quests';
    const text = buildNotebookView(s, { touch: true }).lines.map((l) => l.text).join('\n');
    expect(text).toContain('ช่วงที่ 1 · รับภารกิจ — ทำแล้ว 3/3 ขั้น');
    expect(text).toContain('ช่วงที่ 2 · ตามหาแหล่งผ้าปัก — ทำแล้ว 0/13 ขั้น');
    expect(text).toContain('▶ 1. ตอนนี้: ไปพบป้าศรี');
    expect(text).toContain('เครื่องมือ:');
    expect(text).toContain('เมื่อสำเร็จ:');
    // หน้าอ่านบนจอสัมผัสผ่าน touchWording (ข้อความภารกิจรองเดิม) — ส่วนขั้นย่อยแปลงปุ่มมาแล้ว
    expect(touchWording(text)).not.toMatch(KEYBOARD_HINT_RE);
  });
});
