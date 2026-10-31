package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/** Eigenes, einstellbares Fadenkreuz (Stil, Groesse, Dicke, Luecke, Farbe, Kontur, Spreizen beim Bewegen). */
public final class Crosshair {
	private Crosshair() {}
	public static final String[] STYLES = {"Cross", "Plus", "Dot", "Circle", "X", "Square", "T-shape"};
	private static float spread;

	/** true = Vanilla-Fadenkreuz uebersprungen. */
	public static boolean draw(DrawContext c) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (!ModConfig.isOn("crosshair") || mc.player == null || !mc.options.getPerspective().isFirstPerson() || mc.options.hudHidden) return false;
		int cx = c.getScaledWindowWidth() / 2, cy = c.getScaledWindowHeight() / 2;
		float target = 0f;
		if (ModConfig.crossDyn) {
			var v = mc.player.getVelocity();
			target = (float) Math.min(5.0, Math.sqrt(v.x * v.x + v.z * v.z) * 28.0) + (mc.player.isOnGround() ? 0f : 2f);
		}
		spread += (target - spread) * 0.2f;
		int col = 0xFF000000 | ModConfig.lcol(ModConfig.crossCol, 10), out = 0x88000000;
		int g = ModConfig.crossGap + Math.round(spread), L = ModConfig.crossSize, t = ModConfig.crossThick, h = t / 2;
		boolean ol = ModConfig.crossOutline;
		switch (ModConfig.crossStyle) {
			case 0, 1, 6 -> {
				boolean plus = ModConfig.crossStyle == 1, tee = ModConfig.crossStyle == 6;
				if (plus) g = 0;
				bar(c, cx - g - L, cy - h, L, t, col, out, ol);          // links
				bar(c, cx + g, cy - h, L, t, col, out, ol);              // rechts
				if (!tee) bar(c, cx - h, cy - g - L, t, L, col, out, ol); // oben
				bar(c, cx - h, cy + g, t, L, col, out, ol);              // unten
				if (plus) bar(c, cx - h, cy - h, t, t, col, out, ol);
			}
			case 2 -> { int r = Math.max(1, t); if (ol) c.fill(cx - h - 1, cy - h - 1, cx - h + r + 1, cy - h + r + 1, out); c.fill(cx - h, cy - h, cx - h + r, cy - h + r, col); }
			case 3 -> {
				int r = Math.max(3, L / 2 + g);
				for (int i = 0; i < 48; i++) { double a = i / 48.0 * Math.PI * 2; int px = cx + (int) Math.round(Math.cos(a) * r), py = cy + (int) Math.round(Math.sin(a) * r);
					if (ol) c.fill(px - 1, py - 1, px + t + 1, py + t + 1, out); }
				for (int i = 0; i < 48; i++) { double a = i / 48.0 * Math.PI * 2; int px = cx + (int) Math.round(Math.cos(a) * r), py = cy + (int) Math.round(Math.sin(a) * r); c.fill(px, py, px + t, py + t, col); }
			}
			case 4 -> {
				for (int pass = ol ? 0 : 1; pass < 2; pass++) for (int i = g; i < g + L; i++) for (int[] d : new int[][] {{1, 1}, {-1, 1}, {1, -1}, {-1, -1}}) {
					int px = cx + d[0] * i, py = cy + d[1] * i, e = pass == 0 ? 1 : 0;
					c.fill(px - e, py - e, px + t + e, py + t + e, pass == 0 ? out : col);
				}
			}
			default -> {
				int r = Math.max(3, L / 2 + g);
				if (ol) { c.fill(cx - r - 1, cy - r - 1, cx + r + t + 1, cy - r + t + 1, out); c.fill(cx - r - 1, cy + r - 1, cx + r + t + 1, cy + r + t + 1, out); c.fill(cx - r - 1, cy - r, cx - r + t + 1, cy + r + t, out); c.fill(cx + r - 1, cy - r, cx + r + t + 1, cy + r + t, out); }
				c.fill(cx - r, cy - r, cx + r + t, cy - r + t, col); c.fill(cx - r, cy + r, cx + r + t, cy + r + t, col);
				c.fill(cx - r, cy - r, cx - r + t, cy + r + t, col); c.fill(cx + r, cy - r, cx + r + t, cy + r + t, col);
			}
		}
		return true;
	}

	private static void bar(DrawContext c, int x, int y, int w, int h, int col, int out, boolean ol) {
		if (ol) c.fill(x - 1, y - 1, x + w + 1, y + h + 1, out);
		c.fill(x, y, x + w, y + h, col);
	}
}
