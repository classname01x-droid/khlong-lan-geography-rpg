import { sakNgamLevel } from '../src/content/levels/sakngam';
import type { LevelDefinition } from '../src/content/types';
import { defaultScale } from '../src/core/scale/ScaleSystem';
import { GameSession } from '../src/core/session/GameSession';
import { buildWorld } from '../src/core/world/MapBuilder';

export function newSession(level: LevelDefinition = sakNgamLevel): GameSession {
  return new GameSession(level, buildWorld(level.map), defaultScale);
}

/** คุยกับ NPC จนจบ — ตอบคำถามตามลำดับใน answers (index ของตัวเลือก) */
export function talk(s: GameSession, npcId: string, answers: number[] = []): void {
  const npc = s.level.npcs.find((n) => n.id === npcId);
  if (!npc) throw new Error(`no npc ${npcId}`);
  s.talkTo(npc);
  runDialogue(s, answers);
}

export function runDialogue(s: GameSession, answers: number[] = []): string {
  const queue = [...answers];
  let outcome = 'continue';
  for (let guard = 0; s.inDialogue && guard < 100; guard++) {
    const v = s.dialogueView!;
    if (v.kind === 'quiz') {
      const a = queue.shift();
      if (a === undefined) throw new Error('quiz needs an answer');
      s.answerQuiz(a);
    } else {
      outcome = s.advanceDialogue();
    }
  }
  return outcome;
}

/** เปิดหมอกรอบจุดสังเกต (จำลองว่าผู้เล่นเดินไปสำรวจแล้ว) */
export function explore(s: GameSession, landmarkId: string, radius = 5): void {
  const p = s.landmarkPoints[landmarkId];
  s.fog.reveal(p.x, p.y, radius);
  s.checkLandmarkDiscovery();
}
