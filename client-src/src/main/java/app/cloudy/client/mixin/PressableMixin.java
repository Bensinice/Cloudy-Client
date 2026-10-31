package app.cloudy.client.mixin;

import app.cloudy.client.ModConfig;
import app.cloudy.client.Theme;
import app.cloudy.client.Ui;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.client.gui.widget.PressableWidget;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Zeichnet Vanilla-Buttons im Cloudy-Glasstil (nur ausserhalb einer Welt). */
@Mixin(PressableWidget.class)
public abstract class PressableMixin {
	@Inject(method = "renderWidget", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$btn(DrawContext c, int mx, int my, float delta, CallbackInfo ci) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (!Ui.styled()) return;
		ClickableWidget w = (ClickableWidget) (Object) this;
		int x = w.getX(), y = w.getY(), bw = w.getWidth(), bh = w.getHeight();
		boolean hv = w.isHovered() && w.active;
		c.fill(x, y, x + bw, y + bh, !w.active ? 0x66121A30 : hv ? 0xCC2A3558 : 0x99101A36);
		c.fill(x, y, x + bw, y + 1, 0x22FFFFFF);
		if (hv) c.fill(x, y + bh - 2, x + bw, y + bh, Theme.accent);
		var tr = mc.textRenderer;
		Ui.ctr(c, w.getMessage(), x + bw / 2, y + (bh - 8) / 2, w.active ? 0xFFFFFFFF : 0xFF6F7A99);
		ci.cancel();
	}
}
