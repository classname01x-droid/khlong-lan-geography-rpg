/**
 * สไตล์หน้าจอนอกด่านบนจอสัมผัส (เมนูหลัก · แผนที่การเดินทาง · ฉากเชื่อมบท · ฉากจบ)
 * รูปแบบ Pixel Art RPG เดิม: ป้ายไม้ (wood) · กระดาษเก่า (paper) · ปุ่มขอบหนาเงาแข็ง
 * ตัวอักษร: เนื้อหา 16 px · หัวข้อ 18–22 px · ข้อความรอง ≥ 14 px · ปุ่ม ≥ 48 px
 * เว้นขอบปลอดภัย (รอยบาก) ด้วยตัวแปร --sa-* จาก MobileLayout.insets
 */
export const SCREEN_CSS = `
.ts-root { position: fixed; inset: 0; z-index: 9; display: none; pointer-events: none; font-family: __FONT__; color: #2b2118;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
.ts-root.ts-on { display: block; }
.ts-root * { box-sizing: border-box; }
.ts-screen { position: absolute; top: var(--sa-t, 0px); right: var(--sa-r, 0px); bottom: var(--sa-b, 0px); left: var(--sa-l, 0px);
  display: flex; flex-direction: column; gap: 8px; padding: 8px; min-height: 0; }
.ts-root [data-act] { pointer-events: auto; cursor: pointer; touch-action: manipulation; }
.ts-scroll { overflow-y: auto; overflow-x: hidden; touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; pointer-events: auto; min-height: 0; }

/* ---------- กรอบ ---------- */
.ts-wood { background: #6b4423; color: #fff6d5; border: 3px solid #2a1a0c; border-radius: 6px;
  box-shadow: inset 0 0 0 3px #8a5a2b, 0 4px 0 #2a1a0c; pointer-events: auto; }
.ts-paper { background: #f3ead2; color: #2b2118; border: 3px solid #4a2f16; border-radius: 6px;
  box-shadow: inset 0 0 0 2px #e8d9a8, 0 4px 0 #2a1a0c; pointer-events: auto; }
.ts-bar { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; padding: 6px 12px; }
.ts-h1 { margin: 0; font-size: 30px; line-height: 1.25; color: #fff6d5; text-shadow: 3px 3px 0 #2a1a0c, -1px -1px 0 #2a1a0c; }
.ts-h2 { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3; color: #fff6d5; text-shadow: 2px 2px 0 #2a1a0c; }
.ts-h3 { margin: 0 0 6px; font-size: 18px; font-weight: 700; line-height: 1.35; color: #5a3a1e; }
.ts-kicker { font-size: 16px; color: #ffd84d; font-weight: 700; }
.ts-sub { font-size: 16px; line-height: 1.4; color: #f3ead2; }
.ts-p { margin: 0 0 6px; font-size: 16px; line-height: 1.55; overflow-wrap: anywhere; }
.ts-small { font-size: 14px; line-height: 1.45; color: #6b5638; }
.ts-ok { color: #2f7a2a; } .ts-warn { color: #a2541e; } .ts-bad { color: #a23b1e; }

/* ---------- ปุ่ม ---------- */
.ts-btn { font: inherit; font-size: 17px; font-weight: 700; color: #2b2118; background: #f3ead2; border: 3px solid #4a2f16; border-radius: 8px;
  box-shadow: 0 4px 0 #4a2f16; min-height: 48px; min-width: 48px; padding: 6px 14px; display: inline-flex; align-items: center;
  justify-content: center; gap: 8px; line-height: 1.2; pointer-events: auto; text-align: center; }
.ts-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #4a2f16; }
.ts-btn.ts-primary { background: #ffd84d; }
.ts-btn.ts-danger { background: #f2b8a6; }
.ts-btn[disabled] { opacity: 0.45; filter: grayscale(0.8); }
.ts-btn .ts-ico { font-size: 20px; line-height: 1; }
.ts-btn .ts-btn-sub { display: block; font-size: 14px; font-weight: 400; color: #6b5638; margin-top: 2px; }
.ts-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.ts-tab { font: inherit; font-size: 15px; font-weight: 700; min-height: 44px; padding: 4px 12px; border-radius: 8px; border: 2px solid #4a2f16;
  background: #e8d9a8; color: #2b2118; pointer-events: auto; }
.ts-tab.ts-on { background: #8a5a2b; color: #fff6d5; }

/* ---------- เมนูหลัก ---------- */
.ts-menu-grid { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 1fr; gap: 10px; align-content: center; justify-items: center; }
.ts-menu.ts-wide .ts-menu-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: center; }
.ts-title { padding: 12px 16px; text-align: center; width: 100%; max-width: 560px; }
.ts-save { margin-top: 8px; font-size: 15px; line-height: 1.4; color: #ffd84d; }
.ts-menu-btns { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 380px; max-height: 100%; padding: 2px 2px 6px; }
.ts-menu-btn { justify-content: flex-start; width: 100%; text-align: left; }
.ts-menu-btn > span:last-child { display: flex; flex-direction: column; }

/* ---------- หน้าต่าง (วิธีเล่น/ตั้งค่า/ยืนยัน) ---------- */
.ts-modal { position: absolute; inset: 0; background: rgba(5, 7, 13, 0.7); display: flex; align-items: center; justify-content: center;
  padding: 6px; pointer-events: auto; }
.ts-panel { width: 100%; max-width: 760px; max-height: 100%; display: flex; flex-direction: column; min-height: 0; }
.ts-panel.ts-narrowpanel { max-width: 460px; }
.ts-panel-head { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 8px 10px; border-bottom: 2px solid #c9b88f; }
.ts-panel-head .ts-h3 { margin: 0; flex: 1 1 auto; }
.ts-panel-body { flex: 1 1 auto; padding: 10px 12px; }
.ts-panel-foot { flex: none; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; padding: 8px 10px; border-top: 2px solid #c9b88f; }
.ts-ctl { display: grid; grid-template-columns: minmax(120px, 0.8fr) 1.6fr; gap: 6px 12px; font-size: 16px; line-height: 1.45; }
.ts-ctl dt { font-weight: 700; color: #a2541e; }
.ts-ctl dd { margin: 0; }
.ts-toggle { width: 100%; justify-content: space-between; margin-bottom: 8px; }

/* ---------- แผนที่การเดินทาง ---------- */
.ts-codes { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 16px; color: #fff6d5; }
.ts-chip { display: inline-block; min-width: 40px; text-align: center; padding: 2px 8px; border-radius: 6px; border: 2px solid #2a1a0c;
  background: #ffd84d; color: #2b2118; font-weight: 700; font-size: 16px; }
.ts-chip.ts-missing { background: #8a7a64; color: #f3ead2; }
.ts-jmain { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(200px, 0.9fr) minmax(0, 1.3fr); gap: 8px; }
.ts-route { display: flex; flex-direction: column; gap: 6px; padding: 2px 4px 6px 2px; }
.ts-node { flex: none; min-height: 52px; justify-content: flex-start; align-items: center; text-align: left; gap: 8px; padding: 4px 10px; font-weight: 400; }
.ts-node-i { flex: none; width: 26px; text-align: center; font-size: 20px; }
.ts-node-t { display: flex; flex-direction: column; min-width: 0; }
.ts-node b { font-size: 16px; line-height: 1.3; }
.ts-node-s { font-size: 14px; line-height: 1.3; color: #6b5638; }
.ts-node.ts-explored { background: #d9efc9; }
.ts-node.ts-explored .ts-node-s { color: #2f7a2a; font-weight: 700; }
.ts-node.ts-current { background: #fff2c4; border-color: #d9822b; box-shadow: 0 0 0 3px #d9822b, 0 4px 0 #4a2f16; }
.ts-node.ts-current .ts-node-s { color: #a2541e; font-weight: 700; }
.ts-node.ts-next, .ts-node.ts-locked { background: #e4dcc6; color: #6b5638; }
.ts-node.ts-sel { outline: 3px dashed #2b2118; outline-offset: 1px; }
.ts-jside { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.ts-detail { flex: 1 1 auto; padding: 10px 12px; }
.ts-foot { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: flex-end; pointer-events: none; }
.ts-go { flex: 1 1 auto; min-width: 180px; font-size: 18px; }
.ts-codes .ts-chip { min-width: 34px; font-size: 15px; padding: 1px 6px; }

/* ---------- ฉากเชื่อมบท ---------- */
.ts-chap-main { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.6fr); grid-template-rows: minmax(0, 1fr); gap: 8px; }
.ts-chapter.ts-narrow .ts-chap-main { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
/* จอเตี้ย: กล่องภารกิจ+หีบสูงเกินแถว → เลื่อนในกล่องเอง ไม่ดันกล่องบทสนทนาเลยขอบจอ */
.ts-goal { padding: 10px 12px; min-height: 0; overflow-y: auto; }
.ts-goal-k { font-size: 15px; font-weight: 700; color: #a2541e; }
.ts-chapter.ts-narrow .ts-goal .ts-p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ts-dlg { display: flex; flex-direction: column; min-height: 0; padding: 10px 14px; }
.ts-speaker { flex: none; font-size: 18px; font-weight: 700; color: #a2541e; margin-bottom: 4px; display: flex; justify-content: space-between; gap: 8px; }
.ts-speaker small { font-size: 14px; font-weight: 400; color: #6b5638; }
.ts-dlg-text { flex: 1 1 auto; font-size: 18px; line-height: 1.6; }

/* ---------- ฉากจบ ---------- */
.ts-codes-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 700; }
.ts-codes-row .ts-chip { font-size: 18px; padding: 3px 12px; }
.ts-end-body { flex: 1 1 auto; padding: 10px 12px; }
.ts-end-cols { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 14px; }
.ts-wisdom { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; margin-bottom: 8px; }
.ts-wcard { border: 2px solid #8a5a2b; border-radius: 6px; padding: 8px 10px; background: #fbf5e4; }
.ts-wcard b { font-size: 16px; }
.ts-skills { display: flex; flex-wrap: wrap; gap: 6px; }
.ts-skill { font-size: 14px; padding: 3px 8px; border-radius: 12px; background: #d9efc9; border: 1px solid #2f7a2a; color: #1f5a1d; }
.ts-more { flex: none; text-align: center; font-size: 14px; color: #fff6d5; text-shadow: 1px 1px 0 #2a1a0c; pointer-events: none; }


/* ---------- จอเตี้ย (≤ 380 px): ปุ่มหลักต้องเห็นครบ — ย่อเฉพาะหัวเรื่อง/ระยะห่าง ไม่ย่อเนื้อหา ---------- */
.ts-short .ts-screen { gap: 6px; padding: 6px; }
.ts-short .ts-h1 { font-size: 24px; }
.ts-short .ts-title { padding: 8px 12px; }
.ts-short .ts-title .ts-sub { font-size: 15px; }
.ts-short .ts-menu-btns { gap: 6px; }
.ts-short .ts-menu-btn { min-height: 44px; padding: 4px 12px; }
.ts-short .ts-menu-btn .ts-btn-sub { font-size: 14px; }
.ts-short .ts-bar { padding: 4px 10px; }
.ts-short .ts-btn { min-height: 44px; }
.ts-short .ts-node { min-height: 48px; }
.ts-short .ts-dlg-text { font-size: 17px; line-height: 1.55; }
.ts-short .ts-goal .ts-p { font-size: 15px; }

/* ---------- คำพิทักษ์ 4 ช่อง ---------- */
.ts-words { margin-top: 6px; }
.ts-words-k { font-size: 14px; font-weight: 700; color: #5a3a1e; }
.ts-words-slots { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.ts-slot { min-width: 36px; min-height: 26px; padding: 1px 6px; border: 2px dashed #8a7a64; border-radius: 6px; font-size: 15px;
  font-weight: 700; text-align: center; color: #8a7a64; background: #fff8e6; }
.ts-slot.ts-slot-on { border-style: solid; border-color: #2f5a25; color: #1f4a17; background: #dff2d2; }
`;
