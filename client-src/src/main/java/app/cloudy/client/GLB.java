package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import org.joml.Quaternionf;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * 3D-Cosmetics aus .glb-Dateien (glTF 2.0, ein Netz je Teil, eine PNG-Textur eingebettet): Hut, Umhang, Fluegel.
 * Die Platzierung ist dieselbe wie im Launcher (assets/js/glb3d.js, PLACE) - dort ist sie im Browser geprueft.
 * glTF: Y oben, +Z = Vorderseite, 1 Einheit = 1 Block. Minecraft-Modellraum: Y nach unten, vorne = -Z: Drehung um 180 Grad um die X-Achse.
 */
public final class GLB {
	private GLB() {}

	/** id -> Datei in /cloudy-cos/glb/ */
	private static final Map<String, String> FILES = new HashMap<>();
	static {
		FILES.put("hat-g3wizard", "astral_wizard_hat.glb");
		FILES.put("hat-g3crown", "crown_of_embers.glb");
		FILES.put("cape-g3nebula", "nebula_drift_cape.glb");
		FILES.put("cape-g3phoenix", "inferno_phoenix_cape.glb");
		FILES.put("wings-g3seraph", "seraph_wings.glb");
		FILES.put("wings-g3prism", "prism_shard_wings.glb");
		FILES.put("wings-g3void", "void_dragon_wings.glb");
		FILES.put("wings-g7azure", "azure_eclipse_wings.glb");
		FILES.put("wings-g4abyss", "abyss_bat_wings.glb");
		FILES.put("wings-g4frost", "frostfeather_wings.glb");
		FILES.put("wings-g4amethyst", "amethyst_flame_wings.glb");
		FILES.put("wings-g4mono", "monochrome_shard_wings.glb");
		FILES.put("wings-g4venom", "venom_neon_wings.glb");
		FILES.put("cape-g4viper", "zigzag_viper_cape.glb");
		FILES.put("cape-g4vortex", "amethyst_vortex_cape.glb");
		FILES.put("cape-g4glitch", "mono_glitch_cape.glb");
		FILES.put("cape-g4crest", "cloudy_crest_cape.glb");
		FILES.put("cape-g4drip", "toxic_drip_cape.glb");
		FILES.put("wings-g5seraph", "seraph_gold_wings.glb");
		FILES.put("wings-g5butterfly", "nebula_butterfly_wings.glb");
		FILES.put("wings-g5wyvern", "crimson_wyvern_wings.glb");
		FILES.put("wings-g5mecha", "mecha_thruster_wings.glb");
		FILES.put("wings-g5dragonfly", "dragonfly_prism_wings.glb");
		FILES.put("wings-g5phoenix", "phoenix_blaze_wings.glb");
		FILES.put("wings-g5volt", "volt_outline_wings.glb");
		FILES.put("wings-g5leaf", "autumn_leaf_wings.glb");
		FILES.put("wings-g5bone", "bone_reaper_wings.glb");
		FILES.put("wings-g5pixel", "pixel_prism_wings.glb");
		FILES.put("cape-g5galaxy", "galaxy_orbit_cape.glb");
		FILES.put("cape-g5sakura", "sakura_night_cape.glb");
		FILES.put("cape-g5magma", "magma_core_cape.glb");
		FILES.put("cape-g5wave", "ocean_wave_cape.glb");
		FILES.put("cape-g5racing", "racing_stripe_cape.glb");
		FILES.put("cape-g5aurora", "aurora_peaks_cape.glb");
		FILES.put("cape-g5circuit", "circuit_core_cape.glb");
		FILES.put("cape-g5royal", "royal_crest_cape.glb");
		FILES.put("cape-g5synth", "retro_sunset_cape.glb");
		FILES.put("cape-g5rift", "void_rift_cape.glb");
		FILES.put("cape-g5aurorafx", "aurora_flow_cape_animated.glb");
		FILES.put("cape-g5warp", "hyperdrive_cape_animated.glb");
		FILES.put("cape-g6pulse", "cloudy_pulse_cape_animated.glb");
		FILES.put("cape-g6gradient", "gradient_flow_cape_animated.glb");
		FILES.put("cape-g6silk", "silk_lines_cape_animated.glb");
		FILES.put("cape-g6orbit", "orbit_dots_cape_animated.glb");
		FILES.put("cape-g6scan", "neon_scan_cape_animated.glb");
		FILES.put("cape-g6rain", "rain_glass_cape_animated.glb");
		FILES.put("cape-g6fire", "campfire_cape_animated.glb");
		FILES.put("cape-g6ocean", "moonlit_ocean_cape_animated.glb");
		FILES.put("cape-g6code", "matrix_code_cape_animated.glb");
		FILES.put("cape-g6galaxy", "spiral_galaxy_cape_animated.glb");
		FILES.put("wings-pgcrystal", "gold_crystal_wings.glb");
		FILES.put("wings-pgfiligree", "gold_filigree_wings.glb");
		FILES.put("wings-pgdragon", "gilded_dragon_wings.glb");
		FILES.put("wings-pgobsidian", "obsidian_gold_wings.glb");
		FILES.put("wings-pgcloud", "cloud_plus_wings.glb");
		FILES.put("cape-pgpulse", "plus_pulse_cape.glb");
		FILES.put("cape-pgliquid", "liquid_gold_cape.glb");
		FILES.put("cape-pgnight", "golden_night_cape.glb");
		FILES.put("cape-pgprestige", "prestige_shine_cape.glb");
		FILES.put("cape-pgaurora", "golden_aurora_cape.glb");
		FILES.put("hat-pgcrown", "plus_crown_hat.glb");
		FILES.put("hat-pgtophat", "gold_tophat_hat.glb");
		FILES.put("hat-pghalo", "golden_halo_hat.glb");
		FILES.put("hat-pglaurel", "golden_laurel_hat.glb");
		FILES.put("hat-pgpuff", "cloud_puff_hat.glb");
		FILES.put("wings-owcrimson", "owner_crimson_blades_wings.glb");
		FILES.put("wings-owphoenix", "owner_phoenix_wings.glb");
		FILES.put("wings-owprism", "owner_prism_seraph_wings.glb");
		FILES.put("wings-owstorm", "owner_storm_wings.glb");
		FILES.put("wings-owvoid", "owner_void_wings.glb");
		FILES.put("cape-owthrone", "owner_throne_cape.glb");
		FILES.put("cape-owblackhole", "owner_blackhole_cape.glb");
		FILES.put("cape-owsigil", "owner_sigil_cape.glb");
		FILES.put("cape-owprism", "owner_prism_cape.glb");
		FILES.put("cape-owstorm", "owner_storm_cape.glb");
		FILES.put("hat-owcrown", "owner_crown_hat.glb");
		FILES.put("hat-owinferno", "owner_inferno_halo_hat.glb");
		FILES.put("hat-owhorns", "owner_demon_horns_hat.glb");
		FILES.put("hat-owarcane", "owner_arcane_hat.glb");
		FILES.put("hat-owcrystal", "owner_crystal_crown_hat.glb");
		FILES.put("hat-adhalo", "admin_halo_hat.glb");
		FILES.put("pet-chameleon", "pet_chameleon.glb");
		FILES.put("pet-devil", "pet_little_devil.glb");
		FILES.put("pet-cat", "pet_tabby_cat.glb");
		FILES.put("pet-dragon", "pet_shadow_dragon.glb");
		FILES.put("pet-minime", "pet_mini_me.glb");
		FILES.put("cape-g7glitch", "cloudy_glitch_cape.glb");
		FILES.put("cape-g7storm", "storm_chain_cape.glb");
		FILES.put("cape-g7frost", "frostbound_chains_cape.glb");
		FILES.put("cape-g7comic", "comic_cape.glb");
		FILES.put("wings-g7comic", "comic_wings.glb");
		FILES.put("hat-g7comic", "comic_headband_hat.glb");
	}

