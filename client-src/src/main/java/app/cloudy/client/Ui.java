package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/** Kleine Zeichenhelfer nur mit fill() – laufen dadurch auf allen Minecraft-Versionen gleich. */
public final class Ui {
	private Ui() {}

	// ---- eigene Schrift (Poppins, assets/cloudy-client/font/ui.json) statt der Minecraft-Schrift ----
	public static final Style UIFONT = Style.EMPTY.withFont(Identifier.of("cloudy-client", "ui"));
	public static Text t(String s) { return Text.literal(s).setStyle(UIFONT); }
	private static Text f(Text t) { return t.copy().setStyle(UIFONT.withParent(t.getStyle())); }
	private static net.minecraft.client.font.TextRenderer tr() { return MinecraftClient.getInstance().textRenderer; }
	public static int w(String s) { return tr().getWidth(t(s)); }
	public static String trim(String s, int max) { return w(s) <= max ? s : tr().trimToWidth(t(s), Math.max(0, max - w("..."))).getString() + "..."; }
	public static void txt(DrawContext c, String s, int x, int y, int col) { c.drawText(tr(), t(s), x, y, col, true); }
	public static void txt(DrawContext c, Text s, int x, int y, int col) { c.drawText(tr(), f(s), x, y, col, true); }
	public static void ctr(DrawContext c, String s, int cx, int y, int col) { c.drawText(tr(), t(s), cx - w(s) / 2, y, col, true); }
	public static void ctr(DrawContext c, Text s, int cx, int y, int col) { Text q = f(s); c.drawText(tr(), q, cx - tr().getWidth(q) / 2, y, col, true); }

	/** Grossbuchstaben mit Abstand (wie die Beschriftungen bei Lunar), zentriert. */
	public static void sp(DrawContext c, String s, int cx, int y, int col) {
		int tot = -2;
		for (int i = 0; i < s.length(); i++) tot += w(String.valueOf(s.charAt(i))) + 2;
		int x = cx - tot / 2;
		for (int i = 0; i < s.length(); i++) { String ch = String.valueOf(s.charAt(i)); c.drawText(tr(), t(ch), x, y, col, true); x += w(ch) + 2; }
	}

	/** Soll der Cloudy-Stil auf den aktuellen Bildschirm angewendet werden? Im Hauptmenue auf allen, im Spiel nur beim Pausemenue und den Optionen. */
	public static boolean styled() {
		if (!ModConfig.menu) return false;
		MinecraftClient mc = MinecraftClient.getInstance();
		net.minecraft.client.gui.screen.Screen s = mc.currentScreen;
		if (s == null) return false;
		if (mc.world == null) return true;
		return s instanceof net.minecraft.client.gui.screen.GameMenuScreen || s instanceof net.minecraft.client.gui.screen.option.OptionsScreen || s instanceof net.minecraft.client.gui.screen.option.GameOptionsScreen;
	}

	public static final int PANEL = 0xCC0F2038, PANEL2 = 0xAA16304F;
	public static int ACCENT = 0xFF4AA3FF;

