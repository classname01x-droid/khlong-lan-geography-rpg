import { buildGridBoard, type GridBoardView } from '../../core/site/gridBoard';
import { buildIntegratedBoard } from '../../core/site/integratedBoard';
import type { GameSession } from '../../core/session/GameSession';

/** กระดานวิเคราะห์ (บท 3: พิกัด · บท 4: หลักฐานรวม) — หัวเรื่องและข้อมูล ใช้ร่วมกันระหว่าง canvas และจอสัมผัส */
export function boardTitle(s: GameSession): string {
  return s.level.integratedSiteAnalysis
    ? 'กระดานวิเคราะห์หลักฐาน — จุดใดตรงกับหลักฐานครบทั้ง 3 ชนิด?'
    : 'กระดานวิเคราะห์พิกัด — จุดใดตรงกับหลักฐานครบทั้ง 3 ชนิด?';
}

export function buildBoardView(s: GameSession): GridBoardView | null {
  return s.level.integratedSiteAnalysis ? buildIntegratedBoard(s) : buildGridBoard(s);
}