	// Platzierung (glTF-Raum, Ursprung = Halsgelenk). Gleiche Zahlen wie PLACE in assets/js/glb3d.js.
	public static final float CAPE_Z = 0.155f, CAPE_TILT = 0.05f;
	public static final float WING_Y = -0.22f, WING_Z = -0.15f, WING_SC = 0.62f;
	public static final float HALO_Y = 0.66f;

	private static final class Part { String name; float[] v; int[] idx; float tx, ty, tz, yaw; int side, img; boolean halo; int aFrames, aCols = 1, aRows = 1, aMs = 100;
		// Fluegelschlag aus dem Modell (extras.cloudyWing): Rollen um die Fluegelwurzel, Ketten pendeln nach
		boolean mot, chain; float[] piv, cpiv; float roll0, rollA, yawA, follow, lag, sway; int per = 3000;
		// Pets: eigene Bewegung je Teil (extras.cloudyMove) und Spieler-Skin (extras.cloudySkin, Mini-Ich)
		boolean cm, skin; float[] mPiv, mRx, mRy, mRz, mS, mBob; float mPer = 2000f; }
	private static float[] arr3(JsonObject o, String k) { if (!o.has(k)) return null; JsonArray a = o.getAsJsonArray(k); return new float[] {a.get(0).getAsFloat(), a.size() > 1 ? a.get(1).getAsFloat() : 0f, a.size() > 2 ? a.get(2).getAsFloat() : 0f}; }
	private static float[] vec3(JsonArray a) { return new float[] {a.get(0).getAsFloat(), a.get(1).getAsFloat(), a.get(2).getAsFloat()}; }
	private static final class Model { String mount = "float"; float[] off; Part[] parts; Identifier[] tex; Identifier tex(Part p) { return tex[Math.max(0, Math.min(tex.length - 1, p.img))]; } }

