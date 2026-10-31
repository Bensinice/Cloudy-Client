package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;

/** Eigener Startbildschirm im Stil eines Launcher-Clients: Logo, zwei grosse Hauptknoepfe, kleine Reihe, Banner, Icon-Leiste unten.
 *  Hintergrund ist die Landschaft im gewaehlten Launcher-Theme (Ui.scene). Nur fill(), Klicks per GLFW – gleich auf allen Versionen. */
public class CloudyTitleScreen extends Screen {
	private static final int MAIN = 0, SMALL = 1, ICON = 2, PROMO = 3, CHIP = 4;
	private record Btn(int kind, int x, int y, int w, int h, String label, String tip, Runnable run) {}
	private final List<Btn> btns = new ArrayList<>();
	private boolean wasDown;
	private static boolean toastGone;
	private int logoY, logoU;

	public CloudyTitleScreen() { super(Text.literal("Cloudy")); }

	@Override
	protected void init() {
		Theme.load();
		btns.clear();
		MinecraftClient mc = MinecraftClient.getInstance();
		boolean small = this.height < 250;
		int w = Math.max(150, Math.min(250, this.width * 2 / 5)), h = small ? 18 : 22, gap = small ? 3 : 4, cx = this.width / 2;
		logoU = Math.max(2, Math.min(Math.min(this.width / 80, this.height / 40), 7));
		int logoH = 7 * logoU, promoH = small ? 0 : 42;
		int total = logoH + (small ? 8 : 16) + 3 * h + 2 * gap + (promoH > 0 ? gap + promoH : 0);
		logoY = Math.max(10, (this.height - total) / 2 - 6);
		int y = logoY + logoH + (small ? 8 : 16), x = cx - w / 2;
		btns.add(new Btn(MAIN, x, y, w, h, "Singleplayer", null, () -> mc.setScreen(new SelectWorldScreen(this))));
		btns.add(new Btn(MAIN, x, y + h + gap, w, h, "Multiplayer", null, () -> mc.setScreen(new MultiplayerScreen(this))));
		int hw = (w - gap) / 2, y3 = y + 2 * (h + gap);
		btns.add(new Btn(SMALL, x, y3, hw, h, "Cosmetics", null, () -> mc.setScreen(new CosmeticsScreen(this))));
		btns.add(new Btn(SMALL, x + hw + gap, y3, w - hw - gap, h, "Options", null, () -> mc.setScreen(new OptionsScreen(this, mc.options))));
		if (promoH > 0) btns.add(new Btn(PROMO, x, y3 + h + gap, w, promoH, "OPEN YOUR WARDROBE", "Wings, capes, hats and shields", () -> mc.setScreen(new CosmeticsScreen(this))));
		// Icon-Leiste unten in der Mitte
		String[][] ic = {{"S", "Singleplayer"}, {"M", "Multiplayer"}, {"C", "Cosmetics"}, {"O", "Options"}, {"V", "Vanilla menu"}, {"Q", "Quit game"}};
		Runnable[] run = {() -> mc.setScreen(new SelectWorldScreen(this)), () -> mc.setScreen(new MultiplayerScreen(this)), () -> mc.setScreen(new CosmeticsScreen(this)),
			() -> mc.setScreen(new OptionsScreen(this, mc.options)), () -> { CloudyClient.TITLE = false; mc.setScreen(new TitleScreen()); }, mc::scheduleStop};
		int s = small ? 18 : 22, g = 6, bx = cx - (ic.length * s + (ic.length - 1) * g) / 2;
		for (int i = 0; i < ic.length; i++) btns.add(new Btn(ICON, bx + i * (s + g), this.height - s - 8, s, s, ic[i][0], ic[i][1], run[i]));
		btns.add(new Btn(CHIP, this.width - 30, 8, 22, 22, "X", "Quit game", mc::scheduleStop));
	}

	@Override
	public void renderBackground(DrawContext c, int mx, int my, float delta) {
		Ui.scene(c, this.width, this.height);
	}

