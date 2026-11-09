import Phaser from 'phaser';
import { CHAPTERS, INTRO_SCENES } from '../content/story/chapters';
import { FONT_FAMILY } from '../ui/theme';
import { beginChapter, SCENE } from './navigation';

/** เวลาขั้นต่ำก่อนแตะไปฉากถัดไปได้ (กันแตะรัวจนข้ามเรื่อง) */
const MIN_SCENE_MS = 500;
/** ช่วงห่างระหว่างประโยค (มิลลิวินาที) */
const SENTENCE_MS = 2300;

const CSS = `
.in-root{position:fixed;inset:0;z-index:60;background:#05070d;color:#fff;font-family:${FONT_FAMILY};overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;cursor:pointer}
.in-scene{position:absolute;inset:0;display:none}
.in-scene.on{display:block}
.in-bd{position:absolute;inset:-4%;background-size:cover;background-position:center;filter:blur(18px) brightness(.45);transform:scale(1.1)}
.in-pic{position:absolute;top:50%;left:50%;height:min(100%,calc(100vw*1.679));aspect-ratio:536/900;transform:translate(-50%,-50%);overflow:hidden;box-shadow:0 0 40px #000a}
.in-img{position:absolute;inset:-3%;background-size:cover;background-position:center}
.in-fx{position:absolute;pointer-events:none}
.in-txt{position:absolute;left:0;right:0;bottom:0;padding:5vmin 6vmin 7vmin;background:linear-gradient(transparent,#05070dcc 28%,#05070df2);text-align:center}
.in-step{font-size:clamp(13px,2.2vmin,18px);color:#ffd84d;margin-bottom:1.2vmin}
.in-s{font-size:clamp(19px,4.2vmin,34px);line-height:1.55;opacity:0;transform:translateY(8px);transition:opacity .9s,transform .9s;text-shadow:0 2px 6px #000}
.in-s.show{opacity:1;transform:none}
.in-hint{margin-top:2vmin;font-size:clamp(14px,2.4vmin,19px);color:#c9d6ea;opacity:0;transition:opacity .6s}
.in-hint.show{opacity:.9;animation:in-blink 1.4s ease-in-out infinite}
.in-go{display:none;margin:2.4vmin auto 0;padding:1.6vmin 4vmin;min-height:56px;font:inherit;font-size:clamp(20px,4vmin,30px);color:#2b2118;background:#ffd84d;border:0;border-radius:14px;box-shadow:0 5px 0 #b8860b;cursor:pointer}
.in-go.show{display:block;animation:in-pop .5s}
.in-skip{position:absolute;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:5;padding:10px 16px;min-height:44px;font:inherit;font-size:clamp(15px,2.6vmin,20px);color:#f3ead2;background:#000a;border:2px solid #f3ead288;border-radius:12px;cursor:pointer}
.in-dots{position:absolute;top:max(14px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:5}
.in-dot{width:10px;height:10px;border-radius:50%;background:#fff5}
.in-dot.on{background:#ffd84d}
@media (min-aspect-ratio:1/1){
  .in-pic{left:34%}
  .in-txt{left:auto;right:0;top:0;width:52%;bottom:0;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(90deg,transparent,#05070dd0 18%,#05070df0);padding:6vmin 6vmin 6vmin 10vmin;text-align:left}
  .in-go{margin-left:0}
}
/* ฉาก 1: น้ำตก/ลำธารไหล · ใบไม้โบก · แสงแดด */
.fx-fall{left:46%;top:25%;width:28%;height:19%;background:repeating-linear-gradient(180deg,#fff0 0 7px,#ffffff66 7px 12px);mix-blend-mode:screen;animation:in-fall 1.1s linear infinite;filter:blur(1px)}
.fx-stream{left:36%;top:66%;width:64%;height:32%;background:repeating-linear-gradient(115deg,#fff0 0 14px,#ffffff40 14px 20px);mix-blend-mode:screen;animation:in-flow 2.6s linear infinite;clip-path:polygon(40% 0,100% 0,100% 100%,0 100%)}
.fx-rays{left:-10%;top:-14%;width:80%;height:60%;background:conic-gradient(from 100deg at 30% 20%,#fff0 0deg,#fff3b088 12deg,#fff0 24deg,#fff3b066 40deg,#fff0 56deg);mix-blend-mode:screen;animation:in-rays 5s ease-in-out infinite alternate}
.fx-leaf{width:2.4%;height:1.4%;background:#8fd24d;border-radius:0 100% 0 100%;transform-origin:50% 0;animation:in-sway 3.4s ease-in-out infinite alternate}
/* ฉาก 2: ควันดำ น้ำเสียไหล ฟ้าแลบ ตาแดง สั่นตอนคำราม */
.fx-smoke{width:14%;height:9%;border-radius:50%;background:#0d0d10;filter:blur(8px);opacity:0;animation:in-smoke 5s ease-out infinite}
.fx-sewage{left:30%;top:74%;width:70%;height:24%;background:linear-gradient(100deg,#ff3df0aa,#3dd7ffaa,#a6ff3daa,#ff3df0aa);background-size:300% 100%;mix-blend-mode:overlay;animation:in-sewage 5s linear infinite;clip-path:polygon(30% 0,100% 0,100% 100%,0 100%)}
.fx-flash{inset:0;background:#fff;opacity:0;mix-blend-mode:screen;animation:in-flash 7s linear infinite}
.fx-eye{left:66%;top:22%;width:3.4%;height:2%;border-radius:50%;background:#ff3030;box-shadow:0 0 14px 6px #ff2020cc;animation:in-eye 1.2s ease-in-out infinite alternate}
.shake .in-pic,.in-pic.shake{animation:in-shake 7s linear infinite}
/* ฉาก 3: แสงอาวุธ ประกายศรัทธา น้ำกระเซ็น ตัวละครขยับเล็กน้อย */
.fx-glow{left:42%;top:51%;width:24%;height:14%;border-radius:50%;background:radial-gradient(#fff6b8,#ffd84d88 40%,#ffd84d00 70%);mix-blend-mode:screen;animation:in-glow 1.6s ease-in-out infinite alternate}
.fx-spark{width:1.4%;height:.9%;background:#fff3a8;transform:rotate(45deg);box-shadow:0 0 8px #ffd84d;opacity:0;animation:in-spark 3s ease-in infinite}
.fx-drop{width:1.4%;height:1.1%;border-radius:50%;background:#bff0ffcc;opacity:0;animation:in-drop 1.8s ease-out infinite}
.hero-bob{animation:in-bob 3s ease-in-out infinite alternate}
.kb1{animation:in-kb 16s ease-in-out infinite alternate}
.kb2{animation:in-kb2 16s ease-in-out infinite alternate}
.in-paused *{animation-play-state:paused !important}
@keyframes in-kb{from{transform:scale(1.02) translate(0,0)}to{transform:scale(1.09) translate(-1.5%,-1.2%)}}
@keyframes in-kb2{from{transform:scale(1.1) translate(1%,0)}to{transform:scale(1.02) translate(-1%,1%)}}
@keyframes in-fall{from{background-position:0 0}to{background-position:0 12px}}
@keyframes in-flow{from{background-position:0 0}to{background-position:-40px 0}}
@keyframes in-rays{from{opacity:.35}to{opacity:.85}}
@keyframes in-sway{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
@keyframes in-smoke{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:.55}100%{opacity:0;transform:translate(8%,-260%) scale(1.8)}}
@keyframes in-sewage{from{background-position:0 0}to{background-position:300% 0}}
@keyframes in-flash{0%,84%,88%,100%{opacity:0}85%{opacity:.55}86%{opacity:.1}87%{opacity:.4}}
@keyframes in-eye{from{opacity:.55;transform:scale(.8)}to{opacity:1;transform:scale(1.25)}}
@keyframes in-shake{0%,70%,100%{transform:translate(-50%,-50%)}72%{transform:translate(calc(-50% + 5px),calc(-50% - 3px))}74%{transform:translate(calc(-50% - 5px),calc(-50% + 3px))}76%{transform:translate(calc(-50% + 3px),-50%)}78%{transform:translate(-50%,-50%)}}
@keyframes in-glow{from{opacity:.55;transform:scale(.92)}to{opacity:1;transform:scale(1.12)}}
@keyframes in-spark{0%{opacity:0;transform:translateY(0) rotate(45deg) scale(.5)}25%{opacity:1}100%{opacity:0;transform:translateY(-1100%) rotate(45deg) scale(1.2)}}
@keyframes in-drop{0%{opacity:0;transform:translateY(0)}20%{opacity:1}100%{opacity:0;transform:translate(60%,-700%)}}
@keyframes in-bob{from{transform:translateY(0) scale(1.03)}to{transform:translateY(-1.2%) scale(1.06)}}
@keyframes in-blink{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes in-pop{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.fx-flash,.shake .in-pic{animation:none!important}.kb1,.kb2,.hero-bob{animation:none!important}}
`;