	private static final Map<String, Model> MODELS = new HashMap<>();
	private static final Set<String> FAILED = new HashSet<>();

	public static boolean handles(String id) { return id != null && FILES.containsKey(id); }

	// ---------------------------------------------------------------- Laden
	private static Model model(String id) { return model(id, "/cloudy-cos/glb/" + FILES.get(id)); }

	/** Laedt ein Modell aus einer Ressource (Schluessel: nur a-z, 0-9, _ - fuer den Texturnamen). */
	private static Model model(String id, String res) {
		Model have = MODELS.get(id);
		if (have != null || FAILED.contains(id)) return have;
		try (InputStream raw = GLB.class.getResourceAsStream(res)) {
			if (raw == null) throw new java.io.IOException(res + " fehlt");
			Model m = parse(id, raw.readAllBytes());
			MODELS.put(id, m);
			return m;
		} catch (Exception e) {
			CloudyClient.LOG.warn("3D-Modell " + id + " konnte nicht geladen werden", e);
			FAILED.add(id);
			return null;
		}
	}

	private static Model parse(String id, byte[] d) throws Exception {
		ByteBuffer bb = ByteBuffer.wrap(d).order(ByteOrder.LITTLE_ENDIAN);
		if (bb.getInt(0) != 0x46546C67) throw new java.io.IOException("keine GLB-Datei");
		int jl = bb.getInt(12);
		JsonObject j = JsonParser.parseString(new String(d, 20, jl, StandardCharsets.UTF_8)).getAsJsonObject();
		int bin = 20 + jl + 8; // Anfang der BIN-Daten
		JsonArray nodes = j.getAsJsonArray("nodes"), meshes = j.getAsJsonArray("meshes");
		java.util.ArrayList<Part> parts = new java.util.ArrayList<>();
		String mount = "float"; float[] petOff = null; // Pets: Befestigung aus extras.cloudyPet (Wurzelknoten)
		for (int ni = 0; ni < nodes.size(); ni++) { JsonObject n = nodes.get(ni).getAsJsonObject();
			try { if (n.has("extras") && n.getAsJsonObject("extras").has("cloudyPet")) { JsonObject cp = n.getAsJsonObject("extras").getAsJsonObject("cloudyPet"); if (cp.has("mount")) mount = cp.get("mount").getAsString(); if (cp.has("offset")) petOff = vec3(cp.getAsJsonArray("offset")); } } catch (Exception ignored) {} }
		for (int ni = 0; ni < nodes.size(); ni++) {
			JsonObject n = nodes.get(ni).getAsJsonObject();
			if (!n.has("mesh")) continue;
			float tx = 0, ty = 0, tz = 0, yaw = 0;
			if (n.has("translation")) { JsonArray t = n.getAsJsonArray("translation"); tx = t.get(0).getAsFloat(); ty = t.get(1).getAsFloat(); tz = t.get(2).getAsFloat(); }
			if (n.has("rotation")) { JsonArray q = n.getAsJsonArray("rotation"); yaw = 2f * (float) Math.atan2(q.get(1).getAsDouble(), q.get(3).getAsDouble()); } // die Modelle drehen nur um Y
			String name = n.has("name") ? n.get("name").getAsString() : "";
			JsonObject anim = n.has("extras") && n.getAsJsonObject("extras").has("cloudyAnim") ? n.getAsJsonObject("extras").getAsJsonObject("cloudyAnim") : null; // animierter Umhang: Bilder im Raster
			JsonObject cw = n.has("extras") && n.getAsJsonObject("extras").has("cloudyWing") ? n.getAsJsonObject("extras").getAsJsonObject("cloudyWing") : null;
			JsonObject cmv = n.has("extras") && n.getAsJsonObject("extras").has("cloudyMove") ? n.getAsJsonObject("extras").getAsJsonObject("cloudyMove") : null;
			boolean useSkin = false; try { useSkin = n.has("extras") && n.getAsJsonObject("extras").has("cloudySkin") && n.getAsJsonObject("extras").get("cloudySkin").getAsBoolean(); } catch (Exception ignored) {}
			for (var pe : meshes.get(n.get("mesh").getAsInt()).getAsJsonObject().getAsJsonArray("primitives")) {
				JsonObject prim = pe.getAsJsonObject(), at = prim.getAsJsonObject("attributes");
				float[] pos = floats(j, d, bin, at.get("POSITION").getAsInt(), 3), nor = floats(j, d, bin, at.get("NORMAL").getAsInt(), 3), uv = floats(j, d, bin, at.get("TEXCOORD_0").getAsInt(), 2);
				Part p = new Part();
				p.skin = useSkin;
				if (cmv != null) try {
					p.mPiv = cmv.has("pivot") ? vec3(cmv.getAsJsonArray("pivot")) : new float[3]; p.mPer = cmv.has("periodMs") ? Math.max(100f, cmv.get("periodMs").getAsFloat()) : 2000f;
					p.mRx = arr3(cmv, "rx"); p.mRy = arr3(cmv, "ry"); p.mRz = arr3(cmv, "rz"); p.mS = arr3(cmv, "s"); p.mBob = arr3(cmv, "bob"); p.cm = true;
				} catch (Exception ignored) { p.cm = false; }
				if (cw != null) try {
					p.piv = vec3(cw.getAsJsonArray("pivot")); JsonArray r = cw.getAsJsonArray("roll");
					p.roll0 = r.get(0).getAsFloat(); p.rollA = r.get(1).getAsFloat(); p.yawA = cw.has("yaw") ? cw.get("yaw").getAsFloat() : 0f;
					p.per = Math.max(200, cw.has("periodMs") ? cw.get("periodMs").getAsInt() : 3000);
					if (cw.has("chain")) { JsonObject c = cw.getAsJsonObject("chain"); p.cpiv = vec3(c.getAsJsonArray("pivot")); p.follow = c.get("follow").getAsFloat(); p.lag = c.get("lag").getAsFloat(); p.sway = c.get("sway").getAsFloat(); p.chain = true; }
					p.mot = true;
				} catch (Exception ignored) { p.mot = false; p.chain = false; }
				if (anim != null) try { p.aFrames = anim.get("frames").getAsInt(); p.aCols = Math.max(1, anim.get("cols").getAsInt()); p.aRows = Math.max(1, anim.get("rows").getAsInt()); p.aMs = Math.max(20, anim.get("frameMs").getAsInt()); } catch (Exception ignored) {}
				p.img = 0; // Material -> Textur -> Bild (Modelle mit mehreren Texturen, z. B. Vorder- und Kantenseite)
				try { if (prim.has("material")) { JsonObject mat = j.getAsJsonArray("materials").get(prim.get("material").getAsInt()).getAsJsonObject(); JsonObject pbr = mat.getAsJsonObject("pbrMetallicRoughness"); if (pbr != null && pbr.has("baseColorTexture")) { int ti = pbr.getAsJsonObject("baseColorTexture").get("index").getAsInt(); p.img = j.getAsJsonArray("textures").get(ti).getAsJsonObject().get("source").getAsInt(); } } } catch (Exception ignored) {}
				p.name = name; p.tx = tx; p.ty = ty; p.tz = tz; p.yaw = yaw; p.side = tx > 0 ? 1 : tx < 0 ? -1 : 0; p.halo = name.toLowerCase().contains("halo");
				int nv = pos.length / 3;
				p.v = new float[nv * 8];
				for (int i = 0; i < nv; i++) {
					p.v[i * 8] = pos[i * 3]; p.v[i * 8 + 1] = pos[i * 3 + 1]; p.v[i * 8 + 2] = pos[i * 3 + 2];
					p.v[i * 8 + 3] = uv[i * 2]; p.v[i * 8 + 4] = uv[i * 2 + 1];
					p.v[i * 8 + 5] = nor[i * 3]; p.v[i * 8 + 6] = nor[i * 3 + 1]; p.v[i * 8 + 7] = nor[i * 3 + 2];
				}
				p.idx = ints(j, d, bin, prim.get("indices").getAsInt());
				parts.add(p);
			}
		}
		// eingebettete PNG-Texturen (eine oder mehrere)
		JsonArray imgs = j.getAsJsonArray("images");
		Identifier[] texs = new Identifier[Math.max(1, imgs.size())];
		for (int ii = 0; ii < imgs.size(); ii++) {
			JsonObject img = imgs.get(ii).getAsJsonObject(), bv = j.getAsJsonArray("bufferViews").get(img.get("bufferView").getAsInt()).getAsJsonObject();
			int off = bin + (bv.has("byteOffset") ? bv.get("byteOffset").getAsInt() : 0), len = bv.get("byteLength").getAsInt();
			NativeImage ni = NativeImage.read(new ByteArrayInputStream(d, off, len));
			Identifier tid = Identifier.of("cloudy-client", "g3/" + id + (ii == 0 ? "" : "_" + ii));
			MinecraftClient.getInstance().getTextureManager().registerTexture(tid, new NativeImageBackedTexture(ni));
			texs[ii] = tid;
		}
		Model m = new Model();
		m.parts = parts.toArray(new Part[0]);
		m.tex = texs; m.mount = mount; m.off = petOff;
		return m;
	}

