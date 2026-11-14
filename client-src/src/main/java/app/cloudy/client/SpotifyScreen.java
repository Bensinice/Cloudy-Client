package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.function.IntConsumer;

/**
 * Cloudify (Taste I): Musik, Lyrics und Playlists im Spiel. Seitenleiste mit Tabs, rechts der Inhalt.
 * Alle Schalter gehoeren zu echten Einstellungen der Mod (ModConfig) und werden sofort gespeichert. Playlists, Songs und Meldungen
 * kommen vom Launcher (SpotifyData), Befehle gehen an ihn zurueck (SpotifyCmd). Hier liegen ALLE Spotify-/Lyrics-Einstellungen –
 * in Cloudy Mods gibt es dafuer kein zweites Fenster mehr.
 */
public class SpotifyScreen extends Screen {
	private record Hit(int x, int y, int w, int h, Runnable run) {}

	// ---------- Themes: Farben des Menues. Neues Theme = neue Zeile in PAL + Name in THEME_NAMES. ----------
	public static final String[] THEME_NAMES = {"Classic", "Midnight", "Rose", "Aurora", "Sunset", "Launcher theme"};
	/** bg, side, line, tile, tileHover, accent, onAccent, text, dim, track, card, ok, okBg */
	private static final int[][] PAL = {
		{0xFF1C1C1E, 0xFF161618, 0xFF2C2C30, 0xFF2A2A2D, 0xFF38383D, 0xFFFFFFFF, 0xFF1C1C1E, 0xFFF2F2F7, 0xFF8E8E93, 0xFF48484D, 0xFF242427, 0xFF6FF0B0, 0xFF234033},
		{0xFF0F1424, 0xFF0B0F1C, 0xFF1E2640, 0xFF18203A, 0xFF243052, 0xFF6EA8FF, 0xFF0A1226, 0xFFEAF0FF, 0xFF8A97B8, 0xFF2E3A5C, 0xFF141B31, 0xFF6FF0B0, 0xFF1C3A35},
		{0xFF1E1418, 0xFF181013, 0xFF35232A, 0xFF2C1D23, 0xFF3F2930, 0xFFFF6FA5, 0xFF26101A, 0xFFFFEFF4, 0xFFB08A97, 0xFF4D323C, 0xFF27191F, 0xFF7CF0B6, 0xFF263A30},
		{0xFF0F1B1A, 0xFF0B1615, 0xFF1E3330, 0xFF172A27, 0xFF213E39, 0xFF4FE3C1, 0xFF06201B, 0xFFE8FFF9, 0xFF86A8A1, 0xFF2B4A45, 0xFF13241F, 0xFF9CF27A, 0xFF22381C},
		{0xFF1F1610, 0xFF19110C, 0xFF3A2A1E, 0xFF2E2117, 0xFF433121, 0xFFFFA24D, 0xFF261406, 0xFFFFF4EA, 0xFFB39A86, 0xFF54402E, 0xFF281C13, 0xFF7CF0B6, 0xFF263A2C},
		null // Launcher-Theme: aus Theme.accent berechnet
	};
	private int BG, SIDE, LINE, TILE, TILE_H, ACC, ON_ACC, TXT, DIM, TRACK, CARD, OK, OK_BG;

	private void applyTheme() {
		int t = Math.max(0, Math.min(PAL.length - 1, ModConfig.cfTheme));
		int[] p = PAL[t];
		if (p == null) {
			int a = 0xFF000000 | (Theme.accent & 0xFFFFFF), base = 0xFF10131C;
			p = new int[] {Ui.mix(base, a, 0.05f), Ui.mix(base, a, 0.02f) & 0xFFFFFFFF, Ui.mix(base, a, 0.18f), Ui.mix(base, a, 0.12f), Ui.mix(base, a, 0.22f), a, 0xFF0B0E16, 0xFFF0F3FA, 0xFF8C93A6, Ui.mix(base, a, 0.30f), Ui.mix(base, a, 0.08f), 0xFF6FF0B0, 0xFF1F3A33};
		}
		BG = p[0]; SIDE = p[1]; LINE = p[2]; TILE = p[3]; TILE_H = p[4]; ACC = p[5]; ON_ACC = p[6]; TXT = p[7]; DIM = p[8]; TRACK = p[9]; CARD = p[10]; OK = p[11]; OK_BG = p[12];
	}

	private static final String[][] TABS = {{"Overview", "Now playing, volume and playlists"}, {"Playlists", "Open a playlist and pick a song"}, {"Lyrics", "Where and how the lyrics appear"}, {"Styles", "Motion, colors and preview"}, {"HUD", "Song card and opacity"}, {"Timing", "Sync and word duration"}, {"Skies", "The sky behind your lyrics"}, {"Themes", "Colors of this menu"}, {"Settings", "Reset and keys"}, {"Information", "How Cloudify works"}};
	private static int tab = 0;

