package app.cloudy.client;

import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.entity.feature.FeatureRenderer;
import net.minecraft.client.render.entity.feature.FeatureRendererContext;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.client.util.math.MatrixStack;

/** Zeichnet Hut (am Kopf), Fluegel (am Koerper) und Schild (nur wenn gehalten) fuer dich selbst – im Spiel und in der Cosmetics-Vorschau. */
public class CosmeticFeature extends FeatureRenderer<PlayerEntityRenderState, PlayerEntityModel> {
	public CosmeticFeature(FeatureRendererContext<PlayerEntityRenderState, PlayerEntityModel> context) {
		super(context);
	}

	@Override
	public void render(MatrixStack matrices, VertexConsumerProvider vertexConsumers, int light, PlayerEntityRenderState state, float limbAngle, float limbDistance) {
		try {
			if (!Cosmetics.any() || !Cosmetics.isSelf(state.skinTextures) || !Cosmetics.ensure()) return;
			PlayerEntityModel m = this.getContextModel();
			int held = 0; // 0 = nichts, 1 = Schild in der linken, 2 = in der rechten Hand
			if (Cosmetics.shield != null) {
				net.minecraft.client.network.ClientPlayerEntity pl = net.minecraft.client.MinecraftClient.getInstance().player;
				boolean off = pl != null && pl.getOffHandStack().isOf(net.minecraft.item.Items.SHIELD), main = pl != null && pl.getMainHandStack().isOf(net.minecraft.item.Items.SHIELD);
				held = off ? 1 : main ? 2 : 0;
			}
			drawAll(matrices, vertexConsumers, light, OverlayTexture.DEFAULT_UV, m.head, m.body, m.leftArm, m.rightArm, Cosmetics.hat, Cosmetics.wings, Cosmetics.shield, held, ZZ4.handles(Cosmetics.cape) ? Cosmetics.cape : null, limbDistance);
		} catch (RuntimeException e) { /* Cosmetics duerfen das Spiel nie zum Absturz bringen */ }
	}

	/** Gemeinsamer Zeichencode (Spiel und Vorschau). held: 0 = kein Schild, 1 = links, 2 = rechts. */
	public static boolean PREVIEW;

	public static void drawAll(MatrixStack matrices, VertexConsumerProvider vcp, int light, int ov, ModelPart head, ModelPart body, ModelPart leftArm, ModelPart rightArm,
			String hat, String wings, String shield, int held, String cape, float limb) {
		if (!Cosmetics.ensure()) return;
		VertexConsumer vc = vcp.getBuffer(RenderLayer.getEntityCutoutNoCull(Cosmetics.TEX));
		if (cape != null && ZZ4.handles(cape)) { matrices.push(); body.rotate(matrices); ZZ4.cloak(matrices, vcp, light, ov, cape, limb); matrices.pop(); }
		if (hat != null) draw(matrices, vc, light, ov, head, Cosmetics.parts(hat));
		if (shield != null && held > 0 && ZZ4.handles(shield)) {
			// Im Spiel liegt das Schild-Design als Textur auf dem normalen Minecraft-Schild (Ressourcenpaket vom Launcher). Nur die Vorschau zeichnet das Modell.
			if (PREVIEW) {
				matrices.push();
				(held == 1 ? leftArm : rightArm).rotate(matrices);
				ZZ4.shield(matrices, vcp, light, ov, shield, held == 1 ? 0.0625f : -0.0625f, 0.34f, -0.25f);
				matrices.pop();
			}
		} else if (shield != null && held > 0) {
			Cosmetics.Img si = Cosmetics.imgOf(shield);
			if (held == 1) drawShield(matrices, vcp, vc, light, ov, leftArm, si, shield);
			else { matrices.push(); matrices.translate(-0.125f, 0, 0); drawShield(matrices, vcp, vc, light, ov, rightArm, si, shield); matrices.pop(); }
		}
		if (wings != null && ZZ4.handles(wings)) {
			matrices.push(); body.rotate(matrices); ZZ4.wings(matrices, vcp, light, ov, wings); matrices.pop();
		} else if (wings != null) {
			long t = System.currentTimeMillis();
			Cosmetics.Img wi = Cosmetics.imgOf(wings);
			if (wi != null) {
				Cosmetics.ImgModel im = Cosmetics.imgModel(wi);
				if (im.rs == null) return;
				for (int k = 0; k < 3; k++) { // jedes Glied schlaegt etwas spaeter und schwaecher: wirkt wie ein echter Fluegel
					float f = (float) Math.sin(t / 380.0 - k * 0.5) * 0.36f;
					im.rs[k].yaw = k == 0 ? -(0.4f + f) : -f * 0.7f;
					im.ls[k].yaw = k == 0 ? 0.4f + f : f * 0.7f;
				}
				matrices.push();
				body.rotate(matrices);
				im.rs[0].render(matrices, vcp.getBuffer(RenderLayer.getEntityTranslucent(im.tr)), light, ov);
				im.ls[0].render(matrices, vcp.getBuffer(RenderLayer.getEntityTranslucent(im.tl)), light, ov);
				matrices.pop();
			} else {
				if (!Cosmetics.model.hasChild(wings + ".r0")) return; // unbekanntes Item (aeltere Mod): nie abstuerzen
				float beat = (float) Math.sin(t / 420.0);
				for (int k = 0; k < Cosmetics.FN; k++) {
					float lag = (float) Math.sin(t / 420.0 - k * 0.1), roll = (float) Math.toRadians(Cosmetics.FANG[k]) + lag * 0.05f * (k < 7 ? k : 3);
					float yaw = 0.42f + beat * 0.12f + lag * 0.08f;
					ModelPart r = Cosmetics.model.getChild(wings + ".r" + k), l = Cosmetics.model.getChild(wings + ".l" + k);
					r.roll = roll; r.yaw = -yaw;
					l.roll = -roll; l.yaw = yaw;
				}
				matrices.push();
				body.rotate(matrices);
				for (int k = 0; k < Cosmetics.FN; k++) {
					Cosmetics.model.getChild(wings + ".r" + k).render(matrices, vc, light, ov);
					Cosmetics.model.getChild(wings + ".l" + k).render(matrices, vc, light, ov);
				}
				matrices.pop();
			}
		}
	}

	private static void drawShield(MatrixStack matrices, VertexConsumerProvider vcp, VertexConsumer atlas, int light, int ov, ModelPart anchor, Cosmetics.Img img, String id) {
		if (img == null) { draw(matrices, atlas, light, ov, anchor, Cosmetics.parts(id)); return; }
		Cosmetics.ImgModel im = Cosmetics.imgModel(img);
		if (im.one == null) return;
		matrices.push();
		anchor.rotate(matrices);
		im.one.render(matrices, vcp.getBuffer(RenderLayer.getEntityTranslucent(im.t1)), light, ov);
		matrices.pop();
	}

	private static void draw(MatrixStack matrices, VertexConsumer vc, int light, int ov, ModelPart anchor, String[] parts) {
		matrices.push();
		anchor.rotate(matrices);
		for (String n : parts) if (Cosmetics.model.hasChild(n)) Cosmetics.model.getChild(n).render(matrices, vc, light, ov);
		matrices.pop();
	}
}
