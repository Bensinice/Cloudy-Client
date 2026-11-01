package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import org.joml.Quaternionf;

import java.io.DataInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.InflaterInputStream;

/** Das echte Modell "ZZv4 Cosmetics" (BastiGHG, CC BY 4.0): Umhang, zwei Fluegel und Schild als Dreiecksnetze mit Originaltexturen (zz4.bin, 1:1 aus der FBX-Datei). */
public final class ZZ4 {
	private ZZ4() {}

	private static final class Mesh { float[] v; int[] idx; int poly; float px, py, pz; }
	private static final Map<String, Identifier> TEX = new HashMap<>();

	public static final String[] PACKS = {"zz4", "zz4m", "zz3", "zz3s", "zz5", "zk5", "yy", "zv", "zs", "zf", "zb"};
	private static final java.util.Set<String> WONLY = java.util.Set.of("zv", "zs", "zf", "zb"); // reine Fluegel-Pakete (flache Fluegel aus Cosmetica-Modellen)
	private static final Map<String, Mesh[]> MESHES = new HashMap<>();
	private static final java.util.Set<String> FAILED = new java.util.HashSet<>();

	/** Paketname eines Items ("wings-zz4" -> "zz4") oder null, wenn es kein Modell-Item ist. */
	public static String pack(String id) {
		if (id == null) return null;
		int i = id.indexOf('-');
		if (i <= 0) return null;
		String c = id.substring(0, i), k = id.substring(i + 1);
		if (!c.equals("cape") && !c.equals("wings") && !c.equals("shield")) return null;
		if (WONLY.contains(k) && !c.equals("wings")) return null;
		for (String p : PACKS) if (p.equals(k)) return (c.equals("shield") && k.equals("zk5")) || (c.equals("wings") && k.equals("yy")) ? null : k;
		return null;
	}

	public static boolean handles(String id) { return pack(id) != null; }

	private static Mesh[] load(String pack) {
		Mesh[] have = MESHES.get(pack);
		if (have != null || FAILED.contains(pack)) return have;
		try (InputStream raw = ZZ4.class.getResourceAsStream("/cloudy-cos/zz-" + pack + ".bin")) {
			if (raw == null) throw new java.io.IOException("zz-" + pack + ".bin fehlt");
			DataInputStream in = new DataInputStream(new java.io.BufferedInputStream(new InflaterInputStream(raw), 1 << 16));
			if (in.readInt() != 0x5A5A3456) throw new java.io.IOException("falsches Format");
			int n = in.readInt();
			Mesh[] m = new Mesh[n];
			for (int i = 0; i < n; i++) {
				Mesh k = new Mesh();
				int nv = in.readInt(), nf = in.readInt();
				k.poly = in.readInt();
				k.px = in.readFloat(); k.py = in.readFloat(); k.pz = in.readFloat();
				k.v = new float[nv * 8];
				for (int j = 0; j < k.v.length; j++) k.v[j] = in.readFloat();
				k.idx = new int[nf * k.poly];
				for (int j = 0; j < k.idx.length; j++) k.idx[j] = in.readUnsignedShort();
				m[i] = k;
			}
			if (n > 0) flatten(m[0]);
			MESHES.put(pack, m);
			return m;
		} catch (Exception e) {
			CloudyClient.LOG.warn("Modell " + pack + " konnte nicht geladen werden", e);
			FAILED.add(pack);
			return null;
		}
	}

	private static final Map<String, int[]> ICOSZ = new HashMap<>();
	/** Sauberes Vorschaubild (Rueckansicht des 3D-Modells) fuer Menues; null wenn nicht vorhanden. Groesse in out[0..1]. */
	public static Identifier ico(String id, int[] out) {
		String pk = pack(id);
		if (pk == null) return null;
		String name = "ico-" + pk + "-" + id.substring(0, id.indexOf('-'));
		Identifier ident = TEX.get(name);
		if (ident == null) {
			try (InputStream in = ZZ4.class.getResourceAsStream("/cloudy-cos/" + name + ".png")) {
				if (in == null) return null;
				NativeImage img = NativeImage.read(in);
				ident = Identifier.of("cloudy-client", name);
				NativeImageBackedTexture t = new NativeImageBackedTexture(img);
				t.setFilter(true, false);
				MinecraftClient.getInstance().getTextureManager().registerTexture(ident, t);
				TEX.put(name, ident);
				ICOSZ.put(name, new int[] {img.getWidth(), img.getHeight()});
			} catch (Exception e) {
				return null;
			}
		}
		int[] sz = ICOSZ.get(name);
		if (out != null && sz != null) { out[0] = sz[0]; out[1] = sz[1]; }
		return ident;
	}

