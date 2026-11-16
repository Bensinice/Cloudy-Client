package app.cloudy.client;

import com.mojang.blaze3d.systems.RenderSystem;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gl.ShaderProgramKeys;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.BufferBuilder;
import net.minecraft.client.render.BufferRenderer;
import net.minecraft.client.render.Tessellator;
import net.minecraft.client.render.VertexFormat;
import net.minecraft.client.render.VertexFormats;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.Entity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.util.math.Vec3d;
import org.joml.Matrix4f;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 3: Partikel-Spuren, Sieg-/Kill-Effekte, Fussspuren, Pet-Funkeln und reaktive Umhaenge.
 * Alles nur auf diesem PC gezeichnet (vanilla Partikel, keine Server-Pakete) – andere Cloudy-Spieler sehen es bei sich ueber ihre eigene Mod.
 * Sparsam: Spuren hoechstens alle 2–3 Ticks ein Partikel pro Spieler, Fussspuren in einem festen Ringpuffer (keine Objekte pro Bild).
 */
public final class Effects {
	private Effects() {}

	public static final Set<String> TRAILS = Set.of("trail-stars", "trail-clouds", "trail-gold", "trail-hearts", "trail-notes", "trail-runes", "trail-soul", "trail-cherry", "trail-snow"), WINFX = Set.of("winfx-firework", "winfx-cloud");
	public static boolean known(String id) { return id != null && (TRAILS.contains(id) || WINFX.contains(id) || id.equals("foot-prints")); }

	// ---- Fussspuren: Ringpuffer ----
	private static final int MAXP = 192;
	private static final double[] PX = new double[MAXP], PY = new double[MAXP], PZ = new double[MAXP];
	private static final float[] PYAW = new float[MAXP];
	private static final long[] PT = new long[MAXP];
	private static final int[] PC = new int[MAXP];
	private static int head;
	private static final long LIFE = 9000;
	private static final Map<UUID, double[]> LAST = new HashMap<>(); // x, z, Seite
	private static int tick;

	private static String[] data(MinecraftClient mc, AbstractClientPlayerEntity p) { // {trail, winfx, foot, pet}
		if (p == mc.player) return new String[] { Cosmetics.trail, Cosmetics.winfx, Cosmetics.foot, Cosmetics.pet };
		String[] e = CosmeticNet.get(p.getName().getString());
		if (e == null) return null;
		return new String[] { e.length > 4 ? e[4] : null, e.length > 5 ? e[5] : null, e.length > 6 ? e[6] : null, e.length > 3 ? e[3] : null };
	}

	public static void tick(MinecraftClient mc) {
		if (mc.world == null || mc.player == null) { LAST.clear(); return; }
		tick++;
		if (tick % 40 == 0) journal(mc);
		boolean trails = ModConfig.isOn("trails"), feet = ModConfig.isOn("footprints"), petfx = ModConfig.isOn("petemote");
		if (!trails && !feet && !petfx) return;
		Vec3d cam = mc.player.getPos();
		for (AbstractClientPlayerEntity p : mc.world.getPlayers()) {
			if (p.isInvisible() || p.isSpectator() || p.squaredDistanceTo(cam) > 48 * 48) continue;
			String[] d = data(mc, p); if (d == null) continue;
			boolean self = p == mc.player;
			double dx = p.getX() - p.prevX, dy = p.getY() - p.prevY, dz = p.getZ() - p.prevZ; boolean fly = p.isGliding();
			boolean moving = dx * dx + dz * dz > 0.0004 || Math.abs(dy) > 0.05;
			if (trails && d[0] != null && moving) {
				int every = fly ? 1 : self ? 2 : 3; if ("trail-hearts".equals(d[0]) || "trail-notes".equals(d[0])) every *= 3;
				if ((tick + p.getId()) % every == 0) trail(mc, p, d[0], dx, dz, fly);
			}
			if (feet && d[2] != null && p.isOnGround() && !p.isSwimming()) footstep(p, self ? Cosmetics.dyeMain("foot-prints", 0x6EAAFF) : CosmeticNet.dyeMain(p.getName().getString(), "foot-prints", 0x6EAAFF));
			if (petfx && d[3] != null && (tick + p.getId()) % 14 == 0) {
				int lv = self ? Cosmetics.petLv(d[3]) : CosmeticNet.petLv(p.getName().getString());
				if (lv >= 3) { // ab Stufe 3 funkelt das Pet
					double a = Math.toRadians(p.getBodyYaw()), ox = -Math.cos(a) * 0.8, oz = -Math.sin(a) * 0.8;
					mc.world.addParticle(lv >= 5 ? ParticleTypes.WAX_ON : ParticleTypes.END_ROD, p.getX() + ox + (Math.random() - 0.5) * 0.4, p.getY() + 1.3 + Math.random() * 0.4, p.getZ() + oz + (Math.random() - 0.5) * 0.4, 0, 0.01, 0);
				}
			}
		}
		if (tick % 200 == 0) LAST.keySet().removeIf(u -> mc.world.getPlayerByUuid(u) == null);
	}

