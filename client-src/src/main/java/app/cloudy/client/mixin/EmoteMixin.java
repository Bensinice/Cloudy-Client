package app.cloudy.client.mixin;

import app.cloudy.client.Emotes;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Emotes: nach der normalen Pose (Laufen, Schauen) die Emote-Pose darueberlegen. */
@Mixin(PlayerEntityModel.class)
public abstract class EmoteMixin {
	@Inject(method = "setAngles(Lnet/minecraft/client/render/entity/state/PlayerEntityRenderState;)V", at = @At("TAIL"), require = 0)
	private void cloudy$emote(PlayerEntityRenderState state, CallbackInfo ci) {
		Emotes.pose((PlayerEntityModel) (Object) this, state);
	}
}