	private static int[] view(JsonObject j, int acc) { // {byteOffset, count, componentType, comps, stride}
		JsonObject a = j.getAsJsonArray("accessors").get(acc).getAsJsonObject(), bv = j.getAsJsonArray("bufferViews").get(a.get("bufferView").getAsInt()).getAsJsonObject();
		int comps = switch (a.get("type").getAsString()) { case "SCALAR" -> 1; case "VEC2" -> 2; case "VEC3" -> 3; case "VEC4" -> 4; default -> 1; };
		int ct = a.get("componentType").getAsInt(), size = ct == 5126 || ct == 5125 ? 4 : ct == 5123 || ct == 5122 ? 2 : 1;
		int off = (bv.has("byteOffset") ? bv.get("byteOffset").getAsInt() : 0) + (a.has("byteOffset") ? a.get("byteOffset").getAsInt() : 0);
		int stride = bv.has("byteStride") && bv.get("byteStride").getAsInt() > 0 ? bv.get("byteStride").getAsInt() : size * comps;
		return new int[] {off, a.get("count").getAsInt(), ct, comps, stride};
	}

	private static float[] floats(JsonObject j, byte[] d, int bin, int acc, int want) {
		int[] v = view(j, acc);
		if (v[2] != 5126 || v[3] != want) throw new IllegalStateException("Attribut nicht float/" + want);
		ByteBuffer bb = ByteBuffer.wrap(d).order(ByteOrder.LITTLE_ENDIAN);
		float[] out = new float[v[1] * want];
		for (int i = 0; i < v[1]; i++) for (int c = 0; c < want; c++) out[i * want + c] = bb.getFloat(bin + v[0] + i * v[4] + c * 4);
		return out;
	}

