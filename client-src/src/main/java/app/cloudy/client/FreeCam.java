package app.cloudy.client;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.OtherClientPlayerEntity;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.option.Perspective;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;

/**
 * Freelook (Taste halten): Kamera kreist 360 Grad um dich, dein Kopf und deine Blickrichtung bewegen sich nicht.
 * Freecam (Taste druecken): freie Kamera, die du mit WASD / Leertaste / Shift durch die Welt fliegst, waehrend dein Spieler stehen bleibt.
 * Beides nutzt eine unsichtbare Kamera-Figur (setCameraEntity); die Mausbewegung wird von deinem Spieler auf diese Figur umgeleitet.
 */
public final class FreeCam {
	private FreeCam() {}

	private static KeyBinding lookKey, freeKey, toggleKey;
	private static boolean toggled;
	private static OtherClientPlayerEntity cam;
	private static boolean look, free;
	private static float lockYaw, lockPitch, cyaw, cpitch;
	private static double fx, fy, fz;
	private static Perspective prevPersp;
	private static long lastNs;

	public static boolean active() { return look || free || cine; }
	// Cinematic-Kamera (weiche Fahrt um den Spieler mit Filmbalken) und Fotomodus (freie Kamera ohne HUD, Filter, Screenshot)
	private static boolean cine, photo, hudWas; private static double cang;
	public static boolean cinematic() { return cine; }
	public static boolean photoMode() { return photo; }

	/** Vom Kamera-Mixin gelesen. mixinHit zeigt, dass der Mixin laeuft; sonst schaltet FreeCam nach kurzer Zeit auf den Kompatibilitaetsmodus (Kamerafigur) um. */
	public static volatile boolean mixinHit;
	private static int frames;
	private static boolean fallback;
	public static boolean inFallback() { return fallback; }
	public static boolean isFree() { return free || cine; }
	public static float yaw() { return cyaw; }
	public static float pitch() { return cpitch; }
	public static double fx() { return fx; }
	public static double fy() { return fy; }
	public static double fz() { return fz; }

	public static void init(KeyBinding lk, KeyBinding fk, KeyBinding tk) {
		lookKey = lk; freeKey = fk; toggleKey = tk;
		ClientTickEvents.START_CLIENT_TICK.register(FreeCam::tick);
		try { WorldRenderEvents.START.register(ctx -> frame()); } catch (Throwable t) { CloudyClient.LOG.warn("Freecam-Frame nicht verfuegbar", t); }
	}

	private static void tick(MinecraftClient mc) {
		try {
			if (mc.player == null || mc.world == null) { if (active()) stop(mc); return; }
			if (photo && !(mc.currentScreen instanceof PhotoScreen)) stop(mc); // Fotomodus-Fenster geschlossen
			while (freeKey.wasPressed()) {
				if (free) stop(mc);
				else if (ModConfig.isOn("freecam")) { if (look) stop(mc); startFree(mc); }
			}
			while (toggleKey.wasPressed()) {
				if (look) stop(mc);
				else if (!free && ModConfig.isOn("freelook")) { startLook(mc); toggled = true; }
			}
			boolean down = lookKey.isPressed() && mc.currentScreen == null;
			if (down && !look && !free && ModConfig.isOn("freelook")) { startLook(mc); toggled = false; }
			else if (!down && look && !toggled) stop(mc);
			if (free || cine) { // Spielersteuerung sperren: der Spieler bleibt stehen, die Tasten steuern nur die Kamera
				var o = mc.options;
				for (KeyBinding k : new KeyBinding[] {o.forwardKey, o.backKey, o.leftKey, o.rightKey, o.jumpKey, o.sneakKey, o.sprintKey, o.attackKey, o.useKey}) { k.setPressed(false); while (k.wasPressed()) { } }
			}
		} catch (Throwable t) { fail(mc, "tick", t); }
	}