const IMG_CLASS = ['kb1', 'kb2', 'hero-bob'];

/** วัตถุเอฟเฟกต์ซ้ำ ๆ (ใบไม้ ควัน ประกาย หยดน้ำ) — จำนวนน้อยพอให้ลื่นบนโทรศัพท์ */
function repeat(n: number, make: (i: number) => string): string {
  return Array.from({ length: n }, (_, i) => make(i)).join('');
}

const FX: Array<() => string> = [
  () =>
    '<div class="in-fx fx-rays"></div><div class="in-fx fx-fall"></div><div class="in-fx fx-stream"></div>' +
    repeat(6, (i) => `<div class="in-fx fx-leaf" style="left:${6 + i * 6}%;top:${12 + (i % 3) * 4}%;animation-delay:-${i * 0.6}s"></div>`),
  () =>
    '<div class="in-fx fx-sewage"></div>' +
    repeat(3, (i) => `<div class="in-fx fx-smoke" style="left:${72 + i * 6}%;top:${49 - i}%;animation-delay:-${i * 1.6}s"></div>`) +
    '<div class="in-fx fx-eye"></div><div class="in-fx fx-flash"></div>',
  () =>
    '<div class="in-fx fx-glow"></div>' +
    repeat(10, (i) => `<div class="in-fx fx-spark" style="left:${30 + ((i * 17) % 45)}%;top:${58 + ((i * 7) % 18)}%;animation-delay:-${(i * 0.37).toFixed(2)}s"></div>`) +
    repeat(6, (i) => `<div class="in-fx fx-drop" style="left:${58 + i * 6}%;top:${80 + (i % 2) * 6}%;animation-delay:-${(i * 0.3).toFixed(2)}s"></div>`),
];

