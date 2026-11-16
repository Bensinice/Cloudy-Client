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
			if (state == null || text == null) return;
			Vec3d at = state.nameLabelPos;
			if (at == null) return;
			boolean owner = CosmeticNet.isOwner(state.name);
			String[] song = app.cloudy.client.Social.songOf(state.name); // Song-Bubble (Schalter "Song bubbles", Standard aus)
			if (!owner && song == null) return;
			MinecraftClient mc = MinecraftClient.getInstance();
			TextRenderer tr = mc.textRenderer;
			matrices.push();
			matrices.translate(at.x, at.y + 0.5, at.z);
			matrices.multiply(mc.getEntityRenderDispatcher().getRotation());
			matrices.scale(0.025f, -0.025f, 0.025f);
			Matrix4f m = matrices.peek().getPositionMatrix();
			int bg = (int) (mc.options.getTextBackgroundOpacity(0.25f) * 255f) << 24;
			float y = -12f; // eine Zeile ueber dem Namen
			if (owner) { line(tr, Text.literal("\u2605 OWNER \u2605").styled(s -> s.withColor(0xFF3B4A).withBold(true)), y, m, vcp, bg, light); y -= 12f; }
			if (song != null) { String t = song[0] + (song[1].isEmpty() ? "" : " \u2013 " + song[1]); if (t.length() > 42) t = t.substring(0, 41) + "\u2026"; line(tr, Text.literal("\u266B " + t).styled(s -> s.withColor(0x8CF5C8)), y, m, vcp, bg, light); }
			matrices.pop();
		} catch (Throwable ignored) {}
	}

	private static void line(TextRenderer tr, Text t, float y, Matrix4f m, VertexConsumerProvider vcp, int bg, int light) {
		float x = -tr.getWidth(t) / 2f;
		tr.draw(t, x, y, 0x40FFFFFF, false, m, vcp, TextRenderer.TextLayerType.SEE_THROUGH, bg, light);
		tr.draw(t, x, y, 0xFFFFFFFF, false, m, vcp, TextRenderer.TextLayerType.NORMAL, 0, light);
	}
}