	public static int mix(int a, int b, float t) {
		int r = (int) (((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t), g = (int) (((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t), bl = (int) ((a & 255) * (1 - t) + (b & 255) * t);
		return 0xFF000000 | r << 16 | g << 8 | bl;
	}

	public static void sky(DrawContext c, int w, int h) {
		Theme.load();
		int step = Math.max(4, h / 48); // wenige breite Streifen statt hunderter schmaler: spart viele Zeichenaufrufe pro Bild
		for (int y = 0; y < h; y += step) c.fill(0, y, w, Math.min(h, y + step), mix(Theme.sky1, Theme.sky2, (float) y / h));
		long t = System.currentTimeMillis();
		if (Theme.dark) { // Nachthimmel: funkelnde Sterne und ein Mond
			for (int i = 0; i < 45; i++) {
				int x = (int) ((i * 7919L + 13) % Math.max(1, w)), y = (int) ((i * 104729L + 7) % Math.max(1, h * 3 / 4));
				float tw = 0.5f + 0.5f * (float) Math.sin(t / 700.0 + i * 1.7);
				int a = (int) (60 + 150 * tw);
				c.fill(x, y, x + (i % 5 == 0 ? 2 : 1), y + (i % 5 == 0 ? 2 : 1), a << 24 | 0xFFFFFF);
			}
			int mx = w - Math.max(50, w / 8), my = Math.max(24, h / 7), r = Math.max(8, Math.min(w, h) / 22);
			c.fill(mx - r, my - r / 2, mx + r, my + r / 2, 0xFFEAF2FF); c.fill(mx - r / 2, my - r, mx + r / 2, my + r, 0xFFEAF2FF); c.fill(mx - r + 2, my - r + 2, mx + r - 2, my + r - 2, 0xFFEAF2FF);
		}
		int cloud = Theme.dark ? 0x33AFC4FF : 0x55FFFFFF;
		for (int i = 0; i < 6; i++) {
			int span = w + 260, x = (int) (((t / (28 + i * 9)) + i * 211) % span) - 130, y = h / 7 + i * h / 9;
			cloud(c, x, y, 40 + (i % 3) * 16, cloud);
		}
		c.fill(0, h - Math.max(2, h / 40), w, h, mix(Theme.sky2, Theme.accent, 0.25f)); // Horizontlinie im Theme-Farbton
	}

	/** Themed landscape: sky, sun/moon, drifting clouds, three parallax mountain ridges and pine silhouettes in the chosen theme colours. */
	/** Weiches, klares Licht (konzentrische Halbtransparente Kreise). */
	private static void glow(DrawContext c, int cx, int cy, int r, int rgb, int alpha) {
		int rows = Math.max(4, r / 36);
		for (int k = 0; k < 7; k++) {
			int rr = r - k * r / 8, a = alpha;
			for (int yy = -rr; yy < rr; yy += rows) {
				int half = (int) Math.sqrt((double) rr * rr - (double) yy * yy);
				c.fill(cx - half, cy + yy, cx + half, cy + Math.min(rr, yy + rows), a << 24 | (rgb & 0xFFFFFF));
			}
		}
	}

	/** Klarer Titelhintergrund im gewaehlten Launcher-Theme: Verlauf, weiche Lichtkugeln, sanfte Huegel. */
	public static void scene(DrawContext c, int w, int h) {
		Theme.load();
		if (ModConfig.bgStyle == 1) { landscape(c, w, h); return; }
		int s1 = Theme.tSky1, s2 = Theme.tSky2;
		boolean dk = Theme.tDark;
		int step = Math.max(2, h / 100);
		for (int y = 0; y < h; y += step) c.fill(0, y, w, Math.min(h, y + step), mix(s1, s2, (float) y / h));
		long t = System.currentTimeMillis();
		int acc = Theme.accent, lite = dk ? mix(acc, 0xFFFFFFFF, 0.25f) : 0xFFFFFFFF;
		int m = Math.min(w, h);
		for (int i = 0; i < 4; i++) {
			int gx = (int) (w * (0.12 + 0.25 * i) + Math.sin(t / 7000.0 + i * 2.1) * w * 0.05), gy = (int) (h * (0.3 + 0.12 * i) + Math.cos(t / 9000.0 + i) * h * 0.04);
			glow(c, gx, gy, (int) (m * (0.55 + 0.09 * i)), i == 1 ? lite : acc, dk ? 12 : 16);
		}
		c.fillGradient(0, h - h / 5, w, h, 0x00000000, dk ? 0x88000000 : 0x33000000);
	}

	// ---- gemeinsame Bausteine fuer die Menues (dunkles Glas, Akzentlinie) ----
	public static boolean in(int mx, int my, int x, int y, int w, int h) { return mx >= x && mx < x + w && my >= y && my < y + h; }

	public static void glass(DrawContext c, int x, int y, int w, int h) {
		c.fill(x, y, x + w, y + h, 0xA00C1224);
		c.fill(x, y, x + w, y + 1, 0x33FFFFFF);
	}

	public static void button(DrawContext c, net.minecraft.client.font.TextRenderer tr, int x, int y, int w, int h, String label, boolean hv, boolean primary) {
		c.fill(x, y, x + w, y + h, primary ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : (hv ? 0xE62A3558 : 0xCC1A2342));
		if (hv && !primary) c.fill(x, y + h - 2, x + w, y + h, Theme.accent);
		Ui.ctr(c, label, x + w / 2, y + (h - 8) / 2, primary ? 0xFF0B1226 : 0xFFFFFFFF);
	}

	public static void toggle(DrawContext c, int x, int y, boolean on) {
		c.fill(x, y, x + 24, y + 12, on ? Theme.accent : 0xFF39425F);
		int k = on ? x + 13 : x + 1;
		c.fill(k, y + 1, k + 10, y + 11, 0xFFFFFFFF);
	}

	public static void cloud(DrawContext c, int x, int y, int s, int col) {
		c.fill(x, y + s / 3, x + s * 2, y + s * 2 / 3, col);
		c.fill(x + s / 4, y + s / 6, x + s + s / 4, y + s / 3, col);
		c.fill(x + s / 2, y, x + s + s / 2, y + s / 6, col);
		c.fill(x + s + s / 4, y + s / 5, x + s * 2 - s / 6, y + s / 3, col);
	}

	private static final String[][] FONT = {
		{"01110", "10001", "10000", "10000", "10000", "10001", "01110"},
		{"10000", "10000", "10000", "10000", "10000", "10000", "11111"},
		{"01110", "10001", "10001", "10001", "10001", "10001", "01110"},
		{"10001", "10001", "10001", "10001", "10001", "10001", "01110"},
		{"11110", "10001", "10001", "10001", "10001", "10001", "11110"},
		{"10001", "10001", "01010", "00100", "00100", "00100", "00100"}};

	/** Theme-Landschaft: Himmel im Theme, Sonne/Mond, Wolken, drei versetzte Berglagen und Tannen als Silhouette. */
	public static void landscape(DrawContext c, int w, int h) {
		Theme.load();
		int s1 = Theme.tSky1, s2 = Theme.tSky2, acc = Theme.accent;
		boolean dk = Theme.tDark;
		int step = Math.max(2, h / 90);
		for (int y = 0; y < h; y += step) c.fill(0, y, w, Math.min(h, y + step), mix(s1, s2, (float) y / h));
		long t = System.currentTimeMillis();
		if (dk) for (int i = 0; i < 50; i++) {
			int x = (int) ((i * 7919L + 13) % Math.max(1, w)), y = (int) ((i * 104729L + 7) % Math.max(1, h / 2));
			int a = (int) (50 + 140 * (0.5f + 0.5f * (float) Math.sin(t / 800.0 + i * 1.7)));
			c.fill(x, y, x + (i % 6 == 0 ? 2 : 1), y + (i % 6 == 0 ? 2 : 1), a << 24 | 0xFFFFFF);
		}
		int r = Math.max(10, Math.min(w, h) / 16), mx = w - Math.max(70, w / 9), my = Math.max(30, h / 8);
		c.fill(mx - r, my - r + 3, mx + r, my + r - 3, dk ? 0xFFEAF2FF : 0xFFFFF1B8); c.fill(mx - r + 3, my - r, mx + r - 3, my + r, dk ? 0xFFEAF2FF : 0xFFFFF1B8);
		int cl = dk ? 0x33BFD4FF : 0x66FFFFFF;
		for (int i = 0; i < 5; i++) { int span = w + 300, x = (int) (((t / (40 + i * 11)) + i * 257) % span) - 150, y = h / 6 + i * h / 11; cloud(c, x, y, 36 + (i % 3) * 18, cl); }
		int px = Math.max(6, w / 150);
		for (int layer = 0; layer < 3; layer++) {
			int col = mix(mix(s2, acc, 0.35f), 0xFF03101A, 0.30f + layer * 0.28f);
			double base = h * (0.60 + layer * 0.09), amp = h * (0.07 - layer * 0.012), off = t / (9000.0 + layer * 4000.0), ph = layer * 2.3;
			for (int x = 0; x < w; x += px) {
				double v = Math.sin(x * 0.0045 * (1 + layer * 0.5) + ph + off) + 0.5 * Math.sin(x * 0.011 + ph * 1.7) + 0.25 * Math.sin(x * 0.027 + ph);
				int top = (int) (base - v * amp); top -= top % px;
				c.fill(x, top, x + px, h, col);
			}
		}
		int dark = 0xFF02080F;
		for (int x = -px * 2, i = 0; x < w; x += px * 6 + (i * 37 % (px * 4)), i++) {
			int th = h / 7 + (i * 53) % (h / 9), base = h - h / 12 + (i % 3) * px * 2, tiers = Math.max(4, th / (px * 3));
			for (int k = 0; k < tiers; k++) { int hw = px * (1 + (k + 1) * 3 / 2) / 2 + px, ty = base - th + k * (th / tiers); c.fill(x - hw, ty, x + hw, ty + th / tiers + 1, dark); }
			c.fill(x - px / 2, base, x + px / 2, h, dark);
		}
		c.fill(0, h - h / 12, w, h, dark);
	}

	/** Pixel-Logo (fuer die Theme-Landschaft): C L O U D Y aus Bloecken mit Schatten und hellem Verlauf. */
	public static void logoPixel(DrawContext c, int cx, int y, int u) {
		String word = "CLOUDY"; String[] keys = {"C", "L", "O", "U", "D", "Y"};
		int cell = Math.max(3, u), gap = cell, total = (6 * 5 + 5) * cell, x0 = cx - total / 2;
		for (int i = 0; i < 6; i++) {
			String[] g = FONT[i];
			for (int gy = 0; gy < 7; gy++) for (int gx = 0; gx < 5; gx++) {
				if (g[gy].charAt(gx) != '1') continue;
				int px = x0 + (i * 6 + gx) * cell, py = y + gy * cell;
				c.fill(px + cell / 3, py + cell / 3, px + cell + cell / 3, py + cell + cell / 3, 0x66000000);
				c.fill(px, py, px + cell, py + cell, mix(0xFFFFFFFF, mix(Theme.accent, 0xFFFFFFFF, 0.5f), gy / 7f));
			}
		}
	}

	/** Sauberes Cloudy-Logo (Poppins, skaliert) statt Pixelbuchstaben, zentriert bei cx. u = Groessenstufe wie bisher. */
	public static void logo(DrawContext c, int cx, int y, int u) {
		if (ModConfig.bgStyle == 1) { logoPixel(c, cx, y, Math.max(3, u)); return; }
		float sc = Math.max(1.6f, u * 0.82f);
		String s = "Cloudy";
		float w = w(s) * sc;
		net.minecraft.client.util.math.MatrixStack m = c.getMatrices();
		for (int pass = 0; pass < 3; pass++) {
			m.push();
			float dx = pass == 0 ? sc * 0.25f : pass == 2 ? 0.5f : 0f, dy = pass == 0 ? sc * 0.35f : 0f;
			m.translate(cx - w / 2f + dx, y + dy, 0);
			m.scale(sc, sc, 1f);
			int col = pass == 0 ? 0x66000000 : pass == 1 ? 0xFFFFFFFF : 0xFFF3F9FF;
			c.drawText(tr(), t(s), 0, 0, col, false);
			m.pop();
		}
	}

	/** Sauberes Bild eines 3D-Cosmetics (statt Pixel-Icon), passend in ein Quadrat der Kantenlaenge box. */
	public static boolean sprite(DrawContext c, String id, int x, int y, int box) {
		try {
			int[] sz = new int[2];
			net.minecraft.util.Identifier t = ZZ4.ico(id, sz);
			if (t == null || sz[0] <= 0) return false;
			float k = Math.min((float) box / sz[0], (float) box / sz[1]);
			int dw = Math.max(1, Math.round(sz[0] * k)), dh = Math.max(1, Math.round(sz[1] * k));
			c.drawTexture(net.minecraft.client.render.RenderLayer::getGuiTextured, t, x + (box - dw) / 2, y + (box - dh) / 2, 0f, 0f, dw, dh, dw, dh);
			return true;
		} catch (Throwable e) { return false; }
	}

	/** Kleines Item-Bild (Kante = size) im 16er-Raster. */
	public static void icon(DrawContext c, String id, int x, int y, int size) {
		String cat = Cosmetics.catOf(id);
		if (cat == null) return;
		int a = Cosmetics.color(id, 0), b = Cosmetics.color(id, 1), d = Cosmetics.color(id, 2), u = Math.max(1, size / 16);
		switch (cat) {
			case "hat" -> {
				switch (id) {
					case "hat-wizard", "hat-witch" -> { for (int i = 0; i < 8; i++) { int gw = 2 + i; r(c, x, y, u, 8 - gw / 2, 2 + i, gw, 1, i % 2 == 0 ? a : b); } r(c, x, y, u, 1, 10, 14, 2, b); r(c, x, y, u, 4, 8, 8, 1, d); }
					case "hat-santa" -> { for (int i = 0; i < 8; i++) { int gw = 4 + i; r(c, x, y, u, 7 - gw / 2 + i / 3, 2 + i, gw, 1, a); } r(c, x, y, u, 2, 10, 12, 2, 0xFFFFFFFF); r(c, x, y, u, 11, 1, 3, 3, 0xFFFFFFFF); }
					case "hat-crown" -> { r(c, x, y, u, 2, 6, 12, 6, a); r(c, x, y, u, 2, 3, 2, 3, a); r(c, x, y, u, 7, 2, 2, 4, a); r(c, x, y, u, 12, 3, 2, 3, a); r(c, x, y, u, 2, 10, 12, 2, b); r(c, x, y, u, 7, 8, 2, 2, 0xFFE23B3B); }
					case "hat-halo", "hat-haloblack" -> { r(c, x, y, u, 3, 5, 10, 2, a); r(c, x, y, u, 3, 9, 10, 2, a); r(c, x, y, u, 2, 6, 2, 4, a); r(c, x, y, u, 12, 6, 2, 4, a); r(c, x, y, u, 4, 7, 8, 2, 0x44FFF7B0); }
					default -> { r(c, x, y, u, 4, 2, 8, 9, a); r(c, x, y, u, 1, 11, 14, 2, a); r(c, x, y, u, 4, 8, 8, 2, d); r(c, x, y, u, 1, 12, 14, 1, b); }
				}
			}
			case "wings" -> {
				for (int i = 0; i < 6; i++) { int len = 6 - i / 2; r(c, x, y, u, 1 + i / 2, 3 + i * 2, len, 2, i % 2 == 0 ? a : b); r(c, x, y, u, 15 - len - i / 2, 3 + i * 2, len, 2, i % 2 == 0 ? a : b); }
				r(c, x, y, u, 7, 3, 2, 10, d);
			}
			case "shield" -> {
				r(c, x, y, u, 3, 2, 10, 2, b); r(c, x, y, u, 3, 4, 10, 6, a); r(c, x, y, u, 4, 10, 8, 2, a); r(c, x, y, u, 6, 12, 4, 2, a);
				r(c, x, y, u, 3, 2, 1, 8, b); r(c, x, y, u, 12, 2, 1, 8, b); r(c, x, y, u, 7, 4, 2, 8, d); r(c, x, y, u, 5, 6, 6, 2, d);
			}
			default -> { // cape
				for (int i = 0; i < 12; i++) r(c, x, y, u, 4 - i / 8, 2 + i, 8 + i / 4, 1, mix(a, b, i / 11f));
				r(c, x, y, u, 4, 1, 8, 2, 0xFFFFFFFF); r(c, x, y, u, 4, 1, 8, 1, 0xFFCFE6FF);
			}
		}
	}

	private static void r(DrawContext c, int x, int y, int u, int gx, int gy, int gw, int gh, int col) {
		c.fill(x + gx * u, y + gy * u, x + (gx + gw) * u, y + (gy + gh) * u, col);
	}

	/** Mini-Spielerfigur mit angelegten Items (Vorschau). */
	public static void avatar(DrawContext c, int cx, int top, int u) {
		String cape = Cosmetics.cape, hat = Cosmetics.hat, wings = Cosmetics.wings, shield = Cosmetics.shield;
		int skin = 0xFFE0AC84, shirt = 0xFF4AA3FF, pants = 0xFF3A4A8A, hair = 0xFF4A3220;
		if (wings != null) { int a = Cosmetics.color(wings, 0), b = Cosmetics.color(wings, 1); for (int i = 0; i < 5; i++) { int len = 8 - i; c.fill(cx - 4 * u - len * u, top + (9 + i * 2) * u / 1, cx - 4 * u, top + (11 + i * 2) * u, i % 2 == 0 ? a : b); c.fill(cx + 4 * u, top + (9 + i * 2) * u, cx + 4 * u + len * u, top + (11 + i * 2) * u, i % 2 == 0 ? a : b); } }
		if (cape != null) c.fill(cx - 4 * u, top + 8 * u, cx + 4 * u, top + 20 * u, mix(Cosmetics.color(cape, 0), Cosmetics.color(cape, 1), 0.4f));
		c.fill(cx - 4 * u, top, cx + 4 * u, top + 8 * u, skin);
		c.fill(cx - 4 * u, top, cx + 4 * u, top + 2 * u, hair);
		c.fill(cx - 3 * u, top + 4 * u, cx - 1 * u, top + 5 * u, 0xFF2B3A66); c.fill(cx + 1 * u, top + 4 * u, cx + 3 * u, top + 5 * u, 0xFF2B3A66);
		c.fill(cx - 4 * u, top + 8 * u, cx + 4 * u, top + 20 * u, shirt);
		c.fill(cx - 8 * u, top + 8 * u, cx - 4 * u, top + 20 * u, skin); c.fill(cx + 4 * u, top + 8 * u, cx + 8 * u, top + 20 * u, skin);
		c.fill(cx - 4 * u, top + 20 * u, cx, top + 32 * u, pants); c.fill(cx, top + 20 * u, cx + 4 * u, top + 32 * u, pants);
		if (cape != null) c.fill(cx - 4 * u, top + 9 * u, cx + 4 * u, top + 10 * u, 0xFFFFFFFF);
		if (shield != null) icon(c, shield, cx - 15 * u, top + 11 * u, 8 * u);
		if (hat != null) icon(c, hat, cx - 7 * u, top - 7 * u, 14 * u);
	}
}
