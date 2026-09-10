// Focused browser checks for the playtime leaderboard and the main-screen changes.
// Uses the local HTTP backend; never contacts the live company sheet.
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

start(0, async ({ srv, db, url }) => {
  let browser;
  let checks = 0;
  const check = (name, value) => { assert.ok(value, name); checks++; console.log('  ok   ' + name); };
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    const page = await context.newPage();
    await page.addInitScript(() => { window.__time = Date.now(); Date.now = () => window.__time; });
    await page.goto(url + 'index.html?dev');
    await page.click('#intro');
    await page.fill('#nm', 'Minute Runner');
    await page.click('#go');
    await page.waitForFunction(() => window.MUSTEAT.state.id);
    await page.evaluate(() => { const s = MUSTEAT.state; s.nextEvent = Date.now() + 1e9; s.crateAt = Date.now() + 1e9; s.told = { gang: Date.now(), rec: Date.now() }; MUSTEAT.render(); });

    console.log('drawer and the main action');
    check('protection starts closed and out of the header', !await page.isVisible('#protectionDrawer') && !await page.$('.wrap #gang'));
    await page.click('#protectionTab');
    check('drawer receives focus and makes the background inert', await page.evaluate(() => document.activeElement.id === 'closeProtection' && document.querySelector('.wrap').inert));
    await page.keyboard.press('Shift+Tab');
    check('keyboard focus stays inside the drawer', await page.evaluate(() => document.getElementById('protectionDrawer').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    check('Escape restores focus and the playable background', await page.evaluate(() => document.activeElement.id === 'protectionTab' && !document.querySelector('.wrap').inert && document.getElementById('protectionDrawer').hidden));
    check('purchase benefit is visible without bookkeeping', /Adds ₵0.3.*\/sec at base rate/.test(await page.textContent('#gear')));
    check('technology is directly after delivery controls, with its first buy above the fold', await page.evaluate(() => {
      const gear = document.getElementById('gear');
      return document.querySelector('.run').nextElementSibling.contains(gear) && gear.querySelector('button').getBoundingClientRect().bottom < innerHeight;
    }));
    check('route and recruitment live in Portfolio', await page.evaluate(() => ['operation', 'empireLive'].every(id => document.getElementById('tab-portfolio').contains(document.getElementById(id)))));
    await page.evaluate(() => { MUSTEAT.state.cash = 1000; MUSTEAT.state.qty = 10; MUSTEAT.render(); });
    await page.click('#pursueGoal');
    check('next-goal purchase buys one, preserving bulk selection', await page.evaluate(() => MUSTEAT.state.gear.trainers === 1 && MUSTEAT.state.qty === 10));
    await page.click('#pursueGoal');
    check('equal owned counts keep the first tech while the goal advances', /Best tech: Hazmat Trainers/.test(await page.textContent('#operation')) && /Put your name above a shop/.test(await page.textContent('#nextGoal')));
    await page.evaluate(() => { MUSTEAT.state.cash = 24999; MUSTEAT.render(); });
    check('shop needs the full 25K', await page.locator('#shop [data-act="shop"]').isDisabled());
    await page.evaluate(() => { MUSTEAT.state.cash = 25000; MUSTEAT.render(); });
    await page.click('#pursueGoal');
    await page.fill('#shopName', 'Minute Kitchen');
    check('shop purchase explains the remaining protection tax and solo access', /gang still takes 15%/.test(await page.textContent('#modalBox')) && /No runners required/.test(await page.textContent('#modalBox')));
    await page.click('#confirm');
    check('shop costs 25K and shows its name on the door', await page.evaluate(() => MUSTEAT.state.cash === 0) && /Minute Kitchen/.test(await page.textContent('.shop-sign')));
    await page.click('#shopOpeningDone');
    check('shop milestone correctly retains protection tax', await page.evaluate(() => MUSTEAT.calc(MUSTEAT.state).gang === 0.15) && /Protection still costs 15%/.test(await page.textContent('#log')));

    console.log('contracts');
    await page.evaluate(() => { MUSTEAT.state.played = 89; MUSTEAT.render(); MUSTEAT.unlockDispatch(); MUSTEAT.acceptDispatch(); });
    check('contracts and their recommendation stay locked before 90 active seconds', !await page.isVisible('#dispatchSection') && !await page.isVisible('#contractUnlock') && !/contract/i.test(await page.textContent('#nextGoal')) && !await page.evaluate(() => MUSTEAT.state.dispatch.active));
    check('hidden time does not unlock the permit', await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      window.__time += 60000; MUSTEAT.frame(); delete document.hidden; MUSTEAT.render();
      return MUSTEAT.state.played === 89 && document.getElementById('contractUnlock').hidden;
    }));
    await page.evaluate(() => { window.__time += 1000; MUSTEAT.frame(); MUSTEAT.render(); });
    check('90 active seconds earns a free permit without opening contracts automatically', await page.isVisible('#contractUnlock') && !await page.isVisible('#dispatchSection') && !await page.isVisible('#modal'));
    check('permit also requires some delivery progress', await page.evaluate(() => {
      const s = MUSTEAT.state, gear = s.gear, taps = s.taps; s.gear = {}; s.taps = 0; MUSTEAT.render(); MUSTEAT.unlockDispatch();
      const locked = document.getElementById('contractUnlock').hidden && !s.dispatch.unlocked;
      s.taps = 10; MUSTEAT.render(); const tapsQualify = !document.getElementById('contractUnlock').hidden;
      s.gear = gear; s.taps = taps; MUSTEAT.render(); return locked && tapsQualify;
    }));
    const cashBeforePermit = await page.evaluate(() => MUSTEAT.state.cash);
    await page.click('[data-act="unlockDispatch"]');
    check('claiming the permit unlocks contracts for free', await page.isVisible('#dispatchSection') && !await page.isVisible('#contractUnlock') && await page.evaluate(() => MUSTEAT.state.cash) === cashBeforePermit);
    await page.waitForSelector('.contract-burst');
    check('reduced motion uses a static reveal', await page.locator('.contract-burst i, .contract-transmission').count() === 0);
    check('permit survives recovery and cannot be claimed twice', await page.evaluate(async () => {
      const before = MUSTEAT.state.cash; MUSTEAT.unlockDispatch();
      const decoded = await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(MUSTEAT.state));
      return MUSTEAT.state.cash === before && decoded.dispatch.unlocked;
    }));
    await page.click('[data-act="acceptDispatch"]');
    const job = await page.evaluate(() => MUSTEAT.state.dispatch.active);
    check('active contract hides the next-move card and keeps the contract controls', !await page.isVisible('#nextGoal') && await page.isVisible('#dispatch'));
    check('contract locks a quota and reward at acceptance', job.quota >= 25 && job.reward >= 100);
    check('incomplete contracts cannot pay', await page.evaluate(() => { const before = MUSTEAT.state.cash; MUSTEAT.claimDispatch(); return MUSTEAT.state.cash === before && !!MUSTEAT.state.dispatch.active; }));
    const paid = await page.evaluate(() => {
      const s = MUSTEAT.state, reward = s.dispatch.active.reward;
      s.deliveries += s.dispatch.active.quota;
      const before = s.cash;
      MUSTEAT.claimDispatch(); MUSTEAT.claimDispatch();
      return { paid: s.cash - before, reward, done: s.dispatch.done, active: s.dispatch.active };
    });
    check('contract reward is paid exactly once', Math.abs(paid.paid - paid.reward) < 1e-8 && paid.done === 1 && paid.active === null);
    check('next-move card returns after collecting payment', await page.isVisible('#nextGoal'));
    check('three completions give a 1% permanent bonus', await page.evaluate(() => { const s = MUSTEAT.state; s.dispatch.done = 0; const before = MUSTEAT.calc(s).baseIncome; s.dispatch.done = 3; return Math.abs(MUSTEAT.calc(s).baseIncome / before - 1.01) < 1e-9; }));
    check('contract income bonus caps at 20%', await page.evaluate(() => { const s = MUSTEAT.state; s.dispatch.done = 0; const before = MUSTEAT.calc(s).baseIncome; s.dispatch.done = 600; return Math.abs(MUSTEAT.calc(s).baseIncome / before - 1.2) < 1e-9; }));
    await page.evaluate(() => { MUSTEAT.state.dispatch.done = 3; MUSTEAT.acceptDispatch(); MUSTEAT.save(); });
    await page.reload();
    check('contract progress survives reload', await page.evaluate(() => MUSTEAT.state.dispatch.done === 3 && !!MUSTEAT.state.dispatch.active));
    check('legacy contracts stay accessible without a permit or playtime', await page.evaluate(() => {
      const s = MUSTEAT.state; delete s.dispatch.unlocked; s.played = 0; MUSTEAT.render();
      return !document.getElementById('dispatchSection').hidden && document.getElementById('contractUnlock').hidden;
    }));
    check('offline deliveries complete contracts normally', await page.evaluate(() => { const s = MUSTEAT.state; s.lastSeen = Date.now() - 3600000; MUSTEAT.offline(s); return s.deliveries - s.dispatch.active.start >= s.dispatch.active.quota; }));

    console.log('minute snapshots');
    const first = await page.evaluate(() => {
      const s = MUSTEAT.state; s.gear = {}; s.total = 1100; s.played = 59.5; s.pace = {};
      window.__time += 500; MUSTEAT.frame();
      const snapshot = s.pace[1]; s.total += 2000; window.__time += 250; MUSTEAT.frame();
      return { snapshot, unchanged: s.pace[1], minutes: Object.keys(s.pace) };
    });
    check('full minute records lifetime earnings and is immutable', first.snapshot === 1100 && first.unchanged === 1100 && first.minutes.join(',') === '1');
    const hidden = await page.evaluate(() => {
      const s = MUSTEAT.state; s.gear = { trainers: 1 };
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      const before = s.played, cash = s.cash;
      window.__time += 10000; MUSTEAT.frame();
      delete document.hidden;
      return { before, after: s.played, earned: s.cash - cash, checkpoints: Object.keys(s.pace).length };
    });
    check('hidden time still earns but does not advance comparison time', hidden.before === hidden.after && hidden.earned > 0 && hidden.checkpoints === 1);
    check('offline earnings enter the next active-minute score', await page.evaluate(() => {
      const s = MUSTEAT.state, before = s.total;
      s.lastSeen = Date.now() - 3600000; MUSTEAT.offline(s);
      const gained = s.total - before, total = s.total;
      s.played = 119.5; window.__time += 500; MUSTEAT.frame();
      return gained > 0 && s.pace[2] >= Math.floor(total) && s.pace[1] === 1100;
    }));
    await page.evaluate(() => { const s = MUSTEAT.state; s.pace = {}; s.played = 539.5; s.sprint = 999999; s.lastSeen = Date.now(); MUSTEAT.save(); });
    await page.reload();
    const migrated = await page.evaluate(() => { window.__time += 500; MUSTEAT.frame(); return Object.keys(MUSTEAT.state.pace); });
    check('old saves start at the next minute without inventing history', migrated.join(',') === '9');
    check('minute chunks round-trip across column boundaries', await page.evaluate(() => {
      const cols = MUSTEAT.paceColumns({ 1: 0, 499: 10, 500: 20, 1000: 30 });
      const history = MUSTEAT.readPace(cols);
      return cols.pace0 && cols.pace1 && cols.pace2 && history[1] === 0 && history[499] === 10 && history[500] === 20 && history[1000] === 30;
    }));
    check('malformed history and legacy sprint never become fake scores', await page.evaluate(() => {
      return MUSTEAT.rankedScores([{ id: 'bad', total: 999, sprint: 100, pace0: '{broken' }, { id: 'wrong', pace0: '{"1":"500","2":-10}' }], 'pace', 1).length === 0;
    }));

    console.log('shared rankings');
    const ownId = await page.evaluate(() => {
      const s = MUSTEAT.state; s.pace = { 9: 100, 10: 200 }; s.played = 600; s.total = 5000; MUSTEAT.save();
      return s.id;
    });
    // These older players must be compared at minute 9, not by their current wealth.
    db.players.push({ id: 'older', name: 'Older Runner', code: 'OLDER', total: 1000000, played: 4800, pace0: '{"9":80,"10":500}' });
    db.players.push({ id: 'tied', name: 'Tied Runner', code: 'TIED', total: 2000000, played: 9000, pace0: '{"9":100,"10":50}' });
    db.players.push({ id: 'legacy', name: 'Legacy Runner', code: 'LEGACY', total: 9999999, played: 20000, sprint: 9999 });
    await page.evaluate(() => MUSTEAT.sync());
    check('history reaches backend as JSON column strings', db.players.find(p => p.id === ownId).pace0 === '{"9":100,"10":200}');
    await page.fill('#scoreMinute', '9'); await page.locator('#scoreMinute').press('Tab');
    await page.waitForFunction(() => /Earned at minute 9/.test(document.getElementById('board').textContent));
    let ranked = await page.locator('#board tr').allTextContents();
    check('same-minute ranking uses historical scores and shared tie ranks', ranked[1].startsWith('1Minute Runner') && ranked[2].startsWith('1Tied Runner') && ranked[3].startsWith('3Older Runner') && !ranked.join('').includes('Legacy Runner'));
    const ledger = await context.newPage();
    await ledger.goto(url + 'ledger.html?minute=9');
    await ledger.waitForFunction(() => /Older Runner/.test(document.getElementById('scores').textContent));
    ranked = await ledger.locator('#scores tr').allTextContents();
    check('standalone leaderboard matches the game across the shared backend', ranked[1].startsWith('1Minute Runner') && ranked[2].startsWith('1Tied Runner') && ranked[3].startsWith('3Older Runner'));
    await ledger.fill('#scoreMinute', '10'); await ledger.locator('#scoreMinute').press('Tab');
    await ledger.waitForFunction(() => /At minute 10/.test(document.getElementById('scores').textContent));
    check('selecting another minute changes the leader', (await ledger.locator('#scores tr').nth(1).textContent()).startsWith('1Older Runner'));
    await ledger.fill('#scoreMinute', '0'); await ledger.locator('#scoreMinute').press('Tab');
    check('invalid minute input restores the last valid comparison', await ledger.inputValue('#scoreMinute') === '10');
    await ledger.click('[data-order="total"]');
    await ledger.waitForFunction(() => /Legacy Runner/.test(document.getElementById('scores').textContent));
    check('lifetime ranking includes players without minute history', (await ledger.locator('#scores tr').nth(1).textContent()).startsWith('1Legacy Runner'));
    await ledger.close();
    // A low-placed player remains visible on both pages rather than being sliced away.
    for (let i = 0; i < 35; i++) db.players.push({ id: 'ahead' + i, name: 'Ahead ' + i, total: 10000, played: 800, pace0: '{"9":1000}' });
    await page.evaluate(() => MUSTEAT.sync());
    check('your row survives outside the top 15', /36/.test(await page.textContent('#board tr.me')) && /Minute Runner/.test(await page.textContent('#board tr.me')));
    const full = await context.newPage(); await full.goto(url + 'ledger.html?minute=9');
    await full.waitForSelector('#scores tr.me');
    check('your row survives outside the top 30', /36/.test(await full.textContent('#scores tr.me')));
    await full.close();

    console.log('first crate and visual checks');
    await page.evaluate(() => { const s = MUSTEAT.state; s.crates = 0; s.crateAt = Date.now(); s.fx = {}; window.__time += 250; MUSTEAT.frame(); MUSTEAT.collectCrate(); });
    check('first rush waits while the explanation is open', await page.evaluate(() => !!MUSTEAT.state.pendingRush && !MUSTEAT.state.fx.rush));
    await page.evaluate(() => { window.__time += 30000; MUSTEAT.frame(); MUSTEAT.save(); });
    await page.reload();
    check('unstarted first rush survives a reload', /clock starts when you press TAKEN/.test(await page.textContent('#modalBox')) && await page.evaluate(() => !MUSTEAT.state.fx.rush));
    await page.click('#ok');
    check('dismissing explanation starts the full 77 seconds', await page.evaluate(() => MUSTEAT.state.fx.rush - Date.now() === 77000 && !MUSTEAT.state.pendingRush) && /77s/.test(await page.textContent('#rushClock')));
    await page.evaluate(() => { const s = MUSTEAT.state; s.gear = { trainers: 10, hover: 3, drones: 1 }; s.cash = 1900; s.fx = {}; s.tab = 'run'; s.lastSocial = null; MUSTEAT.render(); });
    const artifacts = path.join(__dirname, '..', '.logs', 'experience'); fs.mkdirSync(artifacts, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500); // Let the visible balance settle after the fixture changes it.
    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), animations: 'disabled' });
    await page.click('#protectionTab');
    await page.click('#gangS');
    await page.screenshot({ path: path.join(artifacts, 'drawer.png'), animations: 'disabled' });
    check('drawer does not reopen after dismissing during render', await page.evaluate(() => { document.getElementById('closeProtection').click(); MUSTEAT.render(); return document.getElementById('protectionDrawer').hidden; }));
    await page.setViewportSize({ width: 360, height: 740 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, 'mobile.png'), animations: 'disabled' });
    check('main game has no horizontal overflow at 360px', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.click('#protectionTab');
    await page.screenshot({ path: path.join(artifacts, 'mobile-drawer.png'), animations: 'disabled' });
    check('mobile drawer is a bottom sheet contained in the viewport', await page.evaluate(() => { const r = document.getElementById('protectionDrawer').getBoundingClientRect(); return r.top > 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
    check('reduced motion disables the delivery animation', await page.evaluate(() => getComputedStyle(document.querySelector('.courier')).animationName === 'none'));
    check('no browser errors', errors.length === 0);
    console.log(`\n${checks} focused checks passed. Screenshots: .logs/experience/`);
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { if (browser) await browser.close(); srv.close(); }
});
