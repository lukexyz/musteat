// Read-only leaderboard failure and recovery checks; no live company traffic.
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
const assert = require('node:assert/strict');

start(0, async ({ srv, url }) => {
  let browser, checks = 0;
  const check = (name, value) => { assert.ok(value, name); checks++; console.log('  ok   ' + name); };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const players = [{ id: 'a', name: 'Alice', total: 300, played: 600, pace0: '{"9":100}' }, { id: 'b', name: 'Bob', total: 900, played: 600, pace0: '{"9":80}' }];
    const ledger = [{ id: 'l', from: 'b', to: 'a', amount: 40, kind: 'cut', level: 1, ts: Date.now() }];
    let mode = 'slow-ledger', reads = 0, held = [];
    await page.route('**/api?**', async route => {
      reads++;
      const table = new URL(route.request().url()).searchParams.get('table');
      if ((mode === 'slow-ledger' || mode === 'timeout') && table === 'ledger') { held.push(route); return; }
      if (mode === 'failure' && table === 'ledger') return route.fulfill({ status: 503, body: 'Unavailable' });
      if (mode === 'malformed' && table === 'players') return route.fulfill({ contentType: 'application/json', body: '{"error":"offline"}' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(mode === 'empty' ? [] : table === 'players' ? players : ledger) });
    });
    await page.goto(url + 'ledger.html?minute=9');
    await page.waitForSelector('#scores tr');
    check('scores load without waiting for the ledger', /Alice/.test(await page.textContent('#scores')) && /Loading/.test(await page.textContent('#recent')));
    check('pending ledger totals are unknown, not zero', await page.textContent('#nRows') === '—');
    const before = reads;
    await page.click('[data-order="total"]');
    check('lifetime switch ranks cached players immediately', (await page.locator('#scores tr').nth(1).textContent()).includes('Bob'));
    await page.click('[data-order="pace"]');
    check('same-minute switch restores the historical leader without new requests', (await page.locator('#scores tr').nth(1).textContent()).includes('Alice') && reads === before);
    mode = 'ok';
    for (const route of held.splice(0)) await route.fulfill({ contentType: 'application/json', body: JSON.stringify(ledger) });
    await page.waitForFunction(() => document.getElementById('loadMessage').textContent.startsWith('Up to date'));
    check('ledger fills in when its independent request finishes', await page.textContent('#sumAll') === '₵40');
    mode = 'failure'; await page.evaluate(() => refresh());
    check('refresh failure preserves loaded transactions', await page.textContent('#sumAll') === '₵40' && /showing last loaded data/.test(await page.textContent('#loadMessage')));
    check('failed connection offers an enabled retry', await page.isVisible('#retry') && await page.locator('#retry').isEnabled());
    mode = 'ok'; await page.click('#retry');
    await page.waitForFunction(() => document.getElementById('retry').hidden);
    check('retry recovers without reloading the page', /Up to date/.test(await page.textContent('#loadMessage')));
    mode = 'malformed'; await page.reload();
    await page.waitForFunction(() => document.getElementById('scores').textContent.includes('could not be loaded'));
    check('invalid response is a visible failure, not an empty ranking', /High scores unavailable/.test(await page.textContent('#loadMessage')) && !/No recorded scores/.test(await page.textContent('#scores')));
    mode = 'timeout';
    // Shorten only the network deadline to exercise an actual aborted fetch quickly.
    await page.evaluate(() => { const native = window.setTimeout; window.setTimeout = (fn, ms, ...args) => native(fn, ms === 12000 ? 50 : ms, ...args); });
    await page.evaluate(() => refresh());
    check('hung ledger request times out while scores remain usable', /Alice/.test(await page.textContent('#scores')) && /Transaction ledger refresh failed/.test(await page.textContent('#loadMessage')));
    for (const route of held.splice(0)) await route.abort().catch(() => {});
    mode = 'empty'; await page.reload();
    await page.waitForFunction(() => document.getElementById('loadMessage').textContent.startsWith('Up to date'));
    check('genuinely empty tables show empty states and zero totals', /No recorded scores/.test(await page.textContent('#scores')) && await page.textContent('#nRows') === '0');
    await page.setViewportSize({ width: 360, height: 800 });
    check('status and controls fit on mobile', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    check('no uncaught browser errors', errors.length === 0);
    console.log('\n' + checks + ' leaderboard loading checks passed.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (browser) await browser.close(); srv.close(); }
});
