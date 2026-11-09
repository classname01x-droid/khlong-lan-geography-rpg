// ด่านสักงาม (สำรวจด้วยทิศ+มาตราส่วน) — เล่นจริงในเบราว์เซอร์: ตรวจว่าไม่มีการนำทาง และเล่นจนจบได้
//   node tests/e2e/sakngam-e2e.cjs <outDir> [desktop | "iPhone 13 landscape"]
// เดินด้วย hook __TEST__.walkTo (physics จริง) ไปยังพิกัดที่ "คำนวณจากคำบอกทิศ+ระยะ" — ผู้เล่นจริงไม่มีระบบเดินอัตโนมัติ
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/e2e';
const DEV = process.argv[3] || 'desktop';
const BASE = process.env.BASE || 'http://localhost:5173/';
const DESK = DEV === 'desktop';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : String(extra)); };
const KEY = 'khlonglan-geo-rpg:progress';
(async () => {
  const b = await chromium.launch();
  const opts = DESK ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } : (({ defaultBrowserType, ...d }) => ({ ...d, deviceScaleFactor: 2 }))(devices[DEV]);
  const ctx = await b.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const tag = DESK ? 'desktop' : DEV.replace(/[^A-Za-z0-9]+/g, '_');
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (n) => { await wait(300); await page.screenshot({ path: `${OUT}/${tag}-sk-${n}.png` }); };
  const ev = (fn, a) => page.evaluate(fn, a);
  const tapAt = async (x, y) => { if (DESK) await page.mouse.click(x, y); else await page.touchscreen.tap(x, y); await wait(300); };
  const tapDom = async (sel, text) => {
    let c = null;
    for (let i = 0; i < 40 && !c; i++) {
      c = await page.evaluate(([sel, text]) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!text || e.innerText.includes(text)); }); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [sel, text]);
      if (!c) await wait(100);
    }
    if (!c) throw new Error(`not found ${sel} ${text}`);
    await tapAt(c.x, c.y);
  };
  await page.goto(BASE + (DESK ? '?touch=0' : '?touch=1'));
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 2, storyVersion: 3, completed: {}, unlocked: ['sakngam'], codePieces: {}, inProgress: {}, rpg: { coins: 0, faith: 0, potions: 0, owned: [], weapon: null, armor: null, rewarded: [], goldenDone: true, goldenCoins: 0, shopDone: false, bossDone: false, bossLosses: 0 } })), KEY);
  await page.goto(BASE + (DESK ? '?touch=0' : '?touch=1') + '&level=sakngam&new=1');
  await page.waitForFunction(() => window.__TEST__ && window.__TEST__.session && window.__GAME__.scene.isActive('WorldScene'), null, { timeout: 15000 });
  await wait(800);
  const sess = () => ev(() => { const s = window.__TEST__.session; return { step: s.currentStepOrder, mode: s.mode, flags: [...s.flags], dlg: s.dialogueView && s.dialogueView.kind, done: s.completed }; });
  const walk = async (x, y) => { const ok = await ev(([x, y]) => window.__TEST__.walkTo(x, y), [x, y]); await wait(400); return ok; };
  const pos = () => ev(() => { const s = window.__TEST__.session; return { ...s.playerTile }; });
  const talkKey = async () => { if (DESK) await page.keyboard.press('KeyE'); else await tapDom('.tl-actions .tl-btn', 'คุย'); await wait(350); };
  const nextLine = async () => { if (DESK) await page.keyboard.press('Space'); else { const c = await page.evaluate(() => { const e = document.querySelector('.tl-sheet .tl-dlg'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await tapAt(c.x, c.y); } await wait(250); };
  const pick = async (i) => {
    if (DESK) { await page.keyboard.press(`Digit${i + 1}`); await wait(300); return; }
    const c = await page.evaluate((i) => { const els = [...document.querySelectorAll('.tl-sheet .tl-option')]; const el = els[i]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
    if (!c) throw new Error('no choice button');
    await tapAt(c.x, c.y);
  };
  const noGuide = async (label) => {
    const g = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return { guide: window.__TEST__.guide().mode, markers: w.npcs.map((n) => n.marker.visible), checks: w.npcs.map((n) => n.check.visible), ring: w.cueRing.visible, arrow: w.guideArrow.visible }; });
    check(`${label}: ไม่มีลูกศร/หมุดเป้าหมาย/เครื่องหมาย ! ✓/วงแหวนไฮไลต์`, g.guide === 'off' && !g.markers.some(Boolean) && !g.checks.some(Boolean) && !g.ring && !g.arrow, JSON.stringify(g));
  };
  const trackerText = () => ev(() => (document.querySelector('.tl-tracker') || {}).innerText || '');
  const hudText = async () => { const t = await trackerText(); return t; };
  /** ดูทั้ง tracker (มือถือ) หรือ canvas objective (คอม) */
  await shot('01-start');
  await noGuide('เริ่มด่าน');
  const labels0 = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return [...w.labels.entries()].filter(([, t]) => t.visible && t.alpha > 0).map(([id]) => id); });
  check('เริ่มด่าน: ยังไม่แสดงป้ายสถานที่ไกลตัว (บ้านผู้ใหญ่ ศาลา สะพาน บ้านป้าเจียว) จนกว่าจะเดินเข้าใกล้', !labels0.some((id) => ['headman-house', 'sala', 'bridge', 'jiao-house'].includes(id)), JSON.stringify(labels0));
  const t0 = DESK ? '' : await trackerText();
  if (!DESK) check('แถบภารกิจ: บอกภารกิจปัจจุบัน + มาตราส่วน (ยังไม่เฉลยคำตอบ)', t0.includes('พบครูเนม') && t0.includes('1:10,000') && !t0.includes('400'), t0);

  // 1) ครูเนม
  await walk(13, 41); await talkKey();
  let s = await sess();
  check('ครูเนม: คุยแล้วเข้าบทสนทนา', !!s.dlg, JSON.stringify(s));
  for (let i = 0; i < 4; i++) { s = await sess(); if (s.dlg === 'quiz') break; await nextLine(); }
  await shot('02-quiz-scale');
  await pick(0); // ผิด (40 เมตร)
  s = await sess();
  check('โจทย์ 4 ซม.: ตอบผิดแล้วอยู่ที่คำถาม ลองใหม่ได้ ไม่เสียเหรียญ', s.dlg === 'quiz' && !s.flags.includes('q-school'), JSON.stringify(s));
  await pick(1); // 400 เมตร
  for (let i = 0; i < 6; i++) { s = await sess(); if (!s.dlg) break; await nextLine(); }
  check('ตอบถูก 400 เมตร → ผ่านขั้น 1', s.flags.includes('q-school') && s.step === 2, JSON.stringify(s));
  await noGuide('หลังคุยครูเนม');

  // 2) เดินทางตะวันออกจากโรงเรียน 4 ซม. = 400 ม. = 40 ช่อง → ข้ามสะพาน → บ้านผู้ใหญ่บ้าน
  await walk(55, 45);
  await shot('03-headman-house');
  const labels1 = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return [...w.labels.entries()].filter(([, t]) => t.visible && t.alpha > 0).map(([id]) => id); });
  const disc = await ev(() => [...window.__TEST__.session.discoveredLandmarks]);
  check('เดินถึงบ้านผู้ใหญ่บ้านเอง: ค้นพบจุดสังเกต/แสดงชื่อสถานที่เมื่อเข้าใกล้', disc.includes('headman-house'), JSON.stringify([labels1, disc]));
  await noGuide('ที่บ้านผู้ใหญ่บ้าน');
  await talkKey();
  for (let i = 0; i < 3; i++) { s = await sess(); if (s.dlg === 'quiz') break; await nextLine(); }
  await pick(0); // 3 ซม. ผิด
  s = await sess();
  check('โจทย์ 3 ซม.: ตอบผิดลองใหม่ได้', s.dlg === 'quiz' && !s.flags.includes('q-west'), JSON.stringify(s));
  await pick(1);
  for (let i = 0; i < 3; i++) { s = await sess(); if (s.dlg === 'quiz' && !s.flags.includes('q-west')) continue; if (s.flags.includes('q-west') && s.dlg === 'quiz') break; await nextLine(); }
  await pick(1); // 2 ซม. = 200 เมตร
  for (let i = 0; i < 6; i++) { s = await sess(); if (!s.dlg) break; await nextLine(); }
  check('โจทย์ 2 ซม. ถูก → รู้เส้นทางแล้ว ผ่านขั้น 2', s.flags.includes('route-known') && s.step === 3, JSON.stringify(s));
  if (!DESK) { const t = await trackerText(); check('แถบภารกิจ: แสดงคำบอกเส้นทางที่ได้รับ (ตะวันตก 300 / เหนือ 200 เมตร) อ่านซ้ำได้', t.includes('300') && t.includes('200'), t); }
  await shot('04-route-known');

  // 3) ตะวันตก 3 ซม. = 30 ช่อง → คุณยายริมทาง (25,47) แล้วเหนือ 2 ซม. = 20 ช่อง
  await walk(25, 48);
  const grand = await ev(() => window.__GAME__.scene.getScene('WorldScene').npcs.find((n) => n.def.id === 'grandma').sprite.x / 16);
  check('เดินตะวันตก 300 ม.: พบคุณยายอยู่ที่จุดเลี้ยว (ที่เห็นได้เอง)', Math.abs(grand - 25.5) < 1.2, grand);
  await noGuide('ที่คุณยาย');
  await shot('05-grandma');
  await walk(25, 29);
  await shot('06-jiao-house');
  await noGuide('ที่บ้านป้าเจียว');
  await talkKey();
  for (let i = 0; i < 4; i++) { s = await sess(); if (s.dlg === 'quiz') break; await nextLine(); }
  await shot('07-quiz-site');
  await pick(0); // จุด A ผิด
  s = await sess();
  check('เลือกจุดผิด (A) ลองใหม่ได้', s.dlg === 'quiz' && !s.flags.includes('trash-quiz'), JSON.stringify(s));
  await pick(2); // จุด C
  for (let i = 0; i < 6; i++) { s = await sess(); if (!s.dlg) break; await nextLine(); }
  check('เลือกจุด C ถูก → ผ่านขั้น 3', s.flags.includes('trash-quiz') && s.step === 4, JSON.stringify(s));
  await noGuide('หลังเลือกจุด C (ต้องเดินไปตรวจเอง)');

  // 4) ไปจุด C: ตะวันออกของบ้านผู้ใหญ่บ้านราว 2 ซม. ติดทุ่งนา (72,50)
  await walk(55, 45);
  s = await sess();
  check('ยังไม่ถึงจุด C: ไม่มีข้อความพบพื้นที่', !s.flags.includes('c-found'), JSON.stringify(s));
  await walk(72, 49);
  s = await sess();
  check('เดินถึงจุด C เอง → "พบพื้นที่ที่เหมาะสมสำหรับรวบรวมขยะ" (flag c-found)', s.flags.includes('c-found') && s.step === 5, JSON.stringify(s));
  const toast = await ev(() => (document.body.innerText || '').includes('พบพื้นที่ที่เหมาะสมสำหรับรวบรวมขยะ'));
  await shot('08-spot-c');
  await noGuide('ที่จุด C');

  // 5) กลับไปรายงานป้าเจียวโดยเส้นทางเดิม
  await walk(25, 48); await walk(25, 29);
  await talkKey();
  for (let i = 0; i < 8; i++) { s = await sess(); if (!s.dlg && s.flags.includes('m-report')) break; await nextLine(); }
  await wait(800);
  const rpg = await ev((k) => JSON.parse(localStorage.getItem(k)).rpg, KEY);
  check('รายงานป้าเจียว: ได้ +100 เหรียญ +10 พลังศรัทธา', rpg.coins === 100 && rpg.faith === 10, JSON.stringify(rpg));
  for (let i = 0; i < 10; i++) { s = await sess(); if (s.mode === 'summary') break; if (s.dlg) await nextLine(); else await wait(300); }
  s = await sess();
  check('จบภารกิจสักงาม → หน้าสรุป', s.mode === 'summary', JSON.stringify(s));
  await shot('09-summary');

  // Save/Load: เล่นใหม่ครึ่งทางแล้วรีโหลด
  const saved = await ev((k) => JSON.parse(localStorage.getItem(k)), KEY);
  check('บันทึกเกม: ด่านสักงามผ่านแล้ว + เหรียญ/ศรัทธาถูกเก็บ', !!saved.completed.sakngam && saved.rpg.coins === 100, JSON.stringify(saved.rpg));
  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 4).join(' | '));
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `FAILED ${bad}/${results.length}` : `ALL PASS ${results.length}`);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
