// Personalised Airlock unlock typing, with a local backend and no live writes.
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
const assert = require('node:assert/strict');
start(0, async ({ srv, url }) => {
  let browser, checks = 0;
  const ok = (label, value) => { assert.ok(value, label); checks++; console.log('  ok   ' + label); };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({viewport:{width:360,height:844}, reducedMotion:'reduce'});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + 'index.html?dev'); await page.click('#intro');
    const alias = '<img src=x> ' + 'A'.repeat(28);
    await page.fill('#nm', alias); await page.click('#go');
    await page.waitForFunction(() => MUSTEAT.state.id);
    await page.evaluate(() => {
      const s = MUSTEAT.state; s.played = 90; s.taps = 10;
      s.nextEvent = Date.now() + 1e9; s.crateAt = Date.now() + 1e9;
      s.told = {gang:Date.now(), rec:Date.now()}; MUSTEAT.render();
    });
    const copy = await page.locator('#dispatch p').allTextContents();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.click('[data-act="unlockDispatch"]');
    await page.waitForSelector('.contract-transmission');
    ok('black terminal starts with an empty line and cursor', await page.locator('.transmission-greeting>span').first().innerText() === '' && await page.locator('.transmission-caret').count() === 1);
    const blinks = await page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 8; i++) { values.push(document.querySelector('.transmission-caret').style.opacity); await new Promise(r => setTimeout(r, 60)); }
      return values;
    });
    ok('cursor blinks before the greeting', blinks.includes('0') && blinks.includes('1'));
    await page.waitForFunction(alias => document.querySelector('.transmission-greeting>span')?.textContent === 'knock knock ' + alias, alias);
    ok('alias is literal text and greeting precedes the body', await page.locator('.contract-transmission img').count() === 0 && await page.locator('.transmission-body>span').first().innerText() === '');
    await page.waitForFunction(text => document.querySelector('.transmission-body>span')?.textContent === text, copy[0]);
    ok('contract description follows on a new line', await page.locator('.transmission-body').evaluate(e => e.getBoundingClientRect().top > document.querySelector('.transmission-greeting').getBoundingClientRect().bottom));
    await page.waitForFunction(text => document.querySelector('.transmission-status>span')?.textContent === text, copy[1]);
    ok('completion details are typed too', await page.locator('.transmission-status>span').first().innerText() === copy[1]);
    ok('long alias and full text fit a mobile card', await page.locator('.contract-transmission').evaluate(e => e.scrollHeight <= e.clientHeight && e.scrollWidth <= e.clientWidth));
    ok('no page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.waitForSelector('.contract-transmission', {state:'detached'});
    ok('terminal cleans up and real contract controls remain', await page.locator('.transmission-caret').count() === 0 && await page.locator('[data-act="acceptDispatch"]').isVisible());
    await page.click('[data-act="acceptDispatch"]');
    ok('contract can be accepted normally', await page.evaluate(() => !!MUSTEAT.state.dispatch.active));
    ok('no browser errors', errors.length === 0);
    console.log(`\n${checks} passed`);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (browser) await browser.close(); srv.close(); }
});
