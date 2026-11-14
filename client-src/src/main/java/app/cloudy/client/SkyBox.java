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
		if (!active() || !load()) return;
		MinecraftClient mc = MinecraftClient.getInstance();
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
			RenderSystem.setShader(ShaderProgramKeys.POSITION_TEX);
			for (int f = 0; f < 6; f++) {
				float[] c = F[f][0], u = F[f][1], v = F[f][2];
				RenderSystem.setShaderTexture(0, tex[f]);
				BufferBuilder bb = Tessellator.getInstance().begin(VertexFormat.DrawMode.QUADS, VertexFormats.POSITION_TEXTURE);
				float[][] uv = {{0, 0}, {0, 1}, {1, 1}, {1, 0}};
				for (float[] q : uv) {
					float su = q[0] * 2f - 1f, sv = q[1] * 2f - 1f;
					bb.vertex(m, (c[0] + u[0] * su + v[0] * sv) * d, (c[1] + u[1] * su + v[1] * sv) * d, (c[2] + u[2] * su + v[2] * sv) * d).texture(q[0], q[1]);
				}
				BufferRenderer.drawWithGlobalProgram(bb.end());
			}
		} finally {
			RenderSystem.depthMask(true);
			RenderSystem.enableCull();
			RenderSystem.setShaderFog(oldFog);
		}
	}
}
