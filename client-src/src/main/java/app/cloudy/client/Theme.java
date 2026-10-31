package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Theme und eigene Widgets aus der Cloudy-Konfiguration (-Dcloudy.cfg). Das Theme ist das, das du im Launcher gewählt hast. */
public final class Theme {
	private Theme() {}

	/** Himmelfarbe der Welt (0 = Vanilla). Kommt nur vom im Shop ausgewaehlten Himmel. */
	public static volatile int worldSky = 0, worldSky2 = 0;
	public static int sky1 = 0xFFA9D4FF, sky2 = 0xFFEAF6FF, accent = 0xFF4AA3FF;
	public static boolean dark = false, top = true;
	/** Himmel des gewaehlten Launcher-Themes (ohne Shop-Himmel) – fuer den Titelbildschirm. */
	public static int tSky1 = 0xFFA9D4FF, tSky2 = 0xFFEAF6FF;
	public static boolean tDark = false;
	public static String id = "";
	public static final List<String> widgets = new ArrayList<>();
	private static long loaded, mtime = -1;

	/** Liest die Datei höchstens alle 2 Sekunden neu (Theme-Wechsel im Launcher wirkt so auch ohne Neustart der Mod). */
	public static void load() {
		long now = System.currentTimeMillis();
		if (now - loaded < 3000) return;
		loaded = now;
		try {
			String p = System.getProperty("cloudy.cfg", "");
			if (p.isEmpty()) return;
			long mt = Files.getLastModifiedTime(Path.of(p)).toMillis();
			if (mt == mtime) return; // nur neu lesen, wenn sich die Datei geaendert hat
			mtime = mt;
			JsonObject o = JsonParser.parseString(Files.readString(Path.of(p))).getAsJsonObject();
			if (o.has("theme")) {
				JsonObject t = o.getAsJsonObject("theme");
				JsonArray sky = t.getAsJsonArray("sky");
				sky1 = col(sky.get(0).getAsString(), sky1);
				sky2 = col(sky.get(1).getAsString(), sky2);
				accent = col(t.get("accent").getAsString(), accent);
				id = t.has("id") ? t.get("id").getAsString() : "";
				dark = t.has("dark") && t.get("dark").getAsBoolean();
				Ui.ACCENT = accent;
				tSky1 = sky1; tSky2 = sky2; tDark = dark;
			}
			worldSky = 0; worldSky2 = 0;
			if (o.has("skyShop") && o.get("skyShop").isJsonObject()) { // im Shop gewaehlter Himmel ueberschreibt das Theme
				JsonObject k = o.getAsJsonObject("skyShop");
				JsonArray ks = k.getAsJsonArray("sky");
				sky1 = col(ks.get(0).getAsString(), sky1);
				sky2 = col(ks.get(1).getAsString(), sky2);
				worldSky = sky1; worldSky2 = sky2;
				dark = k.has("dark") && k.get("dark").getAsBoolean();
			}
			top = !o.has("top") || o.get("top").getAsBoolean();
			widgets.clear();
			if (false && o.has("widgets")) for (JsonElement e : o.getAsJsonArray("widgets")) {
				JsonObject w = e.getAsJsonObject();
				if (w.has("on") && !w.get("on").getAsBoolean()) continue;
				String text = w.get("text").getAsString();
				if (!text.isBlank()) widgets.add(text);
			}
		} catch (Exception ignored) {}
	}

	private static int col(String hex, int def) {
		try { return 0xFF000000 | Integer.parseInt(hex.replace("#", ""), 16); } catch (Exception e) { return def; }
	}

	public static int ink() { return dark ? 0xFFEAF2FF : 0xFF16345F; }
	public static int panel() { return dark ? 0xCC0B1226 : 0xCCFFFFFF; }
	public static int panelHover() { return dark ? 0xDD1B2A4F : 0xEEFFFFFF; }
}
