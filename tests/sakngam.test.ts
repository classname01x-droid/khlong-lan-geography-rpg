import { describe, expect, it } from 'vitest';
import { sakNgamLevel as L, SAKNGAM_HEADMAN, SAKNGAM_MONK, SAKNGAM_TEACH_SPOT, SAKNGAM_TRASH, SAKNGAM_WAT } from '../src/content/levels/sakngam';
import { validateLevel } from '../src/content/validateLevel';
import { directionFromVector } from '../src/core/direction/Compass';
import { guideTarget } from '../src/core/guide/Navigation';
import { buildQuestTracker } from '../src/core/guide/QuestGuide';
import { ProgressStore } from '../src/core/progress/ProgressStore';
import { startBattle } from '../src/core/rpg/Battle';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import type { GameSession } from '../src/core/session/GameSession';
import { buildWorld } from '../src/core/world/MapBuilder';
import { findPath, isPointReachable, reachableTiles } from '../src/core/world/pathfinding';
import { newSession } from './helpers';

const grid = buildWorld(L.map);
const npc = (id: string) => L.npcs.find((n) => n.id === id)!.at;
const cm = (a: { x: number; y: number }, b: { x: number; y: number }) => defaultScale.tilesToMeters(Math.hypot(a.x - b.x, a.y - b.y)) / 100; // ซม. บนแผนที่ 1:10,000
const rightIdx = (id: string) => {
  const q = L.quizzes!.find((x) => x.id === id)!;
  return q.choices.findIndex((c) => c.id === q.correctChoiceId);
};
const wrongIdx = (id: string) => (rightIdx(id) + 1) % 3;
const kind = (s: GameSession) => s.dialogueView?.kind;
/** เดินบทสนทนาจนถึงคำถามแรกที่พบ (ข้ามบรรทัด/บทเรียน) */
function toQuiz(s: GameSession): void {
  for (let g = 0; g < 30 && s.inDialogue && kind(s) !== 'quiz'; g++) s.advanceDialogue();
}
function finish(s: GameSession): void {
  for (let g = 0; g < 30 && s.inDialogue; g++) s.advanceDialogue();
}
const talk = (s: GameSession, id: string) => s.talkTo(L.npcs.find((n) => n.id === id)!);

