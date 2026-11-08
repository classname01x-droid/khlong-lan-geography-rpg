import { bearingDeg, bearingToDirection8 } from '../core/direction/Compass';
import { evaluateRoute, measureRoute, roadMetersBetween, straightMeters } from '../core/route/RouteAnalysis';
import { defaultScale, type ScaleSystem } from '../core/scale/ScaleSystem';
import { referencedPoints, referencedRoutes, referencedWaterways, ROAD_TEMPLATE_PATTERN } from '../core/text/geoTemplate';
import { INTEGRATED_CHECKS } from '../core/site/IntegratedSiteAnalysis';
import { scanSettlement } from '../core/site/SettlementAnalysis';
import { THAI_DIRECTION } from '../core/direction/Compass';
import { GameSession } from '../core/session/GameSession';
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
    // จุดสังเกตกลางผืนน้ำ (เช่น ตาน้ำ หนองน้ำ) ยอมให้ยืนดูจากริมน้ำในรัศมี 3 ช่อง (30 ม.)
    else if (!isPointReachable(grid, reachable, lm.at, grid.getTerrain(lm.at.x, lm.at.y) === 'water' ? 3 : 1)) {
      errors.push(`จุดสังเกต ${lm.id} เดินไปไม่ถึง`);
    }
  }

  const checkText = (where: string, text: string) => {
    for (const ref of referencedPoints(text)) {
      // 'site-analysis' = จุดที่ระบบวิเคราะห์ได้ (ใช้ได้เมื่อด่านมีการวิเคราะห์สถานที่)
      if (ref === 'chosen' && level.settlementAnalysis) continue;
      if (ref === 'site-analysis' && (level.siteAnalysis || level.gridSiteAnalysis || level.integratedSiteAnalysis)) continue;
      if (!landmarkIds.has(ref)) errors.push(`${where} อ้างถึงจุดสังเกตที่ไม่มี: ${ref}`);
    }
    for (const ref of referencedRoutes(text)) {
      if (!routeIds.has(ref)) errors.push(`${where} อ้างถึงเส้นทางที่ไม่มี: ${ref}`);
    }
    for (const ref of referencedWaterways(text)) {
      if (!waterwayIds.has(ref)) errors.push(`${where} อ้างถึงลำน้ำที่ไม่มี: ${ref}`);
    }
    // {{road:a>b}} ต้องมีถนนเชื่อมจริง · {{ia:...}} ต้องมีข้อมูลหลักฐานรวม
    for (const m of text.matchAll(ROAD_TEMPLATE_PATTERN)) {
      const a = level.landmarks.find((l) => l.id === m[1]);
      const b = level.landmarks.find((l) => l.id === m[2]);
      if (a && b && roadMetersBetween(grid, scale, a.at, b.at) === null) {
        errors.push(`${where}: ไม่มีถนนเชื่อม ${m[1]} กับ ${m[2]} (ใช้ {{road}} ไม่ได้)`);
      }
    }
    if (text.includes('{{ia:') && !level.integratedSiteAnalysis) errors.push(`${where} ใช้ {{ia:...}} แต่ด่านไม่มีหลักฐานรวม`);
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

  // ขั้นย่อย (นำทางด้วยการกระทำ): ครบ 4 ส่วน · เป้าหมายนำทางมีจริงและไม่ใช่สถานที่ลับ · จุดอ้างอิงการวัดมีจริง
  const phaseIds = new Set((level.guidePhases ?? []).map((p) => p.id));
  for (const step of level.story) {
    for (const m of step.micro ?? []) {
      const where = `ขั้นย่อย ${m.id}`;
      if (!m.goal || m.steps.length === 0 || !m.result || m.tools.length === 0) errors.push(`${where} ต้องมี เป้าหมาย · วิธีทำ · ผลเมื่อสำเร็จ · เครื่องมือ`);
      if (m.target?.npcId && !npcIds.has(m.target.npcId)) errors.push(`${where} นำทางไป NPC ที่ไม่มี: ${m.target.npcId}`);
      if (m.target?.landmarkId) {
        const lm = level.landmarks.find((l) => l.id === m.target!.landmarkId);
        if (!lm) errors.push(`${where} นำทางไปจุดสังเกตที่ไม่มี: ${m.target.landmarkId}`);
        else if (lm.revealFlag) errors.push(`${where} ห้ามนำทางไปสถานที่ลับ: ${lm.id}`);
        if (m.target.landmarkId === level.pinTask?.targetId) errors.push(`${where} ห้ามนำทางไปคำตอบของการปักหมุด: ${lm?.id}`);
      }
      if (m.measure && !landmarkIds.has(m.measure.from)) errors.push(`${where} วัดระยะจากจุดที่ไม่มี: ${m.measure.from}`);
      if (m.phase && !phaseIds.has(m.phase)) errors.push(`${where} อ้างถึงช่วงภารกิจที่ไม่มี: ${m.phase}`);
    }
  }

  // ---- วิเคราะห์พื้นที่ตั้งถิ่นฐาน (บทที่ 3): เกณฑ์ครบ · มีพื้นที่ที่ผ่านจริง · ทุกหัวข้อมีผู้สอนและมีพื้นที่ที่ผิดเพราะหัวข้อนั้น ----
  const stl = level.settlementAnalysis;
  if (stl) {
    const w = stl.weights;
    if (w.slope + w.height + w.landform + w.water !== 100) errors.push('การวิเคราะห์พื้นที่: คะแนนเต็มของทุกเกณฑ์ต้องรวมได้ 100');
    if (!level.map.elevation) errors.push('การวิเคราะห์พื้นที่ต้องมีแบบจำลองความสูง');
    for (const t of Object.keys(stl.topics) as Array<keyof typeof stl.topics>) {
      if (!npcIds.has(stl.topics[t].teacherId)) errors.push(`การวิเคราะห์พื้นที่: หัวข้อ ${t} อ้างถึงผู้สอนที่ไม่มี: ${stl.topics[t].teacherId}`);
    }
    if (!evidenceIds.has(stl.fieldCheck.evidenceId)) errors.push('การตรวจภาคสนามอ้างถึงหลักฐานที่ไม่มี');
    checkNodes('ตรวจภาคสนาม', stl.fieldCheck.nodes);
    const elev = level.map.elevation ? new ElevationModel(level.map.elevation) : null;
    if (elev) {
      const reps = scanSettlement({ elevation: elev, grid, scale }, stl, 1);
      const passing = reps.filter((r) => r.passed);
      if (passing.length === 0) errors.push('การวิเคราะห์พื้นที่: ไม่มีวงกลมใดผ่านเกณฑ์ ผู้เล่นจะผ่านด่านไม่ได้');
      for (const t of Object.keys(stl.topics) as Array<keyof typeof stl.topics>) {
        if (!reps.some((r) => !r.passed && r.weakTopics.includes(t))) errors.push(`การวิเคราะห์พื้นที่: ไม่มีพื้นที่ที่ไม่ผ่านเพราะหัวข้อ ${t} (บทเรียนเสริมจะไม่ถูกใช้)`);
      }
      // วงที่ผ่านต้องเดินไปถึงได้ (ศูนย์กลางไม่ถูกสิ่งกีดขวางทับ และต่อกับจุดเกิด)
      if (!passing.some((r) => !grid.isBlocked(r.center.x, r.center.y) && isPointReachable(grid, reachable, r.center))) {
        errors.push('การวิเคราะห์พื้นที่: ไม่มีวงที่ผ่านซึ่งเดินไปถึงได้');
      }
    }
  }

  for (const step of level.story) {
    if (!landmarkIds.has(step.landmarkId)) {
      errors.push(`ฉาก ${step.order} อ้างถึงจุดสังเกตที่ไม่มี: ${step.landmarkId}`);
    }
    const cond = step.completeWhen;
    if (cond?.type === 'talk' && !npcIds.has(cond.npcId)) errors.push(`ฉาก ${step.order} อ้างถึง NPC ที่ไม่มี: ${cond.npcId}`);
    if (cond?.type === 'all') {
      for (const o of cond.of) {
        const bad =
          o.type === 'step' ||
          (o.type === 'discover' && !landmarkIds.has(o.landmarkId)) ||
          (o.type === 'clue' && !clueIds.has(o.clueId)) ||
          (o.type === 'evidence' && !evidenceIds.has(o.evidenceId)) ||
          (o.type === 'talk' && !npcIds.has(o.npcId));
        if (bad) errors.push(`ฉาก ${step.order} มีเงื่อนไขที่อ้างถึงข้อมูลที่ไม่มี (หรืออ้างถึงฉาก): ${JSON.stringify(o)}`);
      }
    }
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
    if (pin.targetId === 'site-analysis') {
      if (level.siteAnalysis) {
        if (pin.correctWisdomId !== level.siteAnalysis.requiredSymbol) {
          errors.push('ปักหมุด: ประเภทสถานที่ที่ถูกต้องต้องตรงกับสัญลักษณ์ที่เป้าหมายต้องมี');
        }
      } else if (level.gridSiteAnalysis) {
        if (pin.correctWisdomId !== level.gridSiteAnalysis.placeType) {
          errors.push('ปักหมุด: ประเภทสถานที่ที่ถูกต้องต้องตรงกับ placeType ของจุดเป้าหมาย');
        }
      } else if (!level.integratedSiteAnalysis) {
        errors.push('ปักหมุดแบบคำนวณเป้าหมายต้องมี siteAnalysis, gridSiteAnalysis หรือ integratedSiteAnalysis');
      }
    } else if (!landmarkIds.has(pin.targetId)) errors.push(`เป้าหมายปักหมุดไม่มีอยู่จริง: ${pin.targetId}`);
    if (!pin.wisdomChoices.some((c) => c.id === pin.correctWisdomId)) errors.push('ปักหมุด: ไม่มีประเภทภูมิปัญญาที่ถูก');
    for (const id of pin.requiredEvidenceIds) {
      if (!evidenceIds.has(id)) errors.push(`ปักหมุด: หลักฐานที่ต้องใช้ไม่มีอยู่จริง: ${id}`);
    }
  }
  if (level.ending) checkNodes('ข้อความตอนจบ', level.ending.messages);

  // ---- จุดระดับความสูง / ลำดับจุดบนลำน้ำ ----
  for (const p of level.spotHeights ?? []) {
    if (!grid.inBounds(p.x, p.y)) errors.push(`จุดระดับความสูง (${p.x},${p.y}) อยู่นอกแผนที่`);
  }
  if (level.spotHeights?.length && !elevation) errors.push('มีจุดระดับความสูงแต่ไม่มีข้อมูลระดับความสูง');
  const fs = level.flowSequence;
  if (fs) {
    const flow = flows.get(fs.waterwayId);
    const at = Object.fromEntries(level.landmarks.map((l) => [l.id, l.at]));
    if (!flow || !elevation) errors.push(`ลำดับจุดบนลำน้ำอ้างถึงลำน้ำที่ไม่มี: ${fs.waterwayId}`);
    else {
      // ทุกจุดต้องอยู่บนลำน้ำ เรียงจากต้นน้ำไปปลายน้ำ และระดับความสูงลดลงตามลำดับ
      const idx = fs.landmarkIds.map((id) => {
        const p = at[id];
        if (!p) return -1;
        const i = flow.tiles.findIndex((t) => Math.abs(t.x - p.x) <= 1 && Math.abs(t.y - p.y) <= 1);
        if (i < 0) errors.push(`ลำดับจุดบนลำน้ำ: ${id} ไม่ได้อยู่บนลำน้ำ ${fs.waterwayId}`);
        return i;
      });
      const heights = fs.landmarkIds.map((id) => (at[id] ? elevation.heightAt(at[id].x, at[id].y) : NaN));
      for (let i = 1; i < idx.length; i++) {
        if (idx[i] <= idx[i - 1]) errors.push(`ลำดับจุดบนลำน้ำ: ${fs.landmarkIds[i]} ไม่ได้อยู่ท้ายน้ำของ ${fs.landmarkIds[i - 1]}`);
        if (!(heights[i] < heights[i - 1])) errors.push(`ลำดับจุดบนลำน้ำ: ${fs.landmarkIds[i]} ไม่ได้ต่ำกว่า ${fs.landmarkIds[i - 1]}`);
      }
    }
  }

  // ---- แผนที่ฐาน การเปรียบเทียบ สถานที่ผู้ต้องสงสัย และเป้าหมายปักหมุด ----
  // ใช้ตรรกะเดียวกับตัวเกม (GameSession) — ไม่เขียนกติกาซ้ำ
  const session = new GameSession(level, grid, scale);
  for (const m of level.baseMaps ?? []) {
    if (!evidenceIds.has(m.requiredEvidenceId)) errors.push(`แผนที่ฐาน ${m.id} ต้องใช้หลักฐานที่ไม่มี: ${m.requiredEvidenceId}`);
    for (const mark of m.marks) {
      if (!grid.inBounds(mark.at.x, mark.at.y)) errors.push(`แผนที่ฐาน ${m.id}: สัญลักษณ์ ${mark.label} อยู่นอกแผนที่`);
      if (mark.refersTo && !landmarkIds.has(mark.refersTo)) errors.push(`แผนที่ฐาน ${m.id}: อ้างถึงจุดสังเกตที่ไม่มี ${mark.refersTo}`);
    }
  }
  const mc = level.mapComparison;
  if (mc) {
    if ((level.baseMaps?.length ?? 0) < 2) errors.push('การเปรียบเทียบแผนที่ต้องมีแผนที่ฐานอย่างน้อย 2 ฉบับ');
    for (const id of mc.requiredObservations) if (!landmarkIds.has(id)) errors.push(`การเปรียบเทียบอ้างถึงจุดสังเกตที่ไม่มี: ${id}`);
    for (const id of mc.requiredClueIds) if (!clueIds.has(id)) errors.push(`การเปรียบเทียบอ้างถึงเบาะแสที่ไม่มี: ${id}`);
    if (!session.verifiedSheetId()) errors.push('แผนที่ฐานต้องมีฉบับเดียวที่ผ่านหลักฐานทุกข้อ (ตอนนี้ไม่มี หรือมีมากกว่าหนึ่ง)');
    for (const m of level.baseMaps ?? []) {
      if (m.id !== session.verifiedSheetId() && session.sheetReport(m.id)!.failed.length === 0) {
        errors.push(`แผนที่ฐาน ${m.id} ผ่านทุกข้อเช่นกัน ผู้เล่นจะแยกไม่ออก`);
      }
    }
  }
  const sa = level.siteAnalysis;
  if (sa) {
    if (!flows.get(sa.waterwayId)) errors.push(`สถานที่ผู้ต้องสงสัยอ้างถึงลำน้ำที่ไม่มี: ${sa.waterwayId}`);
    if (!level.baseMaps?.length) errors.push('สถานที่ผู้ต้องสงสัยต้องมีแผนที่ฐาน');
    if (sa.candidates.length < 3) errors.push('ต้องมีสถานที่หลอกอย่างน้อย 2 แห่ง');
    for (const c of sa.candidates) {
      if (!landmarkIds.has(c.landmarkId)) errors.push(`สถานที่ผู้ต้องสงสัยไม่มีอยู่จริง: ${c.landmarkId}`);
      if (c.evidenceId && !evidenceIds.has(c.evidenceId)) errors.push(`สถานที่ ${c.landmarkId} อ้างถึงหลักฐานที่ไม่มี: ${c.evidenceId}`);
    }
    const results = session.evaluateSites();
    const passing = results.filter((r) => r.failed.length === 0).map((r) => r.landmarkId);
    if (passing.length !== 1) errors.push(`สถานที่ที่ผ่านหลักฐานทุกข้อต้องมีแห่งเดียว (ตอนนี้: ${passing.join(', ') || 'ไม่มี'})`);
    if (sa.correctLandmarkId) {
      const r = results.find((x) => x.landmarkId === sa.correctLandmarkId);
      if (r && r.failed.length > 0) errors.push(`เป้าหมายจริง ${sa.correctLandmarkId} ขัดกับหลักฐาน: ${r.failed.join(', ')}`);
      for (const x of results) {
        if (x.landmarkId !== sa.correctLandmarkId && x.failed.length === 0) {
          errors.push(`สถานที่หลอก ${x.landmarkId} ตรงกับหลักฐานทุกข้อ ผู้เล่นจะแยกไม่ออก`);
        }
      }
    }
  }

  // ---- จุดเป้าหมายแบบพิกัดกริด ----
  const ga = level.gridSiteAnalysis;
  if (ga) {
    if (!level.grid) errors.push('จุดเป้าหมายแบบพิกัดกริดต้องกำหนด level.grid');
    if (!landmarkIds.has(ga.relative.fromId)) errors.push(`ตำแหน่งสัมพัทธ์อ้างถึงจุดอ้างอิงที่ไม่มี: ${ga.relative.fromId}`);
    if (ga.candidates.length < 3) errors.push('ต้องมีจุดเป้าหมายอย่างน้อย 3 แห่ง');
    for (const id of ga.requiredClueIds) if (!clueIds.has(id)) errors.push(`จุดเป้าหมายอ้างถึงเบาะแสที่ไม่มี: ${id}`);
    for (const f of ga.requiredFeatures) if (!ga.featureLabels[f]) errors.push(`ไม่มีชื่อภาษาไทยของ feature: ${f}`);
    for (const c of ga.candidates) {
      if (!landmarkIds.has(c.landmarkId)) errors.push(`จุดเป้าหมายไม่มีอยู่จริง: ${c.landmarkId}`);
      if (c.evidenceId && !evidenceIds.has(c.evidenceId)) errors.push(`จุดเป้าหมาย ${c.landmarkId} อ้างถึงหลักฐานที่ไม่มี: ${c.evidenceId}`);
    }
    const ev = session.gridSiteEvidence();
    if (ev && !grid.inBounds(ev.recordTile.x, ev.recordTile.y)) errors.push('พิกัดในบันทึก (หลังแก้แล้ว) อยู่นอกแผนที่');
    const rows = session.evaluateGridSites();
    const passing = rows.filter((r) => r.failed.length === 0).map((r) => r.landmarkId);
    if (passing.length !== 1) errors.push(`จุดเป้าหมายที่ผ่านหลักฐานทุกข้อต้องมีจุดเดียว (ตอนนี้: ${passing.join(', ') || 'ไม่มี'})`);
    // ทุกจุดต้อง "ดูเหมือนคำตอบ" อย่างน้อยหนึ่งทาง: ผ่านหลักฐานบางข้อ / ตรงกับพิกัดในบันทึกเมื่ออ่านตามตัวอักษร / มีสิ่งที่บันทึกบอกบางอย่าง
    const literal = session.coords?.gridToTile(ga.record);
    for (const r of rows) {
      if (r.failed.length < 3) continue;
      const lm = level.landmarks.find((l) => l.id === r.landmarkId);
      const nearLiteral =
        !!literal && !!lm && Math.hypot(lm.at.x - literal.x, lm.at.y - literal.y) <= ga.toleranceTiles;
      const someFeature = !!lm?.features?.some((f) => ga.requiredFeatures.includes(f));
      if (!nearLiteral && !someFeature) errors.push(`จุด ${r.landmarkId} ไม่มีอะไรที่ทำให้ดูเหมือนคำตอบเลย`);
    }
    if (ga.correctLandmarkId && passing[0] !== ga.correctLandmarkId) {
      errors.push(`เป้าหมายที่ตั้งใจ (${ga.correctLandmarkId}) ไม่ตรงกับผลคำนวณ (${passing.join(', ') || 'ไม่มี'})`);
    }
  }

  // ---- จุดเป้าหมายแบบหลักฐานรวม (ด่านสุดท้าย) — ตรวจความสอดคล้องกับโลกเกมอัตโนมัติ ----
  const ia = level.integratedSiteAnalysis;
  if (ia) {
    if (!level.grid) errors.push('หลักฐานรวมต้องกำหนด level.grid (พิกัด E/N)');
    if (!level.map.elevation) errors.push('หลักฐานรวมต้องมีข้อมูลระดับความสูง');
    if (!waterwayIds.has(ia.terrain.waterwayId)) errors.push(`หลักฐานรวมอ้างถึงลำน้ำที่ไม่มี: ${ia.terrain.waterwayId}`);
    for (const id of [ia.distance.fromId, ia.terrain.ofId, ia.grid.fromId]) {
      if (!landmarkIds.has(id)) errors.push(`หลักฐานรวมอ้างถึงจุดสังเกตที่ไม่มี: ${id}`);
    }
    if (ia.candidates.length < 3) errors.push('ต้องมีจุดเป้าหมายอย่างน้อย 3 แห่ง');
    for (const id of ia.requiredClueIds) if (!clueIds.has(id)) errors.push(`หลักฐานรวมอ้างถึงเบาะแสที่ไม่มี: ${id}`);
    for (const c of ia.candidates) {
      if (!landmarkIds.has(c.landmarkId)) errors.push(`จุดเป้าหมายไม่มีอยู่จริง: ${c.landmarkId}`);
      if (c.evidenceId && !evidenceIds.has(c.evidenceId)) errors.push(`จุดเป้าหมาย ${c.landmarkId} อ้างถึงหลักฐานที่ไม่มี: ${c.evidenceId}`);
    }
    const rows = session.evaluateIntegratedSites();
    if (rows.length !== ia.candidates.length) errors.push('คำนวณข้อเท็จจริงของจุดเป้าหมายไม่ครบ');
    for (const r of rows) {
      if (r.facts.roadMeters === null) errors.push(`จุด ${r.landmarkId} ไม่มีถนนเชื่อมจากจุดอ้างอิงระยะทาง`);
      // ทุกจุดต้องดูเหมือนคำตอบอย่างน้อยหนึ่งทาง (ผ่านหลักฐานอย่างน้อย 1 ชนิด)
      if (r.failed.length === INTEGRATED_CHECKS.length) errors.push(`จุด ${r.landmarkId} ไม่ผ่านหลักฐานข้อใดเลย จึงไม่ดูเหมือนคำตอบ`);
    }
    const passing = rows.filter((r) => r.failed.length === 0).map((r) => r.landmarkId);
    if (passing.length !== 1) errors.push(`จุดที่ผ่านหลักฐานรวมทุกข้อต้องมีจุดเดียว (ตอนนี้: ${passing.join(', ') || 'ไม่มี'})`);
    // ห้ามตอบได้จากหลักฐานข้อเดียว: หลักฐานแต่ละชนิดต้องชี้ได้อย่างน้อย 2 จุด
    for (const check of INTEGRATED_CHECKS) {
      const n = rows.filter((r) => !r.failed.includes(check)).length;
      if (n < 2) errors.push(`หลักฐาน "${check}" เพียงข้อเดียวชี้ได้ ${n} จุด — ผู้เล่นจะตอบได้โดยไม่ต้องใช้หลักฐานอื่น`);
    }
    if (ia.correctLandmarkId && passing[0] !== ia.correctLandmarkId) {
      errors.push(`เป้าหมายที่ตั้งใจ (${ia.correctLandmarkId}) ไม่ตรงกับผลคำนวณ (${passing.join(', ') || 'ไม่มี'})`);
    }
    if (level.pinTask?.targetId === 'site-analysis' && level.pinTask.correctWisdomId !== ia.placeType) {
      errors.push('ประเภทสถานที่ของการปักหมุดไม่ตรงกับหลักฐานรวม');
    }
  }

  // ---- จุดตรวจค้น ----
  for (const p of level.inspectPoints ?? []) {
    if (!grid.inBounds(p.at.x, p.at.y)) errors.push(`จุดตรวจค้น ${p.id} อยู่นอกแผนที่`);
    else if (!isPointReachable(grid, reachable, p.at, Math.max(1, p.radiusTiles))) errors.push(`จุดตรวจค้น ${p.id} เดินไปไม่ถึง`);
    checkNodes(`จุดตรวจค้น ${p.id}`, p.nodes);
    if (p.expectHighestWithin) {
      if (!elevation) errors.push(`จุดตรวจค้น ${p.id}: ต้องมีข้อมูลระดับความสูง`);
      else {
        // หาจุดสูงสุดจริงในรัศมี (ทีละช่อง) แล้วเทียบกับตำแหน่งที่กำหนด
        let best = p.at;
        const r = p.expectHighestWithin;
        for (let y = p.at.y - r; y <= p.at.y + r; y++) {
          for (let x = p.at.x - r; x <= p.at.x + r; x++) {
            if (!grid.inBounds(x, y) || Math.hypot(x - p.at.x, y - p.at.y) > r) continue;
            if (elevation.heightAt(x, y) > elevation.heightAt(best.x, best.y)) best = { x, y };
          }
        }
        if (Math.hypot(best.x - p.at.x, best.y - p.at.y) > p.radiusTiles) {
          errors.push(`จุดตรวจค้น ${p.id}: ไม่ใช่จุดสูงสุดในรัศมี ${r} ช่อง (จุดสูงสุดจริงอยู่ที่ ${best.x},${best.y})`);
        }
      }
    }
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
