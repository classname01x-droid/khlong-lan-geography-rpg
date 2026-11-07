import { esc } from './touch/readerHtml';

/**
 * หีบไม้เก่า (ภาพ placeholder วาดด้วย SVG — ยังไม่ใช่ Pixel Art จริง) พร้อมช่องรหัส 4 ช่อง
 * แสดงเฉพาะรหัสที่ได้แล้ว ('?' = ยังไม่ได้) และไม่บอกว่าในหีบมีอะไร
 */
export function chestSvg(open = false): string {
  const lid = open
    ? '<path d="M6 14 L42 4 L44 10 L8 20 Z" fill="#8a5a2b" stroke="#3b2412" stroke-width="2"/>'
    : '<rect x="4" y="10" width="40" height="12" rx="3" fill="#8a5a2b" stroke="#3b2412" stroke-width="2"/>';
  return (
    `<svg class="ts-chest-svg" viewBox="0 0 48 40" width="56" height="46" role="img" aria-label="หีบไม้เก่า${open ? ' (เปิดแล้ว)' : ''}">` +
    '<rect x="4" y="20" width="40" height="17" rx="2" fill="#a06a35" stroke="#3b2412" stroke-width="2"/>' +
    lid +
    '<rect x="4" y="19" width="40" height="3" fill="#d9a441"/>' +
    '<rect x="20" y="22" width="8" height="8" rx="1" fill="#ffd84d" stroke="#3b2412" stroke-width="1.5"/>' +
    '</svg>'
  );
}

/** ช่องรหัส 4 ช่องบนหีบ */
export function chestSlotsHtml(slots: string[]): string {
  return `<div class="ts-chest-slots" aria-label="ช่องรหัสบนหีบ">${slots
    .map((c, i) => `<span class="ts-slot${c === '?' ? '' : ' ts-slot-on'}" title="ช่องที่ ${i + 1}">${esc(c)}</span>`)
    .join('')}</div>`;
}
