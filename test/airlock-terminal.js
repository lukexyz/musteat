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
    ok('CRT stays inside the original card on mobile', await page.locator('.contract-transmission').evaluate(e => {
      const card = document.querySelector('#dispatch').getBoundingClientRect(), terminal = e.getBoundingClientRect();
      return getComputedStyle(e).backgroundColor === 'rgb(0, 0, 0)' && Math.abs(card.width - terminal.width) < 1 && Math.abs(card.height - terminal.height) < 1;
    }));
    ok('contract controls are hidden during the transmission', await page.locator('[data-act="acceptDispatch"]').isHidden());
    ok('cursor is a fat white block', await page.locator('.transmission-caret').evaluate(e => getComputedStyle(e).backgroundColor === 'rgb(255, 255, 255)' && e.getBoundingClientRect().width > 10));
    const blinks = await page.evaluate(async () => {
      const values = [];
      for (let i = 0; i < 12; i++) { values.push(document.querySelector('.transmission-caret').style.opacity); await new Promise(r => setTimeout(r, 100)); }
      return values;
    });
    ok('cursor blinks before the greeting', blinks.includes('0') && blinks.includes('1'));
    ok('opening pause lasts before typing starts', await page.locator('.transmission-greeting>span').first().innerText() === '');
    const waitForMessage = text => page.waitForFunction(text => document.querySelector('.transmission-greeting>span')?.textContent === text, text);
    await waitForMessage('Wake up, ' + alias + '...');
    ok('alias is literal text in a single message', await page.locator('.contract-transmission img').count() === 0 && await page.locator('.contract-transmission p').count() === 1);
    await waitForMessage('');
    ok('screen clears between messages', await page.locator('.transmission-caret').count() === 1);
    await waitForMessage('Someone behind an airlock needs feeding.');
    await page.locator('#dispatchShell').screenshot({path:'/private/tmp/musteat-airlock-crt.png'});
    await waitForMessage('Knock, knock, ' + alias + '.');
    ok('long alias fits the mobile CRT', await page.locator('.contract-transmission').evaluate(e => e.scrollHeight <= e.clientHeight && e.scrollWidth <= e.clientWidth));
    ok('no page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.waitForSelector('.contract-transmission', {state:'detached'});
    ok('terminal cleans up and real contract controls remain', await page.locator('.transmission-caret').count() === 0 && await page.locator('[data-act="acceptDispatch"]').isVisible());
    ok('original contract text is restored', JSON.stringify(await page.locator('#dispatch p').allTextContents()) === JSON.stringify(copy));
    await page.click('[data-act="acceptDispatch"]');
    ok('contract can be accepted normally', await page.evaluate(() => !!MUSTEAT.state.dispatch.active));
    ok('no browser errors', errors.length === 0);
    console.log(`\n${checks} passed`);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (browser) await browser.close(); srv.close(); }
});
