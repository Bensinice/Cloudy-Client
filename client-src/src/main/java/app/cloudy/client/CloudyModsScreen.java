package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;

/** Cloudy Mods im Lunar-Stil: durchsichtiges Glas ueber dem Spiel, Karten mit OPTIONS und ENABLED/DISABLED, Filter, Suche, Einstellungen. */
public class CloudyModsScreen extends Screen {
	private static final int ON = 0xFF2E9E62, OFF = 0xFFB8304C;
	private record Hit(int x, int y, int w, int h, Runnable run) {}
	private static int tab = 0;
	private static String filter = "ALL";
	private final List<Hit> hits = new ArrayList<>(), mhits = new ArrayList<>();
	private final Screen parent;
	private String query = "", optId;
	private boolean focus, wasDown;
	private float uiF = 1f;
	private String bindId = null, bindMsg = "";
	private int sliding, scroll, maxScroll, pickT = -1;
	private float ph0, ps0, pv0;
	private int px, py, pw, ph;

	public CloudyModsScreen(Screen parent) {
		super(Text.literal("Cloudy Mods"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		pw = Math.min(this.width - 16, 640); ph = Math.min(this.height - 16, 340);
		px = (this.width - pw) / 2; py = (this.height - ph) / 2;
	}

	@Override
	public void renderBackground(DrawContext c, int mx, int my, float delta) {
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, MinecraftClient.getInstance().world == null ? 0x55000000 : 0x77050A16);
	}

	private static String abbr(String id) {
		return switch (id) {
			case "fps" -> "FPS"; case "ping" -> "PING"; case "coords" -> "XYZ"; case "dir" -> "DIR"; case "cps" -> "CPS"; case "keys" -> "KEYS";
			case "armor" -> "ARMOR"; case "speed" -> "SPEED"; case "clock" -> "TIME"; case "memory" -> "RAM"; case "sprint" -> "SPRINT";
			case "zoom" -> "ZOOM"; case "totem" -> "TOTEM"; case "hotbar" -> "BAR"; case "sky" -> "SKY"; case "freelook" -> "LOOK"; case "freecam" -> "CAM"; case "lyrics" -> "LYRICS"; case "fullbright" -> "LIGHT"; default -> id.toUpperCase();
		};
	}

	private static boolean hasOptions(ModConfig.Def d) { return d.cat().equals("HUD") || d.id().equals("lyrics") || d.id().equals("sky") || d.id().equals("hotbar") || d.id().equals("wingadj") || d.id().equals("crosshair"); }

	private void pill(DrawContext c, int mx, int my, int x, int y, int w, int h, String label, boolean on, Runnable run) {
		boolean hv = Ui.in(mx, my, x, y, w, h) && optId == null;
		c.fill(x, y, x + w, y + h, on ? Ui.mix(0xFF1B2A55, Theme.accent, 0.7f) : hv ? 0xAA3A4A78 : 0x88202C4C);
		c.fill(x, y + h - 1, x + w, y + h, on ? 0xFFFFFFFF & Theme.accent : 0x33FFFFFF);
		Ui.sp(c, label, x + w / 2, y + (h - 8) / 2, on ? 0xFFFFFFFF : 0xFFB8C6E8);
		hits.add(new Hit(x, y, w, h, run));
	}

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load();
		ModConfig.load();
		hits.clear(); mhits.clear();
		c.fill(px, py, px + pw, py + ph, 0x88070D1C);
		c.fill(px, py, px + pw, py + 1, 0x55FFFFFF);
		c.fill(px, py + ph - 1, px + pw, py + ph, 0x33FFFFFF);
		c.fill(px, py, px + 1, py + ph, 0x33FFFFFF);
		c.fill(px + pw - 1, py, px + pw, py + ph, 0x33FFFFFF);
		Ui.txt(c, "CLOUDY", px + 12, py + 11, Theme.accent);
		Ui.txt(c, "MODS", px + 12 + Ui.w("CLOUDY") + 6, py + 11, 0xFFFFFFFF);
		{ // Anzeige, ob der Client zur Launcher-Version passt (zeigt sofort, ob ein Update im Spiel angekommen ist)
			String lv = System.getProperty("cloudy.ver", "");
			boolean okv = !lv.isEmpty() && CloudyModsScreen.class.getResource("/cloudy-cos/build-" + lv + ".txt") != null;
			String t = lv.isEmpty() ? "client build unknown" : okv ? "client " + lv + " \u2713" : "client OUTDATED (launcher " + lv + ")";
			Ui.txt(c, t, px + 12, py + 24, okv ? 0xFF7FE3A8 : 0xFFFF8A8A);
		}
		if (optId != null) { // Solange ein Optionsfenster offen ist, wird dahinter nichts gezeichnet - so kann kein Text durchscheinen
			c.fill(px, py + 30, px + pw, py + ph, 0xFF0B1226);
			uiF = Math.min(1f, (this.height - 4) / 300f); // kleine Fenster / grosse GUI-Skalierung: Optionsfenster passend verkleinern
			int smx = Math.round(mx / uiF), smy = Math.round(my / uiF);
			c.getMatrices().push(); c.getMatrices().scale(uiF, uiF, 1f);
			modal(c, smx, smy);
			c.getMatrices().pop();
			poll(smx, smy);
			return;
		}
		int tw = 84, tx = px + pw / 2 - tw - 3;
		tx -= 40;
		pill(c, mx, my, tx, py + 6, tw, 20, "MODS", tab == 0, () -> { tab = 0; bindId = null; });
		pill(c, mx, my, tx + tw + 6, py + 6, tw, 20, "HOTKEYS", tab == 2, () -> tab = 2);
		pill(c, mx, my, tx + 2 * (tw + 6), py + 6, tw + 12, 20, "SETTINGS", tab == 1, () -> { tab = 1; bindId = null; });
		boolean hx = Ui.in(mx, my, px + pw - 28, py + 6, 20, 20) && optId == null;
		c.fill(px + pw - 28, py + 6, px + pw - 8, py + 26, hx ? 0xCCB8304C : 0x88202C4C);
		Ui.ctr(c, "x", px + pw - 18, py + 12, 0xFFFFFFFF);
		hits.add(new Hit(px + pw - 28, py + 6, 20, 20, this::close));
		if (tab == 0) mods(c, mx, my); else if (tab == 2) hotkeys(c, mx, my); else settings(c, mx, my);
		// unten links: HUD-Layout
		int ly = py + ph - 26;
		boolean hl = Ui.in(mx, my, px + 10, ly, 120, 18) && optId == null;
		c.fill(px + 10, ly, px + 130, ly + 18, hl ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Ui.mix(0xFF1B2A55, Theme.accent, 0.8f));
		Ui.sp(c, "EDIT HUD LAYOUT", px + 70, ly + 5, 0xFFFFFFFF);
		hits.add(new Hit(px + 10, ly, 120, 18, () -> { if (this.client != null) this.client.setScreen(new HudEditorScreen(this)); }));
		for (int si = 0; si < 2; si++) { // Stores im Spiel (optionale Klassen, daher per Reflection)
			int sx2 = px + 138 + si * 100; final String ty = si == 0 ? "resourcepack" : "shader";
			boolean hs = Ui.in(mx, my, sx2, ly, 94, 18) && optId == null;
			c.fill(sx2, ly, sx2 + 94, ly + 18, hs ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Ui.mix(0xFF1B2A55, Theme.accent, 0.5f));
			Ui.sp(c, si == 0 ? "PACK STORE" : "SHADER STORE", sx2 + 47, ly + 5, 0xFFFFFFFF);
			hits.add(new Hit(sx2, ly, 94, 18, () -> openStore(ty)));
		}
		poll(mx, my);
	}

