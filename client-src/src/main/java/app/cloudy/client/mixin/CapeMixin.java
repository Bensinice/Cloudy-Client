package app.cloudy.client.mixin;

import app.cloudy.client.CapeManager;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Ersetzt nur für dich selbst den Umhang (clientseitig, andere sehen ihn nicht). */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class CapeMixin {
	@Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
	private void cloudy$cape(CallbackInfoReturnable<SkinTextures> cir) {
		AbstractClientPlayerEntity self = (AbstractClientPlayerEntity) (Object) this;
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.player == null || !self.getUuid().equals(mc.player.getUuid())) return;
		if (app.cloudy.client.ZZ4.handles(app.cloudy.client.Cosmetics.cape)) { // Z4-Umhang wird als 3D-Modell gezeichnet: den normalen Umhang ausblenden
			SkinTextures o = cir.getReturnValue();
			cir.setReturnValue(new SkinTextures(o.texture(), o.textureUrl(), null, o.elytraTexture(), o.model(), o.secure()));
			return;
		}
		Identifier cape = CapeManager.get();
		if (cape == null) return;
		SkinTextures o = cir.getReturnValue();
		cir.setReturnValue(new SkinTextures(o.texture(), o.textureUrl(), cape, o.elytraTexture(), o.model(), o.secure()));
	}
}