	private static boolean jDia, jNether, jEnd; // pro Sitzung einmal melden (der Launcher merkt sich die "ersten Male")
	private static void journal(MinecraftClient mc) {
		try {
			var key = mc.world.getRegistryKey();
			if (!jNether && key == net.minecraft.world.World.NETHER) { jNether = true; Social.journal("nether"); }
			if (!jEnd && key == net.minecraft.world.World.END) { jEnd = true; Social.journal("end"); }
			if (!jDia && mc.player.getInventory().count(net.minecraft.item.Items.DIAMOND) > 0) { jDia = true; Social.journal("diamond"); }
		} catch (Throwable ignored) {}
	}

	private static void trail(MinecraftClient mc, Entity p, String id, double dx, double dz, boolean fly) {
		double x = p.getX() - dx * 1.5 + (Math.random() - 0.5) * 0.3, y = p.getY() + (fly ? 0.4 : 0.15) + Math.random() * 0.2, z = p.getZ() - dz * 1.5 + (Math.random() - 0.5) * 0.3;
		ParticleEffect t; double vx = 0, vy = 0.01, vz = 0;
		switch (id) {
			case "trail-stars" -> { t = ParticleTypes.END_ROD; vy = 0.005; }
			case "trail-clouds" -> { t = ParticleTypes.CLOUD; vy = 0.0; }
			case "trail-gold" -> t = ParticleTypes.WAX_ON;
			case "trail-hearts" -> { t = ParticleTypes.HEART; y += 0.3; }
			case "trail-notes" -> { t = ParticleTypes.NOTE; vx = Math.random(); vy = 0; y += 0.4; } // NOTE: vx = Farbe
			case "trail-runes" -> { t = ParticleTypes.ENCHANT; y += 0.6; vy = -0.3; } // Wochenaufgaben-Belohnungen
			case "trail-soul" -> { t = ParticleTypes.SOUL_FIRE_FLAME; vy = 0.01; }
			case "trail-cherry" -> { t = ParticleTypes.CHERRY_LEAVES; y += 0.5; vy = 0; }
			case "trail-snow" -> { t = ParticleTypes.SNOWFLAKE; vy = -0.01; }
			default -> { return; }
		}
		mc.world.addParticle(t, x, y, z, vx, vy, vz);
	}

	private static void footstep(AbstractClientPlayerEntity p, int col) {
		double[] l = LAST.get(p.getUuid());
		if (l == null) { LAST.put(p.getUuid(), new double[] { p.getX(), p.getZ(), 1 }); return; }
		double ddx = p.getX() - l[0], ddz = p.getZ() - l[1];
		if (ddx * ddx + ddz * ddz < 0.72 * 0.72) return;
		l[0] = p.getX(); l[1] = p.getZ(); l[2] = -l[2];
		float yaw = (float) Math.toDegrees(Math.atan2(-ddx, ddz)); // Laufrichtung
		double a = Math.toRadians(yaw), side = l[2] * 0.14;
		int i = head; head = (head + 1) % MAXP;
		PX[i] = p.getX() + Math.cos(a) * side; PY[i] = p.getY() + 0.012; PZ[i] = p.getZ() + Math.sin(a) * side; PYAW[i] = yaw; PT[i] = System.currentTimeMillis(); PC[i] = col & 0xFFFFFF;
	}

	/** Fussspuren als flache Formen auf dem Boden (nach den Entities). */
	public static void render(WorldRenderContext ctx) {
		if (!ModConfig.isOn("footprints") || ctx.camera() == null) return;
		long now = System.currentTimeMillis(); boolean any = false;
		for (int i = 0; i < MAXP; i++) if (PT[i] != 0 && now - PT[i] < LIFE) { any = true; break; }
		if (!any) return;
		MatrixStack ms = ctx.matrixStack(); if (ms == null) return;
		Matrix4f m = new Matrix4f(ms.peek().getPositionMatrix());
		Vec3d cam = ctx.camera().getPos();
		try {
			RenderSystem.enableBlend(); RenderSystem.defaultBlendFunc(); RenderSystem.enableDepthTest(); RenderSystem.depthMask(false); RenderSystem.disableCull();
			RenderSystem.setShader(ShaderProgramKeys.POSITION_COLOR);
			BufferBuilder bb = Tessellator.getInstance().begin(VertexFormat.DrawMode.QUADS, VertexFormats.POSITION_COLOR);
			for (int i = 0; i < MAXP; i++) {
				long age = now - PT[i]; if (PT[i] == 0 || age >= LIFE) continue;
				int al = (int) (150 * (1f - age / (float) LIFE)); if (al < 4) continue;
				int c = al << 24 | PC[i];
				float x = (float) (PX[i] - cam.x), y = (float) (PY[i] - cam.y), z = (float) (PZ[i] - cam.z);
				double a = Math.toRadians(PYAW[i]); float fx = (float) -Math.sin(a), fz = (float) Math.cos(a), sx = fz, sz = -fx; // vorne / seitlich
				quad(bb, m, c, x, y, z, fx, fz, sx, sz, -0.14f, 0.06f, 0.075f); // Ferse + Sohle
				quad(bb, m, c, x, y, z, fx, fz, sx, sz, 0.1f, 0.2f, 0.09f);    // Ballen
			}
			var built = bb.endNullable(); if (built != null) BufferRenderer.drawWithGlobalProgram(built);
		} catch (Throwable ignored) {
		} finally { RenderSystem.depthMask(true); RenderSystem.enableCull(); RenderSystem.disableBlend(); }
	}

