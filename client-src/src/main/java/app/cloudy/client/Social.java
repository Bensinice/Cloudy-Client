package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.mojang.brigadier.Command;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.HoverEvent;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.Vec3d;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Social im Spiel: Party-Chat (/pc), Party (/party), Wolken-Post (/post), Song-Bubbles (/song) und Profilkarten.
 * Alles laeuft ueber den Launcher (Datei coswant -> Konto-Server -> Datei cosoth), die Mod spricht nie selbst mit dem Internet.
 */
public final class Social {
	private Social() {}

	// ---- Auftraege an den Launcher ----
	private static final Map<String, JsonObject> PENDING = new LinkedHashMap<>();
	private static final Map<String, Long> SENT = new HashMap<>();
	private static final Map<String, Consumer<JsonObject>> CB = new HashMap<>();
	public static volatile boolean dirty;
	private static int seq;

	/** Auftrag an den Launcher. Antwort kommt nach 1–8 s im Callback (Spiel-Thread). */
	public static void rpc(String op, JsonObject a, Consumer<JsonObject> cb) {
		if (!launcher()) { say(Text.literal("This only works when Minecraft was started from the Cloudy launcher and you are logged in to your Cloudy account.").formatted(Formatting.RED)); return; }
		String id = Long.toString(System.currentTimeMillis() % 100000000L, 36) + (seq++ % 1000);
		JsonObject q = new JsonObject(); q.addProperty("id", id); q.addProperty("op", op); q.add("a", a == null ? new JsonObject() : a);
		synchronized (PENDING) { PENDING.put(id, q); SENT.put(id, System.currentTimeMillis()); if (cb != null) CB.put(id, cb); while (PENDING.size() > 8) { String k = PENDING.keySet().iterator().next(); PENDING.remove(k); CB.remove(k); SENT.remove(k); } }
		dirty = true;
	}
	// ---- Tagebuch: Ereignisse fuer die Timeline im Launcher (erster Diamant, Nether, End, Sieg) ----
	private static final List<JsonObject> JR = new ArrayList<>();
	public static void journal(String k) { if (!launcher()) return; JsonObject o = new JsonObject(); o.addProperty("k", k); o.addProperty("t", System.currentTimeMillis()); synchronized (JR) { JR.add(o); while (JR.size() > 6) JR.remove(0); } dirty = true; }
	public static JsonArray journalJson() { JsonArray a = new JsonArray(); long now = System.currentTimeMillis(); synchronized (JR) { JR.removeIf(o -> now - o.get("t").getAsLong() > 60000); for (JsonObject o : JR) a.add(o); } return a; }
	public static boolean launcher() { return !System.getProperty("cloudy.coswant", "").isEmpty(); }

	/** Fuer coswant. */
	public static JsonArray rpcJson() {
		JsonArray a = new JsonArray(); long now = System.currentTimeMillis();
		synchronized (PENDING) {
			PENDING.entrySet().removeIf(e -> { Long t = SENT.get(e.getKey()); boolean old = t == null || now - t > 30000; if (old) { Consumer<JsonObject> c = CB.remove(e.getKey()); SENT.remove(e.getKey()); if (c != null) { JsonObject r = new JsonObject(); r.addProperty("ok", false); r.addProperty("error", "No answer from the launcher (Cloudy account server offline?)"); MinecraftClient.getInstance().execute(() -> c.accept(r)); } } return old; });
			for (JsonObject q : PENDING.values()) a.add(q);
		}
		return a;
	}

	// ---- Daten vom Launcher ----
	private static volatile Map<String, String[]> songs = new HashMap<>(); // Name (klein) -> {Titel, Kuenstler}
	private static List<String> partyMembers = new ArrayList<>(); private static String partyLeader = "";
	private static long partySeen = -1; private static final java.util.Set<Long> postSeen = new java.util.HashSet<>();
	public static final List<String[]> MAIL = new ArrayList<>(); // {from, text, zeit}
	private static long mailArrive; private static String mailFrom = "";

