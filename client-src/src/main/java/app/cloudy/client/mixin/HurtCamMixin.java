package app.cloudy.client.mixin;

import app.cloudy.client.ModConfig;
import net.minecraft.client.render.GameRenderer;
import net.minecraft.client.util.math.MatrixStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** "No hurt cam": die Kamera wackelt nicht mehr, wenn du Schaden nimmst. Nicht zwingend – passt die Methode nicht, bleibt alles wie im Spiel. */
@Mixin(GameRenderer.class)
public abstract class HurtCamMixin {
	@Inject(method = "tiltViewWhenHurt", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$noHurt(MatrixStack matrices, float tickDelta, CallbackInfo ci) {
		try { if (ModConfig.isOn("nohurtcam")) ci.cancel(); } catch (Throwable ignored) {}
	}
}
