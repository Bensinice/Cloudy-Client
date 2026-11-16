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

	public static final class Emote { public String id, name, en; public int dur; public boolean duo; final Map<String, float[][]> parts = new HashMap<>(), combo = new HashMap<>(); }
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
				e.duo = o.has("duo") && o.get("duo").getAsBoolean();
				keys(o.getAsJsonObject("parts"), e.parts); if (o.has("combo")) keys(o.getAsJsonObject("combo"), e.combo);
				ALL.put(e.id, e);
			}
		} catch (Throwable t) { CloudyClient.LOG.warn("Emotes nicht geladen", t); }
	}

	private static void keys(JsonObject ps, Map<String, float[][]> into) {
		if (ps == null) return;
		for (Map.Entry<String, JsonElement> pe : ps.entrySet()) {
			JsonArray ks = pe.getValue().getAsJsonArray(); float[][] k = new float[ks.size()][4];
			for (int i = 0; i < ks.size(); i++) { JsonArray a = ks.get(i).getAsJsonArray(); for (int j = 0; j < 4 && j < a.size(); j++) k[i][j] = a.get(j).getAsFloat(); }
			into.put(pe.getKey(), k);
		}
	}

	// ---- Combo-Emotes: zwei Cloudy-Spieler (max. 4 Bloecke) starten dasselbe Combo-Emote innerhalb von 2 s -> beide spielen die gemeinsame Animation ----
	private static volatile java.util.Set<String> comboNames = new java.util.HashSet<>(); // klein; "" = ich selbst
	private static String comboAnnounced = "";
	private static void comboCheck(MinecraftClient mc) {
		java.util.Set<String> out = new java.util.HashSet<>();
		if (mc.world == null || mc.player == null || !ModConfig.isOn("emotecombo")) { comboNames = out; return; }
		long now = System.currentTimeMillis();
		Map<String, Object[]> o = others;
		// alle aktiven Combo-Emotes (ich + andere) mit Position
		java.util.List<Object[]> act = new java.util.ArrayList<>(); // {name, id, start, entity}
		if (selfId != null) { Emote e = all().get(selfId); if (e != null && e.duo) act.add(new Object[] { "", selfId, selfStart, mc.player }); }
		if (!o.isEmpty()) for (net.minecraft.client.network.AbstractClientPlayerEntity p : mc.world.getPlayers()) {
			if (p == mc.player) continue; Object[] v = o.get(p.getName().getString().toLowerCase()); if (v == null) continue;
			Emote e = all().get((String) v[0]); if (e == null || !e.duo || now - (Long) v[1] > e.dur) continue;
			act.add(new Object[] { p.getName().getString().toLowerCase(), v[0], v[1], p });
		}
		for (int i = 0; i < act.size(); i++) for (int j = i + 1; j < act.size(); j++) {
			Object[] a = act.get(i), b = act.get(j);
			if (!a[1].equals(b[1]) || Math.abs((Long) a[2] - (Long) b[2]) > 2000) continue;
			if (((net.minecraft.entity.Entity) a[3]).squaredDistanceTo((net.minecraft.entity.Entity) b[3]) > 16.0) continue;
			out.add((String) a[0]); out.add((String) b[0]);
			if (a[0].equals("") || b[0].equals("")) { String partner = a[0].equals("") ? (String) b[0] : (String) a[0], key = partner + selfStart;
				if (!key.equals(comboAnnounced)) { comboAnnounced = key; try { mc.player.sendMessage(net.minecraft.text.Text.literal("\u2728 Combo! " + label((String) a[1]) + " with " + ((net.minecraft.entity.Entity) (a[0].equals("") ? b[3] : a[3])).getName().getString()).styled(st -> st.withColor(0xFFD866)), true);
					var w = mc.world; var pa = mc.player.getPos().add(((net.minecraft.entity.Entity) (a[0].equals("") ? b[3] : a[3])).getPos()).multiply(0.5);
					for (int k = 0; k < 12; k++) w.addParticle(net.minecraft.particle.ParticleTypes.HAPPY_VILLAGER, pa.x + (Math.random() - 0.5), pa.y + 1.6 + Math.random() * 0.6, pa.z + (Math.random() - 0.5), 0, 0.05, 0); } catch (Throwable ignored) {} }
			}
		}
		comboNames = out;
	}

	/** Fortschritt 0..1 des Emotes, das dieser Spieler gerade spielt (null = ich selbst), sonst -1. Fuer Pet-Emotes. */
	public static float progress(String name) {
		String id; long start;
		if (name == null) { id = selfId; start = selfStart; } else { Object[] o = others.get(name.toLowerCase()); if (o == null) return -1f; id = (String) o[0]; start = (Long) o[1]; }
		if (id == null) return -1f; Emote e = all().get(id); if (e == null) return -1f;
		float t = (System.currentTimeMillis() - start) / (float) e.dur; return t < 0f || t > 1f ? -1f : t;
	}

	/** Emotes, die der Spieler besitzt (kostenlose zaehlen immer), in der Reihenfolge der Datei. */
	public static List<String> owned() {
		List<String> l = new ArrayList<>();
		for (String id : all().keySet()) if (Cosmetics.owned.contains(id) || id.equals("emote-wave") || id.equals("emote-clap") || id.equals("emote-highfive")) l.add(id);
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
		if (mc.world != null && mc.world.getTime() % 4 == 0) comboCheck(mc); // 5x pro Sekunde reicht
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
			String id = null, who = null; long start = 0;
			if (state.skinTextures != null && Cosmetics.isSelf(state.skinTextures)) { id = selfId; start = selfStart; who = ""; }
			else {
				var ent = CosmeticNet.entityOf(state);
				if (ent != null) { who = ent.getName().getString().toLowerCase(); Object[] o = others.get(who); if (o != null) { id = (String) o[0]; start = (Long) o[1]; } }
			}
			if (id == null) return;
			Emote e = all().get(id); if (e == null) return;
			float t = (System.currentTimeMillis() - start) / (float) e.dur;
			if (t < 0f || t > 1f) return;
			Map<String, float[][]> src = e.duo && !e.combo.isEmpty() && who != null && comboNames.contains(who) ? e.combo : e.parts; // gemeinsame Combo-Animation
			for (Map.Entry<String, float[][]> pe : src.entrySet()) {
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
