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

	public static List<String> tagsOf(String name) { return name == null ? null : tagMap.get(name.toLowerCase()); }
	private static int tagColor(String t) {
		switch (t) { case "owner": return 0xFFAA00; case "admin": return 0xFF5555; case "manager": return 0xFF8A3D; case "mod": return 0x55FF55; case "plus": return 0x55FFFF; case "tester": return 0xAA77FF; default: return 0x9CC9FF; }
	}
	/** Vorsatz vor dem Namen, z. B. "[Owner] [CLD] ". Null, wenn der Spieler keine Tags hat. */
	public static net.minecraft.text.MutableText tagPrefix(String name) {
		List<String> l = tagsOf(name); if (l == null || l.isEmpty()) return null;
		net.minecraft.text.MutableText out = null;
		for (String t : l) {
			String label; int col;
			if (t.startsWith("clan:")) { String[] p = t.split(":"); label = p.length > 1 ? p[1] : ""; col = 0x9CC9FF; if (p.length > 2) { try { col = Integer.parseInt(p[2], 16); } catch (Exception ignored) {} } }
			else { label = t.isEmpty() ? "" : Character.toUpperCase(t.charAt(0)) + t.substring(1); col = tagColor(t); if (t.equals("plus")) label = "Cloudy+"; if (t.equals("mod")) label = "Mod"; }
			if (label.isEmpty()) continue;
			final int c = col;
			net.minecraft.text.MutableText part = net.minecraft.text.Text.literal("[" + label + "] ").styled(st -> st.withColor(c));
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
					Map<String, String[]> nm = new HashMap<>(); Map<String, List<String>> tm = new HashMap<>(); String selfN = mc.player.getName().getString();
					if (pl != null) for (Map.Entry<String, JsonElement> en : pl.entrySet()) {
						JsonObject e = en.getValue().getAsJsonObject();
						try { if (e.has("tg") && e.get("tg").isJsonArray()) { List<String> tl = new ArrayList<>(); for (JsonElement x : e.getAsJsonArray("tg")) tl.add(x.getAsString()); if (!tl.isEmpty()) tm.put(en.getKey().toLowerCase(), tl); } } catch (Throwable ignored) {}
						if (en.getKey().equalsIgnoreCase(selfN)) continue;
						String c = e.has("cape") ? e.get("cape").getAsString() : null, h = e.has("hat") ? e.get("hat").getAsString() : null, w = e.has("wings") ? e.get("wings").getAsString() : null;
						nm.put(en.getKey().toLowerCase(), new String[] { okId(c, "cape") ? c : null, okId(h, "hat") ? h : null, okId(w, "wings") ? w : null });
					}
					if (nm.size() != others.size()) CloudyClient.LOG.info("Cloudy: Cosmetics von {} Mitspielern geladen", nm.size());
					others = nm; tagMap = tm;
				}
			}
		} catch (Throwable ignored) {}
	}
}