/**
 * Intro ตำนานพญาจระเข้ผู้พิทักษ์คลองลาน (3 ฉาก) — แสดงเมื่อเริ่มเกมใหม่ แล้วเข้า Golden Time → บทที่ 1
 * เป็น DOM + CSS เต็มจอ ใช้ได้ทั้งแนวตั้งและแนวนอน (แนวนอน: ภาพซ้าย ข้อความขวา · แนวตั้ง: ข้อความทับด้านล่างภาพ)
 * ภาพ 3 ใบเป็นภาพนิ่ง → ขยับด้วย pan/zoom + เลเยอร์เอฟเฟกต์ CSS วางตามตำแหน่งในภาพ (เปอร์เซ็นต์) — ไม่แยกชิ้นส่วนภาพ ไม่ใช้วิดีโอ
 * แตะ/Space/Enter = ข้อความถัดไป (แตะขณะข้อความยังขึ้นไม่ครบ = แสดงครบก่อน) · "ข้าม" หรือ Esc = เข้าเกมทันที
 * หยุดแอนิเมชันเมื่อแท็บถูกซ่อน · เคารพ prefers-reduced-motion
 */
export class IntroScene extends Phaser.Scene {
  index = 0;
  private shownAt = 0;
  private root: HTMLElement | null = null;
  private timers: number[] = [];
  private allShown = false;
  private onKey = (ev: KeyboardEvent) => {
    if (ev.code === 'Space' || ev.code === 'Enter') this.next();
    else if (ev.code === 'Escape') this.finish();
  };
  private onVis = () => this.root?.classList.toggle('in-paused', document.hidden);

  constructor() {
    super(SCENE.intro);
  }

