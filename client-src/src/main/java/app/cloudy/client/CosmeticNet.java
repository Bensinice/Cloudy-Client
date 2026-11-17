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
	private static volatile Map<String, String[]> others = new HashMap<>(); // Name (klein) -> {cape, hat, wings, pet, trail, winfx, foot}
	private static volatile Map<String, Map<String, int[]>> dyes = new HashMap<>(); // Name -> Item -> {Haupt, Leucht}
	private static volatile Map<String, Integer> petLvs = new HashMap<>();
	private static volatile Map<String, String> badges = new HashMap<>(); // Name -> Abzeichen-Zeichen (Erfolge)
	private static boolean evShown;
	public static int[] dyeOf(String name, String id) { Map<String, int[]> m = name == null || id == null ? null : dyes.get(name.toLowerCase()); return m == null ? null : m.get(id); }
	public static int dyeMain(String name, String id, int def) { int[] d = dyeOf(name, id); return d != null && d[0] != -1 ? d[0] : def; }
	public static int petLv(String name) { Integer v = name == null ? null : petLvs.get(name.toLowerCase()); return v == null ? 1 : v; }
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
		String bd = name == null || !ModConfig.isOn("badges") ? null : badges.get(name.toLowerCase()); // Abzeichen (Erfolg) neben dem Namen
		if (bd != null && !bd.isEmpty()) { net.minecraft.text.MutableText b = net.minecraft.text.Text.literal(bd + " ").styled(st -> st.withColor(0xFFD24A)); if (out == null) out = b; else out.append(b); }
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
		if (now - lastWant > 4000 || Emotes.dirty || Social.dirty || PetEmote.dirty) {
			lastWant = now;
			try {
				List<String> names = new ArrayList<>();
				String me = mc.player.getName().getString();
				for (PlayerListEntry e : mc.getNetworkHandler().getPlayerList()) { String n = e.getProfile().getName(); if (n != null) names.add(n); }
				java.util.Collections.sort(names);
				String joined = String.join(",", names);
				if (!joined.equals(lastNames) || now - lastRead > 20000 || Emotes.dirty || Social.dirty || PetEmote.dirty) { Emotes.dirty = false; Social.dirty = false; PetEmote.dirty = false; // geaendert oder alle 20 s auffrischen (Mitspieler wechseln ihre Cosmetics)
					lastNames = joined; lastRead = now;
					JsonObject o = new JsonObject(); com.google.gson.JsonArray a = new com.google.gson.JsonArray(); for (String n : names) a.add(n); o.add("names", a);
					JsonObject em = Emotes.wantJson(); if (em != null) o.add("em", em); // eigenes Emote fuer die Mitspieler
					JsonObject pe = PetEmote.want(); if (pe != null) o.add("pe", pe); // Pet-Emote
					com.google.gson.JsonArray rq = Social.rpcJson(); if (rq.size() > 0) o.add("rpc", rq); com.google.gson.JsonArray jr = Social.journalJson(); if (jr.size() > 0) o.add("jr", jr); // Auftraege (Profil, Party-Chat, Wolken-Post ...)
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
					long fts = root.has("ts") ? root.get("ts").getAsLong() : m; Map<String, Object[]> emm = new HashMap<>(), pem = new HashMap<>();
					Map<String, String[]> nm = new HashMap<>(); Map<String, Map<String, int[]>> dm = new HashMap<>(); Map<String, Integer> plm = new HashMap<>(); Map<String, String> bdm = new HashMap<>(); Map<String, List<String>> tm = new HashMap<>(); java.util.Set<String> lv = new java.util.HashSet<>(); String selfN = mc.player.getName().getString();
					if (pl != null) for (Map.Entry<String, JsonElement> en : pl.entrySet()) {
						JsonObject e = en.getValue().getAsJsonObject();
						try { if (e.has("cl") && e.get("cl").getAsInt() == 1) lv.add(en.getKey().toLowerCase()); } catch (Throwable ignored) {}
						try { if (e.has("tg") && e.get("tg").isJsonArray()) { List<String> tl = new ArrayList<>(); for (JsonElement x : e.getAsJsonArray("tg")) tl.add(x.getAsString()); if (!tl.isEmpty()) tm.put(en.getKey().toLowerCase(), tl); } } catch (Throwable ignored) {}
						if (en.getKey().equalsIgnoreCase(selfN)) continue;
						try { if (e.has("pe") && e.get("pe").isJsonObject()) { JsonObject x = e.getAsJsonObject("pe"); String pid = x.get("id").getAsString(); if (pid.matches("[a-z0-9_]{1,24}")) pem.put(en.getKey().toLowerCase(), new Object[] { pid, fts - x.get("a").getAsLong() }); } } catch (Throwable ignored) {}
						try { if (e.has("em") && e.get("em").isJsonObject()) { JsonObject x = e.getAsJsonObject("em"); String eid = x.get("id").getAsString(); if (eid.startsWith("emote-")) emm.put(en.getKey().toLowerCase(), new Object[] { eid, fts - x.get("a").getAsLong() }); } } catch (Throwable ignored) {}
						String c = e.has("cape") ? e.get("cape").getAsString() : null, h = e.has("hat") ? e.get("hat").getAsString() : null, w = e.has("wings") ? e.get("wings").getAsString() : null, pt = e.has("pet") ? e.get("pet").getAsString() : null;
						String tr = e.has("trail") ? e.get("trail").getAsString() : null, wf = e.has("winfx") ? e.get("winfx").getAsString() : null, ft = e.has("foot") ? e.get("foot").getAsString() : null;
						nm.put(en.getKey().toLowerCase(), new String[] { okId(c, "cape") ? c : null, okId(h, "hat") ? h : null, okId(w, "wings") ? w : null, okId(pt, "pet") ? pt : null, Effects.known(tr) ? tr : null, Effects.known(wf) ? wf : null, Effects.known(ft) ? ft : null });
						try { if (e.has("dye") && e.get("dye").isJsonObject()) { Map<String, int[]> one = new HashMap<>(); for (Map.Entry<String, JsonElement> de : e.getAsJsonObject("dye").entrySet()) { JsonObject x = de.getValue().getAsJsonObject(); one.put(de.getKey(), new int[] { Cosmetics.hex(x.has("c") ? x.get("c").getAsString() : null), Cosmetics.hex(x.has("g") ? x.get("g").getAsString() : null) }); } dm.put(en.getKey().toLowerCase(), one); } } catch (Throwable ignored) {}
						try { if (e.has("plv")) plm.put(en.getKey().toLowerCase(), e.get("plv").getAsInt()); } catch (Throwable ignored) {}
						try { if (e.has("bd")) { String b = e.get("bd").getAsString(); if (b.length() <= 2) bdm.put(en.getKey().toLowerCase(), b); } } catch (Throwable ignored) {}
					}
					if (nm.size() != others.size()) CloudyClient.LOG.info("Cloudy: Cosmetics von {} Mitspielern geladen", nm.size());
					others = nm; dyes = dm; petLvs = plm; badges = bdm; tagMap = tm; live = lv; Emotes.setOthers(emm); PetEmote.setOthers(pem); Social.read(root, pl);
					try { // Cloudy-Event am Himmel (fuer alle gleichzeitig)
						boolean on = root.has("ev") && root.get("ev").isJsonObject() && root.getAsJsonObject("ev").get("on").getAsBoolean();
						SkyBox.event = on;
						if (on && !evShown && mc.player != null) { evShown = true; String nm0 = root.getAsJsonObject("ev").has("name") ? root.getAsJsonObject("ev").get("name").getAsString() : "Cloudy event"; mc.player.sendMessage(net.minecraft.text.Text.literal("\u2604 " + nm0 + " – look at the sky! Stay online for your reward (+150 CC).").styled(st -> st.withColor(0xFFD866)), false); }
						if (!on) evShown = false;
					} catch (Throwable ignored) {}
				}
			}
		} catch (Throwable ignored) {}
	}
}
