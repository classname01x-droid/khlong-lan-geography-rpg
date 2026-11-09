// ทดสอบเบราว์เซอร์เพิ่มเติม (ทางลัดด้วยการใส่ข้อมูลบันทึก): Golden Time ตอบผิดหมด/หมดเวลา · เหรียญไม่พอในร้านค้า ·
// แพ้บอส → ลองใหม่ (ทรัพยากรคืน บอสอ่อนลง) · ใช้ยา/ศรัทธาไม่พอ · บันทึกเก่าไม่ค้าง
//   node tests/e2e/rpg-e2e-extra.cjs <outDir> [desktop | "iPhone 13 landscape"]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/e2e';
const DEV = process.argv[3] || 'desktop';
const BASE = process.env.BASE || 'http://localhost:5173/';
const DESK = DEV === 'desktop';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (n, ok, extra = '') => {
  results.push(ok);
  console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : String(extra));
};
const KEY = 'khlonglan-geo-rpg:progress';
const base = (rpg) => ({
  version: 2,
  storyVersion: 3,
  completed: Object.fromEntries(['sakngam', 'level-2', 'level-3', 'level-4'].map((id) => [id, { levelId: id, completedAt: 'x', distanceMeters: 1, cluesFound: 0, cluesTotal: 0, mistakes: 0, elapsedMs: 1, skills: [], codePiece: null }])),
  unlocked: ['sakngam', 'level-2', 'level-3', 'level-4', 'shop'],
  codePieces: {},
  inProgress: {},
  rpg: { coins: 0, faith: 0, potions: 0, owned: [], weapon: null, armor: null, rewarded: [], goldenDone: true, goldenCoins: 0, shopDone: false, bossDone: false, bossLosses: 0, ...rpg },
});

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
  const shot = async (n) => { await wait(250); await page.screenshot({ path: `${OUT}/${tag}-x-${n}.png` }); };
  const waitScene = async (k, ms = 15000) => { await page.waitForFunction((k) => window.__GAME__ && window.__GAME__.scene.isActive(k), k, { timeout: ms }); await wait(400); };
  const canvasRect = () => page.evaluate(() => { const c = window.__GAME__.canvas.getBoundingClientRect(); return { x: c.left, y: c.top, s: c.width / 960 }; });
  const tapGame = async (gx, gy) => { const c = await canvasRect(); const x = c.x + gx * c.s; const y = c.y + gy * c.s; if (DESK) await page.mouse.click(x, y); else await page.touchscreen.tap(x, y); await wait(300); };
  const go = async (scene, rpg) => {
    await page.goto(BASE + (DESK ? '?touch=0' : '?touch=1'));
    await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, base(rpg)]);
    await page.reload();
    await page.waitForFunction(() => window.__GAME__ && window.__GAME__.scene.isActive('MainMenuScene'));
    await page.evaluate((s) => window.__GAME__.scene.getScene('MainMenuScene').scene.start(s), scene);
    await waitScene(scene);
  };
  const rpg = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).rpg, KEY);

  // ---- Golden Time: ตอบผิดทุกข้อ ----
  await page.goto(BASE + (DESK ? '?touch=0' : '?touch=1'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.scene.isActive('MainMenuScene'));
  await page.evaluate(() => window.__GAME__.scene.getScene('MainMenuScene').scene.start('GoldenTimeScene'));
  await waitScene('GoldenTimeScene');
  for (let i = 0; i < 3; i++) {
    const q = await page.evaluate(() => window.__GOLDEN__.golden.current.correct);
    await tapGame(480, 330 + ((q + 1) % 3) * 94 + 40);
    await wait(1100);
  }
  const all = await page.evaluate(() => ({ over: window.__GOLDEN__.golden.over, hearts: window.__GOLDEN__.golden.hearts, coins: window.__GOLDEN__.golden.coins }));
  check('Golden Time ตอบผิดทุกข้อ: หัวใจหมด จบ ไม่ได้เหรียญ ไม่ติดลบ', all.over === 'hearts' && all.hearts === 0 && all.coins === 0, JSON.stringify(all));
  await shot('01-golden-all-wrong');
  const r0 = await rpg();
  check('Golden Time: บันทึกว่าเล่นแล้ว (ครั้งเดียว) และเหรียญ 0', r0.goldenDone && r0.coins === 0, JSON.stringify(r0));
  await tapGame(480, 640 / 2 + 110 + 36);
  await waitScene('ChapterScene');

  // ---- Golden Time: หมดเวลา → จบ เก็บเหรียญที่ได้ ----
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.scene.isActive('MainMenuScene'));
  await page.evaluate(() => window.__GAME__.scene.getScene('MainMenuScene').scene.start('GoldenTimeScene'));
  await waitScene('GoldenTimeScene');
  const q1 = await page.evaluate(() => window.__GOLDEN__.golden.current.correct);
  await tapGame(480, 330 + q1 * 94 + 40);
  await wait(900);
  await page.evaluate(() => { window.__GOLDEN__.golden.timeLeftMs = 31000; });
  await wait(1600);
  const low = await page.evaluate(() => ({ low: window.__GOLDEN__.golden.lowTime, col: window.__GOLDEN__.children.list.some((c) => c.type === 'Text' && c.style && c.style.color === '#ff5a5a') }));
  check('Golden Time: เหลือ ≤ 30 วินาที → ตัวเลขเวลาเปลี่ยนเป็นสีแดง', low.low && low.col, JSON.stringify(low));
  await shot('02-golden-lowtime');
  await page.evaluate(() => { window.__GOLDEN__.golden.timeLeftMs = 400; });
  await wait(1500);
  const t = await page.evaluate(() => ({ over: window.__GOLDEN__.golden.over, coins: window.__GOLDEN__.golden.coins }));
  check('Golden Time หมดเวลา: จบ เก็บเหรียญที่ได้ (100)', t.over === 'time' && t.coins === 100 && (await rpg()).coins === 100, JSON.stringify(t));

  // ---- ร้านค้า: เหรียญไม่พอ ----
  await go('ShopScene', { coins: 90, faith: 20 });
  await page.evaluate(() => window.__SHOP__.selectById('wood-sword'));
  await page.evaluate(() => window.__SHOP__.buySelected());
  const sp = await rpg();
  check('ร้านค้า เหรียญ 90 ซื้อดาบไม้ (100) ไม่ได้ · เหรียญไม่ติดลบ · ไม่มีของเพิ่ม', sp.coins === 90 && sp.owned.length === 0, JSON.stringify(sp));
  await shot('03-shop-poor');
  await page.evaluate(() => window.__SHOP__.selectById('potion'));
  await page.evaluate(() => window.__SHOP__.buySelected());
  const sp2 = await rpg();
  check('ร้านค้า: ซื้อยา 50 เหรียญได้ (เหลือ 40) ยา 1 ขวด', sp2.coins === 40 && sp2.potions === 1, JSON.stringify(sp2));
  await page.evaluate(() => window.__SHOP__.proceed());
  await waitScene('ApproachScene');

  // ---- ต่อสู้: สกิลคมดาบบารมีหักศรัทธา 20 ----
  await go('BossScene', { coins: 0, faith: 40, potions: 0, shopDone: true });
  {
    const bs0 = () => page.evaluate(() => window.__BOSS__.view);
    await tapGame(470, 556);
    await wait(250);
    await tapGame(130, 556);
    for (let i = 0; i < 60; i++) { const v = await bs0(); if (!v.busy) break; await wait(150); }
    const v = await bs0();
    check('สกิลคมดาบบารมี: หักศรัทธา 20 (40 → 20) และบอสเสียหาย 25', v.faith === 20 && v.bossHp === 320 - 25, JSON.stringify(v));
  }

  // ---- ต่อสู้: แพ้ → ลองใหม่ ----
  await go('BossScene', { coins: 0, faith: 0, potions: 0, shopDone: true });
  const bs = () => page.evaluate(() => window.__BOSS__.view);
  const idle = async () => { for (let i = 0; i < 80; i++) { const s = await bs(); if (!s.busy) return s; await wait(150); } return bs(); };
  await tapGame(470, 556);
  await wait(200);
  await tapGame(130, 556); // สกิลคมดาบ ศรัทธา 0 → ใช้ไม่ได้ ไม่ถูกลงโทษ
  await wait(300);
  let s = await bs();
  check('สกิลเมื่อศรัทธาไม่พอ: ใช้ไม่ได้ ไม่เสียตา ไม่เสียอะไร', s.faith === 0 && s.hp === 100 && s.bossHp === 320, JSON.stringify(s));
  await tapGame(850, 556); // ← กลับ
  await wait(300);
  for (let i = 0; i < 60; i++) {
    s = await bs();
    if (s.over) break;
    await tapGame(162, 556);
    await idle();
  }
  s = await bs();
  check('ต่อสู้โดยไม่มีอุปกรณ์/ยา/ศรัทธา: แพ้ได้ (ไม่ใช่ชนะทันที)', s.over === 'lost', JSON.stringify(s));
  await wait(800);
  await shot('04-boss-defeat');
  const lost = await rpg();
  check('แพ้แล้วบันทึกครั้งที่แพ้ 1 · ทรัพยากรไม่หาย (เหรียญ/ศรัทธา/ยาเท่าเดิม)', lost.bossLosses === 1 && lost.coins === 0 && lost.faith === 0 && lost.potions === 0 && !lost.bossDone, JSON.stringify(lost));
  await tapGame(260, 560); // ลองอีกครั้ง
  await wait(900);
  s = await bs();
  check('ลองอีกครั้ง: HP เต็มอีกครั้ง บอสอ่อนลง (288) ไม่ตัน', s.hp === 100 && s.bossHp === 288 && !s.over, JSON.stringify(s));
  // แพ้อีก 4 ครั้งเพื่อให้ถึงขีดสุดแล้วชนะได้แม้ไม่มีอะไรเลย
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < 70; i++) {
      s = await bs();
      if (s.over) break;
      await tapGame(162, 556);
      await idle();
    }
    s = await bs();
    if (s.over === 'won') break;
    await wait(600);
    await tapGame(260, 560);
    await wait(900);
  }
  s = await bs();
  check('ลองซ้ำหลายรอบ: สุดท้ายชนะได้แม้ไม่มีอุปกรณ์/ยา/ศรัทธา (ไม่มี soft-lock)', s.over === 'won', JSON.stringify(s));
  await waitScene('EndingScene', 8000);
  await wait(7000);
  await shot('05-ending');
  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 4).join(' | '));
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `FAILED ${bad}/${results.length}` : `ALL PASS ${results.length}`);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
