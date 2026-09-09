// Balance play-test. Runs the real page (with ?dev, which exposes the economy) in headless
// Chromium with a bot playing a fresh save: taps a few times a second for the first stretch,
// then buys whatever pays back fastest. Time is simulated by overriding Date.now, so an hour
// of play takes seconds. Prints when each tier and building becomes affordable, how long the
// bot sat waiting with nothing to buy, and how many crates it saw.
//   node balance.js [minutes] [taps-per-second]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const MINUTES = +process.argv[2] || 60;
const TPS = process.argv[3] == null ? 2 : +process.argv[3];

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      fs.readFile(path.join(ROOT, 'index.html'), (err, data) => { rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(data.toString('utf8').replace(/SHEET_API: '[^']*'/, "SHEET_API: ''")); });
    }).listen(0, '127.0.0.1', () => res({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/index.html?dev' }));
  });
}

(async () => {
  const { srv, url } = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => { window.__t = Date.now(); Date.now = () => window.__t; });
  await page.goto(url);
  await page.click('#intro').catch(() => {}); // skip the splash
  await page.fill('#nm', 'Bot'); await page.click('#go');
  await page.waitForFunction(() => window.MUSTEAT && window.MUSTEAT.state.id);

  const report = await page.evaluate(async ([minutes, tps, every]) => {
    const M = window.MUSTEAT, s = M.state;
    const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n);
    const chain = M.GEAR.filter(g => g.dps);
    const firsts = {}, waits = [], samples = [];
    let lastBuy = 0, idleSince = null, crates = 0, tapsDone = 0, upgradesBought = 0;
    const gainOf = fn => { const before = M.calc(s).income; const snap = JSON.stringify({ g: s.gear, u: s.upg }); fn(); const after = M.calc(s).income; const o = JSON.parse(snap); s.gear = o.g; s.upg = o.u; return after - before; };
    // Like a person: buy the best payback among what is affordable now. Save up only when nothing is.
    const best = () => {
      let pick = null, cheapest = null;
      const consider = c => { if (!cheapest || c.cost < cheapest.cost) cheapest = c; if (c.cost <= s.cash && (!pick || c.roi > pick.roi)) pick = c; };
      M.GEAR.forEach(g => {
        const l = s.gear[g.id] || 0; if (g.max && l >= g.max) return;
        const cost = M.gearCost(g, l, 1);
        const gain = gainOf(() => { s.gear[g.id] = l + 1; });
        if (gain > 0) consider({ kind: 'gear', id: g.id, cost, roi: gain / cost, name: g.name });
      });
      M.UPGRADES.forEach(u => {
        if (s.upg[u.id] || !u.unlock(s)) return;
        const gain = gainOf(() => { s.upg[u.id] = true; }) + (u.tap ? M.calc(s).income * 0.02 * tps : 0);
        if (gain > 0) consider({ kind: 'upg', id: u.id, cost: u.cost, roi: gain / u.cost, name: u.name });
      });
      return pick || (cheapest ? Object.assign(cheapest, { wait: true }) : null);
    };
    const start = window.__t;
    for (let sec = 0; sec < minutes * 60; sec++) {
      window.__t = start + sec * 1000;
      M.frame();
      const crate = document.getElementById('crate');
      if (!crate.hidden && Math.random() < 0.5) { const before = s.crates; M.collectCrate(); crates += s.crates - before; } // count collections, not clicks during the closing animation
      const acknowledge = document.querySelector('#modal:not([hidden]) #ok');
      if (acknowledge) acknowledge.click(); // read/close the first crate before its rush clock starts
      for (let i = 0; i < tps; i++) { M.runDelivery(); tapsDone++; }
      if (!s.drone && s.cash >= 2500) document.querySelector('[data-act="drone"]').click(); // any human buys this once fined
      let bought = 0;
      // An idle player is not staring at the shop: they check in and buy every 10 minutes. A tapper buys as they go.
      if (!tps && sec % 600 !== 0) continue;
      if (s.dispatch.active) M.claimDispatch(); else M.acceptDispatch();
      for (;;) {
        const p = best(); if (!p) break;
        if (s.cash < p.cost) { if (idleSince == null && bought === 0) idleSince = sec; break; }
        if (p.kind === 'gear') M.buy(p.id); else { M.buyUpgrade(p.id); upgradesBought++; }
        bought++;
        if (idleSince != null) { waits.push({ from: idleSince, len: sec - idleSince, until: p.name }); idleSince = null; }
        lastBuy = sec;
      }
      chain.forEach(g => { if (!firsts[g.id] && s.gear[g.id]) firsts[g.id] = sec; });
      if (sec % 60 === 0 && (every ? (sec / 60) % every === 0 : [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440, 2880].includes(sec / 60))) samples.push({ min: sec / 60, cash: fmt(s.cash), ips: fmt(M.calc(s).income), value: fmt(M.calc(s).value), dps: fmt(M.calc(s).dps), tier: chain.filter(g => s.gear[g.id]).length, log: (s.log[0] || {}).text.replace(/<[^>]*>/g, '').slice(0, 60), gear: Object.entries(s.gear).map(([k, v]) => k + ':' + v).join(' '), upg: Object.keys(s.upg).length, ach: Object.keys(s.ach).length, heat: Math.round(s.heat) });
    }
    return { firsts, waits: waits.filter(w => w.len >= 60).sort((a, b) => b.len - a.len).slice(0, 8), samples, crates, tapsDone, upgradesBought, total: fmt(s.total), fines: s.fines, stampsNow: Math.floor(Math.cbrt(s.total / 1e7)) };
  }, [MINUTES, TPS, +process.env.EVERY || 0]);

  console.log(`\n${MINUTES} minutes, ${TPS} taps/s\n`);
  console.log('first bought (min):', Object.entries(report.firsts).map(([k, v]) => k + ' ' + (v / 60).toFixed(1)).join(', '));
  console.log('longest waits with nothing affordable (min):', report.waits.map(w => `${(w.len / 60).toFixed(1)} from ${(w.from / 60).toFixed(0)} until ${w.until}`).join(' | ') || 'none over 1 min');
  console.table(report.samples);
  console.log(`crates ${report.crates}, taps ${report.tapsDone}, upgrades ${report.upgradesBought}, lifetime ${report.total}, fines ${report.fines}, stamps if retired now ${report.stampsNow}`);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(2); });
