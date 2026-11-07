/**
 * สไตล์ของชั้นปุ่มสัมผัส/แถบภารกิจ/หน้าอ่าน (สีเดียวกับ UI Pixel ในเกม) — __FONT__ ถูกแทนด้วยฟอนต์ของเกม
 * หลักการอ่านบนโทรศัพท์: เนื้อหา 16 px, หัวข้อ 17–18 px, ข้อความรองไม่ต่ำกว่า 14 px · ปุ่มแตะสูงอย่างน้อย 40–44 px
 * ไม่ย่อทั้งหน้าต่าง — ใช้แท็บแบ่งหน้า และเลื่อนอ่านในหน้า
 */
export const TOUCH_CSS = `
.tl-root { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: __FONT__;
  color: #f4efe1; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: none;
  -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
.tl-root * { box-sizing: border-box; }
.tl-root > div { display: none; }
.tl-root.tl-ingame > .tl-tracker, .tl-root.tl-ingame > .tl-prompt, .tl-root.tl-ingame > .tl-coach-card { display: block; }
.tl-root.tl-touch.tl-ingame > .tl-actions, .tl-root.tl-touch.tl-ingame > .tl-sheet, .tl-root.tl-touch.tl-ingame > .tl-status,
.tl-root.tl-touch.tl-ingame > .tl-mapbar { display: flex; }
.tl-root.tl-touch.tl-ingame > .tl-mapinfo, .tl-root.tl-touch.tl-ingame > .tl-toast, .tl-root.tl-touch.tl-ingame > .tl-legend { display: block; }
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
.tl-actions .tl-btn { width: calc(50% - 3px); min-width: 0; pointer-events: auto; }
.tl-actions.tl-explore .tl-a-interact { order: 99; width: 100%; min-height: calc(var(--btn, 48px) * 1.35); border-radius: 18px; }
.tl-actions.tl-explore .tl-a-interact .tl-label { font-size: 15px; }
.tl-actions:not(.tl-explore) .tl-btn { width: 100%; flex-direction: row; gap: 6px; }
.tl-actions:not(.tl-explore) .tl-btn.tl-half { width: calc(50% - 3px); flex-direction: column; gap: 0; }
.tl-actions:not(.tl-explore) .tl-btn .tl-label { white-space: normal; text-align: center; }
.tl-root:not(.tl-columns) .tl-actions .tl-btn { opacity: 0.94; }
.tl-narrowcol .tl-actions:not(.tl-explore) .tl-btn { flex-direction: column; gap: 0; }
.tl-narrowcol .tl-actions:not(.tl-explore) .tl-btn .tl-icon { font-size: 18px; }

/* ---------- จอยสติก ---------- */
.tl-joyzone { position: fixed; pointer-events: auto; touch-action: none; }
.tl-joybase { position: absolute; left: 50%; top: 62%; width: var(--joy, 110px); height: var(--joy, 110px);
  margin: calc(var(--joy, 110px) * -0.5) 0 0 calc(var(--joy, 110px) * -0.5); border-radius: 50%;
  background: rgba(16, 20, 31, 0.45); border: 3px solid rgba(232, 217, 168, 0.75); pointer-events: none; }
.tl-joybase.tl-active { background: rgba(16, 20, 31, 0.6); border-color: #ffd84d; }
.tl-joyknob { position: absolute; left: 50%; top: 50%; width: calc(var(--joy, 110px) * 0.41); height: calc(var(--joy, 110px) * 0.41);
  margin: calc(var(--joy, 110px) * -0.205) 0 0 calc(var(--joy, 110px) * -0.205); border-radius: 50%;
  background: #f3ead2; border: 3px solid #4a2f16; }
.tl-joybase::after { content: 'เดิน'; position: absolute; left: 0; right: 0; bottom: -20px; text-align: center; font-size: 12px; color: #e8d9a8; }

/* ---------- บทสนทนา / แผ่นตัวเลือก ---------- */
.tl-sheet { position: fixed; flex-direction: column; gap: 6px; overflow-y: auto; pointer-events: auto; touch-action: pan-y;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.tl-dlg { pointer-events: auto; background: rgba(16, 20, 31, 0.95); border: 3px solid #e8d9a8; border-radius: 10px; padding: 10px 12px; }
.tl-dlg.tl-tap::after { content: 'แตะเพื่อไปต่อ ▶'; display: block; text-align: right; font-size: 13px; color: #b9b3a3; margin-top: 4px; }
.tl-speaker { color: #ffcf70; font-weight: 700; font-size: 16px; margin-bottom: 4px; }
.tl-step { color: #b9b3a3; font-weight: 400; font-size: 13px; }
.tl-text { font-size: 17px; line-height: 1.5; }
.tl-feedback { margin-top: 6px; color: #ff9b8a; font-size: 15px; line-height: 1.45; }
.tl-sheet-title { pointer-events: auto; background: rgba(16, 20, 31, 0.95); border: 2px solid #e8d9a8; border-radius: 8px; padding: 6px 10px; font-size: 16px; color: #ffd84d; }
.tl-options { display: flex; flex-direction: column; gap: 6px; }
.tl-option { flex-direction: row !important; justify-content: flex-start !important; gap: 10px; width: 100%; text-align: left; padding: 6px 12px !important; }
.tl-option .tl-icon { font-size: 18px !important; min-width: 22px; color: #8a5a2b; font-weight: 700; }
.tl-option .tl-label { white-space: normal !important; font-size: 16px !important; }

/* ---------- หน้าอ่านตัวอักษรใหญ่ (สมุด กระดานวิเคราะห์ หลักฐาน สรุป เมนู) ---------- */
.tl-reader { position: fixed; display: none; flex-direction: column; pointer-events: auto; border-radius: 12px; overflow: hidden;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.55); z-index: 1; }
.tl-reader.tl-paper { background: #f3ead2; color: #2b2118; border: 3px solid #8a6d3b; }
.tl-reader.tl-dark { background: #10141f; color: #f4efe1; border: 3px solid #e8d9a8; }
.tl-reader.tl-narrow { height: auto; }
.tl-rd-head { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 6px 10px 6px; border-bottom: 2px solid rgba(138, 109, 59, 0.45); }
.tl-rd-title { font-size: 17px; font-weight: 700; line-height: 1.3; }
.tl-paper .tl-rd-title { color: #5a3a1e; }
.tl-dark .tl-rd-title { color: #ffd84d; }
.tl-rd-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.tl-tab { font: inherit; font-size: 15px; font-weight: 600; min-height: 40px; padding: 4px 12px; border-radius: 10px;
  border: 2px solid #8a6d3b; background: transparent; color: inherit; }
.tl-tab.tl-tab-on { background: #8a6d3b; color: #fff6d5; }
.tl-dark .tl-tab { border-color: #e8d9a8; }
.tl-dark .tl-tab.tl-tab-on { background: #e8d9a8; color: #10141f; }
.tl-rd-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 8px 12px 12px;
  touch-action: pan-y; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; -webkit-user-select: text; user-select: text; }
.tl-narrow .tl-rd-body { flex: none; }
.tl-rd-more { flex: none; display: none; text-align: center; font-size: 14px; padding: 2px; pointer-events: none; }
.tl-paper .tl-rd-more { color: #7a6448; background: #eadfc2; }
.tl-dark .tl-rd-more { color: #ffd84d; background: #1b2233; }
.tl-rd-foot { flex: none; padding: 6px 10px 8px; border-top: 2px solid rgba(138, 109, 59, 0.35); }
.tl-ln { margin: 0 0 4px; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; }
.tl-ln.tl-heading { font-size: 17px; font-weight: 700; margin-top: 4px; }
.tl-ln.tl-note { font-size: 14.5px; }
.tl-foot-text { font-size: 15px; margin: 0; }
.tl-sec { margin-bottom: 10px; }
.tl-sec h3 { font-size: 17px; margin: 4px 0 6px; color: #ffcf70; }
.tl-paper .tl-sec h3 { color: #5a3a1e; }
.tl-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tl-card { border: 2px solid #6f6a5c; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; background: #161c2b; }
.tl-card .tl-ln { font-size: 15px; }
.tl-card-h { font-size: 16px; font-weight: 700; color: #ffcf70; margin-bottom: 2px; }
.tl-card-sel { border-color: #ffd84d; background: #2a2a18; }
.tl-card-sel .tl-card-h { color: #ffd84d; }
.tl-card-dim .tl-ln { color: #b9b3a3; }
.tl-ok { color: #9be08a; }
.tl-bad { color: #ff9b8a; }
.tl-warn, .tl-accent { color: #ffd84d; }
.tl-muted { color: #b9b3a3; }
.tl-rd-choices { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.tl-rd-choices .tl-btn { min-height: 44px; }
.tl-pause .tl-btn { min-height: 52px; }

/* ---------- แถบหัวแผนที่ / สถานะหมุด ---------- */
.tl-mapbar { position: fixed; align-items: center; gap: 10px; padding: 4px 10px; background: rgba(16, 20, 31, 0.94);
  border-bottom: 2px solid #e8d9a8; pointer-events: none; }
.tl-mb-main { flex: 1 1 auto; min-width: 0; }
.tl-mb-title { font-size: 16px; font-weight: 700; color: #ffd84d; line-height: 1.3; }
.tl-mb-info { font-size: 13.5px; line-height: 1.3; color: #f4efe1; }
.tl-mb-scale { flex: none; display: flex; flex-direction: column; align-items: flex-start; font-size: 13px; gap: 2px; }
.tl-mb-north { flex: none; font-size: 13px; color: #ffd84d; text-align: center; line-height: 1.1; }
.tl-mapbar .tl-rd-tabs { margin-top: 3px; }
.tl-mapbar .tl-tab { font-size: 14px; min-height: 38px; border-color: #e8d9a8; }
.tl-mapbar .tl-tab.tl-tab-on { background: #e8d9a8; color: #10141f; }
.tl-mapinfo { position: fixed; padding: 5px 10px; font-size: 15px; line-height: 1.4; background: rgba(16, 20, 31, 0.92);
  border-top: 2px solid #e8d9a8; pointer-events: none; }
.tl-sb { display: inline-block; height: 7px; border: 2px solid #f4efe1;
  background: repeating-linear-gradient(90deg, #f4efe1 0 25%, #10141f 25% 50%); vertical-align: middle; }

/* ---------- แผงคำอธิบายสัญลักษณ์แผนที่ ---------- */
.tl-legend { position: fixed; background: rgba(16, 20, 31, 0.95); border: 2px solid #e8d9a8; border-radius: 10px; padding: 6px 10px;
  overflow-y: auto; pointer-events: auto; touch-action: pan-y; overscroll-behavior: contain; max-width: 60%; }
.tl-lg-title { font-size: 15px; font-weight: 700; color: #ffd84d; margin-bottom: 4px; }
.tl-lg-row { display: flex; align-items: center; gap: 8px; font-size: 15px; line-height: 1.3; margin: 3px 0; }
.tl-lg-row img { width: 28px; height: 28px; image-rendering: pixelated; flex: none; border-radius: 4px; }

/* ---------- แถบติดตามภารกิจ ---------- */
.tl-tracker { position: fixed; background: rgba(16, 20, 31, 0.9); border: 2px solid #e8d9a8; border-radius: 10px;
  padding: 6px 9px; font-size: 14px; line-height: 1.38; pointer-events: none; overflow: hidden; }
.tl-tracker button { pointer-events: auto; }
.tl-tr-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.tl-tr-chapter { color: #ffd84d; font-weight: 700; font-size: 13px; }
.tl-tr-quest { color: #ffcf70; margin-top: 2px; }
.tl-tr-obj { margin-top: 2px; }
.tl-tr-label { color: #b9b3a3; }
.tl-tr-prog { display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: 8px; background: #2f5a25; color: #fff; font-size: 13px; }
.tl-tr-hint { margin-top: 4px; color: #9be08a; }
.tl-tr-list { margin-top: 3px; color: #d8d2c2; font-size: 13px; }
.tl-tr-btns { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.tl-tr-mini, .tl-tr-pill { font: inherit; font-size: 13px; color: #2b2118; background: #e8d9a8; border: 2px solid #4a2f16;
  border-radius: 8px; padding: 2px 8px; min-height: 36px; }
.tl-tr-pill { font-size: 14px; min-height: 40px; max-width: 100%; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.tl-tr-pill-k { flex: none; font-weight: 700; }
.tl-tr-pill-o { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* จอเตี้ย: ภารกิจ 1 บรรทัด · เป้าหมาย 2 บรรทัด · คำแนะนำ 2 บรรทัด (เปิด "รายละเอียด" เพื่ออ่านเต็ม) */
.tl-compact .tl-tracker:not(.tl-tr-open) .tl-tr-quest { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-compact .tl-tracker:not(.tl-tr-open) .tl-tr-obj,
.tl-compact .tl-tracker:not(.tl-tr-open) .tl-tr-hint { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tl-tr-new { color: #10141f; background: #9be08a; border-radius: 6px; padding: 1px 8px; margin-bottom: 3px; font-weight: 700; font-size: 14px; }
.tl-tracker.tl-tr-flash { border-color: #9be08a; box-shadow: 0 0 0 2px rgba(155, 224, 138, 0.5); }

/* ---------- แถบสถานะ (เข็มทิศ + ตำแหน่ง + ระยะ + แถบมาตราส่วน) ---------- */
.tl-status { position: fixed; align-items: flex-start; gap: 6px; background: rgba(16, 20, 31, 0.82); border: 2px solid #e8d9a8;
  border-radius: 8px; padding: 4px 8px 5px 5px; font-size: 13px; line-height: 1.35; overflow: hidden; }
.tl-compass { flex: none; width: 38px; height: 38px; margin-top: 2px; }
.tl-st-lines { min-width: 0; }
.tl-st-lines > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-scalebar { display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 12.5px; }
.tl-status.tl-tight { font-size: 12px; }
.tl-status.tl-tight .tl-st-extra { display: none; }
.tl-status.tl-tight .tl-compass { width: 30px; height: 30px; }
.tl-prompt { position: fixed; transform: translate(-50%, -100%); background: rgba(16, 20, 31, 0.92); border: 2px solid #ffd84d;
  border-radius: 999px; padding: 6px 14px; font-size: 15px; color: #ffd84d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-key { display: inline-block; margin-left: 6px; padding: 0 6px; border: 1px solid #ffd84d; border-radius: 4px; font-size: 12px; }

/* ---------- ข้อความแจ้งเตือน ---------- */
.tl-toast { position: fixed; transform: translate(-50%, 0); background: rgba(16, 20, 31, 0.94); border: 2px solid #ffd84d;
  border-radius: 10px; padding: 8px 14px; font-size: 16px; line-height: 1.4; color: #ffd84d; text-align: center;
  pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 2; }
.tl-toast.tl-show { opacity: 1; }

/* ---------- แนะนำให้หมุนจอ ---------- */
.tl-rotate { position: fixed; inset: 0; z-index: 20; background: #10141f; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; padding: 24px; gap: 10px; }
.tl-rotate-icon { font-size: 54px; }
.tl-rotate-title { font-size: 20px; color: #ffd84d; font-weight: 700; }
.tl-rotate-sub { font-size: 15px; color: #b9b3a3; }

/* ---------- เป้าหมายโต้ตอบในระยะ: ปุ่ม "คุย/สำรวจ" เด่นขึ้น ---------- */
@keyframes tlReady { 0%, 100% { box-shadow: 0 3px 0 #4a2f16, 0 0 0 0 rgba(255, 216, 77, 0.85); } 50% { box-shadow: 0 3px 0 #4a2f16, 0 0 0 5px rgba(255, 216, 77, 0.35); } }
.tl-actions.tl-explore .tl-a-interact:not([disabled]) { animation: tlReady 1.3s ease-in-out infinite; }

/* ---------- บทแนะนำผู้เล่นใหม่ ---------- */
.tl-coach-card { position: fixed; z-index: 3; background: #f3ead2; color: #2b2118; border: 3px solid #4a2f16; border-radius: 12px;
  box-shadow: 0 3px 0 #4a2f16, 0 0 0 3px rgba(255, 216, 77, 0.7); padding: 6px 10px 8px; font-size: 16px; line-height: 1.45;
  overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; }
.tl-co-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tl-co-step { font-size: 14px; font-weight: 700; color: #7a4e14; white-space: nowrap; }
.tl-co-title { font-size: 18px; flex: 1 1 auto; white-space: nowrap; }
.tl-co-skip { font: inherit; font-size: 14px; color: #4a2f16; background: #e2d4b0; border: 2px solid #4a2f16; border-radius: 8px;
  min-height: 44px; min-width: 44px; padding: 2px 10px; margin-left: auto; }
.tl-co-skip.tl-armed { background: #f08a5d; color: #1b1b24; }
.tl-co-text { margin-top: 2px; }
.tl-co-k { display: inline-block; background: #ffd84d; border: 2px solid #4a2f16; border-radius: 6px; padding: 0 6px; margin: 1px 0;
  font-weight: 700; line-height: 1.3; }
.tl-co-prog { margin-top: 4px; font-size: 15px; font-weight: 700; color: #2f5a25; }
.tl-co-go { font: inherit; font-size: 17px; font-weight: 700; width: 100%; min-height: 48px; margin-top: 6px; color: #2b2118;
  background: #ffd84d; border: 3px solid #4a2f16; border-radius: 10px; box-shadow: 0 3px 0 #4a2f16; }
.tl-coach-card.tl-co-compact { padding: 4px 10px 6px; }
.tl-coach-card.tl-co-compact .tl-co-title { display: none; }
.tl-coach-card .tl-co-skip, .tl-coach-card .tl-co-go { pointer-events: auto; }
.tl-coach-card { pointer-events: none; }
/* ส่วนที่บทแนะนำชี้: กรอบเหลืองกะพริบ + ป้าย "แตะ" */
@keyframes tlCoach { 0%, 100% { outline-color: rgba(255, 216, 77, 1); outline-offset: 2px; } 50% { outline-color: rgba(255, 216, 77, 0.3); outline-offset: 6px; } }
.tl-btn.tl-coach { position: relative; outline: 4px solid #ffd84d; animation: tlCoach 1s ease-in-out infinite; z-index: 1; }
.tl-btn.tl-coach::after { content: 'แตะ'; position: absolute; top: -12px; right: -6px; background: #d94b4b; color: #fff; font-size: 14px;
  font-weight: 700; line-height: 1; padding: 3px 6px 2px; border-radius: 999px; border: 2px solid #fff; }
.tl-joyzone.tl-coach .tl-joybase { border-color: #ffd84d; outline: 4px solid #ffd84d; animation: tlCoach 1s ease-in-out infinite; }
.tl-joyzone.tl-coach .tl-joybase::after { content: 'ลากนิ้วที่นี่'; font-size: 14px; font-weight: 700; color: #ffd84d; bottom: -22px; }
.tl-status.tl-coach, .tl-tracker.tl-coach { outline: 4px solid #ffd84d; animation: tlCoach 1s ease-in-out infinite; }

/* แถบคำแนะนำสั้นขณะเปิดแผนที่/สมุด — ไม่บังเนื้อหา */
.tl-coach-card.tl-co-strip { padding: 4px 8px 6px; font-size: 15px; line-height: 1.4; }
.tl-coach-card.tl-co-col .tl-co-step { display: block; font-size: 14px; }
.tl-coach-card.tl-co-col .tl-co-text { display: block; }
.tl-coach-card.tl-co-bar { padding: 1px 10px; font-size: 14px; line-height: 1.35; border-width: 2px; border-radius: 8px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 0 0 2px rgba(255, 216, 77, 0.7); }
.tl-coach-card.tl-co-bar .tl-co-step { margin-right: 8px; }
.tl-coach-card.tl-co-bar .tl-co-k { padding: 0 5px; border-width: 1px; line-height: 1.2; margin: 0; }
`;
