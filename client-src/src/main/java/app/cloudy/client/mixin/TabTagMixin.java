package app.cloudy.client.mixin;

import app.cloudy.client.CosmeticNet;
import net.minecraft.client.gui.hud.PlayerListHud;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Cloudy-Tags auch in der Spielerliste (Tab). Nicht zwingend. */
@Mixin(PlayerListHud.class)
public abstract class TabTagMixin {
	@Inject(method = "getPlayerName", at = @At("RETURN"), cancellable = true, require = 0)
	private void cloudy$tabTags(PlayerListEntry entry, CallbackInfoReturnable<Text> cir) {
		try {
			MutableText pre = CosmeticNet.tagPrefix(entry.getProfile().getName());
			if (pre != null) cir.setReturnValue(pre.append(cir.getReturnValue()));
		} catch (Throwable ignored) {}
	}
}