	private void openStore(String type) {
		try { Class.forName("app.cloudy.client.opt.StoreScreen").getMethod("open", String.class, Screen.class).invoke(null, type, this); }
		catch (Throwable t) { bindMsg = ""; if (this.client != null && this.client.player != null) this.client.player.sendMessage(Text.literal("The store is not available in this Minecraft version."), false); }
	}

	private void mods(DrawContext c, int mx, int my) {
		int fy = py + 34, fx = px + 12;
		for (String f : new String[]{"ALL", "HUD", "QoL"}) {
			int w = f.equals("ALL") ? 44 : 52; final String ff = f;
			pill(c, mx, my, fx, fy, w, 20, f.toUpperCase(), filter.equals(f), () -> { filter = ff; scroll = 0; });
			fx += w + 6;
		}
		int sw = Math.min(170, pw / 3), sx = px + pw - 12 - sw;
		c.fill(sx, fy, sx + sw, fy + 20, focus ? 0xAA25335C : 0x88202C4C);
		c.fill(sx, fy + 19, sx + sw, fy + 20, focus ? Theme.accent : 0x33FFFFFF);
		Ui.txt(c, query.isEmpty() && !focus ? "Search..." : query + (focus && System.currentTimeMillis() / 500 % 2 == 0 ? "_" : ""), sx + 8, fy + 6, query.isEmpty() ? 0xFF7F8CB0 : 0xFFFFFFFF);
		hits.add(new Hit(sx, fy, sw, 20, () -> focus = true));
		// Karten
		int ax = px + 12, ay = py + 62, aw = pw - 24, ah = ph - 62 - 34, gap = 8;
		int cols = Math.max(1, (aw + gap) / 150), cw = (aw - (cols - 1) * gap) / cols, ch = 100;
		List<ModConfig.Def> list = new ArrayList<>();
		for (ModConfig.Def d : ModConfig.DEFS) if ((filter.equals("ALL") || d.cat().equals(filter)) && d.name().toLowerCase().contains(query.toLowerCase())) list.add(d);
		list.sort((a, b) -> Boolean.compare(ModConfig.favs.contains(b.id()), ModConfig.favs.contains(a.id()))); // Favoriten (Stern) immer oben
		int rows = (list.size() + cols - 1) / cols, total = rows * (ch + gap) - gap;
		maxScroll = Math.max(0, total - ah);
		scroll = Math.max(0, Math.min(scroll, maxScroll));
		c.enableScissor(ax, ay, ax + aw, ay + ah);
		for (int i = 0; i < list.size(); i++) {
			ModConfig.Def d = list.get(i);
			int x = ax + (i % cols) * (cw + gap), y = ay + (i / cols) * (ch + gap) - scroll;
			if (y + ch < ay || y > ay + ah) continue;
			boolean on = ModConfig.isOn(d.id()), hv = Ui.in(mx, my, x, y, cw, ch) && my >= ay && my < ay + ah && optId == null;
			c.fill(x, y, x + cw, y + ch, hv ? 0x88283760 : 0x66141E3A);
			c.fill(x, y, x + cw, y + 1, 0x33FFFFFF); c.fill(x, y + ch - 1, x + cw, y + ch, 0x22FFFFFF); c.fill(x, y, x + 1, y + ch, 0x22FFFFFF); c.fill(x + cw - 1, y, x + cw, y + ch, 0x22FFFFFF);
			var ms = c.getMatrices();
			ms.push(); ms.translate(x + cw / 2f, y + 14, 0); ms.scale(1.6f, 1.6f, 1f);
			Ui.ctr(c, abbr(d.id()), 0, 0, on ? 0xFFFFFFFF : 0xFF8794B8);
			ms.pop();
			Ui.ctr(c, d.name(), x + cw / 2, y + 40, on ? 0xFFEAF2FF : 0xFFA9B6D6);
			{ Integer hk = ModConfig.keys.get(d.id()); if (hk != null) Ui.txt(c, "[" + ModConfig.keyName(hk) + "]", x + 6, y + 6, 0xFF9FB6E8); }
			{ // Favoriten-Stern oben rechts
				boolean fav = ModConfig.favs.contains(d.id());
				int sx0 = x + cw - 16, sy0 = y + 4;
				boolean hs = Ui.in(mx, my, sx0 - 2, sy0 - 2, 16, 16) && my >= ay && my < ay + ah && optId == null;
				int sc0 = fav ? 0xFFFFD34D : hs ? 0xFFC8D4F0 : 0x668794B8;
				int[][] st = fav || true ? STAR : STAR;
				for (int r = 0; r < st.length; r++) for (int q = 0; q < st[r].length; q++) if (st[r][q] == 1) c.fill(sx0 + q, sy0 + r, sx0 + q + 1, sy0 + r + 1, sc0);
				final String fid = d.id();
				if (my >= ay && my < ay + ah) hits.add(0, new Hit(sx0 - 2, sy0 - 2, 16, 16, () -> ModConfig.toggleFav(fid)));
			}
			boolean opt = hasOptions(d);
			int by = y + ch - 20;
			c.fill(x + 1, by, x + cw - 1, y + ch - 1, Ui.mix(on ? ON : OFF, 0xFFFFFFFF, hv && my >= by ? 0.15f : 0f));
			Ui.sp(c, on ? "ENABLED" : "DISABLED", x + cw / 2, by + 6, 0xFFFFFFFF);
			final ModConfig.Def dd = d;
			if (my >= ay && my < ay + ah) hits.add(new Hit(x, by, cw, 20, () -> ModConfig.set(dd.id(), !ModConfig.isOn(dd.id()))));
			if (opt) {
				int oy = by - 22;
				boolean ho = Ui.in(mx, my, x + 1, oy, cw - 2, 20) && my >= ay && my < ay + ah && optId == null;
				c.fill(x + 1, oy, x + cw - 1, oy + 20, ho ? 0xAA3A4A78 : 0x77202C4C);
				c.fill(x + cw - 21, oy + 2, x + cw - 20, oy + 18, 0x22FFFFFF);
				Ui.sp(c, "OPTIONS", x + (cw - 20) / 2, oy + 6, 0xFFFFFFFF);
				for (int k = 0; k < 3; k++) { c.fill(x + cw - 17, oy + 6 + k * 4, x + cw - 4, oy + 7 + k * 4, 0xFFC8D4F0); c.fill(x + cw - 14 + k * 4, oy + 5 + k * 4, x + cw - 11 + k * 4, oy + 8 + k * 4, 0xFFFFFFFF); }
				if (my >= ay && my < ay + ah) hits.add(new Hit(x + 1, oy, cw - 2, 20, () -> { optId = dd.id(); if (!dd.id().equals("lyrics") && !dd.id().equals("sky") && !dd.id().equals("hotbar") && !dd.id().equals("wingadj") && !dd.id().equals("crosshair")) HudEditorScreen.ensureOne(dd.id(), this.width, this.height); }));
			}
		}
		c.disableScissor();
		if (list.isEmpty()) Ui.ctr(c, "No mods found", px + pw / 2, ay + 40, 0xFF8794B8);
	}

