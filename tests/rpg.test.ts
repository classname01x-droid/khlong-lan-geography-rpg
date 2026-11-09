import { describe, expect, it } from 'vitest';
import { GOLDEN_QUESTIONS } from '../src/content/rpg/goldenQuestions';
import { commitVictory, mercyScales, mitigate, SKILLS, startBattle, takeTurn, type BattleAction, type BattleState } from '../src/core/rpg/Battle';
import { attackBonus, buy, canBuy, defenseBonus, earnReward, emptyRpg, sanitizeRpg, SHOP_ITEMS } from '../src/core/rpg/Economy';
import { GoldenTime, GOLDEN_DURATION_MS } from '../src/core/rpg/GoldenTime';
import { LEGACY_PROGRESS_KEY, PROGRESS_KEY, ProgressStore, STORY_VERSION, type StorageLike } from '../src/core/progress/ProgressStore';

class Mem implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}
/** สุ่มแบบกำหนดผลได้ (ทดสอบซ้ำได้) */
const seeded = (seed = 1) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe('เงินตรา พลังศรัทธา และรางวัล', () => {
  it('เริ่มเกมใหม่: 0 เหรียญ 0 ศรัทธา ไม่มีอุปกรณ์', () => {
    expect(emptyRpg()).toMatchObject({ coins: 0, faith: 0, potions: 0, owned: [], weapon: null, armor: null, goldenDone: false });
  });

  it('รางวัลภารกิจ +100 เหรียญ +10 ศรัทธา ได้ครั้งเดียวต่อภารกิจ (ทำซ้ำไม่ได้เพิ่ม)', () => {
    const s = emptyRpg();
    expect(earnReward(s, 'm1', 100, 10)).toBe(true);
    expect(earnReward(s, 'm1', 100, 10)).toBe(false);
    expect(earnReward(s, 'm2', 100, 10)).toBe(true);
    expect([s.coins, s.faith]).toEqual([200, 20]);
  });

  it('ข้อมูลบันทึกเสีย/ติดลบ/อุปกรณ์ที่ไม่ได้ซื้อ → ถูกแก้ให้ปลอดภัย', () => {
    const s = sanitizeRpg({ coins: -50, faith: 'x', owned: ['iron-sword', 'ghost'], weapon: 'water-sword', armor: 'iron-armor', potions: 2.7 });
    expect(s.coins).toBe(0);
    expect(s.faith).toBe(0);
    expect(s.owned).toEqual(['iron-sword']);
    expect(s.weapon).toBeNull(); // ไม่ได้ซื้อ → ไม่สวม
    expect(s.potions).toBe(2);
    expect(sanitizeRpg(null)).toEqual(emptyRpg());
  });
});

describe('ร้านค้า', () => {
  it('รายการและราคาตรงสเปก', () => {
    const t = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, [i.price, i.power]]));
    expect(t).toEqual({
      'wood-sword': [100, 5],
      'iron-sword': [300, 15],
      'water-sword': [600, 30],
      'leather-armor': [100, 5],
      'iron-armor': [300, 15],
      'guardian-armor': [600, 30],
      potion: [50, 30],
    });
  });

  it('เงินไม่พอซื้อไม่ได้ เงินไม่ติดลบ', () => {
    const s = emptyRpg();
    s.coins = 90;
    expect(canBuy(s, 'wood-sword')).toBe('poor');
    expect(buy(s, 'wood-sword')).toBe('poor');
    expect(s.coins).toBe(90);
    expect(buy(s, 'nope')).toBe('unknown');
  });

  it('ซื้ออาวุธ/เกราะ → หักเงิน สวมทันที ค่าพลังเปลี่ยนตามอุปกรณ์', () => {
    const s = emptyRpg();
    s.coins = 1000;
    expect(buy(s, 'iron-sword')).toBe('ok');
    expect(buy(s, 'leather-armor')).toBe('ok');
    expect(s.coins).toBe(600);
    expect([s.weapon, s.armor]).toEqual(['iron-sword', 'leather-armor']);
    expect([attackBonus(s), defenseBonus(s)]).toEqual([15, 5]);
  });

  it('ซื้ออุปกรณ์ใหม่ = สวมแทนชิ้นเดิม แต่ยังเก็บของเดิมไว้ · ซื้อซ้ำไม่ได้', () => {
    const s = emptyRpg();
    s.coins = 2000;
    buy(s, 'wood-sword');
    buy(s, 'water-sword');
    expect(s.weapon).toBe('water-sword');
    expect(s.owned).toEqual(expect.arrayContaining(['wood-sword', 'water-sword']));
    expect(canBuy(s, 'wood-sword')).toBe('owned');
    const coins = s.coins;
    expect(buy(s, 'wood-sword')).toBe('owned');
    expect(s.coins).toBe(coins);
  });

  it('ยารักษาซื้อได้หลายขวด', () => {
    const s = emptyRpg();
    s.coins = 150;
    buy(s, 'potion');
    buy(s, 'potion');
    buy(s, 'potion');
    expect([s.potions, s.coins]).toEqual([3, 0]);
    expect(buy(s, 'potion')).toBe('poor');
  });
});