describe('สักงาม: ทิศและระยะในแผนที่ตรงกับโจทย์ (1:10,000 · 1 ซม. = 100 ม.)', () => {
  it('ข้อมูลด่านผ่านการตรวจสอบ และจุดหมายทุกจุดเดินถึงได้', () => {
    expect(validateLevel(L)).toEqual([]);
    const reach = reachableTiles(grid, L.spawn);
    for (const id of ['teacher-nem', 'headman', 'grandma', 'jiao', 'monk']) expect(isPointReachable(grid, reach, npc(id), 2), id).toBe(true);
    for (const p of [SAKNGAM_WAT, SAKNGAM_TRASH, SAKNGAM_TEACH_SPOT]) {
      expect(isPointReachable(grid, reach, p, 2), JSON.stringify(p)).toBe(true);
      expect(grid.getTerrain(p.x, p.y)).not.toBe('water');
    }
  });

  it('โรงเรียน → บ้านผู้ใหญ่บ้าน: ทิศตะวันออก 4 ซม. = 400 ม. และต้องข้ามสะพาน', () => {
    const school = L.landmarks.find((l) => l.id === 'school')!.at;
    const h = npc('headman');
    expect(directionFromVector(h.x - school.x, h.y - school.y)).toBe('E');
    expect(cm(school, h)).toBeCloseTo(4, 0);
    const path = findPath(grid, L.spawn, { x: h.x, y: h.y + 1 })!;
    expect(path).not.toBeNull();
    expect(path.some((p) => grid.getTerrain(p.x, p.y) === 'bridge')).toBe(true);
  });

  it('จุดสอนเครื่องมือวัดอยู่บนเส้นทางออกจากโรงเรียน (ถนนหลัก ผ่านก่อนถึงสะพาน)', () => {
    const h = npc('headman');
    const path = findPath(grid, L.spawn, { x: h.x, y: h.y + 1 })!;
    expect(path.some((p) => Math.hypot(p.x - SAKNGAM_TEACH_SPOT.x, p.y - SAKNGAM_TEACH_SPOT.y) <= 2.5)).toBe(true);
  });

  it('บ้านผู้ใหญ่บ้าน → คุณยาย: ทิศตะวันตก 3 ซม. · คุณยาย → ป้าเจียว: ทิศเหนือ 2 ซม.', () => {
    const h = npc('headman');
    const g = npc('grandma');
    const j = npc('jiao');
    expect(directionFromVector(g.x - h.x, g.y - h.y)).toBe('W');
    expect(Math.abs(g.x - h.x)).toBe(30);
    expect(directionFromVector(j.x - g.x, j.y - g.y)).toBe('N');
    expect(g.x).toBe(j.x);
    expect(g.y - j.y).toBe(20);
    expect(findPath(grid, { x: h.x, y: h.y + 1 }, { x: g.x, y: g.y - 1 })).not.toBeNull();
    expect(findPath(grid, g, { x: j.x, y: j.y + 1 })).not.toBeNull();
  });

  it('ป้าเจียว → สำนักสงฆ์เขาแสงเพชร: ทิศเหนือ ≈ 1 ซม. · พระยืนบนลานสำนักสงฆ์ เดินเข้าไปคุยได้', () => {
    const j = npc('jiao');
    expect(directionFromVector(SAKNGAM_WAT.x - j.x, SAKNGAM_WAT.y - j.y)).toBe('N');
    expect(cm(j, SAKNGAM_WAT)).toBeGreaterThan(0.9);
    expect(cm(j, SAKNGAM_WAT)).toBeLessThan(1.2);
    expect(npc('monk')).toEqual(SAKNGAM_MONK);
    expect(grid.getTerrain(SAKNGAM_MONK.x, SAKNGAM_MONK.y)).toBe('paving'); // ลานหน้าสำนักสงฆ์
    expect(grid.getObject(SAKNGAM_MONK.x, SAKNGAM_MONK.y)).toBeNull();
    expect(Math.hypot(SAKNGAM_MONK.x - SAKNGAM_WAT.x, SAKNGAM_MONK.y - SAKNGAM_WAT.y)).toBeLessThan(3);
    expect(L.npcs.find((n) => n.id === 'monk')!.appearance).toBe('monk');
    const reach = reachableTiles(grid, L.spawn);
    // ยืนติดพระ (ห่าง ≤ 2 ช่อง ตามระยะคุย) ได้จริง
    expect(isPointReachable(grid, reach, SAKNGAM_MONK, 2)).toBe(true);
    expect(findPath(grid, npc('jiao'), { x: SAKNGAM_MONK.x, y: SAKNGAM_MONK.y + 1 })).not.toBeNull();
  });

  it('บ้านผู้ใหญ่บ้าน → กองขยะ (ริมขอบขวาของแผนที่): ทิศตะวันออก 2.3 ซม. = 230 ม. พอดี · เดินถึงได้ · ผ่านถนนที่แยกขึ้นเหนือ', () => {
    const h = npc('headman');
    expect(h).toEqual(SAKNGAM_HEADMAN);
    expect(directionFromVector(SAKNGAM_TRASH.x - h.x, SAKNGAM_TRASH.y - h.y)).toBe('E');
    expect(SAKNGAM_TRASH.y).toBe(h.y);
    expect(cm(h, SAKNGAM_TRASH)).toBeCloseTo(2.3, 5);
    expect(defaultScale.tilesToMeters(SAKNGAM_TRASH.x - h.x)).toBe(230);
    expect(SAKNGAM_TRASH.x).toBe(L.map.widthTiles - 2); // ริมขอบขวาสุดของแผนที่ (ถัดไปคือแนวต้นไม้ขอบแผนที่)
    expect(L.map.widthTiles - 1 - SAKNGAM_TRASH.x).toBe(1);
    const reach = reachableTiles(grid, L.spawn);
    expect(isPointReachable(grid, reach, SAKNGAM_TRASH, 0)).toBe(true); // ยืนบนจุดกองขยะได้
    expect(grid.getTerrain(SAKNGAM_TRASH.x, SAKNGAM_TRASH.y)).toBe('road');
    expect(grid.getObject(SAKNGAM_TRASH.x, SAKNGAM_TRASH.y)).toBeNull();
    const path = findPath(grid, { x: h.x, y: h.y + 1 }, SAKNGAM_TRASH)!;
    expect(path).not.toBeNull();
    // ทางตะวันออกต้องตัดถนนที่แยกขึ้นเหนือ (x=60) · มีลำห้วยเล็กอยู่ข้างกองขยะ (ตามเรื่อง "ใกล้ลำธาร")
    expect(path.some((p) => (p.x === 60 || p.x === 61) && ['road', 'bridge'].includes(grid.getTerrain(p.x, p.y)!))).toBe(true);
    expect(grid.getTerrain(60, SAKNGAM_TRASH.y)).toBe('road');
    expect(grid.getTerrain(73, SAKNGAM_TRASH.y)).toBe('water');
    // ถนนหลักข้ามลำห้วยเล็กด้วยสะพาน ไม่ขาด
    expect(grid.getTerrain(73, 48)).toBe('bridge');
    expect(findPath(grid, { x: 68, y: 48 }, { x: 78, y: 48 })).not.toBeNull();
    expect(L.decor!.some((d) => d.kind === 'trash' && d.at.x === SAKNGAM_TRASH.x && d.at.y === SAKNGAM_TRASH.y)).toBe(true);
    // กองขยะเดิม (ใต้สำนักสงฆ์) ถูกย้ายออกแล้ว
    expect(L.decor!.filter((d) => d.kind === 'trash')).toHaveLength(1);
  });
});

