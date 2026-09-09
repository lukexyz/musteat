// Multi-instance test: three separate browser contexts (separate localStorage, like three laptops)
// share one company through the mock backend in sheetmock.js, which speaks the Apps Script contract.
//   node remote.js
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + String(extra).replace(/\s+/g, ' ').slice(0, 300) : '')); } };
const reveal = async page => { await page.evaluate(() => { window.MUSTEAT.state.played = 200; }); for (let i = 0; i < 3; i++) { const m = await page.waitForSelector('#modal:not([hidden])', { timeout: 1500 }).catch(() => null); if (!m) break; await page.click('#modalBox #ok'); } };
const skip = async page => { await page.waitForSelector('#intro:not([hidden])', { timeout: 5000 }); await page.click('#intro'); await page.waitForSelector('#modal:not([hidden])'); };

start(0, async ({ srv, db, url }) => {
  const browser = await chromium.launch();
  const errors = [];
  const ctxOf = async () => { const c = await browser.newContext({ viewport: { width: 1000, height: 900 } }); await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin }); c.on('page', p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }); return c; };
  const game = url + 'index.html?dev';

  console.log('Ada registers on laptop A');
  const A = await (await ctxOf()).newPage();
  await A.goto(game); await skip(A); await A.fill('#nm', 'Ada'); await A.click('#go');
  await A.waitForFunction(() => window.MUSTEAT && window.MUSTEAT.state.id);
  await A.waitForFunction(() => /connected to the company sheet/.test(document.getElementById('mode').textContent));
  ok('footer says connected to the company sheet', true);
  ok('player row reached the backend', db.players.length === 1 && db.players[0].name === 'Ada', JSON.stringify(db.players));
  await A.evaluate(() => { window.MUSTEAT.state.cash = 26000; });
  await A.click('[data-act="shop"]'); await A.fill('#shopName', 'Bunker Bao'); await A.click('#confirm');
  await A.click('#shopOpeningDone');
  await A.waitForFunction(() => /Bunker Bao/.test(document.getElementById('shop').textContent));
  const link = await A.textContent('#shop .link');
  const code = (link.match(/ref=([A-Z0-9]+)/) || [])[1];
  ok('invite link has a code and no dev slot', !!code && !/slot=/.test(link), link);
  await A.waitForFunction(() => JSON.stringify(window.MUSTEAT.state.log).includes('opened'));
  await A.click('[data-act="refresh"]'); await A.waitForTimeout(600);
  ok('shop event appended through the sync round trip', db.events.some(e => e.kind === 'shop' && e.arg === 'Bunker Bao'), JSON.stringify(db.events));

  console.log('Bob joins from laptop B through the link');
  const B = await (await ctxOf()).newPage();
  await B.goto(game + '&ref=' + code); await skip(B);
  ok('intro names Ada and applies the referral without a code field', /recruited by[\s\S]*Ada/.test(await B.textContent('#modalBox')) && !(await B.$('#refIn')) && await B.evaluate(() => MUSTEAT.state.ref) === code, await B.textContent('#modalBox'));
  await B.fill('#nm', 'Bob'); await B.click('#go');
  await B.waitForFunction(() => window.MUSTEAT.state.id); await reveal(B);
  await B.waitForFunction(() => /running for[\s\S]*Ada/.test(document.getElementById('recruiter').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('Bob runs for Ada, resolved from the shared sheet', /running for[\s\S]*Ada/.test(await B.textContent('#recruiter')), await B.textContent('#recruiter'));
  for (let i = 0; i < 8; i++) await B.click('#run');
  await B.evaluate(() => window.MUSTEAT.sync()); await B.waitForTimeout(600); // runners have no Refresh button; sync directly
  ok('backend has both players, Bob with ref = Ada', db.players.length === 2 && db.players.find(p => p.name === 'Bob').ref === code, JSON.stringify(db.players.map(p => [p.name, p.ref])));

  console.log('Ada sees Bob without a shared browser');
  await A.click('[data-act="refresh"]');
  await A.waitForFunction(() => /Bob/.test(document.getElementById('shop').textContent), null, { timeout: 8000 });
  ok('Bob in the runners table', /Bob/.test(await A.textContent('#shop')));
  ok('gang tax lifted for Ada', await A.evaluate(() => document.getElementById('gang').hidden) && /Extortion tax lifted/.test(await A.textContent('#log')), await A.textContent('#log'));
  await A.click('[data-score="total"]');
  ok('high scores list both', /Ada/.test(await A.textContent('#board')) && /Bob/.test(await A.textContent('#board')));
  ok('company feed shows the recruitment', /Bob[\s\S]*was recruited by[\s\S]*Ada/.test(await A.textContent('#company')), await A.textContent('#company'));
  await A.click('[data-act="refresh"]'); await A.waitForTimeout(600); // the first sync queued the ledger row, the second sends it
  ok('cut from Bob to Ada is in the backend ledger', db.ledger.some(r => r.fromName === 'Bob' && r.toName === 'Ada' && r.kind === 'cut' && r.amount > 0), JSON.stringify(db.ledger));

  console.log('the ledger page on laptop B reads the shared tables');
  const L = await B.context().newPage();
  await L.goto(url + 'ledger.html?order=total');
  await L.waitForFunction(() => /Ada/.test(document.getElementById('scores').textContent), null, { timeout: 8000 });
  ok('scores show Ada and Bob', /Ada/.test(await L.textContent('#scores')) && /Bob/.test(await L.textContent('#scores')));
  ok('top earner from runners is Ada', /Ada/.test(await L.textContent('#top')), await L.textContent('#top'));
  ok('latest transactions list Bob paying Ada', /Bob[\s\S]*Ada/.test(await L.textContent('#recent')), await L.textContent('#recent'));

  console.log('franchise claim from laptop C merges onto Ada\'s row');
  await A.evaluate(() => { window.MUSTEAT.state.total = 1e9; window.MUSTEAT.state.gear = { trainers: 12 }; });
  await A.click('[data-act="franchise"]'); await A.waitForTimeout(800);
  ok('offer on the backend row', !!db.players.find(p => p.name === 'Ada').offer, JSON.stringify(db.players.find(p => p.name === 'Ada')));
  const C = await (await ctxOf()).newPage();
  await C.goto(game + '&fr=' + code); await skip(C);
  ok('Kim sees the handover offer', /Ada[\s\S]*handing you[\s\S]*Bunker Bao №2/.test(await C.textContent('#modalBox')), await C.textContent('#modalBox'));
  await C.fill('#nm', 'Kim'); await C.click('#go');
  await C.waitForFunction(() => window.MUSTEAT.state.id); await reveal(C);
  await C.waitForFunction(() => /franchise of[\s\S]*Ada/.test(document.getElementById('recruiter').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('Kim is a franchisee of Ada', /franchise of[\s\S]*Ada/.test(await C.textContent('#recruiter')), await C.textContent('#recruiter'));
  const ada = db.players.find(p => p.name === 'Ada');
  ok('claim columns merged onto Ada\'s row, her own columns intact', ada.claimedName === 'Kim' && ada.shopName === 'Bunker Bao' && ada.code === code, JSON.stringify(ada));
  await A.click('[data-act="refresh"]');
  await A.waitForFunction(() => /took over/.test(document.getElementById('log').textContent), null, { timeout: 8000 });
  ok('Ada gets the handover on laptop A', /Kim took over Bunker Bao №2/.test(await A.textContent('#modalBox')), await A.textContent('#modalBox'));

  ok('no page or console errors', errors.length === 0, errors.join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); srv.close();
  process.exit(fail ? 1 : 0);
});
