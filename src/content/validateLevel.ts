import { bearingDeg, bearingToDirection8 } from '../core/direction/Compass';
import { evaluateRoute, measureRoute, straightMeters } from '../core/route/RouteAnalysis';
import { defaultScale, type ScaleSystem } from '../core/scale/ScaleSystem';
import { referencedPoints, referencedRoutes } from '../core/text/geoTemplate';
import { buildWorld } from '../core/world/MapBuilder';
import { isPointReachable, reachableTiles } from '../core/world/pathfinding';
import type { WorldGrid } from '../core/world/WorldGrid';
import type { ClueType, DialogueNode, Effect, LevelDefinition } from './types';

/**
 * ตรวจความถูกต้องของเนื้อหาด่าน — รันทั้งใน unit test และตอนเปิดเกม (โหมด dev)
 * รวมถึงตรวจว่า "เบาะแสสอดคล้องกับแผนที่" : เส้นทางที่ถูกต้องผ่านหลักฐานครบทุกข้อ
 * และเส้นทางหลอกทุกเส้นต้องขัดกับหลักฐานอย่างน้อย 1 ข้อ
 * คืนรายการปัญหา (ว่าง = ผ่าน)
 */
export function validateLevel(
  level: LevelDefinition,
  grid: WorldGrid = buildWorld(level.map),
  scale: ScaleSystem = defaultScale,
): string[] {
  const errors: string[] = [];
  const landmarkIds = new Set<string>();
  const npcIds = new Set(level.npcs.map((n) => n.id));
  const quizIds = new Set((level.quizzes ?? []).map((q) => q.id));
  const clueIds = new Set((level.clues ?? []).map((c) => c.id));
  const evidenceIds = new Set((level.evidence ?? []).map((e) => e.id));
  const routeIds = new Set((level.routeAnalysis?.routes ?? []).map((r) => r.id));

  if (grid.isBlocked(level.spawn.x, level.spawn.y)) {
    errors.push(`จุดเกิด (${level.spawn.x},${level.spawn.y}) ถูกสิ่งกีดขวางทับ`);
  }
  const reachable = reachableTiles(grid, level.spawn);

  for (const lm of level.landmarks) {
    if (landmarkIds.has(lm.id)) errors.push(`id จุดสังเกตซ้ำ: ${lm.id}`);
    landmarkIds.add(lm.id);
    if (!grid.inBounds(lm.at.x, lm.at.y)) errors.push(`จุดสังเกต ${lm.id} อยู่นอกแผนที่`);
    else if (!isPointReachable(grid, reachable, lm.at)) errors.push(`จุดสังเกต ${lm.id} เดินไปไม่ถึง`);
  }

  const checkText = (where: string, text: string) => {
    for (const ref of referencedPoints(text)) {
      if (!landmarkIds.has(ref)) errors.push(`${where} อ้างถึงจุดสังเกตที่ไม่มี: ${ref}`);
    }
    for (const ref of referencedRoutes(text)) {
      if (!routeIds.has(ref)) errors.push(`${where} อ้างถึงเส้นทางที่ไม่มี: ${ref}`);
    }
  };
  const checkEffects = (where: string, effects: Effect[] | undefined) => {
    for (const e of effects ?? []) {
      if (e.type === 'clue' && !clueIds.has(e.clueId)) errors.push(`${where} ให้เบาะแสที่ไม่มี: ${e.clueId}`);
      if (e.type === 'evidence' && !evidenceIds.has(e.evidenceId)) {
        errors.push(`${where} ให้หลักฐานที่ไม่มี: ${e.evidenceId}`);
      }
    }
  };
  const checkNodes = (where: string, nodes: DialogueNode[]) => {
    for (const node of nodes) {
      if ('quiz' in node) {
        if (!quizIds.has(node.quiz)) errors.push(`${where} อ้างถึงคำถามที่ไม่มี: ${node.quiz}`);
        continue;
      }
      checkText(where, node.text);
      checkEffects(where, node.effects);
    }
  };

  for (const npc of level.npcs) {
    if (grid.isBlocked(npc.at.x, npc.at.y)) errors.push(`NPC ${npc.id} ยืนบนสิ่งกีดขวาง`);
    else if (!isPointReachable(grid, reachable, npc.at)) errors.push(`NPC ${npc.id} เดินไปไม่ถึง`);
    if (npc.dialogue.length === 0) errors.push(`NPC ${npc.id} ไม่มีบทพูด`);
    npc.dialogue.forEach((v, i) => checkNodes(`บทพูด ${npc.id}#${i}`, v.nodes));
  }

  for (const q of level.quizzes ?? []) {
    if (!q.choices.some((c) => c.id === q.correctChoiceId)) errors.push(`คำถาม ${q.id} ไม่มีคำตอบที่ถูก`);
    checkText(`คำถาม ${q.id}`, q.question);
    checkEffects(`คำถาม ${q.id}`, q.effects);
  }
  for (const c of level.clues ?? []) checkText(`เบาะแส ${c.id}`, c.text);

  for (const t of level.triggers ?? []) {
    if (!npcIds.has(t.npcId)) errors.push(`trigger ${t.id} อ้างถึง NPC ที่ไม่มี: ${t.npcId}`);
  }

  for (const step of level.story) {
    if (!landmarkIds.has(step.landmarkId)) {
      errors.push(`ฉาก ${step.order} อ้างถึงจุดสังเกตที่ไม่มี: ${step.landmarkId}`);
    }
    const cond = step.completeWhen;
    if (cond?.type === 'talk' && !npcIds.has(cond.npcId)) errors.push(`ฉาก ${step.order} อ้างถึง NPC ที่ไม่มี: ${cond.npcId}`);
  }

  // ---- ความสอดคล้องของเบาะแสกับเส้นทางในแผนที่ ----
  const ra = level.routeAnalysis;
  if (ra) {
    const at = Object.fromEntries(level.landmarks.map((l) => [l.id, l.at]));
    const origin = at[ra.originId];
    const target = at[ra.targetId];
    if (!origin || !target) {
      errors.push('การวิเคราะห์เส้นทางอ้างถึงจุดสังเกตต้นทาง/เป้าหมายที่ไม่มี');
    } else {
      const types = new Set<ClueType>();
      for (const id of ra.requiredClueIds) {
        const clue = level.clues?.find((c) => c.id === id);
        if (!clue) errors.push(`เบาะแสที่จำเป็นไม่มีอยู่จริง: ${id}`);
        else types.add(clue.type);
      }
      for (const t of ['direction', 'distance', 'landmark'] as const) {
        if (!types.has(t)) errors.push(`เบาะแสที่จำเป็นขาดประเภท: ${t}`);
      }
      if (!landmarkIds.has(ra.requiredLandmarkId)) errors.push(`จุดสังเกตที่ต้องผ่านไม่มีอยู่จริง: ${ra.requiredLandmarkId}`);

      const expected = {
        direction: bearingToDirection8(bearingDeg(target.x - origin.x, target.y - origin.y)),
        straightMeters: straightMeters(origin, target, scale),
        toleranceMeters: scale.mapCmToMeters(ra.distanceToleranceMapCm),
        landmarkId: ra.requiredLandmarkId,
      };
      const landmarks = level.landmarks.map((l) => ({ id: l.id, at: l.at }));
      if (!ra.routes.some((r) => r.id === ra.correctRouteId)) errors.push('ไม่มีเส้นทางที่ถูกต้องในรายการ');
      if (ra.routes.length < 2) errors.push('ต้องมีอย่างน้อย 2 เส้นทางให้เลือก');
      for (const r of ra.routes) {
        const dest = at[r.to];
        if (!dest) {
          errors.push(`เส้นทาง ${r.id} ไปยังจุดสังเกตที่ไม่มี: ${r.to}`);
          continue;
        }
        const m = measureRoute(grid, scale, origin, dest, r.via ?? [], landmarks, [ra.originId, r.to]);
        if (!m.connected) {
          errors.push(`เส้นทาง ${r.id} ไม่เชื่อมต่อกันบนถนน`);
          continue;
        }
        const failed = evaluateRoute(m, expected);
        if (r.id === ra.correctRouteId && failed.length > 0) {
          errors.push(`เส้นทางที่ถูกต้อง ${r.id} ขัดกับหลักฐาน: ${failed.join(', ')}`);
        }
        if (r.id !== ra.correctRouteId && failed.length === 0) {
          errors.push(`เส้นทางหลอก ${r.id} ตรงกับหลักฐานทุกข้อ ผู้เล่นจะแยกไม่ออก`);
        }
      }
    }
  }

  const pin = level.pinTask;
  if (pin) {
    if (!landmarkIds.has(pin.targetId)) errors.push(`เป้าหมายปักหมุดไม่มีอยู่จริง: ${pin.targetId}`);
    if (!pin.wisdomChoices.some((c) => c.id === pin.correctWisdomId)) errors.push('ปักหมุด: ไม่มีประเภทภูมิปัญญาที่ถูก');
    for (const id of pin.requiredEvidenceIds) {
      if (!evidenceIds.has(id)) errors.push(`ปักหมุด: หลักฐานที่ต้องใช้ไม่มีอยู่จริง: ${id}`);
    }
  }
  if (level.ending) checkNodes('ข้อความตอนจบ', level.ending.messages);

  // ---- จุดตรวจค้น ----
  for (const p of level.inspectPoints ?? []) {
    if (!grid.inBounds(p.at.x, p.at.y)) errors.push(`จุดตรวจค้น ${p.id} อยู่นอกแผนที่`);
    else if (!isPointReachable(grid, reachable, p.at)) errors.push(`จุดตรวจค้น ${p.id} เดินไปไม่ถึง`);
    checkNodes(`จุดตรวจค้น ${p.id}`, p.nodes);
  }

  // ---- ภารกิจ ----
  const questIds = new Set<string>();
  const steps = new Set(level.story.map((st) => st.order));
  const mains = (level.quests ?? []).filter((q) => q.kind === 'main');
  if (level.quests && mains.length !== 1) errors.push('ต้องมีภารกิจหลัก 1 ภารกิจต่อด่าน');
  for (const q of level.quests ?? []) {
    if (questIds.has(q.id)) errors.push(`id ภารกิจซ้ำ: ${q.id}`);
    questIds.add(q.id);
    if (q.objectives.length === 0) errors.push(`ภารกิจ ${q.id} ไม่มีเป้าหมาย`);
    for (const c of q.unlockWhen?.clues ?? []) {
      if (!clueIds.has(c)) errors.push(`ภารกิจ ${q.id} ปลดล็อกด้วยเบาะแสที่ไม่มี: ${c}`);
    }
    checkEffects(`รางวัลภารกิจ ${q.id}`, q.reward?.effects);
    for (const o of q.objectives) {
      const d = o.done;
      const bad =
        (d.type === 'step' && !steps.has(d.order)) ||
        (d.type === 'discover' && !landmarkIds.has(d.landmarkId)) ||
        (d.type === 'clue' && !clueIds.has(d.clueId)) ||
        (d.type === 'evidence' && !evidenceIds.has(d.evidenceId)) ||
        (d.type === 'talk' && !npcIds.has(d.npcId)) ||
        (d.type === 'routesExplored' && d.count > routeIds.size);
      if (bad) errors.push(`ภารกิจ ${q.id} มีเป้าหมายที่อ้างถึงข้อมูลที่ไม่มี: ${JSON.stringify(d)}`);
    }
  }
  if (mains[0]) {
    const covered = new Set(mains[0].objectives.flatMap((o) => (o.done.type === 'step' ? [o.done.order] : [])));
    for (const st of level.story) if (!covered.has(st.order)) errors.push(`ภารกิจหลักไม่ครอบคลุมฉาก ${st.order}`);
  }

  return errors;
}