	/** Tastenkuerzel-Verwaltung: ein Klick, dann Taste druecken (Entf/Backspace = entfernen, Esc = abbrechen). */
	private void hotkeys(DrawContext c, int mx, int my) {
		int bx = px + 12, bw = pw - 24, y = py + 34 - scroll;
		Ui.txt(c, bindId == null ? (bindMsg.isEmpty() ? "Click a key field, then press the key. Delete = remove, Esc = cancel." : bindMsg) : "Press a key for " + bindId + " ...", bx, py + 34, bindId == null && !bindMsg.isEmpty() ? 0xFFFF8A8A : 0xFF8794B8);
		int top = py + 48, bottom = py + ph - 32, rowH = 24, n = ModConfig.DEFS.size();
		maxScroll = Math.max(0, n * rowH - (bottom - top));
		scroll = Math.max(0, Math.min(scroll, maxScroll));
		c.enableScissor(bx, top, bx + bw, bottom);
		int i = 0;
		for (ModConfig.Def d : ModConfig.DEFS) {
			int ry = top + i * rowH - scroll; i++;
			if (ry + rowH < top || ry > bottom) continue;
			boolean listen = d.id().equals(bindId), hv = Ui.in(mx, my, bx, ry, bw, rowH - 2) && my >= top && my < bottom;
			c.fill(bx, ry, bx + bw, ry + rowH - 2, hv ? 0x88283760 : 0x66141E3A);
			Ui.txt(c, d.name(), bx + 10, ry + 8, 0xFFFFFFFF);
			Integer k = ModConfig.keys.get(d.id());
			String v = listen ? "press a key..." : k == null ? "none" : ModConfig.keyName(k);
			int kw = Math.max(70, Ui.w(v) + 16), kx = bx + bw - kw - 6;
			c.fill(kx, ry + 3, kx + kw, ry + rowH - 5, listen ? Theme.accent : k == null ? 0x55202C4C : Ui.mix(0xFF1B2A55, Theme.accent, 0.6f));
			Ui.ctr(c, v, kx + kw / 2, ry + 8, listen ? 0xFF0B1226 : 0xFFFFFFFF);
			final String id = d.id();
			if (my >= top && my < bottom) hits.add(new Hit(bx, ry, bw, rowH - 2, () -> { bindId = id; bindMsg = ""; }));
		}
		c.disableScissor();
	}

	private void settings(DrawContext c, int mx, int my) {
		int bx = px + 12, by = py + 38, bw = pw - 24;
		c.fill(bx, by, bx + bw, by + 46, 0x66141E3A);
		Ui.txt(c, "HUD size (all widgets)", bx + 10, by + 7, 0xFFFFFFFF);
		String pct = Math.round(ModConfig.scale * 100) + "%";
		Ui.txt(c, pct, bx + bw - 10 - Ui.w(pct), by + 7, Theme.accent);
		slider(c, mx, bx + 10, by + 32, bw - 20, (ModConfig.scale - 0.5f) / 1.5f, 1);
		if (sliding == 1) ModConfig.scale = Math.round((0.5f + 1.5f * Math.max(0f, Math.min(1f, (mx - (bx + 10)) / (float) (bw - 20)))) * 20) / 20f;
		row(c, mx, my, bx, by + 52, bw, "HUD flow position", ModConfig.top ? "Top" : "Bottom", () -> { ModConfig.top = !ModConfig.top; ModConfig.save(); });
		row(c, mx, my, bx, by + 52 + 28, bw, "Cloudy menu style", ModConfig.menu ? "On" : "Off", () -> { ModConfig.menu = !ModConfig.menu; ModConfig.save(); });
		row(c, mx, my, bx, by + 52 + 56, bw, "Title screen background", ModConfig.BG_NAMES[ModConfig.bgStyle], () -> { ModConfig.bgStyle = 1 - ModConfig.bgStyle; ModConfig.save(); });
		Ui.txt(c, "Preview", bx, by + 52 + 90, 0xFF8794B8);
		Hud.preview(c, bx + 4, by + 52 + 104);
	}

	private void slider(DrawContext c, int mx, int x, int y, int w, float t, int id) {
		t = Math.max(0f, Math.min(1f, t));
		c.fill(x, y, x + w, y + 4, 0xFF39425F);
		c.fill(x, y, x + (int) (w * t), y + 4, Theme.accent);
		int kx = x + (int) (w * t);
		c.fill(kx - 3, y - 4, kx + 3, y + 8, 0xFFFFFFFF);
		(optId != null ? mhits : hits).add(new Hit(x - 4, y - 8, w + 8, 20, () -> sliding = id));
	}

	private void row(DrawContext c, int mx, int my, int bx, int y, int bw, String name, String val, Runnable run) {
		boolean hv = Ui.in(mx, my, bx, y, bw, 25) && optId == null;
		c.fill(bx, y, bx + bw, y + 25, hv ? 0x88283760 : 0x66141E3A);
		Ui.txt(c, name, bx + 10, y + 8, 0xFFFFFFFF);
		Ui.txt(c, val, bx + bw - 10 - Ui.w(val), y + 8, Theme.accent);
		hits.add(new Hit(bx, y, bw, 25, run));
	}

