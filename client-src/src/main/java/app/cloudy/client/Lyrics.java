package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.Camera;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.Vec3d;
import org.joml.Matrix4f;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Zeigt die Lyrics des aktuell gespielten Spotify-Songs im Spiel. Der Launcher schreibt Zeilen + Position in eine Datei (-Dcloudy.lyrics). */
public final class Lyrics {
	private Lyrics() {}

	private static long loadedAt, mtime = -1;
	private static String title = "", artist = "";
	private static long[] times = new long[0];
	private static String[] texts = new String[0];
	private static long posMs, ts;
	private static String status = "";
	private static boolean playing;
	private static int shownLine = -2;
	private static long lastWorldOk;
	private static boolean worldFailed;
	private static float smoothYaw = Float.NaN;
	private static long lineSince;
	private static long durMs;
	private static String coverKey = "";
	private static net.minecraft.util.Identifier coverId;
	private static int coverN;

	/** F7: Lyrics-Datei sofort neu einlesen und Anzeige zurücksetzen. */
	public static void reload() { mtime = -1; loadedAt = 0; shownLine = -2; worldFailed = false; smoothYaw = Float.NaN; lineSince = 0; }

	private static void load() {
		long now = System.currentTimeMillis();
		if (now - loadedAt < 400) return;
		loadedAt = now;
		try {
			String p = System.getProperty("cloudy.lyrics", "");
			if (p.isEmpty()) return;
			Path f = Path.of(p);
			if (!Files.exists(f)) return;
			long mt = Files.getLastModifiedTime(f).toMillis();
			if (mt == mtime) return;
			mtime = mt;
			JsonObject o = JsonParser.parseString(Files.readString(f)).getAsJsonObject();
			title = o.has("title") ? o.get("title").getAsString() : "";
			artist = o.has("artist") ? o.get("artist").getAsString() : "";
			durMs = o.has("dur") ? o.get("dur").getAsLong() : 0;
			loadCover(f, o.has("cover") ? o.get("cover").getAsString() : "");
			posMs = o.has("posMs") ? o.get("posMs").getAsLong() : 0;
			ts = o.has("ts") ? o.get("ts").getAsLong() : now;
			playing = o.has("playing") && o.get("playing").getAsBoolean();
			status = o.has("status") ? o.get("status").getAsString() : "";
			JsonArray a = o.has("lines") ? o.getAsJsonArray("lines") : new JsonArray();
			List<long[]> tt = new ArrayList<>();
			List<String> xs = new ArrayList<>();
			for (var e : a) { JsonArray l = e.getAsJsonArray(); tt.add(new long[] {l.get(0).getAsLong()}); xs.add(l.get(1).getAsString()); }
			times = new long[tt.size()];
			for (int i = 0; i < times.length; i++) times[i] = tt.get(i)[0];
			texts = xs.toArray(new String[0]);
		} catch (Exception ignored) {}
	}

	/** Albumcover: der Launcher legt es als kleines PNG neben die Lyrics-Datei. */
	private static void loadCover(Path lyr, String key) {
		if (key.isEmpty()) { coverId = null; coverKey = ""; return; }
		if (key.equals(coverKey)) return;
		coverKey = key;
		try (java.io.InputStream in = Files.newInputStream(lyr.resolveSibling("cloudy-cover.png"))) {
			var img = net.minecraft.client.texture.NativeImage.read(in);
			var id = net.minecraft.util.Identifier.of("cloudy-client", "cover" + (coverN++));
			MinecraftClient.getInstance().getTextureManager().registerTexture(id, new net.minecraft.client.texture.NativeImageBackedTexture(img));
			coverId = id;
		} catch (Throwable e) { coverId = null; }
	}

	private static long pos() { return posMs + ModConfig.lyricsOffset + (playing ? System.currentTimeMillis() - ts : 0); }

	private static int current() {
		long now = System.currentTimeMillis();
		long pos = posMs + ModConfig.lyricsOffset + (playing ? now - ts : 0);
		int idx = -1;
		for (int i = 0; i < times.length; i++) { if (times[i] <= pos) idx = i; else break; }
		return idx;
	}

	private static String line(int i) {
		if (i < 0 || i >= texts.length) return "";
		String s = texts[i];
		return s.isBlank() ? "♪" : s;
	}

