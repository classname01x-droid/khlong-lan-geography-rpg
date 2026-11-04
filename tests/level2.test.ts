import { describe, expect, it } from 'vitest';
import { khlongNamLaiLevel as L2 } from '../src/content/levels/khlongnamlai';
import { STREAM_POINTS } from '../src/content/levels/khlongnamlai/map';
import { sakNgamLevel } from '../src/content/levels/sakngam';
import { getLevelSlot } from '../src/content/registry';
import type { LevelDefinition } from '../src/content/types';
import { validateLevel } from '../src/content/validateLevel';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import { evaluateSite } from '../src/core/site/SiteAnalysis';
import { ElevationModel } from '../src/core/world/Elevation';
import { buildWorld } from '../src/core/world/MapBuilder';
import { analyzeWaterway } from '../src/core/world/Waterway';
import { explore, newSession, talk } from './helpers';

const elevation = new ElevationModel(L2.map.elevation!);

describe('ด่าน 2: ข้อมูลและความเข้ากันได้', () => {
  it('ใช้ id level-2 ที่จองไว้ และแผนที่ขนาดเท่าด่านแรก', () => {
    expect(L2.id).toBe('level-2');
    expect(getLevelSlot('level-2')?.tambon).toBe('ตำบลคลองน้ำไหล');
    expect([L2.map.widthTiles, L2.map.heightTiles]).toEqual([sakNgamLevel.map.widthTiles, sakNgamLevel.map.heightTiles]);
  });

  it('ใช้ ScaleSystem เดิม: 1 ช่อง = 10 ม., ระยะในบทพูดคำนวณจากแผนที่', () => {
    const s = newSession(L2);
    expect(s.scale).toBe(defaultScale);
    expect(s.resolveText('{{dist:school>water-office}}')).toBe('410');
  });

  it('ผ่าน validateLevel (จุดสังเกต NPC จุดตรวจค้นเดินถึงได้, ลำน้ำ, คำถาม, สถานที่ผู้ต้องสงสัย)', () => {
    expect(validateLevel(L2)).toEqual([]);
  });
});

describe('ทิศทางน้ำไหลคำนวณจากระดับความสูง (ไม่ใช่ตำแหน่งบนจอ)', () => {
  const flow = analyzeWaterway(STREAM_POINTS, elevation);

  it('ลำห้วยไหลไปทางเหนือ (ขึ้นด้านบนจอ) และระดับลดลงตลอดแนว', () => {
    expect(flow.flowDirection).toBe('N');
    expect(flow.monotonic).toBe(true);
    expect(flow.source.y).toBeGreaterThan(flow.mouth.y); // ต้นน้ำอยู่ "ด้านล่างจอ"
    expect(flow.sourceMeters).toBeGreaterThan(flow.mouthMeters);
  });

  it('ลำดับจุดของลำน้ำไม่มีผลต่อคำตอบ', () => {
    expect(analyzeWaterway([...STREAM_POINTS].reverse(), elevation).flowDirection).toBe('N');
  });

  it('ถ้ากลับด้านภูมิประเทศ (เหนือสูงกว่า) ทิศน้ำไหลกลับด้านตาม แม้แนวลำน้ำบนจอเหมือนเดิม', () => {
    const flipped = new ElevationModel({ baseMeters: 200, slope: { dx: 0.05, dy: -0.6 } });
    expect(analyzeWaterway(STREAM_POINTS, flipped).flowDirection).toBe('S');
  });

  it('หมุดหลักฐานระดับ: ฝั่งใต้สูงกว่าฝั่งเหนือ (ค่าคำนวณจากแบบจำลอง)', () => {
    const s = newSession(L2);
    const north = Number(s.resolveText('{{elev:bm-north}}'));
    const south = Number(s.resolveText('{{elev:bm-south}}'));
    expect(south).toBeGreaterThan(north);
    expect(s.resolveText('{{flow:stream-main}}')).toBe('ทิศเหนือ');
  });

  it('validateLevel จับได้ถ้าแก้ความสูงแล้วคำตอบเรื่องทิศน้ำไหลไม่ตรง', () => {
    const broken: LevelDefinition = {
      ...L2,
      map: { ...L2.map, elevation: { baseMeters: 200, slope: { dx: 0.05, dy: -0.6 } } },
    };
    const errors = validateLevel(broken);
    expect(errors.some((e) => e.includes('คำถาม flow') && e.includes('ทิศใต้'))).toBe(true);
  });
});

