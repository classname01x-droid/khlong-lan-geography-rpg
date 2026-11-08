import { DEFAULT_LEVEL_SKILLS, SKILL_LABEL, type SkillId } from '../../core/mission/skills';
import type { CodePiece } from '../../core/progress/ProgressStore';
import type { GameSession } from '../../core/session/GameSession';
import { fmtDuration, fmtMeters } from '../format';

export interface SummaryView {
  title: string;
  heading: string[];
  stats: string[];
  skills: Array<{ done: boolean; label: string }>;
  reward: string[];
}

/** หน้าสรุปผลเมื่อจบด่าน — ข้อมูลร่วมของ SummaryOverlay (canvas) และหน้าอ่านบนจอสัมผัส */
export function buildSummaryView(s: GameSession, unlockedName: string | null, collected: CodePiece[] = []): SummaryView {
  const sum = s.summary();
  const stats = [
    `ระยะทางเดินทั้งหมด: ${fmtMeters(sum.distanceMeters)}`,
    `เบาะแสที่ค้นพบ: ${sum.cluesFound}/${sum.cluesTotal} · หลักฐาน: ${s.evidence.length}/${s.level.evidence?.length ?? 0}`,
    `จำนวนครั้งที่ตอบผิด: ${sum.mistakes}`,
    `   (${[
      `ปริศนา ${sum.mistakesBy.quiz}`,
      s.level.routeAnalysis ? `เส้นทาง ${sum.mistakesBy.route}` : '',
      s.level.mapComparison ? `เทียบแผนที่ ${sum.mistakesBy.compare}` : '',
      s.level.gridSiteAnalysis ? `วิเคราะห์พิกัด ${sum.mistakesBy.compare}` : '',
      s.level.pinTask ? `ปักหมุด ${sum.mistakesBy.pin}` : '',
    ]
      .filter(Boolean)
      .join(' · ')})`,
    `เวลาที่ใช้: ${fmtDuration(sum.elapsedMs)}`,
    `ภารกิจ: หลัก ${sum.quests.main.done}/${sum.quests.main.total} · รอง ${sum.quests.side.done}/${sum.quests.side.total} · ปริศนา ${sum.quests.mystery.done}/${sum.quests.mystery.total}`,
  ];
  const skills = ((s.level.skills as SkillId[] | undefined) ?? DEFAULT_LEVEL_SKILLS).map((k) => ({
    done: sum.skills.includes(k),
    label: SKILL_LABEL[k],
  }));
  const e = s.level.ending;
  const reward = [
    e?.codePiece ? `ได้รับคำพิทักษ์คำที่ ${e.codePiece.index}/${e.codePiece.total}: "${e.codePiece.value}"  ·  ${e.rewardItem}` : e ? e.rewardItem : '',
    e?.codePiece && collected.length > 0
      ? `คำพิทักษ์ที่สะสม: ${Array.from({ length: e.codePiece.total }, (_, i) => collected.find((c) => c.index === i + 1)?.value ?? '?').join(' · ')}`
      : '',
    unlockedName ? `ปลดล็อก: ${unlockedName}` : '',
  ].filter(Boolean);
  return { title: 'ภารกิจสำเร็จ!', heading: [s.level.tambon, s.level.title], stats, skills, reward };
}