describe('สักงาม: จุดสอนใช้เครื่องมือวัดระยะทาง', () => {
  it('ถึงจุด → หยุด (teach) · ยังไม่กดเครื่องมือ = ไม่ผ่าน · กดแล้วผ่านและไม่แสดงซ้ำ', () => {
    const s = newSession(L);
    expect(s.checkArrivals(SAKNGAM_TEACH_SPOT)).toBe(false); // ยังไม่ผ่านโจทย์ครูเนม
    s.flags.add('q-school');
    expect(s.checkArrivals({ x: 40, y: 48 })).toBe(false);
    expect(s.checkArrivals(SAKNGAM_TEACH_SPOT)).toBe(true);
    expect(s.teach).toMatchObject({ tool: 'measure', text: 'กดเครื่องมือวัดระยะทาง' });
    // ขณะสอน: ไม่เปิดจุดอื่นซ้อน และยังไม่ผ่าน
    expect(s.checkArrivals(SAKNGAM_TEACH_SPOT)).toBe(false);
    expect(s.flags.has('teach-measure')).toBe(false);
    expect(s.completeTeach('measure')).toBe(true);
    expect(s.teach).toBeNull();
    expect(s.flags.has('teach-measure')).toBe(true);
    expect(s.checkArrivals(SAKNGAM_TEACH_SPOT)).toBe(false);
  });
});

