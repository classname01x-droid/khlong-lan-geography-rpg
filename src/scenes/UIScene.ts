import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import type { GameSession } from '../core/session/GameSession';
import { MapOverlay } from '../ui/MapOverlay';
import { CompareOverlay } from '../ui/CompareOverlay';
import { DRAG_THRESHOLD } from '../core/ui/MapViewport';
import { touchView } from '../ui/touch/touchViewState';
import { EVENT_TOUCH_TOAST, REGISTRY_SESSION } from './events';

/**
 * ชั้น UI ซ้อนบนโลกเกม (กล้องไม่ซูม) — UI เดียวทุกอุปกรณ์ (แบบมือถือ):
 * ข้อความ/ปุ่ม/สมุด/สรุปผล/เมนูหยุดเกม/แถบสถานะ อยู่ที่ชั้น DOM (ui/touch/TouchLayer.ts) ตัวอักษรใหญ่ แตะ/คลิกได้
 * ที่เหลือใน Phaser: ภาพแผนที่สำรวจ (MapOverlay) และหน้าเปรียบเทียบแผนที่ (CompareOverlay)
 * อ่านสถานะจาก GameSession อย่างเดียว — วาด overlay ใหม่เมื่อ session.uiVersion เปลี่ยน
 */
export class UIScene extends Phaser.Scene {
  private mapOverlay!: MapOverlay;
  private compare!: CompareOverlay;
  private renderedVersion = -1;
  private renderedTouchVersion = -1;
  /** นิ้ว/เมาส์ที่กำลังลากหน้าเปรียบเทียบแผนที่ — ไม่ขยับเกิน DRAG_THRESHOLD = แตะ */
  private drag: { id: number; x: number; y: number; from: { x: number; y: number } | null; moved: boolean } | null = null;

  constructor() {
    super('UIScene');
  }

  private get session(): GameSession {
    return this.registry.get(REGISTRY_SESSION) as GameSession;
  }

  create(): void {
    this.renderedVersion = -1;
    this.renderedTouchVersion = -1;
    this.drag = null;
    this.bindMapPointer();
    this.mapOverlay = new MapOverlay(this, this.session);
    this.compare = new CompareOverlay(this);
  }

  override update(): void {
    const s = this.session;
    if (!s) return;
    // แจ้งเตือน: แสดงเป็นข้อความ DOM ตัวอักษรใหญ่ (TouchLayer)
    for (const msg of s.drainToasts()) this.game.events.emit(EVENT_TOUCH_TOAST, msg);
    if (s.uiVersion !== this.renderedVersion || touchView.version !== this.renderedTouchVersion) {
      this.renderedVersion = s.uiVersion;
      this.renderedTouchVersion = touchView.version;
      this.mapOverlay.render();
      this.compare.render(s);
    } else if (s.mode === 'map') {
      this.mapOverlay.updatePlayer();
    }
  }

  /* ---------- สำหรับชั้น DOM (TouchLayer): ปักหมุด/เลื่อนแผนที่ ด้วยพิกัดภาพเกม ---------- */

  mapTileAt(gx: number, gy: number): { x: number; y: number } | null {
    return this.session?.mode === 'map' ? this.mapOverlay.tileAt(gx, gy) : null;
  }

  mapTileCenter(t: { x: number; y: number }): { x: number; y: number } {
    return this.mapOverlay.tileCenter(t);
  }

  mapCellPx(): number {
    return this.mapOverlay.cellOnScreen;
  }

  mapPanPosition(): { x: number; y: number } | null {
    return this.mapOverlay.panPosition;
  }

  mapPanFrom(from: { x: number; y: number }, dx: number, dy: number): void {
    this.mapOverlay.panFrom(from, dx, dy);
  }

  /**
   * หน้าเปรียบเทียบแผนที่ (จอสัมผัส): ลากนิ้ว = เลื่อนแผนที่ฐานที่ขยายอยู่
   * หน้าแผนที่ (ปักหมุด/เลื่อน) ใช้ชั้น DOM ของ TouchLayer แทน (core/ui/PinGesture — วัดระยะเป็น CSS px)
   * แยกการแตะกับการลากด้วยระยะ DRAG_THRESHOLD และใช้เฉพาะนิ้วแรก — คีย์ลูกศรเดิมยังใช้ได้
   */
  private bindMapPointer(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const s = this.session;
      // หน้าแผนที่: ชั้น DOM (PinGesture) รับการแตะ/ลากแทน · เหลือเฉพาะหน้าเปรียบเทียบแผนที่ที่ใช้ทางนี้
      if (!s || s.mode !== 'compare' || (this.drag && p.id === this.drag.id && p.isDown)) return;
      const from = this.compare.panPosition;
      this.drag = { id: p.id, x: p.x, y: p.y, from, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || p.id !== d.id || !p.isDown) return;
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      // ระยะลากวัดเป็น CSS px ของจอจริง (เดิมวัดเป็นหน่วยภาพเกม ทำให้บนโทรศัพท์นิ้วสั่นเล็กน้อยก็นับเป็นการลาก)
      const cssPerGame = this.game.canvas.getBoundingClientRect().width / GAME_WIDTH;
      if (!d.moved && Math.hypot(dx, dy) * cssPerGame < DRAG_THRESHOLD) return;
      d.moved = true;
      if (!d.from) return;
      if (this.session.mode === 'compare') this.compare.panFrom(d.from, dx, dy);
    });
    const end = (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || p.id !== d.id) return;
      this.drag = null;
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);
    this.input.on('gameout', () => (this.drag = null));
  }
}