describe('Golden Time', () => {
  it('ถูก +100 · ผิด −1 หัวใจ ไม่หักเงิน · หัวใจหมด = จบ', () => {
    const g = new GoldenTime(GOLDEN_QUESTIONS, seeded(3));
    const q = g.current!;
    expect(g.answer(q.correct)).toMatchObject({ correct: true });
    expect([g.coins, g.hearts]).toEqual([100, 3]);
    g.next();
    for (let i = 0; i < 3; i++) {
      const cur = g.current!;
      g.answer((cur.correct + 1) % 3);
      if (!g.over) g.next();
    }
    expect([g.coins, g.hearts, g.over]).toEqual([100, 0, 'hearts']); // ตอบผิดไม่หักเงิน
    expect(g.current).toBeNull();
  });

  it('เวลา 5 นาที นับถอยหลัง · เหลือ 30 วินาทีเปลี่ยนสี · หมดเวลาจบ (เก็บเหรียญที่ได้)', () => {
    const g = new GoldenTime(GOLDEN_QUESTIONS, seeded(5));
    expect(g.timeLeftMs).toBe(GOLDEN_DURATION_MS);
    g.answer(g.current!.correct);
    g.next();
    g.tick(GOLDEN_DURATION_MS - 31_000);
    expect(g.lowTime).toBe(false);
    g.tick(1_000);
    expect(g.lowTime).toBe(true);
    g.tick(40_000);
    expect([g.over, g.coins, g.timeLeftMs]).toEqual(['time', 100, 0]);
    g.tick(1000); // จบแล้วไม่นับต่อ
    expect(g.timeLeftMs).toBe(0);
  });

  it('คำถามทุกข้อ 3 ตัวเลือก · คำตอบถูกมีตัวเดียว · สุ่มไม่ซ้ำจนครบคลัง แล้วจบพร้อมรางวัล', () => {
    for (const d of GOLDEN_QUESTIONS) expect(new Set(d.c).size).toBe(3);
    expect(GOLDEN_QUESTIONS.length).toBeGreaterThanOrEqual(24);
    const g = new GoldenTime(GOLDEN_QUESTIONS, seeded(7));
    const seen = new Set<string>();
    while (g.current) {
      const q = g.current;
      expect(seen.has(q.id)).toBe(false);
      seen.add(q.id);
      expect(q.choices[q.correct]).toBe(GOLDEN_QUESTIONS.find((d) => d.id === q.id)!.c[0]);
      g.answer(q.correct);
      g.next();
    }
    expect(seen.size).toBe(GOLDEN_QUESTIONS.length);
    expect([g.over, g.coins]).toEqual(['bank', GOLDEN_QUESTIONS.length * 100]);
  });

  it('ตอบผิดหมด: จบทันทีที่หัวใจหมด ได้ 0 เหรียญ เกมไปต่อได้ (ไม่มี Game Over)', () => {
    const g = new GoldenTime(GOLDEN_QUESTIONS, seeded(9));
    while (g.current) {
      g.answer((g.current.correct + 1) % 3);
      g.next();
    }
    expect([g.coins, g.hearts, g.over]).toEqual([0, 0, 'hearts']);
  });
});

