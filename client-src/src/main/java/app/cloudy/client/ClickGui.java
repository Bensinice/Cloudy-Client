package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.HashMap;
import java.util.Map;

/**
 * Cheat-Menue im Client-Stil: Kategorien links, Suche, Modulliste mit animierten Schaltern, Beschreibung und Zustand.
 * Das Fenster laesst sich an der Titelleiste verschieben (Position wird gemerkt), die Dichte (kompakt / normal) ist umschaltbar.
 * Farben kommen aus dem gewaehlten Launcher-Theme.
 */
public class ClickGui extends Screen {
	private static final String[] CATS = {"All", "Combat", "Movement", "Render"};
	private static int cat = 0, wx = Integer.MIN_VALUE, wy = 0, scroll = 0;
	private static boolean compact = false;
	private static String query = "";
	private final Map<Module, Float> anim = new HashMap<>();
	private boolean focus, dragging, wasDown;
	private int dragX, dragY, hoverRow = -1;
	private long openedAt = System.currentTimeMillis();

	public ClickGui() { super(Text.literal("Cloudy")); }

	private int ww() { return Math.min(this.width - 12, 440); }
	private int wh() { return Math.min(this.height - 12, 270); }
	private int row() { return compact ? 20 : 28; }

	@Override protected void init() {
		if (wx == Integer.MIN_VALUE) { wx = (this.width - ww()) / 2; wy = (this.height - wh()) / 2; }
		wx = Math.max(2, Math.min(this.width - ww() - 2, wx)); wy = Math.max(2, Math.min(this.height - wh() - 2, wy));
		openedAt = System.currentTimeMillis();
	}

	private java.util.List<Module> list() {
		java.util.List<Module> l = new java.util.ArrayList<>();
		for (Module m : Modules.all) if ((cat == 0 || m.category.equals(CATS[cat])) && m.name.toLowerCase().contains(query.toLowerCase())) l.add(m);
		return l;
	}

