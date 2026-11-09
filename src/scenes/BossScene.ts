import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import {
  commitVictory,
  PLAYER_MAX_HP,
  SKILLS,
  startBattle,
  takeTurn,
  type BattleAction,
  type BattleEvent,
  type BattleState,
} from '../core/rpg/Battle';
import { characterTextureKey } from '../graphics/PlaceholderTextures';
import { getProgress, goToStage, SCENE } from './navigation';
import { buildArena, BOSS_POINT, EYE, IMG_TOP, loadArena, PLAYER_POINT, type Arena } from './rpg/arena';
import { banner, Btn, floatText, PAL, panel, pauseWhenHidden, sparkle, txt } from './rpg/kit';

const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((res) => scene.time.delayedCall(ms, res));
const tween = (scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
  new Promise<void>((res) => scene.tweens.add({ ...cfg, onComplete: () => res() }));

type WeaponLook = 'none' | 'wood-sword' | 'iron-sword' | 'water-sword';

/**
 * ต่อสู้พญาจระเข้ผู้พิทักษ์ — เลือกคำสั่งทีละตา (โจมตี / สกิล / ใช้ยา) · ตรรกะอยู่ที่ core/rpg/Battle.ts
 * HUD: HP ผู้เล่น · HP พญาจระเข้ · ศรัทธา · ปุ่มคำสั่ง (ไม่มีอย่างอื่น)
 * แอนิเมชัน: ผู้เล่น idle/โจมตี/เจ็บ/สกิล/ฟื้น · พญาจระเข้ (ภาพเดียว) กระโจน/คลื่นน้ำ/สะดุ้ง/มลพิษจางเมื่อชนะ
 * เอฟเฟกต์อาวุธต่างกัน: ไม้ = เส้นฟันขาว-ส้มอ่อน · เหล็ก = ขอบเงินคมแรง · วารี = คลื่นฟ้า + หยดน้ำ
 * แพ้ = กลับมาลองใหม่ได้เสมอ (ทรัพยากรที่ใช้ในรอบนั้นคืนให้) ไม่ตัน
 */
export class BossScene extends Phaser.Scene {
  state!: BattleState;
  private arena!: Arena;
  private hero!: Phaser.GameObjects.Image;
  private weaponImg: Phaser.GameObjects.Image | null = null;
  private shield: Phaser.GameObjects.Ellipse | null = null;
  private busy = false;
  private heroHome = { x: PLAYER_POINT.x, y: PLAYER_POINT.y };
  private hpBar!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private faithText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private shownHp = 0;
  private shownBoss = 0;
  private menu: Btn[] = [];
  private skillMenu: Btn[] = [];
  private weapon: WeaponLook = 'none';
  private ended = false;

  constructor() {
    super(SCENE.boss);
  }

  preload(): void {
    loadArena(this);
    for (const id of ['wood-sword', 'iron-sword', 'water-sword']) if (!this.textures.exists(`rpg-${id}`)) this.load.image(`rpg-${id}`, `rpg/${id}.png`);
  }

  create(): void {
    this.ended = false;
    this.busy = false;
    this.menu = [];
    this.skillMenu = [];
    this.shield = null;
    const p = getProgress(this);
    this.state = startBattle(p.rpg, p.rpg.bossLosses);
    this.weapon = (p.rpg.weapon as WeaponLook | null) ?? 'none';
    this.shownHp = this.state.hp;
    this.shownBoss = this.state.bossHp;

    this.arena = buildArena(this);
    // แท่นหินใต้เท้าผู้เล่น
    this.add.ellipse(this.heroHome.x, this.heroHome.y + 38, 170, 34, 0x2b3a33, 0.95).setDepth(3);
    this.hero = this.add.image(this.heroHome.x, this.heroHome.y, characterTextureKey('student'), 'side-0').setScale(7).setDepth(5);
    if (this.weapon !== 'none') {
      this.weaponImg = this.add.image(this.heroHome.x + 56, this.heroHome.y + 6, `rpg-${this.weapon}`).setScale(0.55).setDepth(6).setRotation(0.6);
      if (this.weapon === 'water-sword') {
        const glow = this.add.ellipse(this.heroHome.x + 56, this.heroHome.y + 6, 80, 80, 0x5ec8ff, 0.22).setDepth(5);
        this.tweens.add({ targets: glow, alpha: 0.4, scale: 1.2, duration: 800, yoyo: true, repeat: -1 });
      }
    }
    this.idle();
    this.arena.aura.setAlpha(0.3 * (this.state.bossHp / this.state.bossMaxHp) + 0.05);

    this.buildHud();
    this.buildMenu();
    pauseWhenHidden(this);
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'KeyA' || ev.code === 'Digit1') this.command('attack');
      else if (ev.code === 'KeyS' || ev.code === 'Digit2') this.openSkills(true);
      else if (ev.code === 'KeyD' || ev.code === 'Digit3') this.command('potion');
    });
    (window as unknown as { __BOSS__?: BossScene }).__BOSS__ = this;
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.say('เลือกคำสั่งของเจ้า');
  }

  private idle(): void {
    const targets = [this.hero, ...(this.weaponImg ? [this.weaponImg] : [])];
    this.tweens.add({ targets, y: '-=4', duration: 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /* ---------------- HUD / เมนู ---------------- */

  private buildHud(): void {
    panel(this, 12, 10, 330, 86, 0.82);
    txt(this, 24, 14, 'ผู้นำชุมชน', 18, PAL.gold);
    this.hpBar = this.add.graphics();
    this.hpText = txt(this, 30, 40, '', 16).setDepth(2);
    this.faithText = txt(this, 24, 66, '', 18, '#bfe3ff');
    panel(this, GAME_WIDTH - 372, 10, 360, 70, 0.82);
    txt(this, GAME_WIDTH - 360, 12, 'พญาจระเข้ผู้พิทักษ์ (พลังมลพิษ)', 17, PAL.gold);
    this.bossBar = this.add.graphics();
    this.bossText = txt(this, GAME_WIDTH - 192, 52, '', 16).setOrigin(0.5, 0.5).setDepth(2);
    this.log = txt(this, GAME_WIDTH / 2, 468, '', 24, PAL.white).setOrigin(0.5, 0.5).setDepth(10);
    this.redrawBars();
  }

  private redrawBars(): void {
    const s = this.state;
    this.hpBar.clear();
    const bar = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, color: number) => {
      g.fillStyle(0x1a1010, 1).fillRect(x, y, w, h);
      g.fillStyle(color, 1).fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.max(0, Math.min(1, ratio))), h - 4);
      g.lineStyle(2, 0xffffff, 0.6).strokeRect(x, y, w, h);
    };
    bar(this.hpBar, 24, 38, 306, 22, this.shownHp / PLAYER_MAX_HP, 0xd23b3b);
    this.hpText.setText(`HP ${Math.round(this.shownHp)} / ${PLAYER_MAX_HP}`);
    this.faithText.setText(`ศรัทธา ${s.faith}`);
    this.bossBar.clear();
    bar(this.bossBar, GAME_WIDTH - 360, 34, 336, 24, this.shownBoss / s.bossMaxHp, 0x9b3bd2);
    this.bossText.setText(`HP ${Math.round(this.shownBoss)} / ${s.bossMaxHp}`);
  }

  /** ปรับแถบ HP แบบไหลลง */
  private tweenBars(): void {
    const from = { hp: this.shownHp, boss: this.shownBoss };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 420,
      onUpdate: (t) => {
        const k = t.getValue() ?? 0;
        this.shownHp = from.hp + (this.state.hp - from.hp) * k;
        this.shownBoss = from.boss + (this.state.bossHp - from.boss) * k;
        this.redrawBars();
      },
    });
  }

  private say(s: string, color: string = PAL.white): void {
    this.log.setText(s).setColor(color);
  }

  private buildMenu(): void {
    const y = 506;
    const w = 296;
    const h = 100;
    this.menu = [
      new Btn(this, 14, y, w, h, 'โจมตี', () => this.command('attack'), { fill: 0x2a64c8, size: 36 }),
      new Btn(this, 14 + w + 8, y, w, h, 'สกิล', () => this.openSkills(true), { fill: 0x7b3fb5, size: 36 }),
      new Btn(this, 14 + 2 * (w + 8), y, w, h, `ใช้ยา ×${this.state.potions}`, () => this.command('potion'), { fill: 0x2f9e44, size: 36 }),
    ];
    const sw = 232;
    const defs: Array<{ a: BattleAction; name: string; cost: number }> = [
      { a: 'skill-slash', name: SKILLS['skill-slash'].name, cost: SKILLS['skill-slash'].cost },
      { a: 'skill-shield', name: SKILLS['skill-shield'].name, cost: SKILLS['skill-shield'].cost },
      { a: 'skill-purify', name: SKILLS['skill-purify'].name, cost: SKILLS['skill-purify'].cost },
    ];
    this.skillMenu = defs.map(
      (d, i) => new Btn(this, 14 + i * (sw + 8), y, sw, h, `${d.name}\nใช้ ${d.cost} ศรัทธา`, () => this.command(d.a), { fill: 0x5a3190, size: 22 }),
    );
    this.skillMenu.push(new Btn(this, 14 + 3 * (sw + 8), y, 936 - (14 + 3 * (sw + 8)), h, '← กลับ', () => this.openSkills(false), { fill: 0x4a4f59, size: 26 }));
    this.skillMenu.forEach((b) => b.setVisible(false));
    this.refreshMenu();
  }

  private refreshMenu(): void {
    this.menu[2].setText(`ใช้ยา ×${this.state.potions}`).setEnabled(this.state.potions > 0 && !this.busy);
    this.menu[0].setEnabled(!this.busy);
    this.menu[1].setEnabled(!this.busy);
    // ศรัทธาไม่พอ = ปุ่มสกิลเป็นสีเทา (ใช้ไม่ได้ แต่ไม่ถูกลงโทษ)
    const costs = [SKILLS['skill-slash'].cost, SKILLS['skill-shield'].cost, SKILLS['skill-purify'].cost];
    this.skillMenu.slice(0, 3).forEach((b, i) => b.setEnabled(!this.busy && this.state.faith >= costs[i]));
    this.skillMenu[3].setEnabled(!this.busy);
  }

  openSkills(open: boolean): void {
    if (this.busy && open) return;
    this.menu.forEach((b) => b.setVisible(!open));
    this.skillMenu.forEach((b) => b.setVisible(open));
    this.say(open ? 'เลือกสกิล (ใช้พลังศรัทธา)' : 'เลือกคำสั่งของเจ้า');
    this.refreshMenu();
  }

  /* ---------------- ตาเล่น ---------------- */

  /** สั่งหนึ่งคำสั่ง: ตรรกะใน core · แอนิเมชันเล่นตามเหตุการณ์ทีละอัน */
  async command(action: BattleAction): Promise<void> {
    if (this.busy || this.ended || this.state.over) return;
    const events = takeTurn(this.state, action);
    if (events[0]?.kind === 'denied') {
      this.say(action === 'potion' ? 'ไม่มียารักษา' : 'พลังศรัทธาไม่พอ', '#ff9f9f');
      this.tweens.add({ targets: this.faithText, x: '+=8', duration: 50, yoyo: true, repeat: 3 });
      return;
    }
    this.busy = true;
    this.openSkills(false);
    this.refreshMenu();
    for (const e of events) await this.play(e);
    this.tweenBars();
    this.faithText.setText(`ศรัทธา ${this.state.faith}`);
    this.arenaAura();
    await wait(this, 520);
    this.busy = false;
    this.refreshMenu();
    if (this.state.over === 'won') await this.victory();
    else if (this.state.over === 'lost') await this.defeat();
    else this.say('เลือกคำสั่งของเจ้า');
  }

  private arenaAura(): void {
    this.tweens.add({ targets: this.arena.aura, alpha: 0.05 + 0.28 * (this.state.bossHp / this.state.bossMaxHp), duration: 500 });
  }

  private async play(e: BattleEvent): Promise<void> {
    switch (e.kind) {
      case 'player-heal':
        await this.healFx(e.amount);
        break;
      case 'player-shield':
        await this.shieldFx();
        break;
      case 'player-attack':
        if (e.action === 'skill-slash') await this.slashSkillFx();
        else if (e.action === 'skill-purify') await this.purifyFx();
        else await this.weaponAttackFx();
        await this.hitBossFx(e.amount, e.action === 'skill-purify' ? 0xffe9a0 : 0xffffff);
        break;
      case 'blocked':
        this.pendingBlock = true;
        break;
      case 'boss-attack':
        await this.bossAttackFx(e.amount, false);
        break;
      case 'boss-wave':
        await this.bossAttackFx(e.amount, true);
        break;
      default:
        break;
    }
  }

  private pendingBlock = false;

  /* ---------------- ผู้เล่น ---------------- */

  private lunge(dx: number, ms: number): Promise<void> {
    const targets = [this.hero, ...(this.weaponImg ? [this.weaponImg] : [])];
    return tween(this, { targets, x: `+=${dx}`, duration: ms, ease: 'Cubic.easeOut', yoyo: true });
  }

  /** โจมตีด้วยอาวุธที่สวมอยู่ — เอฟเฟกต์ต่างกันตามอาวุธ (ระบบเดียวกัน ต่างแค่ค่าและเอฟเฟกต์) */
  private async weaponAttackFx(): Promise<void> {
    this.say('โจมตี!');
    if (this.weaponImg) this.tweens.add({ targets: this.weaponImg, rotation: { from: -0.8, to: 1.5 }, duration: 220 });
    await this.lunge(90, 200);
    this.slashArc(this.weapon);
    await wait(this, 120);
  }

  private slashArc(look: WeaponLook): void {
    const cx = BOSS_POINT.x - 110;
    const cy = BOSS_POINT.y + 20;
    const g = this.add.graphics({ x: cx, y: cy }).setDepth(30);
    const arc = (r: number, w: number, color: number, a0 = -1.3, a1 = 1.1) => g.lineStyle(w, color, 1).beginPath().arc(0, 0, r, a0, a1).strokePath();
    if (look === 'water-sword') {
      arc(120, 20, 0x2f86d6);
      arc(110, 12, 0x7fd6ff);
      arc(100, 5, 0xe6faff);
      for (let i = 0; i < 8; i++) {
        const d = this.add.circle(cx + 60 + Math.random() * 80, cy - 80 + Math.random() * 100, 5 + Math.random() * 4, 0x9fe3ff, 0.9).setDepth(30);
        this.tweens.add({ targets: d, y: d.y + 60, x: d.x + (Math.random() - 0.5) * 50, alpha: 0, duration: 650, onComplete: () => d.destroy() });
      }
    } else if (look === 'iron-sword') {
      arc(120, 18, 0x8c98a6);
      arc(116, 9, 0xe9eef4);
      arc(112, 3, 0xffffff);
      sparkle(this, cx + 100, cy, 0xe9eef4, 6, 50, 31);
    } else if (look === 'wood-sword') {
      arc(115, 12, 0xffb066);
      arc(112, 6, 0xfff1d6);
    } else {
      arc(90, 8, 0xffffff);
    }
    g.setScale(0.7);
    this.tweens.add({ targets: g, scale: 1.15, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  /** สกิล 1: คมดาบบารมี — คลื่นฟันสีทองพุ่งจากผู้เล่นไปหาพญาจระเข้ */
  private async slashSkillFx(): Promise<void> {
    this.say(SKILLS['skill-slash'].name + '!', PAL.gold);
    this.tweens.add({ targets: this.hero, tint: 0xffe28a, duration: 120, yoyo: true });
    await this.lunge(60, 160);
    const g = this.add.graphics({ x: this.heroHome.x + 60, y: this.heroHome.y - 10 }).setDepth(30);
    g.lineStyle(26, 0xd89b00, 1).beginPath().arc(0, 0, 90, -1.2, 1.2).strokePath();
    g.lineStyle(14, 0xffd84d, 1).beginPath().arc(0, 0, 86, -1.2, 1.2).strokePath();
    g.lineStyle(5, 0xfff7c9, 1).beginPath().arc(0, 0, 82, -1.2, 1.2).strokePath();
    await tween(this, { targets: g, x: BOSS_POINT.x - 80, y: BOSS_POINT.y, scale: 1.5, alpha: 0.2, duration: 380, ease: 'Cubic.easeIn' });
    g.destroy();
  }

  /** สกิล 2: โล่วารีพิทักษ์ — โล่น้ำสีฟ้ารอบตัว ลดความเสียหายของการโจมตีครั้งถัดไป */
  private async shieldFx(): Promise<void> {
    this.say(SKILLS['skill-shield'].name + '!', '#9fe3ff');
    this.shield?.destroy();
    const s = this.add.ellipse(this.heroHome.x, this.heroHome.y, 40, 40, 0x5ec8ff, 0.28).setDepth(7).setStrokeStyle(4, 0xbff0ff, 0.9);
    this.shield = s;
    await tween(this, { targets: s, displayWidth: 190, displayHeight: 210, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: s, alpha: { from: 0.28, to: 0.5 }, duration: 600, yoyo: true, repeat: -1 });
    floatText(this, this.heroHome.x, this.heroHome.y - 110, 'ลดความเสียหาย', '#9fe3ff', 24);
  }

  /** สกิล 3: แสงศรัทธาชำระคำสาป — ทอง+ฟ้ารวมตัวแล้วยิงลำแสงใส่พญาจระเข้ */
  private async purifyFx(): Promise<void> {
    this.say(SKILLS['skill-purify'].name + '!', PAL.gold);
    const fx = { x: this.heroHome.x + 90, y: this.heroHome.y - 40 };
    const orbs: Promise<void>[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      const o = this.add.circle(fx.x + Math.cos(a) * 130, fx.y + Math.sin(a) * 130, 7, i % 2 ? 0xffd84d : 0x6fd0ff, 0.95).setDepth(30);
      orbs.push(tween(this, { targets: o, x: fx.x, y: fx.y, scale: 0.4, duration: 520, ease: 'Cubic.easeIn', onComplete: () => o.destroy() }));
    }
    await Promise.all(orbs);
    const core = this.add.circle(fx.x, fx.y, 30, 0xfff3a8, 1).setDepth(31);
    this.tweens.add({ targets: core, scale: 1.8, duration: 160, yoyo: true });
    // ลำแสง
    const beam = this.add.graphics().setDepth(30);
    const to = { x: BOSS_POINT.x - 70, y: BOSS_POINT.y };
    beam.lineStyle(34, 0x6fd0ff, 0.7).lineBetween(fx.x, fx.y, to.x, to.y);
    beam.lineStyle(20, 0xffd84d, 0.95).lineBetween(fx.x, fx.y, to.x, to.y);
    beam.lineStyle(8, 0xffffff, 1).lineBetween(fx.x, fx.y, to.x, to.y);
    this.cameras.main.flash(180, 255, 240, 180);
    await tween(this, { targets: [beam, core], alpha: 0, duration: 420, delay: 140 });
    beam.destroy();
    core.destroy();
  }

  private async healFx(amount: number): Promise<void> {
    this.say('ใช้ยารักษา', '#9be39b');
    this.tweens.add({ targets: this.hero, tint: 0x8bff9b, duration: 150, yoyo: true, repeat: 1 });
    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(this.heroHome.x + (Math.random() - 0.5) * 80, this.heroHome.y + 30, 8, 8, 0x7dff8a, 0.9).setDepth(30);
      this.tweens.add({ targets: p, y: p.y - 90, alpha: 0, duration: 700, delay: i * 60, onComplete: () => p.destroy() });
    }
    floatText(this, this.heroHome.x, this.heroHome.y - 90, `+${amount} HP`, '#7dff8a', 34);
    await wait(this, 600);
  }

  /* ---------------- พญาจระเข้ ---------------- */

  /** พญาจระเข้ถูกโจมตี: ภาพสั่น · วาบขาว · ตัวเลขความเสียหาย (ไม่บังจอ) */
  private async hitBossFx(dmg: number, flash: number): Promise<void> {
    const img = this.arena.img;
    const baseX = img.x;
    this.tweens.add({ targets: img, x: baseX + 10, duration: 40, yoyo: true, repeat: 4, onComplete: () => img.setX(baseX) });
    const f = this.add.rectangle(GAME_WIDTH / 2 + 130, IMG_TOP + 225, 640, 300, flash, 0.45).setDepth(25);
    this.tweens.add({ targets: f, alpha: 0, duration: 280, onComplete: () => f.destroy() });
    this.tweens.add({ targets: [this.arena.eye, this.arena.eyeGlow], scale: 1.8, duration: 100, yoyo: true });
    floatText(this, BOSS_POINT.x, BOSS_POINT.y - 60, `−${dmg}`, '#ffd84d', 44, 60);
    await wait(this, 360);
  }

  /** พญาจระเข้โจมตี: กระโจนเข้า (ซูมภาพ) · ตีธรรมดา หรือ คลื่นน้ำพุ่งไปหาผู้เล่น · ผู้เล่นกะพริบ · HP ลด */
  private async bossAttackFx(dmg: number, wave: boolean): Promise<void> {
    const img = this.arena.img;
    this.say(wave ? 'พญาจระเข้ปล่อยคลื่นน้ำ!' : 'พญาจระเข้โจมตี!', '#ffb3b3');
    this.arena.aura.setAlpha(0.45);
    await tween(this, { targets: img, x: img.x - 22, scale: img.scaleX * 1.04, duration: 220, ease: 'Cubic.easeOut', yoyo: true });
    if (wave) {
      const g = this.add.graphics({ x: EYE.x - 20, y: EYE.y + 90 }).setDepth(30);
      g.lineStyle(22, 0x3b6fd0, 0.95).beginPath().arc(0, 0, 70, 1.9, 4.4).strokePath();
      g.lineStyle(10, 0x9fe3ff, 0.95).beginPath().arc(0, 0, 66, 1.9, 4.4).strokePath();
      await tween(this, { targets: g, x: this.heroHome.x + 60, y: this.heroHome.y, scale: 1.6, duration: 420, ease: 'Cubic.easeIn' });
      g.destroy();
    } else {
      this.cameras.main.shake(140, 0.004);
    }
    // ผู้เล่นถูกโจมตี
    if (this.pendingBlock && this.shield) {
      this.pendingBlock = false;
      sparkle(this, this.heroHome.x, this.heroHome.y, 0x9fe3ff, 10, 70, 31);
      const sh = this.shield;
      this.shield = null;
      await tween(this, { targets: sh, alpha: 0, scale: 1.4, duration: 260 });
      sh.destroy();
      floatText(this, this.heroHome.x, this.heroHome.y - 100, 'ป้องกัน!', '#9fe3ff', 28);
    } else this.shield?.destroy();
    this.tweens.add({ targets: this.hero, alpha: 0.25, duration: 70, yoyo: true, repeat: 3, onComplete: () => this.hero.setAlpha(1) });
    this.tweens.add({ targets: this.hero, tint: 0xff6a6a, duration: 120, yoyo: true, repeat: 1, onComplete: () => this.hero.clearTint() });
    this.tweens.add({ targets: this.hero, x: this.heroHome.x - 14, duration: 90, yoyo: true });
    floatText(this, this.heroHome.x, this.heroHome.y - 70, `−${dmg}`, '#ff6b6b', 40, 60);
    this.shownHp = Math.max(this.state.hp, this.shownHp - 0);
    await wait(this, 420);
  }

  /* ---------------- จบ ---------------- */

  private async victory(): Promise<void> {
    this.ended = true;
    const p = getProgress(this);
    commitVictory(p.rpg, this.state);
    p.finishBoss();
    this.say('');
    this.menu.forEach((b) => b.setVisible(false));
    this.skillMenu.forEach((b) => b.setVisible(false));
    // มลพิษจาง ตากลับเป็นสงบ
    this.tweens.killTweensOf(this.arena.aura);
    this.tweens.killTweensOf([this.arena.eye, this.arena.eyeGlow]);
    this.cameras.main.flash(420, 255, 240, 190);
    this.tweens.add({ targets: this.arena.aura, alpha: 0, duration: 1400 });
    this.arena.eye.setFillStyle(0xffe9a0).setAlpha(1).setScale(1);
    this.arena.eyeGlow.setFillStyle(0xfff3c0).setAlpha(0.35);
    for (let i = 0; i < 4; i++) sparkle(this, BOSS_POINT.x + (Math.random() - 0.5) * 300, BOSS_POINT.y + (Math.random() - 0.5) * 120, 0xffe9a0, 8, 80, 40);
    banner(this, 'ชำระมลพิษสำเร็จ!', 540, 44);
    await wait(this, 2600);
    this.scene.start(SCENE.ending);
  }

  private async defeat(): Promise<void> {
    this.ended = true;
    getProgress(this).bossLost();
    this.hero.setAlpha(0.6).setTint(0x888888);
    this.menu.forEach((b) => b.setVisible(false));
    this.skillMenu.forEach((b) => b.setVisible(false));
    this.say('');
    const box = this.add.container(GAME_WIDTH / 2, 480).setDepth(70);
    const bg = panel(this, -340, -80, 680, 150, 0.95);
    const t = txt(this, 0, -50, 'เจ้าล้มลงแล้ว... แต่ยังไม่จบ!', 32, '#ffb3b3').setOrigin(0.5);
    const t2 = txt(this, 0, -10, 'ยาและศรัทธาที่ใช้ในรอบนี้คืนให้ · พญาจระเข้อ่อนแรงลงเล็กน้อย', 20, PAL.soft).setOrigin(0.5);
    box.add([bg, t, t2]);
    new Btn(this, 70, 520, 380, 80, 'ลองอีกครั้ง', () => this.scene.restart(), { fill: PAL.good, size: 32 }).setDepth(80);
    new Btn(this, 510, 520, 380, 80, 'กลับร้านค้า', () => goToStage(this, 'shop'), { fill: PAL.blue, size: 32 }).setDepth(80);
  }

  /** ข้อมูลสำหรับการทดสอบ */
  get view(): { hp: number; bossHp: number; faith: number; potions: number; over: BattleState['over']; busy: boolean } {
    const s = this.state;
    return { hp: s.hp, bossHp: s.bossHp, faith: s.faith, potions: s.potions, over: s.over, busy: this.busy };
  }
}

void GAME_HEIGHT;
