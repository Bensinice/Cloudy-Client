package app.cloudy.client;

import com.mojang.blaze3d.systems.RenderSystem;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.BufferRenderer;
import net.minecraft.client.render.Fog;
import net.minecraft.client.gl.ShaderProgramKeys;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormat;
import net.minecraft.client.render.VertexFormats;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import net.minecraft.world.World;
import org.joml.Matrix4f;

import java.io.InputStream;

/**
 * Skybox: ein gemalter Himmel (6 Wuerfelseiten) ersetzt den normalen Himmel in der Oberwelt. Mod "skybox" in Cloudy Mods.
 * Gezeichnet vor den Entities: nur wo Himmel ist (Tiefentest gegen das Gelaende), ohne Nebel, ohne Tiefe zu schreiben.
 * Seitenausrichtung per Kantenvergleich der Bilder bestimmt (Seiten aufrecht, Decke vertikal gespiegelt).
 */
public final class SkyBox {
	private SkyBox() {}

	public static final String[] NAMES = {"Cloudy Dusk"};
	private static final String[] DIRS = {"dusk"};
	private static final String[] FACES = {"north", "south", "east", "west", "top", "bottom"};
	private static Identifier[] tex;
	private static boolean failed;
	private static int loadedFor = -1;
	/** Mittlere Horizontfarbe der Seiten (fuer Nebel und Himmelsfarbe, damit am Horizont keine Kante entsteht). */
	public static int horizon = 0x8A7FA0;
	/** Cloudy-Event laeuft gerade (vom Konto-Server, ueber den Launcher): Sternschnuppen-Regen. */
	public static volatile boolean event;

