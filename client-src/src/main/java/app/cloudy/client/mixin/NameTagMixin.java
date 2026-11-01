package app.cloudy.client.mixin;

import app.cloudy.client.CosmeticNet;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zeigt die Cloudy-Tags (Rang, Clan) vor dem Namen über dem Kopf. Nicht zwingend – passt die Methode nicht, bleibt der Name wie im Spiel. */
@Mixin(PlayerEntity.class)
public abstract class NameTagMixin {
	@Inject(method = "getDisplayName", at = @At("RETURN"), cancellable = true, require = 0)
	private void cloudy$tags(CallbackInfoReturnable<Text> cir) {
		try {
			PlayerEntity self = (PlayerEntity) (Object) this;
			MutableText pre = CosmeticNet.tagPrefix(self.getGameProfile().getName());
			if (pre != null) cir.setReturnValue(pre.append(cir.getReturnValue()));
		} catch (Throwable ignored) {}
	}
}
