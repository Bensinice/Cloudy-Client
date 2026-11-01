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

	public static String[] get(String name) { return name == null ? null : others.get(name.toLowerCase()); }

	private static boolean okId(String v, String cat) { return v != null && v.startsWith(cat + "-") && java.util.Arrays.asList(Cosmetics.ALL).contains(v); }

	public static void tick(MinecraftClient mc) {
		String want = System.getProperty("cloudy.coswant", ""), oth = System.getProperty("cloudy.cosoth", "");
		if (want.isEmpty() || oth.isEmpty() || mc.world == null || mc.player == null || mc.getNetworkHandler() == null) return;
		long now = System.currentTimeMillis();
		if (now - lastWant > 4000) {
			lastWant = now;
			try {
				List<String> names = new ArrayList<>();
				String me = mc.player.getName().getString();
				for (PlayerListEntry e : mc.getNetworkHandler().getPlayerList()) { String n = e.getProfile().getName(); if (n != null && !n.equalsIgnoreCase(me)) names.add(n); }
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
					Map<String, String[]> nm = new HashMap<>();
					if (pl != null) for (Map.Entry<String, JsonElement> en : pl.entrySet()) {
						JsonObject e = en.getValue().getAsJsonObject();
						String c = e.has("cape") ? e.get("cape").getAsString() : null, h = e.has("hat") ? e.get("hat").getAsString() : null, w = e.has("wings") ? e.get("wings").getAsString() : null;
						nm.put(en.getKey().toLowerCase(), new String[] { okId(c, "cape") ? c : null, okId(h, "hat") ? h : null, okId(w, "wings") ? w : null });
					}
					others = nm;
				}
			}
		} catch (Throwable ignored) {}
	}
}
