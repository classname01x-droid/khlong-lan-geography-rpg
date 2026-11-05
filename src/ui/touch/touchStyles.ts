/** สไตล์ของชั้นปุ่มสัมผัส/แถบภารกิจ (สีเดียวกับ UI Pixel ในเกม) — __FONT__ ถูกแทนด้วยฟอนต์ของเกม */
export const TOUCH_CSS = `
.tl-root { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: __FONT__;
  color: #f4efe1; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: none; }
.tl-root * { box-sizing: border-box; }
.tl-root > div { display: none; }
.tl-root.tl-ingame > .tl-tracker, .tl-root.tl-ingame > .tl-prompt { display: block; }
.tl-root.tl-touch.tl-ingame > .tl-actions, .tl-root.tl-touch.tl-ingame > .tl-sheet, .tl-root.tl-touch.tl-ingame > .tl-status { display: flex; }
.tl-root.tl-touch.tl-walk > .tl-joyzone { display: block; }
.tl-root > .tl-rotate { pointer-events: auto; }
.tl-root [data-code], .tl-root [data-ui] { pointer-events: auto; cursor: pointer; touch-action: none; }

/* ---------- ปุ่ม ---------- */
.tl-btn { font: inherit; color: #2b2118; background: #f3ead2; border: 3px solid #4a2f16; border-radius: 10px;
  box-shadow: 0 3px 0 #4a2f16; display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: var(--btn, 48px); min-width: var(--btn, 48px); padding: 2px 4px; line-height: 1.15; }
.tl-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #4a2f16; }
.tl-btn[disabled] { opacity: 0.38; filter: grayscale(1); }
.tl-btn .tl-icon { font-size: calc(var(--btn, 48px) * 0.36); line-height: 1; }
.tl-btn .tl-label { font-size: 13px; font-weight: 600; white-space: nowrap; }
.tl-btn.tl-primary { background: #ffd84d; }
.tl-btn.tl-selected { background: #9be08a; border-color: #2f5a25; }

/* ---------- คอลัมน์ปุ่มขวา ---------- */
.tl-actions { position: fixed; flex-wrap: wrap; align-content: flex-end; justify-content: center; gap: 6px; padding: 6px; }
.tl-actions .tl-btn { width: calc(50% - 3px); pointer-events: auto; }
.tl-actions.tl-explore .tl-a-interact { order: 99; width: 100%; min-height: calc(var(--btn, 48px) * 1.35); border-radius: 18px; }
.tl-actions.tl-explore .tl-a-interact .tl-label { font-size: 15px; }
.tl-actions:not(.tl-explore) .tl-btn { width: 100%; flex-direction: row; gap: 6px; }
.tl-actions:not(.tl-explore) { flex-direction: column; flex-wrap: nowrap; justify-content: flex-end; }
.tl-root:not(.tl-columns) .tl-actions .tl-btn { opacity: 0.92; }

/* ---------- จอยสติก ---------- */
.tl-joyzone { position: fixed; pointer-events: auto; touch-action: none; }
.tl-joybase { position: absolute; left: 50%; top: 62%; width: calc(var(--btn, 48px) * 2.3); height: calc(var(--btn, 48px) * 2.3);
  margin: calc(var(--btn, 48px) * -1.15) 0 0 calc(var(--btn, 48px) * -1.15); border-radius: 50%;
  background: rgba(16, 20, 31, 0.45); border: 3px solid rgba(232, 217, 168, 0.75); pointer-events: none; }
.tl-joybase.tl-active { background: rgba(16, 20, 31, 0.6); border-color: #ffd84d; }
.tl-joyknob { position: absolute; left: 50%; top: 50%; width: calc(var(--btn, 48px) * 0.95); height: calc(var(--btn, 48px) * 0.95);
  margin: calc(var(--btn, 48px) * -0.475) 0 0 calc(var(--btn, 48px) * -0.475); border-radius: 50%;
  background: #f3ead2; border: 3px solid #4a2f16; }
.tl-joybase::after { content: 'เดิน'; position: absolute; left: 0; right: 0; bottom: -20px; text-align: center; font-size: 12px; color: #e8d9a8; }

/* ---------- บทสนทนา / แผ่นตัวเลือก ---------- */
.tl-sheet { position: fixed; flex-direction: column; gap: 6px; overflow-y: auto; pointer-events: none; }
.tl-dlg { pointer-events: auto; background: rgba(16, 20, 31, 0.95); border: 3px solid #e8d9a8; border-radius: 10px; padding: 10px 12px; }
.tl-dlg.tl-tap::after { content: 'แตะเพื่อไปต่อ ▶'; display: block; text-align: right; font-size: 12px; color: #b9b3a3; margin-top: 4px; }
.tl-speaker { color: #ffcf70; font-weight: 700; font-size: 15px; margin-bottom: 4px; }
.tl-step { color: #b9b3a3; font-weight: 400; font-size: 12px; }
.tl-text { font-size: 16px; line-height: 1.45; }
.tl-feedback { margin-top: 6px; color: #ff9b8a; font-size: 14px; line-height: 1.4; }
.tl-sheet-title { pointer-events: auto; background: rgba(16, 20, 31, 0.95); border: 2px solid #e8d9a8; border-radius: 8px; padding: 6px 10px; font-size: 15px; color: #ffd84d; }
.tl-options { display: flex; flex-direction: column; gap: 6px; }
.tl-option { flex-direction: row !important; justify-content: flex-start !important; gap: 10px; width: 100%; text-align: left; padding: 6px 12px !important; }
.tl-option .tl-icon { font-size: 18px !important; min-width: 22px; color: #8a5a2b; font-weight: 700; }
.tl-option .tl-label { white-space: normal !important; font-size: 15px !important; }

/* ---------- แถบติดตามภารกิจ ---------- */
.tl-tracker { position: fixed; background: rgba(16, 20, 31, 0.88); border: 2px solid #e8d9a8; border-radius: 10px;
  padding: 6px 9px; font-size: 13px; line-height: 1.35; pointer-events: none; }
.tl-tracker button { pointer-events: auto; }
.tl-tr-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.tl-tr-chapter { color: #ffd84d; font-weight: 700; font-size: 12px; }
.tl-tr-quest { color: #ffcf70; margin-top: 2px; }
.tl-tr-obj { margin-top: 2px; }
.tl-tr-label { color: #b9b3a3; }
.tl-tr-prog { display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: 8px; background: #2f5a25; color: #fff; font-size: 12px; }
.tl-tr-hint { margin-top: 4px; color: #9be08a; }
.tl-tr-list { margin-top: 3px; color: #d8d2c2; font-size: 12px; }
.tl-tr-btns { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.tl-tr-mini, .tl-tr-pill { font: inherit; font-size: 12px; color: #2b2118; background: #e8d9a8; border: 2px solid #4a2f16;
  border-radius: 8px; padding: 2px 8px; min-height: 30px; }
.tl-tr-pill { font-size: 13px; min-height: 36px; }
.tl-compact .tl-tr-obj { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-compact .tl-tr-quest { display: none; }

/* ---------- แถบสถานะ / ข้อความโต้ตอบ ---------- */
.tl-status { position: fixed; flex-direction: column; background: rgba(16, 20, 31, 0.78); border: 2px solid #e8d9a8;
  border-radius: 8px; padding: 4px 8px; font-size: 12px; line-height: 1.35; max-width: 46%; }
.tl-prompt { position: fixed; transform: translate(-50%, -100%); background: rgba(16, 20, 31, 0.92); border: 2px solid #ffd84d;
  border-radius: 999px; padding: 6px 14px; font-size: 15px; color: #ffd84d; white-space: nowrap; }
.tl-key { display: inline-block; margin-left: 6px; padding: 0 6px; border: 1px solid #ffd84d; border-radius: 4px; font-size: 12px; }

/* ---------- แนะนำให้หมุนจอ ---------- */
.tl-rotate { position: fixed; inset: 0; z-index: 20; background: #10141f; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; padding: 24px; gap: 10px; }
.tl-rotate-icon { font-size: 54px; }
.tl-rotate-title { font-size: 20px; color: #ffd84d; font-weight: 700; }
.tl-rotate-sub { font-size: 15px; color: #b9b3a3; }
`;
