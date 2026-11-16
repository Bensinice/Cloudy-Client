package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;

/** Kleine Karte in der Bildschirmmitte mit eigenen Knoepfen (gemeinsame Basis fuer Profilkarte und Wolken-Post). */
abstract class SocialScreen extends Screen {
	protected record Btn(int x, int y, int w, int h, String label, boolean primary, Runnable run) {}
	protected final List<Btn> btns = new ArrayList<>();
	protected int cx, cy, cw, ch;

	protected SocialScreen(String title) { super(Text.literal(title)); }
	@Override public boolean shouldPause() { return false; }
	@Override public void renderBackground(DrawContext c, int mx, int my, float d) { c.fill(0, 0, width, height, 0x66000000); }

	protected void card(DrawContext c, int w, int h) {
		cw = Math.min(w, width - 20); ch = Math.min(h, height - 20); cx = (width - cw) / 2; cy = (height - ch) / 2;
		c.fill(cx - 1, cy - 1, cx + cw + 1, cy + ch + 1, Theme.accent | 0xFF000000);
		c.fill(cx, cy, cx + cw, cy + ch, 0xF20F1528);
		c.fill(cx, cy, cx + cw, cy + 3, Theme.accent | 0xFF000000);
	}
	protected void btn(int x, int y, int w, String label, boolean primary, Runnable run) { btns.add(new Btn(x, y, w, 18, label, primary, run)); }
	protected void drawBtns(DrawContext c, int mx, int my) {
		for (Btn b : btns) Ui.button(c, MinecraftClient.getInstance().textRenderer, b.x(), b.y(), b.w(), b.h(), b.label(), mx >= b.x() && mx < b.x() + b.w() && my >= b.y() && my < b.y() + b.h(), b.primary());
	}
	@Override public boolean mouseClicked(double mx, double my, int button) {
		if (button == 0) for (Btn b : new ArrayList<>(btns)) if (mx >= b.x() && mx < b.x() + b.w() && my >= b.y() && my < b.y() + b.h()) { b.run().run(); return true; }
		if (button == 0 && (mx < cx || mx > cx + cw || my < cy || my > cy + ch)) { close(); return true; }
		return super.mouseClicked(mx, my, button);
	}
	/** Zeilenumbruch nach Breite (Poppins). */
	protected static List<String> wrap(String s, int max) {
		List<String> out = new ArrayList<>(); StringBuilder line = new StringBuilder();
		for (String w : s.split(" ")) { String t = line.length() == 0 ? w : line + " " + w; if (Ui.w(t) > max && line.length() > 0) { out.add(line.toString()); line = new StringBuilder(w); } else { line = new StringBuilder(t); } }
		if (line.length() > 0) out.add(line.toString()); return out;
	}
}
