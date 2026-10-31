package app.cloudy.client.mixin;

import app.cloudy.client.FreeCam;
import net.minecraft.client.render.Camera;
import net.minecraft.entity.Entity;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.BlockView;
import net.minecraft.world.RaycastContext;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Freelook / Freecam: Kamera von der Blickrichtung des Spielers loesen. Eigene Mixin-Datei (nicht zwingend): schlaegt sie fehl, bleibt das Spiel normal und FreeCam nutzt den Kompatibilitaetsmodus. */
@Mixin(Camera.class)
public abstract class CameraMixin {
	@Shadow protected abstract void setRotation(float yaw, float pitch);
	@Shadow protected abstract void setPos(double x, double y, double z);

	/** Dritte Person erzwingen, damit dein Spieler sichtbar bleibt und die Hand ausgeblendet wird. */
	@ModifyVariable(method = "update", at = @At("HEAD"), argsOnly = true, ordinal = 0, require = 0)
	private boolean cloudy$third(boolean third) { return FreeCam.active() && !FreeCam.inFallback() ? true : third; }

	@Inject(method = "update", at = @At("TAIL"), require = 0)
	private void cloudy$cam(BlockView area, Entity focused, boolean third, boolean inv, float td, CallbackInfo ci) {
		try {
			if (!FreeCam.active() || FreeCam.inFallback()) return;
			FreeCam.mixinHit = true;
			setRotation(FreeCam.yaw(), FreeCam.pitch());
			if (FreeCam.isFree()) { setPos(FreeCam.fx(), FreeCam.fy(), FreeCam.fz()); return; }
			Vec3d eye = focused.getCameraPosVec(td);
			Vec3d dir = Vec3d.fromPolar(FreeCam.pitch(), FreeCam.yaw());
			double dist = 4.0;
			try {
				var hit = focused.getWorld().raycast(new RaycastContext(eye, eye.subtract(dir.multiply(4.0)), RaycastContext.ShapeType.VISUAL, RaycastContext.FluidHandling.NONE, focused));
				if (hit.getType() != HitResult.Type.MISS) dist = Math.max(0.3, hit.getPos().distanceTo(eye) - 0.3);
			} catch (Throwable ignored) {}
			Vec3d p = eye.subtract(dir.multiply(dist));
			setPos(p.x, p.y, p.z);
		} catch (Throwable ignored) {}
	}
}
