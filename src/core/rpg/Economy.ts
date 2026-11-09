/**
 * เงินตรา · พลังศรัทธา · ร้านค้า · อุปกรณ์ (ตรรกะล้วน ทดสอบได้) — ไม่มีระบบ Inventory ใหญ่: ของทุกอย่างอยู่ใน RpgState เดียว
 * ค่าตั้งต้น 0 · ได้รางวัลภารกิจครั้งเดียวต่อรหัส (id) · เงินไม่ติดลบ · อาวุธ/เกราะสวมได้อย่างละ 1 ชิ้น (ซื้อใหม่ = สวมแทน เก็บของเดิมไว้)
 */
export interface ShopItem {
  id: string;
  kind: 'weapon' | 'armor' | 'potion';
  name: string;
  price: number;
  /** โจมตี (+) / ป้องกัน (+) / HP ที่ฟื้น */
  power: number;
  /** ภาพไอคอนใน public/rpg/ (ถ้ามี) */
  icon: string;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'wood-sword', kind: 'weapon', name: 'ดาบไม้', price: 100, power: 5, icon: 'rpg/wood-sword.png' },
  { id: 'iron-sword', kind: 'weapon', name: 'ดาบเหล็ก', price: 300, power: 15, icon: 'rpg/iron-sword.png' },
  { id: 'water-sword', kind: 'weapon', name: 'ดาบวารี', price: 600, power: 30, icon: 'rpg/water-sword.png' },
  { id: 'leather-armor', kind: 'armor', name: 'เกราะหนัง', price: 100, power: 5, icon: 'rpg/leather-armor.png' },
  { id: 'iron-armor', kind: 'armor', name: 'เกราะเหล็ก', price: 300, power: 15, icon: 'rpg/iron-armor.png' },
  { id: 'guardian-armor', kind: 'armor', name: 'เกราะผู้พิทักษ์', price: 600, power: 30, icon: 'rpg/guardian-armor.png' },
  { id: 'potion', kind: 'potion', name: 'ยารักษา', price: 50, power: 30, icon: 'rpg/potion.png' },
];

export const item = (id: string): ShopItem | undefined => SHOP_ITEMS.find((i) => i.id === id);

export interface RpgState {
  coins: number;
  faith: number;
  potions: number;
  /** อาวุธ/เกราะที่ซื้อแล้ว */
  owned: string[];
  weapon: string | null;
  armor: string | null;
  /** รหัสรางวัลที่รับไปแล้ว (ได้รางวัลครั้งเดียว) */
  rewarded: string[];
  /** เล่น Golden Time แล้ว (เข้าได้ครั้งเดียวต่อเกมใหม่) */
  goldenDone: boolean;
  goldenCoins: number;
  /** ผ่านร้านค้าแล้ว (ไปบทต่อสู้) · ชนะพญาจระเข้แล้ว (จบเกม) */
  shopDone: boolean;
  bossDone: boolean;
  /** จำนวนครั้งที่แพ้พญาจระเข้ (ช่วยผ่อนแรงบอสเล็กน้อยเมื่อลองซ้ำ) */
  bossLosses: number;
}

export function emptyRpg(): RpgState {
  return { coins: 0, faith: 0, potions: 0, owned: [], weapon: null, armor: null, rewarded: [], goldenDone: false, goldenCoins: 0, shopDone: false, bossDone: false, bossLosses: 0 };
}

/** อ่านข้อมูลบันทึก (ข้อมูลเสีย/ขาดช่อง → ค่าเริ่มต้น เงินและพลังไม่ติดลบ) */
export function sanitizeRpg(raw: unknown): RpgState {
  const base = emptyRpg();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<RpgState>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const owned = strs(r.owned).filter((id) => item(id) && item(id)!.kind !== 'potion');
  const pick = (id: unknown, kind: ShopItem['kind']) => (typeof id === 'string' && owned.includes(id) && item(id)?.kind === kind ? id : null);
  return {
    coins: n(r.coins),
    faith: n(r.faith),
    potions: n(r.potions),
    owned,
    weapon: pick(r.weapon, 'weapon'),
    armor: pick(r.armor, 'armor'),
    rewarded: strs(r.rewarded),
    goldenDone: r.goldenDone === true,
    goldenCoins: n(r.goldenCoins),
    shopDone: r.shopDone === true,
    bossDone: r.bossDone === true,
    bossLosses: Math.min(5, n(r.bossLosses)),
  };
}

/** รางวัลภารกิจ: ครั้งแรกเท่านั้น (ทำซ้ำไม่ได้เพิ่ม) · true = ได้รางวัลครั้งนี้ */
export function earnReward(s: RpgState, id: string, coins: number, faith: number): boolean {
  if (s.rewarded.includes(id)) return false;
  s.rewarded.push(id);
  s.coins += Math.max(0, coins);
  s.faith += Math.max(0, faith);
  return true;
}

export type BuyResult = 'ok' | 'owned' | 'poor' | 'unknown';

export function canBuy(s: RpgState, id: string): BuyResult {
  const it = item(id);
  if (!it) return 'unknown';
  if (it.kind !== 'potion' && s.owned.includes(id)) return 'owned';
  return s.coins >= it.price ? 'ok' : 'poor';
}

/** ซื้อ: หักเงิน · อาวุธ/เกราะ = สวมแทนชิ้นเดิม (ของเดิมยังอยู่ในรายการ) · ยา = เพิ่มจำนวน */
export function buy(s: RpgState, id: string): BuyResult {
  const r = canBuy(s, id);
  if (r !== 'ok') return r;
  const it = item(id)!;
  s.coins -= it.price;
  if (it.kind === 'potion') s.potions += 1;
  else {
    s.owned.push(id);
    s[it.kind] = id;
  }
  return 'ok';
}

/** ค่าพลังจากอุปกรณ์ที่สวมอยู่ */
export function attackBonus(s: RpgState): number {
  return s.weapon ? (item(s.weapon)?.power ?? 0) : 0;
}
export function defenseBonus(s: RpgState): number {
  return s.armor ? (item(s.armor)?.power ?? 0) : 0;
}
