package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;

/** Komfort-Funktionen von Cloudy Mods: Auto-Sprint, Zoom, Fullbright. */
public final class Qol {
	private static boolean zooming, fb, toggled, active, fovEver, levelDirty;
	private static int savedFov;
	public static volatile boolean fovHit;
	private static float shown = 1f;
	private static long lastFrame, zoomSince;

	/** Aktueller Zoomfaktor (1 = kein Zoom). Wird pro Bild weich nachgefuehrt (zeitbasiert, unabhaengig von FPS und Ticks). Vom FOV-Mixin gelesen. */
	public static float zoomFactor() {
		long now = System.nanoTime();
		float dt = lastFrame == 0 ? 0.016f : Math.min(0.1f, (now - lastFrame) / 1e9f);
		lastFrame = now;
		float target = active ? ModConfig.zoomLevel : 1f;
		shown += (target - shown) * (1f - (float) Math.exp(-dt * 14f));
		if (Math.abs(target - shown) < 0.005f) shown = target;
		return shown;
	}

	/** Gerade gezoomt? (fuer die ruhigere Maus) */
	public static boolean zooming() { return shown > 1.01f; }

	/** Mausrad: bei aktivem Zoom naeher (hoch) oder weiter weg (runter). Gibt true zurueck, wenn das Rad verbraucht wurde. */
	public static boolean scroll(double dy) {
		if (!active || MinecraftClient.getInstance().currentScreen != null) return false;
		ModConfig.zoomLevel = Math.max(1.2f, Math.min(30f, ModConfig.zoomLevel * (dy > 0 ? 1.2f : 1f / 1.2f)));
		levelDirty = true;
		return true;
	}

	private static void raw(net.minecraft.client.option.SimpleOption<Integer> o, int v) {
		try { ((app.cloudy.client.mixin.OptionAccessor) (Object) o).cloudy$setRaw(v); } catch (Throwable t) { try { o.setValue(Math.max(30, v)); } catch (Throwable ignored) {} }
	}

	/** FOV-Reserve zuruecksetzen (z. B. beim Verlassen der Welt), damit nie ein verstellter FOV-Wert gespeichert bleibt. */
	private static void restoreFov(MinecraftClient mc) {
		if (zooming) { raw(mc.options.getFov(), savedFov); zooming = false; }
	}

	public static void tick(MinecraftClient mc, KeyBinding zoomKey) {
		if (mc.player == null) { active = false; toggled = false; restoreFov(mc); if (zoomKey != null) while (zoomKey.wasPressed()) {} return; }
		boolean allowed = ModConfig.isOn("zoom") && mc.currentScreen == null; // Menue offen: Zoom aus (nichts haengt nach)
		if (zoomKey != null) while (zoomKey.wasPressed()) if (allowed && !ModConfig.zoomHold) toggled = !toggled;
		if (!ModConfig.isOn("zoom")) toggled = false;
		boolean zw = allowed && (ModConfig.zoomHold ? zoomKey != null && zoomKey.isPressed() : toggled);
		if (zw && !active) zoomSince = System.currentTimeMillis();
		if (!zw && active && levelDirty) { levelDirty = false; ModConfig.save(); } // gescrollte Stufe merken
		active = zw;
		if (fovHit) fovEver = true;
		// Reserve nur, wenn der FOV-Mixin nie gegriffen hat (sonst doppelter Zoom oder Flackern)
		boolean viaOption = !fovEver && shown > 1.001f && System.currentTimeMillis() - zoomSince > 300;
		var fov = mc.options.getFov();
		if (viaOption && !zooming) { savedFov = fov.getValue(); zooming = true; }
		if (zooming) { if (viaOption) raw(fov, Math.max(5, Math.round(savedFov / shown))); else restoreFov(mc); }
		fovHit = false;
		if (ModConfig.isOn("sprint") && mc.player.input != null && mc.player.input.movementForward > 0 && !mc.player.horizontalCollision && !mc.player.isSneaking()) mc.player.setSprinting(true);
		boolean want = ModConfig.isOn("fullbright");
		if (want) {
			StatusEffectInstance cur = mc.player.getStatusEffect(StatusEffects.NIGHT_VISION);
			if (cur == null || cur.getDuration() < 220) mc.player.addStatusEffect(new StatusEffectInstance(StatusEffects.NIGHT_VISION, 400, 0, false, false));
			fb = true;
		} else if (fb) { mc.player.removeStatusEffect(StatusEffects.NIGHT_VISION); fb = false; }
	}
}
