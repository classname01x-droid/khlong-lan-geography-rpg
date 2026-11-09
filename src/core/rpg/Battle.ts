import { attackBonus, defenseBonus, item, type RpgState } from './Economy';

/**
 * ต่อสู้พญาจระเข้ผู้พิทักษ์ — แบบเลือกคำสั่งทีละตา (ตรรกะล้วน ไม่มีสุ่ม ทดสอบได้)
 *
 *   ผู้เล่น HP 100 · โจมตีพื้นฐาน 10 + พลังอาวุธ
 *   บอส   HP 320 · ลำดับโจมตีวนซ้ำ: ตี · ตี · คลื่นน้ำ (แรงกว่า)
 *   เกราะ  ความเสียหาย = max(ขั้นต่ำ 30% ของค่าเดิม, ค่าเดิม − ป้องกัน) ← เกราะแรงแค่ไหนบอสก็ยังทำร้ายได้
 *   สกิล  คมดาบบารมี 20 ศรัทธา (โจมตี ×2.5) · โล่วารีพิทักษ์ 35 (ลดการโจมตีครั้งถัดไปเหลือ 25%) · แสงศรัทธาชำระคำสาป 60 (โจมตี ×4 + 40)
 *   ยา    ฟื้น HP 30 (ใช้ 1 ตา — บอสยังโจมตี)
 *
 * ไม่ติดอยู่เด็ดขาด: ทรัพยากรในการต่อสู้เป็นสำเนา — แพ้แล้วสู้ใหม่ได้ด้วยทรัพยากรเดิมครบ
 * และแต่ละครั้งที่แพ้ บอสอ่อนแรงลง (ความเสียหาย −16% · HP −10% ต่อครั้ง สูงสุด 5 ครั้ง)
 * ถึงขีดสุด ผู้เล่นที่ไม่มีอุปกรณ์ ไม่มียา ไม่มีศรัทธา ก็ชนะได้ (ทดสอบใน tests/rpg.test.ts)
 */
export const PLAYER_MAX_HP = 100;
export const PLAYER_BASE_ATTACK = 10;
export const BOSS_MAX_HP = 320;
export const BOSS_HIT = 14;
export const BOSS_WAVE = 24;
export const MIN_DAMAGE_RATIO = 0.3;
export const MERCY_MAX = 5;

export type BattleAction = 'attack' | 'potion' | 'skill-slash' | 'skill-shield' | 'skill-purify';

export const SKILLS: Record<'skill-slash' | 'skill-shield' | 'skill-purify', { name: string; cost: number }> = {
  'skill-slash': { name: 'คมดาบบารมี', cost: 20 },
  'skill-shield': { name: 'โล่วารีพิทักษ์', cost: 35 },
  'skill-purify': { name: 'แสงศรัทธาชำระคำสาป', cost: 60 },
};

export interface BattleState {
  hp: number;
  bossHp: number;
  bossMaxHp: number;
  faith: number;
  potions: number;
  attackPower: number;
  defense: number;
  /** ความเสียหายของบอสคูณด้วยค่านี้ (1 = ปกติ) */
  bossDamageScale: number;
  /** โล่วารีกำลังทำงาน (ลดการโจมตีครั้งถัดไป) */
  shield: boolean;
  turn: number;
  over: 'won' | 'lost' | null;
}

export interface BattleEvent {
  kind: 'player-attack' | 'player-heal' | 'player-shield' | 'boss-attack' | 'boss-wave' | 'blocked' | 'denied';
  /** ความเสียหายที่เกิดกับฝั่งตรงข้าม / HP ที่ฟื้น */
  amount: number;
  action?: BattleAction;
}

export function mercyScales(losses: number): { damage: number; hp: number } {
  const m = Math.max(0, Math.min(MERCY_MAX, losses));
  return { damage: 1 - 0.16 * m, hp: 1 - 0.1 * m };
}

