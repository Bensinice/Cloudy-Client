package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.text.Text;

/** Timer-Mod: Stoppuhr oder Countdown fuer das HUD. Start/Stop und Reset per Tastenkuerzel oder im Mods-Menue. Der gestoppte Stand bleibt ueber Neustarts erhalten. */
public final class Timer {
	private Timer() {}

	/** Gespeicherter Stand in ms (laeuft die Uhr, kommt die seit startAt vergangene Zeit dazu). */
	public static long acc = 0;
	public static boolean running = false;
	private static long startAt = 0;
	private static boolean finishedShown = false;

	public static long elapsed() { return acc + (running ? System.currentTimeMillis() - startAt : 0); }

	private static long total() { return Math.max(1, ModConfig.timerCount) * 1000L; }

	public static boolean finished() { return ModConfig.timerMode == 1 && elapsed() >= total(); }

	public static void toggle() {
		if (running) { acc = elapsed(); running = false; }
		else {
			if (finished()) acc = 0; // fertiger Countdown startet wieder von vorn
			startAt = System.currentTimeMillis(); running = true; finishedShown = false;
		}
		ModConfig.save();
	}

	public static void reset() { acc = 0; running = false; finishedShown = false; ModConfig.save(); }

	/** Jeden Tick: beendet einen Countdown am Ende und meldet das einmal. */
	public static void tick(MinecraftClient mc) {
		if (running && finished()) {
			acc = total(); running = false; ModConfig.save();
			if (!finishedShown && mc.player != null) { finishedShown = true; mc.player.sendMessage(Text.literal("Timer finished!"), true); }
		}
	}

	public static String fmt(long ms, boolean tenths) {
		ms = Math.max(0, ms);
		long s = ms / 1000, h = s / 3600, m = (s / 60) % 60, sec = s % 60;
		String base = h > 0 ? String.format("%d:%02d:%02d", h, m, sec) : String.format("%d:%02d", m, sec);
		return tenths ? base + "." + (ms % 1000) / 100 : base;
	}

	/** Text fuer das HUD. */
	public static String text() {
		long e = elapsed();
		boolean cd = ModConfig.timerMode == 1;
		String t = fmt(cd ? total() - e : e, ModConfig.timerTenths);
		if (finished()) return "Timer done " + t;
		return "Timer " + t + (!running && e > 0 ? " (paused)" : "");
	}

	public static String sample() { return "Timer " + (ModConfig.timerMode == 1 ? fmt(ModConfig.timerCount * 1000L, ModConfig.timerTenths) : fmt(12300, ModConfig.timerTenths)); }
}
