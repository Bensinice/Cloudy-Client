package app.cloudy.client;

import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvent;
import net.minecraft.util.Identifier;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Emotes des Pets (z. B. Hund „Steve“: Bellen, Schlafen, Jammern mit Ton …). Andere Cloudy-Spieler sehen sie ueber coswant -> Konto-Server -> cosoth. */
public final class PetEmote {
	private PetEmote() {}
	public static volatile String selfId; public static volatile long selfStart;
	private static volatile Map<String, Object[]> others = new HashMap<>(); // Name (klein) -> {id, Startzeit}
	public static volatile boolean dirty;

	public static List<String[]> list() { return Cosmetics.pet == null ? List.of() : GLB.petEmotes(Cosmetics.pet); }
	private static long dur(String pet, String id) { for (String[] e : GLB.petEmotes(pet)) if (e[0].equals(id)) return Long.parseLong(e[2]); return 0L; }
	private static String sound(String pet, String id) { for (String[] e : GLB.petEmotes(pet)) if (e[0].equals(id)) return e[3]; return ""; }

	public static void play(String id) {
		if (Cosmetics.pet == null || dur(Cosmetics.pet, id) <= 0) return;
		selfId = id; selfStart = System.currentTimeMillis(); dirty = true;
		MinecraftClient mc = MinecraftClient.getInstance(); if (mc.player != null) sound(Cosmetics.pet, id, mc.player.getX(), mc.player.getY() + 1.4, mc.player.getZ());
	}

	private static void sound(String pet, String id, double x, double y, double z) {
		String s = sound(pet, id); if (s.isEmpty() || !ModConfig.isOn("petemote") || !s.matches("[a-z0-9_]{1,40}")) return;
		try { MinecraftClient.getInstance().getSoundManager().play(new PositionedSoundInstance(SoundEvent.of(Identifier.of("cloudy-client", s)), SoundCategory.NEUTRAL, 0.9f, 1f, net.minecraft.util.math.random.Random.create(), x, y, z)); } catch (Throwable ignored) {}
	}

	/** laufendes eigenes Emote (oder null) – Name (null = ich) */
	public static String id(String name) {
		String id; long st; String pet;
		if (name == null) { id = selfId; st = selfStart; pet = Cosmetics.pet; }
		else { Object[] o = others.get(name.toLowerCase()); if (o == null) return null; id = (String) o[0]; st = (Long) o[1]; String[] eq = CosmeticNet.get(name); pet = eq != null && eq.length > 3 ? eq[3] : null; }
		if (id == null || pet == null) return null; long d = dur(pet, id); return d > 0 && System.currentTimeMillis() - st <= d ? id : null;
	}
	public static long start(String name) { if (name == null) return selfStart; Object[] o = others.get(name.toLowerCase()); return o == null ? 0L : (Long) o[1]; }

	/** fuer coswant */
	public static JsonObject want() { String id = id(null); if (id == null) return null; JsonObject o = new JsonObject(); o.addProperty("id", id); o.addProperty("t", selfStart); return o; }

	/** aus cosoth: Name -> {id, Start}; neue Emotes mit Ton in der Naehe abspielen */
	static void setOthers(Map<String, Object[]> m) {
		MinecraftClient mc = MinecraftClient.getInstance(); Map<String, Object[]> old = others;
		if (mc.world != null && mc.player != null) for (Map.Entry<String, Object[]> e : m.entrySet()) {
			Object[] o = old.get(e.getKey()); if (o != null && o[0].equals(e.getValue()[0]) && Math.abs((Long) o[1] - (Long) e.getValue()[1]) < 3000) continue;
			for (var p : mc.world.getPlayers()) if (p.getName().getString().equalsIgnoreCase(e.getKey()) && p.squaredDistanceTo(mc.player) < 24 * 24) { String[] eq = CosmeticNet.get(e.getKey()); if (eq != null && eq.length > 3 && eq[3] != null) sound(eq[3], (String) e.getValue()[0], p.getX(), p.getY() + 1.4, p.getZ()); }
		}
		others = m;
	}
}