	private static Identifier tex(String pack, String part) {
		String name = "zz-" + pack + "-" + part;
		Identifier id = TEX.get(name);
		if (id != null) return id;
		try (InputStream in = ZZ4.class.getResourceAsStream("/cloudy-cos/" + name + ".png")) {
			if (in == null) return null;
			NativeImage img = NativeImage.read(in);
			id = Identifier.of("cloudy-client", name);
			MinecraftClient.getInstance().getTextureManager().registerTexture(id, new NativeImageBackedTexture(img));
			TEX.put(name, id);
			return id;
		} catch (Exception e) {
			CloudyClient.LOG.warn("Textur fehlt: " + name, e);
			return null;
		}
	}

	private static void draw(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, Mesh m, Identifier tex) { draw(ms, vcp, light, ov, m, tex, 0f, 0f); }

	/** amp > 0: Stoff-Wellen - der Umhang flattert nach unten hin staerker (y ~ 0..1, Saum unten). */
	private static void draw(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, Mesh m, Identifier tex, float amp, float time) {
		if (tex == null) return;
		VertexConsumer vc = vcp.getBuffer(RenderLayer.getEntityTranslucent(tex));
		MatrixStack.Entry e = ms.peek();
		float[] v = m.v;
		int p = m.poly;
		for (int f = 0; f + p <= m.idx.length; f += p) {
			for (int k = 0; k < 4; k++) { // Dreiecke als Quad mit doppeltem letztem Punkt
				int o = m.idx[f + Math.min(k, p - 1)] * 8;
				float vz = v[o + 2];
				if (amp > 0f) { float yy = Math.max(0f, Math.min(1.1f, v[o + 1])); vz += amp * yy * yy * (float) Math.sin(time * 4.2f + yy * 5.5f + v[o] * 5f); }
				vc.vertex(e, v[o], v[o + 1], vz).color(255, 255, 255, 255).texture(v[o + 3], v[o + 4]).overlay(ov).light(light).normal(e, v[o + 5], v[o + 6], v[o + 7]);
			}
		}
	}

	/** Der Umhang ist im Modell stark nach hinten gebogen (wirkt verzerrt): pro Zeile die mittlere Tiefe entfernen, nur eine leichte Schraege behalten. */
	private static void flatten(Mesh m) {
		int rows = 140; float[] sum = new float[rows], cnt = new float[rows];
		for (int i = 0; i < m.v.length; i += 8) { int b = Math.max(0, Math.min(rows - 1, Math.round(m.v[i + 1] * 100))); sum[b] += m.v[i + 2]; cnt[b]++; }
		for (int i = 0; i < m.v.length; i += 8) {
			int b = Math.max(0, Math.min(rows - 1, Math.round(m.v[i + 1] * 100)));
			float mean = cnt[b] > 0 ? sum[b] / cnt[b] : m.v[i + 2];
			m.v[i + 2] = 0.19f + (m.v[i + 2] - mean) + 0.05f * m.v[i + 1];
			m.v[i + 5] *= 0.5f; m.v[i + 7] *= 0.9f; // Normalen leicht begradigen
		}
	}

	/** Zeichnet den Umhang mit Biegung nach hinten (Laufen/Fallen), seitlichem Schwung und leichtem Flattern; nach unten staerker. */
	private static void drawCloak(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, Mesh m, Identifier tex, float swing, float side, float t) {
		if (tex == null) return;
		VertexConsumer vc = vcp.getBuffer(RenderLayer.getEntityTranslucent(tex));
		MatrixStack.Entry e = ms.peek();
		float[] v = m.v; int p = m.poly;
		float amp = 0.25f + Math.min(1.2f, Math.abs(swing));
		for (int f = 0; f + p <= m.idx.length; f += p) {
			for (int k = 0; k < 4; k++) {
				int o = m.idx[f + Math.min(k, p - 1)] * 8;
				float y = v[o + 1], y01 = Math.max(0f, Math.min(1f, y / 1.03f)), bend = y01 * y01;
				float x = v[o] - side * 0.18f * bend + (float) Math.sin(t * 3.2f + y * 6f) * 0.012f * amp * y01;
				float zz = v[o + 2] - swing * 0.55f * bend + (float) Math.sin(t * 4.1f + y * 7f + v[o] * 5f) * 0.02f * amp * y01;
				float yy = y - Math.abs(swing) * 0.06f * bend;
				vc.vertex(e, x, yy, zz).color(255, 255, 255, 255).texture(v[o + 3], v[o + 4]).overlay(ov).light(light).normal(e, v[o + 5], v[o + 6], v[o + 7]);
			}
		}
	}

