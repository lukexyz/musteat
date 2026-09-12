// MustEat sheet backend. One Google Sheet, three tabs: players, events, ledger.
// Deploy as a web app (Deploy > New deployment > Web app, execute as Me, access Anyone) and put
// the /exec URL into CONFIG.SHEET_API in index.html.
//
// Contract (PORTING.md has the long version):
//   GET  ?table=players                      -> all rows as JSON
//   POST ?table=players  {upsert: row}       -> merge by id (only the columns sent), add if new
//   POST ?table=events   {append: row}       -> add a row
//   POST ?op=sync        {upsert: row, append: {events: [...], ledger: [...]}}
//                                            -> do all of that, then return {players, events, ledger}
//   POST ?op=append      {append: {events: [...], ledger: [...]}}   (sent by sendBeacon on tab close)
// POST bodies are text/plain so the browser does not preflight. Apps Script answers POST with a
// redirect and the browser follows it; the JSON comes back from the redirect target.

const TABLES = ['players', 'events', 'ledger'];
const HEADERS = {
  players: ['id', 'code', 'name', 'ref', 'dept', 'total', 'meals', 'rank', 'shopName', 'buildings', 'stamps', 'sprint', 'played', 'paceVersion', 'pace0', 'lastSeen', 'offer', 'franchiseOf', 'franchiseName', 'claimedBy', 'claimedName', 'claimedAt', 'claimedOffer'],
  events: ['id', 'ts', 'pid', 'who', 'kind', 'arg', 'text', 'effect', 'amount', 'of'],
  ledger: ['id', 'ts', 'from', 'fromName', 'to', 'toName', 'level', 'kind', 'amount'],
};
const ZW = '​'; // zero-width space prefix that keeps a string a string: no formulas from "=1+1", no numbers from "007"

function doGet(e) {
  const t = ((e && e.parameter) || {}).table; // e is undefined when Run from the editor, which is how the script gets authorised
  return out(t && TABLES.indexOf(t) >= 0 ? readTable(t) : { error: 'table=players|events|ledger' });
}

function doPost(e) {
  const p = e.parameter || {};
  let body = {};
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ error: 'bad json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (p.op === 'sync') {
      if (body.upsert) upsertRow('players', body.upsert);
      appendAll(body.append);
      return out({ players: readTable('players'), events: readTable('events'), ledger: readTable('ledger') });
    }
    if (p.op === 'append') { appendAll(body.append); return out({ ok: true }); }
    if (TABLES.indexOf(p.table) >= 0 && body.upsert) return out(upsertRow(p.table, body.upsert));
    if (TABLES.indexOf(p.table) >= 0 && body.append) return out(appendRow(p.table, body.append));
    return out({ error: 'nothing to do' });
  } finally {
    lock.releaseLock();
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheetFor(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(HEADERS[name]); sh.setFrozenRows(1); }
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS[name]); sh.setFrozenRows(1); }
  return sh;
}
function headersOf(sh) {
  const w = sh.getLastColumn();
  return w ? sh.getRange(1, 1, 1, w).getValues()[0].map(String) : [];
}
// Any key the row carries that the header does not is added as a new column. Clients own their columns.
function ensureColumns(sh, headers, row) {
  Object.keys(row).forEach(k => { if (headers.indexOf(k) < 0) { headers.push(k); sh.getRange(1, headers.length).setValue(k); } });
  return headers;
}
function enc(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = String(v);
  if (s === '') return '';
  if (/^[=+\-@']/.test(s) || /^\s*[-+]?\d[\d,]*(\.\d+)?([eE][-+]?\d+)?\s*$/.test(s) || s.charAt(0) === ZW || /^(true|false)$/i.test(s)) return ZW + s;
  return s;
}
function dec(v) {
  if (typeof v === 'string' && v.charAt(0) === ZW) return v.slice(1);
  if (v instanceof Date) return v.getTime();
  return v;
}
function readTable(name) {
  const sh = sheetFor(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const headers = headersOf(sh);
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  const rows = [];
  values.forEach(r => {
    const o = {}; let any = false;
    headers.forEach((h, i) => { const v = dec(r[i]); if (v !== '' && v !== null && v !== undefined) { o[h] = v; any = true; } });
    if (any && o.id !== undefined) rows.push(o);
  });
  return rows;
}
function findRowById(sh, headers, id) {
  const col = headers.indexOf('id') + 1;
  if (!col) return 0;
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(dec(ids[i][0])) === String(id)) return i + 2;
  return 0;
}
function upsertRow(name, row) {
  if (!row || row.id === undefined || row.id === null || row.id === '') return { error: 'no id' };
  const sh = sheetFor(name);
  const headers = ensureColumns(sh, headersOf(sh), row);
  const at = findRowById(sh, headers, row.id);
  if (at) {
    // Merge: write only the columns the client sent. Other clients' columns on this row are left alone.
    Object.keys(row).forEach(k => { sh.getRange(at, headers.indexOf(k) + 1).setValue(enc(row[k])); });
  } else {
    sh.appendRow(headers.map(h => enc(row[h])));
  }
  return row;
}
// Every id already on the sheet, read once per batch. Clients resend rows after a timed-out sync, and two open
// sessions can write the same credit, so a row whose id is already present is dropped rather than appended twice.
function existingIds(sh, headers) {
  const seen = {};
  const col = headers.indexOf('id') + 1, last = sh.getLastRow();
  if (col && last >= 2) sh.getRange(2, col, last - 1, 1).getValues().forEach(r => { const id = String(dec(r[0])); if (id !== '') seen[id] = true; });
  return seen;
}
function appendRows(name, rows) {
  const sh = sheetFor(name);
  let headers = headersOf(sh);
  const seen = existingIds(sh, headers);
  let added = 0;
  rows.forEach(row => {
    if (!row || typeof row !== 'object') return;
    const id = row.id === undefined || row.id === null ? '' : String(row.id);
    if (id !== '') { if (seen[id]) return; seen[id] = true; }
    headers = ensureColumns(sh, headers, row);
    sh.appendRow(headers.map(h => enc(row[h])));
    added++;
  });
  return added;
}
function appendRow(name, row) {
  if (!row) return { error: 'no row' };
  appendRows(name, [row]);
  return row;
}
function appendAll(map) {
  if (!map) return;
  TABLES.forEach(t => { if (Array.isArray(map[t]) && map[t].length) appendRows(t, map[t]); });
}
