package app.cloudy.client.mixin;

import app.cloudy.client.ModConfig;
import net.minecraft.client.render.entity.ItemEntityRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.MathHelper;
import org.joml.Quaternionf;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/** Item-Physik: abgeworfene Items liegen flach auf dem Boden, ohne Drehen und Schweben. */
@Mixin(ItemEntityRenderer.class)
public abstract class ItemPhysicsMixin {
	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/util/math/MathHelper;sin(F)F"), require = 0)
	private float cloudy$bob(float v) {
		return ModConfig.isOn("itemphysics") ? -1f : MathHelper.sin(v);
	}

	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/util/math/MatrixStack;translate(FFF)V"), require = 0)
	private void cloudy$lift(MatrixStack ms, float x, float y, float z) {
		ms.translate(x, ModConfig.isOn("itemphysics") ? 0.08f : y, z); // flach direkt ueber dem Boden
	}

	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/util/math/MatrixStack;translate(DDD)V"), require = 0)
	private void cloudy$lift2(MatrixStack ms, double x, double y, double z) {
		ms.translate(x, ModConfig.isOn("itemphysics") ? 0.08 : y, z);
	}

	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/util/math/MatrixStack;multiply(Lorg/joml/Quaternionf;)V"), require = 0)
	private void cloudy$flat(MatrixStack ms, Quaternionf q) {
		if (ModConfig.isOn("itemphysics")) { ms.multiply(new Quaternionf().rotationX((float) (-Math.PI / 2))); }
		else ms.multiply(q);
	}

	@Redirect(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/util/math/MatrixStack;multiply(Lorg/joml/Quaternionfc;)V"), require = 0)
	private void cloudy$flat2(MatrixStack ms, org.joml.Quaternionfc q) {
		if (ModConfig.isOn("itemphysics")) { ms.multiply(new Quaternionf().rotationX((float) (-Math.PI / 2))); }
		else ms.multiply(new Quaternionf(q));
	}
}