describe('สักงาม: บทเรียนครูเนม 5 หัวข้อ และตอบมาตราส่วนผิด', () => {
  it('ครูเนมสอนทีละหน้า 5 หน้า ย้อนกลับ/ถัดไปได้ แล้วจึงถามโจทย์', () => {
    const s = newSession(L);
    talk(s, 'teacher-nem');
    for (let g = 0; g < 6 && kind(s) !== 'lesson'; g++) s.advanceDialogue();
    const titles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = s.dialogueView!;
      expect(v.kind).toBe('lesson');
      if (v.kind === 'lesson') {
        expect(v.page).toBe(i + 1);
        expect(v.pages).toBe(5);
        titles.push(v.title);
      }
      if (i === 1) {
        s.backDialogue();
        expect(s.dialogueView).toMatchObject({ page: 1 });
        s.advanceDialogue();
      }
      s.advanceDialogue();
    }
    expect(titles.join(' ')).toMatch(/มาตราส่วนคืออะไร.*1:10,000.*ซม. เป็นเมตร.*เมตรเป็นกิโลเมตร.*ตัวอย่าง/);
    expect(kind(s)).toBe('quiz');
    const text = L.lessons!.scale.pages.map((p) => p.text).join(' ');
    expect(text).toContain('10,000 ÷ 100 = 100 เมตร');
    expect(text).toContain('300 ÷ 1,000 = 0.3 กม.');
    expect(text).toContain('3 × 10,000 = 30,000 ซม. = 300 เมตร = 0.3 กม.');
  });

  it('ตอบผิด → เปิดบทเรียน แล้วกลับมาถามข้อเดิม · ความคืบหน้าไม่รีเซ็ต · ไม่เพิ่ม HP บอส', () => {
    const s = newSession(L);
    const p = new ProgressStore(null, 'sakngam');
    s.wallet = p;
    s.flags.add('q-school');
    s.flags.add('met-headman');
    talk(s, 'headman');
    toQuiz(s);
    expect(s.dialogueView).toMatchObject({ kind: 'quiz' });
    s.answerQuiz(wrongIdx('q-west'));
    expect(kind(s)).toBe('lesson');
    for (let g = 0; g < 8 && kind(s) === 'lesson'; g++) s.advanceDialogue();
    expect(s.dialogueView).toMatchObject({ kind: 'quiz' });
    expect((s.dialogueView as { question: string }).question).toContain('3 เซนติเมตร');
    expect(s.flags.has('q-school')).toBe(true); // ไม่รีเซ็ต
    expect(p.rpg.bossHpBonus).toBe(0);
    s.answerQuiz(rightIdx('q-west'));
    finish(s);
    expect(s.flags.has('q-west')).toBe(true);
  });
});

