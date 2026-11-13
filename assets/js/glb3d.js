// Cloudy – 3D-Cosmetics aus .glb-Dateien (Hut, Krone, Umhaenge, Fluegel) in echtem 3D (three.js).
// Eine Platzierung fuer Launcher UND Mod: die Zahlen in PLACE stehen genauso in client-src/.../GLB.java.
// Koordinaten (glTF): Y oben, +Z = Vorderseite des Spielers, 1 Einheit = 1 Block. Ursprung: Hut = Halsgelenk (Kopfmitte unten), Umhang = Halsgelenk, Fluegel = oberer Ruecken.
(function () {
  if (!window.THREE || !THREE.GLTFLoader) return;
  const MODELS = {
    'hat-g3wizard': { file: 'astral_wizard_hat.glb', kind: 'hat', name: 'Astraler Zauberhut', view: 'front' },
    'hat-g3crown': { file: 'crown_of_embers.glb', kind: 'hat', name: 'Krone der Glut', view: 'front' },
    'cape-g3nebula': { file: 'nebula_drift_cape.glb', kind: 'cape', name: 'Nebeltreiben-Umhang', view: 'back' },
    'cape-g3phoenix': { file: 'inferno_phoenix_cape.glb', kind: 'cape', name: 'Inferno-Phönix-Umhang', view: 'back' },
    'wings-g3seraph': { file: 'seraph_wings.glb', kind: 'wings', name: 'Seraph-Flügel', view: 'back' },
    'wings-g3prism': { file: 'prism_shard_wings.glb', kind: 'wings', name: 'Prismensplitter-Flügel', view: 'back' },
    'wings-g3void': { file: 'void_dragon_wings.glb', kind: 'wings', name: 'Leere-Drachenflügel', view: 'back' },
    'wings-g4abyss': { file: 'abyss_bat_wings.glb', kind: 'wings', name: 'Abgrund-Fledermausflügel', view: 'back' },
    'wings-g4frost': { file: 'frostfeather_wings.glb', kind: 'wings', name: 'Frostfeder-Flügel', view: 'back' },
    'wings-g4amethyst': { file: 'amethyst_flame_wings.glb', kind: 'wings', name: 'Amethystflammen-Flügel', view: 'back' },
    'wings-g4mono': { file: 'monochrome_shard_wings.glb', kind: 'wings', name: 'Monochrom-Splitterflügel', view: 'back' },
    'wings-g4venom': { file: 'venom_neon_wings.glb', kind: 'wings', name: 'Gift-Neon-Flügel', view: 'back' },
    'cape-g4viper': { file: 'zigzag_viper_cape.glb', kind: 'cape', name: 'Zickzack-Viper-Umhang', view: 'back' },
    'cape-g4vortex': { file: 'amethyst_vortex_cape.glb', kind: 'cape', name: 'Amethyst-Wirbel-Umhang', view: 'back' },
    'cape-g4glitch': { file: 'mono_glitch_cape.glb', kind: 'cape', name: 'Mono-Glitch-Umhang', view: 'back' },
    'cape-g4crest': { file: 'cloudy_crest_cape.glb', kind: 'cape', name: 'Cloudy-Wappen-Umhang', view: 'back' },
    'cape-g4drip': { file: 'toxic_drip_cape.glb', kind: 'cape', name: 'Gift-Tropfen-Umhang', view: 'back' },
  };
  // Platzierung relativ zum Koerper (Block-Einheiten, Y oben, +Z vorne). Hut am Kopf, Umhang/Fluegel am Koerper (Ursprung = Hals).
  const PLACE = {
    hat: { pos: [0, 0, 0], scale: 1 },
    cape: { pos: [0, 0, -0.155], scale: 1, tilt: 0.05 },
    wings: { pos: [0, -0.22, -0.15], scale: 0.62 },
    halo: [0, 0.66, 0], // Heiligenschein der Seraph-Fluegel: ueber der Kopfmitte (Ursprung = Halsgelenk)
  };
  const NECK = 1.5; // Hoehe des Halsgelenks ueber den Fuessen
  const cache = new Map(); // id -> Promise<gltf scene>

  const has = id => !!MODELS[id];
  const usesGlb = eq => !!eq && ['hat', 'cape', 'wings'].some(k => eq[k] && MODELS[eq[k]]);

  async function bytes(file) {
    if (window.cloudy && window.cloudy.glbRead) { const b = await window.cloudy.glbRead(file); if (b) return b.buffer ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b; throw new Error('glb ' + file); }
    const r = await fetch('assets/cosmetics3d/' + file); if (!r.ok) throw new Error('glb ' + file); return r.arrayBuffer(); // ohne Electron (Tests)
  }
  function load(id) {
    if (!cache.has(id)) cache.set(id, bytes(MODELS[id].file).then(buf => new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', g => {
      g.scene.traverse(o => { if (o.isMesh) { const m = o.material, map = m.map; if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true; }
        o.material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.3, transparent: false }); } });
      res(g.scene);
    }, rej))).catch(e => { cache.delete(id); throw e; }));
    return cache.get(id);
  }
  const clone = async id => (await load(id)).clone(true);

  // ---- Spielfigur aus Skin (64x64 / 64x32) ----
  function faceUV(g, x0, y0, x1, y1, W, H, i) { const uv = g.attributes.uv, a = i * 4; [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach((p, k) => uv.setXY(a + k, p[0] / W, 1 - p[1] / H)); }
  function skinBox(tex, W, H, u, v, w, h, d, cx, cy, cz, grow, flip) {
    const g = new THREE.BoxGeometry((w + grow) / 16, (h + grow) / 16, (d + grow) / 16);
    // BoxGeometry-Flaechen: +x,-x,+y,-y,+z,-z. Spieler schaut nach +Z, sein Links ist +X.
    const R = [[u + d + w, v + d, u + d + w + d, v + d + h], [u, v + d, u + d, v + d + h], [u + d, v, u + d + w, v + d], [u + d + w, v, u + 2 * d + w, v + d], [u + d, v + d, u + d + w, v + d + h], [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h]];
    R.forEach((r, i) => faceUV(g, flip ? r[2] : r[0], r[1], flip ? r[0] : r[2], r[3], W, H, i));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, transparent: false, side: grow ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(cx / 16, cy / 16, cz / 16); return m;
  }
  function buildPlayer(skin, slim) {
    const root = new THREE.Group(), W = 64, tall = !skin || (skin.naturalHeight || 64) >= 64, H = tall ? 64 : 32;
    const tex = new THREE.Texture(skin || undefined); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true; if (!skin) tex.image = fallbackSkin();
    const aw = slim ? 3 : 4, head = new THREE.Group(), body = new THREE.Group();
    head.position.set(0, NECK, 0); body.position.set(0, NECK, 0); root.add(head, body);
    head.add(skinBox(tex, W, H, 0, 0, 8, 8, 8, 0, 4, 0, 0)); head.add(skinBox(tex, W, H, 32, 0, 8, 8, 8, 0, 4, 0, 1.2));
    const y = NECK * 16; // Pixel ueber dem Boden
    body.add(skinBox(tex, W, H, 16, 16, 8, 12, 4, 0, -6, 0, 0));
    root.add(skinBox(tex, W, H, 40, 16, aw, 12, 4, -(4 + aw / 2), y - 6, 0, 0)); root.add(skinBox(tex, W, H, tall ? 32 : 40, tall ? 48 : 16, aw, 12, 4, 4 + aw / 2, y - 6, 0, 0));
    root.add(skinBox(tex, W, H, 0, 16, 4, 12, 4, -2, 6, 0, 0)); root.add(skinBox(tex, W, H, tall ? 16 : 0, tall ? 48 : 16, 4, 12, 4, 2, 6, 0, 0));
    if (tall) { body.add(skinBox(tex, W, H, 16, 32, 8, 12, 4, 0, -6, 0, 0.8)); root.add(skinBox(tex, W, H, 40, 32, aw, 12, 4, -(4 + aw / 2), y - 6, 0, 0.8)); root.add(skinBox(tex, W, H, 48, 48, aw, 12, 4, 4 + aw / 2, y - 6, 0, 0.8)); root.add(skinBox(tex, W, H, 0, 32, 4, 12, 4, -2, 6, 0, 0.8)); root.add(skinBox(tex, W, H, 0, 48, 4, 12, 4, 2, 6, 0, 0.8)); }
    return { root, head, body };
  }
  function fallbackSkin() { // einfache Steve-aehnliche Figur, falls noch kein Skin geladen ist
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    const f = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    f(0, 0, 64, 64, 'rgba(0,0,0,0)'); f(0, 0, 32, 16, '#b98a62'); f(8, 8, 8, 8, '#c99a72'); f(9, 10, 2, 2, '#fff'); f(13, 10, 2, 2, '#fff'); f(10, 10, 1, 1, '#3b4a9a'); f(14, 10, 1, 1, '#3b4a9a'); f(8, 8, 8, 2, '#4a2f1a');
    f(16, 16, 24, 16, '#2fb4c4'); f(40, 16, 16, 16, '#c99a72'); f(0, 16, 16, 16, '#3a3f9a'); f(32, 48, 16, 16, '#c99a72'); f(16, 48, 16, 16, '#3a3f9a'); return c;
  }

  // ---- Platzierung + Animation ----
  function dress(parts, eq, t) { // haengt die Modelle an Kopf/Koerper; gibt Animations-Funktion zurueck
    const anim = [];
    return Promise.all(['hat', 'cape', 'wings'].filter(k => eq[k] && MODELS[eq[k]]).map(async k => {
      const m = await clone(eq[k]), P = PLACE[k], g = new THREE.Group(); g.add(m); g.position.set(P.pos[0], P.pos[1], P.pos[2]); g.scale.setScalar(P.scale);
      (k === 'hat' ? parts.head : parts.body).add(g);
      if (k === 'wings') m.traverse(o => { if (o.name && /halo/i.test(o.name)) { const h = new THREE.Group(); o.parent.remove(o); h.add(o); o.position.set(0, 0, 0); h.position.set(PLACE.halo[0], PLACE.halo[1], PLACE.halo[2]); parts.head.add(h); } }); // Heiligenschein haengt am Kopf, nicht an den Fluegeln
      if (k === 'cape') anim.push(now => { g.rotation.x = P.tilt + 0.03 * Math.sin(now / 900); g.position.z = P.pos[2]; });
      if (k === 'wings') { const w = []; m.traverse(o => { if (o.name && /wing/i.test(o.name) && o.parent && o.position.x !== 0 && !/halo/i.test(o.name)) { o.userData.base = o.rotation.y; o.userData.side = Math.sign(o.position.x); w.push(o); } });
        anim.push(now => { for (let i = 0; i < w.length; i++) { const o = w[i], f = Math.sin(now / 520); o.rotation.y = o.userData.base + o.userData.side * (0.12 + 0.17 * f); } }); }
    })).then(() => now => anim.forEach(a => a(now)));
  }

  // ---- Live-Vorschau (ein gemeinsamer WebGL-Kontext, wird in den jeweiligen Host gesteckt) ----
  function renderer(host, w, h) { // ein WebGL-Kontext je Anzeige-Feld (Shop-Vorschau, Start-Banner); wird bei jedem Neuzeichnen wiederverwendet
    let G = host._glb;
    if (!G) { const cv = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: false }); r.setClearColor(0x000000, 0); r.outputEncoding = THREE.sRGBEncoding; G = host._glb = { cv, r, token: 0 }; }
    G.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); G.r.setSize(w, h, false); G.cv.style.cssText = 'width:100%;height:100%;display:block;touch-action:none'; return G;
  }
  async function mount(host, o) { // o: { equip, skin (Image|null), slim, angle: () => grad }
    host.innerHTML = ''; host._apply = null; const w = host.clientWidth || 260, h = host.clientHeight || 340; const G = renderer(host, w, h), r = G.r, my = ++G.token; host.appendChild(G.cv);
    const scene = new THREE.Scene(), pl = buildPlayer(o.skin, o.slim); scene.add(pl.root);
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50); cam.position.set(0, 1.4, 7.4); cam.lookAt(0, 1.38, 0);
    let tick = () => {}; try { tick = await dress(pl, o.equip || {}); } catch (e) { console.warn('GLB-Vorschau:', e); }
    if (my !== G.token) return;
    const draw = () => { if (my !== G.token || !host.isConnected) return; const a = (o.angle ? o.angle() : 28) * Math.PI / 180; pl.root.rotation.y = -a; tick(performance.now()); r.render(scene, cam); };
    host._apply = draw; draw();
  }

  // ---- Karten-Bild (einmal gerendert, dann als <img>) ----
  const icons = new Map();
  function iconOf(id, size) {
    size = size || 256; const key = id + ':' + size; if (icons.has(key)) return icons.get(key);
    const M = MODELS[id], p = clone(id).then(m => {
      const c = document.createElement('canvas'); c.width = c.height = size; const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setClearColor(0x000000, 0); r.outputEncoding = THREE.sRGBEncoding;
      const s = new THREE.Scene(), g = new THREE.Group(); g.add(m); s.add(g);
      if (M.kind === 'wings') m.traverse(o => { if (o.name && /wing/i.test(o.name) && o.position.x !== 0) o.rotation.y = o.rotation.y * 0.35; }); // fuer das Bild etwas weiter geoeffnet/flacher
      const box = new THREE.Box3().setFromObject(g), ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), span = Math.max(sz.x, sz.y) * 0.56 + 0.02;
      const cam = new THREE.OrthographicCamera(-span, span, span, -span, 0.01, 50), back = M.view === 'back';
      cam.position.set(ctr.x + (M.kind === 'hat' ? 0.9 : 0), ctr.y + (M.kind === 'hat' ? 0.45 : 0), ctr.z + (back ? -6 : 6)); cam.lookAt(ctr); if (M.kind === 'hat') cam.position.x = ctr.x + 1.2 * (back ? -1 : 1);
      r.render(s, cam); const url = c.toDataURL('image/png'); r.dispose(); return url;
    }).catch(() => ''); icons.set(key, p); return p;
  }
  window.Glb3d = { MODELS, PLACE, has, usesGlb, mount, iconOf, buildPlayer, dress, load };
})();
