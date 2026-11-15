package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.option.Perspective;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Emotes: kurze Animationen des Spielermodells (Winken, Tanzen …). Die Bewegungen stehen in cloudy-cos/emotes.json
 * (dieselbe Datei nutzt die Shop-Vorschau im Launcher). Abspielen ueber das Emote-Rad (Taste B); andere Cloudy-Spieler
 * sehen das Emote ueber den Konto-Server (Datei coswant -> Launcher -> Server -> Launcher der anderen -> cosoth).
 */
public final class Emotes {
	private Emotes() {}

	public static final class Emote { public String id, name, en; public int dur; final Map<String, float[][]> parts = new HashMap<>(); }
	private static final Map<String, Emote> ALL = new LinkedHashMap<>();
	private static boolean loaded;

	// eigenes Emote
	private static String selfId; private static long selfStart; private static Perspective prevPersp; private static double sx, sz;
	/** Wird vom Netz-Teil gelesen: geaendert = coswant sofort neu schreiben. */
	public static volatile boolean dirty;
	// Emotes anderer Spieler: Name (klein) -> {id, Start (ms, eigene Uhr)}
	private static volatile Map<String, Object[]> others = new HashMap<>();

	public static Map<String, Emote> all() { load(); return ALL; }

	private static void load() {
		if (loaded) return; loaded = true;
		try (InputStream in = Emotes.class.getResourceAsStream("/cloudy-cos/emotes.json")) {
			if (in == null) return;
			JsonObject root = JsonParser.parseString(new String(in.readAllBytes(), StandardCharsets.UTF_8)).getAsJsonObject();
			for (JsonElement el : root.getAsJsonArray("emotes")) {
				JsonObject o = el.getAsJsonObject(); Emote e = new Emote();
				e.id = o.get("id").getAsString(); e.name = o.has("name") ? o.get("name").getAsString() : e.id; e.en = o.has("en") ? o.get("en").getAsString() : e.name;
				e.dur = Math.max(300, o.has("dur") ? o.get("dur").getAsInt() : 2000);
				JsonObject ps = o.getAsJsonObject("parts");
				for (Map.Entry<String, JsonElement> pe : ps.entrySet()) {
					JsonArray ks = pe.getValue().getAsJsonArray(); float[][] k = new float[ks.size()][4];
					for (int i = 0; i < ks.size(); i++) { JsonArray a = ks.get(i).getAsJsonArray(); for (int j = 0; j < 4 && j < a.size(); j++) k[i][j] = a.get(j).getAsFloat(); }
					e.parts.put(pe.getKey(), k);
				}
				ALL.put(e.id, e);
			}
		} catch (Throwable t) { CloudyClient.LOG.warn("Emotes nicht geladen", t); }
	}

	/** Emotes, die der Spieler besitzt (kostenlose zaehlen immer), in der Reihenfolge der Datei. */
	public static List<String> owned() {
		List<String> l = new ArrayList<>();
		for (String id : all().keySet()) if (Cosmetics.owned.contains(id) || id.equals("emote-wave") || id.equals("emote-clap")) l.add(id);
		return l;
	}

	public static String label(String id) { Emote e = all().get(id); return e == null ? id : e.en; }