describe('สักงาม: ป้าเจียว → สำนักสงฆ์ → พระ → ผู้ใหญ่บ้าน → โจทย์ → กองขยะ', () => {
  const FLAGS_TO_JIAO = ['q-school', 'met-headman', 'route-known'];
  function at(...flags: string[]) {
    const s = newSession(L);
    for (const f of [...FLAGS_TO_JIAO, ...flags]) s.flags.add(f);
    return s;
  }

  it('ถึงสำนักสงฆ์ → แจ้ง "ถึงสำนักสงฆ์เขาแสงเพชรแล้ว" ครั้งเดียว (ต้องได้รับบอกทางจากป้าเจียวก่อน)', () => {
    const s = at();
    expect(s.checkArrivals(SAKNGAM_MONK)).toBe(false); // ยังไม่ได้คุยกับป้าเจียว
    s.flags.add('go-wat');
    expect(s.checkArrivals({ x: SAKNGAM_MONK.x, y: SAKNGAM_MONK.y + 7 })).toBe(false); // ยังไม่ถึง
    expect(s.checkArrivals({ x: SAKNGAM_MONK.x - 2, y: SAKNGAM_MONK.y + 3 })).toBe(true);
    expect(s.dialogueView).toMatchObject({ kind: 'line', text: 'ถึงสำนักสงฆ์เขาแสงเพชรแล้ว', button: 'ตกลง' });
    s.advanceDialogue();
    expect(s.mode).toBe('explore');
    expect(s.flags.has('at-wat')).toBe(true);
    expect(s.flags.has('monk-talked')).toBe(false); // ต้องเดินไปคุยกับพระเอง
    expect(s.checkArrivals(SAKNGAM_MONK)).toBe(false);
  });

  it('ยืนคุยกับพระได้ทุกตำแหน่งที่อยู่ในระยะคุย (ห่าง ≤ 2 ช่อง) ก็อยู่ในระยะที่ข้อความ "ถึงสำนักสงฆ์" ทำงานแล้ว', () => {
    const radius = L.arrivals!.find((a) => a.id === 'wat')!;
    expect(radius.at).toEqual(SAKNGAM_MONK);
    expect(radius.radiusTiles).toBeGreaterThanOrEqual(3);
  });

  it('คุยกับพระ: บทสนทนาตามเรื่อง → อัปเดตภารกิจ "กลับไปพบผู้ใหญ่บ้านเพื่อสอบถามตำแหน่งกองขยะ"', () => {
    const s = at('go-wat');
    // ยังไม่ถึงสำนักสงฆ์ → พระทักทายเฉย ๆ ไม่ข้ามขั้น
    talk(s, 'monk');
    expect(s.dialogueView).toMatchObject({ kind: 'line', speaker: 'พระ' });
    finish(s);
    expect(s.flags.has('monk-talked')).toBe(false);

    s.checkArrivals(SAKNGAM_MONK);
    finish(s);
    talk(s, 'monk');
    expect(s.dialogueView).toMatchObject({ kind: 'line', speaker: 'ผู้กล้า', text: 'หลวงพ่อครับ ผมกำลังตามหากองขยะที่อยู่ใกล้ลำธารครับ' });
    s.advanceDialogue();
    expect(s.dialogueView).toMatchObject({ kind: 'line', speaker: 'พระ', text: 'เรื่องนี้ลองกลับไปถามผู้ใหญ่บ้านดูนะ ท่านรู้ว่ากองขยะอยู่ตรงไหน' });
    s.advanceDialogue();
    expect(s.flags.has('monk-talked')).toBe(true);
    s.updateQuests(true);
    const t = buildQuestTracker(s, {});
    expect([t.objective, ...t.steps].join(' ')).toContain('กลับไปพบผู้ใหญ่บ้านเพื่อสอบถามตำแหน่งกองขยะ');
    // คุยซ้ำ: ไม่เล่นบทสนทนาแรกซ้ำ
    talk(s, 'monk');
    expect(s.dialogueView).toMatchObject({ kind: 'line', speaker: 'พระ' });
    expect((s.dialogueView as { text: string }).text).not.toContain('หลวงพ่อ');
  });

  it('ผู้ใหญ่บ้านก่อนคุยกับพระ: ไม่บอกทางกองขยะ ไม่ถามโจทย์ (ห้ามข้ามขั้น)', () => {
    for (const flags of [[], ['go-wat'], ['go-wat', 'at-wat']]) {
      const s = at(...flags);
      talk(s, 'headman');
      const texts: string[] = [];
      for (let g = 0; g < 10 && s.inDialogue; g++) {
        expect(kind(s)).not.toBe('quiz');
        texts.push((s.dialogueView as { text: string }).text);
        s.advanceDialogue();
      }
      expect(texts.join(' ')).not.toContain('กองขยะ');
      expect(s.flags.has('trash-told')).toBe(false);
    }
  });

  it('ผู้ใหญ่บ้านหลังคุยกับพระ: บอกทิศ+ระยะ+จุดสังเกต ก่อนถามโจทย์ · ตอบผิดเรียนกับครูเนมก่อน · ตอบถูกปลดล็อก', () => {
    const s = at('go-wat', 'at-wat', 'monk-talked');
    const p = new ProgressStore(null, 'sakngam');
    s.wallet = p;
    talk(s, 'headman');
    const lines: string[] = [];
    while (s.inDialogue && kind(s) === 'line') {
      lines.push((s.dialogueView as { text: string }).text);
      s.advanceDialogue();
    }
    expect(lines[0]).toBe('ท่านผู้ใหญ่ครับ กองขยะอยู่ตรงไหนครับ?');
    expect(lines[1]).toBe('อ๋อ กองขยะอยู่ทางฝั่งตะวันออกของชุมชน เจ้าต้องเดินไปตามทางด้านขวาของแผนที่');
    expect(lines[2]).toContain('ทิศตะวันออก');
    expect(lines[2]).toContain('2.3 เซนติเมตร');
    expect(lines[2]).toContain('สะพาน');
    expect(lines[2]).toContain('ถนนที่แยกขึ้นเหนือ'); // จุดสังเกตระหว่างทาง
    expect(lines).toHaveLength(3);
    expect(s.flags.has('trash-told')).toBe(true); // บอกทางก่อนถาม
    const q = s.dialogueView as { kind: string; question: string; choices: string[] };
    expect(q.kind).toBe('quiz');
    expect(q.question).toContain('จากบ้านผู้ใหญ่บ้านไปกองขยะ ต้องเดินทางทิศใด และระยะทางจริงเท่าไร?');
    expect(q.question).toContain('1:10,000');
    expect(q.question).toContain('2.3 ซม.');
    expect(q.choices).toEqual(['ตะวันออก 230 เมตร', 'ตะวันตก 230 เมตร', 'ตะวันออก 2,300 เมตร']);
    expect(s.flags.has('trash-route')).toBe(false);
    s.answerQuiz(wrongIdx('q-trash'));
    expect(kind(s)).toBe('lesson'); // กลับไปเรียนมาตราส่วนกับครูเนม
    expect((s.dialogueView as { speaker: string }).speaker).toBe('ครูเนม');
    for (let g = 0; g < 8 && kind(s) === 'lesson'; g++) s.advanceDialogue();
    expect(kind(s)).toBe('quiz');
    expect(s.flags.has('trash-route')).toBe(false);
    expect(p.rpg.bossHpBonus).toBe(0);
    s.answerQuiz(rightIdx('q-trash'));
    finish(s);
    expect(s.flags.has('trash-route')).toBe(true);
    expect(s.mode).toBe('explore');
    // คุยซ้ำ: ย้ำทางสั้น ๆ ไม่ถามซ้ำ
    talk(s, 'headman');
    expect(kind(s)).toBe('line');
    expect((s.dialogueView as { text: string }).text).toContain('ตะวันออก');
    expect(s.inDialogue).toBe(true);
    s.advanceDialogue();
    expect(s.inDialogue).toBe(false);
  });

  it('ปิดเกมกลางคำถามผู้ใหญ่บ้าน → โหลดแล้วคุยใหม่ได้ ไม่ค้าง', () => {
    const s = at('go-wat', 'at-wat', 'monk-talked');
    talk(s, 'headman');
    toQuiz(s);
    const s2 = newSession(L);
    expect(s2.restore(JSON.parse(JSON.stringify(s.toSnapshot())))).toBe(true);
    expect(s2.mode).toBe('explore');
    talk(s2, 'headman');
    toQuiz(s2);
    expect(kind(s2)).toBe('quiz');
    s2.answerQuiz(rightIdx('q-trash'));
    finish(s2);
    expect(s2.flags.has('trash-route')).toBe(true);
  });

  it('พบกองขยะ: ได้เฉพาะหลังตอบโจทย์ · "พบกองขยะแล้ว!" ปุ่ม "ตกลง" · แล้วเก็บขยะ · แสดงครั้งเดียว', () => {
    const s = at('go-wat', 'at-wat', 'monk-talked', 'trash-told');
    expect(s.checkArrivals(SAKNGAM_TRASH)).toBe(false); // ยังไม่ตอบโจทย์ → เดินไปถึงก็ไม่เกิดอะไร
    expect(s.flags.has('trash-found')).toBe(false);
    s.flags.add('trash-route');
    expect(s.checkArrivals({ x: SAKNGAM_TRASH.x - 6, y: SAKNGAM_TRASH.y })).toBe(false); // ยังไม่ถึง
    expect(s.checkArrivals({ x: SAKNGAM_TRASH.x - 1, y: SAKNGAM_TRASH.y })).toBe(true);
    expect(s.dialogueView).toMatchObject({ kind: 'line', text: 'พบกองขยะแล้ว!', button: 'ตกลง' });
    s.advanceDialogue();
    expect(s.dialogueView).toMatchObject({ kind: 'line', text: 'เก็บขยะใส่ถุงเรียบร้อย กลับไปรายงานป้าเจียวกันเถอะ' });
    s.advanceDialogue();
    expect(s.mode).toBe('explore');
    expect(s.flags.has('trash-found')).toBe(true);
    expect(s.checkArrivals(SAKNGAM_TRASH)).toBe(false);
  });

  it('ป้าเจียวระหว่างทาง: บอกขั้นต่อไป ไม่ถามคำแนะนำก่อนพบกองขยะ · ไม่มีกองขยะใต้สำนักสงฆ์อีก', () => {
    for (const [flags, expected] of [
      [['go-wat'], 'สำนักสงฆ์'],
      [['go-wat', 'at-wat', 'monk-talked', 'trash-told', 'trash-route'], 'ตามหากองขยะ'],
    ] as Array<[string[], string]>) {
      const s = at(...flags);
      talk(s, 'jiao');
      expect(kind(s)).toBe('line');
      expect((s.dialogueView as { text: string }).text).toContain(expected);
      s.advanceDialogue();
      expect(s.inDialogue).toBe(false);
      expect(s.flags.has('m-report')).toBe(false);
    }
    const s = at('go-wat', 'at-wat', 'monk-talked', 'trash-route');
    expect(s.checkArrivals({ x: 28, y: 47 })).toBe(false);
  });

  it('ลำดับเต็ม ตั้งแต่ป้าเจียวถึงรายงาน: แต่ละขั้นขึ้นเมื่อถึงลำดับเท่านั้น', () => {
    const s = at();
    const p = new ProgressStore(null, 'sakngam');
    s.wallet = p;
    talk(s, 'jiao'); // 1) ป้าเจียวบอกให้ไปสำนักสงฆ์
    finish(s);
    expect(s.flags.has('go-wat')).toBe(true);
    s.checkArrivals(SAKNGAM_MONK); // 2) ถึงสำนักสงฆ์
    finish(s);
    talk(s, 'monk'); // 3) คุยกับพระ
    finish(s);
    expect(s.flags.has('monk-talked')).toBe(true);
    expect(s.checkArrivals(SAKNGAM_TRASH)).toBe(false);
    talk(s, 'headman'); // 4) ผู้ใหญ่บ้าน + 5) โจทย์
    toQuiz(s);
    s.answerQuiz(rightIdx('q-trash'));
    finish(s);
    expect(s.checkArrivals(SAKNGAM_TRASH)).toBe(true); // 6) กองขยะ
    finish(s);
    expect(s.flags.has('trash-found')).toBe(true);
    talk(s, 'jiao'); // 7) รายงานป้าเจียว
    toQuiz(s);
    s.answerQuiz(rightIdx('q-adv1'));
    toQuiz(s);
    s.answerQuiz(rightIdx('q-adv2'));
    finish(s);
    expect(s.flags.has('m-report')).toBe(true);
    expect(p.rpg.coins).toBe(100);
  });
});

