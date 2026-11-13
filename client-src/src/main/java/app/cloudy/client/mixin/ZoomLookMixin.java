package app.cloudy.client.mixin;

import app.cloudy.client.ModConfig;
import app.cloudy.client.Qol;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/** Zoom: Maus beim Zoomen ruhiger (Bewegung durch den Zoomfaktor teilen), damit Zielen bei starker Vergroesserung moeglich bleibt. Nicht zwingend. */
@Mixin(Entity.class)
public abstract class ZoomLookMixin {
	@ModifyVariable(method = "changeLookDirection", at = @At("HEAD"), argsOnly = true, ordinal = 0, require = 0)
	private double cloudy$zoomX(double v) { return scale(v); }

	@ModifyVariable(method = "changeLookDirection", at = @At("HEAD"), argsOnly = true, ordinal = 1, require = 0)
	private double cloudy$zoomY(double v) { return scale(v); }

	private double scale(double v) {
		try {
			if (!ModConfig.zoomSens || !Qol.zooming() || (Object) this != MinecraftClient.getInstance().player) return v;
			return v / Math.max(1f, Qol.zoomFactor() * 0.85f);
		} catch (Throwable t) { return v; }
	}
}
