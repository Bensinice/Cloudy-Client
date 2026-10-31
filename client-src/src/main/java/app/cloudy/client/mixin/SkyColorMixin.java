package app.cloudy.client.mixin;

import app.cloudy.client.Theme;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Faerbt den Himmel der Oberwelt in der Farbe des im Shop gewaehlten Himmels. Tag/Nacht/Regen bleiben erhalten (Helligkeit kommt vom Original). */
@Mixin(ClientWorld.class)
public abstract class SkyColorMixin {
	@Inject(method = "getSkyColor(Lnet/minecraft/util/math/Vec3d;F)I", at = @At("RETURN"), cancellable = true, require = 0)
	private void cloudy$sky(Vec3d cam, float tickDelta, CallbackInfoReturnable<Integer> cir) {
		try {
			if (!app.cloudy.client.ModConfig.isOn("sky")) { beat(cir); return; }
			int src = app.cloudy.client.ModConfig.skySrc;
			int t = src == 0 ? Theme.worldSky : src == 1 ? (Theme.tSky1 & 0xFFFFFF) : app.cloudy.client.ModConfig.lcol(app.cloudy.client.ModConfig.skyCol, 2);
			if (t == 0) { beat(cir); return; }
			Theme.load();
			ClientWorld w = (ClientWorld) (Object) this;
			if (!w.getRegistryKey().getValue().getPath().equals("overworld")) return;
			int o = cir.getReturnValueI();
			float or = (o >> 16 & 255) / 255f, og = (o >> 8 & 255) / 255f, ob = (o & 255) / 255f;
			float lum = Math.max(or, Math.max(og, ob));            // 0 in der Nacht, ~0.5-0.75 am Tag
			float k = Math.min(1f, lum / 0.72f);
			int c2 = src == 0 && Theme.worldSky2 != 0 ? Theme.worldSky2 : src == 1 ? (Theme.tSky2 & 0xFFFFFF) : t;
			int r = (int) ((((t >> 16 & 255) * 0.65f + (c2 >> 16 & 255) * 0.35f)) * k);
			int g = (int) ((((t >> 8 & 255) * 0.65f + (c2 >> 8 & 255) * 0.35f)) * k);
			int b = (int) ((((t & 255) * 0.65f + (c2 & 255) * 0.35f)) * k);
			float st = app.cloudy.client.ModConfig.skyStr / 100f;
			r = (int) (or * 255 * (1 - st) + r * st); g = (int) (og * 255 * (1 - st) + g * st); b = (int) (ob * 255 * (1 - st) + b * st);
			cir.setReturnValue((o & 0xFF000000) | Math.min(255, r) << 16 | Math.min(255, g) << 8 | Math.min(255, b));
			beat(cir);
		} catch (Throwable ignored) {}
	}

	/** Himmel pulsiert im Takt des Songs (heller bei jedem gesungenen Wort). */
	private static void beat(CallbackInfoReturnable<Integer> cir) {
		int m = app.cloudy.client.ModConfig.skyBeat;
		if (m == 0) return;
		float f = app.cloudy.client.Lyrics.beat() * (m == 1 ? 0.22f : 0.5f);
		if (f < 0.01f) return;
		int o = cir.getReturnValueI();
		int r = (o >> 16 & 255), g = (o >> 8 & 255), b = (o & 255);
		r += (int) ((255 - r) * f); g += (int) ((255 - g) * f); b += (int) ((255 - b) * f);
		cir.setReturnValue((o & 0xFF000000) | r << 16 | g << 8 | b);
	}

	/** Wolkenfarbe: Vanilla, passend zum Himmel oder eigene Farbe. Helligkeit (Tag/Nacht/Regen) bleibt vom Original. */
	@Inject(method = "getCloudsColor(F)I", at = @At("RETURN"), cancellable = true, require = 0)
	private void cloudy$clouds(float tickDelta, CallbackInfoReturnable<Integer> cir) {
		try {
			int mode = app.cloudy.client.ModConfig.cloudMode;
			if (mode == 0 || !app.cloudy.client.ModConfig.isOn("sky")) return;
			Theme.load();
			int base = mode == 2 ? app.cloudy.client.ModConfig.lcol(app.cloudy.client.ModConfig.cloudCol, 3) : mix(skyTint(), 0xFFFFFF, 0.55f);
			int o = cir.getReturnValueI();
			float k = Math.max(0.12f, Math.max((o >> 16 & 255) / 255f, Math.max((o >> 8 & 255) / 255f, (o & 255) / 255f)));
			int r = (int) ((base >> 16 & 255) * k), g = (int) ((base >> 8 & 255) * k), b = (int) ((base & 255) * k);
			cir.setReturnValue((o & 0xFF000000) | Math.min(255, r) << 16 | Math.min(255, g) << 8 | Math.min(255, b));
		} catch (Throwable ignored) {}
	}

	private static int skyTint() {
		int src = app.cloudy.client.ModConfig.skySrc;
		int t = src == 0 ? Theme.worldSky : src == 1 ? (Theme.tSky1 & 0xFFFFFF) : app.cloudy.client.ModConfig.lcol(app.cloudy.client.ModConfig.skyCol, 2);
		return t == 0 ? 0xFFFFFF : t & 0xFFFFFF;
	}

	private static int mix(int a, int b, float t) {
		int r = (int) ((a >> 16 & 255) * (1 - t) + (b >> 16 & 255) * t), g = (int) ((a >> 8 & 255) * (1 - t) + (b >> 8 & 255) * t), bl = (int) ((a & 255) * (1 - t) + (b & 255) * t);
		return r << 16 | g << 8 | bl;
	}
}