	private final List<Hit> hits = new ArrayList<>();
	private final Screen parent;
	private boolean wasDown;
	private int slide; // 0 = nichts, 1 Groesse, 2 eigene Farbe aktuell, 3 eigene Farbe gesungen
	private String localMsg = "";
	private long localT;
	private boolean songView; // Playlists-Tab: Songliste der geoeffneten Playlist
	private int scroll, maxScroll, px, py, pw, ph, sw, cx, cw, cTop, cBottom, cy, sliderX, sliderW;

	public SpotifyScreen(Screen parent) { this(parent, -1); }

	/** startTab: Tab, der sofort offen ist (-1 = zuletzt benutzter). */
	public SpotifyScreen(Screen parent, int startTab) {
		super(Text.literal("Cloudify"));
		this.parent = parent;
		if (startTab >= 0 && startTab < TABS.length) { tab = startTab; scroll = 0; }
	}

	@Override
	protected void init() {
		pw = Math.min(this.width - 16, 620); ph = Math.min(this.height - 16, 350);
		px = (this.width - pw) / 2; py = (this.height - ph) / 2;
	}

	@Override
	public boolean shouldPause() { return false; }

	@Override
	public void renderBackground(DrawContext c, int mx, int my, float delta) {
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, MinecraftClient.getInstance().world == null ? 0x55000000 : 0x88000000);
	}

	private void cmd(String c, String ok) {
		boolean sent = SpotifyCmd.send(c);
		note(sent ? ok : "Spotify control only works when started from the Cloudy launcher.");
	}

	private void note(String s) { localMsg = s; localT = System.currentTimeMillis(); }

	// ---------- Zeichen-Helfer ----------
	/** Abgerundetes Rechteck (Radius r in Pixeln), weiche Kante durch zeilenweise Kreisberechnung. */
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
		rr(c, x + 1, y + 1, w - 2, h - 2, Math.max(1, r - 1), fill);
	}

	/** Text ohne Schatten (sauber auf hellen Flaechen), mit Schatten nur auf dunklem Grund. */
	private void t(DrawContext c, String s, int x, int y, int col) { c.drawText(this.textRenderer, Ui.t(s), x, y, col, false); }

	private void big(DrawContext c, String s, int x, int y, float k, int col) {
		var ms = c.getMatrices();
		ms.push(); ms.translate(x, y, 0); ms.scale(k, k, 1f);
		t(c, s, 0, 0, col);
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
	private int row(DrawContext c, String title, String sub) { return row(c, title, sub, 90); }

	private int row(DrawContext c, String title, String sub, int reserve) {
		int y = cy; cy += 38;
		if (visible(y, 38)) {
			t(c, Ui.trim(title, Math.max(50, cw - reserve)), cx, y + 7, TXT);
			if (!sub.isEmpty()) t(c, Ui.trim(sub, Math.max(50, cw - reserve)), cx, y + 20, DIM);
			c.fill(cx, y + 36, cx + cw, y + 37, LINE);
		}
		return y;
	}

	private void section(DrawContext c, String label) {
		int y = cy; cy += 22;
		if (visible(y, 22)) { c.fill(cx, y + 8, cx + 3, y + 17, ACC); t(c, label, cx + 9, y + 9, TXT); }
	}

	private void toggle(DrawContext c, int mx, int my, int y, boolean on, Runnable r) {
		if (!visible(y, 38)) return;
		int w = 34, h = 18, x = cx + cw - w, ty = y + 9;
		rr(c, x, ty, w, h, 9, on ? ACC : TRACK);
		int k = on ? x + w - h + 2 : x + 2;
		rr(c, k, ty + 2, h - 4, h - 4, 7, on ? ON_ACC : 0xFFFFFFFF);
		hit(x, ty, w, h, r);
	}

	private void seg(DrawContext c, int mx, int my, int y, String[] labels, int sel, IntConsumer pick) {
		if (!visible(y, 38)) return;
		int pad = 9, total = 4; int[] ws = new int[labels.length];
		for (int i = 0; i < labels.length; i++) { ws[i] = Ui.w(labels[i]) + pad * 2; total += ws[i]; }
		int x = cx + cw - total, ty = y + 6, h = 24;
		rr(c, x, ty, total, h, 10, TILE);
		int xx = x + 2;
		for (int i = 0; i < labels.length; i++) {
			final int idx = i;
			boolean on = i == sel;
			if (on) rr(c, xx, ty + 2, ws[i], h - 4, 8, ACC);
			else if (hv(mx, my, xx, ty + 2, ws[i], h - 4)) rr(c, xx, ty + 2, ws[i], h - 4, 8, TILE_H);
			t(c, labels[i], xx + pad, ty + 8, on ? ON_ACC : TXT);
			hit(xx, ty + 2, ws[i], h - 4, () -> pick.accept(idx));
			xx += ws[i];
		}
	}

	private void tile(DrawContext c, int mx, int my, int x, int y, int w, int h, Text label, boolean sel, Runnable r) {
		if (!visible(y, h)) return;
		boolean h2 = hv(mx, my, x, y, w, h);
		if (sel) rrBorder(c, x, y, w, h, 10, ACC, Ui.mix(TILE, ACC, 0.18f)); else rr(c, x, y, w, h, 10, h2 ? TILE_H : TILE);
		var tr = this.textRenderer;
		int tw = tr.getWidth(label);
		if (tw > w - 8) { label = Text.literal(tr.trimToWidth(label, w - 14).getString() + "..."); tw = tr.getWidth(label); }
		c.drawText(tr, label, x + (w - tw) / 2, y + (h - 8) / 2, TXT, false);
		hit(x, y, w, h, r);
	}

	/** Raster aus Kacheln (Schriften, Positionen, Bewegungen, Themes). */
	private void grid(DrawContext c, int mx, int my, int n, int cols, int th, java.util.function.IntFunction<Text> label, java.util.function.IntPredicate sel, IntConsumer pick) {
		int gap = 8, tw = (cw - gap * (cols - 1)) / cols;
		for (int i = 0; i < n; i++) {
			final int idx = i;
			int x = cx + (i % cols) * (tw + gap), y2 = cy + (i / cols) * (th + gap);
			tile(c, mx, my, x, y2, tw, th, label.apply(i), sel.test(i), () -> pick.accept(idx));
		}
		cy += ((n + cols - 1) / cols) * (th + gap) + 2;
	}

	private void btn(DrawContext c, int mx, int my, int x, int y, int w, int h, String label, boolean primary, Runnable r) {
		boolean h2 = Ui.in(mx, my, x, y, w, h);
		rr(c, x, y, w, h, Math.min(9, h / 2), primary ? (h2 ? Ui.mix(ACC, 0xFFFFFFFF, 0.18f) : ACC) : (h2 ? TILE_H : TILE));
		t(c, label, x + (w - Ui.w(label)) / 2, y + (h - 7) / 2, primary ? ON_ACC : TXT);
		hit(x, y, w, h, r);
	}

	private void wrap(DrawContext c, String s, int col) {
		int yy = cy;
		for (var line : this.textRenderer.wrapLines(Ui.t(s), cw)) { if (visible(yy, 10)) c.drawText(this.textRenderer, line, cx, yy, col, false); yy += 11; }
		cy = yy + 6;
	}

	// ---------- Hauptzeichnung ----------
	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load();
		ModConfig.load();
		applyTheme();
		Lyrics.refresh();
		SpotifyData.read();
		hits.clear();
		sw = Math.min(150, pw / 4);
		// Fenster mit feiner Kante und weichem Schatten
		for (int i = 6; i >= 1; i--) rr(c, px - i, py - i + 2, pw + i * 2, ph + i * 2, 14 + i, 0x0C000000);
		rr(c, px, py, pw, ph, 14, LINE);
		rr(c, px + 1, py + 1, pw - 2, ph - 2, 13, BG);
		// Seitenleiste
		rr(c, px + 1, py + 1, sw, ph - 2, 13, SIDE);
		c.fill(px + sw - 13, py + 1, px + sw, py + ph - 1, SIDE);
		c.fill(px + sw, py + 10, px + sw + 1, py + ph - 10, LINE);
		Ui.cloud(c, px + 14, py + 14, 3, ACC);
		big(c, "Cloudify", px + 36, py + 13, 1.4f, TXT);
		t(c, "Music & lyrics", px + 36, py + 28, DIM);
		int ty = py + 48, th = 20;
		for (int i = 0; i < TABS.length; i++) {
			final int idx = i;
			int x = px + 8, w = sw - 16;
			boolean on = i == tab, h2 = Ui.in(mx, my, x, ty, w, th);
			if (on) rr(c, x, ty, w, th, 10, ACC); else if (h2) rr(c, x, ty, w, th, 10, TILE);
			t(c, TABS[i][0], x + 11, ty + 6, on ? ON_ACC : TXT);
			sideHit(x, ty, w, th, () -> { tab = idx; scroll = 0; songView = false; });
			ty += th + 3;
		}
		// Kopf
		cx = px + sw + 18; cw = pw - sw - 36; cTop = py + 54; cBottom = py + ph - 24;
		big(c, TABS[tab][0], cx, py + 13, 1.5f, TXT);
		t(c, TABS[tab][1], cx, py + 33, DIM);
		int bx = px + pw - 30, by = py + 10;
		boolean hx = Ui.in(mx, my, bx, by, 20, 20);
		rr(c, bx, by, 20, 20, 10, hx ? 0xFFE5484D : TILE);
		for (int k = 0; k < 8; k++) { c.fill(bx + 6 + k, by + 6 + k, bx + 8 + k, by + 7 + k, TXT); c.fill(bx + 12 - k, by + 6 + k, bx + 14 - k, by + 7 + k, TXT); } // sauber zentriertes Kreuz
		sideHit(bx, by, 20, 20, this::close);
		// Inhalt (scrollbar)
		c.enableScissor(cx - 4, cTop, cx + cw + 4, cBottom);
		cy = cTop - scroll;
		switch (tab) {
			case 0 -> tabOverview(c, mx, my);
			case 1 -> tabPlaylists(c, mx, my);
			case 2 -> tabLyrics(c, mx, my);
			case 3 -> tabStyles(c, mx, my);
			case 4 -> tabHud(c, mx, my);
			case 5 -> tabTiming(c, mx, my);
			case 6 -> tabSkies(c, mx, my);
			case 7 -> tabThemes(c, mx, my);
			case 8 -> tabSettings(c, mx, my);
			default -> tabInfo(c);
		}
		c.disableScissor();
		maxScroll = Math.max(0, cy + scroll - cBottom);
		scroll = Math.max(0, Math.min(maxScroll, scroll));
		if (maxScroll > 0) { int bh = Math.max(16, (cBottom - cTop) * (cBottom - cTop) / (cBottom - cTop + maxScroll)); int sy = cTop + (int) ((cBottom - cTop - bh) * (scroll / (float) maxScroll)); rr(c, px + pw - 9, sy, 3, bh, 1, TRACK); }
		// Statuszeile
		long now = System.currentTimeMillis();
		String st = now - localT < 4000 ? localMsg : (now - SpotifyData.msgT < 6000 ? SpotifyData.msg : "");
		if (st.isEmpty()) st = "Press " + keyName() + " or Esc to close  ·  /playlist works in chat too";
		t(c, Ui.trim(st, cw), cx, py + ph - 16, DIM);
		poll(mx, my);
	}

	// ---------- Karte "Jetzt laeuft" ----------
	private void nowCard(DrawContext c, int mx, int my) {
		int y = cy, h = 82; cy += h + 10;
		if (!visible(y, h)) return;
		rr(c, cx, y, cw, h, 12, CARD);
		var cov = Lyrics.nowCover();
		rr(c, cx + 10, y + 10, 46, 46, 8, TRACK);
		if (cov != null) c.drawTexture(net.minecraft.client.render.RenderLayer::getGuiTextured, cov, cx + 11, y + 11, 0f, 0f, 44, 44, 44, 44);
		String ti = Lyrics.nowTitle();
		int tx = cx + 66, tw = cw - 76;
		if (ti.isEmpty()) {
			big(c, "Nothing playing", tx, y + 12, 1.15f, TXT);
			t(c, "Start a song in Spotify", tx, y + 28, DIM);
		} else {
			big(c, Ui.trim(ti, (int) (tw / 1.15f)), tx, y + 10, 1.15f, TXT);
			t(c, Ui.trim(Lyrics.nowArtist(), tw), tx, y + 24, DIM);
			boolean ly = Lyrics.hasLyrics();
			String badge = ly ? "Lyrics synced" : "No lyrics";
			int bw = Ui.w(badge) + 14;
			rr(c, tx, y + 36, bw, 13, 6, ly ? OK_BG : TRACK);
			t(c, badge, tx + 7, y + 39, ly ? OK : DIM);
			t(c, Lyrics.nowTime(), tx + bw + 8, y + 39, TXT);
		}
		int pby = y + 56;
		rr(c, tx, pby, tw, 3, 1, TRACK);
		int pw2 = (int) (tw * Lyrics.nowProgress());
		if (pw2 > 1) rr(c, tx, pby, pw2, 3, 1, ACC);
		int bw = 44, bh = 16, bx = tx + tw - 3 * bw - 8;
		boolean pl = Lyrics.nowPlaying();
		btn(c, mx, my, bx, y + 62, bw, bh, "Prev", false, () -> cmd("prev", "Previous song"));
		btn(c, mx, my, bx + bw + 4, y + 62, bw, bh, pl ? "Pause" : "Play", true, () -> cmd(pl ? "pause" : "resume", pl ? "Paused" : "Resumed"));
		btn(c, mx, my, bx + 2 * (bw + 4), y + 62, bw, bh, "Next", false, () -> cmd("skip", "Next song"));
	}

	// ---------- Tabs ----------
	private boolean spotifyState(DrawContext c) {
		if (!SpotifyData.launcher || !SpotifyData.connected || SpotifyData.pls.isEmpty()) {
			String m = !SpotifyData.launcher ? SpotifyData.err : !SpotifyData.connected ? "Spotify is not connected. Connect it in the launcher: Settings > Spotify." : SpotifyData.err.isEmpty() ? "Loading your playlists ..." : SpotifyData.err;
			wrap(c, m, DIM);
			return false;
		}
		return true;
	}

	private void playlistRows(DrawContext c, int mx, int my) {
		for (SpotifyData.Pl p : SpotifyData.pls) {
			int y2 = cy; cy += 28;
			if (!visible(y2, 28)) continue;
			boolean h2 = hv(mx, my, cx, y2, cw, 25);
			rr(c, cx, y2, cw, 25, 10, h2 ? TILE_H : TILE);
			t(c, Ui.trim(p.name(), cw - 110), cx + 11, y2 + 9, TXT);
			if (p.total() >= 0) t(c, p.total() + " songs", cx + cw - 64 - Ui.w(p.total() + " songs"), y2 + 9, DIM);
			int pbx = cx + cw - 52;
			btn(c, mx, my, pbx, y2 + 5, 46, 15, "▶ Play", true, () -> { if (SpotifyData.playAll(p)) note("Starting " + p.name()); else note("Spotify control only works when started from the Cloudy launcher."); });
			hit(cx, y2, cw - 58, 25, () -> openPl(p));
		}
	}

	private void openPl(SpotifyData.Pl p) {
		tab = 1; scroll = 0; songView = true;
		if (!SpotifyData.open(p)) note(SpotifyData.trErr);
	}

	private void tabOverview(DrawContext c, int mx, int my) {
		nowCard(c, mx, my);
		int y = row(c, "Volume", "Spotify device volume", 200);
		int[] vs = {0, 30, 60, 100}; String[] vl = {"0", "30", "60", "100"};
		seg(c, mx, my, y, vl, -1, i -> cmd("vol:" + vs[i], "Volume " + vs[i] + "%"));
		section(c, "Playlists");
		if (spotifyState(c)) playlistRows(c, mx, my);
	}

	private void tabPlaylists(DrawContext c, int mx, int my) {
		if (!songView || SpotifyData.current() == null) { songView = false; if (spotifyState(c)) { wrap(c, "Click a playlist to see its songs, or press Play to start it.", DIM); playlistRows(c, mx, my); } return; }
		SpotifyData.Pl p = SpotifyData.current();
		int y = cy; cy += 30;
		if (visible(y, 30)) {
			btn(c, mx, my, cx, y + 4, 50, 18, "< Back", false, () -> { songView = false; scroll = 0; });
			t(c, Ui.trim(p.name(), cw - 150), cx + 60, y + 10, TXT);
			btn(c, mx, my, cx + cw - 76, y + 4, 76, 18, "▶ Play all", true, () -> { if (SpotifyData.playAll(p)) note("Starting " + p.name()); else note("Spotify control only works when started from the Cloudy launcher."); });
		}
		if (SpotifyData.trLoading) { wrap(c, "Loading songs ...", DIM); return; }
		if (!SpotifyData.trErr.isEmpty()) {
			wrap(c, SpotifyData.trErr, 0xFFFF8A8A);
			int yb = cy; cy += 26;
			if (visible(yb, 26)) btn(c, mx, my, cx, yb, 80, 18, "Try again", false, () -> SpotifyData.open(p));
			return;
		}
		int i = 0;
		for (SpotifyData.Tr tr : SpotifyData.tracks) {
			final int n = ++i;
			int y2 = cy; cy += 24;
			if (!visible(y2, 24)) continue;
			boolean h2 = hv(mx, my, cx, y2, cw, 22);
			rr(c, cx, y2, cw, 22, 9, h2 ? TILE_H : TILE);
			t(c, String.valueOf(n), cx + 9, y2 + 8, DIM);
			int nx = cx + 34;
			t(c, Ui.trim(tr.name(), (cw - 50) / 2), nx, y2 + 8, TXT);
			t(c, Ui.trim(tr.artist(), (cw - 50) / 2 - 10), cx + cw / 2 + 20, y2 + 8, DIM);
			hit(cx, y2, cw, 22, () -> { if (SpotifyData.play(p, tr)) note("Playing " + tr.name()); else note("Spotify control only works when started from the Cloudy launcher."); });
		}
	}

	private static final String[] POS_SHORT = {"Sky (3D words)", "Near hotbar", "Top center", "Screen center", "Left list", "Flat words", "Chrome 3D"};

	private void colorRow(DrawContext c, int mx, int my, String title, int which) {
		int sel = which == 0 ? ModConfig.lyricsCur : ModConfig.lyricsOld;
		int y = row(c, title, ModConfig.colName(sel, which), 250);
		if (!visible(y, 38)) return;
		int n = ModConfig.LCOL.length, d = 16, g = 5, x = cx + cw - n * (d + g) + g;
		for (int i = 0; i < n; i++) {
			final int idx = i;
			int dx = x + i * (d + g), dy = y + 10, col = 0xFF000000 | ModConfig.lcol(i, which);
			if (sel == i) rr(c, dx - 2, dy - 2, d + 4, d + 4, 10, ACC);
			rr(c, dx, dy, d, d, 8, col);
			if (i == n - 1) t(c, "+", dx + 5, dy + 4, 0xFF1C1C1E); // eigene Farbe
			hit(dx, dy, d, d, () -> { if (which == 0) ModConfig.lyricsCur = idx; else ModConfig.lyricsOld = idx; ModConfig.save(); });
		}
		if (sel == n - 1) { // eigene Farbe: Farbton-Regler
			int y2 = cy; cy += 26;
			if (visible(y2, 26)) {
				sliderW = Math.min(220, cw - 120); sliderX = cx + cw - sliderW;
				t(c, "Custom color", cx + 10, y2 + 8, DIM);
				for (int k = 0; k < sliderW; k++) c.fill(sliderX + k, y2 + 7, sliderX + k + 1, y2 + 15, 0xFF000000 | java.awt.Color.HSBtoRGB(k / (float) sliderW, 0.6f, 1f));
				float[] hsb = java.awt.Color.RGBtoHSB((ModConfig.pick[which] >> 16) & 255, (ModConfig.pick[which] >> 8) & 255, ModConfig.pick[which] & 255, null);
				int kx = sliderX + (int) (hsb[0] * sliderW);
				rr(c, kx - 4, y2 + 4, 8, 14, 4, 0xFFFFFFFF);
				final int sx = sliderX, sw2 = sliderW;
				hits.add(new Hit(sx - 4, Math.max(y2 + 2, cTop), sw2 + 8, 18, () -> { slide = which == 0 ? 2 : 3; sliderX = sx; sliderW = sw2; }));
			}
		}
	}

	private void tabLyrics(DrawContext c, int mx, int my) {
		nowCard(c, mx, my);
		int y = row(c, "Show lyrics", "While Spotify plays");
		toggle(c, mx, my, y, ModConfig.isOn("lyrics"), () -> ModConfig.set("lyrics", !ModConfig.isOn("lyrics")));
		section(c, "Position");
		grid(c, mx, my, POS_SHORT.length, 4, 26, i -> Ui.t(POS_SHORT[i]), i -> ModConfig.lyricsMode == i, i -> { ModConfig.lyricsMode = i; ModConfig.save(); });
		if (ModConfig.lyricsMode == 0 || ModConfig.lyricsMode == 6) {
			y = row(c, "Words appear", ModConfig.lyricsReveal == 0 ? "Each word spawns when sung (with your motion)" : "Whole line at once, drifts back (old style)", 260);
			seg(c, mx, my, y, ModConfig.LREVEAL, ModConfig.lyricsReveal, i -> { ModConfig.lyricsReveal = i; ModConfig.save(); });
			y = row(c, "Only in the sky", "Lyrics float high above you instead of in front of you");
			toggle(c, mx, my, y, ModConfig.lyricsSkyOnly, () -> { ModConfig.lyricsSkyOnly = !ModConfig.lyricsSkyOnly; ModConfig.save(); });
		}
		y = row(c, "Effect", "Behind the words", 230);
		seg(c, mx, my, y, ModConfig.LFX, ModConfig.lyricsFx, i -> { ModConfig.lyricsFx = i; ModConfig.save(); });
		section(c, "Font");
		grid(c, mx, my, ModConfig.LFONT.length, 4, 28, i -> Lyrics.fontText(i, ModConfig.LFONT[i]), i -> ModConfig.lyricsFont == i, i -> { ModConfig.lyricsFont = i; ModConfig.save(); });
		colorRow(c, mx, my, "Color: current word", 0);
		y = row(c, "Lyrics size", ModConfig.lyricsSize + " %");
		if (visible(y, 38)) {
			int sx = cx + cw - Math.min(180, cw / 2), sww = Math.min(180, cw / 2);
			int ty2 = y + 17;
			rr(c, sx, ty2, sww, 4, 2, TRACK);
			float f = (ModConfig.lyricsSize - 50) / 150f;
			rr(c, sx, ty2, Math.max(2, (int) (sww * f)), 4, 2, ACC);
			rr(c, sx + (int) (sww * f) - 5, ty2 - 4, 10, 12, 5, 0xFFFFFFFF);
			hits.add(new Hit(sx - 6, Math.max(y + 8, cTop), sww + 12, 20, () -> { slide = 1; sliderX = sx; sliderW = sww; }));
		}
	}

	private void tabStyles(DrawContext c, int mx, int my) {
		section(c, "Motion of the words (also how 3D words spawn)");
		grid(c, mx, my, ModConfig.LMOTION.length, 4, 28, i -> Lyrics.fontText(ModConfig.lyricsFont, ModConfig.LMOTION[i]), i -> ModConfig.lyricsMotion == i, i -> { ModConfig.lyricsMotion = i; ModConfig.save(); });
		colorRow(c, mx, my, "Color: current word", 0);
		colorRow(c, mx, my, "Color: already sung", 1);
		section(c, "Preview");
		int y = cy; cy += 34;
		if (visible(y, 34)) { rr(c, cx, y, cw, 30, 10, CARD); Lyrics.sample(c, cx + cw / 2, y + 15); }
	}

	private void tabHud(DrawContext c, int mx, int my) {
		int y = row(c, "Song card", "Cover, title and progress on screen (move it in the HUD editor)");
		toggle(c, mx, my, y, ModConfig.lyricsCard, () -> { ModConfig.lyricsCard = !ModConfig.lyricsCard; ModConfig.save(); });
		y = row(c, "Opacity", "How solid the lyrics are", 230);
		int[] av = {20, 40, 60, 80, 100};
		int sel = -1; for (int i = 0; i < av.length; i++) if (av[i] == ModConfig.lyricsAlpha) sel = i;
		seg(c, mx, my, y, new String[] {"20", "40", "60", "80", "100"}, sel, i -> { ModConfig.lyricsAlpha = av[i]; ModConfig.save(); });
		y = row(c, "HUD editor", "Move the song card and other widgets");
		if (visible(y, 38)) btn(c, mx, my, cx + cw - 80, y + 9, 80, 20, "Open", false, () -> { if (this.client != null) this.client.setScreen(new HudEditorScreen(this)); });
	}

	private void plusMinus(DrawContext c, int mx, int my, int y, Runnable minus, Runnable plus) {
		if (!visible(y, 38)) return;
		int x = cx + cw - 2 * 30 - 6;
		btn(c, mx, my, x, y + 8, 30, 22, "-", false, minus);
		btn(c, mx, my, x + 36, y + 8, 30, 22, "+", false, plus);
	}

	private void tabTiming(DrawContext c, int mx, int my) {
		int y = row(c, "Word duration", String.format("%.1f s per word", ModConfig.lyricsLife / 1000f));
		plusMinus(c, mx, my, y, () -> { ModConfig.lyricsLife = Math.max(800, ModConfig.lyricsLife - 400); ModConfig.save(); }, () -> { ModConfig.lyricsLife = Math.min(4000, ModConfig.lyricsLife + 400); ModConfig.save(); });
		y = row(c, "Timing", String.format("%+.2f s (minus = earlier)", ModConfig.lyricsOffset / 1000f));
		plusMinus(c, mx, my, y, () -> { ModConfig.lyricsOffset = Math.max(-5000, ModConfig.lyricsOffset - 250); ModConfig.save(); }, () -> { ModConfig.lyricsOffset = Math.min(2000, ModConfig.lyricsOffset + 250); ModConfig.save(); });
	}

	private void tabSkies(DrawContext c, int mx, int my) {
		int y = row(c, "Sky", "The Cloudy sky in the game world");
		toggle(c, mx, my, y, ModConfig.isOn("sky"), () -> ModConfig.set("sky", !ModConfig.isOn("sky")));
		y = row(c, "Skybox: " + SkyBox.NAMES[Math.max(0, Math.min(SkyBox.NAMES.length - 1, ModConfig.skyboxId))], "A painted sky instead of the Minecraft sky");
		toggle(c, mx, my, y, ModConfig.isOn("skybox"), () -> ModConfig.set("skybox", !ModConfig.isOn("skybox")));
		y = row(c, "Volumetric clouds", "Soft 3D clouds instead of the flat block clouds");
		toggle(c, mx, my, y, ModConfig.isOn("clouds3d"), () -> ModConfig.set("clouds3d", !ModConfig.isOn("clouds3d")));
		y = row(c, "Cloud amount", ModConfig.cloudsAmount + " %", 230);
		int[] ca = {25, 35, 45, 60, 75};
		int csel = -1; for (int i = 0; i < ca.length; i++) if (ca[i] == ModConfig.cloudsAmount) csel = i;
		seg(c, mx, my, y, new String[] {"Few", "Some", "Normal", "Many", "Overcast"}, csel, i -> { ModConfig.cloudsAmount = ca[i]; ModConfig.save(); });
		y = row(c, "Pulse to the song beat", "The sky reacts to the music", 200);
		seg(c, mx, my, y, ModConfig.BEAT, ModConfig.skyBeat, i -> { ModConfig.skyBeat = i; ModConfig.save(); });
	}

	private void tabThemes(DrawContext c, int mx, int my) {
		wrap(c, "Pick the colors of Cloudify. Your choice is saved and used next time.", DIM);
		int gap = 8, cols = 3, tw = (cw - gap * (cols - 1)) / cols, th = 54;
		for (int i = 0; i < THEME_NAMES.length; i++) {
			final int idx = i;
			int x = cx + (i % cols) * (tw + gap), y2 = cy + (i / cols) * (th + gap);
			if (!visible(y2, th)) continue;
			int old = ModConfig.cfTheme; ModConfig.cfTheme = i; applyTheme(); int pBg = BG, pSide = SIDE, pAcc = ACC, pTxt = TXT, pTile = TILE; ModConfig.cfTheme = old; applyTheme();
			boolean sel = ModConfig.cfTheme == i, h2 = hv(mx, my, x, y2, tw, th);
			if (sel) rr(c, x - 2, y2 - 2, tw + 4, th + 4, 12, ACC);
			rr(c, x, y2, tw, th, 10, pBg);
			rr(c, x + 6, y2 + 6, 22, th - 12, 6, pSide);
			rr(c, x + 34, y2 + 8, tw - 42, 10, 5, pTile);
			rr(c, x + 34, y2 + 22, (tw - 42) / 2, 10, 5, pAcc);
			c.drawText(this.textRenderer, Ui.t(THEME_NAMES[i]), x + 34, y2 + th - 14, pTxt, false);
			if (h2 && !sel) rr(c, x, y2 + th - 2, tw, 2, 1, ACC);
			hit(x, y2, tw, th, () -> { ModConfig.cfTheme = idx; ModConfig.save(); });
		}
		cy += ((THEME_NAMES.length + cols - 1) / cols) * (th + gap) + 2;
	}

	private void tabSettings(DrawContext c, int mx, int my) {
		int y = row(c, "Reset lyrics", "All lyrics options back to default");
		if (visible(y, 38)) btn(c, mx, my, cx + cw - 80, y + 9, 80, 20, "Reset", false, () -> { ModConfig.lyricsReset(); note("Lyrics options reset"); });
		row(c, "Open this menu", "Key: " + keyName() + " (change it in Minecraft > Controls > Cloudy Client)");
		row(c, "Playlists in chat", "Type /playlist, click a playlist, then click a song");
		y = row(c, "All mods", "The full Cloudy mods menu");
		if (visible(y, 38)) btn(c, mx, my, cx + cw - 80, y + 9, 80, 20, "Open", false, () -> { if (this.client != null) this.client.setScreen(new CloudyModsScreen(this)); });
	}

	private void tabInfo(DrawContext c) {
		wrap(c, "Cloudify connects Minecraft with your Spotify account through the Cloudy launcher. Playing songs from here needs Spotify Premium. Spotify only lists the songs of your own or shared playlists, but any playlist can be started. Lyrics come from public lyrics sources and do not exist for every song. Every change is saved right away.", DIM);
		wrap(c, "Chat: /playlist shows your playlists, /playlist next and /playlist prev switch songs, /pause /resume /skip /prev control the music.", DIM);
	}

	private static String keyName() {
		try { return CloudyClient.spotKey.getBoundKeyLocalizedText().getString(); } catch (Throwable t) { return "the key"; }
	}

	// ---------- Eingaben ----------
	private void setSlide(int mx) {
		float f = Math.max(0f, Math.min(1f, (mx - sliderX) / (float) Math.max(1, sliderW)));
		if (slide == 1) ModConfig.lyricsSize = Math.max(50, Math.min(200, 50 + Math.round(f * 150 / 5f) * 5));
		else if (slide == 2 || slide == 3) ModConfig.pick[slide - 2] = java.awt.Color.HSBtoRGB(f, 0.6f, 1f) & 0xFFFFFF;
	}

	private void poll(int mx, int my) {
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		if (down && !wasDown) {
			for (int i = hits.size() - 1; i >= 0; i--) { Hit h = hits.get(i); if (Ui.in(mx, my, h.x(), h.y(), h.w(), h.h())) { h.run().run(); break; } }
			if (slide != 0) setSlide(mx);
		} else if (down && slide != 0) setSlide(mx);
		if (!down && slide != 0) { slide = 0; ModConfig.save(); }
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