describe('สักงาม: ให้คำแนะนำป้าเจียว 2 ข้อ (ตอบผิด HP พญาจระเข้ +10 สูงสุด 50)', () => {
  function atJiao() {
    const s = newSession(L);
    const p = new ProgressStore(null, 'sakngam');
    s.wallet = p;
    for (const f of ['q-school', 'met-headman', 'route-known', 'go-wat', 'at-wat', 'monk-talked', 'trash-told', 'trash-route', 'trash-found']) s.flags.add(f);
    talk(s, 'jiao');
    return { s, p };
  }

  it('ตอบผิด +10 ต่อครั้ง · แจ้ง "พลังมลพิษพญาจระเข้ +10!" · เลือกใหม่ได้ · รวมไม่เกิน 50 · บันทึกลงข้อมูลเกม', () => {
    const { s, p } = atJiao();
    toQuiz(s);
    expect((s.dialogueView as { question: string }).question).toBe('ถ้าชาวบ้านทิ้งขยะลงลำธาร จะเกิดผลกระทบอย่างไร?');
    s.answerQuiz(wrongIdx('q-adv1'));
    expect(p.rpg.bossHpBonus).toBe(10);
    expect(s.drainToasts()).toContain('พลังมลพิษพญาจระเข้ +10!');
    expect(s.dialogueView).toMatchObject({ kind: 'quiz' }); // เลือกใหม่ได้ ไม่มีบทเรียนมาตราส่วน
    for (let i = 0; i < 9; i++) s.answerQuiz(wrongIdx('q-adv1'));
    expect(p.rpg.bossHpBonus).toBe(50);
    s.answerQuiz(rightIdx('q-adv1'));
    toQuiz(s);
    expect((s.dialogueView as { question: string }).question).toBe('ควรจัดการขยะอย่างไรเพื่อไม่ให้เกิดปัญหาซ้ำ?');
    s.drainToasts();
    s.answerQuiz(wrongIdx('q-adv2'));
    expect(p.rpg.bossHpBonus).toBe(50); // เต็มแล้ว ไม่เพิ่มอีก
    expect(s.drainToasts()).not.toContain('พลังมลพิษพญาจระเข้ +10!');
    s.answerQuiz(rightIdx('q-adv2'));
    finish(s);
    expect(s.flags.has('m-report')).toBe(true);
    expect(p.rpg.coins).toBe(100);
    expect(p.rpg.faith).toBe(10);
  });

  it('ตอบถูกทั้ง 2 ข้อ → ไม่เพิ่ม HP · ค่าที่เพิ่มถูกนำไปใช้กับบอสจริง (บันทึก/โหลดแล้วยังอยู่)', () => {
    const a = atJiao();
    toQuiz(a.s);
    a.s.answerQuiz(rightIdx('q-adv1'));
    toQuiz(a.s);
    a.s.answerQuiz(rightIdx('q-adv2'));
    finish(a.s);
    expect(a.p.rpg.bossHpBonus).toBe(0);
    expect(startBattle(a.p.rpg).bossMaxHp).toBe(320);

    const b = atJiao();
    toQuiz(b.s);
    b.s.answerQuiz(wrongIdx('q-adv1'));
    b.s.answerQuiz(wrongIdx('q-adv1'));
    expect(startBattle(b.p.rpg).bossMaxHp).toBe(340);
    expect(startBattle(b.p.rpg).bossHp).toBe(340);
    const storage = new Map<string, string>();
    const store = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) };
    const p1 = new ProgressStore(store, 'sakngam');
    expect(p1.addBossHp(10, 50)).toBe(10);
    expect(new ProgressStore(store, 'sakngam').rpg.bossHpBonus).toBe(10);
  });

  it('ตอบผิดครั้งแรกในทุกโจทย์มาตราส่วน ไม่เพิ่ม HP บอส (เฉพาะ 2 ข้อคำแนะนำ)', () => {
    for (const q of L.quizzes!) {
      const adv = q.id.startsWith('q-adv');
      expect(q.wrongEffects?.some((e) => e.type === 'bossHp') ?? false, q.id).toBe(adv);
      if (!adv) expect(q.wrongLesson, q.id).toBe('scale');
    }
  });
});

