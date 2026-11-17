package app.cloudy.client.mixin;

import app.cloudy.client.ShieldHand;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.item.HeldItemRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.util.Hand;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Ich-Sicht: mit angelegtem 3D-Schild das flache Minecraft-Schild durch das echte Modell ersetzen. */
@Mixin(HeldItemRenderer.class)
public abstract class ShieldFirstPersonMixin {
	@Inject(method = "renderFirstPersonItem(Lnet/minecraft/client/network/AbstractClientPlayerEntity;FFLnet/minecraft/util/Hand;FLnet/minecraft/item/ItemStack;FLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/VertexConsumerProvider;I)V", at = @At("HEAD"), cancellable = true, require = 0)
	private void cloudy$shield(AbstractClientPlayerEntity player, float tickDelta, float pitch, Hand hand, float swing, ItemStack item, float equip, MatrixStack ms, VertexConsumerProvider vcp, int light, CallbackInfo ci) {
		try {
			if (!item.isOf(Items.SHIELD) || !ShieldHand.active()) return;
			ShieldHand.firstPerson(player, hand, equip, ms, vcp, light);
			ci.cancel();
		} catch (RuntimeException ignored) {}
	}
}
