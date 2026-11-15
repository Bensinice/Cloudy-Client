package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.text.Text;

import java.util.List;

/** Emote-Rad (Taste B): bis zu 8 Emotes im Kreis. Maus auf ein Feld und B loslassen oder klicken = abspielen. Mausrad = weitere Seite. */
public final class EmoteWheelScreen extends Screen {
	private final KeyBinding key;
	private final List<String> list = Emotes.owned();
	private int page, hover = -1;
	private final long opened = System.currentTimeMillis();

	public EmoteWheelScreen(KeyBinding key) { super(Text.literal("Emotes")); this.key = key; }

	@Override public boolean shouldPause() { return false; }
	@Override public void renderBackground(DrawContext c, int mx, int my, float d) { c.fill(0, 0, width, height, 0x55000000); }

	private int pages() { return Math.max(1, (list.size() + 7) / 8); }
	private String at(int i) { int k = page * 8 + i; return k < list.size() ? list.get(k) : null; }

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		renderBackground(c, mx, my, delta);
		int cx = width / 2, cy = height / 2, R = Math.min(96, Math.min(width, height) / 3), r0 = R / 3;
		double dx = mx - cx, dy = my - cy, dist = Math.sqrt(dx * dx + dy * dy);
		hover = -1;
		if (dist > r0 * 0.8 && dist < R * 1.6) { double a = Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / 8; if (a < 0) a += Math.PI * 2; hover = (int) (a / (Math.PI / 4)) % 8; if (at(hover) == null) hover = -1; }
		// Felder
		for (int i = 0; i < 8; i++) {
			String id = at(i); double a = -Math.PI / 2 + i * Math.PI / 4;
			int x = cx + (int) Math.round(Math.cos(a) * (R * 0.72)), y = cy + (int) Math.round(Math.sin(a) * (R * 0.72));
			boolean hv = i == hover; int s = hv ? 34 : 30;
			c.fill(x - s / 2 - 2, y - s / 2 - 2, x + s / 2 + 2, y + s / 2 + 2, hv ? Ui.ACCENT : 0x99202838);
			c.fill(x - s / 2, y - s / 2, x + s / 2, y + s / 2, hv ? 0xEE2A3550 : 0xCC141a26);
			if (id == null) { Ui.ctr(c, "·", x, y - 4, 0xFF556070); continue; }
			if (!Ui.sprite(c, id, x - s / 2 + 2, y - s / 2 + 2, s - 4)) Ui.ctr(c, Emotes.label(id).substring(0, 1), x, y - 4, 0xFFFFFFFF);
		}
		// Mitte
		c.fill(cx - r0, cy - 10, cx + r0, cy + 10, 0xCC0c1018);
		String mid = hover >= 0 ? Emotes.label(at(hover)) : list.isEmpty() ? "No emotes" : "Emotes";
		Ui.ctr(c, mid, cx, cy - 4, hover >= 0 ? 0xFFFFFFFF : 0xFFAFC4DA);
		String hint = list.isEmpty() ? "Get emotes in the Cloudy launcher shop" : "Release B or click" + (pages() > 1 ? "  ·  Scroll: page " + (page + 1) + "/" + pages() : "");
		Ui.ctr(c, hint, cx, cy + R + 22, 0xFFAFC4DA);
		super.render(c, mx, my, delta);
	}

	private void pick() { String id = hover >= 0 ? at(hover) : null; shut(); if (id != null) Emotes.play(id); }

	@Override public boolean mouseClicked(double mx, double my, int b) { if (b == 0) { pick(); return true; } if (b == 1) { shut(); return true; } return super.mouseClicked(mx, my, b); }
	@Override public boolean mouseScrolled(double mx, double my, double h, double v) { if (pages() > 1) page = Math.floorMod(page + (v < 0 ? 1 : -1), pages()); return true; }

	@Override
	public boolean keyReleased(int keyCode, int scanCode, int mods) {
		if (key.matchesKey(keyCode, scanCode) && System.currentTimeMillis() - opened > 150) { if (hover >= 0) pick(); return true; }
		return super.keyReleased(keyCode, scanCode, mods);
	}

	private void shut() { MinecraftClient.getInstance().setScreen(null); }
}