	/** Lebende Skybox: Farbe nach echter Uhrzeit und Jahreszeit (0xRRGGBB). */
	static int living() {
		java.time.LocalDateTime t = java.time.LocalDateTime.now(); float h = t.getHour() + t.getMinute() / 60f; int mo = t.getMonthValue();
		int c;
		if (h < 5f || h >= 22f) c = 0x39457A;            // Nacht
		else if (h < 7.5f) c = mix(0x39457A, 0xFFC9A6, (h - 5f) / 2.5f);   // Morgendaemmerung
		else if (h < 10f) c = mix(0xFFC9A6, 0xFFFFFF, (h - 7.5f) / 2.5f);
		else if (h < 17f) c = 0xFFFFFF;                   // Tag
		else if (h < 20f) c = mix(0xFFFFFF, 0xFFB08A, (h - 17f) / 3f);     // Abendrot
		else c = mix(0xFFB08A, 0x39457A, (h - 20f) / 2f);
		if (mo == 12 || mo <= 2) c = mix(c, 0xD6E8FF, 0.25f);      // Winter: kuehler
		else if (mo >= 6 && mo <= 8) c = mix(c, 0xFFE6B0, 0.15f); // Sommer: waermer
		return c;
	}
	static boolean realNight() { int h = java.time.LocalTime.now().getHour(); return h < 5 || h >= 22; }
	private static int mix(int a, int b, float t) { t = Math.max(0f, Math.min(1f, t)); int r = (int) (((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t), g = (int) (((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t), bl = (int) ((a & 255) * (1 - t) + (b & 255) * t); return r << 16 | g << 8 | bl; }

	// ---- Sternschnuppen: feste Arrays, keine Objekte pro Bild ----
	private static final int NS = 24;
	private static final float[] SX = new float[NS * 3], SV = new float[NS * 3]; private static final long[] ST = new long[NS]; private static long nextStar;
	private static void spawnStar(long now) {
		int k = -1; for (int i = 0; i < NS; i++) if (now - ST[i] > 1400) { k = i; break; } if (k < 0) return;
		double yaw = Math.random() * Math.PI * 2, pit = Math.toRadians(25 + Math.random() * 45);
		float x = (float) (Math.cos(pit) * Math.cos(yaw)), y = (float) Math.sin(pit), z = (float) (Math.cos(pit) * Math.sin(yaw));
		double a = yaw + Math.PI / 2 + (Math.random() - 0.5); float vx = (float) Math.cos(a), vz = (float) Math.sin(a), vy = -0.45f; float l = (float) Math.sqrt(vx * vx + vy * vy + vz * vz);
		SX[k * 3] = x; SX[k * 3 + 1] = y; SX[k * 3 + 2] = z; SV[k * 3] = vx / l; SV[k * 3 + 1] = vy / l; SV[k * 3 + 2] = vz / l; ST[k] = now;
	}
	private static void stars(Matrix4f m, float d, boolean night) {
		long now = System.currentTimeMillis();
		if ((night || event) && now >= nextStar) { spawnStar(now); nextStar = now + (event ? 250 + (long) (Math.random() * 350) : 6000 + (long) (Math.random() * 9000)); }
		boolean any = false; for (int i = 0; i < NS; i++) if (now - ST[i] < 1400) { any = true; break; } if (!any) return;
		RenderSystem.enableBlend(); RenderSystem.blendFunc(com.mojang.blaze3d.platform.GlStateManager.SrcFactor.SRC_ALPHA, com.mojang.blaze3d.platform.GlStateManager.DstFactor.ONE);
		RenderSystem.setShader(ShaderProgramKeys.POSITION_COLOR);
		BufferBuilder bb = Tessellator.getInstance().begin(VertexFormat.DrawMode.QUADS, VertexFormats.POSITION_COLOR);
		float R = d * 0.92f, w = d * 0.0035f;
		for (int i = 0; i < NS; i++) {
			long age = now - ST[i]; if (age >= 1400 || ST[i] == 0) continue; float t = age / 1400f, life = t < 0.15f ? t / 0.15f : 1f - (t - 0.15f) / 0.85f;
			float hx = SX[i * 3] + SV[i * 3] * t * 0.35f, hy = SX[i * 3 + 1] + SV[i * 3 + 1] * t * 0.35f, hz = SX[i * 3 + 2] + SV[i * 3 + 2] * t * 0.35f, len = 0.12f;
			float tx = hx - SV[i * 3] * len, ty = hy - SV[i * 3 + 1] * len, tz = hz - SV[i * 3 + 2] * len;
			int head = (int) (255 * life) << 24 | (event ? 0xFFE7A0 : 0xFFFFFF), tail = 0x00A0C8FF;
			bb.vertex(m, hx * R, hy * R + w, hz * R).color(head); bb.vertex(m, hx * R, hy * R - w, hz * R).color(head);
			bb.vertex(m, tx * R, ty * R - w * 0.3f, tz * R).color(tail); bb.vertex(m, tx * R, ty * R + w * 0.3f, tz * R).color(tail);
		}
		var built = bb.endNullable(); if (built != null) BufferRenderer.drawWithGlobalProgram(built);
		RenderSystem.defaultBlendFunc(); RenderSystem.disableBlend();
	}

	public static boolean active() {
		MinecraftClient mc = MinecraftClient.getInstance();
		return ModConfig.isOn("skybox") && !failed && mc.world != null && mc.world.getRegistryKey() == World.OVERWORLD;
	}

	private static boolean load() {
		int k = Math.max(0, Math.min(DIRS.length - 1, ModConfig.skyboxId));
		if (tex != null && loadedFor == k) return true;
		if (failed) return false;
		try {
			Identifier[] t = new Identifier[6];
			long r = 0, g = 0, b = 0, n = 0;
			for (int i = 0; i < 6; i++) {
				try (InputStream in = SkyBox.class.getResourceAsStream("/cloudy-cos/sky/" + DIRS[k] + "/" + FACES[i] + ".png")) {
					if (in == null) throw new java.io.IOException(FACES[i] + ".png fehlt");
					NativeImage img = NativeImage.read(in);
					if (i < 4) { // Horizontband (Bildmitte) mitteln
						int y0 = img.getHeight() / 2 - img.getHeight() / 16, y1 = img.getHeight() / 2 + img.getHeight() / 16;
						for (int y = y0; y < y1; y += 4) for (int x = 0; x < img.getWidth(); x += 8) { int c = img.getColorArgb(x, y); r += (c >> 16) & 255; g += (c >> 8) & 255; b += c & 255; n++; }
					}
					NativeImageBackedTexture nt = new NativeImageBackedTexture(img);
					Identifier id = Identifier.of("cloudy-client", "sky/" + DIRS[k] + "_" + FACES[i]);
					MinecraftClient.getInstance().getTextureManager().registerTexture(id, nt);
					try { nt.setFilter(true, false); } catch (Throwable ignored) {} // weich statt pixelig
					t[i] = id;
				}
			}
			if (n > 0) horizon = (int) (r / n) << 16 | (int) (g / n) << 8 | (int) (b / n);
			tex = t; loadedFor = k;
			return true;
		} catch (Exception e) { failed = true; CloudyClient.LOG.warn("Skybox nicht ladbar", e); return false; }
	}

	/** Wuerfelseiten: Mitte, Richtung u+ (rechts im Bild), Richtung v+ (unten im Bild); Blick von innen. */
	private static final float[][][] F = {
		{{0, 0, -1}, {1, 0, 0}, {0, -1, 0}},   // north
		{{0, 0, 1}, {-1, 0, 0}, {0, -1, 0}},   // south
		{{1, 0, 0}, {0, 0, 1}, {0, -1, 0}},    // east
		{{-1, 0, 0}, {0, 0, -1}, {0, -1, 0}},  // west
		{{0, 1, 0}, {1, 0, 0}, {0, 0, -1}},    // top (Bild vertikal gespiegelt)
		{{0, -1, 0}, {1, 0, 0}, {0, 0, -1}},   // bottom
	};

	public static void render(WorldRenderContext ctx) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (!active() || !load()) { // ohne Skybox: beim Event trotzdem Sternschnuppen
			if (!event || mc.world == null || mc.world.getRegistryKey() != World.OVERWORLD) return;
			try { MatrixStack ms0 = ctx.matrixStack(); if (ms0 == null) return; Fog of = RenderSystem.getShaderFog(); try { RenderSystem.setShaderFog(Fog.DUMMY); RenderSystem.enableDepthTest(); RenderSystem.depthMask(false); RenderSystem.disableCull(); stars(new Matrix4f(ms0.peek().getPositionMatrix()), Math.max(64f, mc.options.getClampedViewDistance() * 16f * 1.45f), false); } finally { RenderSystem.depthMask(true); RenderSystem.enableCull(); RenderSystem.setShaderFog(of); } } catch (Throwable ignored) {}
			return;
		}
		MatrixStack ms = null;
		try { ms = ctx.matrixStack(); } catch (Throwable ignored) {}
		Matrix4f m;
		if (ms != null) m = new Matrix4f(ms.peek().getPositionMatrix());
		else {
			try { Object pm = WorldRenderContext.class.getMethod("positionMatrix").invoke(ctx); if (!(pm instanceof Matrix4f m4)) return; m = new Matrix4f(m4); } catch (Throwable t) { return; }
		}
		float d = Math.max(64f, mc.options.getClampedViewDistance() * 16f * 1.45f); // hinter dem Gelaende, vor der Sichtgrenze
		Fog oldFog = RenderSystem.getShaderFog();
		try {
			RenderSystem.setShaderFog(Fog.DUMMY);
			RenderSystem.enableDepthTest();
			RenderSystem.depthMask(false);
			RenderSystem.disableBlend();
			RenderSystem.disableCull();
			boolean live = ModConfig.isOn("livingsky"); int tint = live ? living() : 0xFFFFFF; if (event) tint = mix(tint, 0x9C7CFF, 0.35f); // Event: violetter Himmel
			RenderSystem.setShader(ShaderProgramKeys.POSITION_TEX_COLOR);
			for (int f = 0; f < 6; f++) {
				float[] c = F[f][0], u = F[f][1], v = F[f][2];
				RenderSystem.setShaderTexture(0, tex[f]);
				BufferBuilder bb = Tessellator.getInstance().begin(VertexFormat.DrawMode.QUADS, VertexFormats.POSITION_TEXTURE_COLOR);
				float[][] uv = {{0, 0}, {0, 1}, {1, 1}, {1, 0}};
				for (float[] q : uv) {
					float su = q[0] * 2f - 1f, sv = q[1] * 2f - 1f;
					bb.vertex(m, (c[0] + u[0] * su + v[0] * sv) * d, (c[1] + u[1] * su + v[1] * sv) * d, (c[2] + u[2] * su + v[2] * sv) * d).texture(q[0], q[1]).color(0xFF000000 | tint);
				}
				BufferRenderer.drawWithGlobalProgram(bb.end());
			}
			boolean night = live ? realNight() : (mc.world != null && (mc.world.getTimeOfDay() % 24000L) > 13000L && (mc.world.getTimeOfDay() % 24000L) < 23000L);
			stars(m, d, night);
		} finally {
			RenderSystem.depthMask(true);
			RenderSystem.enableCull();
			RenderSystem.setShaderFog(oldFog);
		}
	}
}
