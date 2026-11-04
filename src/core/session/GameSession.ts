import type { LevelDefinition, StoryStep } from '../../content/types';
import { directionFromVector, type Direction8 } from '../direction/Compass';
import { FogOfWar } from '../fog/FogOfWar';
import { DistanceTracker } from '../movement/DistanceTracker';
import type { ScaleSystem } from '../scale/ScaleSystem';
import { resolveGeoTemplate } from '../text/geoTemplate';
import type { TilePoint } from '../world/types';
import type { WorldGrid } from '../world/WorldGrid';

export type SessionMode = 'explore' | 'dialogue' | 'map';

/**
 * สถานะของการเล่นหนึ่งรอบ (ข้อมูลล้วน ไม่มี Phaser)
 * WorldScene เป็นผู้เขียน, UIScene เป็นผู้อ่าน — ในอนาคตใช้บันทึก/โหลดเกมได้
 */
export class GameSession {
  readonly fog: FogOfWar;
  readonly odometer: DistanceTracker;
  readonly discoveredLandmarks = new Set<string>();
  readonly talkedTo = new Set<string>();
  readonly landmarkPoints: Readonly<Record<string, TilePoint>>;

  mode: SessionMode = 'explore';
  showGrid = false;
  playerTile: TilePoint;
  facing: Direction8 = 'S';

  constructor(
    readonly level: LevelDefinition,
    readonly grid: WorldGrid,
    readonly scale: ScaleSystem,
  ) {
    this.fog = new FogOfWar(grid.width, grid.height);
    this.odometer = new DistanceTracker(scale);
    this.playerTile = { ...level.spawn };
    this.landmarkPoints = Object.fromEntries(level.landmarks.map((l) => [l.id, l.at]));
  }

  /** อัปเดตทิศที่หันจากเวกเตอร์ความเร็ว */
  updateFacing(vx: number, vy: number): void {
    this.facing = directionFromVector(vx, vy) ?? this.facing;
  }

  /** แปลงตัวแปรในบทพูดเป็นตัวเลข/ทิศที่คำนวณจากแผนที่ */
  resolveText(text: string): string {
    return resolveGeoTemplate(text, this.landmarkPoints, this.scale);
  }

  /** ตรวจว่าจุดสังเกตใดเพิ่งถูกเปิดหมอก; คืนรายการที่เพิ่งค้นพบ */
  checkLandmarkDiscovery(): string[] {
    const found: string[] = [];
    for (const lm of this.level.landmarks) {
      if (!this.discoveredLandmarks.has(lm.id) && this.fog.isExplored(lm.at.x, lm.at.y)) {
        this.discoveredLandmarks.add(lm.id);
        found.push(lm.id);
      }
    }
    return found;
  }

  isStepComplete(step: StoryStep): boolean {
    const c = step.completeWhen;
    if (!c) return false;
    return c.type === 'talk' && this.talkedTo.has(c.npcId);
  }

  /** ฉากปัจจุบัน = ฉากแรกที่ยังไม่ผ่าน */
  get currentStep(): StoryStep | undefined {
    return this.level.story.find((s) => !this.isStepComplete(s));
  }
}