	private static int[] ints(JsonObject j, byte[] d, int bin, int acc) {
		int[] v = view(j, acc);
		ByteBuffer bb = ByteBuffer.wrap(d).order(ByteOrder.LITTLE_ENDIAN);
		int[] out = new int[v[1]];
		for (int i = 0; i < v[1]; i++) {
			int o = bin + v[0] + i * v[4];
			out[i] = v[2] == 5125 ? bb.getInt(o) : v[2] == 5123 ? bb.getShort(o) & 0xFFFF : bb.get(o) & 0xFF;
		}
		return out;
	}

	// ---------------------------------------------------------------- Zeichnen
	// Faerben (Phase 3): Hauptfarbe fuer alle Teile, Leuchtfarbe fuer leuchtende Teile (Name enthaelt glow/emis/light/aura/flame/fire/gem/crystal/eye) – gleiche Regel wie glb3d.js
	private static int tMain = -1, tGlow = -1; private static boolean tFull;
	public static void tint(int main, int glow, boolean full) { tMain = main; tGlow = glow; tFull = full; }
	public static void untint() { tMain = -1; tGlow = -1; tFull = false; }
	private static boolean glowPart(Part p) { String n = p.name == null ? "" : p.name.toLowerCase(java.util.Locale.ROOT); return n.contains("glow") || n.contains("emis") || n.contains("light") || n.contains("aura") || n.contains("flame") || n.contains("fire") || n.contains("gem") || n.contains("crystal") || n.contains("eye"); }
	private static void drawPart(MatrixStack ms, VertexConsumer vc, int light, int ov, Part p, float tx, float ty, float tz, float yaw) {
		int c = -1; boolean full = tFull;
		if ((tMain != -1 || tGlow != -1) && !p.skin) { boolean g = glowPart(p); c = g ? tGlow : tMain; if (g && tGlow != -1) full = true; }
		drawPart(ms, vc, full ? 0xF000F0 : light, ov, p, tx, ty, tz, yaw, c == -1 ? 255 : (c >> 16) & 255, c == -1 ? 255 : (c >> 8) & 255, c == -1 ? 255 : c & 255, 255);
	}