  create(): void {
    this.index = 0;
    this.build();
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVis);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    (window as unknown as { __INTRO__?: IntroScene }).__INTRO__ = this;
    this.show(0);
  }

  private build(): void {
    const root = document.createElement('div');
    root.className = 'in-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'ตำนานพญาจระเข้ผู้พิทักษ์คลองลาน');
    const scenes = INTRO_SCENES.map((s, i) => {
      const last = i === INTRO_SCENES.length - 1;
      return (
        `<section class="in-scene" data-i="${i}">` +
        `<div class="in-bd" style="background-image:url('${s.image}')"></div>` +
        `<div class="in-pic ${i === 1 ? 'shake' : ''}"><div class="in-img ${IMG_CLASS[i]}" style="background-image:url('${s.image}')"></div>${FX[i]()}</div>` +
        `<div class="in-txt"><div class="in-step">${s.title} · ${i + 1}/${INTRO_SCENES.length}</div>` +
        s.sentences.map((t) => `<div class="in-s">${t}</div>`).join('') +
        `<div class="in-hint">แตะเพื่อไปต่อ ▼</div>` +
        (last ? '<button class="in-go" type="button">เริ่มการผจญภัย</button>' : '') +
        '</div></section>'
      );
    }).join('');
    root.innerHTML =
      `<style>${CSS}</style>${scenes}` +
      `<div class="in-dots">${INTRO_SCENES.map(() => '<span class="in-dot"></span>').join('')}</div>` +
      '<button class="in-skip" type="button" data-skip>ข้าม ▶▶</button>';
    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-skip]')) this.finish();
      else if (t.closest('.in-go')) this.finish();
      else this.next();
    });
    document.body.appendChild(root);
    this.root = root;
  }

  private show(i: number): void {
    this.index = i;
    this.shownAt = performance.now();
    this.allShown = false;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    const root = this.root!;
    root.querySelectorAll<HTMLElement>('.in-scene').forEach((el, k) => el.classList.toggle('on', k === i));
    root.querySelectorAll<HTMLElement>('.in-dot').forEach((el, k) => el.classList.toggle('on', k === i));
    const sec = root.querySelector<HTMLElement>(`.in-scene[data-i="${i}"]`)!;
    const lines = Array.from(sec.querySelectorAll<HTMLElement>('.in-s'));
    lines.forEach((l) => l.classList.remove('show'));
    sec.querySelector('.in-hint')?.classList.remove('show');
    sec.querySelector('.in-go')?.classList.remove('show');
    // ข้อความขึ้นทีละประโยค
    lines.forEach((l, k) => this.timers.push(window.setTimeout(() => l.classList.add('show'), 500 + k * SENTENCE_MS)));
    this.timers.push(window.setTimeout(() => this.revealAll(), 500 + lines.length * SENTENCE_MS));
  }

  private revealAll(): void {
    if (this.allShown || !this.root) return;
    this.allShown = true;
    this.timers.forEach((t) => window.clearTimeout(t));
    const sec = this.root.querySelector<HTMLElement>(`.in-scene[data-i="${this.index}"]`)!;
    sec.querySelectorAll('.in-s').forEach((l) => l.classList.add('show'));
    const last = this.index === INTRO_SCENES.length - 1;
    if (last) {
      sec.querySelector('.in-hint')?.classList.remove('show');
      sec.querySelector('.in-go')?.classList.add('show');
    } else sec.querySelector('.in-hint')?.classList.add('show');
  }

  /** ฉากถัดไป — ข้อความยังขึ้นไม่ครบ = แสดงครบก่อน · ฉากสุดท้าย = ใช้ปุ่ม "เริ่มการผจญภัย" */
  next(): void {
    if (performance.now() - this.shownAt < MIN_SCENE_MS) return;
    if (!this.allShown) return this.revealAll();
    if (this.index < INTRO_SCENES.length - 1) this.show(this.index + 1);
  }

  finish(): void {
    if (!this.root) return;
    this.teardown();
    beginChapter(this, CHAPTERS[0].id);
  }

  private teardown(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVis);
    this.root?.remove();
    this.root = null;
  }
}
