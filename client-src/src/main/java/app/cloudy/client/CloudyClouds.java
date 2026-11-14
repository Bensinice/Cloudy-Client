package app.cloudy.client;

import com.mojang.blaze3d.systems.RenderSystem;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.BufferRenderer;
import net.minecraft.client.render.Fog;
import net.minecraft.client.render.ShaderProgramKeys;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormat;
import net.minecraft.client.render.VertexFormats;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;
import org.joml.Matrix4f;
import org.joml.Vector3f;

import java.util.Arrays;

/**
 * Volumetrische Wolken (Mod "clouds3d"): weiche, aufgetuermte Wolken aus vielen Licht-Wolkenbaellen statt der flachen Minecraft-Bloecke.
 * Jede Wolke = 8–16 Baelle (Billboards) mit weicher Rauschtextur, oben hell (Sonne), unten dunkler (Eigenschatten), Farbe nach Tageszeit,
 * langsam im Wind treibend, zum Rand hin ausgeblendet. Die normalen Wolken werden solange ausgeschaltet (GameOptionsCloudsMixin).
 */
public final class CloudyClouds {
	private CloudyClouds() {}

	private static Identifier tex;
	private static boolean failed;
	private static float[] buf = new float[0]; // je Ball: x, y, z, r, dist2, shade, seed
	private static Integer[] order = new Integer[0];

	public static boolean active() {
		MinecraftClient mc = MinecraftClient.getInstance();
		return ModConfig.isOn("clouds3d") && !failed && mc.world != null && mc.world.getRegistryKey() == World.OVERWORLD;
	}

	private static float hash(long x, long z, int salt) {
		long h = x * 0x9E3779B97F4A7C15L ^ z * 0xC2B2AE3D27D4EB4FL ^ salt * 0x165667B19E3779F9L;
		h ^= h >>> 31; h *= 0x7FB5D329728EA185L; h ^= h >>> 27; h *= 0x81DADEF4BC2DD44DL; h ^= h >>> 33;
		return (h & 0xFFFFFF) / (float) 0xFFFFFF;
	}

	/** Weiche Wolkenball-Textur: runder Verlauf mit etwas Rauschen am Rand (wird einmal erzeugt). */
	private static boolean texture() {
		if (tex != null) return true;
		if (failed) return false;
		try {
			int n = 128;
			NativeImage img = new NativeImage(NativeImage.Format.RGBA, n, n, false);
			for (int y = 0; y < n; y++) for (int x = 0; x < n; x++) {
				float dx = (x + 0.5f) / n * 2f - 1f, dy = (y + 0.5f) / n * 2f - 1f, r = (float) Math.sqrt(dx * dx + dy * dy);
				float noise = 0f, amp = 0.5f, f = 3f;
				for (int o = 0; o < 4; o++) { noise += amp * (hash((long) (x * f / n * 8), (long) (y * f / n * 8), o) - 0.5f); amp *= 0.5f; f *= 2f; }
				float a = 1f - smooth(0.25f, 1f, r + noise * 0.35f);
				int al = Math.max(0, Math.min(255, (int) (a * 235)));
				img.setColorArgb(x, y, al << 24 | 0xFFFFFF);
			}
			NativeImageBackedTexture t = new NativeImageBackedTexture(img);
			tex = Identifier.of("cloudy-client", "clouds/puff");
			MinecraftClient.getInstance().getTextureManager().registerTexture(tex, t);
			try { t.setFilter(true, false); } catch (Throwable ignored) {}
			return true;
		} catch (Throwable e) { failed = true; CloudyClient.LOG.warn("Wolken-Textur nicht erzeugt", e); return false; }
	}

	private static float smooth(float a, float b, float x) { float t = Math.max(0f, Math.min(1f, (x - a) / (b - a))); return t * t * (3f - 2f * t); }

