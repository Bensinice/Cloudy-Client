package app.cloudy.client;

import net.minecraft.client.MinecraftClient;

/**
 * Leistungsprofile: schalten mehrere Effekte auf einmal um.
 * 0 Akku (Laptop/Mac unterwegs): Wolken, Skybox, Menue-Maus-Effekte aus, einfache Lyrics, max. 60 FPS, Sichtweite hoechstens 8.
 * 1 Ausgewogen (Standard): Wolken und Skybox an, Effekte an.
 * 2 Max FPS: alle Zusatzeffekte aus, FPS-Grenze aufgehoben.
 * Einzelne Schalter kann man danach trotzdem wieder aendern.
 */
public final class Perf {
	private Perf() {}
	public static final String[] NAMES = {"Battery", "Balanced", "Max FPS"};

	public static int current() { ModConfig.load(); return ModConfig.perfProfile < 0 ? 1 : ModConfig.perfProfile; }

	public static void apply(int p) {
		p = Math.max(0, Math.min(2, p));
		ModConfig.load();
		boolean fx = p == 1;
		ModConfig.set("clouds3d", fx);
		ModConfig.set("skybox", fx && ModConfig.isOn("skybox"));
		ModConfig.set("mousefx", p != 2 && p != 0);
		ModConfig.set("trails", p != 2); ModConfig.set("footprints", p != 2); // Max FPS: keine Spuren
		if (p != 1) ModConfig.lyricsReveal = 1; // ganze Zeile: weniger Einzelteile
		ModConfig.perfProfile = p;
		ModConfig.save();
		try {
			var o = MinecraftClient.getInstance().options;
			if (p == 0) { o.getMaxFps().setValue(60); if (o.getViewDistance().getValue() > 8) o.getViewDistance().setValue(8); }
			else if (p == 2) o.getMaxFps().setValue(260); // 260 = unbegrenzt
			o.write();
		} catch (Throwable ignored) {}
	}

	/** Beim Start: Profil aus dem Launcher (cloudy.cfg -> "perfProfile") uebernehmen, wenn es sich dort geaendert hat. */
	public static void fromLauncher() {
		try {
			String p = System.getProperty("cloudy.cfg", "");
			if (p.isEmpty()) return;
			var f = java.nio.file.Path.of(p);
			if (!java.nio.file.Files.exists(f)) return;
			var o = com.google.gson.JsonParser.parseString(java.nio.file.Files.readString(f)).getAsJsonObject();
			ModConfig.invDark = !o.has("texInvDark") || o.get("texInvDark").getAsBoolean();
			if (!o.has("perfProfile")) return;
			int v = o.get("perfProfile").getAsInt();
			ModConfig.load();
			if (v != ModConfig.perfFromCfg) { ModConfig.perfFromCfg = v; ModConfig.save(); apply(v); }
		} catch (Throwable ignored) {}
	}
}