	private static void drawPart(MatrixStack ms, VertexConsumer vc, int light, int ov, Part p, float tx, float ty, float tz, float yaw, int cr, int cg, int cb, int ca) {
		float du = 0f, dv = 0f;
		if (p.aFrames > 1) { int fr = (int) ((System.currentTimeMillis() / p.aMs) % p.aFrames); du = (fr % p.aCols) / (float) p.aCols; dv = (fr / p.aCols) / (float) p.aRows; } // animierter Umhang: Bild im Raster waehlen
		ms.push();
		ms.translate(tx, ty, tz);
		if (yaw != 0f) ms.multiply(new Quaternionf().rotationY(yaw));
		MatrixStack.Entry e = ms.peek();
		float[] v = p.v;
		int[] ix = p.idx;
		for (int f = 0; f + 3 <= ix.length; f += 3) {
			for (int k = 0; k < 4; k++) { // Dreieck als Quad mit doppeltem letztem Punkt (wie ZZ4)
				int o = ix[f + Math.min(k, 2)] * 8;
				vc.vertex(e, v[o], v[o + 1], v[o + 2]).color(cr, cg, cb, ca).texture(v[o + 3] + du, v[o + 4] + dv).overlay(ov).light(light).normal(e, v[o + 5], v[o + 6], v[o + 7]);
			}
		}
		ms.pop();
	}

	private static void begin(MatrixStack ms) { ms.push(); ms.multiply(new Quaternionf().rotationX((float) Math.PI)); } // glTF-Raum (Y oben, +Z vorne)

	// ---------------------------------------------------------------- Pets
	private static float wave(float[] v, double t) { return v == null ? 0f : v[0] + v[1] * (float) Math.sin(t + v[2]); }