	private static float zCenter(Mesh m) {
		if (m.pz != 0f) return m.pz;
		float lo = 1e9f, hi = -1e9f;
		for (int i = 2; i < m.v.length; i += 8) { lo = Math.min(lo, m.v[i]); hi = Math.max(hi, m.v[i]); }
		return (lo + hi) / 2f;
	}

	private static float capeSwing, capeSide, capeLast;
	private static long capeT;

	/** Umhang: haengt am Koerper, weht nach hinten wenn man vorwaerts laeuft, faellt in Ruhe zurueck, kippt beim Schleichen. */
	public static void cloak(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id, float limb) {
		Mesh[] meshes = load(pack(id));
		if (meshes == null) return;
		long now = System.currentTimeMillis();
		float dt = Math.min(0.1f, (now - capeT) / 1000f);
		if (now != capeT) {
			capeT = now;
			float fwd = 0, side = 0, sneak = 0;
			var pl = net.minecraft.client.MinecraftClient.getInstance().player;
			if (pl != null && !CosmeticFeature.PREVIEW) {
				var v = pl.getVelocity();
				double yaw = Math.toRadians(pl.bodyYaw);
				double fx = -Math.sin(yaw), fz = Math.cos(yaw);
				fwd = (float) (v.x * fx + v.z * fz) * 6f;      // + = vorwaerts
				side = (float) (v.x * fz - v.z * fx) * 6f;
				if (!pl.isOnGround()) fwd += (float) Math.max(-0.5, Math.min(0.5, -v.y)) * 0.8f;
				if (pl.isSneaking()) sneak = 0.18f;
			} else if (pl == null || CosmeticFeature.PREVIEW) fwd = 0.35f + 0.25f * (float) Math.sin(now / 700.0);
			float target = Math.max(-0.4f, Math.min(1.2f, fwd)) + sneak;
			float k = 1f - (float) Math.exp(-dt * 7f);
			capeSwing += (target - capeSwing) * k;
			capeSide += (Math.max(-1f, Math.min(1f, side)) - capeSide) * k;
		}
		float idle = (float) Math.sin(now / 900.0) * 0.03f;
		ms.push();
		ms.translate(0, 0, 0.15f);
		ms.multiply(new Quaternionf().rotationX(0.05f + idle + Math.max(0f, capeSwing) * 0.1f).rotateZ(capeSide * 0.05f));
		ms.translate(0, 0, -0.15f);
		float zc = 0.19f + 0.025f;
		ms.translate(0, 0, zc); ms.multiply(new Quaternionf().rotationY((float) Math.PI)); ms.translate(0, 0, -zc); // Muster nach aussen (kein Spiegeln mehr)
		drawCloak(ms, vcp, light, ov, meshes[0], tex(pack(id), "cloak"), capeSwing, capeSide, now / 1000f);
		ms.pop();
	}

	/** Fluegel: beide Seiten schlagen leicht gegenlaeufig um die Wurzel. */
	public static void wings(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id) {
		Mesh[] meshes = load(pack(id));
		if (meshes == null || meshes.length < 3) return;
		Identifier t = tex(pack(id), "wings");
		float s = (float) Math.sin(System.currentTimeMillis() / 520.0), open = 0.12f + 0.17f * s;
		boolean orn = "yy".equals(pack(id));
		float sc = (orn ? 1f : 0.7f) * ModConfig.wingSize / 100f, dy = -ModConfig.wingY * 0.02f;
		for (int i = 1; i <= 2; i++) {
			Mesh m = meshes[i];
			float side = m.px > 0 ? 1 : -1;
			ms.push();
			if (!orn) ms.translate(0, -0.2f, 0.12f); // Fluegel sitzen am Ruecken (Schulterhoehe), nicht an den Hueften
			ms.translate(0, dy, 0);
			ms.translate(m.px, m.py, m.pz);
			ms.multiply(new Quaternionf().rotationY(-side * open).rotateZ(-side * 0.12f * s));
			ms.scale(sc, sc, sc);
			ms.translate(-m.px, -m.py, -m.pz);
			draw(ms, vcp, light, ov, m, t);
			ms.pop();
		}
	}

	/** Schild: Mitte bei (cx, cy, cz) in Bloecken, verkleinert. */
	public static void shield(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id, float cx, float cy, float cz) {
		Mesh[] meshes = load(pack(id));
		if (meshes == null || meshes.length < 4) return;
		ms.push();
		ms.translate(cx, cy, cz);
		draw(ms, vcp, light, ov, meshes[3], tex(pack(id), "shield"));
		ms.pop();
	}
}