describe('สักงาม: เล่นตามภารกิจ — ไม่มีการนำทาง', () => {
  it('ไม่มีลูกศร/เป้าหมายนำทาง/จุดลับบนแผนที่ ในทุกขั้น', () => {
    expect(L.exploreMode).toBe(true);
    const s = newSession(L);
    for (const f of ['start', 'q-school', 'met-headman', 'route-known', 'go-wat', 'at-wat', 'monk-talked', 'trash-route', 'trash-found', 'm-report']) {
      if (f !== 'start') s.flags.add(f);
      expect(guideTarget(s), f).toBeNull();
      expect(buildQuestTracker(s, {}).target, f).toBeNull();
    }
    expect(L.landmarks.every((l) => l.knownWhen === undefined && !l.revealFlag)).toBe(true);
  });

  it('แถบภารกิจแสดงคำบอกทางที่ได้รับแล้ว (อ่านซ้ำได้) และไม่เฉลยก่อนตอบถูก', () => {
    const s = newSession(L);
    const text = (x: GameSession) => {
      const t = buildQuestTracker(x, {});
      return [t.objective, ...t.steps].join(' ');
    };
    expect(text(s)).not.toContain('400');
    s.flags.add('q-school');
    s.flags.add('met-headman');
    s.updateQuests(true);
    expect(text(s)).toContain('3 ซม.');
    expect(text(s)).not.toContain('300 เมตร');
    s.flags.add('route-known');
    s.updateQuests(true);
    expect(text(s)).toContain('ทิศตะวันตก 300 เมตร');
    s.flags.add('go-wat');
    s.updateQuests(true);
    expect(text(s)).toContain('สำนักสงฆ์เขาแสงเพชร');
    expect(text(s)).not.toContain('230 เมตร');
    s.flags.add('monk-talked');
    s.updateQuests(true);
    expect(text(s)).toContain('กลับไปพบผู้ใหญ่บ้านเพื่อสอบถามตำแหน่งกองขยะ');
    expect(text(s)).not.toContain('230 เมตร'); // ยังไม่เฉลยคำตอบก่อนตอบถูก
    s.flags.add('trash-route');
    s.updateQuests(true);
    expect(text(s)).toContain('ตะวันออก 2.3 ซม. บนแผนที่ = 230 เมตร');
  });
});
