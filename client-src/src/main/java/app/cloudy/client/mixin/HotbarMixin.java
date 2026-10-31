package app.cloudy.client.mixin;

import app.cloudy.client.Hotbar;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Eigene Hotbar und Herzen anstelle der Vanilla-Anzeige. Eigene Mixin-Datei (nicht zwingend): schlaegt sie fehl, bleibt Vanilla. */
@Mixin(InGameHud.class)
public abstract class HotbarMixin {
	@Inject(method = "renderHotbar", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$hotbar(DrawContext context, net.minecraft.client.render.RenderTickCounter tick, CallbackInfo ci) {
		try { if (Hotbar.draw(context)) ci.cancel(); } catch (Throwable ignored) {}
	}

	@Inject(method = "renderStatusBars", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$status(DrawContext context, CallbackInfo ci) {
		try { if (Hotbar.status(context)) ci.cancel(); } catch (Throwable ignored) {}
	}

	@Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$cross(DrawContext context, net.minecraft.client.render.RenderTickCounter tick, CallbackInfo ci) {
		try { if (app.cloudy.client.Crosshair.draw(context)) ci.cancel(); } catch (Throwable ignored) {}
	}
}
