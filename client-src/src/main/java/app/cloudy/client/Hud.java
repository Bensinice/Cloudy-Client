package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayNetworkHandler;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** HUD: Chips oben mittig (umbrechend), Keystrokes links, Ruestung. Alles skaliert mit der HUD-Groesse aus Cloudy Mods. */
public final class Hud {
	private static final int BLUE = 0xFF8CCBFF;
	private static final List<String> cache = new ArrayList<>();
	private static long cacheT;
	private static final ArrayDeque<Long> clicks0 = new ArrayDeque<>(), clicks1 = new ArrayDeque<>();
	private static boolean d0, d1;

	/** Zaehlt Mausklicks fuer die CPS-Anzeige (per GLFW-Abfrage, ohne Mixin). */
	public static void pollClicks(MinecraftClient mc) {
		try {
			long h = mc.getWindow().getHandle();
			boolean a = org.lwjgl.glfw.GLFW.glfwGetMouseButton(h, 0) == 1, b = org.lwjgl.glfw.GLFW.glfwGetMouseButton(h, 1) == 1;
			long now = System.currentTimeMillis();
			if (a && !d0 && mc.currentScreen == null) clicks0.add(now);
			if (b && !d1 && mc.currentScreen == null) clicks1.add(now);
			d0 = a; d1 = b;
			while (!clicks0.isEmpty() && now - clicks0.peekFirst() > 1000) clicks0.pollFirst();
			while (!clicks1.isEmpty() && now - clicks1.peekFirst() > 1000) clicks1.pollFirst();
		} catch (Throwable ignored) {}
	}

	/** Widget-IDs, die frei verschoben werden koennen (HUD-Eintraege aus Cloudy Mods). */
	public static final String[] MOVABLE = {"fps", "ping", "coords", "dir", "cps", "speed", "clock", "memory", "totem", "keys", "armor", "lyricscard", "biome", "light", "nether", "day", "durability", "arrows", "potions", "held", "server", "session", "effects", "death", "food", "health", "target"};

	/** Beispieltext fuer den Editor (ohne Welt). */
	public static String sample(String id) {
		return switch (id) {
			case "fps" -> "144 FPS"; case "ping" -> "Ping: 23 ms"; case "coords" -> "XYZ 128 / 64 / -32"; case "dir" -> "NE 212\u00b0";
			case "cps" -> "4 | 2 CPS"; case "speed" -> "4.3 b/s"; case "clock" -> "21:30"; case "memory" -> "812 MB"; case "totem" -> "Totems: 3"; case "lyricscard" -> "Song"; default -> Extras.is(id) ? Extras.sample(id) : id;
		};
	}

	/** Groesse eines Widgets in GUI-Pixeln bei Faktor 1. */
	public static int[] size(String id, String t) {
		return switch (id) { case "keys" -> new int[]{58, 58}; case "armor" -> new int[]{46, 70}; case "lyricscard" -> new int[]{170, 76}; default -> new int[]{Ui.w(t) + 10, 14}; };
	}

	/** Zeichnet ein Widget an (x, y) in Fensterpixeln mit Faktor s. preview: Beispieldaten statt Spielerdaten. */
	public static void drawWidget(DrawContext c, MinecraftClient mc, String id, String t, float x, float y, float s, boolean preview) {
		var ms = c.getMatrices();
		ms.push();
		ms.translate(x, y, 0);
		ms.scale(s, s, 1f);
		switch (id) {
			case "keys" -> keys(c, mc, 0, 0);
			case "armor" -> armor(c, mc, 0, 0, preview);
			case "lyricscard" -> Lyrics.cardWidget(c, mc, preview);
			default -> chip(c, mc, t, 0, 0);
		}
		ms.pop();
	}