	private void modal(DrawContext c, int mx, int my) {
		c.fill(0, 0, (int) (this.width / uiF), (int) (this.height / uiF), 0x99081022);
		if (pickT >= 0) { pickerModal(c, mx, my); return; }
		if (optId.equals("lyrics")) { lyricsModal(c, mx, my); return; }
		if (optId.equals("sky")) { skyModal(c, mx, my); return; }
		if (optId.equals("hotbar")) { hotbarModal(c, mx, my); return; }
		if (optId.equals("crosshair")) { crossModal(c, mx, my); return; }
		if (optId.equals("wingadj")) { wingModal(c, mx, my); return; }
		ModConfig.Def d = null;
		for (ModConfig.Def q : ModConfig.DEFS) if (q.id().equals(optId)) d = q;
		float[] p = ModConfig.pos.get(optId);
		int w = 240, h = 128, x = (int) (this.width / uiF) / 2 - w / 2, y = (int) (this.height / uiF) / 2 - h / 2;
		shadow(c, x, y, w, h);
		c.fill(x, y, x + w, y + h, 0xFF0A1226);
		c.fill(x, y, x + w, y + 2, Theme.accent);
		Ui.txt(c, (d == null ? optId : d.name()) + " options", x + 12, y + 12, 0xFFFFFFFF);
		Ui.txt(c, "Size", x + 12, y + 34, 0xFFB8C6E8);
		String pct = p == null ? "-" : Math.round(p[2] * 100) + "%";
		Ui.txt(c, pct, x + w - 12 - Ui.w(pct), y + 34, Theme.accent);
		float t = p == null ? 0 : (p[2] - 0.5f) / 2.5f;
		slider(c, mx, x + 12, y + 54, w - 24, t, 2);
		if (sliding == 2 && p != null) { p[2] = Math.round((0.5f + 2.5f * Math.max(0f, Math.min(1f, (mx - (x + 12)) / (float) (w - 24)))) * 10) / 10f; }
		int by = y + h - 32, bw = (w - 24 - 12) / 3;
		String[] labels = {"MOVE", "RESET", "CLOSE"};
		Runnable[] runs = {() -> { optId = null; if (this.client != null) this.client.setScreen(new HudEditorScreen(this)); }, () -> { ModConfig.pos.remove(optId); ModConfig.save(); optId = null; }, () -> { optId = null; ModConfig.save(); }};
		for (int i = 0; i < 3; i++) {
			int bx = x + 12 + i * (bw + 6);
			boolean hv = Ui.in(mx, my, bx, by, bw, 20);
			c.fill(bx, by, bx + bw, by + 20, i == 2 ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : hv ? 0xE62A3558 : 0xCC1A2342);
			Ui.sp(c, labels[i], bx + bw / 2, by + 6, i == 2 ? 0xFF0B1226 : 0xFFFFFFFF);
			mhits.add(new Hit(bx, by, bw, 20, runs[i]));
		}
	}

	/** Weicher Schatten um ein Fenster, damit es sich klar vom Hintergrund abhebt. */
	private static void shadow(DrawContext c, int x, int y, int w, int h) {
		for (int i = 8; i >= 1; i--) c.fill(x - i * 2, y - i * 2, x + w + i * 2, y + h + i * 2, 0x10000000);
		c.fill(x - 1, y - 1, x + w + 1, y + h + 1, 0xAA000000 | (Theme.accent & 0xFFFFFF));
	}

	private void mrow(DrawContext c, int mx, int my, int x, int y, int w, String name, String val, int swatch, Runnable run) {
		boolean hv = Ui.in(mx, my, x, y, w, 20);
		c.fill(x, y, x + w, y + 20, hv ? 0xFF222E52 : 0xFF141D3A);
		Ui.txt(c, name, x + 8, y + 6, 0xFFFFFFFF);
		int vx = x + w - 8 - Ui.w(val);
		Ui.txt(c, val, vx, y + 6, Theme.accent);
		if (swatch != 0) c.fill(vx - 16, y + 5, vx - 6, y + 15, 0xFF000000 | swatch);
		c.fill(x + w - 3, y + 6, x + w - 2, y + 14, 0x33FFFFFF);
		mhits.add(new Hit(x, y, w, 20, run));
	}

	/** Stern 11x11 (Pixel). */
	private static final int[][] STAR = {
		{0,0,0,0,0,1,0,0,0,0,0},{0,0,0,0,0,1,0,0,0,0,0},{0,0,0,0,1,1,1,0,0,0,0},{0,0,0,0,1,1,1,0,0,0,0},
		{1,1,1,1,1,1,1,1,1,1,1},{0,1,1,1,1,1,1,1,1,1,0},{0,0,1,1,1,1,1,1,1,0,0},{0,0,0,1,1,1,1,1,0,0,0},
		{0,0,0,1,1,0,1,1,0,0,0},{0,0,1,1,0,0,0,1,1,0,0},{0,0,1,0,0,0,0,0,1,0,0}};
	private static int idxOf(int t) { return t == 0 ? ModConfig.lyricsCur : t == 1 ? ModConfig.lyricsOld : t == 2 ? ModConfig.skyCol : t == 3 ? ModConfig.cloudCol : t == 4 ? ModConfig.fogCol : t == 5 ? ModConfig.hbCol : t == 6 ? ModConfig.hbSel : t == 8 ? ModConfig.armCol : t == 9 ? ModConfig.foodCol : t == 10 ? ModConfig.crossCol : ModConfig.heartCol; }
	private static void setIdx(int t, int i) {
		if (t == 0) ModConfig.lyricsCur = i; else if (t == 1) ModConfig.lyricsOld = i; else if (t == 2) { ModConfig.skyCol = i; ModConfig.skySrc = 2; } else if (t == 3) { ModConfig.cloudCol = i; ModConfig.cloudMode = 2; } else if (t == 4) { ModConfig.fogCol = i; ModConfig.fogMode = 2; } else if (t == 5) { ModConfig.hbCol = i; ModConfig.hbStyle = 2; } else if (t == 6) ModConfig.hbSel = i; else if (t == 8) ModConfig.armCol = i; else if (t == 9) ModConfig.foodCol = i; else if (t == 10) ModConfig.crossCol = i; else { ModConfig.heartCol = i; ModConfig.heartMode = 2; }
	}

	private static int hsv(float h, float s, float v) {
		float r, g, b; h = (h - (float) Math.floor(h)) * 6f; int i = (int) h; float f = h - i, p = v * (1 - s), q = v * (1 - s * f), u = v * (1 - s * (1 - f));
		switch (i % 6) { case 0 -> { r = v; g = u; b = p; } case 1 -> { r = q; g = v; b = p; } case 2 -> { r = p; g = v; b = u; } case 3 -> { r = p; g = q; b = v; } case 4 -> { r = u; g = p; b = v; } default -> { r = v; g = p; b = q; } }
		return (int) (r * 255 + 0.5f) << 16 | (int) (g * 255 + 0.5f) << 8 | (int) (b * 255 + 0.5f);
	}

