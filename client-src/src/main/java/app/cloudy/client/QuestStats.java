package app.cloudy.client;

import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.EntityType;
import net.minecraft.item.Item;
import net.minecraft.network.packet.c2s.play.ClientStatusC2SPacket;
import net.minecraft.registry.Registries;
import net.minecraft.registry.tag.BlockTags;
import net.minecraft.stat.StatHandler;
import net.minecraft.stat.Stats;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Quest-Zaehler: liest die ganz normalen Minecraft-Statistiken (abgebaute Bloecke, besiegte Mobs, gelaufene Strecke, hergestellte Items, Fische)
 * und schreibt, was seit dem Betreten der Welt dazugekommen ist, in eine Datei (-Dcloudy.qstat). Der Launcher leitet die Zuwaechse an den
 * Cloudy-Server weiter; dort werden sie nach Zeit und Tag begrenzt. Funktioniert im Einzelspieler und auf Servern, weil die Statistiken vom
 * (eingebauten) Server kommen. Nichts muss bestaetigt werden. Kein Mixin noetig.
 */
public final class QuestStats {
	private QuestStats() {}

	private static final String[] KEYS = { "logs", "stone", "iron", "diamond", "zombie", "skeleton", "walk", "craft", "fish" };
	private static final long[] RATE = { 3, 8, 2, 2, 2, 2, 40, 300, 1 }; // hoechstens so viele pro Sekunde (gleich wie im Server)
	private static Object world;
	private static long nextReq, baseAt, lastWrite, joinedAt, lastTick, srvMs;
	private static long[] base, last, add;
	private static final String SID = Long.toHexString(System.nanoTime()) + Long.toHexString(System.currentTimeMillis());
	private static boolean dirty;

	private static long[] read(StatHandler h) {
		long[] v = new long[KEYS.length];
		for (Block b : Registries.BLOCK) {
			int n = h.getStat(Stats.MINED, b); if (n <= 0) continue;
			if (b.getDefaultState().isIn(BlockTags.LOGS)) v[0] += n;
			if (b.getDefaultState().isIn(BlockTags.BASE_STONE_OVERWORLD)) v[1] += n;
			if (b == Blocks.IRON_ORE || b == Blocks.DEEPSLATE_IRON_ORE) v[2] += n;
			if (b == Blocks.DIAMOND_ORE || b == Blocks.DEEPSLATE_DIAMOND_ORE) v[3] += n;
		}
		v[4] = h.getStat(Stats.KILLED, EntityType.ZOMBIE) + h.getStat(Stats.KILLED, EntityType.HUSK) + h.getStat(Stats.KILLED, EntityType.DROWNED);
		v[5] = h.getStat(Stats.KILLED, EntityType.SKELETON) + h.getStat(Stats.KILLED, EntityType.STRAY);
		v[6] = ((long) h.getStat(Stats.CUSTOM, Stats.WALK_ONE_CM) + h.getStat(Stats.CUSTOM, Stats.SPRINT_ONE_CM) + h.getStat(Stats.CUSTOM, Stats.CROUCH_ONE_CM)) / 100;
		for (Item it : Registries.ITEM) { int n = h.getStat(Stats.CRAFTED, it); if (n > 0) v[7] += n; }
		v[8] = h.getStat(Stats.CUSTOM, Stats.FISH_CAUGHT);
		return v;
	}

	/** Wird jeden Client-Tick aufgerufen (leichtgewichtig: alle 10 Sekunden eine Abfrage). */
	public static void tick(MinecraftClient mc) {
		String file = System.getProperty("cloudy.qstat", "");
		if (file.isEmpty()) return;
		long now = System.currentTimeMillis();
		if (mc.player == null || mc.world == null) { world = null; lastTick = 0; return; }
		if (lastTick != 0 && !mc.isPaused() && mc.getCurrentServerEntry() != null) srvMs += Math.min(2000, now - lastTick); // Zeit auf einem Server
		lastTick = now;
		if (world != mc.world) { world = mc.world; base = null; last = null; add = new long[KEYS.length]; baseAt = 0; joinedAt = now; nextReq = 0; }
		if (now < nextReq) return;
		nextReq = now + 10000;
		try {
			if (mc.getNetworkHandler() != null) mc.getNetworkHandler().sendPacket(new ClientStatusC2SPacket(ClientStatusC2SPacket.Mode.REQUEST_STATS));
			StatHandler h = mc.player.getStatHandler();
			long[] cur = read(h);
			long play = h.getStat(Stats.CUSTOM, Stats.PLAY_TIME);
			if (base == null) { // Ausgangswert erst nehmen, wenn die Statistik vom Server angekommen ist (Spielzeit > 0) oder 12 s vergangen sind (neue Welt)
				if (play > 0 || now - joinedAt > 12000) { base = cur.clone(); last = cur.clone(); baseAt = now; }
				return;
			}
			double sec = Math.max(1, (now - baseAt) / 1000.0); baseAt = now;
			for (int i = 0; i < KEYS.length; i++) {
				long d = cur[i] - last[i]; last[i] = cur[i];
				if (d <= 0) continue;
				if (d > RATE[i] * sec * 1.5 + 5) continue; // unmoeglich schnell (z. B. verspaetet angekommene Statistik): nicht zaehlen
				add[i] += d; dirty = true;
			}
			if (dirty || now - lastWrite > 20000) write(file, now);
		} catch (Throwable ignored) {}
	}

	private static void write(String file, long now) {
		try {
			StringBuilder sb = new StringBuilder("{\"sid\":\"").append(SID).append("\",\"t\":").append(now).append(",\"mp\":").append(MinecraftClient.getInstance().getCurrentServerEntry() != null).append(",\"srv_s\":").append(srvMs / 1000).append(",\"d\":{");
			for (int i = 0; i < KEYS.length; i++) { if (i > 0) sb.append(','); sb.append('"').append(KEYS[i]).append("\":").append(add == null ? 0 : add[i]); }
			sb.append("}}");
			Path p = Path.of(file), tmp = Path.of(file + ".tmp");
			Files.writeString(tmp, sb.toString()); Files.move(tmp, p, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
			lastWrite = now; dirty = false;
		} catch (Throwable ignored) {}
	}
}
