package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;

/** Komfort-Funktionen von Cloudy Mods: Auto-Sprint, Zoom, Fullbright. */
public final class Qol {
	private static boolean zooming, fb, zoomOn;
	private static int savedFov;
	public static volatile boolean fovHit;
	private static float level = 1.75f, shown = 1f;
	private static int noHit;

	/** Aktueller Zoomfaktor (1 = kein Zoom), weich nachgefuehrt. Vom FOV-Mixin gelesen. */
	public static float zoomFactor() { return shown; }

	/** Mausrad: bei aktivem Zoom naeher (hoch) oder weiter weg (runter). Gibt true zurueck, wenn das Rad verbraucht wurde. */
	public static boolean scroll(double dy) {
		if (!zoomOn || !ModConfig.isOn("zoom") || MinecraftClient.getInstance().currentScreen != null) return false;
		level = Math.max(1.2f, Math.min(30f, level * (dy > 0 ? 1.2f : 1f / 1.2f)));
		return true;
	}

	private static void raw(net.minecraft.client.option.SimpleOption<Integer> o, int v) {
		try { ((app.cloudy.client.mixin.OptionAccessor) (Object) o).cloudy$setRaw(v); } catch (Throwable t) { try { o.setValue(Math.max(30, v)); } catch (Throwable ignored) {} }
	}

	public static void tick(MinecraftClient mc, KeyBinding zoomKey) {
		if (mc.player == null) return;
		if (zoomKey != null) while (zoomKey.wasPressed()) if (mc.currentScreen == null && ModConfig.isOn("zoom")) { zoomOn = !zoomOn; }
		if (!ModConfig.isOn("zoom")) zoomOn = false;
		float target = zoomOn ? level : 1f;
		shown += (target - shown) * 0.35f;
		if (Math.abs(target - shown) < 0.01f) shown = target;
		// Reserve: greift der FOV-Mixin nicht, wird die FOV-Einstellung direkt angepasst
		var fov = mc.options.getFov();
		boolean viaOption = !fovHit && shown > 1.001f;
		if (viaOption && !zooming) { savedFov = fov.getValue(); zooming = true; }
		if (zooming) { if (viaOption) raw(fov, Math.max(5, Math.round(savedFov / shown))); else { raw(fov, savedFov); zooming = false; } }
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
