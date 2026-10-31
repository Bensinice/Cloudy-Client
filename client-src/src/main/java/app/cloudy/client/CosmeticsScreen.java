package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;

/** Cloudy Cosmetics: Kategorien, Item-Karten und eine drehbare 3D-Vorschau mit deinem Skin. Hover = anprobieren, Klick = anziehen/ausziehen. */
public class CosmeticsScreen extends Screen {
	private static final String[] CATS = {"hat", "wings", "shield", "cape"}, LABEL = {"Hats", "Wings", "Shields", "Capes"};
	private static final String[] TAB_ICON = {"hat-top", "wings-angel", "shield-sun", "cape-aurora"};
	private static int tab = 0;
	private record Hit(int x, int y, int w, int h, Runnable run) {}
	private final List<Hit> hits = new ArrayList<>();
	private final Screen parent;
	private int px, py, pw, ph, prevX, prevW, cell = 56, cols, scroll;
	private String hover;
	private float spin = 0.5f;
	private boolean wasDown, drag;
	private int lastMx;
	private long lastInput;

	public CosmeticsScreen(Screen parent) {
		super(Text.literal("Cloudy Cosmetics"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		pw = Math.min(this.width - 16, 540); ph = Math.min(this.height - 16, 300);
		px = (this.width - pw) / 2; py = (this.height - ph) / 2;
		prevW = Math.max(110, Math.min(170, pw / 3)); prevX = px + pw - prevW - 8;
		cols = Math.max(2, (prevX - px - 24) / cell);
	}

	private List<String> items() {
		List<String> l = new ArrayList<>();
		for (String id : Cosmetics.ALL) if (CATS[tab].equals(Cosmetics.catOf(id))) l.add(id);
		return l;
	}

	private boolean owned(String id) { return Cosmetics.owned.contains(id); }

	@Override
	public void renderBackground(DrawContext c, int mx, int my, float delta) {
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, MinecraftClient.getInstance().world == null ? 0x44000000 : 0x77050A16);
	}

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load();
		hits.clear();
		Ui.glass(c, px, py, pw, ph);
		c.fill(px, py, px + pw, py + 2, Theme.accent);
		Ui.txt(c, "CLOUDY", px + 12, py + 11, Theme.accent);
		Ui.txt(c, "Cosmetics", px + 12 + Ui.w("CLOUDY") + 6, py + 11, 0xFFFFFFFF);
		// Kategorien
		int tw = (prevX - px - 24 - 3 * 4) / 4, tx = px + 12, ty = py + 28;
		for (int i = 0; i < CATS.length; i++) {
			final int ii = i;
			boolean on = i == tab, hv = Ui.in(mx, my, tx, ty, tw, 24);
			c.fill(tx, ty, tx + tw, ty + 24, on ? Ui.mix(0xFF0C1224, Theme.accent, 0.55f) : hv ? 0xCC2A3558 : 0xAA151D38);
			if (on) c.fill(tx, ty + 22, tx + tw, ty + 24, Theme.accent);
			Ui.icon(c, TAB_ICON[i], tx + 4, ty + 4, 16);
			if (tw > 52) Ui.txt(c, LABEL[i], tx + 24, ty + 8, on ? 0xFFFFFFFF : 0xFFB8C6E8);
			hits.add(new Hit(tx, ty, tw, 24, () -> { tab = ii; scroll = 0; }));
			tx += tw + 4;
		}
		// Raster mit Scroll
		List<String> items = items();
		int gx = px + 12, gy = py + 60, gh = ph - 60 - 32, rowsVis = Math.max(1, gh / (cell + 2));
		int rows = (items.size() + cols - 1) / cols;
		scroll = Math.max(0, Math.min(scroll, Math.max(0, rows - rowsVis)));
		hover = null;
		c.enableScissor(gx - 2, gy - 2, prevX - 8, gy + gh);
		for (int i = 0; i < items.size(); i++) {
			int r = i / cols - scroll;
			if (r < 0 || r >= rowsVis + 1) continue;
			String id = items.get(i);
			int x = gx + (i % cols) * cell, y = gy + r * (cell + 2), cw = cell - 4;
			boolean on = id.equals(Cosmetics.get(CATS[tab])), has = owned(id), hv = Ui.in(mx, my, x, y, cw, cell - 2) && my < gy + gh;
			if (hv) hover = id;
			c.fill(x, y, x + cw, y + cell - 2, on ? Ui.mix(0xFF0C1224, Theme.accent, 0.5f) : hv ? 0xDD2A3558 : 0xAA151D38);
			if (on) { c.fill(x, y, x + cw, y + 1, Theme.accent); c.fill(x, y + cell - 3, x + cw, y + cell - 2, Theme.accent); }
			if (!Ui.sprite(c, id, x + (cw - 36) / 2, y + 2, 36)) Ui.icon(c, id, x + (cw - 32) / 2, y + 4, 32);
			String nm = Ui.trim(Cosmetics.nameOf(id), cw - 4);
			Ui.ctr(c, nm, x + cw / 2, y + cell - 14, has ? 0xFFFFFFFF : 0xFF8794B8);
			if (!has) { c.fill(x, y, x + cw, y + cell - 2, 0x88000000); c.fill(x + cw / 2 - 6, y + 14, x + cw / 2 + 6, y + 24, 0xFFDDDDDD); c.fill(x + cw / 2 - 4, y + 8, x + cw / 2 + 4, y + 14, 0xFFDDDDDD); c.fill(x + cw / 2 - 3, y + 9, x + cw / 2 + 3, y + 14, 0xDD0C1224); }
			else if (on) Ui.txt(c, "✓", x + cw - 9, y + 3, 0xFFFFFFFF);
			if (has) hits.add(new Hit(x, y, cw, cell - 2, () -> Cosmetics.set(CATS[tab], on ? null : id)));
		}
		c.disableScissor();
		if (rows > rowsVis) { // Scroll-Hinweis
			int bh = Math.max(12, gh * rowsVis / rows), by = gy + (gh - bh) * scroll / Math.max(1, rows - rowsVis);
			c.fill(prevX - 12, by, prevX - 10, by + bh, 0x88FFFFFF);
		}
		// Vorschau
		Ui.glass(c, prevX, py + 28, prevW, ph - 28 - 36);
		int pcx = prevX + prevW / 2, feet = py + ph - 36 - 34, sc = Math.max(40, (ph - 28 - 36 - 50) / 2.0f > 0 ? (int) ((ph - 28 - 36 - 56) / 1.95f) : 40);
		long now = System.currentTimeMillis();
		if (!drag && now - lastInput > 1500) spin += 0.012f;
		String h = Cosmetics.hat, w = Cosmetics.wings, s = Cosmetics.shield;
		if (hover != null) { String cat = Cosmetics.catOf(hover); if ("hat".equals(cat)) h = hover; else if ("wings".equals(cat)) w = hover; else if ("shield".equals(cat)) s = hover; }
		boolean ok = false;
		c.enableScissor(prevX, py + 28, prevX + prevW, py + ph - 8);
		ok = PlayerPreview.draw(c, pcx, feet, sc, spin, h, w, s);
		c.disableScissor();
		if (!ok) { Ui.avatar(c, pcx, py + 56, 3); }
		String line = hover != null ? Cosmetics.nameOf(hover) : "Drag to rotate";
		Ui.ctr(c, line, pcx, py + ph - 36 - 14, hover != null ? 0xFFFFFFFF : 0xFF8794B8);
		// Fusszeile
		String info = hover != null && !owned(hover) ? "Buy this item in the Cloudy launcher shop" : Cosmetics.owned.isEmpty() ? "Buy cosmetics in the Cloudy launcher shop" : CATS[tab].equals("cape") ? "Capes apply on the next game start" : "Click an item to equip or unequip it";
		Ui.txt(c, Ui.trim(info, prevX - px - 100), px + 12, py + ph - 20, 0xFF9FB0D8);
		int bw = 64, by2 = py + ph - 26;
		boolean hvD = Ui.in(mx, my, px + pw - bw - 8, by2, bw, 18), hvU = Ui.in(mx, my, px + pw - bw * 2 - 14, by2, bw + 6, 18);
		Ui.button(c, this.textRenderer, px + pw - bw - 8, by2, bw, 18, "Done", hvD, true);
		Ui.button(c, this.textRenderer, px + pw - bw * 2 - 14, by2, bw + 6, 18, "Unequip all", hvU, false);
		hits.add(new Hit(px + pw - bw - 8, by2, bw, 18, this::close));
		hits.add(new Hit(px + pw - bw * 2 - 14, by2, bw + 6, 18, () -> { for (String cat : CATS) Cosmetics.set(cat, null); }));
		poll(mx, my);
	}

	/** Klicks und Ziehen per GLFW, damit der Bildschirm auf allen Versionen gleich funktioniert. */
	private void poll(int mx, int my) {
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		if (down && !wasDown) {
			boolean used = false;
			for (Hit h : hits) if (Ui.in(mx, my, h.x(), h.y(), h.w(), h.h())) { h.run().run(); used = true; break; }
			if (!used && Ui.in(mx, my, prevX, py + 28, prevW, ph - 64)) { drag = true; lastMx = mx; }
		}
		if (down && drag) { spin += (mx - lastMx) * 0.03f; lastMx = mx; lastInput = System.currentTimeMillis(); }
		if (!down) drag = false;
		wasDown = down;
	}

	@Override
	public boolean mouseScrolled(double mx, double my, double hx, double vy) {
		scroll -= (int) Math.signum(vy);
		return true;
	}

	@Override
	public void close() {
		if (this.client != null) this.client.setScreen(parent);
	}
}
