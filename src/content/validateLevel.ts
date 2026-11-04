import { referencedPoints } from '../core/text/geoTemplate';
import { buildWorld } from '../core/world/MapBuilder';
import { isPointReachable, reachableTiles } from '../core/world/pathfinding';
import type { WorldGrid } from '../core/world/WorldGrid';
import type { LevelDefinition } from './types';

/**
 * ตรวจความถูกต้องของเนื้อหาด่าน — รันทั้งใน unit test และตอนเปิดเกม (โหมด dev)
 * คืนรายการปัญหา (ว่าง = ผ่าน)
 */
export function validateLevel(level: LevelDefinition, grid: WorldGrid = buildWorld(level.map)): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (grid.isBlocked(level.spawn.x, level.spawn.y)) {
    errors.push(`จุดเกิด (${level.spawn.x},${level.spawn.y}) ถูกสิ่งกีดขวางทับ`);
  }
  const reachable = reachableTiles(grid, level.spawn);

  for (const lm of level.landmarks) {
    if (ids.has(lm.id)) errors.push(`id จุดสังเกตซ้ำ: ${lm.id}`);
    ids.add(lm.id);
    if (!grid.inBounds(lm.at.x, lm.at.y)) errors.push(`จุดสังเกต ${lm.id} อยู่นอกแผนที่`);
    else if (!isPointReachable(grid, reachable, lm.at)) errors.push(`จุดสังเกต ${lm.id} เดินไปไม่ถึง`);
  }

  for (const npc of level.npcs) {
    if (grid.isBlocked(npc.at.x, npc.at.y)) errors.push(`NPC ${npc.id} ยืนบนสิ่งกีดขวาง`);
    else if (!isPointReachable(grid, reachable, npc.at)) errors.push(`NPC ${npc.id} เดินไปไม่ถึง`);
    for (const line of npc.dialogue) {
      for (const ref of referencedPoints(line.text)) {
        if (!ids.has(ref)) errors.push(`บทพูดของ ${npc.id} อ้างถึงจุดสังเกตที่ไม่มี: ${ref}`);
      }
    }
  }

  for (const step of level.story) {
    if (!ids.has(step.landmarkId)) errors.push(`ฉาก ${step.order} อ้างถึงจุดสังเกตที่ไม่มี: ${step.landmarkId}`);
    const cond = step.completeWhen;
    if (cond?.type === 'talk' && !level.npcs.some((n) => n.id === cond.npcId)) {
      errors.push(`ฉาก ${step.order} อ้างถึง NPC ที่ไม่มี: ${cond.npcId}`);
    }
  }
  return errors;
}
