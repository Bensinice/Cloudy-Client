package app.cloudy.client.mixin;

import app.cloudy.client.ShieldHand;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.feature.HeldItemFeatureRenderer;
import net.minecraft.client.render.entity.state.ArmedEntityRenderState;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.render.item.ItemRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Arm;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** F5 / Inventar: mit angelegtem 3D-Schild das flache Minecraft-Schild in deiner Hand weglassen (das Modell zeichnet CosmeticFeature). */
@Mixin(HeldItemFeatureRenderer.class)
public abstract class ShieldThirdPersonMixin {
	@Inject(method = "renderItem(Lnet/minecraft/client/render/entity/state/ArmedEntityRenderState;Lnet/minecraft/client/render/item/ItemRenderState;Lnet/minecraft/util/Arm;Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$shield(ArmedEntityRenderState state, ItemRenderState item, Arm arm, MatrixStack ms, VertexConsumerProvider vcp, int light, CallbackInfo ci) {
		try {
			if (!ShieldHand.active() || !(state instanceof PlayerEntityRenderState ps) || !ShieldHand.self(ps)) return;
			if (ShieldHand.holds(net.minecraft.client.MinecraftClient.getInstance().player, arm)) ci.cancel();
		} catch (RuntimeException ignored) {}
	}
}
