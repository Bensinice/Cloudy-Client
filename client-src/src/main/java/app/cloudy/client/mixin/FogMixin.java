package app.cloudy.client.mixin;

import app.cloudy.client.ModConfig;
import net.minecraft.client.render.BackgroundRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Nebel: aus, eigene Farbe, Entfernung. Das Nebel-Objekt wird ohne feste Klassennamen neu aufgebaut, damit es auf verschiedenen Versionen laeuft. */
@Mixin(BackgroundRenderer.class)
public abstract class FogMixin {
	private static final float[] DIST = {0.5f, 0.75f, 1f, 1.5f, 2f};

	@Inject(method = "applyFog", at = @At("RETURN"), cancellable = true, require = 0)
	private static void cloudy$fog(CallbackInfoReturnable<Object> cir) {
		try {
			if (!ModConfig.isOn("sky") || (ModConfig.fogMode == 0 && ModConfig.fogDist == 2)) return;
			Object v = cir.getReturnValue();
			if (v == null) return;
			Class<?> k = v.getClass();
			var rc = k.getRecordComponents();
			if (rc == null || rc.length < 7) return;
			Object[] a = new Object[rc.length];
			for (int i = 0; i < rc.length; i++) { var m = rc[i].getAccessor(); m.setAccessible(true); a[i] = m.invoke(v); }
			if (!(a[0] instanceof Float) || !(a[1] instanceof Float)) return;
			float s = (Float) a[0], e = (Float) a[1];
			if (e < 30f) return; // Wasser-, Lava- und Blindheitsnebel bleiben unveraendert
			if (ModConfig.fogMode == 1) { a[0] = Float.MAX_VALUE; a[1] = Float.MAX_VALUE; }
			else { float d = DIST[Math.max(0, Math.min(4, ModConfig.fogDist))]; a[0] = s * d; a[1] = e * d; }
			if (ModConfig.fogMode == 2) {
				int c = ModConfig.lcol(ModConfig.fogCol, 4);
				a[3] = (c >> 16 & 255) / 255f; a[4] = (c >> 8 & 255) / 255f; a[5] = (c & 255) / 255f;
			}
			var ctor = k.getDeclaredConstructors()[0];
			ctor.setAccessible(true);
			cir.setReturnValue(ctor.newInstance(a));
		} catch (Throwable ignored) {}
	}

	/** Hintergrundfarbe passend zum Nebel (sonst sieht man am Horizont einen Farbsprung). */
	@Inject(method = "getFogColor", at = @At("RETURN"), require = 0)
	private static void cloudy$fogColor(CallbackInfoReturnable<Object> cir) {
		try {
			if (!ModConfig.isOn("sky") || ModConfig.fogMode != 2) return;
			if (cir.getReturnValue() instanceof org.joml.Vector4f v) {
				int c = ModConfig.lcol(ModConfig.fogCol, 4);
				float k = Math.max(0.15f, Math.max(v.x, Math.max(v.y, v.z)) / 0.75f); // Nacht bleibt dunkel
				k = Math.min(1f, k);
				v.set((c >> 16 & 255) / 255f * k, (c >> 8 & 255) / 255f * k, (c & 255) / 255f * k, v.w);
			}
		} catch (Throwable ignored) {}
	}
}
