package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.function.IntConsumer;

/**
 * Spotify-Menue im Spiel (Taste I), im Aufbau wie das Lyrics-Fenster im Launcher: Seitenleiste mit Tabs, rechts Karte "Jetzt laeuft" und Einstellungen.
 * Alle Schalter gehoeren zu echten Einstellungen der Mod (ModConfig). Playlists und Meldungen kommen vom Launcher (-Dcloudy.spotify), Befehle gehen an ihn zurueck.
 */
public class SpotifyScreen extends Screen {
	private record Hit(int x, int y, int w, int h, Runnable run) {}
	private record Pl(String name, String uri, int total) {}

	private static final int BG = 0xFF1C1C1E, SIDE = 0xFF171719, LINE = 0xFF2C2C30, TILE = 0xFF2C2C2F, TILE_H = 0xFF3A3A3F, TILE_ON = 0xFF2B2447, WHITE = 0xFFFFFFFF, DIM = 0xFF8E8E93, TXT = 0xFFF2F2F7, GREEN = 0xFF6FF0B0, GREEN_BG = 0xFF2A4A3C, TRACK = 0xFF48484D;
	private static final String[][] TABS = {{"Overview", "Playlists, volume and status"}, {"Skies", "The sky behind your lyrics"}, {"Lyrics", "Spotify lyrics in the sky."}, {"Styles", "How the words move"}, {"HUD", "Song card on screen"}, {"Performance", "Timing and word duration"}, {"Settings", "Reset and keys"}, {"Information", "How this menu works"}};
	private static int tab = 2;

	private final List<Hit> hits = new ArrayList<>();
	private final Screen parent;
	private final List<Pl> pls = new ArrayList<>();
	private boolean connected = true, wasDown, sliding;
	private String listErr = "", msg = "", localMsg = "";
	private long msgT, fileMt = -1, lastRead, localT;
	private int scroll, maxScroll, px, py, pw, ph, sw, cx, cw, cTop, cBottom, cy, sliderX, sliderW;

	public SpotifyScreen(Screen parent) {
		super(Text.literal("Cloudy Spotify"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		pw = Math.min(this.width - 12, 600); ph = Math.min(this.height - 12, 340);
		px = (this.width - pw) / 2; py = (this.height - ph) / 2;
	}

	@Override
	public boolean shouldPause() { return false; }

	@Override
	public void renderBackground(DrawContext c, int mx, int my, float delta) {
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, MinecraftClient.getInstance().world == null ? 0x55000000 : 0x88000000);
	}

	// ---------- Daten vom Launcher ----------
	private void readList() {
		long now = System.currentTimeMillis();
		if (now - lastRead < 500) return;
		lastRead = now;
		try {
			String p = System.getProperty("cloudy.spotify", "");
			if (p.isEmpty()) { connected = false; listErr = "Start Minecraft with the Cloudy launcher to use Spotify here."; return; }
			Path f = Path.of(p);
			if (!Files.exists(f)) { listErr = "Waiting for the launcher ..."; return; }
			long mt = Files.getLastModifiedTime(f).toMillis();
			if (mt == fileMt) return;
			fileMt = mt;
			JsonObject o = JsonParser.parseString(Files.readString(f)).getAsJsonObject();
			connected = !o.has("connected") || o.get("connected").getAsBoolean();
			listErr = o.has("error") ? o.get("error").getAsString() : "";
			pls.clear();
			if (o.has("playlists")) {
				JsonArray a = o.getAsJsonArray("playlists");
				for (JsonElement e : a) { JsonObject q = e.getAsJsonObject(); pls.add(new Pl(q.get("name").getAsString(), q.get("uri").getAsString(), q.has("total") ? q.get("total").getAsInt() : -1)); }
			}
			if (o.has("msg")) { JsonObject m = o.getAsJsonObject("msg"); long t = m.has("t") ? m.get("t").getAsLong() : 0; if (t > msgT) { msgT = t; msg = m.has("text") ? m.get("text").getAsString() : ""; } }
		} catch (Exception ignored) {}
	}

	private void cmd(String c, String ok) {
		boolean sent = SpotifyCmd.send(c);
		localMsg = sent ? ok : "Spotify control only works when started from the Cloudy launcher."; localT = System.currentTimeMillis();
	}

	// ---------- Zeichen-Helfer ----------
	/** Abgerundetes Rechteck (Radius r in Pixeln). */
	private static void rr(DrawContext c, int x, int y, int w, int h, int r, int col) {
		r = Math.min(r, Math.min(w, h) / 2);
		c.fill(x, y + r, x + w, y + h - r, col);
		for (int i = 0; i < r; i++) {
			int d = r - i, inset = r - (int) Math.floor(Math.sqrt((double) r * r - (double) (d - 0.5) * (d - 0.5)));
			c.fill(x + inset, y + i, x + w - inset, y + i + 1, col);
			c.fill(x + inset, y + h - 1 - i, x + w - inset, y + h - i, col);
		}
	}

	private static void rrBorder(DrawContext c, int x, int y, int w, int h, int r, int border, int fill) {
		rr(c, x, y, w, h, r, border);
		rr(c, x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2), fill);
	}

