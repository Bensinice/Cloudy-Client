package app.cloudy.client.mixin;

import app.cloudy.client.CloudyClouds;
import net.minecraft.client.option.CloudRenderMode;
import net.minecraft.client.option.GameOptions;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Volumetrische Cloudy-Wolken aktiv: die flachen Minecraft-Wolken aus (ohne die gespeicherte Einstellung zu aendern). */
@Mixin(GameOptions.class)
public abstract class CloudsOffMixin {
	@Inject(method = "getCloudRenderModeValue", at = @At("RETURN"), cancellable = true, require = 0)
	private void cloudy$cloudsOff(CallbackInfoReturnable<CloudRenderMode> cir) {
		try { if (CloudyClouds.active()) cir.setReturnValue(CloudRenderMode.OFF); } catch (Throwable ignored) {}
	}
}
