// Cloudy – Netzwerk-Helfer ohne Abhängigkeiten: öffentliche IP, Port-Test, UPnP-Portfreigabe, Freundescodes
const dgram = require('dgram'), http = require('http'), net = require('net'), os = require('os');

const lanIps = () => { const o = []; for (const l of Object.values(os.networkInterfaces())) for (const a of l || []) if (a.family === 'IPv4' && !a.internal) o.push(a.address); return o; };
let pubCache = { t: 0, ip: '' };
async function publicIp() {
  if (Date.now() - pubCache.t < 300000 && pubCache.ip) return pubCache.ip;
  for (const u of ['https://api.ipify.org', 'https://ipv4.icanhazip.com']) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(4000) }), t = (await r.text()).trim(); if (/^\d+\.\d+\.\d+\.\d+$/.test(t)) { pubCache = { t: Date.now(), ip: t }; return t; } } catch {}
  }
  return '';
}
const tcpCheck = (host, port, ms = 1800) => new Promise(res => {
  const s = net.connect({ host, port: +port }); let done = false; const fin = v => { if (!done) { done = true; try { s.destroy(); } catch {} res(v); } };
  s.setTimeout(ms, () => fin(false)); s.on('connect', () => fin(true)); s.on('error', () => fin(false));
});

// ---- UPnP (Router öffnet den Port automatisch, wenn er es unterstützt) ----
function ssdp(ms = 2500) {
  return new Promise(res => {
    const s = dgram.createSocket('udp4'); let done = false; const fin = v => { if (!done) { done = true; try { s.close(); } catch {} res(v); } };
    s.on('error', () => fin(null)); s.on('message', m => { const t = /LOCATION:\s*(\S+)/i.exec(String(m)); if (t) fin(t[1]); });
    const q = Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n');
    try { s.bind(0, () => { try { s.send(q, 1900, '239.255.255.250'); } catch { fin(null); } }); } catch { fin(null); } setTimeout(() => fin(null), ms);
  });
}
const httpReq = (url, opt = {}, body) => new Promise((res, rej) => {
  const r = http.request(url, { method: 'GET', timeout: 3500, ...opt }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res({ status: x.statusCode, body: d })); });
  r.on('timeout', () => r.destroy(new Error('timeout'))); r.on('error', rej); if (body) r.write(body); r.end();
});
async function upnpMap(port) {
  try {
    const loc = await ssdp(); if (!loc) return { ok: false, why: 'Kein UPnP-Router gefunden.' };
    const x = (await httpReq(loc)).body, base = new URL(loc);
    const m = [...x.matchAll(/<service>([\s\S]*?)<\/service>/g)].map(a => a[1]).find(s => /WAN(IP|PPP)Connection/.test(s)); if (!m) return { ok: false, why: 'Router ohne Portfreigabe-Dienst.' };
    const type = /<serviceType>([^<]+)</.exec(m)[1], ctl = new URL(/<controlURL>([^<]+)</.exec(m)[1], base).href;
    const mine = lanIps().find(i => i.split('.').slice(0, 3).join('.') === base.hostname.split('.').slice(0, 3).join('.')) || lanIps()[0]; if (!mine) return { ok: false, why: 'Keine lokale IP.' };
    const env = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:AddPortMapping xmlns:u="${type}"><NewRemoteHost></NewRemoteHost><NewExternalPort>${port}</NewExternalPort><NewProtocol>TCP</NewProtocol><NewInternalPort>${port}</NewInternalPort><NewInternalClient>${mine}</NewInternalClient><NewEnabled>1</NewEnabled><NewPortMappingDescription>Cloudy</NewPortMappingDescription><NewLeaseDuration>0</NewLeaseDuration></u:AddPortMapping></s:Body></s:Envelope>`;
    const r = await httpReq(ctl, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPAction: `"${type}#AddPortMapping"`, 'Content-Length': Buffer.byteLength(env) } }, env);
    return r.status === 200 ? { ok: true } : { ok: false, why: 'Der Router hat die Freigabe abgelehnt.' };
  } catch (e) { return { ok: false, why: 'UPnP nicht möglich.' }; }
}

// ---- Freundescode: IP + Port als kurzer Code (z. B. CLD-ABCD-EFGH-IJKL-MNOP), damit niemand eine IP tippen muss ----
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function encodeCode(pub, lan, port) {
  const b = Buffer.alloc(10); (pub || '0.0.0.0').split('.').forEach((n, i) => b[i] = +n || 0); (lan || '0.0.0.0').split('.').forEach((n, i) => b[4 + i] = +n || 0); b.writeUInt16BE(port, 8);
  let bits = '', out = ''; for (const x of b) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i < 80; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return 'CLD-' + out.match(/.{4}/g).join('-');
}
function decodeCode(code) {
  const s = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^CLD/, ''); if (s.length !== 16) return null;
  let bits = ''; for (const c of s) { const i = B32.indexOf(c); if (i < 0) return null; bits += i.toString(2).padStart(5, '0'); }
  const b = Buffer.from(bits.match(/.{8}/g).map(x => parseInt(x, 2))), ip = o => [...b.slice(o, o + 4)].join('.');
  return { hosts: [ip(0), ip(4)].filter(h => h !== '0.0.0.0'), port: b.readUInt16BE(8) };
}
module.exports = { lanIps, publicIp, tcpCheck, upnpMap, encodeCode, decodeCode };
