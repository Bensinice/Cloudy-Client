package app.cloudy.client.mixin;

import app.cloudy.client.CreamHeist;
import net.minecraft.client.Keyboard;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Creamkeys: Klang bei jedem Tastendruck. */
@Mixin(Keyboard.class)
public abstract class KeyboardMixin {
	@Inject(method = "onKey", at = @At("HEAD"), require = 0)
	private void cloudy$key(long window, int key, int scancode, int action, int modifiers, CallbackInfo ci) {
		if (action == 1) CreamHeist.key(key);
	}
}