	public static void render(DrawContext c, RenderTickCounter tick) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || mc.options.hudHidden) return;
		Theme.load();
		float s = ModConfig.scale;
		var ms = c.getMatrices();
		int ww = c.getScaledWindowWidth(), wh = c.getScaledWindowHeight();
		List<String> chips = new ArrayList<>();
		for (ModConfig.Def d : ModConfig.DEFS) {
			if (!d.cat().equals("HUD") || !ModConfig.isOn(d.id())) continue;
			String id = d.id();
			float[] p = ModConfig.pos.get(id);
			if (id.equals("lyricscard")) { float z = s * (p != null ? p[2] : 1f); int[] bs = size(id, ""); drawWidget(c, mc, id, null, p != null ? clampPos(p[0] * ww, bs[0] * z, ww) : ww - bs[0] * z - 8, p != null ? clampPos(p[1] * wh, bs[1] * z, wh) : Math.max(8, wh / 8), z, false); continue; }
			if (p != null && !id.equals("armor") && !id.equals("keys")) { String t = text(id, mc); if (t != null) { float z = s * p[2]; int[] bs = size(id, t); drawWidget(c, mc, id, t, clampPos(p[0] * ww, bs[0] * z, ww), clampPos(p[1] * wh, bs[1] * z, wh), z, false); } continue; }
			if (p != null) { float z = s * p[2]; int[] bs = size(id, ""); drawWidget(c, mc, id, null, clampPos(p[0] * ww, bs[0] * z, ww), clampPos(p[1] * wh, bs[1] * z, wh), z, false); continue; }
			String t = text(id, mc); if (t != null) chips.add(t);
		}
		ms.push();
		ms.scale(s, s, 1f);
		int sw = (int) (ww / s), sh = (int) (wh / s);
		long now = System.currentTimeMillis();
		if (now - cacheT > 250 || cache.size() != Theme.widgets.size()) { // Platzhalter nur 4x pro Sekunde neu berechnen
			cache.clear();
			for (String w : Theme.widgets) cache.add(fill(w, mc));
			cacheT = now;
		}
		chips.addAll(cache);
		int y = 4;
		if (!chips.isEmpty()) y = chips(c, mc, chips, sw, ModConfig.top) + 4;
		if (ModConfig.isOn("armor") && !ModConfig.pos.containsKey("armor")) armor(c, mc, 6, ModConfig.top ? y : 20, false);
		if (ModConfig.isOn("keys") && !ModConfig.pos.containsKey("keys")) keys(c, mc, 8, sh / 2 - 22);
		ms.pop();
		try { Lyrics.render(c, mc); } catch (Throwable ignored) {}
		if (CloudyClient.CHEATS) { // Anzeigeliste wie bei Meteor
			int yy = 6, w = c.getScaledWindowWidth();
			for (Module m : Modules.all) {
				if (!m.enabled) continue;
				Ui.txt(c, m.name, w - Ui.w(m.name) - 6, yy, BLUE);
				yy += 11;
			}
		}
	}

	/** Haelt ein Widget im Bild, auch wenn sein Text im Spiel laenger ist als im Editor (z. B. grosse Koordinaten). */
	private static float clampPos(float v, float size, int max) { return Math.max(0f, Math.min(v, Math.max(0f, max - size))); }

	private static String text(String id, MinecraftClient mc) {
		switch (id) {
			case "fps": return mc.getCurrentFps() + " FPS";
			case "ping": return ping(mc);
			case "coords": return String.format("XYZ %.0f / %.0f / %.0f", mc.player.getX(), mc.player.getY(), mc.player.getZ());
			case "dir": {
				float yaw = ((mc.player.getYaw() % 360) + 360) % 360;
				String[] n = {"S", "SW", "W", "NW", "N", "NE", "E", "SE"};
				return n[(int) ((yaw + 22.5f) / 45f) % 8] + " " + (int) yaw + "°";
			}
			case "cps": return clicks0.size() + " | " + clicks1.size() + " CPS";
			case "speed": { var v = mc.player.getVelocity(); return String.format("%.1f b/s", Math.sqrt(v.x * v.x + v.z * v.z) * 20); }
			case "clock": { java.time.LocalTime t = java.time.LocalTime.now(); return String.format("%02d:%02d", t.getHour(), t.getMinute()); }
			case "totem": { int n = 0; var inv = mc.player.getInventory(); for (int i = 0; i < inv.size(); i++) { var st = inv.getStack(i); if (st.isOf(net.minecraft.item.Items.TOTEM_OF_UNDYING)) n += st.getCount(); } return "Totems: " + n; }
			case "memory": { Runtime r = Runtime.getRuntime(); return ((r.totalMemory() - r.freeMemory()) >> 20) + " MB"; }
			default: return Extras.is(id) ? Extras.text(id, mc) : null;
		}
	}

	/** Eine einzelne Chip-Zeile (auch fuer die Vorschau in Cloudy Mods). */
	public static void chip(DrawContext c, MinecraftClient mc, String t, int x, int y) {
		int w = Ui.w(t) + 10;
		c.fill(x, y, x + w, y + 14, 0xAA0B1226);
		boolean none = t.equals("Totems: 0");
		c.fill(x, y + 12, x + w, y + 14, none ? 0xFFFF5A5A : Theme.accent);
		Ui.txt(c, t, x + 5, y + 3, none ? 0xFFFFB0B0 : 0xFFFFFFFF);
	}

	/** Kleine Vorschau der Chips in Cloudy Mods (zeigt die Skalierung live). */
	public static void preview(DrawContext c, int x, int y) {
		MinecraftClient mc = MinecraftClient.getInstance();
		var ms = c.getMatrices();
		ms.push();
		ms.translate(x, y, 0);
		ms.scale(ModConfig.scale, ModConfig.scale, 1f);
		int x0 = 0;
		for (String t : new String[]{"144 FPS", "Ping: 23 ms", "NE 212\u00b0"}) { chip(c, mc, t, x0, 0); x0 += Ui.w(t) + 14; }
		ms.pop();
	}

	/** Zeichnet die Chips (oben mittig oder links oben) und gibt die untere Kante zurueck. */
	private static int chips(DrawContext c, MinecraftClient mc, List<String> chips, int sw, boolean center) {
		int maxW = Math.max(60, sw - 12), pad = 5, gap = 3, h = 14;
		List<List<String>> rows = new ArrayList<>();
		List<String> cur = new ArrayList<>();
		int cw = 0;
		for (String t : chips) {
			int w = Ui.w(t) + pad * 2;
			if (!cur.isEmpty() && cw + gap + w > maxW) { rows.add(cur); cur = new ArrayList<>(); cw = 0; }
			cur.add(t); cw += (cur.size() > 1 ? gap : 0) + w;
		}
		if (!cur.isEmpty()) rows.add(cur);
		int y = 4;
		for (List<String> row : rows) {
			int total = -gap;
			for (String t : row) total += Ui.w(t) + pad * 2 + gap;
			int x = center ? (sw - total) / 2 : 6;
			for (String t : row) { chip(c, mc, t, x, y); x += Ui.w(t) + pad * 2 + gap; }
			y += h + gap;
		}
		return y;
	}

	/** WASD und Maustasten wie bei Lunar. */
	private static void keys(DrawContext c, MinecraftClient mc, int x, int y) {
		var o = mc.options;
		key(c, mc, "W", x + 20, y, 18, o.forwardKey.isPressed());
		key(c, mc, "A", x, y + 20, 18, o.leftKey.isPressed());
		key(c, mc, "S", x + 20, y + 20, 18, o.backKey.isPressed());
		key(c, mc, "D", x + 40, y + 20, 18, o.rightKey.isPressed());
		key(c, mc, "LMB", x, y + 40, 28, o.attackKey.isPressed());
		key(c, mc, "RMB", x + 30, y + 40, 28, o.useKey.isPressed());
	}

	private static void key(DrawContext c, MinecraftClient mc, String t, int x, int y, int w, boolean down) {
		c.fill(x, y, x + w, y + 18, down ? 0xDDFFFFFF : 0xAA0B1226);
		if (!down) c.fill(x, y + 16, x + w, y + 18, Theme.accent);
		Ui.ctr(c, t, x + w / 2, y + 5, down ? 0xFF0B1226 : 0xFFFFFFFF);
	}

	private static String fill(String t, MinecraftClient mc) {
		String ps = pingNum(mc);
		java.time.LocalTime now = java.time.LocalTime.now();
		return t.replace("{fps}", String.valueOf(mc.getCurrentFps())).replace("{ping}", ps)
			.replace("{x}", String.valueOf((int) Math.floor(mc.player.getX()))).replace("{y}", String.valueOf((int) Math.floor(mc.player.getY()))).replace("{z}", String.valueOf((int) Math.floor(mc.player.getZ())))
			.replace("{time}", String.format("%02d:%02d", now.getHour(), now.getMinute())).replace("{player}", mc.player.getName().getString());
	}

	private static String pingNum(MinecraftClient mc) {
		if (mc.isInSingleplayer()) return "0";
		ClientPlayNetworkHandler h = mc.getNetworkHandler();
		PlayerListEntry e = h == null ? null : h.getPlayerListEntry(mc.player.getUuid());
		return e == null ? "-" : String.valueOf(e.getLatency());
	}

	private static String ping(MinecraftClient mc) {
		if (mc.isInSingleplayer()) return "Ping: local";
		String p = pingNum(mc);
		return p.equals("-") ? "Ping: -" : "Ping: " + p + " ms";
	}

	/** Ruestungsteile mit Haltbarkeit untereinander. */
	private static void armor(DrawContext c, MinecraftClient mc, int x, int y, boolean preview) {
		if (preview) {
			net.minecraft.item.Item[] it = {net.minecraft.item.Items.DIAMOND_HELMET, net.minecraft.item.Items.DIAMOND_CHESTPLATE, net.minecraft.item.Items.DIAMOND_LEGGINGS, net.minecraft.item.Items.DIAMOND_BOOTS};
			for (net.minecraft.item.Item i : it) { c.drawItem(new ItemStack(i), x, y); Ui.txt(c, "363", x + 20, y + 4, BLUE); y += 18; }
			return;
		}
		EquipmentSlot[] slots = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
		for (EquipmentSlot s : slots) {
			ItemStack st = mc.player.getEquippedStack(s);
			if (st.isEmpty()) continue;
			c.drawItem(st, x, y);
			if (st.isDamageable()) {
				int left = st.getMaxDamage() - st.getDamage();
				Ui.txt(c, String.valueOf(left), x + 20, y + 4, BLUE);
			}
			y += 18;
		}
	}
}
