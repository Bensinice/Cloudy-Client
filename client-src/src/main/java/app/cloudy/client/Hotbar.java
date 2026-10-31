package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.item.ItemStack;

/** Eigene Hotbar und eigene Herzen: dunkel, im Launcher-Theme oder in einer frei waehlbaren Farbe. Wird von HotbarMixin anstelle der Vanilla-Anzeige gezeichnet. */
public final class Hotbar {
	private Hotbar() {}

	private static final String[] HEART = {
		".XX...XX.", "XXXX.XXXX", "XXXXXXXXX", "XXXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X...."};

	public static boolean hotbarOn() { return ModConfig.isOn("hotbar"); }
	public static boolean heartsOn() { return ModConfig.isOn("hotbar") && ModConfig.heartMode != 0; }

	private static int sel(net.minecraft.entity.player.PlayerInventory inv) {
		try { return inv.selectedSlot; } catch (Throwable t) {
			try { return (Integer) inv.getClass().getMethod("getSelectedSlot").invoke(inv); } catch (Throwable t2) { return 0; }
		}
	}

	private static int base() {
		return switch (ModConfig.hbStyle) {
			case 0 -> 0xFF0E1220;
			case 1 -> Ui.mix(Theme.accent, 0xFF000000, 0.72f);
			default -> 0xFF000000 | ModConfig.lcol(ModConfig.hbCol, 5);
		};
	}

	/** Hotbar zeichnen. true = Vanilla-Hotbar ueberspringen. */
	public static boolean draw(DrawContext c) {
		MinecraftClient mc = MinecraftClient.getInstance();
		var p = mc.player;
		if (p == null || p.isSpectator() || !hotbarOn()) return false;
		int w = c.getScaledWindowWidth(), h = c.getScaledWindowHeight();
		int x0 = w / 2 - 91, y0 = h - 22, bg = base(), selc = 0xFF000000 | ModConfig.lcol(ModConfig.hbSel, 6);
		frame(c, x0, y0, 182, 22, bg);
		int s = sel(p.getInventory());
		for (int i = 0; i < 9; i++) {
			int sx = x0 + 1 + i * 20;
			c.fill(sx + 1, y0 + 1, sx + 19, y0 + 21, Ui.mix(bg, 0xFFFFFFFF, 0.08f));
			if (i == s) {
				c.fill(sx - 1, y0 - 1, sx + 21, y0 + 23, selc);
				c.fill(sx + 1, y0 + 1, sx + 19, y0 + 21, Ui.mix(bg, selc, 0.28f));
			}
		}
		for (int i = 0; i < 9; i++) {
			ItemStack st = p.getInventory().getStack(i);
			if (st.isEmpty()) continue;
			int ix = x0 + 3 + i * 20, iy = y0 + 3;
			c.drawItem(st, ix, iy);
			c.drawStackOverlay(mc.textRenderer, st, ix, iy);
		}
		ItemStack off = p.getOffHandStack();
		if (!off.isEmpty()) {
			boolean left = p.getMainArm() == net.minecraft.util.Arm.RIGHT;
			int ox = left ? x0 - 28 : x0 + 190;
			frame(c, ox, y0, 22, 22, bg);
			c.drawItem(off, ox + 3, y0 + 3);
			c.drawStackOverlay(mc.textRenderer, off, ox + 3, y0 + 3);
		}
		return true;
	}

	private static void frame(DrawContext c, int x, int y, int w, int h, int bg) {
		c.fill(x, y, x + w, y + h, (bg & 0xFFFFFF) | 0xDD000000);
		int edge = Ui.mix(bg, 0xFFFFFFFF, 0.35f);
		c.fill(x, y, x + w, y + 1, edge); c.fill(x, y + h - 1, x + w, y + h, edge - 0x44000000);
		c.fill(x, y, x + 1, y + h, edge - 0x22000000); c.fill(x + w - 1, y, x + w, y + h, edge - 0x22000000);
	}

	private static int heartColor() {
		var p = MinecraftClient.getInstance().player;
		if (p != null && p.hasStatusEffect(StatusEffects.WITHER)) return 0xFF4A4A55;
		if (p != null && p.hasStatusEffect(StatusEffects.POISON)) return 0xFF9CB521;
		return ModConfig.heartMode == 1 ? (Theme.accent | 0xFF000000) : 0xFF000000 | ModConfig.lcol(ModConfig.heartCol, 7);
	}

