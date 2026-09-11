// News reward: affordability, persistence, reveal and interruption. Local backend only.
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
const assert = require('node:assert/strict');
start(0, async ({srv, url}) => {
  let browser, checks = 0;
  const ok = (name, condition) => { assert.ok(condition, name); checks++; console.log('  ok   ' + name); };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({viewport:{width:1000,height:900}, reducedMotion:'reduce'});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + 'index.html?dev'); await page.click('#intro');
    await page.fill('#nm', 'Signal Thief'); await page.click('#go');
    await page.waitForFunction(() => MUSTEAT.state.id);
    const setup = cash => page.evaluate(cash => {
      const s = MUSTEAT.state; s.cash = cash; s.nextEvent = Date.now() + 1e9; s.crateAt = Date.now() + 1e9;
      s.told = {gang:Date.now(),rec:Date.now()}; MUSTEAT.render();
    }, cash);
    await setup(49);
    ok('new player starts with the original grey ticker', await page.locator('.news-default-head').isVisible() && await page.locator('#newsCard').getAttribute('role') === 'button' && await page.locator('#federationNews').evaluate(e => getComputedStyle(e).color === 'rgb(199, 210, 212)'));
    const originalHeadline=await page.locator('#federationNews').getAttribute('data-headline');
    await page.locator('#newsCard').click();
    ok('default ticker can advance before buying the reward', await page.locator('#federationNews').getAttribute('data-headline') !== originalHeadline);
    ok('reward is named and priced at 50 credits', await page.locator('[data-upg="propaganda"]').innerText() === '₵50' && /Decrypt federation propaganda/.test(await page.locator('[data-upg="propaganda"]').locator('..').innerText()));
    ok('purchase is disabled below 50 credits', await page.locator('[data-upg="propaganda"]').isDisabled());
    await page.evaluate(() => MUSTEAT.buyUpgrade('propaganda'));
    ok('purchase logic rejects insufficient funds', await page.evaluate(() => MUSTEAT.state.cash === 49 && !MUSTEAT.state.upg.propaganda));
    await setup(50);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.click('[data-upg="propaganda"]');
    ok('buying spends exactly 50 credits and saves immediately', await page.evaluate(() => MUSTEAT.state.cash === 0 && MUSTEAT.state.upg.propaganda && JSON.parse(localStorage.musteat_save).upg.propaganda));
    await page.waitForSelector('.news-decryption');
    ok('purchase reveals decryption within the compact CRT', (await page.locator('#newsCard').boundingBox()).width < 200 && await page.locator('#newsCard').getAttribute('aria-expanded') === null && await page.locator('.news-default-head').isHidden());
    await page.waitForFunction(() => document.querySelector('.news-decrypt-status')?.textContent.includes('BREAKING CIPHER'));
    ok('cipher animates before revealing the message', /[01#$%<>/{}\[\]]/.test(await page.locator('.news-cipher').innerText()));
    await page.waitForFunction(() => document.querySelector('.news-decrypt-status')?.textContent.includes('ACCESS GRANTED'));
    ok('cipher resolves into the reward message', await page.locator('.news-cipher').innerText() === 'THE LIES LOOK BETTER IN GREEN.');
    await page.locator('#newsCard').screenshot({path:'/private/tmp/musteat-news-decryption.png'});
    await page.waitForSelector('.news-decryption', {state:'detached'});
    ok('reveal restores readable, slightly larger green news', await page.locator('#federationNews').evaluate(e => getComputedStyle(e).fontSize === '10.5px' && getComputedStyle(e).color === 'rgb(138, 240, 160)'));
    await page.evaluate(() => { MUSTEAT.state.cash = 100; MUSTEAT.buyUpgrade('propaganda'); });
    ok('owned reward cannot be purchased twice', await page.evaluate(() => MUSTEAT.state.cash === 100));
    ok('recovery preserves the purchase', await page.evaluate(async () => (await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(MUSTEAT.state))).upg.propaganda === true));
    await page.locator('#newsCard').click();
    ok('click leaves the unlocked CRT compact', await page.locator('#newsCard').getAttribute('aria-expanded') === null && (await page.locator('#newsCard').boundingBox()).width < 200);
    await page.reload();
    ok('reload retains CRT ownership without replaying the reveal', await page.locator('#newsCard').evaluate(e => e.classList.contains('news-decrypted') && e.tagName === 'DIV') && await page.locator('.news-decryption').count() === 0);
    await page.evaluate(() => { delete MUSTEAT.state.upg.propaganda; MUSTEAT.render(); });
    await setup(50);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(() => MUSTEAT.buyUpgrade('propaganda'));
    ok('reduced motion unlocks instantly without decryption animation', await page.locator('.news-decryption').count() === 0 && await page.locator('#newsCard').getAttribute('aria-expanded') === null);
    await page.evaluate(() => { delete MUSTEAT.state.upg.propaganda; MUSTEAT.render(); });
    await setup(50); await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(() => MUSTEAT.buyUpgrade('propaganda'));
    await page.locator('#newsCard').click();
    ok('click during the reveal never enlarges the card', await page.locator('#newsCard').getAttribute('aria-expanded') === null && (await page.locator('#newsCard').boundingBox()).width < 200);
    await page.waitForSelector('.news-decryption', {state:'detached'});
    ok('click dismisses the reveal and shows the next headline', await page.locator('#federationNews').isVisible());
    ok('no browser errors', errors.length === 0);
    console.log(`\n${checks} passed`);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (browser) await browser.close(); srv.close(); }
});