	private void big(DrawContext c, String s, int x, int y, float k, int col) {
		var ms = c.getMatrices();
		ms.push(); ms.translate(x, y, 0); ms.scale(k, k, 1f);
		Ui.txt(c, s, 0, 0, col);
		ms.pop();
	}

	private boolean visible(int y, int h) { return y + h > cTop && y < cBottom; }

	private void hit(int x, int y, int w, int h, Runnable r) {
		int y0 = Math.max(y, cTop), y1 = Math.min(y + h, cBottom);
		if (y1 > y0) hits.add(new Hit(x, y0, w, y1 - y0, r));
	}

	private void sideHit(int x, int y, int w, int h, Runnable r) { hits.add(new Hit(x, y, w, h, r)); }

	private boolean hv(int mx, int my, int x, int y, int w, int h) { return Ui.in(mx, my, x, y, w, h) && my >= cTop && my < cBottom; }

	/** Eine Zeile: links Titel + Beschreibung, rechts Platz fuer das Bedienelement. Gibt y der Zeile zurueck. */
	private int row(DrawContext c, String title, String sub) { return row(c, title, sub, 80); }

	private int row(DrawContext c, String title, String sub, int reserve) {
		int y = cy; cy += 38;
		if (visible(y, 38)) {
			Ui.txt(c, title, cx, y + 6, TXT);
			if (!sub.isEmpty()) Ui.txt(c, Ui.trim(sub, Math.max(50, cw - reserve)), cx, y + 19, DIM);
			c.fill(cx, y + 36, cx + cw, y + 37, LINE);
		}
		return y;
	}

	private void section(DrawContext c, String label) {
		int y = cy; cy += 22;
		if (visible(y, 22)) { Ui.txt(c, ">", cx, y + 8, DIM); Ui.txt(c, label, cx + 10, y + 8, 0xFFD1D1D6); }
	}

	private void toggle(DrawContext c, int mx, int my, int y, boolean on, Runnable r) {
		if (!visible(y, 38)) return;
		int w = 34, h = 18, x = cx + cw - w, ty = y + 9;
		rr(c, x, ty, w, h, 9, on ? WHITE : TRACK);
		int k = on ? x + w - h + 2 : x + 2;
		rr(c, k, ty + 2, h - 4, h - 4, 7, on ? 0xFF2C2C30 : WHITE);
		hit(x, ty, w, h, r);
	}

