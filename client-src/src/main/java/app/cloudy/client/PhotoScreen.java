package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.util.ScreenshotRecorder;
import net.minecraft.text.Text;

/**
 * Fotomodus: freie Kamera (WASD/Leertaste/Shift, Strg = schneller, Maus ziehen = drehen), HUD aus, Filter, Ausloeser.
 * Das Spiel laeuft weiter (Mehrspieler kann man nicht anhalten) – der Spieler bleibt aber stehen.
 * Fotos landen im normalen Screenshot-Ordner und erscheinen im Launcher unter Einstellungen -> Screenshots.
 */
public final class PhotoScreen extends Screen {
	public static final String[] FILTERS = {"None", "Warm", "Cold", "Dream", "Vintage", "Night"};
	private static final int[] TINT = {0, 0x2EFF9A3C, 0x2E3C9AFF, 0x26FF7AD9, 0x3A8A6A3A, 0x4A10183A};
	private static int filter = 0; private static boolean vignette = true;
	private int shoot = -1; private boolean hideUi; private String msg; private long msgT;

	public PhotoScreen() { super(Text.literal("Photo mode")); }

	public static void open(MinecraftClient mc) { if (mc.player == null) return; FreeCam.startPhoto(mc); mc.setScreen(new PhotoScreen()); }

	@Override public boolean shouldPause() { return false; }
	@Override public void renderBackground(DrawContext c, int mx, int my, float d) {}

	private void overlay(DrawContext c) {
		if (TINT[filter] != 0) c.fill(0, 0, width, height, TINT[filter]);
		if (vignette) for (int i = 0; i < 10; i++) { // weicher dunkler Rand
			int a = (int) (70 * (1 - i / 10f)) << 24, t = Math.max(1, Math.min(width, height) / 60);
			c.fill(0, i * t, width, i * t + t, a); c.fill(0, height - i * t - t, width, height - i * t, a);
			c.fill(i * t, 0, i * t + t, height, a); c.fill(width - i * t - t, 0, width - i * t, height, a);
		}
	}

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		overlay(c);
		if (shoot >= 0) { // ein Bild ohne Bedienelemente zeichnen, dann aufnehmen
			if (++shoot >= 2) {
				shoot = -1;
				try {
					c.draw();
					MinecraftClient mc = MinecraftClient.getInstance();
					ScreenshotRecorder.saveScreenshot(mc.runDirectory, mc.getFramebuffer(), t -> mc.execute(() -> { msg = "Saved! You find it in the launcher: Settings -> Screenshots"; msgT = System.currentTimeMillis(); }));
				} catch (Throwable e) { msg = "Screenshot failed: " + e.getMessage(); msgT = System.currentTimeMillis(); }
			}
			return;
		}
		if (hideUi) return;
		int bx = width / 2 - 200, by = height - 34;
		Ui.glass(c, bx, by, 400, 26);
		int x = bx + 6;
		for (int i = 0; i < FILTERS.length; i++) {
			boolean on = i == filter, hv = Ui.in(mx, my, x, by + 4, 52, 18);
			c.fill(x, by + 4, x + 52, by + 22, on ? Theme.accent : hv ? 0xCC2A3558 : 0xAA151D38);
			Ui.ctr(c, FILTERS[i], x + 26, by + 9, on ? 0xFF0B1226 : 0xFFFFFFFF);
			x += 55;
		}
		boolean hv = Ui.in(mx, my, x + 2, by + 4, 48, 18);
		c.fill(x + 2, by + 4, x + 50, by + 22, hv ? 0xFFFFFFFF : 0xFFE8EEF8);
		Ui.ctr(c, "PHOTO", x + 26, by + 9, 0xFF0B1226);
		Ui.ctr(c, "WASD / Space / Shift: move  ·  Ctrl: faster  ·  drag: look  ·  V: vignette  ·  H: hide this bar  ·  Enter: photo  ·  Esc: exit", width / 2, by - 12, 0xCCFFFFFF);
		if (msg != null && System.currentTimeMillis() - msgT < 3500) Ui.ctr(c, msg, width / 2, 14, 0xFFFFFFFF);
	}

	@Override
	public boolean mouseClicked(double mx, double my, int b) {
		if (hideUi) { hideUi = false; return true; }
		int bx = width / 2 - 200, by = height - 34, x = bx + 6;
		for (int i = 0; i < FILTERS.length; i++) { if (Ui.in((int) mx, (int) my, x, by + 4, 52, 18)) { filter = i; return true; } x += 55; }
		if (Ui.in((int) mx, (int) my, x + 2, by + 4, 48, 18)) { shoot = 0; return true; }
		return true;
	}

	@Override
	public boolean mouseDragged(double mx, double my, int b, double dx, double dy) { FreeCam.turn(dx, dy); return true; }

	@Override
	public boolean keyPressed(int key, int scan, int mods) {
		if (key == org.lwjgl.glfw.GLFW.GLFW_KEY_ENTER || key == org.lwjgl.glfw.GLFW.GLFW_KEY_KP_ENTER) { shoot = 0; return true; }
		if (key == org.lwjgl.glfw.GLFW.GLFW_KEY_V) { vignette = !vignette; return true; }
		if (key == org.lwjgl.glfw.GLFW.GLFW_KEY_H) { hideUi = !hideUi; return true; }
		if (key >= org.lwjgl.glfw.GLFW.GLFW_KEY_1 && key <= org.lwjgl.glfw.GLFW.GLFW_KEY_6) { filter = key - org.lwjgl.glfw.GLFW.GLFW_KEY_1; return true; }
		return super.keyPressed(key, scan, mods); // Esc schliesst
	}

	@Override
	public void close() { super.close(); }

	@Override
	public void removed() { try { FreeCam.endPhoto(MinecraftClient.getInstance()); } catch (Throwable ignored) {} }
}