	/** Bewegung eines Teils (extras.cloudyMove); false = Teil gerade unsichtbar (Groesse 0, z. B. Feueratem aus). */
	private static boolean move(MatrixStack ms, Part p, long now) {
		double t = (now % (long) p.mPer) / (double) p.mPer * Math.PI * 2;
		float bob = 0f; if (p.mBob != null) { float per = Math.max(100f, p.mBob[1]); bob = p.mBob[0] * (float) Math.sin((now % (long) per) / (double) per * Math.PI * 2 + p.mBob[2]); }
		float sc = p.mS == null ? 1f : Math.max(0f, wave(p.mS, t));
		if (sc < 0.01f) return false;
		ms.translate(p.mPiv[0], p.mPiv[1] + bob, p.mPiv[2]);
		if (p.mRy != null) ms.multiply(new Quaternionf().rotationY(wave(p.mRy, t)));
		if (p.mRx != null) ms.multiply(new Quaternionf().rotationX(wave(p.mRx, t)));
		if (p.mRz != null) ms.multiply(new Quaternionf().rotationZ(wave(p.mRz, t)));
		if (sc != 1f) ms.scale(sc, sc, sc);
		ms.translate(-p.mPiv[0], -p.mPiv[1], -p.mPiv[2]);
		return true;
	}

	public static final float PET_X = 0.8f, PET_Y = 0.05f, PET_Z = 0.1f, SHOULDER_X = -0.52f;

	/** Befestigung eines Pets: "float" (neben der linken Schulter), "shoulder" (Brett auf der rechten Schulter) oder "arm_left" (am linken Arm). */
	public static String petMount(String id) { Model m = model(id); return m == null ? "" : m.mount; }