	private static int A(int a) { return a * ModConfig.lyricsAlpha / 100; }
	private static float SZ() { return ModConfig.lyricsSize / 100f; }
	private static int fa(int argb) { return (A(argb >>> 24) << 24) | (argb & 0xFFFFFF); }

	/** Takt-Impuls 0..1: springt bei jedem gesungenen Wort auf 1 und faellt schnell ab (fuer den Himmel). */
	public static float beat() {
		try {
			if (!playing || times.length == 0 || !ModConfig.isOn("lyrics")) return 0f;
			int idx = current();
			if (idx < 0) return 0f;
			String[] ws = split(texts[idx]);
			if (ws.length == 0) return 0f;
			long[] st = starts(idx, ws);
			long p = pos(), last = Long.MIN_VALUE;
			for (long t : st) if (t <= p) last = t;
			if (last == Long.MIN_VALUE) return 0f;
			return (float) Math.exp(-(p - last) / 240.0);
		} catch (Throwable t) { return 0f; }
	}

	private static void big(DrawContext c, String s, int cx, int y, float sc, int rgb, int alpha) {
		alpha = A(alpha);
		if (s.isEmpty() || alpha < 4) return;
		var ms = c.getMatrices();
		var tr = MinecraftClient.getInstance().textRenderer;
		String[] ws = s.trim().split("\\s+");
		int sp = Math.max(3, Ui.w("a") / 2 + 2); // feste Wortluecke: die Schrift rundet Leerzeichen sonst auf 0
		float tw = 0; for (String w : ws) tw += Ui.w(w); tw += sp * (ws.length - 1);
		float w = tw * sc;
		int al = Math.max(0, Math.min(255, alpha)), a = al << 24, sh = (al / 2) << 24;
		ms.push();
		ms.translate(cx - w / 2f, y, 0);
		ms.scale(sc, sc, 1f);
		float x = 0;
		for (String wd : ws) {
			c.drawText(tr, Ui.t(wd), Math.round(x) + 1, 1, sh, false); // weicher Schatten
			c.drawText(tr, Ui.t(wd), Math.round(x), 0, a | (rgb & 0xFFFFFF), false);
			x += Ui.w(wd) + sp;
		}
		ms.pop();
	}


	private static void txt3(MatrixStack ms, VertexConsumerProvider vcp, TextRenderer tr, String s, float yPx, float scale, int rgb, int alpha, boolean glow) {
		if (s.isEmpty() || alpha < 6) return;
		float w = tr.getWidth(Ui.t(s));
		ms.push();
		ms.scale(scale, scale, 1f);
		int a = Math.max(6, Math.min(255, alpha)) << 24;
		if (glow) {
			int ga = Math.max(6, alpha / 3) << 24;
			for (int[] d : new int[][] {{-1, 0}, {1, 0}, {0, -1}, {0, 1}}) {
				Matrix4f m = new Matrix4f(ms.peek().getPositionMatrix()).translate(d[0] * 1.2f, d[1] * 1.2f, 0.01f);
				tr.draw(Ui.t(s), -w / 2f, yPx, ga | (Theme.accent & 0xFFFFFF), false, m, vcp, TextRenderer.TextLayerType.SEE_THROUGH, 0, 0xF000F0);
			}
		}
		tr.draw(Ui.t(s), -w / 2f, yPx, a | (rgb & 0xFFFFFF), false, new Matrix4f(ms.peek().getPositionMatrix()), vcp, TextRenderer.TextLayerType.SEE_THROUGH, 0, 0xF000F0);
		ms.pop();
	}

	// ---- Woerter, die einzeln in der Welt erscheinen (wie im Video) ----
	private static final class W { String t; float yaw, pitch, sz; long t0; boolean cur; }
	private static final List<W> words = new ArrayList<>();
	private static int wLine = -9, wSpawned;
	private static long wRng = 12345;
	private static float rnd() { wRng = wRng * 6364136223846793005L + 1442695040888963407L; return ((wRng >>> 33) & 0xFFFFF) / (float) 0xFFFFF; }

	private static String[] split(String s) { s = s.trim(); return s.isEmpty() ? new String[0] : s.split("\\s+"); }