	/** Aus CosmeticNet beim Lesen von cosoth (Spiel-Thread). */
	static void read(JsonObject root, JsonObject players) {
		try { // Song-Bubbles
			Map<String, String[]> sm = new HashMap<>();
			if (players != null) for (Map.Entry<String, JsonElement> en : players.entrySet()) { JsonObject e = en.getValue().getAsJsonObject(); if (e.has("song") && e.get("song").isJsonObject()) { JsonObject s = e.getAsJsonObject("song"); String t = s.has("t") ? s.get("t").getAsString() : ""; if (!t.isEmpty()) sm.put(en.getKey().toLowerCase(), new String[] { t, s.has("a") ? s.get("a").getAsString() : "" }); } }
			songs = sm;
		} catch (Throwable ignored) {}
		try { // Antworten
			if (root.has("rpc") && root.get("rpc").isJsonObject()) for (Map.Entry<String, JsonElement> en : root.getAsJsonObject("rpc").entrySet()) {
				Consumer<JsonObject> c; synchronized (PENDING) { if (!PENDING.containsKey(en.getKey())) continue; PENDING.remove(en.getKey()); SENT.remove(en.getKey()); c = CB.remove(en.getKey()); }
				dirty = true; if (c != null) try { c.accept(en.getValue().getAsJsonObject()); } catch (Throwable ignored) {}
			}
		} catch (Throwable ignored) {}
		try { // Party
			List<String> pm = new ArrayList<>(); String ld = "";
			if (root.has("party") && root.get("party").isJsonObject()) { JsonObject p = root.getAsJsonObject("party"); ld = p.has("leader") ? p.get("leader").getAsString() : ""; for (JsonElement x : p.getAsJsonArray("members")) pm.add(x.getAsString()); }
			partyMembers = pm; partyLeader = ld;
			if (root.has("pmsgs") && root.get("pmsgs").isJsonArray()) {
				long max = partySeen; boolean first = partySeen < 0;
				for (JsonElement x : root.getAsJsonArray("pmsgs")) { JsonObject m = x.getAsJsonObject(); long id = m.get("id").getAsLong(); if (id <= partySeen) continue; max = Math.max(max, id);
					if (!first && ModConfig.isOn("partychat")) say(Text.literal("[Party] ").formatted(Formatting.LIGHT_PURPLE, Formatting.BOLD).append(Text.literal(m.get("from").getAsString() + ": ").formatted(Formatting.LIGHT_PURPLE)).append(Text.literal(m.get("text").getAsString()).formatted(Formatting.WHITE))); }
				partySeen = Math.max(max, 0);
			}
		} catch (Throwable ignored) {}
		try { // Wolken-Post
			if (root.has("posts") && root.get("posts").isJsonArray()) for (JsonElement x : root.getAsJsonArray("posts")) {
				JsonObject m = x.getAsJsonObject(); long id = m.get("id").getAsLong(); if (!postSeen.add(id)) continue;
				String from = m.get("from").getAsString(), text = m.get("text").getAsString();
				synchronized (MAIL) { MAIL.add(0, new String[] { from, text, String.valueOf(System.currentTimeMillis()) }); while (MAIL.size() > 20) MAIL.remove(MAIL.size() - 1); }
				if (ModConfig.isOn("post")) { mailArrive = System.currentTimeMillis(); mailFrom = from; unread++; }
			}
		} catch (Throwable ignored) {}
	}
	public static int unread;

	public static String[] songOf(String name) { return name == null || !ModConfig.isOn("songbubble") ? null : songs.get(name.toLowerCase()); }