describe('สถานที่หลอก: มีเพียงตาน้ำที่ตรงกับหลักฐานทุกข้อ', () => {
  const s = newSession(L2);
  const results = Object.fromEntries(s.evaluateSites().map((r) => [r.landmarkId, r.failed]));

  it('มีสถานที่หลอกอย่างน้อย 2 แห่ง', () => {
    expect(L2.siteAnalysis!.candidates.length - 1).toBeGreaterThanOrEqual(2);
  });

  it('ตาน้ำผ่านทุกข้อ', () => {
    expect(results['spring']).toEqual([]);
  });

  it('หนองท้ายน้ำ (ด้านบนจอ) เป็นปลายน้ำ ไม่ใช่ต้นน้ำ และสัญลักษณ์ไม่ใช่ตาน้ำ', () => {
    expect(results['marsh']).toEqual(['upstream', 'symbol']);
  });

  it('ฝายอยู่กลางลำห้วย มีบนแผนที่เก่าแต่สัญลักษณ์ต่างกัน', () => {
    expect(results['weir']).toEqual(['upstream', 'symbol']);
  });

  it('บ่อในไร่ไม่อยู่บนลำห้วย และไม่มีบนแผนที่เก่า', () => {
    expect(results['farm-pond']).toEqual(['upstream', 'old-map', 'symbol']);
  });

  it('evaluateSite ตรวจได้ทีละข้อ', () => {
    const ev = s.siteEvidence()!;
    expect(evaluateSite({ x: 22, y: 54 }, { ...ev, requiredSymbol: 'weir' })).toEqual(['symbol']);
  });

  it('validateLevel จับได้ถ้าตั้งเป้าหมายผิดแห่ง', () => {
    const broken: LevelDefinition = { ...L2, siteAnalysis: { ...L2.siteAnalysis!, correctLandmarkId: 'marsh' } };
    expect(validateLevel(broken)).toContain('เป้าหมายจริง marsh ขัดกับหลักฐาน: upstream, symbol');
  });

  it('แผนที่เก่าไม่มีบ่อในไร่ (สร้างใหม่) แต่มีตาน้ำและหินสามก้อน', () => {
    const symbols = L2.oldMap!.marks.map((m) => m.symbol);
    expect(symbols).toContain('spring');
    expect(symbols).toContain('stones');
    expect(symbols).not.toContain('pond');
  });
});

describe('ภารกิจเริ่มต้นด่าน 2 (ฉาก 1–3)', () => {
  it('ครูเนม → ป้าจันทร์ (ได้แผนที่เก่า) → อ่านหมุด 2 จุด → ตอบทิศน้ำไหล', () => {
    const s = newSession(L2);
    expect(s.currentStepOrder).toBe(1);
    talk(s, 'teacher-nem');
    expect(s.currentStepOrder).toBe(2);
    expect(s.isOldMapAvailable()).toBe(false);

    talk(s, 'water-keeper');
    expect(s.evidence).toContain('old-map');
    expect(s.isOldMapAvailable()).toBe(true);
    expect(s.currentStepOrder).toBe(3);
    expect(s.questStatus.get('side-symbols')).toBe('active');

    // ยังไม่ได้อ่านหมุด → พี่ภูมิให้คำแนะนำ ไม่ถามคำถาม
    talk(s, 'surveyor-phum');
    expect(s.flags.has('flow-known')).toBe(false);

    for (const id of ['bm-north-read', 'bm-south-read']) {
      const p = L2.inspectPoints!.find((x) => x.id === id)!;
      expect(s.inspectPointAt(p.at)?.id).toBe(id);
      s.inspect(p);
      while (s.inDialogue) s.advanceDialogue();
    }
    expect(s.clues).toEqual(expect.arrayContaining(['clue-bm-north', 'clue-bm-south']));
    expect(s.skills.has('elevation')).toBe(true);

    // ตอบผิด (ทิศใต้ = เดาจากตำแหน่งบนจอ) แล้วได้คำใบ้ → ตอบถูก (ทิศเหนือ)
    s.talkTo(L2.npcs.find((n) => n.id === 'surveyor-phum')!);
    s.advanceDialogue();
    expect(s.dialogueView?.kind).toBe('quiz');
    expect(s.answerQuiz(0)).toBe(false);
    const v = s.dialogueView!;
    expect(v.kind === 'quiz' && v.feedback).toContain('ด้านล่างของแผนที่ไม่ได้แปลว่าต่ำกว่า');
    expect(s.answerQuiz(1)).toBe(true);
    while (s.inDialogue) s.advanceDialogue();
    expect(s.flags.has('flow-known')).toBe(true);
    expect(s.currentStepOrder).toBe(4);
    expect(s.mistakes.quiz).toBe(1);
    expect(s.questStatus.get('main-namlai')).toBe('active'); // ฉาก 4–6 ยังไม่เปิด
  });

  it('ภารกิจรองนักอ่านสัญลักษณ์: ดูแผนที่เก่า + สำรวจฝายและวัด', () => {
    const s = newSession(L2);
    talk(s, 'teacher-nem');
    talk(s, 'water-keeper');
    s.noteSkill('map-compare');
    explore(s, 'weir');
    explore(s, 'temple');
    expect(s.questStatus.get('side-symbols')).toBe('completed');
  });

  it('บันทึก/โหลดกลางด่าน 2 ได้ และไม่ปนกับด่าน 1', () => {
    const a = newSession(L2);
    talk(a, 'teacher-nem');
    talk(a, 'water-keeper');
    const snap = JSON.parse(JSON.stringify(a.toSnapshot()));
    const b = newSession(L2);
    expect(b.restore(snap)).toBe(true);
    expect(b.isOldMapAvailable()).toBe(true);
    expect(b.currentStepOrder).toBe(3);
    expect(newSession(sakNgamLevel).restore(snap)).toBe(false);
  });

  it('แผนที่ด่าน 2 สร้างซ้ำได้เหมือนเดิม (seed คงที่)', () => {
    expect(buildWorld(L2.map).objects).toEqual(buildWorld(L2.map).objects);
  });
});