	private void openPick(int t) {
		pickT = t;
		int rgb = ModConfig.lcol(idxOf(t), t);
		float r = (rgb >> 16 & 255) / 255f, g = (rgb >> 8 & 255) / 255f, b = (rgb & 255) / 255f, mx = Math.max(r, Math.max(g, b)), mn = Math.min(r, Math.min(g, b)), d = mx - mn;
		pv0 = mx; ps0 = mx == 0 ? 0 : d / mx;
		float h = d == 0 ? ph0 : mx == r ? ((g - b) / d % 6) / 6f : mx == g ? ((b - r) / d + 2) / 6f : ((r - g) / d + 4) / 6f;
		ph0 = h < 0 ? h + 1 : h;
	}

	/** Farbwaehler: Voreinstellungen, Farbflaeche (Saettigung/Helligkeit), Farbbalken (Farbton), Hex-Anzeige. Jede Farbe moeglich. */
	private void pickerModal(DrawContext c, int mx, int my) {
		int w = 250, h = 190, x = (int) (this.width / uiF) / 2 - w / 2, y = Math.max(4, (int) (this.height / uiF) / 2 - h / 2);
		shadow(c, x, y, w, h);
		c.fill(x, y, x + w, y + h, 0xFF0A1226);
		c.fill(x, y, x + w, y + 2, Theme.accent);
		String[] names = {"Lyrics: current word", "Lyrics: already sung", "Sky color", "Cloud color", "Fog color", "Hotbar color", "Hotbar selection", "Heart color", "Armor color", "Food color", "Crosshair color"};
		Ui.txt(c, "Pick color - " + names[pickT], x + 12, y + 10, 0xFFFFFFFF);
		// Voreinstellungen
		int n = ModConfig.LCOL.length - 1, sx = x + 12, sw = (w - 24 - (n - 1) * 3) / n;
		for (int i = 0; i < n; i++) {
			int bx = sx + i * (sw + 3), col = 0xFF000000 | ModConfig.lcol(i, pickT);
			c.fill(bx - 1, y + 27, bx + sw + 1, y + 43, idxOf(pickT) == i ? 0xFFFFFFFF : 0x33FFFFFF);
			c.fill(bx, y + 28, bx + sw, y + 42, col);
			final int ii = i;
			mhits.add(new Hit(bx, y + 28, sw, 14, () -> { setIdx(pickT, ii); openPickKeep(); ModConfig.save(); }));
		}
		// Farbflaeche
		int fx = x + 12, fy = y + 52, fw = 150, fh = 100, cell = 5;
		for (int yy = 0; yy < fh; yy += cell) for (int xx = 0; xx < fw; xx += cell)
			c.fill(fx + xx, fy + yy, fx + xx + cell, fy + yy + cell, 0xFF000000 | hsv(ph0, (xx + cell / 2) / (float) fw, 1f - (yy + cell / 2) / (float) fh));
		int mkx = fx + (int) (ps0 * fw), mky = fy + (int) ((1 - pv0) * fh);
		c.fill(mkx - 4, mky - 1, mkx + 4, mky + 1, 0xFFFFFFFF); c.fill(mkx - 1, mky - 4, mkx + 1, mky + 4, 0xFFFFFFFF);
		c.fill(mkx - 3, mky, mkx + 3, mky + 0, 0xFF000000);
		// Farbbalken
		int bx = x + 12 + fw + 12, bw = 18;
		for (int yy = 0; yy < fh; yy += 4) c.fill(bx, fy + yy, bx + bw, fy + yy + 4, 0xFF000000 | hsv(yy / (float) fh, 1f, 1f));
		int hy = fy + (int) (ph0 * fh);
		c.fill(bx - 3, hy - 1, bx + bw + 3, hy + 2, 0xFFFFFFFF);
		// Vorschau + Hex
		int rgb = hsv(ph0, ps0, pv0);
		int px2 = bx + bw + 10;
		c.fill(px2, fy, px2 + 28, fy + 28, 0xFF000000 | ModConfig.lcol(idxOf(pickT), pickT));
		Ui.txt(c, String.format("#%06X", ModConfig.lcol(idxOf(pickT), pickT)), x + 12, fy + fh + 6, Theme.accent);
		mhits.add(new Hit(fx, fy, fw, fh, () -> sliding = 3));
		mhits.add(new Hit(bx - 3, fy, bw + 6, fh, () -> sliding = 4));
		if (sliding == 3) { ps0 = Math.max(0f, Math.min(1f, (mx - fx) / (float) fw)); pv0 = 1f - Math.max(0f, Math.min(1f, (my - fy) / (float) fh)); applyPick(); }
		if (sliding == 4) { ph0 = Math.max(0f, Math.min(0.999f, (my - fy) / (float) fh)); applyPick(); }
		int by = y + h - 28;
		boolean hv = Ui.in(mx, my, x + 12, by, w - 24, 20);
		c.fill(x + 12, by, x + w - 12, by + 20, hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent);
		Ui.sp(c, "DONE", x + w / 2, by + 6, 0xFF0B1226);
		mhits.add(new Hit(x + 12, by, w - 24, 20, () -> { pickT = -1; ModConfig.save(); }));
	}

	private void openPickKeep() { int t = pickT; openPick(t); }

	private void applyPick() {
		ModConfig.pick[pickT] = hsv(ph0, ps0, pv0);
		setIdx(pickT, ModConfig.LCOL.length - 1);
	}

