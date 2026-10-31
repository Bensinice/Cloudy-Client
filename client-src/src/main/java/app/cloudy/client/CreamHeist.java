package app.cloudy.client;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonElement;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.Clip;
import javax.sound.sampled.FloatControl;
import javax.sound.sampled.LineEvent;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.Reader;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/** Cloudy Creamkeys: Tastatur- und Mausklänge im Spiel. Konfiguration schreibt der Launcher (-Dcloudy.sounds=Datei.json). */
public final class CreamHeist {
	private static final class Snd { AudioFormat fmt; byte[] data; }
	private static final class Bank {
		final Map<String, Snd> files = new HashMap<>(); final Map<String, String> keys = new HashMap<>(); String def; float vol = 1f;
		Snd pick(String code) { String f = keys.getOrDefault(code, def); return f == null ? null : files.get(f); }
	}
	private static Bank kb, ms;
	private static boolean on;
	private static final AtomicInteger open = new AtomicInteger();
	private static final ExecutorService POOL = Executors.newSingleThreadExecutor(r -> { Thread t = new Thread(r, "cloudy-cream"); t.setDaemon(true); return t; });

	private CreamHeist() {}

	public static void init() {
		String path = System.getProperty("cloudy.sounds");
		if (path == null || path.isEmpty()) return;
		try (Reader r = Files.newBufferedReader(new File(path).toPath())) {
			JsonObject o = new Gson().fromJson(r, JsonObject.class);
			if (o == null || !o.has("enabled") || !o.get("enabled").getAsBoolean()) return;
			kb = load(o, "kb", o.has("kbVol") ? o.get("kbVol").getAsFloat() : 0.8f);
			ms = load(o, "ms", o.has("msVol") ? o.get("msVol").getAsFloat() : 0.8f);
			on = kb != null || ms != null;
			System.out.println("[Cloudy] Creamkeys aktiv (Tastatur=" + (kb != null) + ", Maus=" + (ms != null) + ")");
		} catch (Throwable t) { System.out.println("[Cloudy] Creamkeys Fehler: " + t); }
	}

	private static Bank load(JsonObject o, String k, float vol) {
		if (!o.has(k) || !o.get(k).isJsonObject()) return null;
		JsonObject p = o.getAsJsonObject(k); File dir = new File(p.get("dir").getAsString()); Bank b = new Bank(); b.vol = Math.max(0f, Math.min(1f, vol));
		if (p.has("default") && !p.get("default").isJsonNull()) b.def = p.get("default").getAsString();
		if (p.has("files")) for (Map.Entry<String, JsonElement> e : p.getAsJsonObject("files").entrySet()) b.keys.put(e.getKey(), e.getValue().getAsString());
		java.util.Set<String> names = new java.util.HashSet<>(b.keys.values()); if (b.def != null) names.add(b.def);
		for (String n : names) { try { b.files.put(n, read(new File(dir, n))); } catch (Throwable t) { System.out.println("[Cloudy] Sound fehlt: " + n + " (" + t.getMessage() + ")"); } }
		return b.files.isEmpty() ? null : b;
	}

	private static Snd read(File f) throws Exception {
		try (AudioInputStream in = AudioSystem.getAudioInputStream(f)) {
			AudioFormat src = in.getFormat(); AudioInputStream use = in;
			if (src.getEncoding() != AudioFormat.Encoding.PCM_SIGNED) {
				AudioFormat pcm = new AudioFormat(AudioFormat.Encoding.PCM_SIGNED, src.getSampleRate(), 16, src.getChannels(), src.getChannels() * 2, src.getSampleRate(), false);
				use = AudioSystem.getAudioInputStream(pcm, in);
			}
			ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
			while ((n = use.read(buf)) > 0) bo.write(buf, 0, n);
			Snd s = new Snd(); s.fmt = use.getFormat(); s.data = bo.toByteArray(); return s;
		}
	}

	public static void key(int glfw) { if (on && kb != null) play(kb, keyName(glfw)); }
	public static void mouse(int button) { if (on && ms != null) play(ms, button == 0 ? "MouseLeft" : button == 1 ? "MouseRight" : button == 2 ? "MouseMiddle" : "MouseLeft"); }

	private static void play(Bank b, String code) {
		Snd s = b.pick(code); if (s == null || open.get() > 24) return;
		POOL.execute(() -> {
			try {
				Clip c = AudioSystem.getClip(); c.open(s.fmt, s.data, 0, s.data.length);
				if (c.isControlSupported(FloatControl.Type.MASTER_GAIN)) {
					FloatControl g = (FloatControl) c.getControl(FloatControl.Type.MASTER_GAIN);
					float db = b.vol <= 0.001f ? g.getMinimum() : (float) (20.0 * Math.log10(b.vol));
					g.setValue(Math.max(g.getMinimum(), Math.min(g.getMaximum(), db)));
				}
				open.incrementAndGet();
				c.addLineListener(ev -> { if (ev.getType() == LineEvent.Type.STOP) { c.close(); open.decrementAndGet(); } });
				c.start();
			} catch (Throwable ignored) {}
		});
	}

	private static String keyName(int k) {
		if (k >= 65 && k <= 90) return "Key" + (char) k;
		if (k >= 48 && k <= 57) return "Digit" + (char) k;
		if (k >= 290 && k <= 301) return "F" + (k - 289);
		if (k >= 320 && k <= 329) return "Numpad" + (k - 320);
		switch (k) {
			case 32: return "Space"; case 257: return "Enter"; case 258: return "Tab"; case 259: return "Backspace"; case 256: return "Escape";
			case 340: return "ShiftLeft"; case 344: return "ShiftRight"; case 341: return "ControlLeft"; case 345: return "ControlRight";
			case 342: return "AltLeft"; case 346: return "AltRight"; case 280: return "CapsLock"; case 262: return "ArrowRight"; case 263: return "ArrowLeft";
			case 264: return "ArrowDown"; case 265: return "ArrowUp"; case 261: return "Delete"; case 260: return "Insert"; case 268: return "Home";
			case 269: return "End"; case 266: return "PageUp"; case 267: return "PageDown"; case 45: return "Minus"; case 61: return "Equal";
			case 91: return "BracketLeft"; case 93: return "BracketRight"; case 92: return "Backslash"; case 59: return "Semicolon"; case 39: return "Quote";
			case 44: return "Comma"; case 46: return "Period"; case 47: return "Slash"; case 96: return "Backquote"; case 335: return "NumpadEnter";
			default: return "Key" + k;
		}
	}
}
