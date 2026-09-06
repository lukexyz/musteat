// Browser smoke test for MustEat. Serves ../index.html over http, drives it in
// headless Chromium and checks the things the Node harness cannot see:
// modal visibility, real clicks on re-rendered buttons, clipboard, two tabs
// talking through localStorage, reload persistence, mobile overflow.
//   node smoke.js            (headless)
//   node smoke.js --headed   (watch it)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HEADED = process.argv.includes('--headed');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); } };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const file = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
      fs.readFile(file, (err, data) => {
        if (err) { rsp.writeHead(404); return rsp.end(); }
        if (file.endsWith('.html')) data = data.toString('utf8').replace(/SHEET_API: '[^']*'/, "SHEET_API: ''"); // tests run the local mock whatever the page is wired to
        rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(data);
      });
    }).listen(0, '127.0.0.1', () => res({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/index.html' }));
  });
}

// A fresh player lands on the splash. Tap it rather than wait five seconds, then wait for registration.
const skip = async page => { await page.waitForSelector('#intro:not([hidden])', { timeout: 5000 }); await page.click('#intro'); await page.waitForSelector('#modal:not([hidden])'); };
async function register(page, name, dept) {
  if (await page.$('#intro:not([hidden])')) await skip(page);
  await page.waitForSelector('#modal:not([hidden])');
  await page.fill('#nm', name);
  if (dept) await page.selectOption('#dept', dept);
  await page.click('#go');
}
const save = async (page, slot) => JSON.parse(await page.evaluate(k => localStorage.getItem(k), 'musteat_save' + (slot ? '_' + slot : '')));
// The game saves on beforeunload, so patch the save from an init script that runs on the next load instead.
const patchSave = async (page, slot, fn) => { await page.evaluate(([k, src]) => localStorage.setItem('__patch', JSON.stringify({ k, src })), ['musteat_save' + (slot ? '_' + slot : ''), fn]); await page.reload(); };
const PATCH_INIT = () => { try { const p = JSON.parse(localStorage.getItem('__patch')); if (p) { localStorage.removeItem('__patch'); const s = JSON.parse(localStorage.getItem(p.k)); (new Function('s', p.src))(s); localStorage.setItem(p.k, JSON.stringify(s)); } } catch (e) { console.error('patch failed', e); } };