	private static final String[] HEART8 = {".XX..XX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...XX..."};
	private static final String[] SHIELD8 = {"XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", ".XXXXXX.", "..XXXX..", "...XX..."};
	private static final String[] FOOD8 = {"...XXXX.", "..XXXXXX", "..XXXXXX", ".XXXXXX.", "BXXXXX..", "BB.X....", ".BB....."}; // 7 Zeilen wie das Herz: beide Leisten liegen genau auf einer Linie
	private static final String[] BUBBLE8 = {"..XXXX..", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX.."};

	private static boolean px(String[] b, int x, int y) { return y >= 0 && y < b.length && x >= 0 && x < b[y].length() && b[y].charAt(x) != '.'; }

	/** Ein sauberes Symbol: dunkle Kontur, sanfter Farbverlauf oben hell / unten dunkel, optional nur links gefuellt (halb). cols = Anzahl gefuellter Spalten. */
	private static void icon(DrawContext c, int x, int y, String[] b, int col, int cols, int bone) {
		int out = 0xCC0A0A12;
		for (int r = 0; r < b.length; r++) for (int q = 0; q < b[r].length(); q++) {
			if (px(b, q, r)) continue;
			if (px(b, q - 1, r) || px(b, q + 1, r) || px(b, q, r - 1) || px(b, q, r + 1)) c.fill(x + q, y + r, x + q + 1, y + r + 1, out);
		}
		int empty = 0x66202030;
		for (int r = 0; r < b.length; r++) for (int q = 0; q < b[r].length(); q++) {
			char ch = b[r].charAt(q);
			if (ch == '.') continue;
			int cc;
			if (q >= cols) cc = empty;
			else if (ch == 'B') cc = bone;
			else { float t = r / (float) Math.max(1, b.length - 1); cc = t < 0.3f ? Ui.mix(col, 0xFFFFFFFF, 0.28f - t * 0.6f) : Ui.mix(col, 0xFF000000, (t - 0.3f) * 0.45f); }
			c.fill(x + q, y + r, x + q + 1, y + r + 1, cc);
		}
	}

	/** Herzen, Ruestung, Hunger und Luft in eigenem, sauberem Stil. true = Vanilla ueberspringen. Bei Absorption, ueber 20 Leben oder Reittier bleibt Vanilla. */
	public static boolean status(DrawContext c) {
		MinecraftClient mc = MinecraftClient.getInstance();
		var p = mc.player;
		if (p == null || !heartsOn() || p.isSpectator() || p.getAbsorptionAmount() > 0 || p.getMaxHealth() > 20.5f || p.getVehicle() instanceof net.minecraft.entity.LivingEntity) return false;
		int w = c.getScaledWindowWidth(), h = c.getScaledWindowHeight();
		int x0 = w / 2 - 91, y0 = h - 39, col = heartColor();
		float hp = Math.max(0f, p.getHealth()), max = p.getMaxHealth();
		int n = (int) Math.ceil(max / 2f);
		boolean hit = p.hurtTime > 0 && p.hurtTime % 4 < 2;
		for (int i = 0; i < n; i++) {
			int x = x0 + i * 9, y = y0 + 1 - (hp <= 4 && mc.world != null && (mc.world.getTime() / 2 + i) % 12 == 0 ? 1 : 0);
			float v = hp - i * 2f;
			icon(c, x, y, HEART8, hit ? 0xFFFFFFFF : col, v >= 2f ? 8 : v >= 1f ? 4 : 0, 0);
		}
		int armor = p.getArmor();
		if (armor > 0) {
			int ac = 0xFF000000 | ModConfig.lcol(ModConfig.armCol, 8);
			for (int i = 0; i < 10; i++) icon(c, x0 + i * 9, y0 - 10, SHIELD8, ac, armor >= i * 2 + 2 ? 8 : armor == i * 2 + 1 ? 4 : 0, 0);
		}
		int food = p.getHungerManager().getFoodLevel();
		int fc = 0xFF000000 | ModConfig.lcol(ModConfig.foodCol, 9);
		for (int i = 0; i < 10; i++) icon(c, w / 2 + 91 - 8 - i * 9, y0 + 1, FOOD8, fc, food >= i * 2 + 2 ? 8 : food == i * 2 + 1 ? 4 : 0, Ui.mix(fc, 0xFFFFFFFF, 0.6f));
		if (p.isSubmergedInWater() || p.getAir() < p.getMaxAir()) {
			int air = Math.max(0, p.getAir()), bubbles = (int) Math.ceil(air * 10f / p.getMaxAir());
			for (int i = 0; i < 10; i++) if (i < bubbles) icon(c, w / 2 + 91 - 8 - i * 9, y0 - 10, BUBBLE8, 0xFF7FD0FF, 8, 0);
		}
		return true;
	}
}