	/** Optionen der eigenen Hotbar und Herzen. */
	private void hotbarModal(DrawContext c, int mx, int my) {
		int w = 300, rows = 7, h = 34 + rows * 23 + 28 + 34;
		int x = (int) (this.width / uiF) / 2 - w / 2, y = Math.max(4, (int) (this.height / uiF) / 2 - h / 2);
		shadow(c, x, y, w, h);
		c.fill(x, y, x + w, y + h, 0xFF0A1226);
		c.fill(x, y, x + w, y + 2, Theme.accent);
		Ui.txt(c, "Custom hotbar options", x + 12, y + 12, 0xFFFFFFFF);
		int rx = x + 10, rw = w - 20, ry = y + 30;
		mrow(c, mx, my, rx, ry, rw, "Hotbar style", ModConfig.HB_STYLE[ModConfig.hbStyle], 0, () -> { ModConfig.hbStyle = (ModConfig.hbStyle + 1) % ModConfig.HB_STYLE.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Hotbar color (custom style)", ModConfig.colName(ModConfig.hbCol, 5), ModConfig.lcol(ModConfig.hbCol, 5), () -> openPick(5)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Selected slot color", ModConfig.colName(ModConfig.hbSel, 6), ModConfig.lcol(ModConfig.hbSel, 6), () -> openPick(6)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Hearts", ModConfig.HEART_MODE[ModConfig.heartMode], 0, () -> { ModConfig.heartMode = (ModConfig.heartMode + 1) % ModConfig.HEART_MODE.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Heart color (custom)", ModConfig.colName(ModConfig.heartCol, 7), ModConfig.lcol(ModConfig.heartCol, 7), () -> openPick(7)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Armor bar color", ModConfig.colName(ModConfig.armCol, 8), ModConfig.lcol(ModConfig.armCol, 8), () -> openPick(8)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Food bar color", ModConfig.colName(ModConfig.foodCol, 9), ModConfig.lcol(ModConfig.foodCol, 9), () -> openPick(9)); ry += 23;
		c.fill(rx, ry + 2, rx + rw, ry + 24, 0xFF0E1630);
		Ui.txt(c, "Hearts, armor, food and air are redrawn. Vanilla with absorption or >20 HP.", rx + 8, ry + 9, 0xFF8794B8);
		int by = y + h - 28, bw = (w - 20 - 6) / 2;
		String[] labels = {"RESET", "CLOSE"};
		Runnable[] runs = {() -> ModConfig.hotbarReset(), () -> { optId = null; ModConfig.save(); }};
		for (int i = 0; i < 2; i++) {
			int bx = x + 10 + i * (bw + 6);
			boolean hv = Ui.in(mx, my, bx, by, bw, 20);
			c.fill(bx, by, bx + bw, by + 20, i == 1 ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : hv ? 0xFF2A3558 : 0xFF1A2342);
			Ui.sp(c, labels[i], bx + bw / 2, by + 6, i == 1 ? 0xFF0B1226 : 0xFFFFFFFF);
			mhits.add(new Hit(bx, by, bw, 20, runs[i]));
		}
	}

	private void stepRow(DrawContext c, int mx, int my, int x, int y, int w, String name, String val, Runnable minus, Runnable plus) {
		c.fill(x, y, x + w, y + 20, 0xFF141D3A);
		Ui.txt(c, name, x + 8, y + 6, 0xFFFFFFFF);
		int bw = 22, px = x + w - bw - 4, mxp = px - 62 - bw;
		boolean h1 = Ui.in(mx, my, mxp, y + 2, bw, 16), h2 = Ui.in(mx, my, px, y + 2, bw, 16);
		c.fill(mxp, y + 2, mxp + bw, y + 18, h1 ? 0xFF2A3558 : 0xFF1A2342); Ui.sp(c, "-", mxp + bw / 2, y + 6, 0xFFFFFFFF);
		c.fill(px, y + 2, px + bw, y + 18, h2 ? 0xFF2A3558 : 0xFF1A2342); Ui.sp(c, "+", px + bw / 2, y + 6, 0xFFFFFFFF);
		Ui.sp(c, val, mxp + bw + 31, y + 6, Theme.accent);
		mhits.add(new Hit(mxp, y + 2, bw, 16, minus)); mhits.add(new Hit(px, y + 2, bw, 16, plus));
	}

	private void crossModal(DrawContext c, int mx, int my) {
		int w = 300, rows = 7, h = 34 + rows * 23 + 40 + 34;
		int x = (int) (this.width / uiF) / 2 - w / 2, y = Math.max(4, (int) (this.height / uiF) / 2 - h / 2);
		shadow(c, x, y, w, h);
		c.fill(x, y, x + w, y + h, 0xFF0A1226);
		c.fill(x, y, x + w, y + 2, Theme.accent);
		Ui.txt(c, "Custom crosshair options", x + 12, y + 12, 0xFFFFFFFF);
		int rx = x + 10, rw = w - 20, ry = y + 30;
		mrow(c, mx, my, rx, ry, rw, "Style", Crosshair.STYLES[ModConfig.crossStyle], 0, () -> { ModConfig.crossStyle = (ModConfig.crossStyle + 1) % Crosshair.STYLES.length; ModConfig.save(); }); ry += 23;
		stepRow(c, mx, my, rx, ry, rw, "Size", String.valueOf(ModConfig.crossSize), () -> { ModConfig.crossSize = Math.max(2, ModConfig.crossSize - 1); ModConfig.save(); }, () -> { ModConfig.crossSize = Math.min(20, ModConfig.crossSize + 1); ModConfig.save(); }); ry += 23;
		stepRow(c, mx, my, rx, ry, rw, "Thickness", String.valueOf(ModConfig.crossThick), () -> { ModConfig.crossThick = Math.max(1, ModConfig.crossThick - 1); ModConfig.save(); }, () -> { ModConfig.crossThick = Math.min(4, ModConfig.crossThick + 1); ModConfig.save(); }); ry += 23;
		stepRow(c, mx, my, rx, ry, rw, "Gap", String.valueOf(ModConfig.crossGap), () -> { ModConfig.crossGap = Math.max(0, ModConfig.crossGap - 1); ModConfig.save(); }, () -> { ModConfig.crossGap = Math.min(12, ModConfig.crossGap + 1); ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Color", ModConfig.colName(ModConfig.crossCol, 10), ModConfig.lcol(ModConfig.crossCol, 10), () -> openPick(10)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Outline", ModConfig.crossOutline ? "ON" : "OFF", 0, () -> { ModConfig.crossOutline = !ModConfig.crossOutline; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Spread when moving", ModConfig.crossDyn ? "ON" : "OFF", 0, () -> { ModConfig.crossDyn = !ModConfig.crossDyn; ModConfig.save(); }); ry += 23;
		// Vorschau (gleiche Zeichenlogik wie im Spiel, hier mit festen Werten)
		c.fill(rx, ry + 2, rx + rw, ry + 38, 0xFF0E1630);
		int pcx = rx + rw / 2, pcy = ry + 20, col = 0xFF000000 | ModConfig.lcol(ModConfig.crossCol, 10);
		int g = ModConfig.crossGap, L = Math.min(ModConfig.crossSize, 12), t = ModConfig.crossThick;
		if (ModConfig.crossStyle == 2) c.fill(pcx, pcy, pcx + t, pcy + t, col);
		else { c.fill(pcx - g - L, pcy, pcx - g, pcy + t, col); c.fill(pcx + g, pcy, pcx + g + L, pcy + t, col); c.fill(pcx, pcy + g, pcx + t, pcy + g + L, col); if (ModConfig.crossStyle != 6) c.fill(pcx, pcy - g - L, pcx + t, pcy - g, col); }
		Ui.txt(c, "Preview (simple)", rx + 6, ry + 6, 0xFF8794B8); ry += 40;
		int by = y + h - 28, bw = (w - 20 - 6) / 2;
		String[] labels = {"RESET", "CLOSE"};
		Runnable[] runs = {() -> { ModConfig.crossStyle = 0; ModConfig.crossSize = 5; ModConfig.crossThick = 1; ModConfig.crossGap = 2; ModConfig.crossCol = 1; ModConfig.crossOutline = true; ModConfig.crossDyn = true; ModConfig.save(); }, () -> { optId = null; ModConfig.save(); }};
		for (int i = 0; i < 2; i++) {
			int bx = x + 10 + i * (bw + 6);
			boolean hv = Ui.in(mx, my, bx, by, bw, 20);
			c.fill(bx, by, bx + bw, by + 20, i == 1 ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : hv ? 0xFF2A3558 : 0xFF1A2342);
			Ui.sp(c, labels[i], bx + bw / 2, by + 6, i == 1 ? 0xFF0B1226 : 0xFFFFFFFF);
			mhits.add(new Hit(bx, by, bw, 20, runs[i]));
		}
	}

	/** Fluegel: Groesse und Hoehe. */
	private void wingModal(DrawContext c, int mx, int my) {
		int w = 300, h = 34 + 2 * 23 + 24 + 34;
		int x = (int) (this.width / uiF) / 2 - w / 2, y = Math.max(4, (int) (this.height / uiF) / 2 - h / 2);
		shadow(c, x, y, w, h);
		c.fill(x, y, x + w, y + h, 0xFF0A1226);
		c.fill(x, y, x + w, y + 2, Theme.accent);
		Ui.txt(c, "Wing size & height", x + 12, y + 12, 0xFFFFFFFF);
		int rx = x + 10, rw = w - 20, ry = y + 30;
		stepRow(c, mx, my, rx, ry, rw, "Size", ModConfig.wingSize + "%", () -> { ModConfig.wingSize = Math.max(40, ModConfig.wingSize - 10); ModConfig.save(); }, () -> { ModConfig.wingSize = Math.min(200, ModConfig.wingSize + 10); ModConfig.save(); }); ry += 23;
		stepRow(c, mx, my, rx, ry, rw, "Height", (ModConfig.wingY > 0 ? "+" : "") + ModConfig.wingY, () -> { ModConfig.wingY = Math.max(-25, ModConfig.wingY - 1); ModConfig.save(); }, () -> { ModConfig.wingY = Math.min(25, ModConfig.wingY + 1); ModConfig.save(); }); ry += 23;
		c.fill(rx, ry + 2, rx + rw, ry + 22, 0xFF0E1630);
		Ui.txt(c, "Plus = higher, minus = lower. Check it in Cosmetics or F5.", rx + 8, ry + 8, 0xFF8794B8);
		int by = y + h - 28, bw = (w - 20 - 6) / 2;
		String[] labels = {"RESET", "CLOSE"};
		Runnable[] runs = {() -> { ModConfig.wingSize = 100; ModConfig.wingY = 0; ModConfig.save(); }, () -> { optId = null; ModConfig.save(); }};
		for (int i = 0; i < 2; i++) {
			int bx = x + 10 + i * (bw + 6);
			boolean hv = Ui.in(mx, my, bx, by, bw, 20);
			c.fill(bx, by, bx + bw, by + 20, i == 1 ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : hv ? 0xFF2A3558 : 0xFF1A2342);
			Ui.sp(c, labels[i], bx + bw / 2, by + 6, i == 1 ? 0xFF0B1226 : 0xFFFFFFFF);
			mhits.add(new Hit(bx, by, bw, 20, runs[i]));
		}
	}

	/** Optionen des eigenen Himmels: Farbquelle, eigene Farbe, Staerke. */
	private void skyModal(DrawContext c, int mx, int my) {
		int w = 300, rows = 9, h = 34 + rows * 23 + 28 + 34;
		int x = (int) (this.width / uiF) / 2 - w / 2, y = Math.max(4, (int) (this.height / uiF) / 2 - h / 2);
		shadow(c, x, y, w, h);
		c.fill(x, y, x + w, y + h, 0xFF0A1226);
		c.fill(x, y, x + w, y + 2, Theme.accent);
		Ui.txt(c, "Custom sky options", x + 12, y + 12, 0xFFFFFFFF);
		int rx = x + 10, rw = w - 20, ry = y + 30;
		mrow(c, mx, my, rx, ry, rw, "Color source", ModConfig.SKY_SRC[ModConfig.skySrc], 0, () -> { ModConfig.skySrc = (ModConfig.skySrc + 1) % ModConfig.SKY_SRC.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, ModConfig.skySrc == 2 ? "Custom color" : "Custom color (source: custom)", ModConfig.colName(ModConfig.skyCol, 2), ModConfig.lcol(ModConfig.skyCol, 2), () -> openPick(2)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Strength", ModConfig.skyStr + "%", 0, () -> { ModConfig.skyStr -= 25; if (ModConfig.skyStr < 25) ModConfig.skyStr = 100; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Clouds", ModConfig.CLOUD_MODES[ModConfig.cloudMode], 0, () -> { ModConfig.cloudMode = (ModConfig.cloudMode + 1) % ModConfig.CLOUD_MODES.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Cloud color", ModConfig.colName(ModConfig.cloudCol, 3), ModConfig.lcol(ModConfig.cloudCol, 3), () -> openPick(3)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Fog", ModConfig.FOG_MODES[ModConfig.fogMode], 0, () -> { ModConfig.fogMode = (ModConfig.fogMode + 1) % ModConfig.FOG_MODES.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Fog color", ModConfig.colName(ModConfig.fogCol, 4), ModConfig.lcol(ModConfig.fogCol, 4), () -> openPick(4)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Fog distance", ModConfig.FOG_DIST[ModConfig.fogDist], 0, () -> { ModConfig.fogDist = (ModConfig.fogDist + 1) % ModConfig.FOG_DIST.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Pulse to song beat", ModConfig.BEAT[ModConfig.skyBeat], 0, () -> { ModConfig.skyBeat = (ModConfig.skyBeat + 1) % ModConfig.BEAT.length; ModConfig.save(); }); ry += 23;
		c.fill(rx, ry + 2, rx + rw, ry + 24, 0xFF0E1630);
		Ui.txt(c, ModConfig.skySrc == 0 ? "Uses the sky you equipped in the Cloudy shop." : ModConfig.skySrc == 1 ? "Uses the colors of your launcher theme." : "Uses the custom color above.", rx + 8, ry + 9, 0xFF8794B8);
		int by = y + h - 28, bw = (w - 20 - 6) / 2;
		String[] labels = {"RESET", "CLOSE"};
		Runnable[] runs = {() -> ModConfig.skyReset(), () -> { optId = null; ModConfig.save(); }};
		for (int i = 0; i < 2; i++) {
			int bx = x + 10 + i * (bw + 6);
			boolean hv = Ui.in(mx, my, bx, by, bw, 20);
			c.fill(bx, by, bx + bw, by + 20, i == 1 ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : hv ? 0xFF2A3558 : 0xFF1A2342);
			Ui.sp(c, labels[i], bx + bw / 2, by + 6, i == 1 ? 0xFF0B1226 : 0xFFFFFFFF);
			mhits.add(new Hit(bx, by, bw, 20, runs[i]));
		}
	}

	/** Optionen der Lyrics-Mod: Position, Zeit, Wortdauer, Farben, Schrift, Effekt. */
	private void lyricsModal(DrawContext c, int mx, int my) {
		int w = 300, rows = 12, h = 34 + rows * 23 + 34;
		int x = (int) (this.width / uiF) / 2 - w / 2, y = Math.max(4, (int) (this.height / uiF) / 2 - h / 2);
		shadow(c, x, y, w, h);
		c.fill(x, y, x + w, y + h, 0xFF0A1226);
		c.fill(x, y, x + w, y + 2, Theme.accent);
		Ui.txt(c, "Spotify lyrics options", x + 12, y + 12, 0xFFFFFFFF);
		int rx = x + 10, rw = w - 20, ry = y + 30;
		mrow(c, mx, my, rx, ry, rw, "Position", ModConfig.LPOS[ModConfig.lyricsMode], 0, () -> { ModConfig.lyricsMode = (ModConfig.lyricsMode + 1) % ModConfig.LPOS.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Timing (click to shift)", String.format("%+.2f s", ModConfig.lyricsOffset / 1000f), 0, () -> { ModConfig.lyricsOffset += 250; if (ModConfig.lyricsOffset > 2000) ModConfig.lyricsOffset = -2000; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Word duration", String.format("%.1f s", ModConfig.lyricsLife / 1000f), 0, () -> { ModConfig.lyricsLife += 400; if (ModConfig.lyricsLife > 4000) ModConfig.lyricsLife = 800; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Color: current word", ModConfig.colName(ModConfig.lyricsCur, 0), ModConfig.lcol(ModConfig.lyricsCur, 0), () -> openPick(0)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Color: already sung", ModConfig.colName(ModConfig.lyricsOld, 1), ModConfig.lcol(ModConfig.lyricsOld, 1), () -> openPick(1)); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Font", ModConfig.LFONT[ModConfig.lyricsFont], 0, () -> { ModConfig.lyricsFont = (ModConfig.lyricsFont + 1) % ModConfig.LFONT.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Effect", ModConfig.LFX[ModConfig.lyricsFx], 0, () -> { ModConfig.lyricsFx = (ModConfig.lyricsFx + 1) % ModConfig.LFX.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Motion (words in world)", ModConfig.LMOTION[ModConfig.lyricsMotion], 0, () -> { ModConfig.lyricsMotion = (ModConfig.lyricsMotion + 1) % ModConfig.LMOTION.length; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Transparency (opacity)", ModConfig.lyricsAlpha + "%", 0, () -> { ModConfig.lyricsAlpha -= 20; if (ModConfig.lyricsAlpha < 20) ModConfig.lyricsAlpha = 100; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Lyrics size", ModConfig.lyricsSize + "%", 0, () -> { int[] z = {60, 80, 100, 125, 150, 200}; int k = 0; for (int i = 0; i < z.length; i++) if (z[i] <= ModConfig.lyricsSize) k = i; ModConfig.lyricsSize = z[(k + 1) % z.length]; ModConfig.save(); }); ry += 23;
		mrow(c, mx, my, rx, ry, rw, "Song card (move in HUD editor)", ModConfig.lyricsCard ? "ON" : "OFF", 0, () -> { ModConfig.lyricsCard = !ModConfig.lyricsCard; ModConfig.save(); }); ry += 23;
		// Vorschau des Stils
		c.fill(rx, ry, rx + rw, ry + 20, 0xFF0E1630);
		Lyrics.sample(c, rx + rw / 2, ry + 10);
		int by = y + h - 28, bw = (w - 20 - 6) / 2;
		String[] labels = {"RESET", "CLOSE"};
		Runnable[] runs = {() -> ModConfig.lyricsReset(), () -> { optId = null; ModConfig.save(); }};
		for (int i = 0; i < 2; i++) {
			int bx = x + 10 + i * (bw + 6);
			boolean hv = Ui.in(mx, my, bx, by, bw, 20);
			c.fill(bx, by, bx + bw, by + 20, i == 1 ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : hv ? 0xFF2A3558 : 0xFF1A2342);
			Ui.sp(c, labels[i], bx + bw / 2, by + 6, i == 1 ? 0xFF0B1226 : 0xFFFFFFFF);
			mhits.add(new Hit(bx, by, bw, 20, runs[i]));
		}
	}

	private void poll(int mx, int my) {
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		if (down && !wasDown) {
			focus = false;
			for (Hit h : (optId != null ? mhits : hits)) if (Ui.in(mx, my, h.x(), h.y(), h.w(), h.h())) { h.run().run(); break; }
		}
		if (!down && sliding != 0) { sliding = 0; ModConfig.save(); }
		wasDown = down;
	}

	@Override
	public boolean charTyped(char chr, int modifiers) {
		if (focus && chr >= 32 && query.length() < 20) { query += chr; scroll = 0; return true; }
		return super.charTyped(chr, modifiers);
	}

	@Override
	public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
		if (bindId != null) {
			if (keyCode == 256) { bindId = null; return true; }
			if (keyCode == 261 || keyCode == 259) { ModConfig.keys.remove(bindId); ModConfig.save(); bindId = null; bindMsg = ""; return true; }
			String why = Hotkeys.conflict(bindId, keyCode);
			if (why != null) { bindMsg = why + " - pick another key"; bindId = null; return true; }
			ModConfig.keys.put(bindId, keyCode); ModConfig.save(); bindId = null; bindMsg = "";
			return true;
		}
		if (focus) {
			if (keyCode == 259 && !query.isEmpty()) { query = query.substring(0, query.length() - 1); return true; }
			if (keyCode == 256 || keyCode == 257) { focus = false; return true; }
			return true;
		}
		if (keyCode == 256 && pickT >= 0) { pickT = -1; ModConfig.save(); return true; }
		if (keyCode == 256 && optId != null) { optId = null; return true; }
		return super.keyPressed(keyCode, scanCode, modifiers);
	}

	@Override
	public boolean mouseScrolled(double mx, double my, double hx, double vy) {
		scroll = Math.max(0, Math.min(maxScroll, scroll - (int) Math.signum(vy) * 24));
		return true;
	}

	@Override
	public void close() {
		ModConfig.save();
		if (this.client != null) this.client.setScreen(parent);
	}
}
