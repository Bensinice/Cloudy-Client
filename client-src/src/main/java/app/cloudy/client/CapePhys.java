package app.cloudy.client;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.math.MathHelper;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Umhang-Physik je Spieler: schwingt nach hinten beim Laufen/Fallen, zur Seite beim Seitwaertslaufen und haengt beim Drehen kurz nach.
 * Vorher war der Wert fuer alle Spieler gemeinsam und kam nur von DEINER Bewegung – fremde Umhaenge bewegten sich mit deiner Kamera/Bewegung.
 */
public final class CapePhys {
	private CapePhys() {}

	private static final class S { float swing, side, lastYaw; long t; }
	private static final Map<UUID, S> M = new HashMap<>();
	/** Spieler, dessen Cosmetics gerade gezeichnet werden (setzt CosmeticFeature vor dem Zeichnen). null = Vorschau. */
	public static PlayerEntity cur;

	/** {Schwung nach hinten 0..1.4, Seite -1..1} fuer den aktuell gezeichneten Spieler. */
	public static float[] now() {
		long now = System.currentTimeMillis();
		PlayerEntity pl = cur;
		if (pl == null || CosmeticFeature.PREVIEW) return new float[] {0.35f + 0.25f * (float) Math.sin(now / 700.0), 0f};
		if (M.size() > 80) M.clear();
		S s = M.computeIfAbsent(pl.getUuid(), k -> { S n = new S(); n.lastYaw = pl.bodyYaw; return n; });
		if (now == s.t) return new float[] {s.swing, s.side};
		float dt = s.t == 0 ? 0.016f : Math.min(0.1f, (now - s.t) / 1000f);
		s.t = now;
		// Bewegung aus der Positionsaenderung (gilt auch fuer andere Spieler, deren Geschwindigkeit auf dem Client oft 0 ist)
		double vx = pl.getX() - pl.prevX, vy = pl.getY() - pl.prevY, vz = pl.getZ() - pl.prevZ;
		double yaw = Math.toRadians(pl.bodyYaw), fx = -Math.sin(yaw), fz = Math.cos(yaw);
		float fwd = (float) (vx * fx + vz * fz) * 6f, side = (float) (vx * fz - vz * fx) * 6f;
		if (!pl.isOnGround()) fwd += (float) Math.max(-0.5, Math.min(0.5, -vy)) * 0.8f;
		float turn = MathHelper.wrapDegrees(pl.bodyYaw - s.lastYaw) / Math.max(0.005f, dt); // Grad pro Sekunde
		s.lastYaw = pl.bodyYaw;
		side -= Math.max(-0.8f, Math.min(0.8f, turn / 420f)); // beim Drehen haengt der Umhang kurz nach
		float target = Math.max(-0.4f, Math.min(1.2f, fwd)) + (pl.isSneaking() ? 0.18f : 0f);
		float k = 1f - (float) Math.exp(-dt * 7f);
		s.swing += (target - s.swing) * k;
		s.side += (Math.max(-1f, Math.min(1f, side)) - s.side) * k;
		return new float[] {s.swing, s.side};
	}
}
