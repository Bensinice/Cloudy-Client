package app.cloudy.client;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;

/** Cosmetics anderer Cloudy-Spieler: der Launcher fragt den Konto-Server (Datei cosoth), wir melden ihm die Namen im Spiel (Datei coswant). */
public final class CosmeticNet {
	private static final Map<PlayerEntityRenderState, AbstractClientPlayerEntity> STASH = new WeakHashMap<>();
	private static volatile Map<String, String[]> others = new HashMap<>(); // Name (klein) -> {cape, hat, wings}
	private static volatile Map<String, List<String>> tagMap = new HashMap<>(); // Name (klein) -> Tags (owner, manager, clan:TAG:farbe ...)
	private static volatile java.util.Set<String> live = new java.util.HashSet<>(); // Namen (klein), die gerade nachweislich mit Cloudy spielen (Herzschlag am Konto-Server)
	private static long lastWant, lastRead, otherMod;
	private static String lastNames = "";

	public static void stash(PlayerEntityRenderState s, AbstractClientPlayerEntity p) { try { STASH.put(s, p); } catch (Throwable ignored) {} }
	public static AbstractClientPlayerEntity entityOf(PlayerEntityRenderState s) {
		try {
			AbstractClientPlayerEntity p = STASH.get(s);
			if (p != null) return p;
			// Ausweg ohne Mixin: genau ein anderer Spieler mit demselben Skin
			MinecraftClient mc = MinecraftClient.getInstance();
			if (mc.world == null || s == null || s.skinTextures == null) return null;
			AbstractClientPlayerEntity found = null; int n = 0;
			for (AbstractClientPlayerEntity o : mc.world.getPlayers()) {
				if (o == mc.player || !o.getSkinTextures().texture().equals(s.skinTextures.texture())) continue;
				found = o; n++;
			}
			return n == 1 && !Cosmetics.isSelf(s.skinTextures) ? found : null;
		} catch (Throwable t) { return null; }
	}

	/** Spielt dieser Spieler gerade mit Cloudy? Nur wenn der Konto-Server es bestaetigt (angemeldeter Launcher meldet sich regelmaessig) – nie geraten. */
	public static boolean isCloudy(String name) { return name != null && live.contains(name.toLowerCase()); }
	/** Owner laut Konto-Server (Rang am Cloudy-Konto, nicht am Spielernamen festgemacht). */
	public static boolean isOwner(String name) { List<String> l = tagsOf(name); return l != null && l.contains("owner"); }

	public static List<String> tagsOf(String name) { return name == null ? null : tagMap.get(name.toLowerCase()); }
	/** Farben wie im Launcher: Owner rot, Admin hellrot, Manager orange, Mod blau, Cloudy+ gelb, Gold kraeftig gold, Tester gruen. */
	private static int tagColor(String t) {
		switch (t) { case "owner": return 0xFF3B4A; case "admin": return 0xFF7A82; case "manager": return 0xFFA028; case "mod": return 0x7DB4FF; case "plus": return 0xFFE08A; case "gold": return 0xFFC400; case "tester": return 0x5FE0A0; default: return 0x9CC9FF; }
	}
	/** Rang-Tags (Owner, Admin, Gold) fett, damit sie sich klar von Cloudy+ und Tester abheben. */
	private static boolean tagBold(String t) { return t.equals("owner") || t.equals("admin") || t.equals("gold"); }
	/** Vorsatz vor dem Namen, z. B. "[Owner] [CLD] ". Null, wenn der Spieler keine Tags hat. */
	public static net.minecraft.text.MutableText tagPrefix(String name) {
		List<String> l = tagsOf(name);
		net.minecraft.text.MutableText out = isCloudy(name) ? net.minecraft.text.Text.literal("\u2601 ").styled(st -> st.withColor(0x9FD3FF)) : null; // Cloudy-Wolke: bestaetigter Cloudy-Spieler
		if (l == null || l.isEmpty()) return out;
		for (String t : l) {
			String label; int col;
			if (t.startsWith("clan:")) { String[] p = t.split(":"); label = p.length > 1 ? p[1] : ""; col = 0x9CC9FF; if (p.length > 2) { try { col = Integer.parseInt(p[2], 16); } catch (Exception ignored) {} } }
			else { label = t.isEmpty() ? "" : Character.toUpperCase(t.charAt(0)) + t.substring(1); col = tagColor(t); if (t.equals("plus")) label = "Cloudy+"; if (t.equals("mod")) label = "Mod"; if (t.equals("gold")) label = "Gold"; }
			if (label.isEmpty()) continue;
			final int c = col;
			final boolean bold = !t.startsWith("clan:") && tagBold(t);
			net.minecraft.text.MutableText part = net.minecraft.text.Text.literal("[" + label + "] ").styled(st -> st.withColor(c).withBold(bold));
			if (out == null) out = part; else out.append(part);
		}
		return out;
	}
	public static String[] get(String name) { return name == null ? null : others.get(name.toLowerCase()); }

