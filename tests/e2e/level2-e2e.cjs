// ด่านที่ 2 "ปริศนาสารพิษแห่งต้นน้ำ" — เล่นจริงในเบราว์เซอร์ ตั้งแต่บ้านผู้ใหญ่บ้านจนรายงานจบด่าน
//   node tests/e2e/level2-e2e.cjs <outDir> [desktop | "iPhone 13 landscape"]
// เดินด้วย hook __TEST__.walkTo (physics จริง) ไปยังพิกัดที่ "คำนวณจากคำบอกทิศ+ระยะ" — ไม่มีลูกศร/หมุดนำทาง
// ตรวจ: ตัวเลขความสูงบนแผนที่ปรากฏตามขั้น (ไม่มี → ตัวเลขบนเส้น → จุด A/B/C) · ถังสารเคมีปรากฏหลังถึงจุดตรวจ · ตอบผิดทุกคำถาม · บันทึก/โหลด
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
  const shot = async (n) => { await wait(300); await page.screenshot({ path: `${OUT}/${tag}-l2-${n}.png` }); };
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
  const store = (rpg) => ({ version: 2, storyVersion: 3, completed: { sakngam: { levelId: 'sakngam', completedAt: 'x', distanceMeters: 1, cluesFound: 0, cluesTotal: 0, mistakes: 0, elapsedMs: 1, skills: [], codePiece: null } }, unlocked: ['sakngam', 'level-2'], codePieces: {}, inProgress: {}, rpg: { coins: 0, faith: 0, potions: 0, owned: [], weapon: null, armor: null, rewarded: [], goldenDone: true, goldenCoins: 0, shopDone: false, bossDone: false, bossLosses: 0, ...rpg } });
  const boot = async (url) => {
    await page.goto(url);
    await page.waitForFunction(() => window.__TEST__ && window.__TEST__.session && window.__GAME__.scene.isActive('WorldScene'), null, { timeout: 15000 });
    await wait(800);
  };
  await page.goto(BASE);
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, store({})]);
  await boot(BASE + '?level=level-2&new=1');

  const sess = () => ev(() => { const s = window.__TEST__.session; return { step: s.currentStepOrder, mode: s.mode, flags: [...s.flags], dlg: s.dialogueView && s.dialogueView.kind, done: s.completed, tile: { ...s.playerTile } }; });
  const walk = async (x, y) => { const ok = await ev(([x, y]) => window.__TEST__.walkTo(x, y), [x, y]); await wait(400); return ok; };
  const walkBg = async (x, y) => { await ev(([x, y]) => { window.__TEST__.walkTo(x, y); }, [x, y]); };
  const waitFor = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn)) return true; await wait(250); } return false; };
  const talkKey = async () => { await tapDom('.tl-actions .tl-btn', 'คุย'); await wait(350); };
  const nextLine = async () => { const c = await page.evaluate(() => { const e = document.querySelector('.tl-sheet .tl-dlg'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await tapAt(c.x, c.y); await wait(250); };
  const pick = async (i) => {
    const c = await page.evaluate((i) => { const els = [...document.querySelectorAll('.tl-sheet .tl-option')]; const el = els[i]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
    if (!c) throw new Error('no choice button');
    await tapAt(c.x, c.y);
  };
  const kindNow = () => ev(() => { const v = window.__TEST__.session.dialogueView; return v && v.kind; });
  const dv = () => ev(() => window.__TEST__.session.dialogueView);
  /** เดินบทสนทนา: บรรทัด = แตะกล่อง/ปุ่ม · บทเรียน = ถัดไป · คำถาม = เลือกตามลำดับ answers (หมดแล้วหยุด) */
  const drive = async (answers) => {
    const seen = { lesson: 0, lines: [], quizzes: [] };
    for (let g = 0; g < 80; g++) {
      const v = await ev(() => { const d = window.__TEST__.session.dialogueView; return d && { kind: d.kind, text: d.text || d.question || '', page: d.page, pages: d.pages, button: d.button, choices: d.choices, feedback: d.feedback }; });
      if (!v) break;
      if (v.kind === 'quiz') { if (!answers.length) break; seen.quizzes.push({ q: v.text, choices: v.choices, feedback: v.feedback }); await pick(answers.shift()); }
      else if (v.kind === 'lesson') { seen.lesson++; await tapDom('.tl-sheet .tl-option', v.page === v.pages ? 'เข้าใจแล้ว' : 'ถัดไป'); }
      else { seen.lines.push(v.text); if (v.button) await tapDom('.tl-sheet .tl-option', v.button); else await nextLine(); }
    }
    return seen;
  };
  const noGuide = async (label) => {
    const g = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return { guide: window.__TEST__.guide().mode, markers: w.npcs.map((n) => n.marker.visible), checks: w.npcs.map((n) => n.check.visible), ring: w.cueRing.visible, arrow: w.guideArrow.visible }; });
    check(`${label}: ไม่มีลูกศร/หมุดเป้าหมาย/เครื่องหมาย ! ✓/วงแหวนไฮไลต์`, g.guide === 'off' && !g.markers.some(Boolean) && !g.checks.some(Boolean) && !g.ring && !g.arrow, JSON.stringify(g));
  };
  const trackerText = () => ev(() => (document.querySelector('.tl-tracker') || {}).innerText || '');
  const rpg = () => ev((k) => JSON.parse(localStorage.getItem(k)).rpg, KEY);
  /** ข้อความทั้งหมดที่วาดอยู่ในฉากเกม (ป้ายบนแผนที่สำรวจ) */
  const sceneTexts = () => ev(() => {
    const out = [];
    const walk = (list) => { for (const o of list) { if (o.type === 'Text' && o.visible && o.text) out.push(o.text); if (o.list) walk(o.list); } };
    for (const sc of window.__GAME__.scene.scenes) if (sc.sys.isActive() && sc.children) walk(sc.children.list);
    return out;
  });
  const openMap = async () => { await page.keyboard.press('KeyM'); await wait(500); };
  const closeMap = async () => { await page.keyboard.press('Escape'); await wait(400); };
  const isMapMode = () => ev(() => window.__TEST__.session.mode === 'map');

  await shot('01-start');
  // ฉากที่ 1: เกิดที่บ้านผู้ใหญ่บ้าน · บทสนทนาเริ่มเอง
  check('เริ่มด่านที่บ้านผู้ใหญ่บ้าน → บทสนทนาเริ่มเอง (ไม่ต้องกดคุย)', await waitFor(() => !!window.__TEST__.session.dialogueView, 8000));
  const l0 = await dv();
  check('บทแรกของผู้ใหญ่บ้านตามเรื่อง', l0 && l0.text === 'ผู้กล้า! มีคนแอบนำสารเคมีไปทิ้งบริเวณต้นน้ำ ตอนนี้น้ำในชุมชนเริ่มผิดปกติแล้ว', JSON.stringify(l0));
  await shot('02-headman-intro');
  const hs = await drive([0, 1]); // ผิด (40 เมตร) → บทเรียนครูเนม → ถูก (400 เมตร)
  check('ผู้ใหญ่บ้านบอกทิศ+ระยะ+มาตราส่วน+สะพาน ก่อนถามโจทย์', hs.lines.some((x) => x.includes('ทิศตะวันออก') && x.includes('4 เซนติเมตร') && x.includes('1:10,000') && x.includes('สะพาน')), JSON.stringify(hs.lines));
  check('โจทย์ระยะ 3 ตัวเลือก · ตอบผิดเปิดบทเรียนครูเนม 5 หน้า แล้วกลับมาตอบใหม่', hs.quizzes[0].choices.join('|') === '40 เมตร|400 เมตร|4,000 เมตร' && hs.lesson === 5, JSON.stringify([hs.quizzes[0].choices, hs.lesson]));
  let s = await sess();
  check('ตอบถูก → ผ่านฉากที่ 1 · เริ่มเดินได้ (ไม่เพิ่ม HP บอส)', s.flags.includes('q-kham') && s.mode === 'explore' && ((await rpg()).bossHpBonus || 0) === 0, JSON.stringify(s));
  await noGuide('หลังรับภารกิจ');

  // ฉากที่ 2: เดินตามถนนสายหลักทางตะวันออก 4 ซม. (ข้ามสะพาน) → บ้านตาคำ
  await walkBg(54, 11);
  check('เดินไปบ้านตาคำ ได้จริง (ข้ามสะพานระหว่างทาง)', await waitFor(() => window.__TEST__.session.flags.has('near:ta-kham'), 60000));
  await wait(500);
  check('ผ่านสะพานข้ามลำน้ำ → ค้นพบสะพานเป็นจุดสังเกต', (await ev(() => [...window.__TEST__.session.discoveredLandmarks])).includes('bridge'));
  await talkKey();
  const k0 = await dv();
  check('ตาคำ: ผู้กล้าถามหาต้นน้ำ', k0 && k0.text === 'ตาคำครับ ผมกำลังตามหาต้นน้ำที่ถูกทิ้งสารเคมีครับ', JSON.stringify(k0));
  await nextLine();
  const k1 = await dv();
  check('ตาคำ: "ตาเก็บแผนที่ภูมิประเทศแถบนี้ไว้ เจ้าลองนำไปใช้สืบหาต้นน้ำดู"', k1 && k1.text === 'ตาเก็บแผนที่ภูมิประเทศแถบนี้ไว้ เจ้าลองนำไปใช้สืบหาต้นน้ำดู', JSON.stringify(k1));
  check('ก่อนบทสนทนาจบ ยังไม่มีแผนที่เด้งขึ้น', !(await isMapMode()));
  await nextLine();

  // แผนที่เด้งขึ้นกลางจอทันทีหลังบทสนทนาจบ
  check('หลังบทสนทนาจบ แผนที่เด้งขึ้นกลางจอทันที', await waitFor(() => window.__TEST__.session.mode === 'map', 5000));
  await wait(700);
  const rv = await ev(() => ({ title: (document.querySelector('.tl-mb-title') || {}).innerText || '', btn: [...document.querySelectorAll('.tl-actions .tl-btn')].map((b) => b.innerText.trim()), alpha: window.__GAME__.scene.scenes.filter((sc) => sc.sys.isActive() && sc.children).map((sc) => sc.children.list.filter((o) => o.type === 'Container' && o.visible).map((o) => o.alpha)).flat() }));
  check('หัวข้อ "คุณได้รับแผนที่ของตาคำ!" และมีปุ่ม "ตกลง"', rv.title.includes('คุณได้รับแผนที่ของตาคำ!') && rv.btn.some((x) => x.includes('ตกลง')), JSON.stringify(rv));
  let tx = await sceneTexts();
  const hasNum = (n) => tx.some((t) => t.trim() === String(n));
  check('แผนที่ที่ได้รับ: มีลำน้ำ A/B ชื่อกำกับ จุดบรรจบ สัญลักษณ์ภูเขา/ป่า/บ้าน แต่ยังไม่มีตัวเลขความสูง', !hasNum(100) && !hasNum(150) && !hasNum(200) && tx.some((t) => t.includes('ลำน้ำ A')) && tx.some((t) => t.includes('ลำน้ำ B')) && tx.some((t) => t.includes('จุดบรรจบ')) && tx.some((t) => t.includes('เขาสูง')) && tx.filter((t) => t === 'บ้านชาวบ้าน').length >= 5, JSON.stringify([tx.filter((t) => t === 'บ้านชาวบ้าน').length, tx.filter((t) => /ลำน้ำ|จุดบรรจบ|เขาสูง/.test(t))]));
  const noNum = tx.filter((t) => /^\d{3}$/.test(t.trim()) || t.trim() === '89');
  check('ไม่มีตัวเลขความสูงบนเส้นหรือที่บ้านเลย (ตัวเลขแกนพิกัด 10–80 ไม่ใช่ความสูง)', noNum.length === 0, JSON.stringify(noNum));
  await shot('03-map-reveal');
  const legend = await ev(() => document.body.innerText);
  check('แผนที่มีเข็มทิศ (เหนือ) และมาตราส่วน', legend.includes('เหนือ') && legend.includes('1:10,000'), '');
  await tapDom('.tl-actions .tl-btn', 'ตกลง');
  await wait(500);
  check('กด "ตกลง" แล้วปิดแผนที่ กลับมาเดินได้', !(await isMapMode()) && (await sess()).mode === 'explore');
  s = await sess();
  check('ได้แผนที่แล้ว ภารกิจถัดไป: "ไปพบเจ้าหน้าที่ป่าไม้เพื่อสอบถามข้อมูลระดับความสูง"', s.flags.includes('got-topo') && (await trackerText()).includes('ไปพบเจ้าหน้าที่ป่าไม้เพื่อสอบถามข้อมูลระดับความสูง'), await trackerText());
  await openMap(); await wait(400);
  check('เปิดแผนที่ของตาคำซ้ำได้จากปุ่มแผนที่เดิม (ไม่เด้งหัวข้อรับแผนที่ซ้ำ)', (await isMapMode()) && !(await ev(() => (document.querySelector('.tl-mb-title') || {}).innerText || '')).includes('คุณได้รับแผนที่'));
  await closeMap();

  // ฉากที่ 3: ใช้แผนที่หาสถานีป่าไม้เอง (ไม่มีลูกศร) — เดินไปทางตะวันออกตามถนนสายหลัก
  await noGuide('หลังได้รับแผนที่');
  await walkBg(74, 11);
  check('เดินไปสถานีป่าไม้ (ใช้แผนที่ ไม่มีลูกศร)', await waitFor(() => window.__TEST__.session.flags.has('near:ranger'), 60000));
  await talkKey();
  const rs = await drive([]);
  s = await sess();
  check('เจ้าหน้าที่ป่าไม้: ข้อมูลระดับความสูง + บทเรียน (4 หน้า) + ให้เปิดแผนที่นับเส้น', rs.lines[0] === 'ผมได้แผนที่จากตาคำ แต่ยังไม่รู้ว่าพื้นที่ไหนสูงหรือต่ำครับ' && rs.lines[1] === 'ฉันมีข้อมูลระดับความสูงจากการสำรวจ ลองนำไปอ่านคู่กับแผนที่ดู' && rs.lesson === 4 && s.flags.includes('contour-task'), JSON.stringify([rs.lines, rs.lesson]));
  await talkKey();
  const early = await dv();
  check('กลับไปคุยก่อนเปิดแผนที่: ไม่ถามโจทย์ ให้ไปเปิดแผนที่ก่อน', early && early.kind === 'line' && early.text.includes('เปิดแผนที่'), JSON.stringify(early));
  await drive([]);
  await openMap(); await wait(500);
  await shot('04-map-contours');
  await closeMap();
  await talkKey();
  await drive([]);
  const cq = await dv();
  check('กิจกรรมอ่านเส้นชั้นความสูง: เส้นด้านในสุด 100 / 150 / 200 เมตร', cq.kind === 'quiz' && cq.choices.join('|') === '100 เมตร|150 เมตร|200 เมตร', JSON.stringify(cq));
  await pick(0);
  const cw = await dv();
  check('ตอบผิด: อธิบายสั้น ๆ แล้วลองใหม่ที่เดิม (ไม่เพิ่ม HP บอส)', cw.kind === 'quiz' && cw.feedback === 'เส้นชั้นความสูงแต่ละเส้นมีช่วงต่างระดับที่แน่นอน ลองนับจำนวนช่วงระหว่างเส้นดูอีกครั้ง' && ((await rpg()).bossHpBonus || 0) === 0, JSON.stringify(cw));
  await pick(2);
  check('ตอบถูก → เติมตัวเลขระดับความสูงลงบนแผนที่ของตาคำทันที', (await sess()).flags.includes('contour-labeled'));
  await drive([]);
  const sq = await dv();
  check('โจทย์ความลาดชัน (เส้นชิด/ห่าง)', sq.kind === 'quiz' && sq.question.includes('ความลาดชันมากกว่า'), JSON.stringify(sq));
  await pick(1);
  check('ตอบผิด: อธิบาย "เส้นชิดกัน = เปลี่ยนเร็ว = ชัน" แล้วลองใหม่', (await dv()).feedback.includes('เส้นที่อยู่ชิดกันแสดงว่าระดับความสูงเปลี่ยนเร็วในระยะทางสั้น จึงชันกว่า'));
  await pick(0);
  const e1 = await drive([]);
  s = await sess();
  check('เจ้าหน้าที่บอกเพียงว่านางแป้นอาศัยอยู่ใกล้ลำน้ำในบริเวณที่ต่ำที่สุด (ไม่บอกทิศ/บ้าน/สะพาน/สายน้ำ/เส้นทาง)', e1.lines.some((x) => x === 'มีชาวบ้านชื่อนางแป้นอาศัยอยู่ใกล้ลำน้ำในบริเวณที่ต่ำที่สุดของพื้นที่สำรวจ ลองไปตามหาเธอดู') && e1.lines.every((x) => !/ทางแยก|สะพานที่|ทิศ(ตะวัน|เหนือ|ใต้)/.test(x)) && s.flags.includes('contours-learned'), JSON.stringify(e1.lines));
  const t5 = await trackerText();
  check('ภารกิจ: "ตามหานางแป้นที่อาศัยอยู่ใกล้ลำน้ำในพื้นที่ต่ำที่สุด" พร้อมขั้นตอน 5 ข้อ ไม่บอกทิศ', t5.includes('ตามหานางแป้นที่อาศัยอยู่ใกล้ลำน้ำในพื้นที่ต่ำที่สุด') && t5.includes('อ่านตัวเลขระดับความสูง') && t5.includes('ค้นหาบ้านนางแป้น'), t5);

  // แผนที่ตัวเลขครบ: ตัวเลขบนเส้น + ความสูงของบ้านทุกหลัง
  await openMap(); await wait(500);
  tx = await sceneTexts();
  check('แผนที่ของตาคำมีตัวเลข 100, 150, 200 บนเส้น', hasNum(100) && hasNum(150) && hasNum(200), JSON.stringify(tx.filter((t) => /^\d+$/.test(t.trim()))));
  const hs5 = await ev(() => { const s = window.__TEST__.session; return s.level.spotHeights.map((p) => s.elevation.meters(p)); });
  check('มีตัวเลขความสูงของบ้านทั้ง 5 หลัง (บ้านนางแป้นต่ำสุด < 100 ม.)', hs5.every((v) => hasNum(v)) && Math.min(...hs5) < 100 && hs5.filter((v) => v < 100).length === 1, JSON.stringify([hs5, tx.filter((t) => /^\d+$/.test(t.trim()))]));
  await shot('05-map-numbers');
  await closeMap();

  // บันทึก/โหลด กลางภารกิจ
  await wait(500);
  const savedFlags = (await sess()).flags.slice().sort();
  await boot(BASE + '?level=level-2');
  const afterLoad = await sess();
  check('บันทึก/โหลดกลางภารกิจ: flag เท่าเดิม ไม่ค้าง ไม่เด้งแผนที่ซ้ำ', JSON.stringify(afterLoad.flags.slice().sort()) === JSON.stringify(savedFlags) && afterLoad.mode === 'explore', JSON.stringify([savedFlags, afterLoad.flags]));
  await openMap(); await wait(400);
  tx = await sceneTexts();
  check('โหลดแล้วแผนที่ยังมีตัวเลขครบ (แผนที่ชุดเดียวต่อเนื่อง)', hasNum(100) && hasNum(150) && hasNum(200));
  await closeMap();

  // ฉากที่ 4: ตามหานางแป้นด้วยตนเอง — ทางแยกผิดเดินได้ ไม่ติด
  // ผู้เล่นอ่านตัวเลขบนแผนที่: บ้านทั้ง 5 หลัง มีหลังเดียวต่ำกว่า 100 ม. อยู่ในแอ่งริมลำน้ำ → เดินไปสำรวจบ้านที่ผิดก่อนได้
  await walk(25, 12);
  await walk(25, 29); // ทางแยกตะวันตก → บ้านบนไหล่เขา (ผิด)
  check('เดินสำรวจทางแยกตะวันตกถึงบ้านบนไหล่เขา (บ้านผิด) ได้ ไม่ติด', (await sess()).tile.y >= 27);
  const wrongHouse = await ev(() => { const s = window.__TEST__.session; return s.dialogueView || s.mode; });
  check('บ้านที่ผิดไม่มีเหตุการณ์/ไม่มี NPC (เดินผ่านได้ กลับถนนสายหลักได้)', wrongHouse === 'explore');
  await shot('06-wrong-branch');
  await walk(25, 12);
  check('กลับถนนสายหลักจากทางผิดได้ (ไม่ติดในแผนที่)', (await sess()).tile.y <= 13);
  // ทางแยกกลาง ข้ามสะพานลำน้ำ B → บ้านบนเชิงเขา (ผิดอีกหลัง)
  await walk(40, 12);
  await walk(43, 27);
  check('ทางแยกกลาง: ข้ามสะพานลำน้ำ B ไปบ้านบนเชิงเขา (ผิด) ได้', (await sess()).tile.y >= 25);
  await walk(40, 12);
  // ทางแยกลงแอ่งต่ำ → บ้านนางแป้น
  await walk(48, 12);
  await walk(48, 15);
  check('เดินถึงบ้านนางแป้นในแอ่งต่ำ (หลังเดียวที่ต่ำกว่า 100 ม.)', await waitFor(() => window.__TEST__.session.flags.has('near:paen') || Math.hypot(window.__TEST__.session.playerTile.x - 47, window.__TEST__.session.playerTile.y - 15) < 3, 15000));
  await shot('07-paen-house');
  const nm = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return w.npcs.filter((n) => n.marker.visible || n.check.visible).length; });
  check('ไม่มีเครื่องหมาย ! หรือหมุดเหนือบ้านนางแป้น', nm === 0);
  await talkKey();
  const p0 = await drive([]);
  s = await sess();
  check('นางแป้น: "ช่วงนี้น้ำในลำธารแถวบ้านฉันเริ่มผิดปกติ ไม่รู้ว่าเกิดอะไรขึ้นจากต้นน้ำ" แล้วให้เปิดแผนที่', p0.lines[0] === 'ช่วงนี้น้ำในลำธารแถวบ้านฉันเริ่มผิดปกติ ไม่รู้ว่าเกิดอะไรขึ้นจากต้นน้ำ' && p0.lines[1].includes('เปิดแผนที่') && s.flags.includes('met-paen') && s.flags.includes('paen-task'), JSON.stringify([p0.lines, s.flags]));
  await shot('08-paen-talk');
  await talkKey();
  const pe = await dv();
  check('ยังไม่เปิดแผนที่: ไม่ถามโจทย์', pe.kind === 'line' && pe.text.includes('ยังไม่ได้เปิดแผนที่'), JSON.stringify(pe));
  await drive([]);
  await openMap(); await wait(600);
  await shot('09-map-at-paen');
  const dot = await ev(() => { const s = window.__TEST__.session; return { ...s.playerTile }; });
  check('เปิดแผนที่ที่บ้านนางแป้น: จุดสีแดงของเราอยู่ในแอ่งต่ำใกล้ลำน้ำ', dot.x >= 44 && dot.x <= 50 && dot.y >= 12 && dot.y <= 17, JSON.stringify(dot));
  await closeMap();

  // ฉากที่ 5: คำถามลำน้ำ
  await talkKey();
  await drive([]);
  const qs = await dv();
  check('"บ้านนางแป้นตั้งอยู่ใกล้ลำน้ำสายใด?" ตัวเลือกตรงลำน้ำบนแผนที่ ไม่มีข้อความเฉลย', qs.kind === 'quiz' && qs.question === 'บ้านนางแป้นตั้งอยู่ใกล้ลำน้ำสายใด?' && qs.choices.join('|') === 'ลำน้ำ A|ลำน้ำ B|ลำน้ำสายหลัก (หลังจุดบรรจบ)' && !qs.feedback, JSON.stringify(qs));
  await shot('10-quiz-stream');
  await pick(0);
  await wait(300);
  const wl = await dv();
  check('ตอบผิด: ให้เปิดแผนที่สังเกตใหม่ (ไม่ต้องไปหา NPC อื่น) แล้วคุยอีกครั้ง', wl && wl.kind === 'line' && wl.speaker === 'นางแป้น' && wl.text.includes('ลองเปิดแผนที่'), JSON.stringify(wl));
  await drive([]);
  check('บทสนทนาปิด ไม่ค้าง (โหมดเดินปกติ)', (await sess()).mode === 'explore' && !(await sess()).flags.includes('q-stream'));
  await openMap(); await wait(400); await closeMap();
  await talkKey();
  await drive([1]); // ลำน้ำ B
  s = await sess();
  check('ตอบถูก (ลำน้ำ B) → ได้ต่อ: ให้ตรวจสอบต้นน้ำ', s.flags.includes('q-stream') && s.flags.includes('upstream-task'), JSON.stringify(s.flags));
  const pt = await trackerText();
  check('ภารกิจแสดงขั้นวิเคราะห์ย้อนขึ้นต้นน้ำ', pt.includes('ตัวเลขความสูง') || pt.includes('วิเคราะห์ย้อนขึ้นไปยังต้นน้ำ'), pt);

  // ฉากที่ 6: วิเคราะห์ย้อนขึ้นต้นน้ำ
  await talkKey();
  const ue = await dv();
  check('ก่อนเปิดแผนที่อีกครั้ง: ยังไม่ถามโจทย์ย้อนต้นน้ำ', ue.kind === 'line' && ue.text.includes('เปิดแผนที่'), JSON.stringify(ue));
  await drive([]);
  await openMap(); await wait(400); await closeMap();
  await talkKey();
  await drive([]);
  const uq = await dv();
  check('โจทย์ย้อนขึ้นต้นน้ำ: ตัวเลือกใช้ทิศและระดับความสูงจริงของลำน้ำ', uq.kind === 'quiz' && uq.choices.length === 3 && uq.choices.every((c) => /ม\.\)?$/.test(c)) && uq.choices.some((c) => c.startsWith('ย้อนขึ้นไปทางทิศใต้') && c.includes('ลำน้ำ B') && c.includes('150–200 ม.')), JSON.stringify(uq));
  await shot('11-quiz-upstream');
  await pick(0);
  await wait(300);
  check('ตอบผิด: คำใบ้ให้เปิดแผนที่ดูตัวเลขความสูง แล้วคุยใหม่', (await dv()).text.includes('ลองเปิดแผนที่'));
  await drive([]);
  await openMap(); await wait(400); await closeMap();
  await talkKey();
  await drive([2]);
  s = await sess();
  check('ตอบถูก → ผู้กล้าออกเดินทางไปตรวจสอบต้นน้ำเอง (ไม่มีหมุดเฉลยตำแหน่งสารเคมี)', s.flags.includes('q-upstream') && s.mode === 'explore', JSON.stringify(s.flags));
  await noGuide('ก่อนเดินไปต้นน้ำ');
  const barrel0 = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return w.children.list.some((o) => o.type === 'Image' && o.texture && o.texture.key === 'barrel' && o.visible); });
  check('ถังสารเคมียังไม่ปรากฏก่อนถึงต้นน้ำ', barrel0 === false);

  // ฉากที่ 7: เดินเลียบลำน้ำ B ขึ้นต้นน้ำเอง (ทางเดินป่าจากทางแยก) — เดินจริง ไม่วาร์ป
  await walk(48, 16);
  await walk(51, 19);
  await walk(54, 24);
  await shot('12-trail-upstream');
  s = await sess();
  check('เดินเลียบลำน้ำ B ย้อนขึ้นไป ยังไม่ถึงจุดตรวจสอบ ไม่มีข้อความ', !s.flags.includes('site-found') && s.mode === 'explore');
  await walkBg(55, 34);
  check('ถึงต้นน้ำ → หยุดเดินและขึ้นข้อความ', await waitFor(() => !!window.__TEST__.session.dialogueView, 60000));
  const a0 = await dv();
  check('"พบร่องรอยสารเคมีบริเวณต้นน้ำ!" พร้อมปุ่ม "ตกลง"', a0.text === 'พบร่องรอยสารเคมีบริเวณต้นน้ำ!' && a0.button === 'ตกลง', JSON.stringify(a0));
  await wait(400);
  check('ปุ่ม "ตกลง" แสดงบนจอ', (await ev(() => [...document.querySelectorAll('.tl-sheet .tl-option')].map((x) => x.innerText.trim()))).some((x) => x.includes('ตกลง')));
  await shot('13-site-found');
  await tapDom('.tl-sheet .tl-option', 'ตกลง');
  await wait(500);
  const barrel1 = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return w.children.list.some((o) => o.type === 'Image' && o.texture && o.texture.key === 'barrel' && o.visible); });
  check('จากนั้นแสดงถังสารเคมีที่ถูกทิ้งใกล้ลำธาร', barrel1 === true);
  await shot('14-barrel');

  // ตัดสินใจ: ผิด 2 ครั้ง (+20 HP บอส) → ถูก
  const d0 = await dv();
  check('"พบถังสารเคมีแล้ว! เราควรทำอย่างไรดี?"', d0.text === 'พบถังสารเคมีแล้ว! เราควรทำอย่างไรดี?', JSON.stringify(d0));
  await nextLine();
  const cqz = await dv();
  check('ตัวเลือก: เปิดถังเอง / ผลักถังลงลำธาร / อยู่ห่างและแจ้งเจ้าหน้าที่ (ไม่มีให้จับ/ย้ายถัง)', cqz.kind === 'quiz' && cqz.choices.join('|') === 'เปิดถังตรวจสอบด้วยตัวเอง|ผลักถังลงลำธาร|อยู่ห่างจากถังและแจ้งเจ้าหน้าที่ให้ตรวจสอบ', JSON.stringify(cqz));
  await pick(0);
  await wait(300);
  const w1 = await rpg();
  const toast = await ev(() => document.body.innerText.includes('พลังมลพิษพญาจระเข้ +10!'));
  check('ตอบผิด (เปิดถัง): พลังมลพิษพญาจระเข้ +10 HP ทันที แสดงผลกระทบ และตอบใหม่ได้', w1.bossHpBonus === 10 && toast && (await dv()).kind === 'quiz' && (await dv()).feedback.includes('อันตราย'), JSON.stringify([w1.bossHpBonus, toast, await dv()]));
  await shot('15-chem-wrong');
  await pick(1);
  check('ตอบผิดอีกครั้ง: รวม +20 (เพดานรวม 50 ตามระบบมลพิษเดิม)', (await rpg()).bossHpBonus === 20);
  await pick(2);
  await wait(300);
  await drive([]);
  s = await sess();
  check('ตอบถูก "ตัดสินใจถูกต้อง!" → ผ่านขั้น · เดินต่อได้ · ไม่ถามซ้ำ', s.flags.includes('q-chem') && s.mode === 'explore', JSON.stringify(s));
  check('แถบภารกิจ: กลับไปรายงานผู้ใหญ่บ้าน', (await trackerText()).includes('กลับไปรายงานผู้ใหญ่บ้าน') || (await trackerText()).includes('เดินกลับไปรายงานผู้ใหญ่บ้าน'), await trackerText());
  await walk(55, 30); await walk(55, 35);
  check('ยืนที่ต้นน้ำอีกครั้ง: ไม่แสดงซ้ำ', !(await sess()).dlg);

  // ฉากสุดท้าย: เดินกลับไปรายงานผู้ใหญ่บ้านเอง
  await walkBg(14, 11);
  check('เดินกลับบ้านผู้ใหญ่บ้านด้วยตัวเอง', await waitFor(() => window.__TEST__.session.playerTile.x <= 16 && window.__TEST__.session.playerTile.y <= 13, 150000));
  await talkKey();
  const rp = await drive([]);
  await wait(800);
  check('รายงานผู้ใหญ่บ้าน: บทสนทนาตามเรื่อง + "ภารกิจสำเร็จ — ปกป้องต้นน้ำคลองน้ำไหล"', rp.lines.some((x) => x.includes('ผมพบถังสารเคมีบริเวณต้นทางลำน้ำที่ผิดปกติแล้ว')) && rp.lines.some((x) => x.includes('งดใช้น้ำบริเวณที่สงสัยว่าปนเปื้อน')) && rp.lines.some((x) => x.includes('ปกป้องต้นน้ำคลองน้ำไหล')), JSON.stringify(rp.lines));
  for (let i = 0; i < 12; i++) { s = await sess(); if (s.mode === 'summary') break; if (s.dlg) await nextLine(); else await wait(300); }
  s = await sess();
  await shot('16-summary');
  const r1 = await rpg();
  check('ได้รางวัล +100 เหรียญ +10 ศรัทธา (ครั้งเดียว) · HP บอสที่เพิ่มถูกบันทึก (+20)', r1.coins === 100 && r1.faith === 10 && r1.bossHpBonus === 20 && r1.rewarded.includes('level-2:final'), JSON.stringify(r1));
  check('จบภารกิจ → หน้าสรุปผล', s.mode === 'summary', JSON.stringify(s));
  const saved = await ev((k) => JSON.parse(localStorage.getItem(k)), KEY);
  check('บันทึกสถานะภารกิจสำเร็จ และปลดล็อกด่านถัดไป', !!saved.completed['level-2'] && saved.unlocked.includes('level-3'), JSON.stringify([Object.keys(saved.completed), saved.unlocked]));
  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 4).join(' | '));
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `FAILED ${bad}/${results.length}` : `ALL PASS ${results.length}`);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