	static void say(Text t) { MinecraftClient mc = MinecraftClient.getInstance(); if (mc.inGameHud != null) mc.inGameHud.getChatHud().addMessage(t); }
	private static Text click(String label, String cmd, String hover, Formatting col) { return Text.literal(label).styled(s -> s.withColor(col).withClickEvent(new ClickEvent(ClickEvent.Action.SUGGEST_COMMAND, cmd)).withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Text.literal(hover)))); }
	private static void err(JsonObject r) { say(Text.literal(r.has("error") ? r.get("error").getAsString() : "Something went wrong.").formatted(Formatting.RED)); }

	// ---- Wolken-Post im HUD: kleine Wolke fliegt von rechts herein ----
	public static void hud(DrawContext c) {
		if (unread <= 0 || !ModConfig.isOn("post")) return;
		MinecraftClient mc = MinecraftClient.getInstance(); if (mc.options.hudHidden || mc.currentScreen != null) return;
		int w = c.getScaledWindowWidth(); float t = Math.min(1f, (System.currentTimeMillis() - mailArrive) / 1400f); t = 1f - (1f - t) * (1f - t) * (1f - t);
		int bob = (int) Math.round(Math.sin(System.currentTimeMillis() / 380.0) * 2.0);
		String l1 = "Cloud mail from " + mailFrom + (unread > 1 ? "  (+" + (unread - 1) + ")" : ""), l2 = "Press " + CloudyClient.postKeyName() + " to open";
		int bw = Math.max(Ui.w(l1), Ui.w(l2)) + 42, x = (int) (w + 10 - (bw + 18) * t), y = 34 + bob;
		Ui.cloud(c, x + 4, y - 6, 22, 0xF0FFFFFF);
		c.fill(x, y, x + bw, y + 26, 0xE6F4F9FF); c.fill(x, y + 25, x + bw, y + 26, Theme.accent | 0xFF000000);
		Ui.txt(c, "☁", x + 8, y + 9, Theme.accent | 0xFF000000);
		c.drawText(mc.textRenderer, Ui.t(l1), x + 24, y + 4, 0xFF1B2236, false); c.drawText(mc.textRenderer, Ui.t(l2), x + 24, y + 14, 0xFF5A6A88, false);
	}

	public static void openMail(MinecraftClient mc) { unread = 0; mc.setScreen(new PostScreen()); }

	// ---- Profilkarte: Spieler im Blick (bis 40 Bloecke) ----
	public static String lookedAt(MinecraftClient mc) {
		if (mc.player == null || mc.world == null) return null;
		if (mc.targetedEntity instanceof AbstractClientPlayerEntity p) return p.getName().getString();
		Vec3d eye = mc.player.getEyePos(), look = mc.player.getRotationVec(1f); String best = null; double bestA = Math.toRadians(7);
		for (AbstractClientPlayerEntity p : mc.world.getPlayers()) {
			if (p == mc.player || p.isInvisible()) continue;
			Vec3d d = p.getPos().add(0, p.getHeight() * 0.6, 0).subtract(eye); double len = d.length(); if (len > 40 || len < 0.1) continue;
			double a = Math.acos(Math.max(-1, Math.min(1, d.normalize().dotProduct(look)))); if (a < bestA) { bestA = a; best = p.getName().getString(); }
		}
		return best;
	}

	// ---- Befehle ----
	public static void init() {
		ClientCommandRegistrationCallback.EVENT.register((d, reg) -> {
			d.register(ClientCommandManager.literal("pc").then(ClientCommandManager.argument("text", StringArgumentType.greedyString()).executes(ctx -> {
				String t = StringArgumentType.getString(ctx, "text"); JsonObject a = new JsonObject(); a.addProperty("text", t);
				rpc("partyMsg", a, r -> { if (!r.has("ok") || !r.get("ok").getAsBoolean()) err(r); }); return Command.SINGLE_SUCCESS; })));
			d.register(ClientCommandManager.literal("party")
				.executes(ctx -> { if (partyMembers.isEmpty()) say(Text.literal("You are not in a party. Invite friends with /party invite <name> or in the launcher (Friends).").formatted(Formatting.GRAY)); else say(Text.literal("Party (" + partyMembers.size() + "/8): ").formatted(Formatting.LIGHT_PURPLE).append(Text.literal(String.join(", ", partyMembers) + "  - leader: " + partyLeader).formatted(Formatting.WHITE))); return Command.SINGLE_SUCCESS; })
				.then(ClientCommandManager.literal("invite").then(ClientCommandManager.argument("name", StringArgumentType.word()).executes(ctx -> { invite(StringArgumentType.getString(ctx, "name")); return Command.SINGLE_SUCCESS; })))
				.then(ClientCommandManager.literal("leave").executes(ctx -> { rpc("partyLeave", null, r -> { if (r.has("ok") && r.get("ok").getAsBoolean()) say(Text.literal("You left the party.").formatted(Formatting.GRAY)); else err(r); }); return Command.SINGLE_SUCCESS; }))
				.then(ClientCommandManager.literal("chat").then(ClientCommandManager.argument("text", StringArgumentType.greedyString()).executes(ctx -> { JsonObject a = new JsonObject(); a.addProperty("text", StringArgumentType.getString(ctx, "text")); rpc("partyMsg", a, r -> { if (!r.has("ok") || !r.get("ok").getAsBoolean()) err(r); }); return Command.SINGLE_SUCCESS; }))));
			d.register(ClientCommandManager.literal("post")
				.executes(ctx -> { MinecraftClient mc = MinecraftClient.getInstance(); mc.send(() -> openMail(mc)); return Command.SINGLE_SUCCESS; })
				.then(ClientCommandManager.argument("name", StringArgumentType.word()).then(ClientCommandManager.argument("text", StringArgumentType.greedyString()).executes(ctx -> {
					String n = StringArgumentType.getString(ctx, "name"); JsonObject a = new JsonObject(); a.addProperty("name", n); a.addProperty("text", StringArgumentType.getString(ctx, "text"));
					rpc("post", a, r -> { if (r.has("ok") && r.get("ok").getAsBoolean()) say(Text.literal("☁ Cloud mail to " + n + " is on its way.").formatted(Formatting.AQUA)); else err(r); }); return Command.SINGLE_SUCCESS; }))));
			d.register(ClientCommandManager.literal("song").then(ClientCommandManager.argument("name", StringArgumentType.word()).executes(ctx -> {
				String n = StringArgumentType.getString(ctx, "name"); String[] s = songs.get(n.toLowerCase());
				if (s == null) say(Text.literal(n + " is not sharing a song right now.").formatted(Formatting.GRAY)); else openSong(s);
				return Command.SINGLE_SUCCESS; })));
			d.register(ClientCommandManager.literal("cprofile").then(ClientCommandManager.argument("name", StringArgumentType.word()).executes(ctx -> { String n = StringArgumentType.getString(ctx, "name"); MinecraftClient mc = MinecraftClient.getInstance(); mc.send(() -> mc.setScreen(new ProfileScreen(n))); return Command.SINGLE_SUCCESS; })));
		});
		net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback.EVENT.register((c, tc) -> { try { hud(c); } catch (Throwable ignored) {} });
	}

	public static void invite(String n) { JsonObject a = new JsonObject(); a.addProperty("name", n); rpc("partyInvite", a, r -> { if (r.has("ok") && r.get("ok").getAsBoolean()) say(Text.literal("Party invite sent to " + n + ".").formatted(Formatting.LIGHT_PURPLE)); else err(r); }); }

	/** Spotify-Suche nach Titel + Kuenstler (der Launcher kennt keine Track-ID; echtes Mithören erlaubt Spotify fuer Apps wie Cloudy nicht). */
	public static void openSong(String[] s) {
		try {
			String q = java.net.URLEncoder.encode((s[0] + " " + s[1]).trim(), java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
			net.minecraft.util.Util.getOperatingSystem().open(java.net.URI.create("https://open.spotify.com/search/" + q));
			say(Text.literal("♫ Opening \"" + s[0] + "\" in Spotify ...").formatted(Formatting.GREEN));
		} catch (Throwable t) { say(Text.literal("Could not open Spotify.").formatted(Formatting.RED)); }
	}

	static Text mailHint(String from) { return click("[Reply]", "/post " + from + " ", "Answer with cloud mail", Formatting.AQUA); }
}