	private static int glass(boolean hv) { return hv ? 0xE62A3558 : 0xCC0C1224; }

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load();
		Ui.logo(c, this.width / 2, logoY, logoU);
		if (this.height >= 250) c.drawCenteredTextWithShadow(this.textRenderer, "C L I E N T", this.width / 2, logoY + 7 * logoU + 3, 0xFFEAF2FF);
		Btn hov = null;
		for (Btn b : btns) {
			boolean hv = mx >= b.x() && mx < b.x() + b.w() && my >= b.y() && my < b.y() + b.h();
			if (hv) hov = b;
			switch (b.kind()) {
				case PROMO -> {
					int a = Ui.mix(Theme.accent, 0xFF120A2E, 0.45f), z = Ui.mix(Theme.accent, 0xFFFFFFFF, hv ? 0.25f : 0.05f);
					for (int i = 0; i < b.w(); i += 2) c.fill(b.x() + i, b.y(), b.x() + Math.min(b.w(), i + 2), b.y() + b.h(), Ui.mix(a, z, (float) i / b.w()));
					c.fill(b.x(), b.y(), b.x() + b.w(), b.y() + 1, 0x55FFFFFF); c.fill(b.x(), b.y() + b.h() - 1, b.x() + b.w(), b.y() + b.h(), 0x55000000);
					int tx = b.x() + 40;
					try { Ui.avatar(c, b.x() + 20, b.y() + 4, 1); } catch (Throwable ignored) {}
					c.fill(b.x() + b.w() - 62, b.y() - 5, b.x() + b.w() - 4, b.y() + 6, 0xFFFFE14A);
					c.drawTextWithShadow(this.textRenderer, "FREE ITEMS", b.x() + b.w() - 60, b.y() - 3, 0xFF1B1204);
					c.drawTextWithShadow(this.textRenderer, b.label(), tx, b.y() + 11, 0xFFFFFFFF);
					c.drawTextWithShadow(this.textRenderer, b.tip(), tx, b.y() + 24, 0xFFD6E2FF);
				}
				case ICON -> {
					c.fill(b.x(), b.y(), b.x() + b.w(), b.y() + b.h(), glass(hv));
					if (hv) c.fill(b.x(), b.y() + b.h() - 2, b.x() + b.w(), b.y() + b.h(), Theme.accent);
					c.drawCenteredTextWithShadow(this.textRenderer, b.label(), b.x() + b.w() / 2, b.y() + (b.h() - 8) / 2, hv ? 0xFFFFFFFF : 0xFFC8D4F0);
				}
				case CHIP -> {
					c.fill(b.x(), b.y(), b.x() + b.w(), b.y() + b.h(), glass(hv));
					c.drawCenteredTextWithShadow(this.textRenderer, b.label(), b.x() + b.w() / 2, b.y() + (b.h() - 8) / 2, hv ? 0xFFFF8A8A : 0xFFFFFFFF);
				}
				default -> {
					c.fill(b.x(), b.y(), b.x() + b.w(), b.y() + b.h(), glass(hv));
					if (hv) c.fill(b.x(), b.y() + b.h() - 2, b.x() + b.w(), b.y() + b.h(), Theme.accent);
					c.drawCenteredTextWithShadow(this.textRenderer, b.label(), b.x() + b.w() / 2, b.y() + (b.h() - 8) / 2, 0xFFFFFFFF);
				}
			}
		}
		// Konto oben links
		String who = "";
		try { who = MinecraftClient.getInstance().getSession().getUsername(); } catch (Throwable ignored) {}
		if (!who.isEmpty()) {
			int tw = this.textRenderer.getWidth(who) + 30;
			c.fill(8, 8, 8 + tw, 30, 0xCC0C1224);
			c.fill(12, 12, 26, 26, 0xFFE0AC84); c.fill(12, 12, 26, 17, 0xFF4A3220); c.fill(15, 19, 17, 21, 0xFF2B3A66); c.fill(21, 19, 23, 21, 0xFF2B3A66);
			c.drawTextWithShadow(this.textRenderer, who, 32, 15, 0xFFFFFFFF);
		}
		// Hinweis oben in der Mitte (schliessbar)
		if (!toastGone && this.width >= 360) {
			String msg = "Theme: " + (Theme.id.isEmpty() ? "default" : Theme.id) + " · Cloudy Client";
			int tw = this.textRenderer.getWidth(msg) + 40, tx = this.width / 2 - tw / 2;
			c.fill(tx, 8, tx + tw, 30, 0xCC0C1224); c.fill(tx, 8, tx + 2, 30, Theme.accent);
			c.drawTextWithShadow(this.textRenderer, msg, tx + 10, 15, 0xFFFFFFFF);
			boolean hx = mx >= tx + tw - 18 && mx < tx + tw - 4 && my >= 12 && my < 26;
			c.drawTextWithShadow(this.textRenderer, "x", tx + tw - 13, 15, hx ? 0xFFFFFFFF : 0xFF9FB0D8);
			if (hx) hov = new Btn(CHIP, 0, 0, 0, 0, "", null, () -> toastGone = true);
		}
		c.drawTextWithShadow(this.textRenderer, "Cloudy Client", 8, this.height - 14, 0xFFEAF2FF);
		String legal = "Not affiliated with Mojang or Microsoft.";
		if (this.width >= 420) c.drawTextWithShadow(this.textRenderer, legal, this.width - this.textRenderer.getWidth(legal) - 8, this.height - 14, 0xFFB8C6E8);
		if (hov != null && hov.tip() != null && hov.kind() == ICON) {
			int tw = this.textRenderer.getWidth(hov.tip()) + 10, tx = hov.x() + hov.w() / 2 - tw / 2, ty = hov.y() - 18;
			c.fill(tx, ty, tx + tw, ty + 14, 0xE60C1224); c.drawTextWithShadow(this.textRenderer, hov.tip(), tx + 5, ty + 3, 0xFFFFFFFF);
		}
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		if (down && !wasDown && hov != null) hov.run().run();
		wasDown = down;
	}

	@Override public boolean shouldCloseOnEsc() { return false; }
}
