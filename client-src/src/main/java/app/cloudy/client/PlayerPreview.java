package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import org.joml.Quaternionf;

/** 3D-Vorschau deiner Spielerfigur mit deinem Skin und den angelegten Cosmetics. Eigenes Modell, funktioniert auch im Hauptmenue (ohne Welt). */
public final class PlayerPreview {
	private static ModelPart root, head, body, rArm, lArm, rLeg, lLeg, cape;
	private static boolean slimBuilt;

	private static void build(boolean slim) {
		ModelData md = new ModelData();
		ModelPartData r = md.getRoot();
		r.addChild("head", ModelPartBuilder.create().uv(0, 0).cuboid(-4, -8, -4, 8, 8, 8).uv(32, 0).cuboid(-4, -8, -4, 8, 8, 8, new Dilation(0.5f)), ModelTransform.NONE);
		r.addChild("body", ModelPartBuilder.create().uv(16, 16).cuboid(-4, 0, -2, 8, 12, 4).uv(16, 32).cuboid(-4, 0, -2, 8, 12, 4, new Dilation(0.25f)), ModelTransform.NONE);
		int aw = slim ? 3 : 4;
		r.addChild("ra", ModelPartBuilder.create().uv(40, 16).cuboid(-3, -2, -2, aw, 12, 4).uv(40, 32).cuboid(-3, -2, -2, aw, 12, 4, new Dilation(0.25f)), ModelTransform.pivot(-5, slim ? 2.5f : 2, 0));
		r.addChild("la", ModelPartBuilder.create().uv(32, 48).cuboid(-1, -2, -2, aw, 12, 4).uv(48, 48).cuboid(-1, -2, -2, aw, 12, 4, new Dilation(0.25f)), ModelTransform.pivot(5, slim ? 2.5f : 2, 0));
		r.addChild("rl", ModelPartBuilder.create().uv(0, 16).cuboid(-2, 0, -2, 4, 12, 4).uv(0, 32).cuboid(-2, 0, -2, 4, 12, 4, new Dilation(0.25f)), ModelTransform.pivot(-1.9f, 12, 0));
		r.addChild("ll", ModelPartBuilder.create().uv(16, 48).cuboid(-2, 0, -2, 4, 12, 4).uv(0, 48).cuboid(-2, 0, -2, 4, 12, 4, new Dilation(0.25f)), ModelTransform.pivot(1.9f, 12, 0));
		root = TexturedModelData.of(md, 64, 64).createModel();
		head = root.getChild("head"); body = root.getChild("body"); rArm = root.getChild("ra"); lArm = root.getChild("la"); rLeg = root.getChild("rl"); lLeg = root.getChild("ll");
		ModelData cd = new ModelData();
		cd.getRoot().addChild("cape", ModelPartBuilder.create().uv(0, 0).cuboid(-5, 0, -1, 10, 16, 1), ModelTransform.NONE);
		cape = TexturedModelData.of(cd, 64, 32).createModel().getChild("cape");
		slimBuilt = slim;
	}

	/** Zeichnet die Figur: cx = Mitte, feetY = Fusshoehe, scale = Pixel pro Block, yaw = Drehung in Radiant (0 = von vorn). Gibt false zurueck, wenn der Skin fehlt. */
	public static boolean draw(DrawContext c, int cx, int feetY, float scale, float yaw, String hat, String wings, String shield) {
		MinecraftClient mc = MinecraftClient.getInstance();
		try {
			SkinTextures st = mc.getSkinProvider().getSkinTextures(mc.getGameProfile());
			Identifier skin = st.texture();
			boolean slim = String.valueOf(st.model()).equalsIgnoreCase("slim");
			if (root == null || slim != slimBuilt) build(slim);
			if (!Cosmetics.ensure()) { /* Cosmetics ohne Atlas: nur die Figur */ }
			long t = System.currentTimeMillis();
			head.yaw = (float) Math.sin(t / 1800.0) * 0.12f;
			rArm.pitch = (float) Math.sin(t / 900.0) * 0.06f; lArm.pitch = -rArm.pitch;
			if (shield != null) lArm.pitch = -0.9f; // Schild vor dem Koerper halten
			MatrixStack ms = c.getMatrices();
			ms.push();
			ms.translate(cx, feetY - 1.5f * scale, 150f);
			ms.scale(scale, scale, -scale);
			ms.multiply(new Quaternionf().rotateY(yaw));
			c.draw();
			VertexConsumerProvider.Immediate vcp = mc.getBufferBuilders().getEntityVertexConsumers();
			int light = 0xF000F0, ov = OverlayTexture.DEFAULT_UV;
			root.render(ms, vcp.getBuffer(RenderLayer.getEntityTranslucent(skin)), light, ov);
			boolean meshCape = ZZ4.handles(Cosmetics.cape);
			Identifier capeTex = Cosmetics.cape != null && !meshCape ? CapeManager.get() : null;
			if (capeTex != null) {
				ms.push();
				body.rotate(ms);
				ms.translate(0, 0.1f / 16f, 3.1f / 16f);
				ms.multiply(new Quaternionf().rotateY((float) Math.PI).rotateX(-0.12f - (float) Math.sin(t / 700.0) * 0.03f));
				cape.render(ms, vcp.getBuffer(RenderLayer.getEntityTranslucent(capeTex)), light, ov);
				ms.pop();
			}
			CosmeticFeature.PREVIEW = true;
			try { CosmeticFeature.drawAll(ms, vcp, light, ov, head, body, lArm, rArm, hat, wings, shield, shield != null ? 1 : 0, meshCape ? Cosmetics.cape : null, 0f); } finally { CosmeticFeature.PREVIEW = false; }
			vcp.draw();
			ms.pop();
			return true;
		} catch (Throwable e) {
			return false;
		}
	}
}
