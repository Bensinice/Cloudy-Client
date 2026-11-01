package app.cloudy.client.mixin;

import app.cloudy.client.CosmeticNet;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Merkt sich, zu welchem Spieler ein Render-Zustand gehoert (damit Cosmetics anderer Cloudy-Spieler dem richtigen Namen zugeordnet werden). */
@Mixin(PlayerEntityRenderer.class)
public abstract class PlayerStateMixin {
	@Inject(method = "updateRenderState(Lnet/minecraft/client/network/AbstractClientPlayerEntity;Lnet/minecraft/client/render/entity/state/PlayerEntityRenderState;F)V", at = @At("TAIL"), require = 0)
	private void cloudy$stash(AbstractClientPlayerEntity player, PlayerEntityRenderState state, float tickDelta, CallbackInfo ci) {
		CosmeticNet.stash(state, player);
	}
}
