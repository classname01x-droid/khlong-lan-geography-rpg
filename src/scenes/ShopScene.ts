import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { attackBonus, defenseBonus, item, SHOP_ITEMS, type ShopItem } from '../core/rpg/Economy';
import { PLAYER_BASE_ATTACK, PLAYER_MAX_HP } from '../core/rpg/Battle';
import { characterTextureKey } from '../graphics/PlaceholderTextures';
import { wrapThaiText } from '../ui/textWrap';
import { FONT_FAMILY } from '../ui/theme';
import { getProgress, goToStage, SCENE } from './navigation';
import { Btn, drawCoin, floatText, gradientBg, pauseWhenHidden, PAL, panel, sparkle, txt } from './rpg/kit';

const CARD_W = 190;
const CARD_H = 142;
const ARMOR_TINT: Record<string, number> = { 'leather-armor': 0xd9a066, 'iron-armor': 0xcfd8e3, 'guardian-armor': 0x8fb4ff };

/** รายละเอียดสั้น ๆ ของไอเทมแต่ละชิ้น (ไม่ยาว อ่านได้ในจอมือถือ) */
const BLURB: Record<string, string> = {
  'wood-sword': 'ดาบไม้เริ่มต้น โจมตี +5',
  'iron-sword': 'ดาบเหล็กคมกว่า โจมตี +15',
  'water-sword': 'ดาบวารีเรืองแสงสีฟ้า โจมตี +30',
  'leather-armor': 'เกราะหนังเบา ป้องกัน +5',
  'iron-armor': 'เกราะเหล็กหนัก ป้องกัน +15',
  'guardian-armor': 'เกราะผู้พิทักษ์ ป้องกัน +30',
  potion: 'ยารักษา ฟื้น HP 30 (ซื้อได้หลายขวด)',
};

/**
 * ร้านค้า (บทที่ 5) — UI เดียว: อาวุธ 3 · เกราะ 3 · ยา · ตัวอย่างตัวละครที่สวมอุปกรณ์
 * ซื้ออาวุธ/เกราะใหม่ = สวมแทนชิ้นเดิม (ของเดิมยังเป็นของเรา สวมกลับได้) · ซื้อซ้ำไม่ได้ · ไม่มีขาย/อัปเกรด
 * ตรรกะซื้อ/เหรียญอยู่ที่ core/rpg/Economy.ts · เหรียญไม่พอ = ซื้อไม่ได้แต่ไปต่อสู้ได้เสมอ
 */