	@Override public void renderBackground(DrawContext c, int mx, int my, float delta) {
		float a = Math.min(1f, (System.currentTimeMillis() - openedAt) / 180f);
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, ((int) (0x88 * a) << 24) | 0x040812);
	}

	private boolean shiftWas = true;

	@Override public void render(DrawContext c, int mx, int my, float delta) {
		try { boolean d = org.lwjgl.glfw.GLFW.glfwGetKey(MinecraftClient.getInstance().getWindow().getHandle(), 344) == 1; if (d && !shiftWas && !focus && System.currentTimeMillis() - openedAt > 300) { this.close(); return; } shiftWas = d; } catch (Throwable ignored) {}
		super.render(c, mx, my, delta);
		Theme.load();
		int x = wx, y = wy, w = ww(), h = wh(), side = 92;
		Ui.glass(c, x, y, w, h);
		c.fill(x, y, x + w, y + 22, 0xAA0B1226);
		c.fill(x, y + 21, x + w, y + 22, Theme.accent);
		Ui.txt(c, "CLOUDY", x + 10, y + 7, Theme.accent);
		Ui.txt(c, "CLIENT", x + 10 + Ui.w("CLOUDY") + 5, y + 7, 0xFFFFFFFF);
		// Kategorien
		c.fill(x, y + 22, x + side, y + h, 0x77060B18);
		for (int i = 0; i < CATS.length; i++) {
			int cy = y + 30 + i * 22;
			boolean sel = cat == i, hv = Ui.in(mx, my, x + 6, cy, side - 12, 18);
			int n = 0; for (Module m : Modules.all) if (i == 0 || m.category.equals(CATS[i])) n++;
			c.fill(x + 6, cy, x + side - 6, cy + 18, sel ? Ui.mix(0xFF1B2A55, Theme.accent, 0.65f) : hv ? 0x66283760 : 0x33141E3A);
			if (sel) c.fill(x + 6, cy, x + 8, cy + 18, Theme.accent);
			Ui.txt(c, CATS[i].toUpperCase(), x + 14, cy + 5, sel ? 0xFFFFFFFF : 0xFFB8C6E8);
			Ui.txt(c, String.valueOf(n), x + side - 8 - Ui.w(String.valueOf(n)), cy + 5, 0xFF7F8CB0);
		}
		// Dichte-Schalter unten links
		boolean hd = Ui.in(mx, my, x + 6, y + h - 24, side - 12, 18);
		c.fill(x + 6, y + h - 24, x + side - 6, y + h - 6, hd ? 0x88283760 : 0x55202C4C);
		Ui.sp(c, compact ? "LAYOUT: COMPACT" : "LAYOUT: NORMAL", x + side / 2, y + h - 19, 0xFFD6E2FF);
		// Suche
		int sx = x + side + 8, sw = w - side - 16;
		c.fill(sx, y + 28, sx + sw, y + 46, focus ? 0xAA25335C : 0x88202C4C);
		c.fill(sx, y + 45, sx + sw, y + 46, focus ? Theme.accent : 0x33FFFFFF);
		Ui.txt(c, query.isEmpty() && !focus ? "Search modules..." : query + (focus && System.currentTimeMillis() / 500 % 2 == 0 ? "_" : ""), sx + 6, y + 33, query.isEmpty() ? 0xFF7F8CB0 : 0xFFFFFFFF);
		// Liste
		var l = list();
		int top = y + 52, bottom = y + h - 6, rh = row();
		int maxScroll = Math.max(0, l.size() * rh - (bottom - top));
		scroll = Math.max(0, Math.min(scroll, maxScroll));
		hoverRow = -1;
		c.enableScissor(sx, top, sx + sw, bottom);
		for (int i = 0; i < l.size(); i++) {
			Module m = l.get(i);
			int ry = top + i * rh - scroll;
			if (ry + rh < top || ry > bottom) continue;
			boolean hv = Ui.in(mx, my, sx, ry, sw, rh - 2) && my >= top && my < bottom;
			if (hv) hoverRow = i;
			float a = anim.getOrDefault(m, m.enabled ? 1f : 0f);
			a += ((m.enabled ? 1f : 0f) - a) * 0.28f; anim.put(m, a);
			c.fill(sx, ry, sx + sw, ry + rh - 2, hv ? 0x88283760 : 0x66141E3A);
			c.fill(sx, ry, sx + 2, ry + rh - 2, Ui.mix(0xFF39425F, Theme.accent, a));
			Ui.txt(c, m.name, sx + 8, ry + (compact ? 6 : 5), Ui.mix(0xFFDDE6FA, 0xFF8CFFB0, a));
			if (!compact) Ui.txt(c, Ui.trim(m.desc, sw - 70), sx + 8, ry + 16, 0xFF8794B8);
			int tx = sx + sw - 32, ty = ry + (rh - 2 - 12) / 2;
			c.fill(tx, ty, tx + 24, ty + 12, Ui.mix(0xFF39425F, Theme.accent, a));
			int kx = tx + 1 + Math.round(12 * a);
			c.fill(kx, ty + 1, kx + 10, ty + 11, 0xFFFFFFFF);
		}
		c.disableScissor();
		if (l.isEmpty()) Ui.ctr(c, "No modules found", sx + sw / 2, top + 20, 0xFF8794B8);
		Ui.txt(c, "Esc / R-Shift to close", x + w - 10 - Ui.w("Esc / R-Shift to close"), y + 7, 0xFF7F8CB0);
		poll(mx, my, l, sx, top, sw, bottom, side);
	}

	private void poll(int mx, int my, java.util.List<Module> l, int sx, int top, int sw, int bottom, int side) {
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		int x = wx, y = wy, w = ww(), h = wh();
		if (down && !wasDown) {
			focus = false;
			if (Ui.in(mx, my, x, y, w, 22)) { dragging = true; dragX = mx - x; dragY = my - y; }
			else if (hoverRow >= 0 && hoverRow < l.size()) l.get(hoverRow).toggle();
			else if (Ui.in(mx, my, sx, y + 28, sw, 18)) focus = true;
			else if (Ui.in(mx, my, x + 6, y + h - 24, side - 12, 18)) compact = !compact;
			else for (int i = 0; i < CATS.length; i++) if (Ui.in(mx, my, x + 6, y + 30 + i * 22, side - 12, 18)) { cat = i; scroll = 0; }
		}
		if (down && dragging) { wx = Math.max(2, Math.min(this.width - w - 2, mx - dragX)); wy = Math.max(2, Math.min(this.height - h - 2, my - dragY)); }
		if (!down) dragging = false;
		wasDown = down;
	}

	@Override public boolean charTyped(char chr, int modifiers) {
		if (focus && chr >= 32 && query.length() < 20) { query += chr; scroll = 0; return true; }
		return super.charTyped(chr, modifiers);
	}

	@Override public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
		if (focus) {
			if (keyCode == 259 && !query.isEmpty()) { query = query.substring(0, query.length() - 1); return true; }
			if (keyCode == 256 || keyCode == 257) { focus = false; return true; }
			return true;
		}
		if (keyCode == 344 && System.currentTimeMillis() - openedAt > 500) { this.close(); return true; } // Rechts-Shift schliesst wieder
		return super.keyPressed(keyCode, scanCode, modifiers);
	}

	@Override public boolean mouseScrolled(double mx, double my, double hx, double vy) {
		scroll = Math.max(0, scroll - (int) Math.signum(vy) * row());
		return true;
	}

	@Override public boolean shouldPause() { return false; }
}
