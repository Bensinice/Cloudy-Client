package app.cloudy.client.mixin;

import app.cloudy.client.CosmeticNet;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;
import org.joml.Matrix4f;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Owner-Abzeichen eine Zeile ueber dem Namensschild. Owner kommt vom Konto-Server (Rang am Cloudy-Konto), nicht vom Spielernamen. Nicht zwingend. */
@Mixin(PlayerEntityRenderer.class)
public abstract class OwnerBadgeMixin {
	@Inject(method = "renderLabelIfPresent", at = @At("TAIL"), require = 0)
	private void cloudy$ownerBadge(PlayerEntityRenderState state, Text text, MatrixStack matrices, VertexConsumerProvider vcp, int light, CallbackInfo ci) {
		try {
			if (state == null || text == null || !CosmeticNet.isOwner(state.name)) return;
			Vec3d at = state.nameLabelPos;
			if (at == null) return;
			MinecraftClient mc = MinecraftClient.getInstance();
			TextRenderer tr = mc.textRenderer;
			Text badge = Text.literal("★ OWNER ★").styled(s -> s.withColor(0xFF3B4A).withBold(true));
			matrices.push();
			matrices.translate(at.x, at.y + 0.5, at.z);
			matrices.multiply(mc.getEntityRenderDispatcher().getRotation());
			matrices.scale(0.025f, -0.025f, 0.025f);
			Matrix4f m = matrices.peek().getPositionMatrix();
			float x = -tr.getWidth(badge) / 2f, y = -12f; // eine Zeile ueber dem Namen
			int bg = (int) (mc.options.getTextBackgroundOpacity(0.25f) * 255f) << 24;
			tr.draw(badge, x, y, 0x40FFFFFF, false, m, vcp, TextRenderer.TextLayerType.SEE_THROUGH, bg, light);
			tr.draw(badge, x, y, 0xFFFFFFFF, false, m, vcp, TextRenderer.TextLayerType.NORMAL, 0, light);
			matrices.pop();
		} catch (Throwable ignored) {}
	}
}
