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
  const t0 = await trackerText();
  const hs = await drive([0, 1]); // ผิด (40 เมตร) → บทเรียนครูเนม → ถูก (400 เมตร)
  check('ผู้ใหญ่บ้านบอกทิศ+ระยะ+มาตราส่วน+สะพาน ก่อนถามโจทย์', hs.lines.some((x) => x.includes('ทิศตะวันออก') && x.includes('4 เซนติเมตร') && x.includes('1:10,000') && x.includes('สะพาน')), JSON.stringify(hs.lines));
  check('โจทย์ระยะ: 3 ตัวเลือก · ตอบผิดเปิดบทเรียนครูเนม 5 หน้า แล้วกลับมาตอบใหม่', hs.quizzes[0].choices.join('|') === '40 เมตร|400 เมตร|4,000 เมตร' && hs.lesson === 5, JSON.stringify([hs.quizzes[0].choices, hs.lesson]));
  let s = await sess();
  check('ตอบถูก → ผ่านฉากที่ 1 · เริ่มเดินได้ (ไม่มีรางวัล/ไม่เพิ่ม HP บอส)', s.flags.includes('q-kham') && s.step === 2 && s.mode === 'explore' && ((await rpg()).bossHpBonus || 0) === 0, JSON.stringify(s));
  const t1 = await trackerText();
  check('แถบภารกิจแสดงเป้าหมายและคำบอกทางค้างไว้ (ตาคำ ตะวันออก 4 ซม.) ไม่เฉลยตัวเลขเมตร', t1.includes('ตาคำ') && t1.includes('4 ซม.') && !t1.includes('400'), t1);
  await noGuide('หลังรับภารกิจ');
  await shot('03-after-intro');

  // ฉากที่ 2: เดินตามถนนทางตะวันออก 4 ซม. (ผ่านสะพาน) → บ้านตาคำ
  await walkBg(54, 11);
  check('เดินไปบ้านตาคำ ได้จริง (ข้ามสะพานระหว่างทาง)', await waitFor(() => window.__TEST__.session.flags.has('near:ta-kham'), 60000));
  await wait(500);
  const disc = await ev(() => [...window.__TEST__.session.discoveredLandmarks]);
  check('ผ่านสะพานข้ามลำน้ำ → ค้นพบสะพานเป็นจุดสังเกตระหว่างทาง', disc.includes('bridge'), JSON.stringify(disc));
  await shot('04-kham-house');
  await talkKey();
  const ks = await drive([0, 1]); // โจทย์ 2 ซม.: ผิด → บทเรียน → ถูก
  s = await sess();
  check('ตาคำ: ให้แผนที่ภูเขา (ไม่มีตัวเลข) แล้วบอกทางไปเจ้าหน้าที่ป่าไม้ + โจทย์ระยะ 2 ซม.', ks.lines.some((x) => x.includes('ตัวเลขความสูงเลือนหายไปแล้ว')) && ks.lines.some((x) => x.includes('เจ้าหน้าที่ป่าไม้')) && ks.quizzes[0].choices.join('|') === '20 เมตร|200 เมตร|2,000 เมตร' && s.flags.includes('got-topo') && s.flags.includes('q-station'), JSON.stringify([ks.lines, s.flags]));
  const t2 = await trackerText();
  check('อัปเดตภารกิจ: "ตามหาเจ้าหน้าที่ป่าไม้เพื่อสอบถามระดับความสูง"', t2.includes('ตามหาเจ้าหน้าที่ป่าไม้เพื่อสอบถามระดับความสูง'), t2);

  // ฉากที่ 3: เดินตะวันออก 2 ซม. → สถานีป่าไม้
  await walkBg(74, 11);
  check('เดินไปสถานีป่าไม้ ได้จริง', await waitFor(() => window.__TEST__.session.flags.has('near:ranger'), 60000));
  await talkKey();
  const rs = await drive([]);
  s = await sess();
  check('เจ้าหน้าที่ป่าไม้: อธิบายเส้นชั้นความสูง + บทเรียนทีละหน้า (4 หน้า) + ให้ไปเปิดแผนที่นับเส้น', rs.lines.some((x) => x.includes('เส้นบนแผนที่นี้เรียกว่าเส้นชั้นความสูง')) && rs.lesson === 4 && s.flags.includes('contour-task'), JSON.stringify([rs.lines, rs.lesson, s.flags]));
  await talkKey();
  const early = await dv();
  check('กลับไปคุยก่อนเปิดแผนที่: ไม่ถามโจทย์ ให้ไปเปิดแผนที่ก่อน', early && early.kind === 'line' && early.text.includes('เปิดแผนที่'), JSON.stringify(early));
  await drive([]);

  // แผนที่ภูมิประเทศ: ยังไม่มีตัวเลข
  await openMap();
  check('เปิดแผนที่ภูมิประเทศที่ได้รับ', await isMapMode());
  await wait(500);
  let tx = await sceneTexts();
  const hasNum = (n) => tx.some((t) => t.trim() === String(n));
  check('แผนที่ที่ได้จากตาคำ: มีเส้นชั้นความสูง ลำน้ำ จุด A,B,C แต่ "ยังไม่มีตัวเลข" ความสูงบนเส้น/จุด', !hasNum(100) && !hasNum(150) && !hasNum(200) && tx.some((t) => t.includes('จุด A')) && tx.some((t) => t.includes('จุด B')) && tx.some((t) => t.includes('จุด C')), JSON.stringify(tx.filter((t) => /\d/.test(t) || t.includes('จุด'))));
  await shot('05-map-no-numbers');
  await closeMap();
  check('ปิดแผนที่ กลับมาเดินได้', !(await isMapMode()));
  s = await sess();
  check('เปิดแผนที่แล้วจดไว้ (ใช้ปลดล็อกโจทย์ถัดไป)', s.flags.includes('opened:map'), JSON.stringify(s.flags));

  // กิจกรรม 1: นับเส้น → ผิด → ถูก → เติมตัวเลขบนเส้น
  await talkKey();
  const q1 = await drive([]);
  const cq = await dv();
  check('กิจกรรม 1: โจทย์เส้นด้านในสุด (100 / 150 / 200 เมตร)', cq.kind === 'quiz' && cq.question.includes('เส้นด้านในสุดสูงเท่าไร') && cq.choices.join('|') === '100 เมตร|150 เมตร|200 เมตร', JSON.stringify(cq));
  await shot('06-quiz-contour');
  await pick(0);
  const cw = await dv();
  check('ตอบผิด: เจ้าหน้าที่อธิบายสั้น ๆ แล้วลองใหม่ที่เดิม (ไม่เดินกลับ ไม่เริ่มใหม่ ไม่เพิ่ม HP บอส)', cw.kind === 'quiz' && cw.feedback === 'เส้นชั้นความสูงแต่ละเส้นมีช่วงต่างระดับที่แน่นอน ลองนับจำนวนช่วงระหว่างเส้นดูอีกครั้ง' && ((await rpg()).bossHpBonus || 0) === 0, JSON.stringify(cw));
  await pick(2);
  s = await sess();
  check('ตอบถูก (200 เมตร) → เติมตัวเลขความสูงลงบนแผนที่เดิม', s.flags.includes('contour-labeled'), JSON.stringify(s.flags));
  // กิจกรรม 2 ต่อในบทสนทนาเดียวกัน
  const q2 = await drive([]);
  const sq = await dv();
  check('กิจกรรม 2: โจทย์ความลาดชัน (จุด A / จุด B / ชันเท่ากัน)', sq.kind === 'quiz' && sq.question === 'พื้นที่ใดมีความลาดชันมากกว่า?' && sq.choices.join('|') === 'จุด A|จุด B|ทั้งสองจุดชันเท่ากัน', JSON.stringify(sq));
  await pick(1);
  const sw = await dv();
  check('ตอบผิด: อธิบาย "เส้นชิดกัน = เปลี่ยนเร็ว = ชัน" แล้วลองใหม่', sw.kind === 'quiz' && sw.feedback.includes('เส้นที่อยู่ชิดกันแสดงว่าระดับความสูงเปลี่ยนเร็วในระยะทางสั้น จึงชันกว่า'), JSON.stringify(sw));
  await pick(0);
  const q3 = await drive([]);
  s = await sess();
  check('ตอบถูก → "ตอนนี้เจ้ารู้แล้วว่าพื้นที่ไหนสูงหรือต่ำ" และได้แผนที่ตัวเลขครบ', q3.lines.some((x) => x.includes('ตอนนี้เจ้ารู้แล้วว่าพื้นที่ไหนสูงหรือต่ำ')) && s.flags.includes('contours-learned'), JSON.stringify([q3.lines, s.flags]));
  await openMap();
  await wait(500);
  tx = await sceneTexts();
  check('แผนที่ฉบับตัวเลขครบ: เส้นชั้นความสูงมีเลข 100, 150, 200 และจุด A, B, C มีระดับความสูง', hasNum(100) && hasNum(150) && hasNum(200), JSON.stringify(tx.filter((t) => /^\d+$/.test(t.trim()))));
  const spot = await ev(() => { const s = window.__TEST__.session; const e = s.elevation; return s.level.spotHeights.map((p) => e.meters(p)); });
  check('ระดับความสูงที่จุด A, B, C ที่พิมพ์บนแผนที่ตรงกับแบบจำลอง (≈128, 170, 76)', spot.every((v) => hasNum(v)) && spot[0] > 100 && spot[0] < 150 && spot[1] > 150 && spot[1] < 200 && spot[2] < 100, JSON.stringify([spot, tx.filter((t) => /^\d+$/.test(t.trim()))]));
  await shot('07-map-numbers');
  await closeMap();

  // บันทึก/โหลด กลางภารกิจ (หลังเรียนรู้เส้นชั้นความสูง)
  await wait(500);
  const savedFlags = (await sess()).flags.slice().sort();
  await boot(BASE + '?level=level-2');
  const afterLoad = await sess();
  check('บันทึก/โหลดกลางภารกิจ: สถานะ flag เท่าเดิม ไม่ค้าง เดินต่อได้', JSON.stringify(afterLoad.flags.slice().sort()) === JSON.stringify(savedFlags) && afterLoad.mode === 'explore', JSON.stringify([savedFlags, afterLoad.flags]));
  await openMap();
  await wait(400);
  tx = await sceneTexts();
  check('โหลดแล้วแผนที่ยังมีตัวเลขครบ (แผนที่ชุดเดียวต่อเนื่อง)', hasNum(100) && hasNum(150) && hasNum(200), JSON.stringify(tx.filter((t) => /^\d+$/.test(t.trim()))));
  await closeMap();
  const tt = await sess();
  check('โหลดแล้วยืนอยู่ที่สถานีป่าไม้ (ตำแหน่งผู้เล่นถูกบันทึก)', tt.tile.x >= 70 && tt.tile.y <= 14, JSON.stringify(tt.tile));

  // ฉากที่ 4: วิเคราะห์ลำน้ำ
  await walk(74, 11);
  await talkKey();
  const f0 = await drive([]);
  const fq = await dv();
  check('หลักฐานลำน้ำ A/B/C ก่อนถามโจทย์ทิศทางการไหล', f0.lines.some((x) => x.includes('ลำน้ำ B พบปลาตายและน้ำผิดปกติก่อนถึงจุดบรรจบ')) && fq.question === 'จากข้อมูลระดับความสูงในแผนที่ น้ำไหลจากบริเวณใดไปยังบริเวณใด?', JSON.stringify([f0.lines, fq]));
  check('โจทย์ทิศการไหล: ตัวเลือกใช้ช่วงความสูงจริงของจุด A/B/C (ไม่ใช่ชื่อจุดอย่างเดียว)', fq.choices.length === 3 && fq.choices.every((c) => /\d{3}–\d{3} ม\./.test(c)) && fq.choices[2] === 'จากจุด A (100–150 ม.) และจุด B (150–200 ม.) ไปยังจุด C (ต่ำกว่า 100 ม.)', JSON.stringify(fq.choices));
  await shot('08-quiz-flow');
  await pick(0);
  check('ตอบผิด: บอกให้ดูตัวเลขความสูง (ไม่ใช่ดูบน/ล่างของจอ) แล้วลองใหม่', (await dv()).kind === 'quiz' && (await dv()).feedback.includes('ดูตัวเลขความสูง'));
  await pick(2);
  const f1 = await drive([]);
  const sqz = await dv();
  check('โจทย์เลือกต้นทางตรวจสอบ: ลำน้ำ A / ลำน้ำ B / จุด C', sqz.kind === 'quiz' && sqz.choices.join('|') === 'ลำน้ำ A|ลำน้ำ B|จุด C หลังลำน้ำบรรจบ', JSON.stringify(sqz));
  await pick(2);
  check('ตอบผิด (จุด C): แนะนำให้ย้อนขึ้นไปทางต้นน้ำ แล้วลองใหม่', (await dv()).kind === 'quiz' && (await dv()).feedback.includes('ต้นน้ำ'));
  await pick(1);
  const f2 = await drive([]);
  const rq = await dv();
  check('เลือกลำน้ำ B → ไม่ต้องกลับไปหาตาคำ · ได้คำบอกทาง (ใต้ 3 ซม. กระท่อมเฝ้าป่า ตะวันตก 2 ซม. 1:10,000)', f2.lines.some((x) => x.includes('ไม่ต้องกลับไปหาตาคำอีก')) && f2.lines.some((x) => x.includes('ทิศใต้ 3 เซนติเมตร') && x.includes('กระท่อมเฝ้าป่า') && x.includes('ทิศตะวันตกอีก 2 เซนติเมตร')), JSON.stringify(f2.lines));
  check('โจทย์ระยะรวม: 50 / 500 / 5,000 เมตร', rq.kind === 'quiz' && rq.choices.join('|') === '50 เมตร|500 เมตร|5,000 เมตร', JSON.stringify(rq));
  await pick(0);
  check('ตอบผิด → กลับไปทบทวนกับครูเนม (บทเรียน)', (await kindNow()) === 'lesson');
  for (let i = 0; i < 6 && (await kindNow()) === 'lesson'; i++) await tapDom('.tl-sheet .tl-option', (await ev(() => window.__TEST__.session.dialogueView.page === window.__TEST__.session.dialogueView.pages)) ? 'เข้าใจแล้ว' : 'ถัดไป');
  await pick(1);
  await drive([]);
  s = await sess();
  check('ตอบถูก → เริ่มเดินไปจุดตรวจสอบได้ (ผ่านฉากที่ 4–5 ขั้นวิเคราะห์)', s.flags.includes('q-source') && s.flags.includes('q-site') && s.mode === 'explore', JSON.stringify(s.flags));
  const t3 = await trackerText();
  check('แถบภารกิจแสดงคำบอกทางไปต้นน้ำ B ให้อ่านซ้ำได้ (ใต้ 3 ซม. → ตะวันตก 2 ซม.)', t3.includes('ทิศใต้ 3 ซม.') && t3.includes('ทิศตะวันตก 2 ซม.'), t3);
  await noGuide('ก่อนเดินไปต้นน้ำ B');

  // ฉากที่ 5: เดินตามคำบอก — ลงใต้ 3 ซม. ถึงกระท่อมเฝ้าป่า แล้วเลี้ยวตะวันตก 2 ซม.
  await walk(75, 41); // มุมเลี้ยว (กระท่อมเฝ้าป่า)
  const hutSeen = await ev(() => [...window.__TEST__.session.discoveredLandmarks]);
  check('ลงใต้ตามถนน 3 ซม. พบกระท่อมเฝ้าป่าที่มุมเลี้ยว (จุดสังเกต)', hutSeen.includes('hut'), JSON.stringify(hutSeen));
  await shot('09-hut-corner');
  s = await sess();
  check('ยังไม่ถึงจุดตรวจสอบ: ไม่มีข้อความพบสารเคมี', !s.flags.includes('site-found') && s.mode === 'explore');
  const barrel0 = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return w.children.list.some((o) => o.type === 'Image' && o.texture && o.texture.key === 'barrel' && o.visible); });
  check('ถังสารเคมียังไม่ปรากฏก่อนถึงจุดตรวจสอบ', barrel0 === false);
  await walkBg(54, 41);
  check('ถึงจุดตรวจสอบ → หยุดเดินและขึ้นข้อความ', await waitFor(() => !!window.__TEST__.session.dialogueView, 60000));
  const a0 = await dv();
  check('"พบร่องรอยสารเคมีบริเวณต้นน้ำ!" พร้อมปุ่ม "ตกลง"', a0.text === 'พบร่องรอยสารเคมีบริเวณต้นน้ำ!' && a0.button === 'ตกลง', JSON.stringify(a0));
  await wait(400);
  const okBtn = await ev(() => [...document.querySelectorAll('.tl-sheet .tl-option')].map((x) => x.innerText.trim()));
  check('ปุ่ม "ตกลง" แสดงบนจอ', okBtn.some((x) => x.includes('ตกลง')), JSON.stringify(okBtn));
  await shot('10-site-found');
  await tapDom('.tl-sheet .tl-option', 'ตกลง');
  await wait(500);
  const barrel1 = await ev(() => { const w = window.__GAME__.scene.getScene('WorldScene'); return w.children.list.some((o) => o.type === 'Image' && o.texture && o.texture.key === 'barrel' && o.visible); });
  check('จากนั้นแสดงถังสารเคมีที่ถูกทิ้งใกล้ลำธาร', barrel1 === true);
  await shot('11-barrel');

  // ฉากที่ 6: ตัดสินใจ — ผิด 2 ครั้ง (A, B) → +20 HP บอส → ถูก (C)
  const d0 = await dv();
  check('"พบถังสารเคมีแล้ว! เราควรทำอย่างไรดี?" แล้วถามวิธีรับมือ 3 ข้อ', d0.text === 'พบถังสารเคมีแล้ว! เราควรทำอย่างไรดี?', JSON.stringify(d0));
  await nextLine();
  const cqz = await dv();
  check('ตัวเลือก: เปิดถังเอง / ผลักถังลงลำธาร / อยู่ห่างและแจ้งเจ้าหน้าที่', cqz.kind === 'quiz' && cqz.choices.join('|') === 'เปิดถังตรวจสอบด้วยตัวเอง|ผลักถังลงลำธาร|อยู่ห่างจากถังและแจ้งเจ้าหน้าที่ให้ตรวจสอบ', JSON.stringify(cqz));
  await pick(0);
  await wait(300);
  const w1 = await rpg();
  const toast = await ev(() => document.body.innerText.includes('พลังมลพิษพญาจระเข้ +10!'));
  check('ตอบผิด (เปิดถัง): พลังมลพิษพญาจระเข้ +10 HP ทันที แสดงผลกระทบ และตอบใหม่ได้', w1.bossHpBonus === 10 && toast && (await dv()).kind === 'quiz' && (await dv()).feedback.includes('อันตราย'), JSON.stringify([w1.bossHpBonus, toast, await dv()]));
  await shot('12-chem-wrong');
  await pick(1);
  const w2 = await rpg();
  check('ตอบผิดอีกครั้ง (ผลักถัง): +10 อีก (รวม 20 ตามระบบมลพิษเดิม · เพดาน 50)', w2.bossHpBonus === 20, JSON.stringify(w2));
  await pick(2);
  await wait(300);
  const okv = await dv();
  check('ตอบถูก: "ตัดสินใจถูกต้อง!" · ให้กลับไปรายงานผู้ใหญ่บ้าน', okv && (okv.text || '').includes('ตัดสินใจถูกต้อง') || (await sess()).flags.includes('q-chem'), JSON.stringify(okv));
  await drive([]);
  s = await sess();
  check('ผ่านฉากที่ 6 · เดินต่อได้ · ไม่ถามซ้ำ', s.flags.includes('q-chem') && s.mode === 'explore', JSON.stringify(s));
  const t4 = await trackerText();
  check('แถบภารกิจ: กลับไปรายงานผู้ใหญ่บ้าน (บอกทิศ/ระยะทางกลับ)', t4.includes('กลับไปรายงานผู้ใหญ่บ้าน') || t4.includes('เดินกลับไปบ้านผู้ใหญ่บ้าน'), t4);
  await walk(62, 41); await walk(55, 41);
  check('ยืนที่จุดตรวจสอบอีกครั้ง: ไม่แสดงซ้ำ', !(await sess()).dlg);

  // ฉากที่ 7: เดินกลับไปรายงานผู้ใหญ่บ้านเอง
  await walkBg(14, 11);
  check('เดินกลับบ้านผู้ใหญ่บ้านด้วยตัวเอง', await waitFor(() => window.__TEST__.session.playerTile.x <= 16 && window.__TEST__.session.playerTile.y <= 13, 120000));
  await talkKey();
  const rp = await drive([]);
  await wait(800);
  check('รายงานผู้ใหญ่บ้าน: บทสนทนาตามเรื่อง + "ภารกิจสำเร็จ — ปกป้องต้นน้ำคลองน้ำไหล"', rp.lines.some((x) => x.includes('ผมพบถังสารเคมีบริเวณต้นทางลำน้ำที่ผิดปกติแล้ว')) && rp.lines.some((x) => x.includes('งดใช้น้ำบริเวณที่สงสัยว่าปนเปื้อน')) && rp.lines.some((x) => x.includes('ปกป้องต้นน้ำคลองน้ำไหล')), JSON.stringify(rp.lines));
  for (let i = 0; i < 12; i++) { s = await sess(); if (s.mode === 'summary') break; if (s.dlg) await nextLine(); else await wait(300); }
  s = await sess();
  await shot('13-summary');
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
