// Hilfsprogramm fuer CLOUDY-SERVER.bat: legt Datenbank/Benutzer an und spielt .sql ein - ohne mysql-Programm, nur mit Node (mysql2).
// node cloudy-sql.js setup        (liest NEWDBPASS, optional ROOTPW)
// node cloudy-sql.js import <datei.sql>
const mysql = require('mysql2/promise'), fs = require('fs'), e = process.env;
const [, , mode, file] = process.argv, PASS = e.NEWDBPASS || e.DB_PASS || '';
(async () => {
  let c;
  try { c = await mysql.createConnection({ host: '127.0.0.1', port: +(e.DB_PORT || 3306), user: 'root', password: e.ROOTPW || '', multipleStatements: true, connectTimeout: 8000 }); }
  catch (x) { console.error(x.code === 'ER_ACCESS_DENIED_ERROR' ? 'Root-Zugang abgelehnt (Root-Passwort noetig).' : 'Keine Verbindung: ' + (x.code || x.message)); process.exit(x.code === 'ER_ACCESS_DENIED_ERROR' ? 2 : 1); }
  const grant = async () => { for (const h of ['127.0.0.1', 'localhost']) { await c.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', ['CloudyClient', h, PASS]); await c.query('ALTER USER ?@? IDENTIFIED BY ?', ['CloudyClient', h, PASS]); await c.query('GRANT ALL ON `CloudyClient`.* TO ?@?', ['CloudyClient', h]); } await c.query('FLUSH PRIVILEGES'); };
  if (mode === 'setup') { await c.query('CREATE DATABASE IF NOT EXISTS `CloudyClient` CHARACTER SET utf8mb4'); await grant(); }
  else if (mode === 'import') {
    const sql = fs.readFileSync(file, 'utf8');
    await c.query('DROP DATABASE IF EXISTS `CloudyClient`'); await c.query('CREATE DATABASE `CloudyClient` CHARACTER SET utf8mb4'); await grant(); await c.query('USE `CloudyClient`'); await c.query(sql);
  } else { console.error('Aufruf: setup | import <datei>'); process.exit(1); }
  await c.end(); console.log('OK');
})().catch(x => { console.error(x.sqlMessage || x.message); process.exit(1); });
