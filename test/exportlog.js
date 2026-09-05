// Exports the current Claude Code session for this project into .logs/ as a readable
// markdown transcript plus the raw .jsonl, both timestamped. .logs/ is gitignored.
//   node test/exportlog.js               newest session for this project
//   node test/exportlog.js <file.jsonl>  a specific transcript
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.logs');

function findLatest() {
  const slug = root.replace(/[:\\/]/g, '-');
  const dir = path.join(os.homedir(), '.claude', 'projects', slug);
  if (!fs.existsSync(dir)) throw new Error('No session folder at ' + dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => path.join(dir, f))
    .map(f => ({ f, t: fs.statSync(f).mtimeMs })).sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error('No .jsonl transcripts in ' + dir);
  return files[0].f;
}

const src = process.argv[2] ? path.resolve(process.argv[2]) : findLatest();
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16); // YYYY-MM-DD-HH-mm
const lines = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean);
const clip = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + ' …[' + (s.length - n) + ' more chars]' : s; };
const out = [];
let first = null, last = null, users = 0;
for (const line of lines) {
  let o; try { o = JSON.parse(line); } catch (e) { continue; }
  if (o.type !== 'user' && o.type !== 'assistant') continue;
  const ts = o.timestamp || ''; first = first || ts; last = ts || last;
  const content = (o.message || {}).content;
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : [];
  for (const b of blocks) {
    if (b.type === 'text' && b.text && b.text.trim()) {
      if (o.type === 'user') users++;
      out.push(`\n### ${o.type === 'user' ? 'USER' : 'ASSISTANT'} · ${ts}\n\n${b.text.trim()}\n`);
    } else if (b.type === 'tool_use') {
      const inp = b.input || {};
      const brief = inp.description || inp.command || inp.file_path || inp.pattern || inp.prompt || JSON.stringify(inp);
      out.push(`> tool ${b.name}: ${clip(String(brief).replace(/\s+/g, ' '), 200)}`);
    } else if (b.type === 'tool_result') {
      const c = Array.isArray(b.content) ? b.content.map(x => x.text || (x.type === 'image' ? '[image]' : '')).join('\n') : b.content;
      const t = String(c == null ? '' : c).trim();
      if (t) out.push(`> result: ${clip(t.replace(/\s+/g, ' '), 400)}`);
    }
  }
}
const header = `# MustEat session log\n\nSession ${path.basename(src, '.jsonl')}\nFrom ${first} to ${last}\nExported ${new Date().toISOString()}\n\nUser and assistant messages in full; tool calls one line each; tool results trimmed to 400 characters. The raw transcript is alongside as .jsonl.\n`;
const md = path.join(outDir, stamp + '-session.md'), raw = path.join(outDir, stamp + '-session.jsonl');
fs.writeFileSync(md, header + out.join('\n'));
fs.copyFileSync(src, raw);
console.log(`${path.relative(root, md)}  (${users} user messages, ${(fs.statSync(md).size / 1024).toFixed(0)} KB)`);
console.log(`${path.relative(root, raw)}  (${(fs.statSync(raw).size / 1048576).toFixed(1)} MB raw)`);