	private static boolean okId(String v, String cat) { return v != null && v.startsWith(cat + "-") && (java.util.Arrays.asList(Cosmetics.ALL).contains(v) || ZZ4.handles(v)); }

	public static void tick(MinecraftClient mc) {
		String want = System.getProperty("cloudy.coswant", ""), oth = System.getProperty("cloudy.cosoth", "");
		if (want.isEmpty() || oth.isEmpty() || mc.world == null || mc.player == null || mc.getNetworkHandler() == null) return;
		long now = System.currentTimeMillis();
		if (now - lastWant > 4000) {
			lastWant = now;
			try {
				List<String> names = new ArrayList<>();
				String me = mc.player.getName().getString();
				for (PlayerListEntry e : mc.getNetworkHandler().getPlayerList()) { String n = e.getProfile().getName(); if (n != null) names.add(n); }
				java.util.Collections.sort(names);
				String joined = String.join(",", names);
				if (!joined.equals(lastNames) || now - lastRead > 20000) { // geaendert oder alle 20 s auffrischen (Mitspieler wechseln ihre Cosmetics)
					lastNames = joined; lastRead = now;
					JsonObject o = new JsonObject(); com.google.gson.JsonArray a = new com.google.gson.JsonArray(); for (String n : names) a.add(n); o.add("names", a);
					Files.writeString(Path.of(want), o.toString());
				}
			} catch (Throwable ignored) {}
		}
		try {
			Path p = Path.of(oth);
			if (Files.exists(p)) {
				long m = Files.getLastModifiedTime(p).toMillis();
				if (m != otherMod) {
					otherMod = m;
					JsonObject root = JsonParser.parseString(Files.readString(p)).getAsJsonObject(), pl = root.getAsJsonObject("players");
					Map<String, String[]> nm = new HashMap<>(); Map<String, List<String>> tm = new HashMap<>(); java.util.Set<String> lv = new java.util.HashSet<>(); String selfN = mc.player.getName().getString();
					if (pl != null) for (Map.Entry<String, JsonElement> en : pl.entrySet()) {
						JsonObject e = en.getValue().getAsJsonObject();
						try { if (e.has("cl") && e.get("cl").getAsInt() == 1) lv.add(en.getKey().toLowerCase()); } catch (Throwable ignored) {}
						try { if (e.has("tg") && e.get("tg").isJsonArray()) { List<String> tl = new ArrayList<>(); for (JsonElement x : e.getAsJsonArray("tg")) tl.add(x.getAsString()); if (!tl.isEmpty()) tm.put(en.getKey().toLowerCase(), tl); } } catch (Throwable ignored) {}
						if (en.getKey().equalsIgnoreCase(selfN)) continue;
						String c = e.has("cape") ? e.get("cape").getAsString() : null, h = e.has("hat") ? e.get("hat").getAsString() : null, w = e.has("wings") ? e.get("wings").getAsString() : null;
						nm.put(en.getKey().toLowerCase(), new String[] { okId(c, "cape") ? c : null, okId(h, "hat") ? h : null, okId(w, "wings") ? w : null });
					}
					if (nm.size() != others.size()) CloudyClient.LOG.info("Cloudy: Cosmetics von {} Mitspielern geladen", nm.size());
					others = nm; tagMap = tm; live = lv;
				}
			}
		} catch (Throwable ignored) {}
	}
}