	private void seg(DrawContext c, int mx, int my, int y, String[] labels, int sel, IntConsumer pick) {
		if (!visible(y, 38)) return;
		int pad = 9, total = 4; int[] ws = new int[labels.length];
		for (int i = 0; i < labels.length; i++) { ws[i] = Ui.w(labels[i]) + pad * 2; total += ws[i]; }
		int x = cx + cw - total, ty = y + 5, h = 26;
		rr(c, x, ty, total, h, 8, 0xFF242427);
		int xx = x + 2;
		for (int i = 0; i < labels.length; i++) {
			final int idx = i;
			boolean on = i == sel;
			if (on) rr(c, xx, ty + 2, ws[i], h - 4, 6, WHITE);
			else if (hv(mx, my, xx, ty + 2, ws[i], h - 4)) rr(c, xx, ty + 2, ws[i], h - 4, 6, TILE_H);
			Ui.txt(c, labels[i], xx + pad, ty + 9, on ? 0xFF1C1C1E : TXT);
			hit(xx, ty + 2, ws[i], h - 4, () -> pick.accept(idx));
			xx += ws[i];
		}
	}

	private void tile(DrawContext c, int mx, int my, int x, int y, int w, int h, Text label, boolean sel, Runnable r) {
		if (!visible(y, h)) return;
		boolean h2 = hv(mx, my, x, y, w, h);
		if (sel) rrBorder(c, x, y, w, h, 8, WHITE, TILE_ON); else rr(c, x, y, w, h, 8, h2 ? TILE_H : TILE);
		var tr = this.textRenderer;
		int tw = tr.getWidth(label);
		c.drawText(tr, label, x + (w - tw) / 2, y + (h - 8) / 2, TXT, true);
		hit(x, y, w, h, r);
	}

	private void btn(DrawContext c, int mx, int my, int x, int y, int w, int h, String label, boolean primary, Runnable r) {
		boolean h2 = Ui.in(mx, my, x, y, w, h);
		rr(c, x, y, w, h, 7, primary ? (h2 ? 0xFFE5E5EA : WHITE) : (h2 ? TILE_H : TILE));
		Ui.txt(c, label, x + (w - Ui.w(label)) / 2, y + (h - 8) / 2, primary ? 0xFF1C1C1E : TXT);
		hit(x, y, w, h, r);
	}

