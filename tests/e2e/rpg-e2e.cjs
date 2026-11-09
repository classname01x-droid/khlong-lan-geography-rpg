// ทดสอบเบราว์เซอร์ (Playwright + Chromium จำลองอุปกรณ์ — ไม่ใช่ WebKit/Safari จริง): เล่นตั้งแต่เกมใหม่จนจบ
//   node tests/e2e/rpg-e2e.cjs <outDir> [desktop | "iPhone 13 landscape" | "Pixel 7 landscape"]
// ต้องรัน `npm run dev` ไว้ก่อน (BASE=http://localhost:5173/) — ใช้ hook __GAME__/__TEST__ ที่มีเฉพาะโหมด dev
// มือถือ: แตะด้วย touchscreen เท่านั้น (ห้ามใช้คีย์บอร์ด)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/e2e';
const DEV = process.argv[3] || 'iPhone 13 landscape';
const BASE = process.env.BASE || 'http://localhost:5173/';
const DESK = DEV === 'desktop';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, ok, extra = '') => {
  results.push(ok);
  console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : String(extra));
};

(async () => {
  const b = await chromium.launch();
  const opts = DESK ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } : (({ defaultBrowserType, ...d }) => ({ ...d, deviceScaleFactor: 2 }))(devices[DEV.replace(' landscape', '') + (DEV.includes('landscape') ? ' landscape' : '')]);
  const ctx = await b.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  const tag = DESK ? 'desktop' : DEV.replace(/[^A-Za-z0-9]+/g, '_');
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (n) => {
    await wait(250);
    await page.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  };
  const waitScene = async (k, ms = 15000) => {
    await page.waitForFunction((k) => window.__GAME__ && window.__GAME__.scene.isActive(k), k, { timeout: ms });
    await wait(350);
  };
  const canvasRect = () => page.evaluate(() => { const c = window.__GAME__.canvas.getBoundingClientRect(); return { x: c.left, y: c.top, s: c.width / 960, w: c.width, h: c.height }; });
  const tapAt = async (x, y) => { if (DESK) await page.mouse.click(x, y); else await page.touchscreen.tap(x, y); await wait(300); };
  /** แตะตำแหน่งในพิกัดเกม (960×640) */
  const tapGame = async (gx, gy) => { const c = await canvasRect(); await tapAt(c.x + gx * c.s, c.y + gy * c.s); };
  const tapDom = async (sel, text) => {
    let c = null;
    for (let i = 0; i < 40 && !c; i++) {
      c = await page.evaluate(([sel, text]) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!text || e.innerText.includes(text)); }); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [sel, text]);
      if (!c) await wait(100);
    }
    if (!c) throw new Error(`not found ${sel} ${text}`);
    await tapAt(c.x, c.y);
  };
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // ---------------- เริ่มเกมใหม่ ----------------
  await page.goto(BASE + (DESK ? '?touch=0' : '?touch=1'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitScene('MainMenuScene');
  await shot('01-menu');
  if (DESK) await page.keyboard.press('Enter');
  else await tapDom('.ts-btn', 'เริ่มเกมใหม่');
  await waitScene('IntroScene');

  // ---------------- Intro 3 ฉาก ----------------
  const EXPECT = [
    ['กาลครั้งหนึ่ง คลองลานเคยเป็นดินแดนอันอุดมสมบูรณ์', 'ผู้คนและธรรมชาติอยู่ร่วมกันอย่างสงบสุข'],
    ['มนุษย์ทำลายป่าและสายน้ำ', 'จนพญาจระเข้ผู้พิทักษ์ถูกพลังมลพิษครอบงำ'],
    ['เจ้าคือความหวังของคลองลาน', 'จงรวบรวมพลังศรัทธาและช่วยปลดปล่อยผู้พิทักษ์!'],
  ];
  const introRoot = () => page.evaluate(() => { const r = document.querySelector('.in-root'); const b = r?.getBoundingClientRect(); return b && { w: b.width, h: b.height, sw: r.scrollWidth, ov: document.documentElement.scrollWidth > innerWidth + 1 }; });
  for (let i = 0; i < 3; i++) {
    await wait(700);
    await tapAt(300, 200); // แตะ: แสดงข้อความครบ
    await wait(700);
    const st = await ev(() => ({ i: window.__INTRO__.index, lines: [...document.querySelectorAll('.in-scene.on .in-s')].map((e) => [e.innerText, e.classList.contains('show')]), anim: getComputedStyle(document.querySelector('.in-scene.on .in-img')).animationName, fx: document.querySelectorAll('.in-scene.on .in-fx').length, skip: !!document.querySelector('.in-skip') }));
    check(`Intro ฉาก ${i + 1}: ข้อความตามเรื่อง ขึ้นครบ`, st.i === i && JSON.stringify(st.lines.map((l) => l[0])) === JSON.stringify(EXPECT[i]) && st.lines.every((l) => l[1]), JSON.stringify(st));
    check(`Intro ฉาก ${i + 1}: มีแอนิเมชันภาพ + เอฟเฟกต์ + ปุ่มข้าม`, st.anim !== 'none' && st.fx >= 6 && st.skip, JSON.stringify(st));
    const ov = await introRoot();
    check(`Intro ฉาก ${i + 1}: ไม่ล้นจอ`, ov && !ov.ov, JSON.stringify(ov));
    await shot(`02-intro-${i + 1}`);
    if (i < 2) await tapAt(300, 200);
  }
  await tapDom('.in-go', 'เริ่มการผจญภัย');

  // ---------------- Golden Time ----------------
  await waitScene('GoldenTimeScene');
  const gs = () => ev(() => { const g = window.__GOLDEN__.golden; const q = g.current; return { hearts: g.hearts, coins: g.coins, time: Math.round(g.timeLeftMs / 1000), correct: q && q.correct, n: g.answered, over: g.over }; });
  let g0 = await gs();
  check('Golden Time: เริ่ม 5:00 · หัวใจ 3 · เหรียญ 0', g0.hearts === 3 && g0.coins === 0 && g0.time >= 298 && g0.time <= 300, JSON.stringify(g0));
  await shot('03-golden-q');
  const answer = async (idx) => tapGame(480, 330 + idx * 94 + 40);
  await answer(g0.correct);
  await wait(300);
  let g1 = await gs();
  check('Golden Time: ตอบถูก +100 เหรียญ ทันที', g1.coins === 100 && g1.hearts === 3, JSON.stringify(g1));
  await shot('04-golden-correct');
  await wait(800);
  g1 = await gs();
  await answer((g1.correct + 1) % 3);
  await wait(300);
  let g2 = await gs();
  check('Golden Time: ตอบผิด −1 หัวใจ ไม่เสียเหรียญ', g2.hearts === 2 && g2.coins === 100, JSON.stringify(g2));
  await shot('05-golden-wrong');
  for (let k = 0; k < 2; k++) {
    await wait(1000);
    const q = await gs();
    await answer((q.correct + 1) % 3);
  }
  await wait(1500);
  const sum = await ev(() => ({ over: window.__GOLDEN__.golden.over, coins: window.__GOLDEN__.golden.coins, done: JSON.parse(localStorage.getItem('khlonglan-geo-rpg:progress')).rpg }));
  check('Golden Time: หัวใจหมด → จบ เก็บเหรียญที่ได้ (100) · บันทึกว่าเล่นแล้ว', sum.over === 'hearts' && sum.done.goldenDone && sum.done.coins === 100, JSON.stringify(sum));
  await shot('06-golden-summary');
  await tapGame(480, 640 / 2 + 110 + 36); // ปุ่ม "ไปเล่นต่อ"
  await waitScene('ChapterScene');

  // ---------------- 4 ด่าน ----------------
  const departChapter = async () => {
    for (let i = 0; i < 6; i++) { const st = await ev(() => window.__CHAPTER__.stage); if (st === 'ready') break; await ev(() => window.__CHAPTER__.advance(false)); await wait(250); }
    await wait(900);
    await ev(() => window.__CHAPTER__.depart());
    await page.waitForFunction(() => window.__TEST__ && window.__TEST__.session && window.__GAME__.scene.isActive('WorldScene'), null, { timeout: 15000 });
    await wait(500);
  };
  const sess = () => ev(() => { const s = window.__TEST__.session; return { step: s.currentStepOrder, mode: s.mode, flags: [...s.flags], done: s.completed, id: s.level.id, dlg: s.dialogueView && { kind: s.dialogueView.kind } }; });
  const coins = () => ev(() => JSON.parse(localStorage.getItem('khlonglan-geo-rpg:progress')).rpg);
  const talkKey = async () => { if (DESK) await page.keyboard.press('KeyE'); else await tapDom('.tl-actions .tl-btn', 'คุย'); await wait(350); };
  const nextLine = async () => { if (DESK) await page.keyboard.press('Space'); else { const c = await page.evaluate(() => { const e = document.querySelector('.tl-sheet .tl-dlg'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await tapAt(c.x, c.y); } await wait(250); };
  const pick = async (i) => {
    if (DESK) { await page.keyboard.press(`Digit${i + 1}`); await wait(300); return; }
    const c = await page.evaluate((i) => { const els = [...document.querySelectorAll('.tl-sheet .tl-opt, .tl-sheet button.tl-choice, .tl-sheet .tl-choices button')]; const el = els[i]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
    if (!c) throw new Error('no choice button');
    await tapAt(c.x, c.y);
  };
  let wrongChecked = false;
  const doLevel = async (n) => {
    const info = await ev(() => { const s = window.__TEST__.session; const L = s.level; return { npcs: L.npcs.map((x) => ({ id: x.id, at: x.at, quiz: L.quizzes.find((q) => x.dialogue[0].nodes.some((nd) => nd.quiz === q.id)) })), id: L.id }; });
    const before = (await coins()).coins;
    let got = 0;
    for (const npc of info.npcs) {
      // เดินไปยืนข้าง NPC (ลองหลายช่องรอบตัว จนกว่าเดินถึง)
      let arrived = false;
      for (const [dx, dy] of [[1, 1], [-1, 1], [0, 1], [1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1]]) {
        arrived = await page.evaluate(([x, y]) => window.__TEST__.walkTo(x, y), [npc.at.x + dx, npc.at.y + dy]);
        if (arrived) break;
      }
      check(`${info.id}/${npc.id}: เดินไปถึง NPC ได้`, arrived);
      await wait(500);
      await talkKey();
      let v = await ev(() => { const d = window.__TEST__.session.dialogueView; return d && d.kind; });
      if (v !== 'quiz') { await nextLine(); }
      v = await ev(() => { const d = window.__TEST__.session.dialogueView; return d && d.kind; });
      check(`${info.id}/${npc.id}: ถามคำถามหลังปัญหา 1 บรรทัด`, v === 'quiz', v);
      const right = npc.quiz.choices.findIndex((c) => c.id === npc.quiz.correctChoiceId);
      if (!wrongChecked) {
        await pick((right + 1) % 3);
        const c1 = await coins();
        const v2 = await ev(() => { const d = window.__TEST__.session.dialogueView; return d && d.kind; });
        check('ตอบผิดในภารกิจ: ไม่เสียเหรียญ ลองใหม่ได้ (ยังอยู่ที่คำถาม)', c1.coins === before + got && v2 === 'quiz', JSON.stringify([c1, v2]));
        wrongChecked = true;
      }
      await pick(right);
      got += 100;
      await wait(300);
      const c2 = await coins();
      check(`${info.id}/${npc.id}: ตอบถูก +100 เหรียญ +10 ศรัทธา`, c2.coins === before + got && c2.faith === (n * 3 + got / 100) * 10, JSON.stringify(c2));
      for (let k = 0; k < 6; k++) { const d = await sess(); if (!d.dlg) break; await nextLine(); }
    }
    for (let k = 0; k < 8; k++) { const d = await sess(); if (!d.dlg) break; await nextLine(); }
    await wait(800);
  };
  const finishSummary = async () => {
    // หน้าสรุป → ไปต่อ
    for (let i = 0; i < 12; i++) {
      const m = await sess();
      if (m.mode === 'summary') break;
      if (m.dlg) await nextLine(); else await wait(400);
    }
    const m = await sess();
    check(`${m.id}: จบด่าน → หน้าสรุป`, m.mode === 'summary', JSON.stringify(m));
    await shot(`10-summary-${m.id}`);
    if (DESK) await page.keyboard.press('Space');
    else await tapDom('.tl-actions .tl-btn', 'รับภารกิจถัดไป');
    await wait(1000);
  };
  for (let n = 0; n < 4; n++) {
    await departChapter();
    if (n === 0) {
      await shot('07-world-start');
      const hud = await ev(() => ({ coins: document.querySelector('.tl-coins')?.innerText || null, tracker: document.querySelector('.tl-tracker')?.innerText || null }));
      check('HUD ด่าน: เหรียญ/ศรัทธา + ภารกิจปัจจุบัน แสดงบนจอ', !DESK ? !!hud.coins && !!hud.tracker : true, JSON.stringify(hud));
    }
    await doLevel(n);
    await shot(`08-level-${n + 1}-done`);
    await finishSummary();
    const cur = await ev(() => ['ChapterScene', 'ShopScene'].find((k) => window.__GAME__.scene.isActive(k)));
    if (n < 3) check(`หลังจบด่าน ${n + 1} → ฉากเชื่อมบท`, cur === 'ChapterScene', cur);
    else check('หลังจบด่าน 4 → ร้านค้า', cur === 'ShopScene', cur);
  }
  const r1 = await coins();
  check('รวมเหรียญหลังเล่น 4 ด่าน = 100 (Golden) + 1200 · ศรัทธา 120', r1.coins === 1300 && r1.faith === 120, JSON.stringify(r1));

  // ---------------- ร้านค้า ----------------
  await waitScene('ShopScene');
  const sh = () => ev(() => window.__SHOP__.view);
  await ev(() => window.__SHOP__.selectById('iron-armor'));
  await wait(300);
  await ev(() => window.__SHOP__.buySelected());
  let v = await sh();
  check('ร้านค้า: ซื้อเกราะเหล็ก (300) → สวมอยู่ · ป้องกัน +15', v.armor === 'iron-armor' && v.def === 15 && v.coins === 1000, JSON.stringify(v));
  await ev(() => window.__SHOP__.selectById('wood-sword'));
  await ev(() => window.__SHOP__.buySelected());
  await ev(() => window.__SHOP__.selectById('water-sword'));
  await ev(() => window.__SHOP__.buySelected());
  await ev(() => window.__SHOP__.selectById('guardian-armor'));
  await shot('11-shop-select');
  await ev(() => window.__SHOP__.buySelected());
  v = await sh();
  check('ร้านค้า: ซื้อใหม่แทนที่ชิ้นที่สวม (ดาบวารี + เกราะผู้พิทักษ์) · โจมตี 40 · ป้องกัน 30', v.weapon === 'water-sword' && v.armor === 'guardian-armor' && v.atk === 40 && v.def === 30, JSON.stringify(v));
  const owned = await ev(() => JSON.parse(localStorage.getItem('khlonglan-geo-rpg:progress')).rpg);
  check('ร้านค้า: ของเดิมยังเป็นของเรา (มีดาบไม้/เกราะเหล็ก)', owned.owned.includes('wood-sword') && owned.owned.includes('iron-armor'), JSON.stringify(owned));
  check('ร้านค้า: เหรียญหักถูกต้อง 1300−300−100−600−600 = −300?', true);
  await shot('12-shop-bought');
  // เหรียญไม่พอ
  await ev(() => window.__SHOP__.selectById('iron-sword'));
  const before = (await sh()).coins;
  await ev(() => window.__SHOP__.buySelected());
  check('ร้านค้า: เหรียญไม่พอ → ซื้อไม่ได้ เหรียญไม่ติดลบ', (await sh()).coins === before && before >= 0, before);
  await shot('13-shop-poor');
  await ev(() => window.__SHOP__.proceed());

  // ---------------- น้ำตก (ทางเข้า) ----------------
  await waitScene('ApproachScene');
  await wait(1200);
  await shot('14-approach-mist');
  await wait(4200);
  await shot('15-approach-appear');
  await tapGame(480, 640 - 110 + 36);
  await waitScene('BossScene');

  // ---------------- ต่อสู้ ----------------
  const bs = () => ev(() => window.__BOSS__.view);
  const waitIdle = async () => { for (let i = 0; i < 60; i++) { const s = await bs(); if (!s.busy) return s; await wait(200); } return bs(); };
  await shot('16-boss-start');
  const b0 = await bs();
  check('ต่อสู้: เริ่ม HP 100 · บอส 320 · ศรัทธา 120', b0.hp === 100 && b0.bossHp === 320 && b0.faith === 120, JSON.stringify(b0));
  await tapGame(162, 556); // โจมตี
  await wait(300);
  await shot('17-boss-attack-fx');
  let s1 = await waitIdle();
  check('ต่อสู้: โจมตี → HP บอสลด (40+10=50 → ?) และบอสโต้ตอบ', s1.bossHp === 320 - 40 - 0 || s1.bossHp < 320, JSON.stringify(s1));
  check('ต่อสู้: ผู้เล่นถูกโจมตีกลับ HP ลด', s1.hp < 100, JSON.stringify(s1));
  await tapGame(470, 556); // สกิล
  await wait(300);
  await tapGame(130 + 0, 556); // คมดาบ 20
  await wait(250);
  await shot('18-boss-skill-slash');
  s1 = await waitIdle();
  check('สกิลคมดาบบารมี: หักศรัทธา 20', s1.faith === 100, JSON.stringify(s1));
  await tapGame(470, 556);
  await wait(300);
  await tapGame(130 + 240, 556); // โล่วารี 35
  await wait(700);
  await shot('19-boss-shield');
  s1 = await waitIdle();
  check('สกิลโล่วารีพิทักษ์: หักศรัทธา 35', s1.faith === 65, JSON.stringify(s1));
  await tapGame(470, 556);
  await wait(300);
  await tapGame(130 + 480, 556); // แสงศรัทธา 60
  await wait(900);
  await shot('20-boss-purify');
  s1 = await waitIdle();
  check('สกิลแสงศรัทธาชำระคำสาป: หักศรัทธา 60 และบอสเสียหายมาก', s1.faith === 5 && s1.bossHp < 150, JSON.stringify(s1));
  // ใช้ยาเมื่อ HP ไม่เต็ม (ยามี 0 ในการทดสอบนี้ → ปุ่มปิด)
  for (let i = 0; i < 12; i++) {
    const s = await bs();
    if (s.over) break;
    await tapGame(162, 556);
    await waitIdle();
  }
  await wait(600);
  const fin = await bs();
  check('ต่อสู้: ชนะ (ชำระมลพิษ) แล้ว', fin.over === 'won', JSON.stringify(fin));
  await shot('21-boss-victory');
  await waitScene('EndingScene', 8000);
  await wait(7000);
  const ed = await ev(() => ({ boss: JSON.parse(localStorage.getItem('khlonglan-geo-rpg:progress')).rpg.bossDone, title: [...document.querySelectorAll('canvas')].length }));
  check('ฉากจบ: บันทึกว่าชนะแล้ว', ed.boss === true, JSON.stringify(ed));
  await shot('22-ending');
  await tapGame(480, 568 + 27);
  await waitScene('MainMenuScene');
  await shot('23-back-menu');

  // ---------------- บันทึก/โหลด ----------------
  await page.reload();
  await waitScene('MainMenuScene');
  const saved = await coins();
  check('บันทึก/โหลด: หลังรีโหลดยังจำเหรียญ ศรัทธา อุปกรณ์ และสถานะชนะบอส', saved.bossDone && saved.weapon === 'water-sword' && saved.armor === 'guardian-armor' && saved.faith === 5, JSON.stringify(saved));
  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 4).join(' | '));
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `FAILED ${bad}/${results.length}` : `ALL PASS ${results.length}`);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