export class ShopScene extends Phaser.Scene {
  private selected: ShopItem = SHOP_ITEMS[0];
  private cards = new Map<string, Phaser.GameObjects.Container>();
  private marks = new Map<string, Phaser.GameObjects.Text>();
  private coinText!: Phaser.GameObjects.Text;
  private shownCoins = 0;
  private faithText!: Phaser.GameObjects.Text;
  private potionText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private blurbText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private buyBtn!: Btn;
  private heroBody!: Phaser.GameObjects.Image;
  private heroWeapon!: Phaser.GameObjects.Image;
  private weaponGlow!: Phaser.GameObjects.Ellipse;
  private armorBadge!: Phaser.GameObjects.Image;
  private selRing!: Phaser.GameObjects.Graphics;
  private glowTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super(SCENE.shop);
  }

  preload(): void {
    for (const it of SHOP_ITEMS) if (!this.textures.exists(`rpg-${it.id}`)) this.load.image(`rpg-${it.id}`, it.icon);
  }

  create(): void {
    const p = getProgress(this);
    this.cards.clear();
    this.marks.clear();
    this.selected = SHOP_ITEMS[0];
    this.shownCoins = p.rpg.coins;
    gradientBg(this, 0x1d2f4d, 0x0b1322);
    this.buildHud();
    this.buildCards();
    this.buildPreview();
    new Btn(this, 24, GAME_HEIGHT - 82, 606, 68, 'ไปสู้พญาจระเข้ ▶', () => this.proceed(), { fill: PAL.good, size: 32 });
    pauseWhenHidden(this);
    (window as unknown as { __SHOP__?: ShopScene }).__SHOP__ = this;
    this.select(this.selected, false);
    this.refresh();
  }

  /* ---------------- ส่วนประกอบ ---------------- */

  private buildHud(): void {
    const p = getProgress(this).rpg;
    panel(this, 16, 10, GAME_WIDTH - 32, 58, 0.85);
    txt(this, 30, 18, 'ร้านค้าคลองลาน', 28, PAL.gold);
    const g = this.add.graphics();
    drawCoin(g, 440, 39, 16);
    this.coinText = txt(this, 466, 39, String(p.coins), 32, PAL.gold).setOrigin(0, 0.5);
    this.faithText = txt(this, 610, 39, `✨ ${p.faith}`, 28, '#bfe3ff').setOrigin(0, 0.5);
    this.potionText = txt(this, 770, 39, `ยา ${p.potions}`, 28, '#9be39b').setOrigin(0, 0.5);
  }

  private buildCards(): void {
    const label = (y: number, s: string) => txt(this, 26, y, s, 22, PAL.soft);
    label(74, 'อาวุธ (เพิ่มพลังโจมตี)');
    label(228, 'เกราะ (ลดความเสียหาย)');
    label(382, 'ไอเทม');
    this.selRing = this.add.graphics().setDepth(5);
    const pos = (i: number): { x: number; y: number } => {
      if (i < 3) return { x: 24 + i * (CARD_W + 8), y: 98 };
      if (i < 6) return { x: 24 + (i - 3) * (CARD_W + 8), y: 252 };
      return { x: 24, y: 406 };
    };
    SHOP_ITEMS.forEach((it, i) => {
      const { x, y } = pos(i);
      const c = this.add.container(x + CARD_W / 2, y + CARD_H / 2);
      const bg = this.add.graphics();
      bg.fillStyle(0x15243b, 0.95).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
      bg.lineStyle(2, 0x45618f, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
      const icon = this.add.image(0, -26, `rpg-${it.id}`);
      icon.setScale(78 / Math.max(icon.width, icon.height));
      const name = txt(this, 0, 28, it.name, 22).setOrigin(0.5);
      const coin = this.add.graphics();
      drawCoin(coin, -22, 56, 11);
      const price = txt(this, -6, 56, String(it.price), 24, PAL.gold).setOrigin(0, 0.5);
      const mark = txt(this, 0, -CARD_H / 2 + 12, '', 16, '#9be39b').setOrigin(0.5);
      const zone = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.select(it, true));
      c.add([bg, icon, name, coin, price, mark, zone]);
      this.cards.set(it.id, c);
      this.marks.set(it.id, mark);
      // น้ำวารี: เรืองแสงฟ้าเบา ๆ ที่การ์ด
      if (it.id === 'water-sword') {
        const glow = this.add.ellipse(0, -26, 90, 90, 0x5ec8ff, 0.2);
        c.addAt(glow, 1);
        this.tweens.add({ targets: glow, alpha: 0.4, scale: 1.15, duration: 900, yoyo: true, repeat: -1 });
      }
    });
  }

  private buildPreview(): void {
    const X = 650;
    panel(this, X, 78, 290, 460, 0.88);
    txt(this, X + 145, 88, 'ตัวอย่าง', 20, PAL.soft).setOrigin(0.5, 0);
    // ตัวละคร placeholder (ใช้ชุดภาพที่มีอยู่) — อาวุธ/เกราะเป็นเลเยอร์แยก ไม่ซ้อนภาพทั้งตัวทับ
    this.weaponGlow = this.add.ellipse(X + 205, 205, 70, 70, 0x5ec8ff, 0).setDepth(2);
    this.heroBody = this.add.image(X + 145, 190, characterTextureKey('student'), 'side-0').setScale(8).setDepth(1);
    this.armorBadge = this.add.image(X + 145, 214, 'rpg-leather-armor').setScale(0.4).setDepth(3).setVisible(false);
    this.heroWeapon = this.add.image(X + 205, 208, 'rpg-wood-sword').setScale(0.55).setDepth(3).setVisible(false).setRotation(0.5);
    this.tweens.add({ targets: [this.heroBody, this.heroWeapon, this.armorBadge], y: '-=5', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 800, loop: true, callback: () => this.ambientSparkle() });
    this.statText = txt(this, X + 18, 290, '', 22, PAL.white, { lineSpacing: 4 });
    this.nameText = txt(this, X + 18, 372, '', 26, PAL.gold);
    this.blurbText = txt(this, X + 18, 406, '', 18, PAL.soft, { lineSpacing: 2 });
    this.msgText = txt(this, X + 18, 452, '', 18, '#ff9f9f');
    this.buyBtn = new Btn(this, X + 10, 472, 270, 56, '', () => this.act(), { size: 26 });
  }

  /** ประกายทองของเกราะผู้พิทักษ์ · ฟองน้ำของดาบวารี (เบา — ครั้งละไม่กี่ชิ้น) */
  private ambientSparkle(): void {
    const r = getProgress(this).rpg;
    if (r.armor === 'guardian-armor') sparkle(this, 795 + (Math.random() - 0.5) * 70, 200 + (Math.random() - 0.5) * 80, 0xffd84d, 2, 18, 6);
    if (r.weapon === 'water-sword') sparkle(this, 855 + (Math.random() - 0.5) * 30, 190 + Math.random() * 40, 0x7fd6ff, 2, 16, 6);
  }

  /* ---------------- การทำงาน ---------------- */

  select(it: ShopItem, animate: boolean): void {
    this.selected = it;
    const c = this.cards.get(it.id)!;
    this.cards.forEach((card, id) => {
      this.tweens.add({ targets: card, scale: id === it.id ? 1.07 : 1, duration: animate ? 140 : 1, ease: 'Back.easeOut' });
      card.setDepth(id === it.id ? 4 : 1);
    });
    this.selRing.clear().lineStyle(4, 0xffd84d, 1).strokeRoundedRect(c.x - CARD_W / 2 - 4, c.y - CARD_H / 2 - 4, CARD_W + 8, CARD_H + 8, 12);
    this.refresh();
  }

  private act(): void {
    const p = getProgress(this);
    const it = this.selected;
    const r = p.rpg;
    if (it.kind !== 'potion' && r.owned.includes(it.id)) {
      // มีแล้ว → สวมใส่
      if (r[it.kind] !== it.id) {
        r[it.kind] = it.id;
        p.saveRpg();
        sparkle(this, this.cards.get(it.id)!.x, this.cards.get(it.id)!.y, 0xffffff, 8, 40);
      }
      return this.refresh();
    }
    const res = p.buy(it.id);
    if (res === 'ok') {
      const c = this.cards.get(it.id)!;
      sparkle(this, c.x, c.y, it.id === 'water-sword' ? 0x7fd6ff : 0xffd84d, 14, 80, 8);
      this.tweens.add({ targets: c, scale: 1.18, duration: 110, yoyo: true });
      floatText(this, 520, 40, `−${it.price}`, '#ff9f9f', 28, 70);
      this.tweens.addCounter({
        from: this.shownCoins,
        to: r.coins,
        duration: 450,
        onUpdate: (t) => this.coinText.setText(String(Math.round(t.getValue() ?? 0))),
      });
      this.shownCoins = r.coins;
    } else if (res === 'poor') {
      this.cameras.main.shake(120, 0.003);
    }
    this.refresh();
  }

  /** วาดสถานะตามข้อมูลจริง: เหรียญ ค่าพลัง อุปกรณ์ที่สวม ปุ่มซื้อ */
  refresh(): void {
    const r = getProgress(this).rpg;
    this.coinText.setText(String(this.shownCoins));
    this.faithText.setText(`✨ ${r.faith}`);
    this.potionText.setText(`ยา ${r.potions}`);
    for (const it of SHOP_ITEMS) {
      const owned = it.kind !== 'potion' && r.owned.includes(it.id);
      const eq = it.kind !== 'potion' && r[it.kind] === it.id;
      this.marks.get(it.id)!.setText(eq ? '● สวมอยู่' : owned ? 'มีแล้ว' : '').setColor(eq ? '#ffd84d' : '#9be39b');
    }
    this.statText.setText(
      `โจมตี  ${PLAYER_BASE_ATTACK + attackBonus(r)}\nป้องกัน  ${defenseBonus(r)}\nHP  ${PLAYER_MAX_HP}`,
    );
    const it = this.selected;
    this.nameText.setText(it.name);
    this.blurbText.setText(wrapThaiText(BLURB[it.id] ?? '', 250, `18px ${FONT_FAMILY}`));
    // ปุ่ม: ซื้อ / สวมใส่ / สวมอยู่ / เหรียญไม่พอ
    const owned = it.kind !== 'potion' && r.owned.includes(it.id);
    const eq = it.kind !== 'potion' && r[it.kind] === it.id;
    this.msgText.setText('');
    if (eq) this.buyBtn.setText('สวมอยู่แล้ว').setEnabled(false);
    else if (owned) this.buyBtn.setText('สวมใส่').setFill(PAL.blue).setEnabled(true);
    else if (r.coins < it.price) {
      this.buyBtn.setText('เหรียญไม่พอ').setEnabled(false);
      this.msgText.setText(`ต้องใช้ ${it.price} (ขาดอีก ${it.price - r.coins})`);
    } else this.buyBtn.setText(`ซื้อ ${it.price} เหรียญ`).setFill(PAL.good).setEnabled(true);
    this.renderHero();
  }

  /** ตัวอย่างตัวละคร: เปลี่ยนเลเยอร์อาวุธ/เกราะตามที่สวมอยู่จริง */
  private renderHero(): void {
    const r = getProgress(this).rpg;
    const w = r.weapon;
    const a = r.armor;
    this.heroWeapon.setVisible(!!w);
    if (w) this.heroWeapon.setTexture(`rpg-${w}`).setScale(0.55 * (w === 'water-sword' ? 1.1 : 1));
    this.armorBadge.setVisible(!!a);
    if (a) this.armorBadge.setTexture(`rpg-${a}`);
    this.heroBody.setTint(a ? (ARMOR_TINT[a] ?? 0xffffff) : 0xffffff);
    this.weaponGlow.setFillStyle(0x5ec8ff, w === 'water-sword' ? 0.28 : 0);
    this.glowTween?.remove();
    this.glowTween = null;
    this.weaponGlow.setScale(1);
    if (w === 'water-sword') this.glowTween = this.tweens.add({ targets: this.weaponGlow, scale: 1.3, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });
  }

  /** ไปสู้พญาจระเข้ได้เสมอ (ไม่ต้องซื้ออะไร) */
  proceed(): void {
    getProgress(this).finishShop();
    goToStage(this, 'boss');
  }

  /** ข้อมูลสำหรับการทดสอบ */
  get view(): { coins: number; weapon: string | null; armor: string | null; atk: number; def: number; selected: string; potions: number } {
    const r = getProgress(this).rpg;
    return { coins: r.coins, weapon: r.weapon, armor: r.armor, atk: PLAYER_BASE_ATTACK + attackBonus(r), def: defenseBonus(r), selected: this.selected.id, potions: r.potions };
  }

  selectById(id: string): void {
    const it = item(id);
    if (it) this.select(it, true);
  }

  buySelected(): void {
    this.act();
  }
}