	// ---------- Hauptzeichnung ----------
	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load();
		ModConfig.load();
		Lyrics.refresh();
		readList();
		hits.clear();
		sw = Math.min(150, pw / 4);
		rr(c, px, py, pw, ph, 10, 0xFF3A3A3F);
		rr(c, px + 1, py + 1, pw - 2, ph - 2, 9, BG);
		// Seitenleiste
		rr(c, px + 1, py + 1, sw, ph - 2, 9, SIDE);
		c.fill(px + sw - 8, py + 1, px + sw, py + ph - 1, SIDE);
		c.fill(px + sw, py + 1, px + sw + 1, py + ph - 1, LINE);
		big(c, "Cloudy", px + 14, py + 12, 1.5f, WHITE);
		Ui.txt(c, "Lyrics & Spotify", px + 14, py + 32, DIM);
		int ty = py + 52, th = 22;
		for (int i = 0; i < TABS.length; i++) {
			final int idx = i;
			int x = px + 8, w = sw - 16;
			boolean on = i == tab, h2 = Ui.in(mx, my, x, ty, w, th);
			if (on) rr(c, x, ty, w, th, 8, WHITE); else if (h2) rr(c, x, ty, w, th, 8, 0xFF2A2A2E);
			Ui.txt(c, TABS[i][0], x + 12, ty + 7, on ? 0xFF1C1C1E : TXT);
			sideHit(x, ty, w, th, () -> { tab = idx; scroll = 0; });
			ty += th + 3;
		}
		// Kopf
		cx = px + sw + 18; cw = pw - sw - 36; cTop = py + 56; cBottom = py + ph - 22;
		big(c, TABS[tab][0], cx, py + 12, 1.5f, WHITE);
		Ui.txt(c, TABS[tab][1], cx, py + 34, DIM);
		boolean hx = Ui.in(mx, my, px + pw - 28, py + 8, 20, 18);
		rr(c, px + pw - 28, py + 8, 20, 18, 7, hx ? 0xFFB8304C : TILE);
		Ui.txt(c, "x", px + pw - 28 + (20 - Ui.w("x")) / 2, py + 13, TXT);
		sideHit(px + pw - 28, py + 8, 20, 18, this::close);
		// Inhalt (scrollbar)
		c.enableScissor(cx - 4, cTop, cx + cw + 4, cBottom);
		cy = cTop - scroll;
		switch (tab) {
			case 0 -> tabOverview(c, mx, my);
			case 1 -> tabSkies(c, mx, my);
			case 2 -> tabLyrics(c, mx, my);
			case 3 -> tabStyles(c, mx, my);
			case 4 -> tabHud(c, mx, my);
			case 5 -> tabPerf(c, mx, my);
			case 6 -> tabSettings(c, mx, my);
			default -> tabInfo(c);
		}
		c.disableScissor();
		maxScroll = Math.max(0, cy + scroll - cBottom);
		scroll = Math.max(0, Math.min(maxScroll, scroll));
		if (maxScroll > 0) { int bh = Math.max(16, (cBottom - cTop) * (cBottom - cTop) / (cBottom - cTop + maxScroll)); int by = cTop + (int) ((cBottom - cTop - bh) * (scroll / (float) maxScroll)); rr(c, px + pw - 8, by, 3, bh, 1, 0xFF5A5A60); }
		// Statuszeile
		long now = System.currentTimeMillis();
		String st = now - localT < 4000 ? localMsg : (now - msgT < 6000 ? msg : "");
		if (st.isEmpty()) st = "Press " + keyName() + " or Esc to close.";
		Ui.txt(c, Ui.trim(st, cw), cx, py + ph - 15, DIM);
		poll(mx, my);
	}

	// ---------- Karte "Jetzt laeuft" ----------
	private void nowCard(DrawContext c, int mx, int my) {
		int y = cy, h = 78; cy += h + 8;
		if (!visible(y, h)) return;
		rr(c, cx, y, cw, h, 10, 0xFF262629);
		var cov = Lyrics.nowCover();
		rr(c, cx + 10, y + 10, 44, 44, 6, 0xFF3A3A3F);
		if (cov != null) c.drawTexture(net.minecraft.client.render.RenderLayer::getGuiTextured, cov, cx + 10, y + 10, 0f, 0f, 44, 44, 44, 44);
		String ti = Lyrics.nowTitle();
		int tx = cx + 64, tw = cw - 74;
		if (ti.isEmpty()) {
			big(c, "Nothing playing", tx, y + 12, 1.15f, WHITE);
			Ui.txt(c, "Start a song in Spotify", tx, y + 28, DIM);
		} else {
			big(c, Ui.trim(ti.toUpperCase(), (int) (tw / 1.15f)), tx, y + 10, 1.15f, WHITE);
			Ui.txt(c, Ui.trim(Lyrics.nowArtist(), tw), tx, y + 24, DIM);
			boolean ly = Lyrics.hasLyrics(), ok = ly;
			String badge = ly ? "Lyrics synced" : "No lyrics";
			int bw = Ui.w(badge) + 16;
			rr(c, tx, y + 36, bw, 12, 6, ok ? GREEN_BG : 0xFF3A3A3F);
			Ui.txt(c, badge, tx + 8, y + 38, ok ? GREEN : DIM);
			Ui.txt(c, Lyrics.nowTime(), tx + bw + 8, y + 38, TXT);
		}
		int by = y + 58;
		rr(c, tx, by, tw, 3, 1, TRACK);
		int pw2 = (int) (tw * Lyrics.nowProgress());
		if (pw2 > 1) rr(c, tx, by, pw2, 3, 1, WHITE);
		// Steuerung unter der Linie
		int bw = 40, bh = 12, bx = tx + tw - 3 * bw - 8;
		boolean pl = Lyrics.nowPlaying();
		btn(c, mx, my, bx, y + 62, bw, bh, "Prev", false, () -> cmd("prev", "Previous song"));
		btn(c, mx, my, bx + bw + 4, y + 62, bw, bh, pl ? "Pause" : "Play", true, () -> cmd(pl ? "pause" : "resume", pl ? "Paused" : "Resumed"));
		btn(c, mx, my, bx + 2 * (bw + 4), y + 62, bw, bh, "Next", false, () -> cmd("skip", "Next song"));
	}

	// ---------- Tabs ----------
	private void tabOverview(DrawContext c, int mx, int my) {
		nowCard(c, mx, my);
		int y = row(c, "Volume", "Spotify device volume", 190);
		int[] vs = {0, 30, 60, 100}; String[] vl = {"0", "30", "60", "100"};
		seg(c, mx, my, y, vl, -1, i -> cmd("vol:" + vs[i], "Volume " + vs[i] + "%"));
		section(c, "Playlists");
		if (!connected || pls.isEmpty()) {
			String t = !connected ? "Spotify is not connected. Connect it in the launcher: Settings > Spotify." : listErr.isEmpty() ? "No playlists yet ..." : listErr;
			int yy = cy;
			for (var line : this.textRenderer.wrapLines(Ui.t(t), cw)) { if (visible(yy, 10)) c.drawText(this.textRenderer, line, cx, yy, DIM, true); yy += 11; }
			cy = yy + 6;
			return;
		}
		for (Pl p : pls) {
			int y2 = cy; cy += 26;
			if (!visible(y2, 26)) continue;
			boolean h2 = hv(mx, my, cx, y2, cw, 24);
			rr(c, cx, y2, cw, 24, 8, h2 ? TILE_H : TILE);
			Ui.txt(c, Ui.trim(p.name(), cw - 70), cx + 10, y2 + 8, TXT);
			if (p.total() >= 0) Ui.txt(c, p.total() + "", cx + cw - 10 - Ui.w(p.total() + ""), y2 + 8, DIM);
			hit(cx, y2, cw, 24, () -> cmd("play:" + p.uri(), "Starting " + p.name()));
		}
	}

	private void tabSkies(DrawContext c, int mx, int my) {
		int y = row(c, "Sky", "The Cloudy sky in the game world");
		toggle(c, mx, my, y, ModConfig.isOn("sky"), () -> ModConfig.set("sky", !ModConfig.isOn("sky")));
		y = row(c, "Pulse to the song beat", "The sky reacts to the music", 200);
		seg(c, mx, my, y, ModConfig.BEAT, ModConfig.skyBeat, i -> { ModConfig.skyBeat = i; ModConfig.save(); });
	}

	private void tabLyrics(DrawContext c, int mx, int my) {
		nowCard(c, mx, my);
		section(c, "Lyrics");
		int y = row(c, "Show lyrics", "While Spotify plays");
		toggle(c, mx, my, y, ModConfig.isOn("lyrics"), () -> ModConfig.set("lyrics", !ModConfig.isOn("lyrics")));
		y = row(c, "Where", ModConfig.LPOS[ModConfig.lyricsMode], 250);
		seg(c, mx, my, y, new String[] {"World", "Hotbar", "Top", "Center", "List"}, ModConfig.lyricsMode, i -> { ModConfig.lyricsMode = i; ModConfig.save(); });
		y = row(c, "Effect", "Behind the words", 210);
		seg(c, mx, my, y, ModConfig.LFX, ModConfig.lyricsFx, i -> { ModConfig.lyricsFx = i; ModConfig.save(); });
		section(c, "Font");
		int gap = 8, cols = 4, tw = (cw - gap * (cols - 1)) / cols, th = 34;
		for (int i = 0; i < ModConfig.LFONT.length; i++) {
			final int idx = i;
			int x = cx + (i % cols) * (tw + gap), y2 = cy + (i / cols) * (th + gap);
			tile(c, mx, my, x, y2, tw, th, Lyrics.fontText(i, ModConfig.LFONT[i]), ModConfig.lyricsFont == i, () -> { ModConfig.lyricsFont = idx; ModConfig.save(); });
		}
		cy += ((ModConfig.LFONT.length + cols - 1) / cols) * (th + gap) + 2;
		y = row(c, "Color", "Current: " + ModConfig.colName(ModConfig.lyricsCur, 0), 200);
		if (visible(y, 38)) {
			int n = ModConfig.LCOL.length - 1, d = 18, g = 6, x = cx + cw - n * (d + g) + g;
			for (int i = 0; i < n; i++) {
				final int idx = i;
				int dx = x + i * (d + g), dy = y + 9, col = 0xFF000000 | ModConfig.lcol(i, 0);
				if (ModConfig.lyricsCur == i) rr(c, dx - 2, dy - 2, d + 4, d + 4, 11, WHITE);
				rr(c, dx, dy, d, d, 9, col);
				if (i == 1) Ui.txt(c, "A", dx + 6, dy + 5, 0xFF1C1C1E);
				hit(dx, dy, d, d, () -> { ModConfig.lyricsCur = idx; ModConfig.save(); });
			}
		}
		y = row(c, "Lyrics size", ModConfig.lyricsSize + " %");
		if (visible(y, 38)) {
			sliderW = Math.min(180, cw / 2); sliderX = cx + cw - sliderW;
			int ty2 = y + 17;
			rr(c, sliderX, ty2, sliderW, 4, 2, TRACK);
			float f = (ModConfig.lyricsSize - 50) / 150f;
			rr(c, sliderX, ty2, Math.max(2, (int) (sliderW * f)), 4, 2, WHITE);
			rr(c, sliderX + (int) (sliderW * f) - 5, ty2 - 4, 10, 12, 5, WHITE);
			hits.add(new Hit(sliderX - 6, Math.max(y + 8, cTop), sliderW + 12, 20, () -> { sliding = true; setSize(mx); }));
		}
	}

	private void setSize(int mx) {
		float f = Math.max(0f, Math.min(1f, (mx - sliderX) / (float) sliderW));
		int v = 50 + Math.round(f * 150 / 5f) * 5;
		ModConfig.lyricsSize = Math.max(50, Math.min(200, v));
	}

	private void tabStyles(DrawContext c, int mx, int my) {
		section(c, "Motion of the words in the world");
		int gap = 8, cols = 4, tw = (cw - gap * (cols - 1)) / cols, th = 34;
		for (int i = 0; i < ModConfig.LMOTION.length; i++) {
			final int idx = i;
			int x = cx + (i % cols) * (tw + gap), y2 = cy + (i / cols) * (th + gap);
			tile(c, mx, my, x, y2, tw, th, Lyrics.fontText(ModConfig.lyricsFont, ModConfig.LMOTION[i]), ModConfig.lyricsMotion == i, () -> { ModConfig.lyricsMotion = idx; ModConfig.save(); });
		}
		cy += ((ModConfig.LMOTION.length + cols - 1) / cols) * (th + gap) + 2;
		int y = row(c, "Color: already sung", ModConfig.colName(ModConfig.lyricsOld, 1), 200);
		if (visible(y, 38)) {
			int n = ModConfig.LCOL.length - 1, d = 18, g = 6, x = cx + cw - n * (d + g) + g;
			for (int i = 0; i < n; i++) {
				final int idx = i;
				int dx = x + i * (d + g), dy = y + 9;
				if (ModConfig.lyricsOld == i) rr(c, dx - 2, dy - 2, d + 4, d + 4, 11, WHITE);
				rr(c, dx, dy, d, d, 9, 0xFF000000 | ModConfig.lcol(i, 1));
				if (i == 1) Ui.txt(c, "A", dx + 6, dy + 5, 0xFF1C1C1E);
				hit(dx, dy, d, d, () -> { ModConfig.lyricsOld = idx; ModConfig.save(); });
			}
		}
	}

	private void tabHud(DrawContext c, int mx, int my) {
		int y = row(c, "Song card", "Cover, title and progress on screen (move it in the HUD editor)");
		toggle(c, mx, my, y, ModConfig.lyricsCard, () -> { ModConfig.lyricsCard = !ModConfig.lyricsCard; ModConfig.save(); });
		y = row(c, "Opacity", "How solid the lyrics are", 230);
		int[] av = {20, 40, 60, 80, 100};
		int sel = -1; for (int i = 0; i < av.length; i++) if (av[i] == ModConfig.lyricsAlpha) sel = i;
		seg(c, mx, my, y, new String[] {"20", "40", "60", "80", "100"}, sel, i -> { ModConfig.lyricsAlpha = av[i]; ModConfig.save(); });
	}

	private void tabPerf(DrawContext c, int mx, int my) {
		int y = row(c, "Word duration", String.format("%.1f s per word", ModConfig.lyricsLife / 1000f));
		if (visible(y, 38)) {
			int x = cx + cw - 2 * 30 - 6;
			btn(c, mx, my, x, y + 6, 30, 24, "-", false, () -> { ModConfig.lyricsLife = Math.max(800, ModConfig.lyricsLife - 400); ModConfig.save(); });
			btn(c, mx, my, x + 36, y + 6, 30, 24, "+", false, () -> { ModConfig.lyricsLife = Math.min(4000, ModConfig.lyricsLife + 400); ModConfig.save(); });
		}
		y = row(c, "Timing", String.format("%+.2f s (minus = earlier)", ModConfig.lyricsOffset / 1000f));
		if (visible(y, 38)) {
			int x = cx + cw - 2 * 30 - 6;
			btn(c, mx, my, x, y + 6, 30, 24, "-", false, () -> { ModConfig.lyricsOffset = Math.max(-5000, ModConfig.lyricsOffset - 250); ModConfig.save(); });
			btn(c, mx, my, x + 36, y + 6, 30, 24, "+", false, () -> { ModConfig.lyricsOffset = Math.min(2000, ModConfig.lyricsOffset + 250); ModConfig.save(); });
		}
	}

	private void tabSettings(DrawContext c, int mx, int my) {
		int y = row(c, "Reset lyrics", "All lyrics options back to default");
		if (visible(y, 38)) btn(c, mx, my, cx + cw - 80, y + 6, 80, 24, "Reset", false, () -> { ModConfig.lyricsReset(); localMsg = "Lyrics options reset"; localT = System.currentTimeMillis(); });
		row(c, "Open this menu", "Key: " + keyName() + " (change it in Minecraft > Controls > Cloudy Client)");
		y = row(c, "All mods", "The full Cloudy mods menu");
		if (visible(y, 38)) btn(c, mx, my, cx + cw - 80, y + 6, 80, 24, "Open", false, () -> { if (this.client != null) this.client.setScreen(new CloudyModsScreen(this)); });
	}

	private void tabInfo(DrawContext c) {
		String t = "Songs, playlists and the controls come from your Spotify account through the Cloudy launcher. Playing from here needs Spotify Premium. Spotify only lists the songs of your own or shared playlists, but any playlist can be started. Lyrics come from public lyrics sources and do not exist for every song. Changes here are saved right away.";
		int yy = cy + 6;
		for (var line : this.textRenderer.wrapLines(Ui.t(t), cw)) { if (visible(yy, 10)) c.drawText(this.textRenderer, line, cx, yy, DIM, true); yy += 12; }
		cy = yy + 6;
	}

	private static String keyName() {
		try { return CloudyClient.spotKey.getBoundKeyLocalizedText().getString(); } catch (Throwable t) { return "the key"; }
	}

	// ---------- Eingaben ----------
	private void poll(int mx, int my) {
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		if (down && !wasDown) {
			for (int i = hits.size() - 1; i >= 0; i--) { Hit h = hits.get(i); if (Ui.in(mx, my, h.x(), h.y(), h.w(), h.h())) { h.run().run(); break; } }
		} else if (down && sliding) setSize(mx);
		if (!down && sliding) { sliding = false; ModConfig.save(); }
		wasDown = down;
	}

	@Override
	public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
		try { if (CloudyClient.spotKey != null && CloudyClient.spotKey.matchesKey(keyCode, scanCode)) { close(); return true; } } catch (Throwable ignored) {}
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
