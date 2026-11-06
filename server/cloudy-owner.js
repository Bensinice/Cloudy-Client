// Hilfsprogramm: gibt einem Konto das Tag "owner" (= Admin-Rechte) direkt in der Datenbank. Server vorher beenden!
// node cloudy-owner.js <kontoname>   (liest DB_* aus der Umgebung, wie CLOUDY-SERVER.bat sie setzt)
const mysql = require('mysql2/promise'), e = process.env, name = String(process.argv[2] || '').trim().toLowerCase();
(async () => {
  if (!name) { console.error('Kein Kontoname angegeben.'); process.exit(1); }
  let c; try { c = await mysql.createConnection({ host: e.DB_HOST || '127.0.0.1', port: +(e.DB_PORT || 3306), user: e.DB_USER || 'CloudyClient', password: e.DB_PASS || '', database: e.DB_NAME || 'CloudyClient' }); }
  catch (x) { console.error('Datenbank-Login fehlgeschlagen: ' + (x.code || x.message)); process.exit(1); }
  const [t] = await c.query("SELECT table_name n FROM information_schema.tables WHERE table_schema = DATABASE()"); console.log('Tabellen in der Datenbank: ' + t.map(x => x.n).join(', '));
  const [r] = await c.query("SELECT v FROM cloudy_kv WHERE k='tags'"); let tags = {}; try { tags = r.length ? JSON.parse(r[0].v) : {}; } catch {}
  console.log('Vorhandene Tags: ' + (Object.keys(tags).length ? JSON.stringify(tags) : '(keine - der Import hat keine Tags mitgebracht)'));
  tags[name] = [...new Set([...(tags[name] || []), 'owner'])];
  await c.query('REPLACE INTO cloudy_kv (k,v) VALUES (?,?)', ['tags', JSON.stringify(tags)]);
  const [u] = await c.query('SELECT name_key, name FROM cloudy_users WHERE name_key = ?', [name]);
  if (!u.length) { const [all] = await c.query('SELECT name FROM cloudy_users ORDER BY created LIMIT 40'); console.log('WARNUNG: Es gibt kein Konto "' + name + '". Vorhandene Konten: ' + all.map(x => x.name).join(', ')); }
  else { await c.query('UPDATE cloudy_users SET admin = 1, banned = 0, paused = 0 WHERE name_key = ?', [name]); console.log('Konto ' + u[0].name + ': Admin-Flag gesetzt, nicht gesperrt.'); }
  await c.end();
  console.log('OK: "' + name + '" hat jetzt das Tag owner (Admin-Rechte).');
})().catch(x => { console.error(x.sqlMessage || x.message); process.exit(1); });
