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
	}

	// Platzierung (glTF-Raum, Ursprung = Halsgelenk). Gleiche Zahlen wie PLACE in assets/js/glb3d.js.
	public static final float CAPE_Z = 0.155f, CAPE_TILT = 0.05f;
	public static final float WING_Y = -0.22f, WING_Z = -0.15f, WING_SC = 0.62f;
	public static final float HALO_Y = 0.66f;

	private static final class Part { String name; float[] v; int[] idx; float tx, ty, tz, yaw; int side; boolean halo; }
	private static final class Model { Part[] parts; Identifier tex; }

	private static final Map<String, Model> MODELS = new HashMap<>();
	private static final Set<String> FAILED = new HashSet<>();

	public static boolean handles(String id) { return id != null && FILES.containsKey(id); }

	// ---------------------------------------------------------------- Laden
	private static Model model(String id) {
		Model have = MODELS.get(id);
		if (have != null || FAILED.contains(id)) return have;
		try (InputStream raw = GLB.class.getResourceAsStream("/cloudy-cos/glb/" + FILES.get(id))) {
			if (raw == null) throw new java.io.IOException(FILES.get(id) + " fehlt");
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
		for (int ni = 0; ni < nodes.size(); ni++) {
			JsonObject n = nodes.get(ni).getAsJsonObject();
			if (!n.has("mesh")) continue;
			float tx = 0, ty = 0, tz = 0, yaw = 0;
			if (n.has("translation")) { JsonArray t = n.getAsJsonArray("translation"); tx = t.get(0).getAsFloat(); ty = t.get(1).getAsFloat(); tz = t.get(2).getAsFloat(); }
			if (n.has("rotation")) { JsonArray q = n.getAsJsonArray("rotation"); yaw = 2f * (float) Math.atan2(q.get(1).getAsDouble(), q.get(3).getAsDouble()); } // die Modelle drehen nur um Y
			String name = n.has("name") ? n.get("name").getAsString() : "";
			for (var pe : meshes.get(n.get("mesh").getAsInt()).getAsJsonObject().getAsJsonArray("primitives")) {
				JsonObject prim = pe.getAsJsonObject(), at = prim.getAsJsonObject("attributes");
				float[] pos = floats(j, d, bin, at.get("POSITION").getAsInt(), 3), nor = floats(j, d, bin, at.get("NORMAL").getAsInt(), 3), uv = floats(j, d, bin, at.get("TEXCOORD_0").getAsInt(), 2);
				Part p = new Part();
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
		// eingebettete PNG-Textur
		JsonObject img = j.getAsJsonArray("images").get(0).getAsJsonObject(), bv = j.getAsJsonArray("bufferViews").get(img.get("bufferView").getAsInt()).getAsJsonObject();
		int off = bin + (bv.has("byteOffset") ? bv.get("byteOffset").getAsInt() : 0), len = bv.get("byteLength").getAsInt();
		NativeImage ni = NativeImage.read(new ByteArrayInputStream(d, off, len));
		Identifier tid = Identifier.of("cloudy-client", "g3/" + id);
		MinecraftClient.getInstance().getTextureManager().registerTexture(tid, new NativeImageBackedTexture(ni));
		Model m = new Model();
		m.parts = parts.toArray(new Part[0]);
		m.tex = tid;
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
	private static void drawPart(MatrixStack ms, VertexConsumer vc, int light, int ov, Part p, float tx, float ty, float tz, float yaw) {
		ms.push();
		ms.translate(tx, ty, tz);
		if (yaw != 0f) ms.multiply(new Quaternionf().rotationY(yaw));
		MatrixStack.Entry e = ms.peek();
		float[] v = p.v;
		int[] ix = p.idx;
		for (int f = 0; f + 3 <= ix.length; f += 3) {
			for (int k = 0; k < 4; k++) { // Dreieck als Quad mit doppeltem letztem Punkt (wie ZZ4)
				int o = ix[f + Math.min(k, 2)] * 8;
				vc.vertex(e, v[o], v[o + 1], v[o + 2]).color(255, 255, 255, 255).texture(v[o + 3], v[o + 4]).overlay(ov).light(light).normal(e, v[o + 5], v[o + 6], v[o + 7]);
			}
		}
		ms.pop();
	}

	private static void begin(MatrixStack ms) { ms.push(); ms.multiply(new Quaternionf().rotationX((float) Math.PI)); } // glTF-Raum (Y oben, +Z vorne)

	/** Hut/Krone: am Kopf, Ursprung = Halsgelenk (Aufruf nach head.rotate). */
	public static void hat(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id) {
		Model m = model(id);
		if (m == null) return;
		begin(ms);
		VertexConsumer vc = vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(m.tex));
		for (Part p : m.parts) drawPart(ms, vc, light, ov, p, p.tx, p.ty, p.tz, p.yaw);
		ms.pop();
	}

	/** Umhang: haengt am Halsgelenk, 0,155 Bloecke hinter dem Koerper (Aufruf nach body.rotate). limb = Laufbewegung 0..1. */
	public static void cloak(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id, float limb) {
		Model m = model(id);
		if (m == null) return;
		begin(ms);
		float tilt = CAPE_TILT + 0.03f * (float) Math.sin(System.currentTimeMillis() / 900.0) + Math.min(1f, limb) * 0.25f;
		ms.translate(0f, 0f, -CAPE_Z);
		ms.multiply(new Quaternionf().rotationX(tilt));
		VertexConsumer vc = vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(m.tex));
		for (Part p : m.parts) drawPart(ms, vc, light, ov, p, p.tx, p.ty, p.tz, p.yaw);
		ms.pop();
	}

	/** Fluegel: Wurzeln am oberen Ruecken, beide Seiten schlagen; Heiligenschein (falls vorhanden) schwebt ueber dem Kopf (Aufruf nach body.rotate). */
	public static void wings(MatrixStack ms, VertexConsumerProvider vcp, int light, int ov, String id) {
		Model m = model(id);
		if (m == null) return;
		begin(ms);
		VertexConsumer vc = vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(m.tex));
		float flap = 0.12f + 0.17f * (float) Math.sin(System.currentTimeMillis() / 520.0);
		float sc = WING_SC * ModConfig.wingSize / 100f;
		for (Part p : m.parts) {
			if (p.halo) { drawPart(ms, vc, light, ov, p, 0f, HALO_Y, 0f, 0f); continue; }
			ms.push();
			ms.translate(0f, WING_Y + ModConfig.wingY * 0.02f, WING_Z);
			ms.scale(sc, sc, sc);
			drawPart(ms, vc, light, ov, p, p.tx, p.ty, p.tz, p.yaw + p.side * flap);
			ms.pop();
		}
		ms.pop();
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
