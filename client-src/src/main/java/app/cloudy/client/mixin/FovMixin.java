package app.cloudy.client.mixin;

import app.cloudy.client.FreeCam;
import app.cloudy.client.Qol;
import net.minecraft.client.render.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom: Sichtfeld durch den Zoomfaktor teilen; Hand ausblenden bei Freelook/Freecam. */
@Mixin(GameRenderer.class)
public abstract class FovMixin {
	@Inject(method = "getFov", at = @At("RETURN"), cancellable = true, require = 0)
	private void cloudy$zoom(CallbackInfoReturnable<Float> cir) {
		try {
			Qol.fovHit = true;
			float z = Qol.zoomFactor();
			if (z > 1.001f) cir.setReturnValue(cir.getReturnValue() / z);
		} catch (Throwable ignored) {}
	}

	@Inject(method = "renderHand", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$hand(CallbackInfo ci) {
		try { if (FreeCam.active()) ci.cancel(); } catch (Throwable ignored) {}
	}
}
