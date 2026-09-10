// Portfolio access, reward, recovery compatibility and most-owned scene. Local mock only.
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
const assert = require('node:assert/strict');

start(0, async ({ srv, url }) => {
  let browser, checks = 0;
  const ok = (name, value) => { assert.ok(value, name); checks++; console.log('  ok   ' + name); };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url + 'index.html?dev'); await page.click('#intro');
    await page.fill('#nm', 'Dossier Inspector'); await page.click('#go');
    await page.waitForFunction(() => MUSTEAT.state.id);
    const setup = values => page.evaluate(values => {
      Object.assign(MUSTEAT.state, { gear: {}, nextEvent: Date.now() + 1e9, crateAt: Date.now() + 1e9, told: { gang: Date.now(), rec: Date.now() } }, values);
      MUSTEAT.render();
    }, values);
    await setup({ total: 0, cash: 0 });
    ok('new player has a locked Portfolio', await page.locator('#tabPfB').evaluate(e => e.classList.contains('pf-locked')));
    await page.click('#tabPfB');
    ok('locked tab explains the free lifetime milestone', /20K.*lifetime[\s\S]*free/i.test(await page.locator('.dossier').innerText()));
    ok('claim disabled before eligibility', await page.locator('#portfolioClaim').isDisabled());
    await setup({ total: 19999, cash: 1e6, tab: 'portfolio' });
    ok('cash cannot bypass lifetime threshold or open the panel', await page.locator('#portfolioClaim').isDisabled() && await page.locator('#tab-portfolio').isHidden());
    await page.setViewportSize({ width: 390, height: 844 });
    ok('sealed dossier fits mobile', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await setup({ total: 20000, cash: 123 });
    ok('open dossier updates its claim button at the threshold', await page.locator('#portfolioClaim').isEnabled());
    ok('ready tab has its violet reward treatment', await page.locator('#tabPfB').evaluate(e => e.classList.contains('pf-ready')));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.click('#portfolioClaim');
    ok('claim unlocks and opens without spending cash', await page.evaluate(() => MUSTEAT.state.portfolioUnlocked && MUSTEAT.state.tab === 'portfolio' && MUSTEAT.state.cash === 123));
    ok('decryption reveal appears', await page.locator('.dossier-reveal').count() === 1);
    ok('decryption fits mobile', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.waitForTimeout(3000);
    ok('reveal cleans up', await page.locator('.dossier-reveal').count() === 0);
    await page.click('#tabRunB'); await page.click('#tabPfB');
    ok('reopening does not replay reward', await page.locator('.dossier-reveal').count() === 0);
    await setup({ gear: { trainers: 12, hover: 16, timeloop: 1 } });
    ok('scene uses most copies rather than highest tier', /Hoverbike×16/.test(await page.locator('#operation .scene-name').innerText()));
    ok('scene dots match count', await page.locator('#operation .tech-dots i').count() === 16);
    ok('operation is the last Portfolio section', await page.locator('#operation').evaluate(e => e.closest('section') === document.querySelector('#tab-portfolio').lastElementChild));
    ok('unlock survives recovery encoding', await page.evaluate(async () => (await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(MUSTEAT.state))).portfolioUnlocked));
    await page.evaluate(() => MUSTEAT.save()); await page.reload();
    await page.waitForFunction(() => window.MUSTEAT && MUSTEAT.state.id);
    ok('unlock survives reload', await page.evaluate(() => MUSTEAT.state.portfolioUnlocked));
    await page.evaluate(() => { delete MUSTEAT.state.portfolioUnlocked; MUSTEAT.save(); });
    await page.reload(); await page.waitForFunction(() => window.MUSTEAT && MUSTEAT.state.id);
    ok('established legacy save keeps Portfolio', await page.evaluate(() => MUSTEAT.state.portfolioUnlocked));
    ok('legacy recovery keeps Portfolio', await page.evaluate(async () => { const s = {...MUSTEAT.state}; delete s.portfolioUnlocked; return (await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(s))).portfolioUnlocked; }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup({ portfolioUnlocked: false, total: 20000, cash: 1, tab: 'run' });
    await page.click('#tabPfB');
    ok('reduced motion opens immediately without overlay', await page.locator('.dossier-reveal').count() === 0 && await page.locator('#tab-portfolio').isVisible());
    ok('no browser errors', errors.length === 0);
    console.log(`\n${checks} passed`);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { if (browser) await browser.close(); srv.close(); }
});