	/** Text in der gewaehlten Schrift: 0 Extended (breit), 1 Cloudy (Poppins), 2 Minecraft. */
	private static net.minecraft.text.Text ft(String s) {
		return switch (ModConfig.lyricsFont) {
			case 0 -> net.minecraft.text.Text.literal(s).setStyle(net.minecraft.text.Style.EMPTY.withFont(net.minecraft.util.Identifier.of("cloudy-client", "lyrics")));
			case 1 -> Ui.t(s);
			default -> net.minecraft.text.Text.literal(s);
		};
	}
	private static int fw(String s) { return MinecraftClient.getInstance().textRenderer.getWidth(ft(s)); }

	private static void glyphs(DrawContext c, String s, float x0, int y, int argb, boolean bold) {
		var tr = MinecraftClient.getInstance().textRenderer;
		float gap = ModConfig.lyricsFont == 0 ? 1.0f : 1.6f, x = x0;
		for (int i = 0; i < s.length(); i++) {
			String ch = String.valueOf(s.charAt(i));
			var t = bold && ModConfig.lyricsFont != 0 ? ft(ch).copy().formatted(net.minecraft.util.Formatting.BOLD) : ft(ch);
			c.drawText(tr, t, Math.round(x), y, argb, false);
			x += fw(ch) + gap;
		}
	}

	private static void gl(DrawContext c, String s, float x, float dx, float dy, int col) {
		var ms = c.getMatrices();
		ms.push(); ms.translate(dx, dy, 0);
		glyphs(c, s, x, -4, col, true);
		ms.pop();
	}

	/** Wort mit Buchstabenabstand in Grossbuchstaben, mit dem gewaehlten Effekt (Schein, Schatten, Kontur, keiner). */
	private static void tracked(DrawContext c, String s, int cx, int cy, float sc, int rgb, int alpha, boolean cur) {
		alpha = A(alpha);
		if (alpha < 5 || s.isEmpty()) return;
		float gap = ModConfig.lyricsFont == 0 ? 1.0f : 1.6f, w = 0;
		for (int i = 0; i < s.length(); i++) w += fw(String.valueOf(s.charAt(i))) + gap;
		w -= gap;
		sc = Math.min(sc, 2.4f); // zu starke Vergroesserung macht die Schrift grobkoernig
		var ms = c.getMatrices();
		ms.push();
		ms.translate(cx, cy, 0);
		ms.scale(sc, sc, 1f);
		float x = -w / 2f;
		int al = Math.max(0, Math.min(255, alpha)), main = al << 24 | (rgb & 0xFFFFFF);
		float u = 1f / Math.max(0.5f, sc); // Versatz in Bildschirmpixeln, nicht in Textpixeln: so bleibt der Schein bei grosser Schrift sauber
		switch (ModConfig.lyricsFx) {
			case 0 -> { // Schein: weicher Hof in der Textfarbe, feine Schritte
				int ga = (cur ? al / 5 : al / 8) << 24 | (rgb & 0xFFFFFF);
				for (int k = 1; k <= 2; k++) for (int[] d : new int[][] {{-1, 0}, {1, 0}, {0, -1}, {0, 1}, {-1, -1}, {1, 1}, {-1, 1}, {1, -1}}) gl(c, s, x, d[0] * k * 1.1f * u, d[1] * k * 1.1f * u, ga);
			}
			case 1 -> { gl(c, s, x, 1.5f * u, 1.5f * u, (al * 6 / 10) << 24); gl(c, s, x, 0.8f * u, 0.8f * u, (al * 6 / 10) << 24); }
			case 2 -> { int oa = al * 8 / 10 << 24 | 0x0A1020; for (int[] d : new int[][] {{-1, 0}, {1, 0}, {0, -1}, {0, 1}, {-1, -1}, {1, 1}, {-1, 1}, {1, -1}}) gl(c, s, x, d[0] * 1.1f * u, d[1] * 1.1f * u, oa); }
			default -> {}
		}
		glyphs(c, s, x, -4, main, true);
		ms.pop();
	}

	/** Kleine Stilvorschau fuer das Optionsmenue. */
	public static void sample(DrawContext c, int cx, int cy) {
		tracked(c, "OLD", cx - 46, cy, 0.8f, ModConfig.lcol(ModConfig.lyricsOld, 1), 230, false);
		tracked(c, "WORDS", cx + 6, cy, 1.0f, ModConfig.lcol(ModConfig.lyricsCur, 0), 255, true);
		tracked(c, "FLOW", cx + 58, cy, 0.8f, ModConfig.lcol(ModConfig.lyricsOld, 1), 200, false);
	}