describe('การบันทึก: เหรียญ ศรัทธา อุปกรณ์ Golden Time และการย้ายบันทึกเก่า', () => {
  it('บันทึกและโหลดกลับมาครบ', () => {
    const mem = new Mem();
    const a = new ProgressStore(mem, 'sakngam');
    a.finishGolden(300);
    a.earn('m1', 100, 10);
    a.rpg.coins += 400;
    a.buy('iron-sword');
    a.buy('potion');
    const b = new ProgressStore(mem, 'sakngam');
    expect(b.rpg).toMatchObject({ coins: 300 + 100 + 400 - 300 - 50, faith: 10, potions: 1, weapon: 'iron-sword', goldenDone: true, goldenCoins: 300 });
    expect(b.data.storyVersion).toBe(STORY_VERSION);
  });

  it('Golden Time เข้าได้ครั้งเดียว: จบแล้วเรียกซ้ำไม่ได้เหรียญเพิ่ม · เกมใหม่ล้างทั้งหมด', () => {
    const p = new ProgressStore(new Mem(), 'sakngam');
    p.finishGolden(200);
    p.finishGolden(900);
    expect([p.rpg.coins, p.rpg.goldenCoins]).toEqual([200, 200]);
    expect(p.hasAnySave()).toBe(true);
    p.resetAll();
    expect(p.rpg).toEqual(emptyRpg());
    expect(p.hasAnySave()).toBe(false);
  });

  it('บันทึกเนื้อเรื่องเก่า (หีบสมบัติ) → สำรองไว้ เริ่มใหม่ ไม่ค้าง · คงข้อมูลสำรองไว้', () => {
    const mem = new Mem();
    const old = { version: 2, completed: { sakngam: { levelId: 'sakngam', codePiece: { index: 1, total: 4, value: 'ลาย' } } }, unlocked: ['sakngam', 'level-2'], codePieces: { sakngam: { index: 1, total: 4, value: 'ลาย' } }, inProgress: {} };
    mem.setItem(PROGRESS_KEY, JSON.stringify(old));
    const p = new ProgressStore(mem, 'sakngam');
    expect(p.legacyReset).toBe(true);
    expect(Object.keys(p.data.completed)).toEqual([]);
    expect(p.data.unlocked).toEqual(['sakngam']);
    expect(p.rpg).toEqual(emptyRpg());
    expect(JSON.parse(mem.getItem(LEGACY_PROGRESS_KEY)!).codePieces.sakngam.value).toBe('ลาย');
  });

  it('บันทึกเก่าที่ว่าง (ไม่เคยเล่น) → ไม่แจ้งรีเซ็ต · ข้อมูลเสีย → เริ่มใหม่', () => {
    const mem = new Mem();
    mem.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, completed: {}, unlocked: ['sakngam'], codePieces: {}, inProgress: {} }));
    expect(new ProgressStore(mem, 'sakngam').legacyReset).toBe(false);
    mem.setItem(PROGRESS_KEY, '{not json');
    expect(new ProgressStore(mem, 'sakngam').data.unlocked).toEqual(['sakngam']);
  });
});

/* ---------------- สมดุลการต่อสู้ ---------------- */

function fight(rpg = emptyRpg(), losses = 0, policy: (s: BattleState) => BattleAction, maxTurns = 400): BattleState {
  const s = startBattle(rpg, losses);
  for (let i = 0; i < maxTurns && !s.over; i++) takeTurn(s, policy(s));
  return s;
}
/** ผู้เล่นอย่างง่าย: HP ต่ำ → ใช้ยา · ศรัทธาพอ → สกิลแรงสุด · ไม่งั้นโจมตี */
const smart = (s: BattleState): BattleAction => {
  if (s.hp <= 45 && s.potions > 0) return 'potion';
  if (s.faith >= 60) return 'skill-purify';
  if (s.faith >= 20) return 'skill-slash';
  return 'attack';
};
const attackOnly = (): BattleAction => 'attack';
const kit = (coins: number, ...ids: string[]) => {
  const r = emptyRpg();
  r.coins = coins;
  for (const id of ids) buy(r, id);
  return r;
};