/** เริ่มการต่อสู้จากทรัพยากรที่มี (เป็นสำเนา — ไม่แก้ RpgState จนกว่าจะชนะ) */
export function startBattle(rpg: RpgState, losses = 0): BattleState {
  const m = mercyScales(losses);
  const bossMax = Math.round(BOSS_MAX_HP * m.hp);
  return {
    hp: PLAYER_MAX_HP,
    bossHp: bossMax,
    bossMaxHp: bossMax,
    faith: rpg.faith,
    potions: rpg.potions,
    attackPower: PLAYER_BASE_ATTACK + attackBonus(rpg),
    defense: defenseBonus(rpg),
    bossDamageScale: m.damage,
    shield: false,
    turn: 1,
    over: null,
  };
}

/** ความเสียหายต่อผู้เล่นหลังหักเกราะ (ขั้นต่ำ 30% ของค่าเดิม และอย่างน้อย 1) */
export function mitigate(raw: number, defense: number): number {
  return Math.max(1, Math.ceil(raw * MIN_DAMAGE_RATIO), raw - defense);
}

export function playerDamage(s: BattleState, action: BattleAction): number {
  if (action === 'attack') return s.attackPower;
  if (action === 'skill-slash') return Math.round(s.attackPower * 2.5);
  if (action === 'skill-purify') return Math.round(s.attackPower * 4 + 40);
  return 0;
}

/** บอสโจมตีตาที่ n: 1,2 ตี · 3 คลื่นน้ำ · วนซ้ำ */
export function bossMove(turn: number): 'hit' | 'wave' {
  return turn % 3 === 0 ? 'wave' : 'hit';
}

/** ทำคำสั่งหนึ่งตา: ผู้เล่นทำก่อน แล้วบอสตอบโต้ (ถ้ายังไม่แพ้) — คืนเหตุการณ์ไว้ให้ฉากแสดง Animation */
export function takeTurn(s: BattleState, action: BattleAction): BattleEvent[] {
  const ev: BattleEvent[] = [];
  if (s.over) return ev;
  if (action === 'potion') {
    if (s.potions <= 0) return [{ kind: 'denied', amount: 0, action }];
    const heal = Math.min(item('potion')!.power, PLAYER_MAX_HP - s.hp);
    s.potions -= 1;
    s.hp += heal;
    ev.push({ kind: 'player-heal', amount: heal, action });
  } else if (action === 'attack') {
    const d = playerDamage(s, action);
    s.bossHp = Math.max(0, s.bossHp - d);
    ev.push({ kind: 'player-attack', amount: d, action });
  } else {
    const sk = SKILLS[action];
    if (s.faith < sk.cost) return [{ kind: 'denied', amount: 0, action }]; // พลังศรัทธาไม่พอ = ใช้ไม่ได้ (ไม่เสียตา)
    s.faith -= sk.cost;
    if (action === 'skill-shield') {
      s.shield = true;
      ev.push({ kind: 'player-shield', amount: 0, action });
    } else {
      const d = playerDamage(s, action);
      s.bossHp = Math.max(0, s.bossHp - d);
      ev.push({ kind: 'player-attack', amount: d, action });
    }
  }
  if (s.bossHp <= 0) {
    s.over = 'won';
    return ev;
  }
  const move = bossMove(s.turn);
  const raw = Math.round((move === 'wave' ? BOSS_WAVE : BOSS_HIT) * s.bossDamageScale);
  let dmg = mitigate(raw, s.defense);
  if (s.shield) {
    dmg = Math.max(1, Math.ceil(dmg * 0.25));
    s.shield = false;
    ev.push({ kind: 'blocked', amount: dmg });
  }
  s.hp = Math.max(0, s.hp - dmg);
  ev.push({ kind: move === 'wave' ? 'boss-wave' : 'boss-attack', amount: dmg });
  s.turn += 1;
  if (s.hp <= 0) s.over = 'lost';
  return ev;
}

/** ชนะแล้ว: บันทึกยา/ศรัทธาที่เหลือกลับเข้า RpgState (แพ้ = ไม่เรียก จึงไม่เสียของ) */
export function commitVictory(rpg: RpgState, s: BattleState): void {
  rpg.faith = s.faith;
  rpg.potions = s.potions;
}
