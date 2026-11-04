import { bearingDeg, bearingToDirection8 } from '../core/direction/Compass';
import { evaluateRoute, measureRoute, straightMeters } from '../core/route/RouteAnalysis';
import { defaultScale, type ScaleSystem } from '../core/scale/ScaleSystem';
import { referencedPoints, referencedRoutes, referencedWaterways } from '../core/text/geoTemplate';
import { THAI_DIRECTION } from '../core/direction/Compass';
import { evaluateSite } from '../core/site/SiteAnalysis';
import { ElevationModel } from '../core/world/Elevation';
import { analyzeWaterway, waterwayTiles, type WaterwayAnalysis } from '../core/world/Waterway';
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
  const waterwayIds = new Set((level.waterways ?? []).map((w) => w.id));

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
    for (const ref of referencedWaterways(text)) {
      if (!waterwayIds.has(ref)) errors.push(`${where} อ้างถึงลำน้ำที่ไม่มี: ${ref}`);
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

  // ---- ลำน้ำ: ทิศน้ำไหลต้องคำนวณจากระดับความสูงได้ และน้ำต้องไม่ไหลขึ้นเนิน ----
  const elevation = level.map.elevation ? new ElevationModel(level.map.elevation) : null;
  const flows = new Map<string, WaterwayAnalysis>();
  for (const w of level.waterways ?? []) {
    if (!elevation) {
      errors.push(`ลำน้ำ ${w.id}: ด่านไม่มีข้อมูลระดับความสูง จึงหาทิศน้ำไหลไม่ได้`);
      continue;
    }
    const a = analyzeWaterway(w.points, elevation);
    flows.set(w.id, a);
    if (!a.monotonic) errors.push(`ลำน้ำ ${w.id}: ระดับความสูงไม่ลดลงตลอดแนว (น้ำต้องไหลขึ้นเนิน)`);
    if (waterwayTiles(w.points).some((p) => grid.inBounds(p.x, p.y) && grid.getTerrain(p.x, p.y) !== 'water' && grid.getTerrain(p.x, p.y) !== 'bridge')) {
      errors.push(`ลำน้ำ ${w.id}: แนวลำน้ำไม่ตรงกับช่องน้ำในแผนที่`);
    }
  }

  for (const q of level.quizzes ?? []) {
    if (!q.choices.some((c) => c.id === q.correctChoiceId)) errors.push(`คำถาม ${q.id} ไม่มีคำตอบที่ถูก`);
    checkText(`คำถาม ${q.id}`, q.question);
    checkText(`คำถาม ${q.id}`, q.correctFeedback);
    for (const c of q.choices) checkText(`คำถาม ${q.id}`, c.label + (c.hint ?? ''));
    checkEffects(`คำถาม ${q.id}`, q.effects);
    if (q.verifyFlowOf) {
      const flow = flows.get(q.verifyFlowOf);
      // หาชื่อทิศที่ยาวที่สุดที่อยู่ในข้อความ (กัน "ทิศเหนือ" ไปตรงกับ "ทิศตะวันตกเฉียงเหนือ")
      const dirIn = (label: string) =>
        Object.values(THAI_DIRECTION)
          .filter((d) => label.includes(d))
          .sort((a, b) => b.length - a.length)[0];
      if (!flow) errors.push(`คำถาม ${q.id} อ้างถึงลำน้ำที่ไม่มี: ${q.verifyFlowOf}`);
      else {
        const expected = THAI_DIRECTION[flow.flowDirection];
        for (const c of q.choices) {
          const isCorrect = c.id === q.correctChoiceId;
          if (isCorrect && dirIn(c.label) !== expected) errors.push(`คำถาม ${q.id}: คำตอบที่ถูกไม่ตรงกับทิศน้ำไหลจริง (${expected})`);
          if (!isCorrect && dirIn(c.label) === expected) errors.push(`คำถาม ${q.id}: ตัวเลือกผิด "${c.label}" ตรงกับทิศน้ำไหลจริง`);
        }
      }
    }
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

  // ---- แผนที่เก่า และสถานที่ผู้ต้องสงสัย ----
  const old = level.oldMap;
  if (old) {
    if (!evidenceIds.has(old.requiredEvidenceId)) errors.push(`แผนที่เก่าต้องใช้หลักฐานที่ไม่มี: ${old.requiredEvidenceId}`);
    for (const m of old.marks) if (!grid.inBounds(m.at.x, m.at.y)) errors.push(`แผนที่เก่า: สัญลักษณ์ ${m.label} อยู่นอกแผนที่`);
  }
  for (const p of level.spotHeights ?? []) {
    if (!grid.inBounds(p.x, p.y)) errors.push(`จุดระดับความสูง (${p.x},${p.y}) อยู่นอกแผนที่`);
  }
  if (level.spotHeights?.length && !elevation) errors.push('มีจุดระดับความสูงแต่ไม่มีข้อมูลระดับความสูง');
  const sa = level.siteAnalysis;
  if (sa) {
    const flow = flows.get(sa.waterwayId);
    const at = Object.fromEntries(level.landmarks.map((l) => [l.id, l.at]));
    if (!flow) errors.push(`สถานที่ผู้ต้องสงสัยอ้างถึงลำน้ำที่ไม่มี: ${sa.waterwayId}`);
    if (!old) errors.push('สถานที่ผู้ต้องสงสัยต้องมีแผนที่เก่า');
    if (!sa.candidates.includes(sa.correctLandmarkId)) errors.push('เป้าหมายจริงไม่อยู่ในรายการสถานที่ผู้ต้องสงสัย');
    if (sa.candidates.length < 3) errors.push('ต้องมีสถานที่หลอกอย่างน้อย 2 แห่ง');
    if (flow && old) {
      const ev = {
        source: flow.source,
        oldMapMarks: old.marks.map((m) => ({ symbol: m.symbol, at: m.at })),
        requiredSymbol: sa.requiredSymbol,
        toleranceTiles: sa.toleranceTiles,
      };
      for (const id of sa.candidates) {
        if (!at[id]) {
          errors.push(`สถานที่ผู้ต้องสงสัยไม่มีอยู่จริง: ${id}`);
          continue;
        }
        const failed = evaluateSite(at[id], ev);
        if (id === sa.correctLandmarkId && failed.length > 0) errors.push(`เป้าหมายจริง ${id} ขัดกับหลักฐาน: ${failed.join(', ')}`);
        if (id !== sa.correctLandmarkId && failed.length === 0) errors.push(`สถานที่หลอก ${id} ตรงกับหลักฐานทุกข้อ ผู้เล่นจะแยกไม่ออก`);
      }
    }
  }

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
