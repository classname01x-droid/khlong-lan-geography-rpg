import { DEFAULT_LEVEL_SKILLS, SKILL_LABEL, type SkillId } from '../../core/mission/skills';
import type { CodePiece } from '../../core/progress/ProgressStore';
import type { GameSession } from '../../core/session/GameSession';
import { fmtDuration } from '../format';

export interface SummaryView {
  title: string;
  heading: string[];
  stats: string[];
  skills: Array<{ done: boolean; label: string }>;
  reward: string[];
}

/** หน้าสรุปผลเมื่อจบด่าน — ข้อมูลร่วมของ SummaryOverlay (canvas) และหน้าอ่านบนจอสัมผัส */
export function buildSummaryView(s: GameSession, unlockedName: string | null, collected: CodePiece[] = []): SummaryView {
  void collected;
  const sum = s.summary();
  const done = sum.quests.main.done;
  const stats = [
    `ช่วยชาวบ้านสำเร็จ: ${s.level.story.filter((st) => s.isStepComplete(st)).length}/${s.level.story.length} คน`,
    `ตอบผิดแล้วลองใหม่: ${sum.mistakes} ครั้ง`,
    `เวลาที่ใช้: ${fmtDuration(sum.elapsedMs)}`,
  ];
  void done;
  const skills = ((s.level.skills as SkillId[] | undefined) ?? DEFAULT_LEVEL_SKILLS).map((k) => ({
    done: sum.skills.includes(k),
    label: SKILL_LABEL[k],
  }));
  const n = s.level.story.length;
  const reward = [`รางวัลจากชาวบ้าน: +${n * 100} เหรียญ · +${n * 10} ศรัทธา (รับครั้งแรกเท่านั้น)`, unlockedName ? `ต่อไป: ${unlockedName}` : ''].filter(Boolean);
  return { title: 'ภารกิจสำเร็จ!', heading: [s.level.tambon, s.level.title], stats, skills, reward };
}
