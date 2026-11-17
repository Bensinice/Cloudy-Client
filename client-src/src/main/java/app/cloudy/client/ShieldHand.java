package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.util.Arm;
import net.minecraft.util.Hand;
import net.minecraft.util.math.RotationAxis;

/**
 * 3D-Schild (ZZ4/ZZ3/ZZ5/YY) statt des flachen Minecraft-Schilds: das normale Schild wird bei dir ausgeblendet
 * (Ich-Sicht und F5), stattdessen sitzt das echte Schild-Modell in der Hand. Andere Spieler behalten ihr normales Schild.
 */
public final class ShieldHand {
	private ShieldHand() {}

	/** Hast du gerade ein 3D-Schild angelegt? */
	public static boolean active() {
		String s = Cosmetics.shield;
		return s != null && ZZ4.handles(s);
	}

	/** Haelt dieser Arm deines Spielers gerade ein Schild? */
	public static boolean holds(AbstractClientPlayerEntity p, Arm arm) {
		if (p == null) return false;
		Arm main = p.getMainArm();
		ItemStack st = arm == main ? p.getMainHandStack() : p.getOffHandStack();
		return st.isOf(Items.SHIELD);
	}

	/** Ich-Sicht: das 3D-Schild an der Hand zeichnen. */
	public static void firstPerson(AbstractClientPlayerEntity p, Hand hand, float equip, MatrixStack ms, VertexConsumerProvider vcp, int light) {
		if (!Cosmetics.ensure()) return;
		boolean right = (hand == Hand.MAIN_HAND) == (p.getMainArm() == Arm.RIGHT);
		float i = right ? 1f : -1f;
		boolean block = p.isUsingItem() && p.getActiveHand() == hand;
		ms.push();
		ms.translate(i * 0.56f, -0.52f - equip * 0.6f, -0.72f); // gleiche Grundlage wie bei Minecraft
		if (block) {
			ms.translate(-i * 0.30f, 0.16f, 0.06f); // beim Blocken vor die Mitte
			ms.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(i * 8f));
		} else {
			ms.translate(-i * 0.06f, 0.08f, 0f);
			ms.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(i * 24f));
		}
		ms.scale(1f, -1f, -1f); // Modellraum (y nach unten, Vorderseite -z) -> Vorderseite zur Kamera
		ZZ4.shield(ms, vcp, light, OverlayTexture.DEFAULT_UV, Cosmetics.shield, 0f, 0f, 0f);
		ms.pop();
	}

	public static boolean self(net.minecraft.client.render.entity.state.PlayerEntityRenderState ps) {
		var who = CosmeticNet.entityOf(ps);
		var me = MinecraftClient.getInstance().player;
		return who != null ? who == me : Cosmetics.isSelf(ps.skinTextures);
	}
}
