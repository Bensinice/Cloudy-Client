package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

/** HUD-Editor wie bei Lunar: jedes Widget frei auf dem Bildschirm verschieben (mit Einrasten an Raendern und Mitte), Mausrad = Groesse. */
public class HudEditorScreen extends Screen {
	private final Screen parent;
	private String drag, hover;
	private float offX, offY;
	private boolean wasDown, snapX, snapY;

	public HudEditorScreen(Screen parent) {
		super(Text.literal("HUD layout"));
		this.parent = parent;
	}

	/** Legt fuer ein Widget eine Startposition an (falls noch keine da ist). */
	public static void ensureOne(String id, int w, int h) {
		if (ModConfig.pos.containsKey(id)) return;
		int idx = 0;
		for (int i = 0; i < Hud.MOVABLE.length; i++) if (Hud.MOVABLE[i].equals(id)) idx = i;
		float x, y;
		switch (id) {
			case "keys" -> { x = 8f / w; y = (h / 2f - 22) / h; }
			case "lyricscard" -> { x = (w - 178f) / w; y = Math.max(8f, h / 8f) / h; }
			case "armor" -> { x = (w - 52f) / w; y = (h / 2f - 35) / h; }
			default -> { x = 6f / w; y = (4f + idx * 17f) / h; }
		}
		ModConfig.pos.put(id, new float[]{x, y, 1f});
	}

	@Override
	protected void init() {
		ModConfig.load();
		for (String id : Hud.MOVABLE) if (ModConfig.isOn(id)) ensureOne(id, this.width, this.height);
		ModConfig.save();
	}

	private float sc(String id) { return ModConfig.scale * ModConfig.pos.get(id)[2]; }

	private int[] rect(String id) {
		int[] sz = Hud.size(id, Hud.sample(id));
		float[] p = ModConfig.pos.get(id);
		float s = sc(id);
		return new int[]{Math.round(p[0] * this.width), Math.round(p[1] * this.height), Math.round(sz[0] * s), Math.round(sz[1] * s)};
	}

	@Override
	public void renderBackground(DrawContext c, int mx, int my, float delta) {
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, 0x66000000);
	}

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load();
		MinecraftClient mc = MinecraftClient.getInstance();
		hover = null;
		for (String id : Hud.MOVABLE) { // oberstes Widget (zuletzt gezeichnet) bekommt den Hover
			if (!ModConfig.isOn(id) || !ModConfig.pos.containsKey(id)) continue;
			int[] r = rect(id);
			if (Ui.in(mx, my, r[0], r[1], r[2], r[3])) hover = id;
		}
		if (drag != null) { // Mittellinien beim Einrasten
			if (snapX) c.fill(this.width / 2, 0, this.width / 2 + 1, this.height, 0x88FFFFFF);
			if (snapY) c.fill(0, this.height / 2, this.width, this.height / 2 + 1, 0x88FFFFFF);
		}
		boolean any = false;
		for (String id : Hud.MOVABLE) {
			if (!ModConfig.isOn(id) || !ModConfig.pos.containsKey(id)) continue;
			any = true;
			int[] r = rect(id);
			Hud.drawWidget(c, mc, id, Hud.sample(id), r[0], r[1], sc(id), true);
			boolean on = id.equals(drag) || (drag == null && id.equals(hover));
			int col = on ? Theme.accent : 0x88FFFFFF;
			c.fill(r[0] - 2, r[1] - 2, r[0] + r[2] + 2, r[1] - 1, col);
			c.fill(r[0] - 2, r[1] + r[3] + 1, r[0] + r[2] + 2, r[1] + r[3] + 2, col);
			c.fill(r[0] - 2, r[1] - 2, r[0] - 1, r[1] + r[3] + 2, col);
			c.fill(r[0] + r[2] + 1, r[1] - 2, r[0] + r[2] + 2, r[1] + r[3] + 2, col);
			if (on) Ui.txt(c, Math.round(ModConfig.pos.get(id)[2] * 100) + "%", r[0], Math.max(2, r[1] - 12), 0xFFFFFFFF);
		}
		Ui.glass(c, this.width / 2 - 170, this.height - 40, 340, 28);
		Ui.txt(c, any ? "Drag widgets anywhere  -  scroll to resize" : "No HUD widgets on. Turn some on in Cloudy Mods.", this.width / 2 - 160, this.height - 29, 0xFFD6E2FF);
		int by = this.height - 37;
		boolean hr = Ui.in(mx, my, this.width / 2 + 40, by, 50, 22), hd = Ui.in(mx, my, this.width / 2 + 94, by, 70, 22);
		Ui.button(c, MinecraftClient.getInstance().textRenderer, this.width / 2 + 40, by, 50, 22, "Reset", hr, false);
		Ui.button(c, MinecraftClient.getInstance().textRenderer, this.width / 2 + 94, by, 70, 22, "Done", hd, true);
		poll(mx, my, hr, hd);
	}

	private void poll(int mx, int my, boolean hr, boolean hd) {
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		if (down && !wasDown) {
			if (hd) close();
			else if (hr) { ModConfig.pos.clear(); init(); }
			else if (hover != null) { int[] r = rect(hover); drag = hover; offX = mx - r[0]; offY = my - r[1]; }
		}
		if (down && drag != null) {
			int[] r = rect(drag);
			float nx = mx - offX, ny = my - offY;
			snapX = snapY = false;
			int cx = Math.round(nx + r[2] / 2f), cy = Math.round(ny + r[3] / 2f);
			if (Math.abs(nx) < 6) nx = 0;
			else if (Math.abs(nx + r[2] - this.width) < 6) nx = this.width - r[2];
			else if (Math.abs(cx - this.width / 2) < 6) { nx = this.width / 2f - r[2] / 2f; snapX = true; }
			if (Math.abs(ny) < 6) ny = 0;
			else if (Math.abs(ny + r[3] - this.height) < 6) ny = this.height - r[3];
			else if (Math.abs(cy - this.height / 2) < 6) { ny = this.height / 2f - r[3] / 2f; snapY = true; }
			float[] p = ModConfig.pos.get(drag);
			p[0] = Math.max(0, Math.min(this.width - r[2], nx)) / this.width;
			p[1] = Math.max(0, Math.min(this.height - r[3], ny)) / this.height;
		}
		if (!down && drag != null) { drag = null; snapX = snapY = false; ModConfig.save(); }
		wasDown = down;
	}

	@Override
	public boolean mouseScrolled(double mx, double my, double hx, double vy) {
		if (hover != null) {
			float[] p = ModConfig.pos.get(hover);
			p[2] = Math.max(0.5f, Math.min(3f, Math.round((p[2] + (float) Math.signum(vy) * 0.1f) * 10f) / 10f));
			int[] r = rect(hover); // nach dem Skalieren im Bild halten
			p[0] = Math.max(0, Math.min(this.width - r[2], p[0] * this.width)) / this.width;
			p[1] = Math.max(0, Math.min(this.height - r[3], p[1] * this.height)) / this.height;
			ModConfig.save();
		}
		return true;
	}

	@Override
	public void close() {
		ModConfig.save();
		if (this.client != null) this.client.setScreen(parent);
	}
}
