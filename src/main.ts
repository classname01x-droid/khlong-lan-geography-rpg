import Phaser from 'phaser';
import { GAME_FPS, GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { ChapterScene } from './scenes/ChapterScene';
import { IntroScene } from './scenes/IntroScene';
import { EndingScene } from './scenes/EndingScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';
import { REGISTRY_TOUCH_UI } from './scenes/events';
import { computeMobileLayout, type Insets } from './core/ui/MobileLayout';
import { TouchLayer } from './ui/touch/TouchLayer';
import { TouchScreens } from './ui/touch/TouchScreens';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0d1220',
  pixelArt: true, // ปิดการเบลอภาพ ให้ pixel art คมชัด
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // หลายนิ้วพร้อมกัน (ปุ่มสัมผัสเป็น DOM แต่การแตะบนแผนที่/ปุ่มในเกมยังใช้ Phaser)
  input: { activePointers: 3 },
  fps: GAME_FPS,
  scene: [BootScene, MainMenuScene, IntroScene, WorldMapScene, ChapterScene, EndingScene, WorldScene, UIScene],
};

const game = new Phaser.Game(config);

/* ---------------- มือถือ: ปุ่มสัมผัส + จัดวางจอ ---------------- */

/** เล่นบนจอสัมผัสหรือไม่ — ?touch=1 บังคับเปิด (ทดสอบ), ?touch=0 บังคับปิด */
function detectTouch(): boolean {
  const q = new URLSearchParams(window.location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** ขอบปลอดภัย (รอยบาก/มุมโค้ง) จาก CSS env(safe-area-inset-*) */
function readInsets(): Insets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => parseFloat(v) || 0;
  const insets = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  probe.remove();
  return insets;
}

const touch = detectTouch();
game.registry.set(REGISTRY_TOUCH_UI, touch);
const touchLayer = new TouchLayer(game, touch);
// จอสัมผัส: เมนูหลัก แผนที่การเดินทาง ฉากเชื่อมบท และฉากจบ เป็นหน้าจอ DOM ตัวอักษรใหญ่ (คอมพิวเตอร์ใช้หน้าจอบน canvas เดิม)
const touchScreens = touch ? new TouchScreens(game) : null;
const host = document.getElementById('game')!;

function applyLayout(): void {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const layout = computeMobileLayout(vw, vh, readInsets(), touch);
  // จอสัมผัส: วางภาพเกมไว้ระหว่างคอลัมน์ปุ่ม (ไม่ทับฉาก) · คอมพิวเตอร์: เต็มหน้าต่างเหมือนเดิม
  const r = touch ? layout.game : { x: 0, y: 0, w: vw, h: vh };
  Object.assign(host.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  game.scale.refresh();
  touchLayer.setLayout(layout);
  touchScreens?.setLayout(layout);
}
applyLayout();
window.addEventListener('resize', applyLayout);
window.addEventListener('orientationchange', () => window.setTimeout(applyLayout, 150));
window.visualViewport?.addEventListener('resize', applyLayout);
// กันการซูมด้วยท่าทาง (iOS) และการดับเบิลแตะซูม
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// เปิดให้เข้าถึงจาก console/การทดสอบอัตโนมัติในโหมด dev เท่านั้น
if (import.meta.env.DEV) {
  (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;
  (window as unknown as { __TOUCH__: TouchLayer }).__TOUCH__ = touchLayer;
  (window as unknown as { __SCREENS__: TouchScreens | null }).__SCREENS__ = touchScreens;
}