	private static void petParts(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, Model m, Identifier skin) {
		long now = System.currentTimeMillis();
		for (Part p : m.parts) {
			ms.push();
			if (!p.cm || move(ms, p, now)) drawPart(ms, vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(p.skin && skin != null ? skin : m.tex(p))), light, ov, p, p.tx, p.ty, p.tz, p.yaw);
			ms.pop();
		}
	}

	/** Pet am Koerper (Aufruf nach body.rotate, wie wings). skin = Skin des Spielers fuers Mini-Ich (darf null sein). */
	public static void pet(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id, Identifier skin) {
		Model m = model(id);
		if (m == null || "arm_left".equals(m.mount)) return;
		begin(ms);
		if ("shoulder".equals(m.mount)) ms.translate(SHOULDER_X, 0f, 0f); else ms.translate(PET_X, PET_Y, PET_Z);
		petParts(ms, vcp, light, ov, m, skin);
		ms.pop();
	}

	/** Pet am linken Arm (Aufruf NACH leftArm.rotate): bewegt sich mit dem Arm; Ursprung = Schultergelenk, verschoben um extras.cloudyPet.offset. */
	public static void petOnArm(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id, Identifier skin) {
		Model m = model(id);
		if (m == null || !"arm_left".equals(m.mount)) return;
		begin(ms);
		if (m.off != null) ms.translate(m.off[0], m.off[1], m.off[2]);
		petParts(ms, vcp, light, ov, m, skin);
		ms.pop();
	}

	/** Hut/Krone: am Kopf, Ursprung = Halsgelenk (Aufruf nach head.rotate). */
	public static void hat(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id) {
		Model m = model(id);
		if (m == null) return;
		begin(ms);
		for (Part p : m.parts) drawPart(ms, vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(m.tex(p))), light, ov, p, p.tx, p.ty, p.tz, p.yaw);
		ms.pop();
	}

	/** Umhang: haengt am Halsgelenk, 0,155 Bloecke hinter dem Koerper (Aufruf nach body.rotate). limb = Laufbewegung 0..1. */
	public static void cloak(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id, float limb) {
		Model m = model(id);
		if (m == null) return;
		begin(ms);
		float[] ph = CapePhys.now(); // je Spieler: Laufen, Fallen, Seitwaerts, Drehen
		float tilt = CAPE_TILT + 0.03f * (float) Math.sin(System.currentTimeMillis() / 900.0) + Math.max(0f, ph[0]) * 0.32f + Math.min(1f, limb) * 0.08f;
		ms.translate(0f, 0f, -CAPE_Z);
		ms.multiply(new Quaternionf().rotationX(tilt).rotateZ(ph[1] * 0.12f));
		for (Part p : m.parts) drawPart(ms, vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(m.tex(p))), light, ov, p, p.tx, p.ty, p.tz, p.yaw);
		ms.pop();
	}

	/** Fluegel: Wurzeln am oberen Ruecken, beide Seiten schlagen; Heiligenschein (falls vorhanden) schwebt ueber dem Kopf (Aufruf nach body.rotate). */
	public static void wings(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id) {
		Model m = model(id);
		if (m == null) return;
		begin(ms);
		float flap = 0.12f + 0.17f * (float) Math.sin(System.currentTimeMillis() / 520.0);
		float sc = WING_SC * ModConfig.wingSize / 100f;
		for (Part p : m.parts) {
			VertexConsumer vc = vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(m.tex(p)));
			if (p.halo) { drawPart(ms, vc, light, ov, p, 0f, HALO_Y, 0f, 0f); continue; }
			ms.push();
			ms.translate(0f, WING_Y + ModConfig.wingY * 0.02f, WING_Z);
			ms.scale(sc, sc, sc);
			if (p.mot) { // Fluegelschlag aus dem Modell
				double t = (System.currentTimeMillis() % p.per) / (double) p.per * Math.PI * 2;
				float roll = p.roll0 + p.rollA * (float) Math.sin(t);
				ms.translate(p.tx, p.ty, p.tz);
				ms.multiply(new Quaternionf().rotationY(p.yaw + p.side * p.yawA * (float) Math.sin(t + 0.6)));
				ms.translate(p.piv[0], p.piv[1], p.piv[2]); ms.multiply(new Quaternionf().rotationZ(p.side * roll)); ms.translate(-p.piv[0], -p.piv[1], -p.piv[2]);
				if (p.chain) { // Kette bleibt haengen und schwingt verzoegert nach
					float late = p.roll0 + p.rollA * (float) Math.sin(t - p.lag), sw = -p.side * p.follow * late + p.sway * (float) Math.sin(t - p.lag - 0.8);
					ms.translate(p.cpiv[0], p.cpiv[1], p.cpiv[2]); ms.multiply(new Quaternionf().rotationZ(sw)); ms.translate(-p.cpiv[0], -p.cpiv[1], -p.cpiv[2]);
				}
				drawPart(ms, vc, light, ov, p, 0f, 0f, 0f, 0f);
			} else drawPart(ms, vc, light, ov, p, p.tx, p.ty, p.tz, p.yaw + p.side * flap);
			ms.pop();
		}
		ms.pop();
	}

	/** Freies Modell (z. B. 3D-Buchstabe) im aktuellen Raum zeichnen: glTF-Raum unveraendert (Y oben, +Z vorne), mit Farbe/Deckkraft. false = nicht ladbar. */
	public static boolean drawRes(MatrixStack ms, VertexConsumerProvider vcp, String key, String res, int argb, int light) {
		Model m = model(key, res);
		if (m == null) return false;
		int a = argb >>> 24, r = (argb >> 16) & 255, g = (argb >> 8) & 255, b = argb & 255;
		for (Part p : m.parts) drawPart(ms, vcp.getBuffer(RenderLayer.getEntityTranslucent(m.tex(p))), light, net.minecraft.client.render.OverlayTexture.DEFAULT_UV, p, p.tx, p.ty, p.tz, p.yaw, r, g, b, a);
		return true;
	}

	// ---------------------------------------------------------------- Menue-Bild
	private static final Map<String, Identifier> ICO = new HashMap<>();
	private static final Map<String, int[]> ICOSZ = new HashMap<>();

	/** Vorschaubild (aus dem Modell gerendert) fuer die Cosmetics-Menues; null wenn nicht vorhanden. */
	public static Identifier ico(String id, int[] out) {
		if (!handles(id)) return null;
		Identifier ident = ICO.get(id);
		if (ident == null) {
			try (InputStream in = GLB.class.getResourceAsStream("/cloudy-cos/ico-" + id + ".png")) {
				if (in == null) return null;
				NativeImage img = NativeImage.read(in);
				ident = Identifier.of("cloudy-client", "g3ico/" + id);
				NativeImageBackedTexture t = new NativeImageBackedTexture(img);
				t.setFilter(true, false);
				MinecraftClient.getInstance().getTextureManager().registerTexture(ident, t);
				ICO.put(id, ident);
				ICOSZ.put(id, new int[] {img.getWidth(), img.getHeight()});
			} catch (Exception e) {
				return null;
			}
		}
		int[] sz = ICOSZ.get(id);
		if (out != null && sz != null) { out[0] = sz[0]; out[1] = sz[1]; }
		return ident;
	}
}