	/** Wie frei ist die Stelle? >= 1 = kein Wort in der Naehe, kleiner = Ueberlappung. Misst in Grad (Blickwinkel), unabhaengig von der Aufloesung. */
	private static float placeScore(MinecraftClient mc, float yaw, float pitch, String t, float sz) {
		float hw = (t.length() * 0.62f + 1.2f) * sz * 0.9f, hh = 2.2f * sz; // halbe Breite/Hoehe in Grad (grob)
		float min = 99f;
		for (W o : words) {
			float ow = (o.t.length() * 0.62f + 1.2f) * o.sz * 0.9f, oh = 2.2f * o.sz;
			float dx = Math.abs(((yaw - o.yaw + 540f) % 360f) - 180f), dy = Math.abs(pitch - o.pitch);
			float fx = dx / (hw + ow + 1.5f), fy = dy / (hh + oh + 1.0f);
			min = Math.min(min, Math.max(fx, fy)); // >= 1: Kaesten beruehren sich nicht
		}
		return min;
	}

	private static int syl(String w) {
		String s = w.toLowerCase().replaceAll("[^a-z\u00e4\u00f6\u00fc\u00e9\u00e8\u00e0\u00e1\u00ed\u00f3\u00fa']", "");
		if (s.isEmpty()) return 1;
		int n = 0; boolean v = false;
		for (char ch : s.toCharArray()) { boolean isv = "aeiouy\u00e4\u00f6\u00fc\u00e9\u00e8\u00e0\u00e1\u00ed\u00f3\u00fa".indexOf(ch) >= 0; if (isv && !v) n++; v = isv; }
		if (s.endsWith("e") && n > 1 && !s.endsWith("le")) n--;
		return Math.max(1, n);
	}

	/** Automatische Wortzeiten: nach Silben verteilt, mit kurzen Pausen nach Satzzeichen. Singdauer = Silben x 0,34 s, hoechstens bis zur naechsten Zeile. */
	private static long[] starts(int idx, String[] ws) {
		long start = times[idx], end = idx + 1 < times.length ? times[idx + 1] : start + 4500, gap = Math.max(500, end - start);
		float[] wt = new float[ws.length]; float tot = 0;
		for (int i = 0; i < ws.length; i++) { wt[i] = syl(ws[i]) + (ws[i].matches(".*[,.;:!?]$") ? 0.35f : 0f); tot += wt[i]; }
		float sing = Math.min(gap * 0.93f, Math.max(900f, tot * 340f)), cum = 0;
		long[] out = new long[ws.length];
		for (int i = 0; i < ws.length; i++) { out[i] = start + (long) (sing * cum / tot) - 90; cum += wt[i]; } // 90 ms Vorlauf: Lesen dauert
		return out;
	}

	private static void updateWords(MinecraftClient mc, int idx, long now) {
		if (idx != wLine) { wLine = idx; wSpawned = 0; wRng = idx * 7919L + 17; for (W w : words) w.cur = false; }
		if (idx < 0) return;
		String[] ws = split(texts[idx]);
		if (ws.length == 0) return;
		long[] st = starts(idx, ws);
		long p = pos();
		for (int i = 0; i < ws.length; i++) {
			long t = st[i];
			if (i < wSpawned) continue;
			if (t > p) break;
			wSpawned = i + 1;
			if (p - t > 1800) continue; // nach Sprung/Pause nicht alles auf einmal einblenden
			W w = new W();
			w.t = ws[i].toUpperCase();
			w.sz = 0.85f + rnd() * 0.8f;
			float side = (i + idx) % 2 == 0 ? 1f : -1f;
			// Position waehlen, die sich nicht mit sichtbaren Woertern ueberlappt (mehrere Versuche, sonst der mit dem groessten Abstand)
			float bestScore = -1, by = 0, bp = 0;
			for (int tries = 0; tries < 14; tries++) {
				float cy = mc.player.getYaw() + (tries < 8 ? side : (rnd() < 0.5f ? 1f : -1f)) * (4f + rnd() * 20f), cp = mc.player.getPitch() + (rnd() * 20f - 7f);
				float score = placeScore(mc, cy, cp, w.t, w.sz);
				if (score > bestScore) { bestScore = score; by = cy; bp = cp; }
				if (score >= 1f) break;
			}
			w.yaw = by; w.pitch = bp;
			w.t0 = now; w.cur = true;
			for (W o : words) o.cur = false;
			words.add(w);
		}
		words.removeIf(w -> now - w.t0 > ModConfig.lyricsLife + 700);
	}