	public static void render(WorldRenderContext ctx) {
		if (!active() || !texture() || ctx.camera() == null) return;
		MinecraftClient mc = MinecraftClient.getInstance();
		MatrixStack ms = null;
		try { ms = ctx.matrixStack(); } catch (Throwable ignored) {}
		Matrix4f m;
		if (ms != null) m = new Matrix4f(ms.peek().getPositionMatrix());
		else {
			try { Object pm = WorldRenderContext.class.getMethod("positionMatrix").invoke(ctx); if (!(pm instanceof Matrix4f m4)) return; m = new Matrix4f(m4); } catch (Throwable t) { return; }
		}
		Vec3d cam = ctx.camera().getPos();
		float H = 192f;
		try { float h = mc.world.getDimensionEffects().getCloudsHeight(); if (!Float.isNaN(h)) H = h; } catch (Throwable ignored) {}
		H += 8f;
		double t = (mc.world.getTime() + ctx.tickCounter().getTickDelta(false)) / 20.0;
		double wind = t * 1.3; // Bloecke pro Sekunde nach Osten
		float R = Math.min(720f, Math.max(320f, mc.options.getClampedViewDistance() * 16f * 1.7f));
		int cell = 72, rc = (int) Math.ceil(R / cell) + 1;
		long cx0 = (long) Math.floor((cam.x - wind) / cell), cz0 = (long) Math.floor(cam.z / cell);
		float cover = ModConfig.cloudsAmount / 100f;
		// Baelle sammeln
		int cnt = 0;
		for (long gx = cx0 - rc; gx <= cx0 + rc; gx++) for (long gz = cz0 - rc; gz <= cz0 + rc; gz++) {
			if (hash(gx, gz, 1) > cover) continue;
			float s = 16f + hash(gx, gz, 2) * 30f;
			double ccx = gx * cell + hash(gx, gz, 3) * cell + wind, ccz = gz * cell + hash(gx, gz, 4) * cell, ccy = H + hash(gx, gz, 5) * 14f;
			double ddx = ccx - cam.x, ddz = ccz - cam.z;
			if (ddx * ddx + ddz * ddz > (R + s) * (R + s)) continue;
			int puffs = 8 + (int) (hash(gx, gz, 6) * 9);
			for (int i = 0; i < puffs; i++) {
				float px = (hash(gx, gz, 10 + i) * 2f - 1f) * s, pz = (hash(gx, gz, 40 + i) * 2f - 1f) * s * 0.75f;
				float edge = 1f - Math.min(1f, (float) Math.sqrt(px * px + pz * pz) / (s * 1.1f));
				float py = hash(gx, gz, 70 + i) * s * 0.55f * (0.35f + edge); // in der Mitte hoeher aufgetuermt
				float pr = s * (0.32f + 0.38f * hash(gx, gz, 100 + i)) * (0.6f + 0.4f * edge);
				if (cnt * 7 + 7 > buf.length) buf = Arrays.copyOf(buf, Math.max(7 * 1024, buf.length * 2));
				double x = ccx + px - cam.x, y = ccy + py - cam.y, z = ccz + pz - cam.z;
				int o = cnt * 7;
				buf[o] = (float) x; buf[o + 1] = (float) y; buf[o + 2] = (float) z; buf[o + 3] = pr;
				buf[o + 4] = (float) (x * x + y * y + z * z);
				buf[o + 5] = Math.max(0f, Math.min(1f, py / (s * 0.55f))); // weiter oben = heller
				buf[o + 6] = (float) Math.sqrt(ddx * ddx + ddz * ddz);
				cnt++;
			}
		}
		if (cnt == 0) return;
		if (order.length < cnt) order = new Integer[Math.max(cnt, order.length * 2)];
		for (int i = 0; i < cnt; i++) order[i] = i;
		final float[] b = buf;
		Arrays.sort(order, 0, cnt, (p, q) -> Float.compare(b[q * 7 + 4], b[p * 7 + 4])); // hinten zuerst
		// Kamera-Achsen fuer Billboards
		Vector3f right = new Vector3f(1, 0, 0), up = new Vector3f(0, 1, 0);
		try { ctx.camera().getRotation().transform(right); ctx.camera().getRotation().transform(up); } catch (Throwable ignored) {}
		// Farben: Tageszeit (Abendrot faerbt mit), Unterseite dunkler
		int cc;
		try { cc = mc.world.getCloudsColor(ctx.tickCounter().getTickDelta(false)); } catch (Throwable e) { cc = 0xFFFFFF; }
		if (SkyBox.active()) cc = Ui.mix(0xFF000000 | cc, 0xFF000000 | SkyBox.horizon, 0.35f) & 0xFFFFFF;
		float tr = ((cc >> 16) & 255) / 255f, tg = ((cc >> 8) & 255) / 255f, tb = (cc & 255) / 255f;
		Fog oldFog = RenderSystem.getShaderFog();
		try {
			RenderSystem.setShaderFog(Fog.DUMMY);
			RenderSystem.enableBlend();
			RenderSystem.defaultBlendFunc();
			RenderSystem.enableDepthTest();
			RenderSystem.depthMask(false);
			RenderSystem.disableCull();
			RenderSystem.setShader(ShaderProgramKeys.POSITION_TEX_COLOR);
			RenderSystem.setShaderTexture(0, tex);
			BufferBuilder bb = Tessellator.getInstance().begin(VertexFormat.DrawMode.QUADS, VertexFormats.POSITION_TEXTURE_COLOR);
			for (int k = 0; k < cnt; k++) {
				int o = order[k] * 7;
				float x = b[o], y = b[o + 1], z = b[o + 2], r = b[o + 3], sh = b[o + 5], dist = b[o + 6];
				float fade = Math.max(0f, Math.min(1f, (R - dist) / (R * 0.3f)));
				float near = Math.max(0f, Math.min(1f, ((float) Math.sqrt(b[o + 4]) - r * 0.6f) / (r * 0.8f))); // in der Wolke: durchsichtig statt Wand
				int a = (int) (215 * fade * near);
				if (a < 3) continue;
				float top = 0.88f + 0.12f * sh, bot = 0.60f + 0.18f * sh;
				int ct = col(tr * top, tg * top, tb * top, a), cbm = col(tr * bot * 0.95f, tg * bot * 0.97f, tb * bot * 1.05f, a);
				float rx = right.x * r, ry = right.y * r, rz = right.z * r, ux = up.x * r, uy = up.y * r, uz = up.z * r;
				bb.vertex(m, x - rx - ux, y - ry - uy, z - rz - uz).texture(0, 1).color(cbm);
				bb.vertex(m, x + rx - ux, y + ry - uy, z + rz - uz).texture(1, 1).color(cbm);
				bb.vertex(m, x + rx + ux, y + ry + uy, z + rz + uz).texture(1, 0).color(ct);
				bb.vertex(m, x - rx + ux, y - ry + uy, z - rz + uz).texture(0, 0).color(ct);
			}
			var built = bb.endNullable();
			if (built != null) BufferRenderer.drawWithGlobalProgram(built);
		} finally {
			RenderSystem.depthMask(true);
			RenderSystem.enableCull();
			RenderSystem.disableBlend();
			RenderSystem.setShaderFog(oldFog);
		}
	}

	private static int col(float r, float g, float b, int a) {
		return a << 24 | Math.min(255, (int) (r * 255)) << 16 | Math.min(255, (int) (g * 255)) << 8 | Math.min(255, (int) (b * 255));
	}
}
