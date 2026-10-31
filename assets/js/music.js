// Cloudy – Hintergrundmusik: eingebaute Ambient-Musik (im Code erzeugt) und eigene Dateien. Lautstärke, Stumm, Weiter, Auto-Start.
(function () {
  const Ambient = {
    ctx: null, master: null, timer: null, i: -1,
    start(vol) {
      if (!this.ctx) {
        const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)(), lp = c.createBiquadFilter(), d = c.createDelay(), fb = c.createGain();
        this.master = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 1800; d.delayTime.value = .42; fb.gain.value = .38;
        this.master.connect(lp); lp.connect(c.destination); lp.connect(d); d.connect(fb); fb.connect(d); d.connect(c.destination);
      }
      this.ctx.resume(); this.set(vol); clearInterval(this.timer); this.chord(); this.timer = setInterval(() => this.chord(), 7000);
    },
    stop() { clearInterval(this.timer); if (this.ctx) this.ctx.suspend(); },
    set(v) { if (this.master) this.master.gain.value = v * 0.5; },
    chord() {
      const P = [[130.81, 261.63, 329.63, 392, 493.88], [110, 220, 261.63, 329.63, 392], [87.31, 174.61, 220, 261.63, 329.63], [98, 196, 246.94, 293.66, 392]];
      this.i = (this.i + 1) % P.length; const c = this.ctx, t = c.currentTime;
      P[this.i].forEach((f, k) => [-6, 6].forEach(det => {
        const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(k === 0 ? .2 : .1, t + 2.5); g.gain.linearRampToValueAtTime(0, t + 8);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 8.2);
      }));
    }
  };
  const audio = new Audio(); audio.preload = 'auto';
  const S = { vol: st.get('mVol', 0.3), muted: st.get('mMuted', false), auto: st.get('mAuto', true), idx: st.get('mIdx', 0), playing: false, files: [], hold: false };
  const tracks = () => [{ name: 'Cloudy Ambient (eingebaut)', amb: true }, ...S.files];
  const eff = () => (S.muted ? 0 : S.vol);
  function apply() { audio.volume = eff(); Ambient.set(eff()); }
  function stopAll() { audio.pause(); Ambient.stop(); }
  function play() {
    const t = tracks()[S.idx] || tracks()[0]; stopAll(); S.playing = true; apply();
    if (t.amb) Ambient.start(eff()); else { audio.src = t.url; audio.play().catch(() => next()); }
    paint();
  }
  function pause() { S.playing = false; stopAll(); paint(); }
  function next() { S.idx = (S.idx + 1) % tracks().length; st.set('mIdx', S.idx); if (S.playing) play(); else paint(); }
  audio.onended = next;
  const toggle = () => (S.playing ? pause() : play());
  async function load() { S.files = await window.cloudy.musicList(); if (S.idx >= tracks().length) S.idx = 0; paint(); }
  function paint() {
    const L = s => (window.t ? window.t(s) : s), t = tracks()[S.idx] || tracks()[0];
    $('#mPlay').textContent = S.playing ? L('Pause') : L('Abspielen'); $('#mMute').textContent = S.muted ? L('Ton an') : L('Stumm');
    $('#lgVol').value = Math.round(S.vol * 100); $('#lgMute').classList.toggle('off', S.muted || S.vol === 0);
    $('#mVol').value = Math.round(S.vol * 100); $('#mAuto').checked = S.auto; $('#mNow').textContent = L('Aktuell:') + ' ' + L(t.name);
    $('#musicBtn span').textContent = S.playing && !S.muted ? L('Musik aus') : L('Musik an');
    $('#mList').innerHTML = tracks().map((x, i) => `<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><button class="chip ${i === S.idx ? 'on' : ''}" data-mi="${i}" style="max-width:100%;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</button>${x.amb ? '' : `<button class="btn ghost" data-mr="${esc(x.file)}" style="height:32px;padding:0 12px">Entfernen</button>`}</div>`).join('');
    $$('#mList [data-mi]').forEach(b => b.onclick = () => { S.idx = +b.dataset.mi; st.set('mIdx', S.idx); play(); });
    $$('#mList [data-mr]').forEach(b => b.onclick = async () => { await window.cloudy.musicRemove(b.dataset.mr); S.idx = 0; if (S.playing) pause(); await load(); });
    if (window.setLang) window.setLang(document.documentElement.lang || 'de');
  }
  $('#mPlay').onclick = toggle; $('#musicBtn').onclick = () => { if (S.muted) { S.muted = false; st.set('mMuted', false); apply(); if (!S.playing) play(); else paint(); } else toggle(); };
  $('#mNext').onclick = next;
  $('#lgMute').onclick = () => { S.muted = !S.muted; st.set('mMuted', S.muted); apply(); if (!S.muted && !S.playing) play(); else paint(); };
  $('#lgVol').oninput = e => { S.vol = e.target.value / 100; st.set('mVol', S.vol); if (S.vol > 0 && S.muted) { S.muted = false; st.set('mMuted', false); } apply(); paint(); };
  $('#lgMore').onclick = e => { e.stopPropagation(); $('#lgMenu').classList.toggle('on'); }; document.addEventListener('click', e => { if (!e.target.closest('#lgMenu')) $('#lgMenu').classList.remove('on'); });
  $('#mMute').onclick = () => { S.muted = !S.muted; st.set('mMuted', S.muted); apply(); paint(); };
  $('#mVol').oninput = e => { S.vol = e.target.value / 100; st.set('mVol', S.vol); if (S.vol > 0 && S.muted) { S.muted = false; st.set('mMuted', false); } apply(); paint(); };
  $('#mAuto').onchange = e => { S.auto = e.target.checked; st.set('mAuto', S.auto); };
  $('#mAdd').onclick = async () => { const r = await window.cloudy.musicAdd(); if (r && r.added) await load(); };
  // Musik pausiert, solange Minecraft läuft
  window.cloudy.on('status', t => { if (/Minecraft startet/i.test(t) && S.playing) { S.hold = true; pause(); } });
  window.cloudy.on('gameStart', () => { if (S.playing) { S.hold = true; pause(); } });
  window.cloudy.on('closed', () => { if (S.hold) { S.hold = false; play(); } });
  const prev = window.onLoggedIn; let started = false;
  window.onLoggedIn = () => { if (prev) prev(); if (!started) { started = true; load().then(() => { if (S.auto) play(); }); } };
  let kick = false; const first = () => { if (!kick && S.auto && !S.playing && !S.muted && started === false) { kick = true; started = true; play(); } };
  load().then(() => { if (S.auto && !started) { started = true; play(); } });
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (S.auto && !S.playing && !S.muted && !S.hold && !kick) { kick = true; started = true; play(); } }, { once: true, capture: true })); void first;
})();
