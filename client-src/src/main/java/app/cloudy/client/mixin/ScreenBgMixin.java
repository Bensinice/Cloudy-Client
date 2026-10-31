package app.cloudy.client.mixin;

import app.cloudy.client.ModConfig;
import app.cloudy.client.Ui;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Gibt Singleplayer-, Multiplayer- und Optionen-Menues den Cloudy-Hintergrund (nur ausserhalb einer Welt). */
@Mixin(Screen.class)
public abstract class ScreenBgMixin {
	@Inject(method = "renderBackground", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$bg(DrawContext c, int mx, int my, float delta, CallbackInfo ci) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (!Ui.styled()) return;
		Screen s = (Screen) (Object) this;
		if (mc.world == null) { Ui.scene(c, s.width, s.height); c.fill(0, 0, s.width, s.height, 0x55000000); }
		else { c.fill(0, 0, s.width, s.height, 0x77050A16); c.fill(0, 0, s.width, 2, 0xFF000000 | app.cloudy.client.Theme.accent); Ui.txt(c, "CLOUDY", 10, 9, app.cloudy.client.Theme.accent); }
		ci.cancel();
	}
}
