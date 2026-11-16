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
    'wings-g5seraph': { file: 'seraph_gold_wings.glb', kind: 'wings', name: 'Seraph-Gold-Flügel', view: 'back' },
    'wings-g5butterfly': { file: 'nebula_butterfly_wings.glb', kind: 'wings', name: 'Nebel-Schmetterlingsflügel', view: 'back' },
    'wings-g5wyvern': { file: 'crimson_wyvern_wings.glb', kind: 'wings', name: 'Karmesin-Wyvern-Flügel', view: 'back' },
    'wings-g5mecha': { file: 'mecha_thruster_wings.glb', kind: 'wings', name: 'Mecha-Düsenflügel', view: 'back' },
    'wings-g5dragonfly': { file: 'dragonfly_prism_wings.glb', kind: 'wings', name: 'Libellen-Prisma-Flügel', view: 'back' },
    'wings-g5phoenix': { file: 'phoenix_blaze_wings.glb', kind: 'wings', name: 'Phönix-Flammenflügel', view: 'back' },
    'wings-g5volt': { file: 'volt_outline_wings.glb', kind: 'wings', name: 'Volt-Neonflügel', view: 'back' },
    'wings-g5leaf': { file: 'autumn_leaf_wings.glb', kind: 'wings', name: 'Herbstlaub-Flügel', view: 'back' },
    'wings-g5bone': { file: 'bone_reaper_wings.glb', kind: 'wings', name: 'Knochen-Sensenmann-Flügel', view: 'back' },
    'wings-g5pixel': { file: 'pixel_prism_wings.glb', kind: 'wings', name: 'Pixel-Regenbogen-Flügel', view: 'back' },
    'cape-g5galaxy': { file: 'galaxy_orbit_cape.glb', kind: 'cape', name: 'Galaxie-Orbit-Umhang', view: 'back' },
    'cape-g5sakura': { file: 'sakura_night_cape.glb', kind: 'cape', name: 'Sakura-Nacht-Umhang', view: 'back' },
    'cape-g5magma': { file: 'magma_core_cape.glb', kind: 'cape', name: 'Magmakern-Umhang', view: 'back' },
    'cape-g5wave': { file: 'ocean_wave_cape.glb', kind: 'cape', name: 'Ozeanwellen-Umhang', view: 'back' },
    'cape-g5racing': { file: 'racing_stripe_cape.glb', kind: 'cape', name: 'Rennstreifen-Umhang', view: 'back' },
    'cape-g5aurora': { file: 'aurora_peaks_cape.glb', kind: 'cape', name: 'Polarlicht-Gipfel-Umhang', view: 'back' },
    'cape-g5circuit': { file: 'circuit_core_cape.glb', kind: 'cape', name: 'Platinen-Umhang', view: 'back' },
    'cape-g5royal': { file: 'royal_crest_cape.glb', kind: 'cape', name: 'Königswappen-Umhang', view: 'back' },
    'cape-g5synth': { file: 'retro_sunset_cape.glb', kind: 'cape', name: 'Retro-Sonnenuntergang-Umhang', view: 'back' },
    'cape-g5rift': { file: 'void_rift_cape.glb', kind: 'cape', name: 'Leere-Riss-Umhang', view: 'back' },
    'cape-g5aurorafx': { file: 'aurora_flow_cape_animated.glb', kind: 'cape', name: 'Polarlicht-Fluss-Umhang (animiert)', view: 'back' },
    'cape-g5warp': { file: 'hyperdrive_cape_animated.glb', kind: 'cape', name: 'Hyperantrieb-Umhang (animiert)', view: 'back' },
    'cape-g6pulse': { file: 'cloudy_pulse_cape_animated.glb', kind: 'cape', name: 'Cloudy-Puls-Umhang (animiert)', view: 'back' },
    'cape-g6gradient': { file: 'gradient_flow_cape_animated.glb', kind: 'cape', name: 'Farbverlauf-Umhang (animiert)', view: 'back' },
    'cape-g6silk': { file: 'silk_lines_cape_animated.glb', kind: 'cape', name: 'Seidenlinien-Umhang (animiert)', view: 'back' },
    'cape-g6orbit': { file: 'orbit_dots_cape_animated.glb', kind: 'cape', name: 'Orbit-Punkte-Umhang (animiert)', view: 'back' },
    'cape-g6scan': { file: 'neon_scan_cape_animated.glb', kind: 'cape', name: 'Neon-Scan-Umhang (animiert)', view: 'back' },
    'cape-g6rain': { file: 'rain_glass_cape_animated.glb', kind: 'cape', name: 'Regen-auf-Glas-Umhang (animiert)', view: 'back' },
    'cape-g6fire': { file: 'campfire_cape_animated.glb', kind: 'cape', name: 'Lagerfeuer-Umhang (animiert)', view: 'back' },
    'cape-g6ocean': { file: 'moonlit_ocean_cape_animated.glb', kind: 'cape', name: 'Mondmeer-Umhang (animiert)', view: 'back' },
    'cape-g6code': { file: 'matrix_code_cape_animated.glb', kind: 'cape', name: 'Code-Regen-Umhang (animiert)', view: 'back' },
    'wings-pgcrystal': { file: 'gold_crystal_wings.glb', kind: 'wings', name: 'Goldkristall-Flügel', view: 'back' },
    'wings-pgfiligree': { file: 'gold_filigree_wings.glb', kind: 'wings', name: 'Gold-Filigran-Flügel', view: 'back' },
    'wings-pgdragon': { file: 'gilded_dragon_wings.glb', kind: 'wings', name: 'Vergoldete Drachenflügel', view: 'back' },
    'wings-pgobsidian': { file: 'obsidian_gold_wings.glb', kind: 'wings', name: 'Obsidian-Gold-Flügel', view: 'back' },
    'wings-pgcloud': { file: 'cloud_plus_wings.glb', kind: 'wings', name: 'Cloudy+-Wolkenflügel', view: 'back' },
    'cape-pgpulse': { file: 'plus_pulse_cape.glb', kind: 'cape', name: 'Cloudy+-Puls-Umhang (animiert)', view: 'back' },
    'cape-pgliquid': { file: 'liquid_gold_cape.glb', kind: 'cape', name: 'Flüssiggold-Umhang (animiert)', view: 'back' },
    'cape-pgnight': { file: 'golden_night_cape.glb', kind: 'cape', name: 'Goldene-Nacht-Umhang (animiert)', view: 'back' },
    'cape-pgprestige': { file: 'prestige_shine_cape.glb', kind: 'cape', name: 'Prestige-Glanz-Umhang (animiert)', view: 'back' },
    'cape-pgaurora': { file: 'golden_aurora_cape.glb', kind: 'cape', name: 'Goldpolarlicht-Umhang (animiert)', view: 'back' },
    'hat-pgcrown': { file: 'plus_crown_hat.glb', kind: 'hat', name: 'Cloudy+-Krone', view: 'front' },
    'hat-pgtophat': { file: 'gold_tophat_hat.glb', kind: 'hat', name: 'Goldener Zylinder', view: 'front' },
    'hat-pghalo': { file: 'golden_halo_hat.glb', kind: 'hat', name: 'Goldener Heiligenschein', view: 'front' },
    'hat-pglaurel': { file: 'golden_laurel_hat.glb', kind: 'hat', name: 'Goldener Lorbeerkranz', view: 'front' },
    'hat-pgpuff': { file: 'cloud_puff_hat.glb', kind: 'hat', name: 'Wolken-Mütze', view: 'front' },
    'wings-owcrimson': { file: 'owner_crimson_blades_wings.glb', kind: 'wings', name: 'Karmesin-Klingen-Flügel', view: 'back' },
    'wings-owphoenix': { file: 'owner_phoenix_wings.glb', kind: 'wings', name: 'Owner-Phönixflügel (animiert)', view: 'back' },
    'wings-owprism': { file: 'owner_prism_seraph_wings.glb', kind: 'wings', name: 'Prisma-Seraph-Flügel (animiert)', view: 'back' },
    'wings-owstorm': { file: 'owner_storm_wings.glb', kind: 'wings', name: 'Sturmflügel (animiert)', view: 'back' },
    'wings-owvoid': { file: 'owner_void_wings.glb', kind: 'wings', name: 'Leere-Flügel (animiert)', view: 'back' },
    'cape-owthrone': { file: 'owner_throne_cape.glb', kind: 'cape', name: 'Owner-Thron-Umhang (animiert)', view: 'back' },
    'cape-owblackhole': { file: 'owner_blackhole_cape.glb', kind: 'cape', name: 'Schwarzes-Loch-Umhang (animiert)', view: 'back' },
    'cape-owsigil': { file: 'owner_sigil_cape.glb', kind: 'cape', name: 'Siegel-Umhang (animiert)', view: 'back' },
    'cape-owprism': { file: 'owner_prism_cape.glb', kind: 'cape', name: 'Prisma-Umhang (animiert)', view: 'back' },
    'cape-owstorm': { file: 'owner_storm_cape.glb', kind: 'cape', name: 'Gewitter-Umhang (animiert)', view: 'back' },
    'hat-owcrown': { file: 'owner_crown_hat.glb', kind: 'hat', name: 'Owner-Krone (animiert)', view: 'front' },
    'hat-owinferno': { file: 'owner_inferno_halo_hat.glb', kind: 'hat', name: 'Inferno-Heiligenschein (animiert)', view: 'front' },
    'hat-owhorns': { file: 'owner_demon_horns_hat.glb', kind: 'hat', name: 'Dämonenhörner (animiert)', view: 'front' },
    'hat-owarcane': { file: 'owner_arcane_hat.glb', kind: 'hat', name: 'Arkaner Hut (animiert)', view: 'front' },
    'pet-chameleon': { file: 'pet_chameleon.glb', kind: 'pet', name: 'Chamäleon', view: 'front' },
    'pet-devil': { file: 'pet_little_devil.glb', kind: 'pet', name: 'Kleiner Teufel', view: 'front' },
    'pet-cat': { file: 'pet_tabby_cat.glb', kind: 'pet', name: 'Tigerkatze', view: 'front' },
    'pet-dragon': { file: 'pet_shadow_dragon.glb', kind: 'pet', name: 'Schattendrache', view: 'front' },
    'pet-minime': { file: 'pet_mini_me.glb', kind: 'pet', name: 'Mini-Ich', view: 'front' },
    'cape-g7glitch': { file: 'cloudy_glitch_cape.glb', kind: 'cape', name: 'Cloudy-Glitch-Umhang (animiert)', view: 'back' },
    'cape-g7storm': { file: 'storm_chain_cape.glb', kind: 'cape', name: 'Sturmketten-Umhang (animiert)', view: 'back' },
    'cape-g7frost': { file: 'frostbound_chains_cape.glb', kind: 'cape', name: 'Frostgebundene Ketten (animiert)', view: 'back' },
    'cape-g7comic': { file: 'comic_cape.glb', kind: 'cape', name: 'Comic-Umhang', view: 'back' },
    'wings-g7comic': { file: 'comic_wings.glb', kind: 'wings', name: 'Comic-Flügel', view: 'back' },
    'hat-g7comic': { file: 'comic_headband_hat.glb', kind: 'hat', name: 'Comic-Stirnband', view: 'front' },
    'wings-g7azure': { file: 'azure_eclipse_wings.glb', kind: 'wings', name: 'Azure Eclipse Wings', view: 'back' },
    'hat-adhalo': { file: 'admin_halo_hat.glb', kind: 'hat', name: 'Admin-Heiligenschein', view: 'front' },
    'hat-owcrystal': { file: 'owner_crystal_crown_hat.glb', kind: 'hat', name: 'Kristallkrone (animiert)', view: 'front' },
    'cape-g6galaxy': { file: 'spiral_galaxy_cape_animated.glb', kind: 'cape', name: 'Spiralgalaxie-Umhang (animiert)', view: 'back' },
  };
  // Platzierung relativ zum Koerper (Block-Einheiten, Y oben, +Z vorne). Hut am Kopf, Umhang/Fluegel am Koerper (Ursprung = Hals).
  const PLACE = {
    hat: { pos: [0, 0, 0], scale: 1 },
    cape: { pos: [0, 0, -0.155], scale: 1, tilt: 0.05 },
    wings: { pos: [0, -0.22, -0.15], scale: 0.62 },
    pet: { pos: [0.8, 0.05, 0.1], scale: 1 }, shoulder: { pos: [-0.52, 0, 0], scale: 1 }, armL: [5 / 16, -2 / 16, 0], // Pets: wie GLB.java (PET_X/Y/Z, SHOULDER_X, Schultergelenk links)
    halo: [0, 0.66, 0], // Heiligenschein der Seraph-Fluegel: ueber der Kopfmitte (Ursprung = Halsgelenk)
  };
  const NECK = 1.5; // Hoehe des Halsgelenks ueber den Fuessen
  const cache = new Map(); // id -> Promise<gltf scene>

  const has = id => !!MODELS[id];
  const usesGlb = eq => !!eq && (!!eq.emote || ['hat', 'cape', 'wings', 'pet'].some(k => eq[k] && MODELS[eq[k]]));
  const NONGLB = (eq, k) => !!(eq && eq[k] && !MODELS[eq[k]]);

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
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, alphaTest: grow ? 0.5 : 0, transparent: false, side: grow ? THREE.DoubleSide : THREE.FrontSide })); // Grundschicht immer deckend wie in Minecraft (sonst sieht man Umhang/Fluegel durch durchsichtige Skin-Pixel)
    m.position.set(cx / 16, cy / 16, cz / 16); return m;
  }
  function buildPlayer(skin, slim) {
    const root = new THREE.Group(), W = 64, tall = !skin || (skin.naturalHeight || 64) >= 64, H = tall ? 64 : 32;
    const tex = new THREE.Texture(skin || undefined); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.encoding = THREE.sRGBEncoding; tex.needsUpdate = true; if (!skin) tex.image = fallbackSkin(); // sRGB: gleiche Farben wie die normale Vorschau (vorher blass/grau)
    const aw = slim ? 3 : 4, head = new THREE.Group(), body = new THREE.Group();
    head.position.set(0, NECK, 0); body.position.set(0, NECK, 0); root.add(head, body);
    head.add(skinBox(tex, W, H, 0, 0, 8, 8, 8, 0, 4, 0, 0)); head.add(skinBox(tex, W, H, 32, 0, 8, 8, 8, 0, 4, 0, 1.2));
    const y = NECK * 16; // Pixel ueber dem Boden
    body.add(skinBox(tex, W, H, 16, 16, 8, 12, 4, 0, -6, 0, 0));
    // Arme/Beine in Gelenk-Gruppen (Schulter/Huefte wie in Minecraft), damit Emotes sie drehen koennen
    const grp = (x, yy) => { const g = new THREE.Group(); g.position.set(x / 16, yy / 16, 0); root.add(g); return g; };
    const armR = grp(-5, y - 2), armL = grp(5, y - 2), legR = grp(-2, 12), legL = grp(2, 12), ax = 4 + aw / 2 - 5;
    armR.add(skinBox(tex, W, H, 40, 16, aw, 12, 4, -ax, -4, 0, 0)); armL.add(skinBox(tex, W, H, tall ? 32 : 40, tall ? 48 : 16, aw, 12, 4, ax, -4, 0, 0));
    legR.add(skinBox(tex, W, H, 0, 16, 4, 12, 4, 0, -6, 0, 0)); legL.add(skinBox(tex, W, H, tall ? 16 : 0, tall ? 48 : 16, 4, 12, 4, 0, -6, 0, 0));
    if (tall) { body.add(skinBox(tex, W, H, 16, 32, 8, 12, 4, 0, -6, 0, 0.8)); armR.add(skinBox(tex, W, H, 40, 32, aw, 12, 4, -ax, -4, 0, 0.8)); armL.add(skinBox(tex, W, H, 48, 48, aw, 12, 4, ax, -4, 0, 0.8)); legR.add(skinBox(tex, W, H, 0, 32, 4, 12, 4, 0, -6, 0, 0.8)); legL.add(skinBox(tex, W, H, 0, 48, 4, 12, 4, 0, -6, 0, 0.8)); }
    return { root, head, body, tex, armR, armL, legR, legL };
  }
  function fallbackSkin() { // einfache Steve-aehnliche Figur, falls noch kein Skin geladen ist
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    const f = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    f(0, 0, 64, 64, 'rgba(0,0,0,0)'); f(0, 0, 32, 16, '#b98a62'); f(8, 8, 8, 8, '#c99a72'); f(9, 10, 2, 2, '#fff'); f(13, 10, 2, 2, '#fff'); f(10, 10, 1, 1, '#3b4a9a'); f(14, 10, 1, 1, '#3b4a9a'); f(8, 8, 8, 2, '#4a2f1a');
    f(16, 16, 24, 16, '#2fb4c4'); f(40, 16, 16, 16, '#c99a72'); f(0, 16, 16, 16, '#3a3f9a'); f(32, 48, 16, 16, '#c99a72'); f(16, 48, 16, 16, '#3a3f9a'); return c;
  }

  // ---- Platzierung + Animation ----
  // ---- Emotes (gleiche Datei wie die Mod: assets/emotes.json) ----
  let EMO = null; const emotes = () => EMO || (EMO = fetch('assets/emotes.json').then(r => r.json()).then(j => { const m = {}; for (const e of j.emotes || []) m[e.id] = e; return m; }).catch(() => { EMO = null; return {}; }));
  const D = Math.PI / 180;
  function sample(k, t) { if (!k || !k.length) return [0, 0, 0, 0]; if (t <= k[0][0]) return k[0]; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const a = k[i - 1][0], b = k[i][0]; let f = b > a ? (t - a) / (b - a) : 1; f = f * f * (3 - 2 * f); return k[i].map((v, j) => j ? k[i - 1][j] + (v - k[i - 1][j]) * f : t); } return k[k.length - 1]; }
  // Minecraft-Winkel -> three.js (Y oben, vorne +Z): pitch bleibt, yaw/roll drehen das Vorzeichen; Reihenfolge wie ModelPart (ZYX)
  function emotePose(parts, e, t) {
    const set = (g, v, side) => { if (!g) return; g.rotation.set(v[1] * D, side * v[2] * D, -side * v[3] * D, 'ZYX'); };
    for (const k of ['armR', 'armL', 'legR', 'legL']) { const g = parts[k]; if (g) g.rotation.set(0, 0, 0); }
    if (parts.head) parts.head.rotation.set(0, 0, 0);
    if (!e || t < 0 || t > 1) return;
    const P = e.parts || {};
    if (P.head) { const v = sample(P.head, t); parts.head.rotation.set(v[1] * D, -v[2] * D, -v[3] * D, 'ZYX'); }
    set(parts.armR, sample(P.armR, t), 1); set(parts.armL, sample(P.armL, t), -1); set(parts.legR, sample(P.legR, t), 1); set(parts.legL, sample(P.legL, t), -1);
  }
  function dress(parts, eq, t) { // haengt die Modelle an Kopf/Koerper; gibt Animations-Funktion zurueck
    const anim = [];
    if (eq.emote) anim.push(((id, t0) => { let e = null; emotes().then(m => { e = m[id] || null; }); return now => { if (!e) return; const cyc = e.dur + 900, tt = eq.emoteT != null ? eq.emoteT : ((now - t0) % cyc) / e.dur; emotePose(parts, e, tt); }; })(eq.emote, performance.now()));
    return Promise.all(['hat', 'cape', 'wings', 'pet'].filter(k => eq[k] && MODELS[eq[k]]).map(async k => {
      const m = await clone(eq[k]), P = PLACE[k], g = new THREE.Group(); g.add(m); g.position.set(P.pos[0], P.pos[1], P.pos[2]); g.scale.setScalar(P.scale);
      (k === 'hat' ? parts.head : parts.body).add(g);
      { const dy = eq.dye && eq.dye[eq[k]]; if (dy && (dy.c || dy.g)) { const GL = /glow|emis|light|aura|flame|fire|gem|crystal|eye/i; // Färben (Phase 3): Hauptfarbe auf alles, Leuchtfarbe auf leuchtende Teile – gleiche Regel wie GLB.java
        m.traverse(x => { if (!x.isMesh || !x.material) return; let n = ''; for (let q = x; q && q !== m; q = q.parent) n += ' ' + (q.name || ''); if (/skin/i.test(n)) return; const glow = GL.test(n), col = glow ? dy.g : dy.c; if (!col) return; x.material = x.material.clone(); x.material.color = new THREE.Color(col); if (glow && x.material.emissive) { x.material.emissive = new THREE.Color(col); x.material.emissiveIntensity = 0.45; } }); } }
      if (k === 'pet') { // Pets: Befestigung aus extras.cloudyPet, Bewegung je Teil (cloudyMove), Mini-Ich mit dem Skin des Spielers (cloudySkin)
        let mt = 'float', off = [0, 0, 0]; m.traverse(o => { const c = o.userData && o.userData.cloudyPet; if (c) { if (c.mount) mt = c.mount; if (c.offset) off = c.offset; } });
        if (mt === 'shoulder') g.position.set(PLACE.shoulder.pos[0], PLACE.shoulder.pos[1], PLACE.shoulder.pos[2]);
        else if (mt === 'arm_left') { if (parts.armL) { parts.armL.add(g); g.position.set(off[0], off[1], off[2]); } else g.position.set(PLACE.armL[0] + off[0], PLACE.armL[1] + off[1], PLACE.armL[2] + off[2]); } // am Arm-Gelenk: geht bei Emotes mit
        if (parts.tex) { const st = parts.tex.clone(); st.flipY = false; st.needsUpdate = true; m.traverse(o => { if (o.userData && o.userData.cloudySkin) o.traverse(x => { if (x.isMesh) { x.material = x.material.clone(); x.material.map = st; x.material.alphaTest = 0.5; } }); }); } // glTF-UVs: Bild nicht spiegeln
        const L = []; m.traverse(o => { if (o.userData && o.userData.cloudyMove) { o.matrixAutoUpdate = false; L.push(o); } });
        if (L.length) anim.push(now => { for (const o of L) { const W = o.userData.cloudyMove, Pv = W.pivot || [0, 0, 0], per = W.periodMs || 2000, t = (now % per) / per * Math.PI * 2;
          const w = v => v ? v[0] + v[1] * Math.sin(t + (v[2] || 0)) : 0, bob = W.bob ? W.bob[0] * Math.sin((now % W.bob[1]) / W.bob[1] * Math.PI * 2 + (W.bob[2] || 0)) : 0, sc = W.s ? Math.max(0, w(W.s)) : 1;
          const M = new THREE.Matrix4().makeTranslation(Pv[0], Pv[1] + bob, Pv[2]);
          M.multiply(new THREE.Matrix4().makeRotationY(w(W.ry))).multiply(new THREE.Matrix4().makeRotationX(w(W.rx))).multiply(new THREE.Matrix4().makeRotationZ(w(W.rz)));
          M.multiply(new THREE.Matrix4().makeScale(sc || 1e-4, sc || 1e-4, sc || 1e-4)).multiply(new THREE.Matrix4().makeTranslation(-Pv[0], -Pv[1], -Pv[2]));
          o.matrix.copy(M); o.matrixWorldNeedsUpdate = true; } });
      }
      if (k === 'wings') m.traverse(o => { if (o.name && /halo/i.test(o.name)) { const h = new THREE.Group(); o.parent.remove(o); h.add(o); o.position.set(0, 0, 0); h.position.set(PLACE.halo[0], PLACE.halo[1], PLACE.halo[2]); parts.head.add(h); } }); // Heiligenschein haengt am Kopf, nicht an den Fluegeln
      if (k === 'cape') anim.push(now => { g.rotation.x = P.tilt + 0.03 * Math.sin(now / 900); g.position.z = P.pos[2]; });
      m.traverse(o => { const A = o.userData && o.userData.cloudyAnim; if (!A) return; // animierte Umhaenge/Fluegel/Huete: Bilder im 4x4-Raster durchschalten
        o.traverse(x => { if (!x.isMesh || !x.material || !x.material.map) return; const map = x.material.map;
          anim.push(now => { const f = Math.floor(now / A.frameMs) % A.frames; map.offset.set((f % A.cols) / A.cols, Math.floor(f / A.cols) / A.rows); }); }); });
      if (k === 'wings') { const w = []; m.traverse(o => { if (o.name && /wing/i.test(o.name) && o.parent && o.position.x !== 0 && !/halo/i.test(o.name)) { o.userData.base = o.rotation.y; o.userData.side = Math.sign(o.position.x); w.push(o); } });
        anim.push(now => { for (let i = 0; i < w.length; i++) { const o = w[i], f = Math.sin(now / 520); o.rotation.y = o.userData.base + o.userData.side * (0.12 + 0.17 * f); } }); }
      if (k === 'wings') { const cw = []; m.traverse(o => { if (!o.userData || !o.userData.cloudyWing) return; o.userData.p0 = o.position.clone(); o.userData.q0 = o.quaternion.clone(); o.userData.cs = Math.sign(o.position.x) || 1; o.matrixAutoUpdate = false; cw.push(o); }); // Flügelschlag aus dem Modell (wie GLB.java)
        if (cw.length) anim.push(now => { const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z), RZ = a => new THREE.Matrix4().makeRotationZ(a);
          for (const o of cw) { const W = o.userData.cloudyWing, s = o.userData.cs, t = (now % W.periodMs) / W.periodMs * Math.PI * 2, roll = W.roll[0] + W.roll[1] * Math.sin(t), P = W.pivot;
            const M = T(o.userData.p0.x, o.userData.p0.y, o.userData.p0.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(o.userData.q0)).multiply(new THREE.Matrix4().makeRotationY(s * (W.yaw || 0) * Math.sin(t + 0.6)));
            M.multiply(T(P[0], P[1], P[2])).multiply(RZ(s * roll)).multiply(T(-P[0], -P[1], -P[2]));
            if (W.chain) { const C = W.chain, late = W.roll[0] + W.roll[1] * Math.sin(t - C.lag), sw = -s * C.follow * late + C.sway * Math.sin(t - C.lag - 0.8); M.multiply(T(C.pivot[0], C.pivot[1], C.pivot[2])).multiply(RZ(sw)).multiply(T(-C.pivot[0], -C.pivot[1], -C.pivot[2])); }
            o.matrix.copy(M); o.matrixWorldNeedsUpdate = true; } }); }
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
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50); cam.position.set(0, 1.12, 5.3); cam.lookAt(0, 1.06, 0); // Figur so gross wie in der normalen Vorschau (vorher viel zu weit weg)
    let tick = () => {}; try { tick = await dress(pl, o.equip || {}); } catch (e) { console.warn('GLB-Vorschau:', e); }
    let tick2 = () => {}; if (o.extra) try { tick2 = (await o.extra(pl, o.equip || {})) || tick2; } catch (e) { console.warn('Vorschau (Nicht-3D-Items):', e); } // Items ohne .glb (z. B. Heiligenschein) zusaetzlich zeichnen
    if (my !== G.token) return;
    let lw = w, lh = h;
    const draw = () => { if (my !== G.token || !host.isConnected) return;
      const cw = host.clientWidth, ch = host.clientHeight; if (cw && ch && (cw !== lw || ch !== lh)) { lw = cw; lh = ch; r.setSize(cw, ch, false); cam.aspect = cw / ch; cam.updateProjectionMatrix(); } // Feld war beim Aufbau noch unsichtbar/anders gross -> sonst verzerrt (duenne Figur)
      const a = (o.angle ? o.angle() : 28) * Math.PI / 180; pl.root.rotation.y = a; const now = performance.now(); tick(now); tick2(now); r.render(scene, cam); }; // gleiche Drehrichtung wie die CSS-Vorschau (schaut zum Mauszeiger)
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
