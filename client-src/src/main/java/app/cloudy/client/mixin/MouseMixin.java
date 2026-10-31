package app.cloudy.client.mixin;

import app.cloudy.client.CreamHeist;
import net.minecraft.client.Mouse;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Creamkeys: Klang bei jedem Mausklick. */
@Mixin(Mouse.class)
public abstract class MouseMixin {
	@Inject(method = "onMouseButton", at = @At("HEAD"), require = 0)
	private void cloudy$click(long window, int button, int action, int mods, CallbackInfo ci) {
		if (action == 1) CreamHeist.mouse(button);
	}

	/** Zoom: Mausrad aendert die Zoomstufe, solange gezoomt wird (Hotbar bleibt unveraendert). */
	@Inject(method = "onMouseScroll", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$scroll(long window, double h, double v, CallbackInfo ci) {
		try { if (app.cloudy.client.Qol.scroll(v)) ci.cancel(); } catch (Throwable ignored) {}
	}
}