describe('ต่อสู้พญาจระเข้ (เลือกคำสั่ง)', () => {
  it('ค่าเริ่มต้น: HP ผู้เล่น 100 · โจมตีพื้นฐาน 10 + พลังอาวุธ', () => {
    expect(startBattle(emptyRpg())).toMatchObject({ hp: 100, attackPower: 10, defense: 0, over: null });
    expect(startBattle(kit(1000, 'iron-sword', 'iron-armor'))).toMatchObject({ attackPower: 25, defense: 15 });
  });

  it('โจมตีปกติ: 10 + อาวุธ · บอสโจมตีกลับทุกตา', () => {
    const s = startBattle(kit(600, 'water-sword'));
    const ev = takeTurn(s, 'attack');
    expect(ev[0]).toMatchObject({ kind: 'player-attack', amount: 40 });
    expect(s.bossHp).toBe(280);
    expect(ev[1].kind).toBe('boss-attack');
    expect(s.hp).toBeLessThan(100);
  });

  it('เกราะลดความเสียหาย แต่ไม่ต่ำกว่า 30% ของค่าเดิม (บอสไม่ใช่โจมตีไม่เข้า)', () => {
    expect(mitigate(16, 0)).toBe(16);
    expect(mitigate(16, 5)).toBe(11);
    expect(mitigate(16, 30)).toBe(5);
    expect(mitigate(26, 1000)).toBe(8);
    expect(mitigate(1, 1000)).toBe(1);
  });

  it('สกิลหักพลังศรัทธาตามราคา: คมดาบ 20 · โล่ 35 · แสงศรัทธา 60', () => {
    expect(Object.values(SKILLS).map((k) => k.cost)).toEqual([20, 35, 60]);
    const r = emptyRpg();
    r.faith = 115;
    const s = startBattle(r);
    takeTurn(s, 'skill-slash');
    expect(s.faith).toBe(95);
    takeTurn(s, 'skill-shield');
    expect(s.faith).toBe(60);
    takeTurn(s, 'skill-purify');
    expect(s.faith).toBe(0);
  });

  it('ศรัทธาไม่พอ = ใช้สกิลไม่ได้ (ไม่เสียตา ไม่หักพลัง) · ไม่มียา = ใช้ยาไม่ได้', () => {
    const s = startBattle(emptyRpg());
    const hp = s.hp;
    expect(takeTurn(s, 'skill-slash')[0].kind).toBe('denied');
    expect(takeTurn(s, 'potion')[0].kind).toBe('denied');
    expect([s.faith, s.hp, s.turn, s.bossHp]).toEqual([0, hp, 1, 320]);
  });

  it('คมดาบ ×2.5 · แสงศรัทธา ×4 + 40 · โล่ลดการโจมตีครั้งถัดไป', () => {
    const r = emptyRpg();
    r.faith = 200;
    const s = startBattle(r);
    expect(takeTurn(s, 'skill-slash')[0].amount).toBe(25);
    expect(takeTurn(s, 'skill-purify')[0].amount).toBe(80);
    const a = startBattle(r);
    const b = startBattle(r);
    takeTurn(a, 'attack');
    takeTurn(b, 'skill-shield');
    expect(100 - b.hp).toBeLessThan(100 - a.hp);
    expect(b.shield).toBe(false); // ใช้ไปแล้ว
  });

  it('ยาฟื้น HP 30 (ไม่เกิน 100) และใช้ 1 ตา', () => {
    const r = emptyRpg();
    r.potions = 2;
    const s = startBattle(r);
    s.hp = 50;
    expect(takeTurn(s, 'potion')[0]).toMatchObject({ kind: 'player-heal', amount: 30 });
    expect(s.potions).toBe(1);
    s.hp = 95;
    expect(takeTurn(s, 'potion')[0].amount).toBe(5);
  });

  it('บอสโจมตีวน: ตี ตี คลื่นน้ำ', () => {
    const s = startBattle(emptyRpg());
    const kinds = [1, 2, 3, 4].map(() => takeTurn(s, 'attack').find((e) => e.kind.startsWith('boss'))!.kind);
    expect(kinds).toEqual(['boss-attack', 'boss-attack', 'boss-wave', 'boss-attack']);
  });

  it('ชนะได้โดยไม่ต้องซื้อของแพงที่สุดหรือเก็บศรัทธาครบ: ชุดเหล็ก + ยา 2 ขวด ศรัทธา 20', () => {
    const r = kit(1200, 'iron-sword', 'iron-armor');
    buy(r, 'potion');
    buy(r, 'potion');
    r.faith = 20;
    const s = fight(r, 0, smart);
    expect(s.over).toBe('won');
  });

  it('ชุดไม้ + หนัง (200 เหรียญ) + ยาด้วยเงินที่เหลือ ก็ชนะได้', () => {
    const r = kit(1200, 'wood-sword', 'leather-armor');
    while (buy(r, 'potion') === 'ok' && r.potions < 12);
    expect(fight(r, 0, smart).over).toBe('won');
  });

  it('รายได้ขั้นต่ำ (ภารกิจครบ 12 ข้อ = 1,200 เหรียญ 120 ศรัทธา โดยไม่เล่น Golden Time) ซื้อชุดเหล็กได้ และชนะได้', () => {
    const r = emptyRpg();
    for (let i = 0; i < 12; i++) earnReward(r, `m${i}`, 100, 10);
    expect([r.coins, r.faith]).toEqual([1200, 120]);
    buy(r, 'iron-sword');
    buy(r, 'iron-armor');
    buy(r, 'potion');
    buy(r, 'potion');
    expect(r.coins).toBe(1200 - 600 - 100);
    expect(fight(r, 0, smart).over).toBe('won');
  });

  it('ชุดผู้พิทักษ์ (ราคาสูงสุด) ชนะได้ง่าย และบอสยังทำร้ายได้ (ไม่ต่ำกว่าขั้นต่ำ)', () => {
    const s = fight(kit(2000, 'water-sword', 'guardian-armor'), 0, attackOnly);
    expect(s.over).toBe('won');
    expect(s.hp).toBeLessThan(100);
  });

  it('ไม่ติดอยู่: ไม่มีอุปกรณ์ ไม่มียา ไม่มีศรัทธา → แพ้ได้ แต่ยิ่งแพ้ยิ่งง่ายจนชนะได้แน่นอน', () => {
    const bare = emptyRpg();
    expect(fight(bare, 0, attackOnly).over).toBe('lost');
    const wins = [0, 1, 2, 3, 4, 5].map((l) => fight(bare, l, attackOnly).over);
    expect(wins[5]).toBe('won');
    expect(wins.indexOf('won')).toBeGreaterThan(0); // ต้องมีขั้นเริ่มจากแพ้ก่อน
    expect(mercyScales(99)).toEqual(mercyScales(5)); // สูงสุด 5 ครั้ง
    expect(mercyScales(0)).toEqual({ damage: 1, hp: 1 });
  });

  it('ใช้เงินหมดไปกับยาอย่างเดียว (เลือกผิด) ก็ยังชนะได้เมื่อสู้ซ้ำ', () => {
    const r = emptyRpg();
    r.coins = 1200;
    while (buy(r, 'potion') === 'ok');
    expect(r.potions).toBe(24);
    expect(fight(r, 5, smart).over).toBe('won');
  });

  it('แพ้ = ไม่เสียทรัพยากร (สำเนา) · ชนะแล้วค่อยบันทึกยา/ศรัทธาที่เหลือ', () => {
    const r = kit(1000, 'wood-sword');
    r.potions = 3;
    r.faith = 40;
    const lost = startBattle(r);
    lost.hp = 1;
    takeTurn(lost, 'attack');
    expect(lost.over).toBe('lost');
    expect([r.potions, r.faith]).toEqual([3, 40]);
    const won = fight(kit(2000, 'water-sword', 'guardian-armor'), 0, attackOnly);
    const rr = emptyRpg();
    rr.potions = 2;
    rr.faith = 30;
    commitVictory(rr, { ...won, potions: 1, faith: 10 });
    expect([rr.potions, rr.faith]).toEqual([1, 10]);
  });
});