	/** Fehler nicht verschlucken: ins Log und als Meldung im Spiel zeigen, damit man sieht, woran es liegt. */
	private static void fail(MinecraftClient mc, String where, Throwable t) {
		CloudyClient.LOG.warn("Freelook/Freecam Fehler in " + where, t);
		try { if (mc.player != null) mc.player.sendMessage(Text.literal("Cloudy Freelook/Freecam Fehler (" + where + "): " + t), false); } catch (Throwable ignored) {}
		try { stop(mc); } catch (Throwable ignored) {}
	}

	private static void begin(MinecraftClient mc) {
		cam = null; fallback = false; mixinHit = false; frames = 0;
		lockYaw = mc.player.getYaw(); lockPitch = mc.player.getPitch();
		cyaw = lockYaw; cpitch = lockPitch;
		lastNs = System.nanoTime();
	}

	private static void startLook(MinecraftClient mc) {
		begin(mc);
		look = true;
		mc.player.sendMessage(Text.literal("Freelook an (nochmal die Taste = aus)"), true);
	}

	private static void startFree(MinecraftClient mc) {
		begin(mc);
		free = true;
		fx = mc.player.getX(); fy = mc.player.getEyeY(); fz = mc.player.getZ();
		mc.player.sendMessage(Text.literal("Freecam: WASD / Space / Shift fliegen, Ctrl schneller. Taste nochmal = zurueck"), true);
	}

	/** Taste fuer die Cinematic-Kamera: an/aus. */
	public static void toggleCinematic(MinecraftClient mc) {
		if (mc.player == null) return;
		if (cine) { stop(mc); return; }
		if (active()) stop(mc);
		begin(mc); cine = true; cang = Math.toRadians(mc.player.getYaw()) + Math.PI; // vorne starten
		hudWas = mc.options.hudHidden; mc.options.hudHidden = true;
		place3(mc, 0f);
	}

	/** Fotomodus: freie Kamera ab der aktuellen Blickposition, HUD aus; das Fenster PhotoScreen steuert Filter und Ausloeser. */
	public static void startPhoto(MinecraftClient mc) {
		if (mc.player == null) return;
		if (active()) stop(mc);
		begin(mc); free = true; photo = true;
		fx = mc.player.getX(); fy = mc.player.getEyeY(); fz = mc.player.getZ();
		hudWas = mc.options.hudHidden; mc.options.hudHidden = true;
	}

	public static void endPhoto(MinecraftClient mc) { if (photo) stop(mc); }

	/** Im Fotomodus mit gedrueckter Maus drehen (der Mauszeiger ist sichtbar). */
	public static void turn(double dx, double dy) { cyaw += (float) dx * 0.25f; cpitch = Math.max(-90f, Math.min(90f, cpitch + (float) dy * 0.25f)); }

	private static void place3(MinecraftClient mc, float dt) {
		var p = mc.player; if (p == null) return;
		cang += dt * 0.32; // ca. 20 s pro Runde
		double tx = p.getX(), ty = p.getEyeY() - 0.15, tz = p.getZ(), r = 4.2, h = 0.9 + 0.35 * Math.sin(cang * 0.5);
		fx = tx + Math.sin(cang) * r; fz = tz + Math.cos(cang) * r; fy = ty + h;
		double dx = tx - fx, dy = ty - fy, dz = tz - fz, hd = Math.sqrt(dx * dx + dz * dz);
		cyaw = (float) Math.toDegrees(Math.atan2(-dx, dz)); cpitch = (float) Math.toDegrees(-Math.atan2(dy, hd));
	}

	private static void stop(MinecraftClient mc) {
		boolean wasFree = free;
		if (cine || photo) { mc.options.hudHidden = hudWas; wasFree = false; }
		cine = false; photo = false;
		look = false; free = false; toggled = false;
		if (mc.player != null) {
			mc.player.setYaw(lockYaw); mc.player.setPitch(lockPitch);
			if (fallback) mc.setCameraEntity(mc.player);
		}
		if (fallback && prevPersp != null) mc.options.setPerspective(prevPersp);
		prevPersp = null; cam = null; fallback = false;
		if (wasFree && mc.player != null) mc.player.sendMessage(Text.literal("Freecam aus"), true);
	}

