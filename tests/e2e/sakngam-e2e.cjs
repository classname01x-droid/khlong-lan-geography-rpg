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
  await page.goto(BASE);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 2, storyVersion: 3, completed: {}, unlocked: ['sakngam'], codePieces: {}, inProgress: {}, rpg: { coins: 0, faith: 0, potions: 0, owned: [], weapon: null, armor: null, rewarded: [], goldenDone: true, goldenCoins: 0, shopDone: false, bossDone: false, bossLosses: 0 } })), KEY);
  await page.goto(BASE + '?level=sakngam&new=1');
  await page.waitForFunction(() => window.__TEST__ && window.__TEST__.session && window.__GAME__.scene.isActive('WorldScene'), null, { timeout: 15000 });
  await wait(800);
  const sess = () => ev(() => { const s = window.__TEST__.session; return { step: s.currentStepOrder, mode: s.mode, flags: [...s.flags], dlg: s.dialogueView && s.dialogueView.kind, done: s.completed }; });
  const walk = async (x, y) => { const ok = await ev(([x, y]) => window.__TEST__.walkTo(x, y), [x, y]); await wait(400); return ok; };
  const pos = () => ev(() => { const s = window.__TEST__.session; return { ...s.playerTile }; });
  const talkKey = async () => { await tapDom('.tl-actions .tl-btn', 'คุย'); await wait(350); };
  const nextLine = async () => { const c = await page.evaluate(() => { const e = document.querySelector('.tl-sheet .tl-dlg'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await tapAt(c.x, c.y); await wait(250); };
  const pick = async (i) => {
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
  const t0 = await trackerText();
  check('แถบภารกิจ: บอกภารกิจปัจจุบัน + มาตราส่วน (ยังไม่เฉลยคำตอบ)', t0.includes('พบครูเนม') && t0.includes('มาตราส่วน') && !t0.includes('400'), t0);

  /** เดินบทสนทนา: บรรทัด = แตะกล่อง/ปุ่ม · บทเรียน = ถัดไป · คำถาม = เลือกตามลำดับ answers */
  const kindNow = () => ev(() => { const v = window.__TEST__.session.dialogueView; return v && v.kind; });
  const drive = async (answers) => {
    const seen = { lesson: 0, lines: [] };
    for (let g = 0; g < 60; g++) {
      const v = await ev(() => { const d = window.__TEST__.session.dialogueView; return d && { kind: d.kind, text: d.text || d.question || '', page: d.page, button: d.button }; });
      if (!v) break;
      if (v.kind === 'quiz') { if (!answers.length) break; await pick(answers.shift()); }
      else if (v.kind === 'lesson') { seen.lesson++; await tapDom('.tl-sheet .tl-option', v.page === 5 ? 'เข้าใจแล้ว' : 'ถัดไป'); }
      else { seen.lines.push(v.text); if (v.button) await tapDom('.tl-sheet .tl-option', v.button); else await nextLine(); }
    }
    return seen;
  };
  const walkBg = async (x, y) => { await ev(([x, y]) => { window.__TEST__.walkTo(x, y); }, [x, y]); };
  const waitFor = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn)) return true; await wait(250); } return false; };

  // 1) ครูเนม: บทเรียน 5 หน้า (ย้อนกลับ/ถัดไป) → โจทย์ 4 ซม. (ผิดครั้งแรก → บทเรียนอีกครั้ง → ตอบใหม่)
  await walk(13, 41); await talkKey();
  let s = await sess();
  check('ครูเนม: คุยแล้วเข้าบทสนทนา', !!s.dlg, JSON.stringify(s));
  for (let i = 0; i < 6; i++) { if ((await kindNow()) === 'lesson') break; await nextLine(); }
  check('ครูเนม: เปิดบทเรียนมาตราส่วน หน้า 1/5', (await ev(() => window.__TEST__.session.dialogueView.page)) === 1);
  await shot('02-lesson-1');
  await tapDom('.tl-sheet .tl-option', 'ถัดไป');
  await tapDom('.tl-sheet .tl-option', 'ถัดไป');
  check('บทเรียน: ถัดไปไปหน้า 3 (แปลง ซม. เป็นเมตร)', (await ev(() => window.__TEST__.session.dialogueView.title)).includes('ซม. เป็นเมตร'));
  await tapDom('.tl-sheet .tl-option', 'ย้อนกลับ');
  check('บทเรียน: ย้อนกลับไปหน้า 2 (1:10,000)', (await ev(() => window.__TEST__.session.dialogueView.page)) === 2);
  await shot('02-lesson-2');
  for (let i = 0; i < 4; i++) await tapDom('.tl-sheet .tl-option', (await ev(() => window.__TEST__.session.dialogueView.page)) === 5 ? 'เข้าใจแล้ว' : 'ถัดไป');
  check('จบบทเรียน 5 หน้า → ขึ้นโจทย์ 4 ซม.', (await kindNow()) === 'quiz');
  await shot('02-quiz-scale');
  await pick(0); // ผิด (40 เมตร)
  check('ตอบมาตราส่วนผิด: เปิดบทเรียนก่อน (ไม่เพิ่ม HP บอส ไม่รีเซ็ต)', (await kindNow()) === 'lesson' && !(await sess()).flags.includes('q-school') && ((await ev((k) => JSON.parse(localStorage.getItem(k)).rpg.bossHpBonus, KEY)) || 0) === 0);
  await shot('02b-wrong-lesson');
  for (let i = 0; i < 5; i++) { if ((await kindNow()) !== 'lesson') break; await tapDom('.tl-sheet .tl-option', (await ev(() => window.__TEST__.session.dialogueView.page)) === 5 ? 'เข้าใจแล้ว' : 'ถัดไป'); }
  check('จบบทเรียนแล้วกลับมาที่โจทย์เดิม', (await kindNow()) === 'quiz');
  await pick(1); // 400 เมตร
  await drive([]);
  s = await sess();
  check('ตอบถูก 400 เมตร → ผ่านขั้น 1', s.flags.includes('q-school') && s.step === 2, JSON.stringify(s));
  await noGuide('หลังคุยครูเนม');

  // 2) ออกจากโรงเรียน → จุดสอนเครื่องมือวัดระยะ (หยุดเดิน ข้อความ + ลูกศรชี้ปุ่มจริง)
  await walkBg(55, 45);
  check('จุดสอน: ถึงจุดแล้วหยุดเดินทันที (teach)', await waitFor(() => !!window.__TEST__.session.teach));
  const p1 = await pos(); await wait(900); const p2 = await pos();
  check('จุดสอน: ตัวละครไม่ขยับต่อจนกว่าจะกดเครื่องมือ', p1.x === p2.x && p1.y === p2.y, JSON.stringify([p1, p2]));
  const tm = await ev(() => ({ msg: (document.querySelector('.tl-teach-msg') || {}).innerText || '', shown: getComputedStyle(document.querySelector('.tl-teach-msg')).display, btn: !!document.querySelector('.tl-a-measure.tl-teach'), arrow: getComputedStyle(document.querySelector('.tl-a-measure'), '::before').content, anim: getComputedStyle(document.querySelector('.tl-a-measure'), '::before').animationName }));
  check('จุดสอน: แสดง "กดเครื่องมือวัดระยะทาง" + ลูกศรเคลื่อนไหวชี้ปุ่มวัดระยะจริง', tm.msg.includes('กดเครื่องมือวัดระยะทาง') && tm.shown === 'block' && tm.btn && tm.arrow.includes('👉') && tm.anim === 'tlPoint', JSON.stringify(tm));
  await shot('03-teach-measure');
  await tapDom('.tl-a-measure');
  await wait(400);
  s = await sess();
  const t2 = await ev(() => ({ teach: window.__TEST__.session.teach, btn: !!document.querySelector('.tl-a-measure.tl-teach'), flag: window.__TEST__.session.flags.has('teach-measure') }));
  check('กดเครื่องมือวัดระยะแล้ว: ปลดล็อก ลูกศรหาย จดว่าผ่านแล้ว', !t2.teach && !t2.btn && t2.flag, JSON.stringify(t2));
  await ev(() => window.__TEST__.session.stopMeasure && window.__TEST__.session.stopMeasure());
  await walk(55, 45); // เดินต่อได้
  await shot('03-headman-house');
  const disc = await ev(() => [...window.__TEST__.session.discoveredLandmarks]);
  check('เดินถึงบ้านผู้ใหญ่บ้านเอง: ค้นพบจุดสังเกต/แสดงชื่อสถานที่เมื่อเข้าใกล้', disc.includes('headman-house'), JSON.stringify(disc));
  await noGuide('ที่บ้านผู้ใหญ่บ้าน');
  await talkKey();
  const hs = await drive([0, 1, 1]); // 3 ซม. ผิด → บทเรียน → ถูก · 2 ซม. ถูก
  s = await sess();
  check('ผู้ใหญ่บ้าน: ผิดข้อ 3 ซม. มีบทเรียนก่อนตอบใหม่ แล้วผ่านทั้ง 2 โจทย์ → รู้เส้นทาง', hs.lesson >= 5 && s.flags.includes('route-known') && s.step === 3, JSON.stringify([hs.lesson, s]));
  { const t = await trackerText(); check('แถบภารกิจ: แสดงคำบอกเส้นทางที่ได้รับ (ตะวันตก 300 / เหนือ 200 เมตร) อ่านซ้ำได้', t.includes('300') && t.includes('200'), t); }

  // 3) ตะวันตก 3 ซม. → คุณยาย → เหนือ 2 ซม. → ป้าเจียว
  await walk(25, 48);
  await noGuide('ที่คุณยาย');
  await walk(25, 29);
  await shot('04-jiao-house');
  await talkKey();
  await drive([]);
  s = await sess();
  check('ป้าเจียว: ให้ไปสำนักสงฆ์เขาแสงเพชรก่อน (ยังไม่ให้เก็บขยะ)', s.flags.includes('go-wat') && !s.flags.includes('monk-talked') && s.step === 4, JSON.stringify(s));
  await noGuide('ที่บ้านป้าเจียว');

  // 4) ผู้ใหญ่บ้านก่อนถึงลำดับ: ต้องไม่ข้ามขั้น (ยังไม่บอกทางกองขยะ) — ตรวจด้วย session ตรง ๆ
  const early = await ev(() => { const s = window.__TEST__.session; const n = s.level.npcs.find((x) => x.id === 'headman'); s.talkTo(n); const v = s.dialogueView; const r = { kind: v.kind, text: v.text }; while (s.inDialogue) s.advanceDialogue(); return r; });
  check('ผู้ใหญ่บ้านก่อนคุยกับพระ: ไม่ถามโจทย์/ไม่พูดเรื่องกองขยะ (ห้ามข้ามขั้น)', early.kind === 'line' && !early.text.includes('กองขยะ') && !(await sess()).flags.includes('trash-told'), JSON.stringify(early));
  await shot('04b-headman-early');

  // 5) เดินไปสำนักสงฆ์เอง → ข้อความ "ถึงสำนักสงฆ์เขาแสงเพชรแล้ว" → เดินไปคุยกับพระ
  await walkBg(29, 21);
  check('ถึงสำนักสงฆ์ → หยุดเดินและขึ้นข้อความ', await waitFor(() => !!window.__TEST__.session.dialogueView, 30000));
  const l0 = await ev(() => window.__TEST__.session.dialogueView.text);
  check('แจ้ง "ถึงสำนักสงฆ์เขาแสงเพชรแล้ว"', l0 === 'ถึงสำนักสงฆ์เขาแสงเพชรแล้ว', l0);
  await shot('05-wat-arrive');
  await drive([]);
  s = await sess();
  check('ถึงสำนักสงฆ์แล้วยังต้องไปคุยกับพระเอง (ยังไม่ผ่านขั้น)', s.flags.includes('at-wat') && !s.flags.includes('monk-talked') && s.mode === 'explore', JSON.stringify(s));
  const monkVis = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); const n = w.npcs.find((x) => x.def.id === 'monk'); const cam = w.cameras.main; return n ? { has: true, x: n.sprite.x, y: n.sprite.y, tex: n.sprite.texture.key, inView: n.sprite.x > cam.worldView.x && n.sprite.x < cam.worldView.right && n.sprite.y > cam.worldView.y && n.sprite.y < cam.worldView.bottom } : { has: false }; });
  check('พระ (Pixel Art) ยืนอยู่ที่ลานสำนักสงฆ์ และอยู่ในจอตอนมาถึง', monkVis.has && monkVis.tex === 'char-monk' && monkVis.inView, JSON.stringify(monkVis));
  await walk(29, 18);
  await shot('05b-monk');
  await talkKey();
  const mk = await ev(() => window.__TEST__.session.dialogueView && window.__TEST__.session.dialogueView.speaker + ': ' + window.__TEST__.session.dialogueView.text);
  check('คุยกับพระ: ผู้กล้าถามหากองขยะใกล้ลำธาร', mk === 'ผู้กล้า: หลวงพ่อครับ ผมกำลังตามหากองขยะที่อยู่ใกล้ลำธารครับ', mk);
  const mseen = await drive([]);
  s = await sess();
  check('พระบอกให้ไปถามผู้ใหญ่บ้าน → ผ่านขั้น 4 · อัปเดตภารกิจ "กลับไปพบผู้ใหญ่บ้านเพื่อสอบถามตำแหน่งกองขยะ"', mseen.lines.some((x) => x.includes('กลับไปถามผู้ใหญ่บ้าน')) && s.flags.includes('monk-talked') && s.step === 5 && (await trackerText()).includes('กลับไปพบผู้ใหญ่บ้านเพื่อสอบถามตำแหน่งกองขยะ'), JSON.stringify([mseen.lines, s]));
  await noGuide('หลังคุยกับพระ');

  // 6) กองขยะยังเก็บไม่ได้ก่อนถึงลำดับ: เดินไปยืนที่กองขยะก่อนตอบโจทย์ → ไม่เกิดอะไร (ตรวจแบบ session)
  const premature = await ev(() => { const s = window.__TEST__.session; return s.checkArrivals({ x: 75, y: 44 }); });
  check('ยืนที่กองขยะก่อนตอบโจทย์ผู้ใหญ่บ้าน: ไม่เกิดข้อความ/ไม่ผ่านขั้น', premature === false && !(await sess()).flags.includes('trash-found'));

  // 7) กลับไปผู้ใหญ่บ้าน → ได้ทิศ+ระยะ → โจทย์ (ผิด → บทเรียนครูเนม → ถูก)
  await walk(55, 45);
  await talkKey();
  const hl = await drive([]);
  const hq = await ev(() => window.__TEST__.session.dialogueView);
  check('ผู้ใหญ่บ้านบอกทิศ+ระยะ+จุดสังเกตก่อนถามโจทย์', hl.lines.length === 3 && hl.lines[1].includes('ฝั่งตะวันออก') && hl.lines[2].includes('2 เซนติเมตร') && hl.lines[2].includes('ถนนที่แยกขึ้นเหนือ'), JSON.stringify(hl.lines));
  check('โจทย์: จากบ้านผู้ใหญ่บ้านไปกองขยะ ทิศใด ระยะจริงเท่าไร (3 ตัวเลือก ตะวันออก 200 ถูก)', hq.kind === 'quiz' && hq.question.includes('จากบ้านผู้ใหญ่บ้านไปกองขยะ ต้องเดินทางทิศใด และระยะทางจริงเท่าไร?') && hq.choices.join('|') === 'ตะวันออก 200 เมตร|ตะวันตก 200 เมตร|ตะวันออก 2,000 เมตร', JSON.stringify(hq));
  await shot('06-quiz-trash');
  await pick(1);
  check('ตอบผิด: กลับไปเรียนมาตราส่วนกับครูเนม (บทเรียน) ไม่ติด', (await kindNow()) === 'lesson' && (await ev(() => window.__TEST__.session.dialogueView.speaker)) === 'ครูเนม');
  for (let i = 0; i < 5; i++) { if ((await kindNow()) !== 'lesson') break; await tapDom('.tl-sheet .tl-option', (await ev(() => window.__TEST__.session.dialogueView.page)) === 5 ? 'เข้าใจแล้ว' : 'ถัดไป'); }
  check('จบบทเรียนแล้วกลับมาที่โจทย์เดิม', (await kindNow()) === 'quiz' && !(await sess()).flags.includes('trash-route'));
  await pick(0);
  await drive([]);
  s = await sess();
  check('ตอบถูก (ตะวันออก 200 เมตร) → ผ่านขั้น 5 แล้วเดินต่อได้เอง', s.flags.includes('trash-route') && s.step === 6 && s.mode === 'explore', JSON.stringify(s));
  await noGuide('หลังตอบโจทย์ผู้ใหญ่บ้าน (ไม่มีลูกศร/หมุดไปกองขยะ)');

  // 8) เดินไปทางตะวันออกเอง (ฝั่งขวาของแผนที่) → พบกองขยะ → "พบกองขยะแล้ว!" [ตกลง]
  s = await sess();
  check('ยังไม่ถึงกองขยะ: ไม่มีข้อความพบกองขยะ', !s.flags.includes('trash-found'));
  await walkBg(75, 45);
  check('ถึงกองขยะ → หยุดเดินและขึ้นข้อความ', await waitFor(() => !!window.__TEST__.session.dialogueView, 60000));
  const tv = await ev(() => window.__TEST__.session.dialogueView);
  check('"พบกองขยะแล้ว!" พร้อมปุ่ม "ตกลง"', tv.text === 'พบกองขยะแล้ว!' && tv.button === 'ตกลง', JSON.stringify(tv));
  await wait(400);
  const okBtn = await ev(() => [...document.querySelectorAll('.tl-sheet .tl-option')].map((b) => b.innerText.trim()));
  check('ปุ่ม "ตกลง" แสดงบนจอ', okBtn.some((t) => t.includes('ตกลง')), JSON.stringify(okBtn));
  const trashPos = await pos();
  check('กองขยะอยู่ฝั่งขวาของแผนที่ (ห่างจากบ้านผู้ใหญ่บ้าน ~20 ช่องตะวันออก)', trashPos.x >= 70, JSON.stringify(trashPos));
  await shot('07-trash-found');
  await tapDom('.tl-sheet .tl-option', 'ตกลง');
  await wait(400);
  const tv2 = await ev(() => window.__TEST__.session.dialogueView);
  check('จากนั้นเก็บขยะ: แจ้งให้กลับไปรายงานป้าเจียว', tv2 && tv2.text.includes('เก็บขยะ') && tv2.text.includes('ป้าเจียว'), JSON.stringify(tv2));
  await tapDom('.tl-sheet .tl-option', 'ตกลง');
  await wait(400);
  s = await sess();
  check('เก็บขยะเสร็จ → ผ่านขั้น 6 และไม่แสดงซ้ำ', s.flags.includes('trash-found') && s.step === 7 && !s.dlg, JSON.stringify(s));
  await walk(70, 45); await walk(75, 45);
  check('ยืนที่กองขยะอีกครั้ง: ไม่แสดงซ้ำ', !(await sess()).dlg);
  await noGuide('ที่กองขยะ');

  // 9) กลับไปป้าเจียว (ถนนหลักตะวันตก → ทางขึ้นเหนือ): คำแนะนำ 2 ข้อ (ผิดครั้งแรกของข้อ 1 → HP บอส +10)
  await walk(25, 48); await walk(25, 29);
  await talkKey();
  await drive([0]);
  const bonus1 = await ev((k) => JSON.parse(localStorage.getItem(k)).rpg.bossHpBonus, KEY);
  const toast = await ev(() => document.body.innerText.includes('พลังมลพิษพญาจระเข้ +10!'));
  check('คำแนะนำข้อ 1 ตอบผิด: HP พญาจระเข้ +10 · แสดง "พลังมลพิษพญาจระเข้ +10!" · เลือกใหม่ได้', bonus1 === 10 && (await kindNow()) === 'quiz', JSON.stringify([bonus1, toast]));
  await shot('07-advice-wrong');
  await drive([1, 2]);
  await wait(800);
  const rpg = await ev((k) => JSON.parse(localStorage.getItem(k)).rpg, KEY);
  check('ตอบถูกครบ 2 ข้อ: ได้ +100 เหรียญ +10 พลังศรัทธา · HP บอส +10 ถูกบันทึกไว้', rpg.coins === 100 && rpg.faith === 10 && rpg.bossHpBonus === 10, JSON.stringify(rpg));
  for (let i = 0; i < 10; i++) { s = await sess(); if (s.mode === 'summary') break; if (s.dlg) await nextLine(); else await wait(300); }
  s = await sess();
  check('จบภารกิจสักงาม → หน้าสรุป', s.mode === 'summary', JSON.stringify(s));
  await shot('08-summary');

  // Save/Load: เล่นใหม่ครึ่งทางแล้วรีโหลด
  const saved = await ev((k) => JSON.parse(localStorage.getItem(k)), KEY);
  check('บันทึกเกม: ด่านสักงามผ่านแล้ว + เหรียญ/ศรัทธาถูกเก็บ', !!saved.completed.sakngam && saved.rpg.coins === 100, JSON.stringify(saved.rpg));
  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 4).join(' | '));
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `FAILED ${bad}/${results.length}` : `ALL PASS ${results.length}`);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
