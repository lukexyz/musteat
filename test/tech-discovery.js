// New technology decryption uses a shared clock across ordinary game renders.
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
const assert = require('node:assert/strict');
start(0, async ({ srv, url }) => {
  let browser, checks = 0;
  const ok = (name, value) => { assert.ok(value, name); checks++; console.log('  ok   ' + name); };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1000, height: 1100 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + 'index.html?dev'); await page.click('#intro'); await page.fill('#nm', 'Cipher Inspector'); await page.click('#go');
    await page.waitForFunction(() => MUSTEAT.state.id);
    await page.evaluate(() => { const s = MUSTEAT.state; s.cash = 1e12; s.nextEvent = Date.now() + 1e9; s.crateAt = Date.now() + 1e9; s.told = {gang: Date.now(), rec: Date.now()}; MUSTEAT.render(); });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const purchasedAt = await page.evaluate(() => performance.now());
    await page.click('[data-buy="trainers"]');
    const row = page.locator('.item').filter({has: page.locator('[data-ico="hover"]')});
    await page.waitForFunction(() => document.querySelector('[data-ico="hover"]').closest('.item').techDecodeStarted != null);
    ok('discovery starts immediately without a scheduled delay', await row.evaluate(e => performance.now() - e.techDecodeStarted < 500));
    ok('controls stay inactive during the reveal', await row.evaluate(e => e.inert));
    await page.waitForTimeout(470);
    ok('card expands while the Matrix title runs', await page.locator('.tech-decoding').count() === 1);
    ok('card reaches full width', await row.evaluate(e => Math.abs(e.getBoundingClientRect().width - e.parentElement.getBoundingClientRect().width) < 1));
    const first = await row.evaluate(e => ({started:e.techDecodeStarted, width:e.querySelector('.tech-heading b').getBoundingClientRect().width, height:e.getBoundingClientRect().height}));
    ok('purchase starts discovery within half a second', first.started - purchasedAt < 500);
    ok('only the newly identified tech decrypts', await page.locator('.tech-decoding').count() === 1 && await row.locator('.cipher').count() > 0);
    ok('next classified tech stays mysterious', await page.locator('[data-ico="drones"]').innerText() === '?' && !await page.locator('[data-ico="drones"]').evaluate(e => e.closest('.item').classList.contains('tech-decoding')));
    ok('cipher characters are hidden from assistive technology', await row.locator('.cipher').evaluateAll(els => els.every(e => e.getAttribute('aria-hidden') === 'true')));
    ok('description remains blank during the falling digits', await row.locator('.decode-copy-char').evaluateAll(els => els.length > 0 && els.every(e => getComputedStyle(e).opacity === '0')));
    await page.waitForTimeout(220);
    ok('rain uses vertical digits that can land on a final letter', await row.locator('.cipher-stream').evaluateAll(els => els.every(e => e.children.length === 4 && /^.\d{3}$/.test(e.textContent))));
    const position = await row.locator('.cipher-stream').first().evaluate(e => e.style.transform);
    await page.waitForTimeout(120);
    ok('digits actually flow vertically', await row.locator('.cipher-stream').first().evaluate(e => e.style.transform) !== position);
    await page.evaluate(() => { MUSTEAT.state.cash -= 123; MUSTEAT.render(); });
    ok('income rerenders preserve the reveal clock', await row.evaluate(e => e.techDecodeStarted) === first.started);
    await page.waitForFunction(() => {
      const row = document.querySelector('[data-ico="hover"]').closest('.item');
      const chars = [...row.querySelectorAll('.decode-copy-char')];
      return chars.some(e => e.style.opacity === '1') && chars.some(e => e.style.opacity === '0');
    });
    ok('description types progressively after the name', await row.locator('.decode-copy-char').count() > 0);
    ok('name resolves to its real text', await row.locator('.tech-heading b').innerText() === 'Hoverbike' && await row.locator('.cipher').count() === 0);
    ok('decryption keeps the name width and row height fixed', await row.evaluate((e, first) => Math.abs(e.querySelector('.tech-heading b').getBoundingClientRect().width-first.width)<1 && Math.abs(e.getBoundingClientRect().height-first.height)<1, first));
    await page.waitForFunction(() => !document.querySelector('.tech-decoding'));
    ok('flash and typing clean up and controls become active', await page.locator('.tech-decoding,.tech-decode-flash,.decode-letter,.decode-copy-char').count() === 0 && !await row.evaluate(e => e.inert));
    await page.click('[data-buy="trainers"]');
    ok('more copies do not repeat a discovery', await page.locator('.tech-decoding').count() === 0);
    ok('discoveries survive recovery encoding', await page.evaluate(async () => (await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(MUSTEAT.state))).techSeen.includes('hover')));
    await page.evaluate(() => { MUSTEAT.state.gear = {}; MUSTEAT.render(); MUSTEAT.buy('trainers'); });
    ok('previously identified tech does not replay after a reset of gear', await page.locator('.tech-decoding').count() === 0);
    await page.setViewportSize({ width: 390, height: 500 });
    await page.evaluate(() => { window.scrollTo(0,0); MUSTEAT.buy('hover'); });
    ok('offscreen discovery waits for the row', await page.locator('.tech-decoding').count() === 0);
    await page.locator('[data-ico="drones"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-ico="drones"]').closest('.item').classList.contains('tech-decoding'));
    ok('scrolling into view starts the waiting discovery', await page.locator('.tech-decoding').count() === 1);
    ok('mobile stays within the viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { MUSTEAT.render(); MUSTEAT.buy('drones'); });
    ok('reduced motion restores text and skips new effects', await page.locator('.tech-decoding,.decode-letter').count() === 0 && /Teleport Licence/.test(await page.locator('#gear').innerText()));
    ok('no browser errors', errors.length === 0);
    console.log(`\n${checks} passed`);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (browser) await browser.close(); srv.close(); }
});