	private static void quad(BufferBuilder bb, Matrix4f m, int c, float x, float y, float z, float fx, float fz, float sx, float sz, float f0, float f1, float w) {
		bb.vertex(m, x + fx * f0 - sx * w, y, z + fz * f0 - sz * w).color(c);
		bb.vertex(m, x + fx * f0 + sx * w, y, z + fz * f0 + sz * w).color(c);
		bb.vertex(m, x + fx * f1 + sx * w, y, z + fz * f1 + sz * w).color(c);
		bb.vertex(m, x + fx * f1 - sx * w, y, z + fz * f1 - sz * w).color(c);
	}

	// ---- Sieg / Kill (Erkennung zusammen mit AutoGG in Extras) ----
	private static long lastFx;
	public static void chat(String s, String me, boolean title) {
		if (Cosmetics.winfx == null || !ModConfig.isOn("winfx") || s == null) return;
		boolean win = s.contains("you won") || s.contains("you win") || s.contains("victory") || (s.contains(me) && (s.contains("won the game") || s.contains("wins the game") || s.contains("winner")));
		boolean kill = !win && !title && (s.contains(" by " + me) || s.contains(" von " + me) || s.contains("killed by " + me) || s.contains(me + " killed ") || s.contains("slain by " + me));
		if (win) Social.journal("win");
		if (win || kill) burst(win);
	}

	public static void burst(boolean big) {
		MinecraftClient mc = MinecraftClient.getInstance(); if (mc.world == null || mc.player == null) return;
		long now = System.currentTimeMillis(); if (now - lastFx < (big ? 3000 : 800)) return; lastFx = now;
		Vec3d p = mc.player.getPos(); boolean fw = "winfx-firework".equals(Cosmetics.winfx);
		int n = big ? 60 : 18;
		for (int i = 0; i < n; i++) {
			double th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI, sp = (big ? 0.35 : 0.18) * (0.6 + Math.random() * 0.4);
			double vx = Math.sin(ph) * Math.cos(th) * sp, vy = Math.cos(ph) * sp * 0.8 + (big ? 0.05 : 0.02), vz = Math.sin(ph) * Math.sin(th) * sp;
			mc.world.addParticle(fw ? ParticleTypes.FIREWORK : ParticleTypes.CLOUD, p.x, p.y + (big ? 2.6 : 1.4), p.z, vx, vy, vz);
		}
		if (fw && big) for (int i = 0; i < 16; i++) mc.world.addParticle(ParticleTypes.END_ROD, p.x + (Math.random() - 0.5) * 3, p.y + 2 + Math.random() * 2, p.z + (Math.random() - 0.5) * 3, 0, 0.02, 0);
		try { mc.player.playSound(fw ? net.minecraft.sound.SoundEvents.ENTITY_FIREWORK_ROCKET_BLAST : net.minecraft.sound.SoundEvents.ENTITY_PUFFER_FISH_BLOW_OUT, big ? 0.8f : 0.4f, 1.1f); } catch (Throwable ignored) {}
	}

	// ---- Reaktive Umhaenge: nass (Wasser/Regen), eisig (Pulverschnee/Frost/Eis), gluehend (Feuer/Lava) ----
	/** {Farbe, 1 = leuchtet} oder null. */
	public static int[] react(Entity e) {
		if (e == null || !ModConfig.isOn("reactivecapes")) return null;
		try {
			if (e.isOnFire() || e.isInLava()) return new int[] { 0xFFB070, 1 };
			if (e.isTouchingWaterOrRain()) return new int[] { 0x8FA8D0, 0 };
			var w = e.getWorld(); var below = w.getBlockState(e.getBlockPos().down());
			if (e.inPowderSnow || e.getFrozenTicks() > 0 || below.isIn(net.minecraft.registry.tag.BlockTags.ICE) || below.isOf(net.minecraft.block.Blocks.SNOW_BLOCK) || w.getBlockState(e.getBlockPos()).isOf(net.minecraft.block.Blocks.SNOW)) return new int[] { 0xDDF2FF, 0 };
		} catch (Throwable ignored) {}
		return null;
	}
}
