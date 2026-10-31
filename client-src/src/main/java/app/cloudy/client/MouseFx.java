package app.cloudy.client;

import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/** Mausklick-Animation in allen Menues: Ring + Funken in der Themefarbe, dazu eine weiche Spur hinter dem Zeiger. */
public final class MouseFx {
	private static final class P { float x, y, vx, vy; long t0; int life; boolean ring; }
	private static final List<P> ps = new ArrayList<>();
	private static final List<long[]> trail = new ArrayList<>(); // {x, y, zeit}
	private static boolean down0, down1;
	private static float lx = -1, ly = -1;
	private static long seed = 12345;

	private static float rnd() { seed = seed * 6364136223846793005L + 1442695040888963407L; return ((seed >>> 33) & 0xFFFFF) / (float) 0xFFFFF; }

	private static void burst(float x, float y, boolean right) {
		long now = System.currentTimeMillis();
		P r = new P(); r.x = x; r.y = y; r.t0 = now; r.life = 480; r.ring = true; ps.add(r);
		int n = right ? 8 : 12;
		for (int i = 0; i < n; i++) {
			double a = rnd() * Math.PI * 2, sp = 20 + rnd() * 55;
			P p = new P(); p.x = x; p.y = y; p.vx = (float) Math.cos(a) * (float) sp; p.vy = (float) Math.sin(a) * (float) sp - 10; p.t0 = now; p.life = 420 + (int) (rnd() * 360);
			ps.add(p);
		}
	}

	public static void render(DrawContext c, int mx, int my) {
		if (!ModConfig.isOn("mousefx")) return;
		long now = System.currentTimeMillis();
		long win;
		try { win = MinecraftClient.getInstance().getWindow().getHandle(); } catch (Throwable t) { return; }
		boolean d0 = org.lwjgl.glfw.GLFW.glfwGetMouseButton(win, 0) == 1, d1 = org.lwjgl.glfw.GLFW.glfwGetMouseButton(win, 1) == 1;
		boolean clickFx = ModConfig.isOn("mousefx_click"), trailFx = ModConfig.isOn("mousefx_trail");
		if (clickFx && d0 && !down0) burst(mx, my, false);
		if (clickFx && d1 && !down1) burst(mx, my, true);
		down0 = d0; down1 = d1;
		if (trailFx && (lx < 0 || Math.abs(mx - lx) + Math.abs(my - ly) > 1)) { trail.add(new long[] {mx, my, now}); lx = mx; ly = my; }
		trail.removeIf(t -> now - t[2] > 420 || now - t[2] < 0);
		int acc = Theme.accent & 0xFFFFFF;
		for (long[] t : trail) {
			float k = Math.max(0f, Math.min(1f, 1f - (now - t[2]) / 420f));
			int a = (int) (110 * k * k), sz = 1 + (int) (2 * k);
			c.fill((int) t[0] - sz, (int) t[1] - sz, (int) t[0] + sz, (int) t[1] + sz, Math.max(0, Math.min(255, a)) << 24 | acc);
		}
		for (java.util.Iterator<P> it = ps.iterator(); it.hasNext();) {
			P p = it.next();
			long age = now - p.t0;
			if (age > p.life) { it.remove(); continue; }
			float k = age / (float) p.life;
			if (p.ring) {
				float r = 3 + 20 * (1f - (1f - k) * (1f - k));
				int a = (int) (200 * (1f - k));
				for (int i = 0; i < 28; i++) {
					double an = i / 28.0 * Math.PI * 2;
					int px = (int) Math.round(p.x + Math.cos(an) * r), py = (int) Math.round(p.y + Math.sin(an) * r);
					c.fill(px, py, px + 1, py + 1, a << 24 | acc);
				}
			} else {
				float s = age / 1000f;
				float x = p.x + p.vx * s, y = p.y + p.vy * s + 60f * s * s;
				int a = (int) (255 * (1f - k)), sz = k < 0.5f ? 2 : 1;
				int col = Ui.mix(0xFF000000 | acc, 0xFFFFFFFF, 0.55f * (1f - k)) & 0xFFFFFF;
				c.fill((int) x, (int) y, (int) x + sz, (int) y + sz, a << 24 | col);
				if (sz == 2) c.fill((int) x - 1, (int) y, (int) x + 3, (int) y + 1, (a / 3) << 24 | col);
			}
		}
	}
}