	/** Kompatibilitaetsmodus: falls der Kamera-Mixin nicht greift, wird eine unsichtbare Kamerafigur genutzt. */
	private static void activateFallback(MinecraftClient mc) {
		fallback = true;
		cam = new OtherClientPlayerEntity(mc.world, mc.player.getGameProfile());
		cam.setInvisible(true);
		prevPersp = mc.options.getPerspective();
		mc.options.setPerspective(free || cine ? Perspective.FIRST_PERSON : Perspective.THIRD_PERSON_BACK);
		if (free) fy = mc.player.getEyeY() - cam.getStandingEyeHeight();
		place(mc);
		mc.setCameraEntity(cam);
	}

	private static void place(MinecraftClient mc) {
		if (cam == null) return;
		if (free || cine) {
			cam.prevX = fx; cam.prevY = fy; cam.prevZ = fz;
			cam.setPosition(fx, fy, fz);
		} else {
			var p = mc.player;
			cam.prevX = p.prevX; cam.prevY = p.prevY; cam.prevZ = p.prevZ;
			cam.setPosition(p.getX(), p.getY(), p.getZ());
		}
		cam.setYaw(cyaw); cam.setPitch(cpitch);
		cam.prevYaw = cyaw; cam.prevPitch = cpitch;
	}

	/** Pro Bild: Mausbewegung auf die Kamera umleiten, Kamera bewegen. */
	private static void frame() {
		MinecraftClient mc = MinecraftClient.getInstance();
		try {
			if (!active() || mc.player == null) return;
			if (!fallback && !mixinHit && ++frames == 12) activateFallback(mc);
			long now = System.nanoTime();
			float dt = Math.min(0.1f, (now - lastNs) / 1e9f);
			lastNs = now;
			boolean ui = mc.currentScreen == null || mc.currentScreen instanceof PhotoScreen;
			if (cine) { place3(mc, dt); mc.player.setYaw(lockYaw); mc.player.setPitch(lockPitch); mc.player.prevYaw = lockYaw; mc.player.prevPitch = lockPitch; if (cam != null) place(mc); return; }
			if (mc.currentScreen == null) {
				cyaw += mc.player.getYaw() - lockYaw;
				cpitch = Math.max(-90f, Math.min(90f, cpitch + (mc.player.getPitch() - lockPitch)));
			}
			mc.player.setYaw(lockYaw); mc.player.setPitch(lockPitch);
			mc.player.prevYaw = lockYaw; mc.player.prevPitch = lockPitch;
			if (free && ui) {
				long w = mc.getWindow().getHandle();
				var o = mc.options;
				double yr = Math.toRadians(cyaw), pr = Math.toRadians(cpitch);
				double fwdX = -Math.sin(yr) * Math.cos(pr), fwdY = -Math.sin(pr), fwdZ = Math.cos(yr) * Math.cos(pr);
				double rtX = -Math.cos(yr), rtZ = -Math.sin(yr);
				double f = (down(w, o.forwardKey) ? 1 : 0) - (down(w, o.backKey) ? 1 : 0), s = (down(w, o.rightKey) ? 1 : 0) - (down(w, o.leftKey) ? 1 : 0), u = (down(w, o.jumpKey) ? 1 : 0) - (down(w, o.sneakKey) ? 1 : 0);
				double sp = (photo ? (down(w, o.sprintKey) ? 9 : 2.5) : down(w, o.sprintKey) ? 40 : 14) * dt; // Fotomodus: langsam und genau
				fx += (fwdX * f + rtX * s) * sp; fy += (fwdY * f + u) * sp; fz += (fwdZ * f + rtZ * s) * sp;
			}
			if (cam != null) place(mc);
		} catch (Throwable t) { fail(mc, "frame", t); }
	}

	private static boolean down(long w, KeyBinding k) {
		try {
			InputUtil.Key key = KeyBindingHelper.getBoundKeyOf(k);
			if (key.getCategory() != InputUtil.Type.KEYSYM) return false;
			return InputUtil.isKeyPressed(w, key.getCode());
		} catch (Throwable t) { return false; }
	}
}
