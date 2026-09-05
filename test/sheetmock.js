// A stand-in for backend/Code.gs: the same HTTP contract, in memory, in Node. Two uses:
//   node sheetmock.js            serves the game at http://127.0.0.1:8787/ wired to itself, so two
//                                different browsers (or a normal and a private window) share one company
//   require('./sheetmock')       remote.js starts it on a random port and drives it with Playwright
// Like Apps Script it answers POST with a redirect to where the JSON is, and sets CORS on everything.
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TABLES = ['players', 'events', 'ledger'];

function start(port, cb) {
  const db = { players: [], events: [], ledger: [] };
  const redirects = {}; let rid = 0;
  const clean = row => { const o = {}; Object.keys(row).forEach(k => { if (row[k] !== null && row[k] !== undefined && row[k] !== '') o[k] = row[k]; }); return o; };
  const upsert = (table, row) => { const t = db[table]; const i = t.findIndex(r => r.id === row.id); if (i >= 0) Object.assign(t[i], clean(row)); else t.push(clean(row)); return row; };
  const append = (table, row) => { db[table].push(clean(row)); return row; };
  const appendAll = map => { if (map) TABLES.forEach(t => (map[t] || []).forEach(r => append(t, r))); };
  const srv = http.createServer((req, rsp) => {
    const u = new URL(req.url, 'http://x');
    const cors = { 'Access-Control-Allow-Origin': '*' };
    const json = obj => { rsp.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); rsp.end(JSON.stringify(obj)); };
    if (u.pathname.startsWith('/redirect/')) { const body = redirects[u.pathname.slice(10)]; delete redirects[u.pathname.slice(10)]; return json(body || { error: 'gone' }); }
    if (u.pathname === '/api') {
      const table = u.searchParams.get('table'), op = u.searchParams.get('op');
      if (req.method === 'GET') return json(TABLES.includes(table) ? db[table] : { error: 'table?' });
      let raw = ''; req.on('data', d => { raw += d; });
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(raw || '{}'); } catch (e) {}
        let result;
        if (op === 'sync') { if (body.upsert) upsert('players', body.upsert); appendAll(body.append); result = { players: db.players, events: db.events, ledger: db.ledger }; }
        else if (op === 'append') { appendAll(body.append); result = { ok: true }; }
        else if (TABLES.includes(table) && body.upsert) result = upsert(table, body.upsert);
        else if (TABLES.includes(table) && body.append) result = append(table, body.append);
        else result = { error: 'nothing to do' };
        const id = String(++rid); redirects[id] = result; // Apps Script style: the answer lives behind a redirect
        rsp.writeHead(302, Object.assign({ Location: '/redirect/' + id }, cors)); rsp.end();
      });
      return;
    }
    // Static: the game and the ledger page, with SHEET_API pointed at this server.
    const file = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
    fs.readFile(file, (err, data) => {
      if (err) { rsp.writeHead(404); return rsp.end(); }
      if (file.endsWith('.html')) data = data.toString('utf8').replace("SHEET_API: ''", "SHEET_API: 'http://127.0.0.1:" + srv.address().port + "/api'");
      rsp.writeHead(200, { 'Content-Type': file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8' }); rsp.end(data);
    });
  }).listen(port, '127.0.0.1', () => cb && cb({ srv, db, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  return srv;
}
module.exports = { start };
if (require.main === module) start(+process.argv[2] || 8787, ({ url }) => console.log('MustEat with a shared company at ' + url + 'index.html (ledger at ' + url + 'ledger.html). Open it in two different browsers.'));
