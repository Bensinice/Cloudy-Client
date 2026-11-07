// Cloudy – Admin: E-Mail (SMTP) und Stripe einstellen (Karte „E-Mail & Stripe“). Die Werte liegen auf dem Server; Geheimnisse kommen nie zurück.
(function () {
  const $ = s => document.querySelector(s); if (!$('#cfSave')) return;
  const msg = (t, ok) => { const m = $('#cfMsg'); m.textContent = t || ''; m.style.color = ok ? 'var(--accent)' : ''; };
  let busy = false, dirty = false; // dirty: es wurde getippt, aber noch nicht gespeichert -> Neuladen darf nichts ueberschreiben
  document.querySelectorAll('#cfgAdm input, #cfgAdm select').forEach(e => e.addEventListener('input', () => { dirty = true; }));
  async function load() {
    let r = null; try { r = await window.cloudy.admSettingsGet(); } catch {} if (!r || !r.ok) { $('#cfInfo').textContent = (r && r.error) || ''; return; }
    const m = r.mail, s = r.stripe; if (!dirty) { $('#cfHost').value = m.host || ''; $('#cfPort').value = m.port || ''; $('#cfSec').value = m.secure || ''; $('#cfUser').value = m.user || ''; $('#cfFrom').value = m.from || ''; $('#cfTo').value = m.to || ''; $('#cfUrl').value = s.url || ''; }
    $('#cfPass').placeholder = m.passSet ? 'Passwort gesetzt (leer = behalten)' : 'Passwort (noch nicht gesetzt)'; $('#cfSk').placeholder = s.skSet ? 'Schlüssel gesetzt (' + s.skHint + ') – leer = behalten' : 'Geheimer Schlüssel sk_live_…'; $('#cfWh').placeholder = s.whSet ? 'Webhook-Secret gesetzt (' + s.whHint + ') – leer = behalten' : 'Webhook-Secret whsec_…';
    const chip = (id, ok, t) => { const e = $(id); e.textContent = t; e.className = 'cfchip ' + (ok ? 'ok' : 'bad'); };
    chip('#cfStMail', m.enabled, 'E-Mail: ' + (m.enabled ? 'eingerichtet ✓' : (m.host ? 'noch nicht eingerichtet' : 'kein SMTP-Server eingetragen'))); chip('#cfStStripe', s.ready, 'Stripe: ' + (s.ready ? 'bereit ✓' : 'nicht fertig (Schlüssel und Webhook-Secret nötig)')); $('#cfHook').textContent = r.webhook || ''; $('#cfInfo').textContent = '';
  }
  async function save(extra) {
    if (busy) return false; busy = true; msg('Speichere …');
    const body = { mail: { host: $('#cfHost').value, port: $('#cfPort').value, secure: $('#cfSec').value, user: $('#cfUser').value, from: $('#cfFrom').value, to: $('#cfTo').value, pass: $('#cfPass').value }, stripe: { sk: $('#cfSk').value, wh: $('#cfWh').value, url: $('#cfUrl').value }, clear: extra || [] };
    let r = null; try { r = await window.cloudy.admSettingsSet(body); } catch {} busy = false;
    if (r && r.ok) { $('#cfPass').value = $('#cfSk').value = $('#cfWh').value = ''; dirty = false; msg('Gespeichert ✓', true); load(); return true; } msg((r && r.error) || 'Fehlgeschlagen.'); return false;
  }
  $('#cfSave').onclick = () => save();
  const PRE = { gmail: ['smtp.gmail.com', 465, 'ssl'], outlook: ['smtp-mail.outlook.com', 587, 'starttls'] };
  document.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const p = PRE[b.dataset.pre]; $('#cfHost').value = p[0]; $('#cfPort').value = p[1]; $('#cfSec').value = p[2]; dirty = true; msg('Eingetragen – jetzt Benutzer und Passwort ausfüllen.', true); });
  $('#cfHookCopy').onclick = async () => { const t = $('#cfHook').textContent; try { await navigator.clipboard.writeText(t); msg('Webhook-Adresse kopiert ✓', true); } catch { msg('Kopieren nicht möglich – bitte von Hand markieren.'); } };
  // alle Links in den Einstellungen: im Standardbrowser oeffnen
  document.querySelector('#p-settings').addEventListener('click', e => { const a = e.target.closest('a[data-ext],a[href^="https://"]'); if (!a) return; e.preventDefault(); const u = a.dataset.ext || a.getAttribute('href'); try { window.cloudy.openExternal(u); } catch {} });
  $('#cfClearSk').onclick = () => { if (confirm('Stripe-Schlüssel und Webhook-Secret vom Server löschen? Danach ist das Bezahlen aus.')) save(['stripeKey', 'stripeWebhook']); };
  $('#cfMailTest').onclick = async () => { if (dirty && !(await save())) return; msg('Sende Test …'); let r = null; try { r = await window.cloudy.admMailTest(); } catch {} msg(r && r.ok ? 'Test-E-Mail gesendet an ' + r.to + ' ✓' : (r && r.error) || 'Fehlgeschlagen.', !!(r && r.ok)); };
  const ld = () => { if ($('#cfgAdm') && $('#cfgAdm').offsetParent) load(); };
  document.querySelectorAll('.nav[data-p]').forEach(n => n.addEventListener('click', () => setTimeout(ld, 400)));
  const t = document.querySelector('#p-settings'); if (t) new MutationObserver(ld).observe(t, { attributes: true, attributeFilter: ['data-tab'] });
  if (window.onLoggedIn) { const o = window.onLoggedIn; window.onLoggedIn = function () { try { setTimeout(ld, 800); } catch {} return o.apply(this, arguments); }; }
})();