(async () => {
  const { srv, url } = await serve();
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
  const errors = [];
  ctx.on('page', p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); });

  console.log('registration');
  const p1 = await ctx.newPage();
  await p1.addInitScript(PATCH_INIT);
  await p1.goto(url);
  ok('noir splash first: 2099, everyone must eat, tap to skip', await p1.isVisible('#intro') && /2099/.test(await p1.textContent('#intro')) && /EVERYONE MUST EAT/.test(await p1.textContent('#intro')) && !(await p1.isVisible('#modal')));
  await skip(p1);
  ok('intro modal shown after the splash', await p1.isVisible('#modal') && !(await p1.isVisible('#intro')));
  ok('body not scrollable horizontally', await p1.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await register(p1, 'Ada', 'Engineering');
  ok('modal hidden after START RUNNING', !(await p1.isVisible('#modal')));
  await p1.waitForFunction(() => /Ada/.test(document.getElementById('rank').textContent));
  ok('rank box shows name + dept', /Ada.*Runner.*Engineering/s.test(await p1.textContent('#rank')));
  await p1.waitForFunction(() => /citizens/.test(document.getElementById('company').textContent));
  ok('company shows 1 citizen', /\b1\b.*citizens/s.test(await p1.textContent('#company')));

  console.log('tapping');
  for (let i = 0; i < 15; i++) await p1.click('#run');
  await p1.waitForTimeout(300);
  ok('15 taps = 15 deliveries', (await p1.textContent('#deliv')) === '15', await p1.textContent('#deliv'));
  ok('taps earned credits', parseFloat((await p1.textContent('#cash')).replace(/[^0-9.]/g, '')) > 45, await p1.textContent('#cash'));
  ok('gang tax shown while you have no runners', !(await p1.evaluate(() => document.getElementById('gang').hidden)) && /\(−15%\)/.test(await p1.textContent('#ips')), await p1.textContent('#ips'));
  ok('order text rendered', /for /.test(await p1.textContent('#order')));

  console.log('clicks on re-rendered buttons');
  const trainers = p1.locator('[data-buy="trainers"]');
  await p1.waitForFunction(() => !document.querySelector('[data-buy="trainers"]').disabled);
  const box = await trainers.boundingBox();
  await p1.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p1.mouse.down(); await p1.waitForTimeout(400); await p1.mouse.up();
  await p1.waitForTimeout(300);
  const gearLvl = async () => (await p1.textContent('[data-buy="trainers"]')) && (await p1.evaluate(() => document.querySelector('[data-buy="trainers"]').closest('.item').querySelector('.lvl').textContent));
  ok('slow click (held 400ms) on gear button registers', (await gearLvl()) === '×1', await gearLvl());
  await patchSave(p1, '', 's.cash = 200');
  ok('no modal after reload (still registered)', !(await p1.isVisible('#modal')));
  await p1.click('[data-buy="trainers"]');
  await p1.waitForTimeout(100);
  ok('fast click on gear button registers', (await gearLvl()) === '×2', await gearLvl());

  console.log('shop');
  await patchSave(p1, '', 's.cash = 6000');
  await p1.click('[data-act="shop"]');
  ok('shop dialog opens', await p1.isVisible('#confirm'));
  await p1.fill('#shopName', 'Test Kebab');
  await p1.click('#confirm');
  ok('shop dialog closes', !(await p1.isVisible('#modal')));
  await p1.waitForFunction(() => /Test Kebab/.test(document.getElementById('shop').textContent));
  const link = await p1.textContent('#shop .link');
  ok('invite link shown with ?ref=', /\?ref=[A-Z0-9]+/.test(link), link);
  const code = (link.match(/ref=([A-Z0-9]+)/) || [])[1];
  await p1.click('#shop [data-act="share"]');
  await p1.waitForSelector('.toast');
  const clip = await p1.evaluate(() => navigator.clipboard.readText());
  ok('share copies message containing link', clip.includes('?ref=' + code), clip);
  ok('dev link carries a fresh slot so it opens as a new player here', /&slot=\d{7}/.test(clip) && /&slot=\d{7}/.test(link) && clip.match(/&slot=(\d+)/)[1] !== link.match(/&slot=(\d+)/)[1], clip);
  await p1.reload();
  ok('shop survives reload', /Test Kebab/.test(await p1.textContent('#shop')));
  ok('rank now Shop Owner', /Shop Owner/.test(await p1.textContent('#rank')));

  console.log('cookie clicker layer: bulk buy, upgrades, crates, retirement');
  await patchSave(p1, '', 's.cash = 1e6');
  await p1.click('[data-qty="10"]');
  ok('bulk buy button shows x10 price', /×10/.test(await p1.textContent('[data-buy="trainers"]')), await p1.textContent('[data-buy="trainers"]'));
  await p1.click('[data-buy="trainers"]');
  await p1.waitForTimeout(100);
  ok('x10 buys ten levels', (await gearLvl()) === '×12', await gearLvl());
  ok('next gear tier visible, one classified', /Hoverbike/.test(await p1.textContent('#gear')) && /\?\?\?/.test(await p1.textContent('#gear')) && !/Teleport/.test(await p1.textContent('#gear')));
  ok('upgrade unlocked by owning trainers', await p1.isVisible('[data-upg="trainers1"]'));
  const ipsBefore = parseFloat((await p1.textContent('#ips')).replace(/[^0-9.]/g, ''));
  await p1.click('[data-upg="trainers1"]');
  await p1.waitForTimeout(100);
  ok('upgrade bought and gone from the store', !(await p1.isVisible('[data-upg="trainers1"]')) && /1 of \d+ upgrades bought/.test(await p1.textContent('#upgrades')), await p1.textContent('#upgrades'));
  const ipsAfter = parseFloat((await p1.textContent('#ips')).replace(/[^0-9.]/g, ''));
  ok('upgrade raised income per second', ipsAfter > ipsBefore, [ipsBefore, ipsAfter]);
  ok('commendations card counts some', /\b[1-9]\d* of \d+ commendations/.test(await p1.textContent('#ach')), await p1.textContent('#ach'));
  ok('no revenue readout before the bookkeeping upgrade', !(await p1.$('#gear .rev')) && !(await p1.isVisible('[data-upg="ledger"]')));
  await patchSave(p1, '', 's.created = Date.now() - 4 * 60000');
  await p1.waitForSelector('[data-upg="ledger"]');
  ok('bookkeeping card carries the effect, gear rows do not', !!(await p1.$('#upgrades .up.ledger')) && !(await p1.$('#gear .ledger')));
  await p1.click('[data-upg="ledger"]');
  await p1.waitForSelector('#gear .rev');
  ok('reveal sequence: digit wipe over the gear list and neon readouts', !!(await p1.$('#gear .rainwipe')) && !!(await p1.$('#gear .rev.neon')));
  ok('bookkeeping bought: per-line revenue and share shown', /of income/.test(await p1.textContent('#gear')) && /₵[\d.]+K?\/s/.test(await p1.textContent('#gear .rev')));
  await patchSave(p1, '', 's.crateAt = Date.now() + 300');
  await p1.waitForSelector('#crate:not([hidden])', { timeout: 5000 });
  ok('unmarked crate appears when due', await p1.isVisible('#crate'));
  await p1.click('#crate', { force: true }); // it pulses, so it is never 'stable'
  await p1.waitForTimeout(100);
  ok('crate collected and logged', !(await p1.isVisible('#crate')) && /Unmarked ration crate/.test(await p1.textContent('#log')));
  ok('first crate explains itself and pays', /note says/.test(await p1.textContent('#modalBox')) && /Lunch Rush/.test(await p1.textContent('#modalBox')), await p1.textContent('#modalBox'));
  await p1.click('#ok');
  await patchSave(p1, '', 's.fx = { viral: Date.now() + 20000, rush: Date.now() + 60000 }');
  await p1.waitForSelector('#fx span[data-tip]');
  ok('effect chips carry tooltips', /Viral/.test(await p1.textContent('#fx')) && /Lunch Rush/.test(await p1.textContent('#fx')) && /Deliveries ×2/.test(await p1.getAttribute('#fx span[data-tip]', 'title')));
  await p1.click('#fx span[data-tip]');
  await p1.waitForSelector('.toast');
  ok('tapping a chip explains it', /Deliveries ×2/.test(await p1.textContent('.toast')));
  await p1.waitForFunction(() => /Finders Keepers/.test(document.getElementById('ach').textContent), null, { timeout: 3000 }).catch(() => {});
  ok('crate commendation awarded', /Finders Keepers/.test(await p1.textContent('#ach')));
  await p1.click('[data-qty="1"]');

  console.log('franchise: offer, takeover in another tab, trophy cabinet, ministry sale');
  await patchSave(p1, '', 's.total = 1e9');
  ok('franchise button shows 4 stamps for 1B lifetime', /Franchise to a colleague \(\+4 stamps/.test(await p1.textContent('[data-act="franchise"]')), await p1.textContent('[data-act="franchise"]'));
  ok('ministry sale not worth it yet', await p1.evaluate(() => document.querySelector('[data-act="ministry"]').disabled));
  await p1.click('[data-act="franchise"]');
  await p1.waitForSelector('.toast');
  const frClip = await p1.evaluate(() => navigator.clipboard.readText());
  ok('offer message copied with ?fr= link and gear', frClip.includes('?fr=' + code) && /Hazmat Trainers/.test(frClip), frClip);
  ok('offer shown as pending', /Offer out since/.test(await p1.textContent('#franchise')) && /Test Kebab №2/.test(await p1.textContent('#franchise')));
  const p5 = await ctx.newPage();
  await p5.addInitScript(PATCH_INIT);
  await p5.goto(url + '?slot=5&fr=' + code);
  await skip(p5);
  ok('intro shows the handover offer', /Ada.*handing you.*Test Kebab №2/s.test(await p5.textContent('#modalBox')), await p5.textContent('#modalBox'));
  await p5.fill('#nm', 'Kim'); await p5.click('#go');
  await p5.waitForFunction(() => !document.getElementById('recruiter').hidden);
  ok('franchisee banner names the franchisor', /franchise of.*Ada/s.test(await p5.textContent('#recruiter')), await p5.textContent('#recruiter'));
  ok('franchisee got the gear and the shop', /×12/.test(await p5.textContent('#gear')) && /Test Kebab №2/.test(await p5.textContent('#shop')));
  for (let i = 0; i < 3; i++) await p5.click('#run');
  await p1.bringToFront();
  await p1.click('[data-act="refresh"]');
  await p1.waitForFunction(() => /took over/.test(document.getElementById('log').textContent), null, { timeout: 8000 });
  ok('handover modal shown to the franchisor', /Kim took over Test Kebab №2/.test(await p1.textContent('#modalBox')));
  await p1.click('#ok');
  ok('portfolio tab opened with the trophy', !(await p1.evaluate(() => document.getElementById('tab-portfolio').hidden)) && /Test Kebab №2/.test(await p1.textContent('#portfolio')) && /Franchised to.*Kim/s.test(await p1.textContent('#portfolio')));
  ok('trophy lists the gear it had and live status', /Hazmat Trainers ×12/.test(await p1.textContent('#portfolio')) && /Open/.test(await p1.textContent('#portfolio')), await p1.textContent('#portfolio'));
  ok('franchisor reset: 4 stamps, gear gone, shop and cash kept', /Ration Stamps: 4/.test(await p1.textContent('#franchise')) && (await gearLvl()) === '×0' && /Test Kebab/.test(await p1.textContent('#shop')));
  ok('franchisee counted as a runner with royalty', /Kim/.test(await p1.textContent('#shop')));
  await p1.click('[data-tab="run"]');
  ok('run tab back', !(await p1.evaluate(() => document.getElementById('tab-run').hidden)));
  await patchSave(p1, '', 's.total = 1e11; s.gear = { trainers: 3 }');
  ok('ministry sale enabled once worth a quarter', !(await p1.evaluate(() => document.querySelector('[data-act="ministry"]').disabled)), await p1.textContent('[data-act="ministry"]'));
  await p1.click('[data-act="ministry"]');
  ok('ministry dialog names the price', /Sell to the Ministry\?/.test(await p1.textContent('#modalBox')));
  await p1.click('#confirm');
  await p1.waitForTimeout(100);
  ok('sold: 12 stamps, grey trophy in the cabinet', /Ration Stamps: 12/.test(await p1.textContent('#franchise')) && (await p1.evaluate(() => { document.querySelector('[data-tab="portfolio"]').click(); return /Sold to the Ministry/.test(document.getElementById('portfolio').textContent) && document.querySelectorAll('#portfolio .trophy').length === 2; })));
  await p1.click('[data-tab="run"]');
  await patchSave(p5, '5', 's.total = 150000');
  await p5.waitForFunction(() => /passed ₵100K/.test(document.getElementById('log').textContent), null, { timeout: 5000 });
  await p1.bringToFront(); await p1.click('[data-act="refresh"]');
  await p1.waitForFunction(() => /past.*₵100K/.test(document.getElementById('company').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('franchise milestone posted to the company feed', /Kim.*past.*₵100K.*Ada gets 25%/s.test(await p1.textContent('#company')), await p1.textContent('#company').then(t => t.slice(0, 400)));
  await p5.close();

  console.log('second citizen recruited in another tab');
  const p2 = await ctx.newPage();
  await p2.goto(url + '?slot=2&ref=' + code + '&v=Sam');
  await skip(p2);
  ok('intro names the referral code', new RegExp(code).test(await p2.textContent('#modalBox')));
  ok('voucher pre-fills name', (await p2.inputValue('#nm')) === 'Sam');
  await p2.click('#go');
  await p2.waitForFunction(() => !document.getElementById('recruiter').hidden);
  ok('recruit banner names the owner', /running for.*Ada/s.test(await p2.textContent('#recruiter')));
  ok('voucher bonus credited', (await save(p2, '2')).cash >= 250, (await save(p2, '2')).cash);
  for (let i = 0; i < 3; i++) await p2.click('#run');
  await p1.bringToFront();
  await p1.waitForFunction(() => /Sam/.test(document.getElementById('shop').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('owner sees Sam in runners table', /Sam/.test(await p1.textContent('#shop')));
  ok('owner log notes the arrival', /Sam.*joined as your runner/.test(await p1.textContent('#log')));
  ok('gang tax lifted once a runner arrives', await p1.evaluate(() => document.getElementById('gang').hidden) && /Extortion tax lifted/.test(await p1.textContent('#log')), await p1.textContent('#ips'));
  ok('leaderboard lists both', /Ada/.test(await p1.textContent('#board')) && /Sam/.test(await p1.textContent('#board')));
  await p2.click('[data-act="complain"]');
  await p2.waitForSelector('.toast');
  ok('complaint copied', /Ada/.test(await p2.evaluate(() => navigator.clipboard.readText())));
  await p1.waitForFunction(() => /recruited by/.test(document.getElementById('company').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('feed renders structured join event', /Sam.*was recruited by.*Ada/s.test(await p1.textContent('#company')), await p1.textContent('#company'));

  console.log('sprint score: locks at thirty minutes of play');
  ok('sprint clock shown while it runs', /Sprint clock \d+ min/.test(await p1.textContent('#rank')), await p1.textContent('#rank'));
  await patchSave(p1, '', 's.played = 1799.9');
  await p1.waitForFunction(() => /Sprint score/.test(document.getElementById('log').textContent), null, { timeout: 5000 });
  await p1.waitForFunction(() => (JSON.parse(localStorage.musteat_save) || {}).sprint != null, null, { timeout: 8000 }); // the save runs every five seconds
  const sp = await save(p1, '');
  ok('sprint score locked at lifetime total', sp.sprint > 0 && sp.sprint === Math.floor(sp.total) && /Sprint score ₵/.test(await p1.textContent('#rank')), JSON.stringify([sp.sprint, sp.total]));
  await p1.click('[data-act="refresh"]');
  await p1.waitForFunction(() => /Sprint/.test(document.getElementById('board').textContent));
  ok('board has a Sprint column with Ada locked and Sam still on the clock', /Sprint/.test(await p1.textContent('#board')) && /min in/.test(await p1.textContent('#board')), await p1.textContent('#board').then(t => t.slice(0, 300)));

  console.log('ledger: who paid whom');
  const led = await p1.evaluate(() => JSON.parse(localStorage.musteat_sheet).ledger || []);
  ok('cut from Sam to Ada written as a level 1 row', led.some(r => r.fromName === 'Sam' && r.toName === 'Ada' && r.level === 1 && r.kind === 'cut' && r.amount > 0), JSON.stringify(led.slice(-3)));
  ok('royalty from Kim written as a franchise row', led.some(r => r.fromName === 'Kim' && r.kind === 'royalty' && r.level === 'F'), JSON.stringify(led.filter(r => r.fromName === 'Kim')));
  await p1.click('[data-tab="portfolio"]');
  ok('empire pyramid: you on top, Sam on L1, share of income shown', /Ada[\s\S]*L1[\s\S]*Sam/.test(await p1.textContent('#pfEmpire')) && /earned by someone else/.test(await p1.textContent('#pfEmpire')), await p1.textContent('#pfEmpire').then(t => t.slice(0, 300)));
  ok("portfolio lists Sam's business and the cut taken", /Sam/.test(await p1.textContent('#pfRunners')) && /L1/.test(await p1.textContent('#pfRunners')) && /You get/.test(await p1.textContent('#pfRunners')) && /Your cut, all time[\s\S]*₵[1-9]/.test(await p1.textContent('#pfRunners')), await p1.textContent('#pfRunners').then(t => t.slice(0, 300)));
  await p1.click('[data-tab="run"]');
  ok('board shows From runners for Ada', /From runners/.test(await p1.textContent('#board')) && /Ada[\s\S]*?₵[\d.]+K?[\s\S]*?₵[\d.]+/.test(await p1.textContent('#board tr.me')));
  const pl = await ctx.newPage();
  await pl.goto(url.replace('index.html', 'ledger.html'));
  await pl.waitForFunction(() => /Ada/.test(document.getElementById('top').textContent));
  ok('ledger page ranks Ada as top earner from runners', /1[\s\S]*Ada/.test(await pl.textContent('#top')));
  ok('ledger page lists Sam and Kim as contributors', /Sam/.test(await pl.textContent('#payers')) && /Kim/.test(await pl.textContent('#payers')));
  ok('ledger page shows who pays whom', /Ada[\s\S]*Sam[\s\S]*L1/.test(await pl.textContent('#pairs')));
  await pl.click('[data-order="sprint"]');
  ok('ledger page can rank by sprint', /Sprint/.test(await pl.textContent('#scores')) && (await pl.getAttribute('[data-order="sprint"]', 'class')) === 'on');
  ok('ledger page has recent entries and no overflow', (await pl.$$('#recent tr')).length >= 2 && await pl.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await pl.close();

  console.log('feed is safe against a hostile row in the shared table');
  await p1.evaluate(() => { const db = JSON.parse(localStorage.musteat_sheet); db.events.push({ id: 'evil', ts: Date.now(), pid: 'x', who: '<img src=x onerror="window.__pwned=1">', kind: 'shop', arg: '<b>bold</b>', text: '' }); localStorage.musteat_sheet = JSON.stringify(db); });
  await p1.click('[data-act="refresh"]');
  await p1.waitForFunction(() => /bold/.test(document.getElementById('company').textContent));
  ok('hostile who/arg shown as text, not markup', !(await p1.evaluate(() => document.querySelector('#company img') || window.__pwned)) && /&lt;b&gt;bold/.test(await p1.innerHTML('#company')));

  console.log('rename keeps the pyramid');
  await p1.click('[data-act="rename"]');
  ok('rename dialog shows the code that stays', new RegExp(code).test(await p1.textContent('#modalBox')) && await p1.isVisible('#rnShop'));
  await p1.fill('#rnName', "Ada and Bo's Big Dog Kitchen"); await p1.fill('#rnShop', 'Big Dog Kitchen');
  await p1.click('#confirm');
  await p1.waitForFunction(() => /Big Dog Kitchen/.test(document.getElementById('rank').textContent));
  ok('rank box shows the new name', /Ada and Bo's Big Dog Kitchen/.test(await p1.textContent('#rank')));
  ok('runners table still lists Sam and Kim under the renamed shop', /Big Dog Kitchen/.test(await p1.textContent('#shop')) && /Sam/.test(await p1.textContent('#shop')) && /Kim/.test(await p1.textContent('#shop')));
  ok('invite link unchanged', (await p1.textContent('#shop .link')).includes('?ref=' + code));
  await p2.bringToFront(); await p2.click('[data-act="refresh"]').catch(() => {});
  await p2.waitForFunction(() => /Big Dog Kitchen/.test(document.getElementById('recruiter').textContent), null, { timeout: 8000 }).catch(() => {});
  ok("recruit's banner follows the rename", /running for.*Ada and Bo's Big Dog Kitchen/s.test(await p2.textContent('#recruiter')), await p2.textContent('#recruiter'));
  await p1.bringToFront();

  console.log('manual referral code on the intro');
  const p3 = await ctx.newPage();
  await p3.goto(url + '?slot=3');
  await skip(p3);
  ok('intro has a who-sent-you box', await p3.isVisible('#refIn'));
  await p3.fill('#nm', 'Mo'); await p3.fill('#refIn', ' ' + code.toLowerCase() + ' ');
  await p3.click('#go');
  await p3.waitForFunction(() => !document.getElementById('recruiter').hidden);
  ok('typed code resolves to the owner', /running for.*Ada/s.test(await p3.textContent('#recruiter')), await p3.textContent('#recruiter'));
  await p3.close();

  const p6 = await ctx.newPage();
  await p6.goto(url + '?slot=6&ref=' + code);
  await skip(p6);
  ok('code box is sealed when the link carried a code', (await p6.getAttribute('#refIn', 'readonly')) != null && (await p6.inputValue('#refIn')) === code && /never know/.test(await p6.textContent('#modalBox')), await p6.inputValue('#refIn'));
  await p6.click('#refIn'); await p6.keyboard.press('End'); await p6.keyboard.type('ZZ');
  ok('typing does not change a sealed code', (await p6.inputValue('#refIn')) === code, await p6.inputValue('#refIn'));
  await p6.fill('#nm', 'Solo'); await p6.click('#go');
  await p6.waitForFunction(() => !document.getElementById('recruiter').hidden);
  ok('sealed code registers under the recruiter, with the temptation line', (await save(p6, '6')).ref === code && /never know/.test(await p6.textContent('#recruiter')), await p6.textContent('#recruiter'));
  ok('runner with no runners pays both taxes', /\(−25%\)/.test(await p6.textContent('#ips')), await p6.textContent('#ips'));
  await p6.close();

  console.log('no clipboard (iframe-like): copy box fallback, voucher without prompt()');
  const ctx2 = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const p4 = await ctx2.newPage();
  await p4.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined })); // what an iframe without clipboard permission looks like
  await p4.goto(url + '?dev');
  await register(p4, 'Nia');
  await p4.waitForFunction(() => window.MUSTEAT && window.MUSTEAT.state.id);
  await p4.click('[data-act="share"]');
  ok('share falls back to a selectable box', await p4.isVisible('#copyBox') && /\?ref=/.test(await p4.inputValue('#copyBox')));
  await p4.click('#confirm');
  ok('copy box closes', !(await p4.isVisible('#modal')));
  await p4.evaluate(() => { window.MUSTEAT.state.cash = 500; });
  await p4.waitForFunction(() => !document.querySelector('[data-act="voucher"]').disabled);
  await p4.click('[data-act="voucher"]');
  ok('voucher asks for a name in a modal', await p4.isVisible('#vTo'));
  await p4.fill('#vTo', 'Priya'); await p4.click('#confirm');
  ok('voucher text offered in copy box with v=Priya', /v=Priya/.test(await p4.inputValue('#copyBox')));
  ok('voucher charged', (await p4.evaluate(() => window.MUSTEAT.state.cash)) === 300);
  await p4.click('#cancel');
  await p4.click('#reset');
  ok('reset asks with a modal, not confirm()', /Delete your save/.test(await p4.textContent('#modalBox')));
  await p4.click('#cancel');
  await ctx2.close();

  console.log('mobile viewport with a seeded company');
  await p1.click('[data-act="seed"]');
  await p1.waitForFunction(() => /Seeded a demo company/.test(document.getElementById('log').textContent));
  await p1.setViewportSize({ width: 360, height: 740 });
  await p1.waitForTimeout(600);
  const over = await p1.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, wide: [...document.querySelectorAll('table,.item,.card')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).map(e => e.tagName + '#' + (e.closest('[id]') || {}).id) }));
  ok('no horizontal overflow at 360px', over.sw <= over.iw, JSON.stringify(over));
  ok('sectors table populated', /Sales/.test(await p1.textContent('#sectors')));
  ok('seed put a franchise in the cabinet with live figures', await p1.evaluate(() => { document.querySelector('[data-tab="portfolio"]').click(); const t = document.getElementById('portfolio').textContent; document.querySelector('[data-tab="run"]').click(); return /Big Dog Kitchen №3/.test(t) && /Open|Idle/.test(t) && /Hazmat Trainers ×34/.test(t); }));

  console.log('offline');
  await patchSave(p1, '', 's.lastSeen = Date.now() - 3 * 3600000');
  await p1.waitForSelector('#modal:not([hidden])');
  ok('offline modal after 3h away', /sheltering for.*3\.0 hours/s.test(await p1.textContent('#modalBox')));
  await p1.click('#ok');
  ok('offline modal closes', !(await p1.isVisible('#modal')));

  ok('no page errors or console errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