	/** Eigenes Emote starten: Kamera kurz nach vorne (man sieht sich selbst), Bewegung bricht ab. */
	public static void play(String id) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || all().get(id) == null) return;
		selfId = id; selfStart = System.currentTimeMillis(); dirty = true;
		sx = mc.player.getX(); sz = mc.player.getZ();
		try { if (prevPersp == null) prevPersp = mc.options.getPerspective(); mc.options.setPerspective(Perspective.THIRD_PERSON_FRONT); } catch (Throwable ignored) {}
	}

	public static void stop() {
		if (selfId == null) return;
		selfId = null; dirty = true;
		MinecraftClient mc = MinecraftClient.getInstance();
		try { if (prevPersp != null) mc.options.setPerspective(prevPersp); } catch (Throwable ignored) {}
		prevPersp = null;
	}

	/** Jeden Tick: Ende erkennen, beim Laufen abbrechen. */
	public static void tick(MinecraftClient mc) {
		if (selfId == null) return;
		Emote e = all().get(selfId);
		if (e == null || mc.player == null || System.currentTimeMillis() - selfStart > e.dur) { stop(); return; }
		double dx = mc.player.getX() - sx, dz = mc.player.getZ() - sz;
		if (dx * dx + dz * dz > 0.04 || mc.player.isSneaking()) stop();
	}

	/** Fuer coswant: {id, t} oder null. */
	public static JsonObject wantJson() {
		if (selfId == null) return null;
		JsonObject o = new JsonObject(); o.addProperty("id", selfId); o.addProperty("t", selfStart); return o;
	}

	/** Aus cosoth: Emote eines Mitspielers (Alter in ms beim Schreiben der Datei, ts = Schreibzeit). */
	public static void setOthers(Map<String, Object[]> m) { others = m; }

	private static float[] sample(float[][] k, float t) {
		if (k.length == 0) return new float[4];
		if (t <= k[0][0]) return k[0];
		for (int i = 1; i < k.length; i++) {
			if (t <= k[i][0]) {
				float a = k[i - 1][0], b = k[i][0], f = b > a ? (t - a) / (b - a) : 1f; f = f * f * (3f - 2f * f);
				float[] r = new float[4]; for (int j = 1; j < 4; j++) r[j] = k[i - 1][j] + (k[i][j] - k[i - 1][j]) * f; return r;
			}
		}
		return k[k.length - 1];
	}

	private static final float D = (float) (Math.PI / 180.0);

	/** Aus PlayerEntityModel.setAngles (Mixin): Emote-Pose ueber die normale Pose legen. */
	public static void pose(PlayerEntityModel model, PlayerEntityRenderState state) {
		try {
			String id = null; long start = 0;
			if (state.skinTextures != null && Cosmetics.isSelf(state.skinTextures)) { id = selfId; start = selfStart; }
			else {
				var ent = CosmeticNet.entityOf(state);
				if (ent != null) { Object[] o = others.get(ent.getName().getString().toLowerCase()); if (o != null) { id = (String) o[0]; start = (Long) o[1]; } }
			}
			if (id == null) return;
			Emote e = all().get(id); if (e == null) return;
			float t = (System.currentTimeMillis() - start) / (float) e.dur;
			if (t < 0f || t > 1f) return;
			for (Map.Entry<String, float[][]> pe : e.parts.entrySet()) {
				float[] v = sample(pe.getValue(), t);
				switch (pe.getKey()) {
					case "head" -> { model.head.pitch += v[1] * D; model.head.yaw += v[2] * D; model.head.roll += v[3] * D; }
					case "armR" -> set(model.rightArm, v, 1);
					case "armL" -> set(model.leftArm, v, -1);
					case "legR" -> set(model.rightLeg, v, 1);
					case "legL" -> set(model.leftLeg, v, -1);
					default -> {}
				}
			}
			// Aussenschicht (Aermel/Hose/Hut) mitnehmen, falls sie in dieser Version keine Kind-Teile sind
			follow(model.leftArm, model.leftSleeve, "left_sleeve"); follow(model.rightArm, model.rightSleeve, "right_sleeve");
			follow(model.leftLeg, model.leftPants, "left_pants"); follow(model.rightLeg, model.rightPants, "right_pants");
			follow(model.head, model.hat, "hat");
		} catch (Throwable ignored) {}
	}

	/** side: 1 = rechts, -1 = links. pitch direkt, "in" = zur Mitte (yaw), "out" = seitlich (roll). */
	private static void set(ModelPart p, float[] v, int side) {
		p.pitch = v[1] * D; p.yaw = -side * v[2] * D; p.roll = side * v[3] * D;
	}

	private static void follow(ModelPart main, ModelPart layer, String child) {
		if (main == null || layer == null) return;
		try { if (main.hasChild(child)) return; } catch (Throwable ignored) {}
		layer.copyTransform(main);
	}
}