	/** Lyrics im Spiel (Vorbild: SpotOnFy). Modus 0: Woerter erscheinen einzeln in der Welt um dich; Modus 1: Zeile ueber der Hotbar. Dazu die Spotify-Karte oben rechts. */
	public static void render(DrawContext c, MinecraftClient mc) {
		if (mc.player == null || !ModConfig.isOn("lyrics") || mc.options.hudHidden) return;
		if (mc.currentScreen != null && !(mc.currentScreen instanceof net.minecraft.client.gui.screen.ChatScreen)) return; // in Menues zeichnet pauseRender (Woerter links/rechts am Rand)
		load();
		if (title.isEmpty()) return;
		int ww = c.getScaledWindowWidth(), wh = c.getScaledWindowHeight();
		long now = System.currentTimeMillis();
		int idx = times.length == 0 ? -1 : current();
		if (idx != shownLine) { shownLine = idx; lineSince = now; }
		int accent = Theme.accent, white = 0xFFFFFF;
		if (times.length == 0) return;
		if (ModConfig.lyricsMode == 0 && !playing && idx >= 0) { // Pause: die Zeile steht ruhig links und rechts am Bildrand
			words.clear();
			pausedSides(c, idx, ww, wh);
		} else if (ModConfig.lyricsMode == 0) {
			updateWords(mc, idx, now);
			float yaw = mc.player.getYaw(), pitch = mc.player.getPitch();
			double vf = Math.toRadians(mc.options.getFov().getValue()), tv = Math.tan(vf / 2), th = tv * ww / (double) wh;
			float base = Math.max(1.0f, wh / 300f) * SZ();
			for (W w : words) {
				float dyaw = ((w.yaw - yaw + 540f) % 360f) - 180f, dp = w.pitch - pitch;
				if (Math.abs(dyaw) > 80 || Math.abs(dp) > 80) continue;
				int sx = (int) (ww / 2.0 + Math.tan(Math.toRadians(dyaw)) / th * ww / 2.0);
				int sy = (int) (wh / 2.0 + Math.tan(Math.toRadians(dp)) / tv * wh / 2.0);
				long age = now - w.t0;
				int mo = ModConfig.lyricsMotion, hs = (w.t.hashCode() & 1) == 0 ? 1 : -1;
				float ft = Math.max(0f, age - 350f) / 1000f, ex = 1f;
				switch (mo) {
					case 0 -> { sy -= (int) (age * wh * 0.00005f + Math.sin(age / 420.0 + w.sz * 5) * wh * 0.006); sx += (int) (Math.cos(age / 560.0 + w.sz * 3) * wh * 0.005); } // Schweben
					case 1 -> sy += (int) (ft * ft * wh * 0.45f); // Fallen
					case 2 -> sy -= (int) (age * age / 1.0e6 * wh * 0.07f); // Aufsteigen
					case 3 -> { sx += (int) (hs * age * wh * 0.00011f); sy += (int) (Math.sin(age / 500.0) * wh * 0.01); } // Treiben
					case 4 -> ex = 1f + 0.55f * (float) (Math.exp(-age / 170.0) * Math.cos(age / 55.0)); // Aufploppen mit Nachschwingen
					case 5 -> { sy += (int) (Math.sin(age / 190.0 + sx * 0.02) * wh * 0.025); sx += (int) (Math.cos(age / 260.0) * wh * 0.008); } // Welle
					case 6 -> sx += (int) (Math.sin(age * 0.11) * Math.exp(-age / 450.0) * wh * 0.03); // Wackeln
					default -> { ex = 1f + 1.5f * (float) Math.exp(-age / 130.0); sy += (int) (Math.exp(-age / 90.0) * wh * 0.05); } // Einschlag
				}
				int life = ModConfig.lyricsLife;
				float in = Math.min(1f, age / 200f); in = 1f - (1f - in) * (1f - in);
				float fadeStart = life * 0.55f, out = age < fadeStart ? 1f : Math.max(0f, 1f - (age - fadeStart) / (life * 0.45f + 300f));
				float a = in * out * (w.cur ? 1f : 0.8f);
				float sc = base * w.sz * (w.cur ? 1.25f : 0.9f) * (1.3f - 0.3f * in) * ex;
				tracked(c, w.t, sx, sy, sc, w.cur ? ModConfig.lcol(ModConfig.lyricsCur, 0) : ModConfig.lcol(ModConfig.lyricsOld, 1), (int) (255 * a), w.cur);
			}
		} else if (ModConfig.lyricsMode == 1) {
			String cur = line(idx);
			int maxW = (int) (ww * 0.7f);
			float sc = 1.25f * SZ(), k = Math.min(1f, (now - lineSince) / 300f);
			while (Ui.w(cur) * sc > maxW && sc > 0.8f) sc -= 0.1f;
			int cy = wh - 68 - (mc.player.getAbilities().creativeMode ? 0 : 6);
			int w = Math.min(maxW, (int) (Ui.w(cur) * sc) + 28), x = ww / 2 - w / 2;
			c.fill(x, cy - 6, x + w, cy + 18, 0x88060A18);
			c.fill(x, cy - 6, x + w, cy - 5, accent);
			big(c, cur, ww / 2, cy + 1, sc, white, (int) (255 * k));
			big(c, line(idx + 1), ww / 2, cy + 24, 0.8f, Ui.mix(accent, 0xFFFFFFFF, 0.6f) & 0xFFFFFF, 140);
		} else if (ModConfig.lyricsMode == 2) { // oben mittig: eine grosse Zeile, Woerter leuchten beim Singen
			karaoke(c, idx, ww / 2, Math.max(10, wh / 12), Math.max(1.5f, wh / 260f), 0, (int) (ww * 0.8f), 255);
			karaoke(c, idx + 1, ww / 2, Math.max(10, wh / 12) + (int) (Math.max(1.5f, wh / 260f) * 13), Math.max(1.5f, wh / 260f) * 0.65f, 2, (int) (ww * 0.8f), 120);
		} else if (ModConfig.lyricsMode == 3) { // Bildschirmmitte: vorherige, aktuelle, naechste Zeile
			float sc = Math.max(1.6f, wh / 220f);
			int cy = wh / 2 - (int) (sc * 6), mw = (int) (ww * 0.85f);
			karaoke(c, idx - 1, ww / 2, cy - (int) (sc * 15), sc * 0.65f, 2, mw, 110);
			karaoke(c, idx, ww / 2, cy, sc, 0, mw, 255);
			karaoke(c, idx + 1, ww / 2, cy + (int) (sc * 15), sc * 0.65f, 2, mw, 130);
		} else { // linke Seite: Liste mit fuenf Zeilen
			float sc = Math.max(1.2f, wh / 330f);
			int x = 12, mw = (int) (ww * 0.38f), cy = wh / 2 - (int) (sc * 20);
			for (int d = -2; d <= 2; d++) karaoke(c, idx + d, x, cy + d * (int) (sc * 14), d == 0 ? sc * 1.1f : sc * 0.8f, d == 0 ? 3 : 1, mw, d == 0 ? 255 : 150 - Math.abs(d) * 35);
		}
	}

