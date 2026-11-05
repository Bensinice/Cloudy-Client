const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const env = require('../lib/envfile'), F = require('../lib/files'), { Manager } = require('../lib/manager');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-')); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
// env
const p = env.parse('# x\nA=1\nB="two words"\n bad line\nC_D=x=y\n'); ok(p.A === '1' && p.B === 'two words' && p.C_D === 'x=y', 'env parse');
ok(env.parse(env.serialize({ A: '1', B: 'a\nb' })).B === 'a b', 'env newline'); ok(env.mask('DB_PASS', 'x') !== 'x' && env.mask('PORT', '1') === '1', 'mask');
// files: safe
const root = path.join(tmp, 'srv'); fs.mkdirSync(root); fs.writeFileSync(path.join(root, 'app.js'), 'console.log(1)\n');
for (const bad of ['../x.js', '/etc/passwd', 'a/../../x.js', 'node_modules/x.js', 'x.exe', '', 'a\0.js']) assert.throws(() => F.safe(root, bad), undefined, bad), n++;
fs.symlinkSync('/etc', path.join(root, 'lnk')); assert.throws(() => F.safe(root, 'lnk/hosts.txt')); n++;
// write: syntax check, snapshot, atomic
ok(F.check('a.js', 'let x = ;').message, 'syntax err'); ok(F.check('a.js', 'const a=1') === null, 'ok js');
ok(F.check('a.js', '#!/usr/bin/env node\nlet a=1') === null, 'shebang');
assert.throws(() => F.write(root, 'app.js', 'let x = ;'), /Syntaxfehler/); ok(F.read(root, 'app.js') === 'console.log(1)\n', 'unchanged after reject');
F.write(root, 'app.js', 'console.log(2)\n'); ok(F.read(root, 'app.js') === 'console.log(2)\n', 'written'); ok(F.versions(root, 'app.js').length === 1, 'snapshot');
ok(F.readVersion(root, 'app.js', F.versions(root, 'app.js')[0].id) === 'console.log(1)\n', 'version content');
assert.throws(() => F.readVersion(root, 'app.js', '../../x'), /Ungültig/); n++;
F.write(root, 'app.js', 'let x = ;', true); ok(F.read(root, 'app.js') === 'let x = ;', 'force write');
assert.throws(() => F.write(root, 'd.json', '{bad'), /Syntax/); n++;
ok(!fs.readdirSync(root).some(f => f.includes('.tmp-')), 'no tmp left');
ok(F.list(root).some(f => f.file === 'app.js') && !F.list(root).some(f => f.file.startsWith('.history')), 'list');
// syncDefaults
const def = path.join(tmp, 'def'); fs.mkdirSync(def); fs.writeFileSync(path.join(def, 'app.js'), 'v1\n'); fs.writeFileSync(path.join(def, 'site.js'), 's1\n'); fs.writeFileSync(path.join(def, 'x.command'), 'no');
const r2 = path.join(tmp, 'r2'); let r = F.syncDefaults(r2, def); ok(r.copied.length === 2 && !fs.existsSync(path.join(r2, 'x.command')), 'first copy, skip .command');
fs.writeFileSync(path.join(def, 'app.js'), 'v2\n'); fs.writeFileSync(path.join(def, 'site.js'), 's2\n');
F.write(r2, 'site.js', 'mine\n'); r = F.syncDefaults(r2, def); // app.js unveraendert -> update, site.js vom Nutzer -> behalten
ok(r.updated.includes('app.js') && F.read(r2, 'app.js') === 'v2\n', 'untouched updated'); ok(r.pending.includes('site.js') && F.read(r2, 'site.js') === 'mine\n', 'user edit kept');
F.resetToDefault(r2, def, 'site.js'); ok(F.read(r2, 'site.js') === 's2\n', 'reset'); ok(F.versions(r2, 'site.js').length >= 1, 'reset keeps mine');
const r3 = path.join(tmp, 'r3'); fs.mkdirSync(r3); fs.writeFileSync(path.join(r3, 'app.js'), 'old user server\n'); r = F.syncDefaults(r3, def); ok(F.read(r3, 'app.js') === 'old user server\n' && r.pending.includes('app.js'), 'existing folder never overwritten');
// manager
(async () => {
  const m = new Manager('t', () => ({ cmd: process.execPath, args: ['-e', 'console.log("hi");setInterval(()=>{},1000)'], env: process.env }), { backoffMs: 50 });
  m.start(); await new Promise(r => setTimeout(r, 600)); ok(m.state === 'running' && m.logs.some(l => l.s === 'hi'), 'running + log');
  m.proc.kill('SIGKILL'); await new Promise(r => setTimeout(r, 700)); ok(m.restarts >= 1 && m.state === 'running', 'auto restart after kill');
  await m.stop(); ok(m.state === 'stopped' && !m.proc, 'stop');
  const c = new Manager('c', () => ({ cmd: process.execPath, args: ['-e', 'process.exit(1)'], env: process.env }), { backoffMs: 20, maxCrashes: 3 });
  c.start(); await new Promise(r => setTimeout(r, 1200)); ok(c.state === 'error' && /immer wieder/.test(c.lastError), 'crash-loop brake'); 
  const e = new Manager('e', () => ({ cmd: '/nonexistent/x', args: [], env: process.env }), { autoRestart: false }); e.start(); await new Promise(r => setTimeout(r, 300)); ok(/nicht gefunden/.test(e.lastError), 'ENOENT message');
  const th = new Manager('th', () => { throw new Error('boom'); }); th.start(); ok(th.state === 'error' && th.lastError === 'boom', 'spec throws');
  console.log(`OK – ${n} Prüfungen`); fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.error('FAIL', e); process.exit(1); });