	/** Pausemenue: ueberschreibt alles. Die Woerter der aktuellen Zeile erscheinen abwechselnd links und rechts am Bildrand, untereinander. Wird nach dem Zeichnen des Menues aufgerufen. */
	public static void pauseRender(DrawContext c) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || !ModConfig.isOn("lyrics")) return;
		load();
		if (title.isEmpty() || times.length == 0) return;
		int idx = current();
		if (idx < 0) return;
		String[] ws = split(texts[idx]);
		if (ws.length == 0) return;
		int ww = c.getScaledWindowWidth(), wh = c.getScaledWindowHeight();
		long[] st = starts(idx, ws);
		long p = pos();
		int shown = 0;
		for (int i = 0; i < ws.length; i++) if (st[i] <= p) shown = i + 1;
		if (!playing) shown = ws.length;
		float sc = Math.max(1.2f, wh / 240f) * SZ();
		int lh = (int) (sc * 12), n = Math.max(1, shown);
		int y0 = wh / 2 - (ws.length * lh) / 2;
		int maxW = (int) (ww * 0.24f);
		for (int i = 0; i < shown; i++) {
			String t = ws[i].toUpperCase();
			boolean cur = playing && i == shown - 1;
			float s2 = sc * (cur ? 1.15f : 1f);
			while (s2 > 0.6f && fwTracked(t) * s2 > maxW) s2 -= 0.05f;
			int half = (int) (fwTracked(t) * s2 / 2f);
			int cx = (i % 2 == 0) ? 18 + half : ww - 18 - half;
			tracked(c, t, cx, y0 + i * lh, s2, cur ? ModConfig.lcol(ModConfig.lyricsCur, 0) : ModConfig.lcol(ModConfig.lyricsOld, 1), cur ? 255 : 200, cur);
		}
	}

	/** Pause: erste Haelfte der Zeile links, zweite Haelfte rechts, gedaempft, vertikal mittig. */
	private static void pausedSides(DrawContext c, int idx, int ww, int wh) {
		String[] ws = split(texts[idx]);
		if (ws.length == 0) return;
		int half = Math.max(1, (ws.length + 1) / 2);
		String l = String.join(" ", java.util.Arrays.copyOfRange(ws, 0, half)).toUpperCase(), r = String.join(" ", java.util.Arrays.copyOfRange(ws, half, ws.length)).toUpperCase();
		float sc = Math.max(1.0f, wh / 300f) * 1.15f * SZ();
		int maxW = (int) (ww * 0.26f);
		int col = ModConfig.lcol(ModConfig.lyricsOld, 1);
		float f = Math.min(1f, (System.currentTimeMillis() % 1000000) / 1f);
		for (int side = 0; side < 2; side++) {
			String t = side == 0 ? l : r;
			if (t.isEmpty()) continue;
			float s2 = sc;
			while (s2 > 0.6f && (fwTracked(t) * s2) > maxW) s2 -= 0.05f;
			int cx = side == 0 ? 14 + (int) (fwTracked(t) * s2 / 2f) : ww - 14 - (int) (fwTracked(t) * s2 / 2f);
			tracked(c, t, cx, wh / 2, s2, col, 190, false);
		}
	}

	private static float fwTracked(String s) {
		float gap = ModConfig.lyricsFont == 0 ? 1.0f : 1.6f, w = 0;
		for (int i = 0; i < s.length(); i++) w += fw(String.valueOf(s.charAt(i))) + gap;
		return w - gap;
	}

	/** Eine Zeile mit Wort-fuer-Wort-Leuchten. align: 0 mittig, 1 links gedimmt, 2 mittig gedimmt (andere Zeile), 3 links aktuell. Gesungene Woerter in der Farbe "aktuell", kommende in der Farbe "schon gesungen" gedaempft. */
	private static void karaoke(DrawContext c, int idx, int ax, int y, float sc, int align, int maxW, int alpha) {
		if (idx < 0 || idx >= texts.length) return;
		String[] ws = split(texts[idx]);
		if (ws.length == 0) { if (align == 0 || align == 3) big(c, "\u266A", ax, y, sc, 0xFFFFFF, 255); return; }
		var tr = MinecraftClient.getInstance().textRenderer;
		sc *= SZ(); alpha = A(alpha);
		boolean active = align == 0 || align == 3, left = align == 1 || align == 3;
		while (true) { int tw = 0; for (String w : ws) tw += fw(w) + fw(" "); if (tw * sc <= maxW || sc < 0.7f) break; sc -= 0.1f; }
		int tot = 0; for (String w : ws) tot += fw(w) + fw(" ");
		long[] st = active ? starts(idx, ws) : null;
		long p = pos();
		var ms = c.getMatrices();
		ms.push();
		ms.translate(left ? ax : ax - tot * sc / 2f, y, 0);
		ms.scale(sc, sc, 1f);
		int x = 0, al = Math.max(0, Math.min(255, alpha)), cur = ModConfig.lcol(ModConfig.lyricsCur, 0), old = ModConfig.lcol(ModConfig.lyricsOld, 1);
		for (int i = 0; i < ws.length; i++) {
			boolean sung = active ? st[i] <= p : false;
			int rgb = active ? (sung ? cur : Ui.mix(0xFF000000 | old, 0xFF5A6A88, 0.55f) & 0xFFFFFF) : Ui.mix(0xFF000000 | old, 0xFF5A6A88, 0.35f) & 0xFFFFFF;
			var t = sung ? ft(ws[i]).copy().formatted(net.minecraft.util.Formatting.BOLD) : ft(ws[i]);
			if (ModConfig.lyricsFx != 3) c.drawText(tr, t, x + 1, 1, (al * 6 / 10) << 24, false);
			c.drawText(tr, t, x, 0, al << 24 | rgb, false);
			x += fw(ws[i]) + fw(" ");
		}
		ms.pop();
	}

	/** Song-Karte als verschiebbares HUD-Widget (Ursprung 0,0; Breite 170). preview = Beispieldaten im HUD-Editor. */
	public static void cardWidget(DrawContext c, MinecraftClient mc, boolean preview) {
		if (!ModConfig.lyricsCard) return;
		if (preview) { cardDraw(c, mc, "Song title", "Artist", null, 0.4f, new String[] {"Your current", "line is shown here"}, 1, 0); return; }
		if (mc.player == null || !ModConfig.isOn("lyrics") || mc.options.hudHidden) return;
		load();
		if (title.isEmpty()) return;
		int idx = times.length == 0 ? -1 : current();
		card(c, mc, idx);
	}

	private static void cardDraw(DrawContext c, MinecraftClient mc, String ti, String ar, net.minecraft.util.Identifier cov, float prog, String[] ws, int sungN, int unused) {
		var tr = mc.textRenderer;
		int cw = 170, pad = 5, cv = cov != null ? 28 : 0;
		c.fill(0, 0, cw, 38, fa(0x70000000));
		c.fill(0, 0, 1, 38, fa(0xFF000000 | Theme.accent));
		if (cov != null) c.drawTexture(net.minecraft.client.render.RenderLayer::getGuiTextured, cov, pad, 5, 0f, 0f, 28, 28, 28, 28);
		int tx = pad + (cv > 0 ? cv + 5 : 0), tw = cw - tx - pad;
		c.drawText(tr, Ui.t(Ui.trim(ti, tw)).copy().formatted(net.minecraft.util.Formatting.BOLD), tx, 5, fa(0xFFFFFFFF), true);
		c.drawText(tr, Ui.t(Ui.trim(ar, tw)), tx, 16, fa(0xFFB4C3D8), false);
		c.fill(tx, 29, tx + tw, 30, fa(0x55FFFFFF));
		c.fill(tx, 29, tx + (int) (tw * prog), 30, fa(0xFF000000 | Theme.accent));
		int cx = 1, ly = 44;
		for (int i = 0; i < ws.length; i++) {
			boolean sung = i < sungN;
			int wpx = Ui.w(ws[i]) + Math.max(3, Ui.w("a") / 2 + 2);
			if (cx + wpx > cw + 2 && cx > 1) { cx = 1; ly += 11; }
			c.drawText(tr, sung ? Ui.t(ws[i]).copy().formatted(net.minecraft.util.Formatting.BOLD) : Ui.t(ws[i]), cx, ly, fa(sung ? (0xFF000000 | ModConfig.lcol(ModConfig.lyricsCur, 0)) : 0xFF7F8CA3), true);
			cx += wpx;
		}
	}

	private static void card(DrawContext c, MinecraftClient mc, int idx) {
		float prog = durMs > 0 ? Math.max(0f, Math.min(1f, pos() / (float) durMs)) : 0f;
		if (times.length == 0) { cardDraw(c, mc, title, artist, coverId, prog, new String[] {status.isEmpty() ? "no lyrics found" : status}, 0, 0); return; }
		String[] ws = idx < 0 ? new String[0] : split(texts[idx]);
		int sung = 0;
		if (ws.length > 0) { long[] st = starts(idx, ws); long p = pos(); for (int i = 0; i < ws.length; i++) if (st[i] <= p) sung = i + 1; }
		cardDraw(c, mc, title, artist, coverId, prog, ws.length == 0 ? new String[] {"\u266A"} : ws, sung, 0);
	}
}
