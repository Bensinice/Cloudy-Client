package app.cloudy.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Einstellungen von "Cloudy Mods" (HUD-Widgets und Komfort-Funktionen), gespeichert in config/cloudy-mods.json. */
public final class ModConfig {
	public record Def(String id, String name, String cat, String desc) {}
	public static final List<Def> DEFS = List.of(
		new Def("fps", "FPS", "HUD", "Frames per second"),
		new Def("ping", "Ping", "HUD", "Latency to the server"),
		new Def("coords", "Coordinates", "HUD", "Your XYZ position"),
		new Def("dir", "Direction", "HUD", "Compass heading and angle"),
		new Def("cps", "CPS", "HUD", "Clicks per second (left | right)"),
		new Def("keys", "Keystrokes", "HUD", "WASD and mouse buttons"),
		new Def("lyricscard", "Song card", "HUD", "Cover, title and artist with the current line below. Move it in the HUD editor, switch it off here"),
		new Def("armor", "Armor status", "HUD", "Armor pieces with durability"),
		new Def("speed", "Speed", "HUD", "Blocks per second"),
		new Def("clock", "Clock", "HUD", "Your local time"),
		new Def("memory", "Memory", "HUD", "Java memory in use"),
		new Def("sprint", "Auto sprint", "QoL", "Sprint whenever you walk forward"),
		new Def("zoom", "Zoom", "QoL", "Press C to toggle zoom, scroll the mouse wheel to zoom closer or further (rebind in Controls)"),
		new Def("freelook", "Freelook", "QoL", "Hold Left Alt: look around you in 360 degrees without turning your head"),
		new Def("freecam", "Freecam", "QoL", "Press F6: fly a free camera while your player stays put"),
		new Def("sky", "Custom sky", "QoL", "Tints the world sky in your shop sky, theme or custom color"),
		new Def("lyrics", "Spotify lyrics", "QoL", "Live lyrics of your Spotify song, in the sky or near you"),
		new Def("itemphysics", "Item physics", "QoL", "Dropped items lie flat on the ground, no spinning or bobbing"),
		new Def("crosshair", "Custom crosshair", "QoL", "Your own crosshair: style, size, thickness, gap, color, outline, spreads when you move"),
		new Def("wingadj", "Wing size & height", "QoL", "Make your 3D wings smaller or bigger and move them up or down"),
		new Def("mousefx", "Mouse effects", "QoL", "Master switch for the click animation and the cursor trail in menus"),
		new Def("mousefx_click", "  Click animation", "QoL", "Ring and sparkles on every click (needs Mouse effects)"),
		new Def("mousefx_trail", "  Cursor trail", "QoL", "Soft trail behind the cursor (needs Mouse effects)"),
		new Def("totem", "Totem counter", "HUD", "Shows how many Totems of Undying you carry (turns red at zero)"),
		new Def("hotbar", "Custom hotbar", "QoL", "Dark, theme or custom-color hotbar and hearts (set colors in Options)"),
				new Def("playerhead", "Player head", "HUD", "Your face in the top-left corner (on by default)"),
				new Def("biome", "Biome", "HUD", "Name of the biome you are in"),
		new Def("light", "Light level", "HUD", "Light level at your feet (mobs spawn at 0)"),
		new Def("nether", "Nether coordinates", "HUD", "Matching Nether / Overworld coordinates (x8 / ÷8)"),
		new Def("day", "Day counter", "HUD", "World day and time of day"),
		new Def("durability", "Durability", "HUD", "Durability of the tool in your hand"),
		new Def("arrows", "Arrow counter", "HUD", "Arrows in your inventory"),
		new Def("potions", "Potion counter", "HUD", "Potions in your inventory"),
		new Def("held", "Item counter", "HUD", "How many of the item in your hand you carry"),
		new Def("server", "Server address", "HUD", "The server you are playing on"),
		new Def("session", "Session time", "HUD", "How long you have been playing"),
		new Def("effects", "Potion effects", "HUD", "Active effects with the time left"),
		new Def("death", "Death point", "HUD", "Where you died last"),
		new Def("food", "Food & saturation", "HUD", "Hunger and saturation"),
		new Def("health", "Health", "HUD", "Your hearts including absorption"),
		new Def("target", "Block target", "HUD", "Name of the block you are looking at"),
		new Def("nohurtcam", "No hurt cam", "QoL", "No camera shake when you take damage"),
		new Def("tooltips", "Better tooltips", "QoL", "Item tooltips show durability and the item ID"),
		new Def("deathpos", "Death point in chat", "QoL", "Writes your death coordinates into the chat (only you see it)"),
		new Def("autogg", "Auto GG", "QoL", "Says gg in chat when a game ends with a win message (once per 30 s)"),
		new Def("fullbright", "Fullbright", "QoL", "See clearly in caves and at night"));
	private static final Map<String, Boolean> on = new HashMap<>();
	/** Eigene Position je Widget: {x, y} als Anteil der Fenstergroesse (0..1, linke obere Ecke), {s} Groesse. */
	public static final Map<String, float[]> pos = new HashMap<>();
	public static float scale = 1f;
	public static boolean top = true, menu = true;
	/** Lyrics: 0 = gross am Himmel (oben), 1 = klein und nah (unten); Zeitversatz in ms. */
	public static int lyricsMode = 0, lyricsOffset = 0, lyricsLife = 1600, lyricsCur = 0, lyricsOld = 3, lyricsFont = 0, lyricsFx = 0;
	public static int cloudMode = 0, cloudCol = 0;
	public static final String[] CLOUD_MODES = {"Vanilla", "Match sky", "Custom color"};
	public static int bgStyle = 0, skySrc = 0, skyCol = 3, skyStr = 100;
	public static final String[] BG_NAMES = {"Clean", "Theme scene"}, SKY_SRC = {"Shop sky", "Theme color", "Custom color"};
	public static void skyReset() { skyBeat = 0; skySrc = 0; skyCol = 3; skyStr = 100; cloudMode = 0; cloudCol = 0; fogMode = 0; fogCol = 9; fogDist = 2; save(); }
	public static final String[] LPOS = {"Words in world", "Near hotbar", "Top center", "Screen center", "Left list"};
	public static final String[] LFONT = {"Extended", "Cloudy", "Minecraft"}, LFX = {"Glow", "Shadow", "Outline", "None"};
	public static void lyricsReset() { lyricsMode = 0; lyricsOffset = 0; lyricsLife = 1600; lyricsCur = 0; lyricsOld = 3; lyricsFont = 0; lyricsFx = 0; lyricsMotion = 0; lyricsAlpha = 100; lyricsSize = 100; lyricsCard = true; save(); }
	/** Farbauswahl fuer die Lyrics (Index): 0 Weiss, 1 Theme, 2 Gelb, 3 Hellblau, 4 Rosa, 5 Mint, 6 Orange, 7 Violett, 8 Rot */
	public static final String[] LCOL_NAMES = {"White", "Theme", "Yellow", "Sky blue", "Pink", "Mint", "Orange", "Violet", "Red", "Custom"};
	public static final int[] LCOL = {0xFFFFFF, -1, 0xFFE866, 0x9FD3FF, 0xFF9ECF, 0x8CF5C8, 0xFFA45C, 0xC09CFF, 0xFF6B6B, -2};
	/** Eigene Farben (Farbwaehler) je Ziel: 0 Lyrics aktuell, 1 Lyrics gesungen, 2 Himmel, 3 Wolken. */
	public static final int[] pick = {0xFFFFFF, 0x9FD3FF, 0x9FD3FF, 0xFFFFFF, 0xBFD9F2, 0x1B2236, 0x9FD3FF, 0xFF4D6D, 0x9FD3FF, 0xF2A24B, 0xFFFFFF};
	/** Nebel: 0 Vanilla, 1 Aus, 2 Eigene Farbe; fogDist 0..4 = 50%..200%. Favoriten: Sterne auf den Mod-Karten. */
	public static int fogMode = 0, fogCol = 9, fogDist = 2;
	public static final String[] FOG_MODES = {"Vanilla", "No fog", "Custom color"}, FOG_DIST = {"50%", "75%", "100%", "150%", "200%"};
	/** Eigene Hotbar: Stil 0 Dunkel, 1 Theme, 2 Eigene Farbe; Herzen: 0 Vanilla, 1 Theme, 2 Eigene Farbe. Lyrics-Bewegung: 0 Schweben, 1 Fallen. */
	public static int hbStyle = 1, hbCol = 9, hbSel = 1, heartMode = 1, heartCol = 9, armCol = 1, foodCol = 9, lyricsMotion = 0, lyricsAlpha = 100, lyricsSize = 100, skyBeat = 0;
	public static boolean lyricsCard = true, crossOutline = true, crossDyn = true;
	public static int crossStyle = 0, crossSize = 5, crossThick = 1, crossGap = 2, crossCol = 1;
	public static int wingSize = 100, wingY = 0; // Prozent / Schritte zu 0,02 Bloecken (positiv = hoeher)
	public static final String[] HB_STYLE = {"Dark", "Theme", "Custom color"}, HEART_MODE = {"Vanilla", "Theme", "Custom color"}, LMOTION = {"Float", "Fall", "Rise", "Drift", "Pop", "Wave", "Shake", "Slam"}, BEAT = {"Off", "Subtle", "Strong"};
	public static void hotbarReset() { hbStyle = 1; hbCol = 9; hbSel = 1; heartMode = 1; heartCol = 9; armCol = 1; foodCol = 9; pick[5] = 0x1B2236; pick[6] = 0x9FD3FF; pick[7] = 0xFF4D6D; pick[8] = 0x9FD3FF; pick[9] = 0xF2A24B; save(); }
	/** Tastenkuerzel je Mod (GLFW-Code, fehlt = keins). */
	public static final java.util.Map<String, Integer> keys = new java.util.LinkedHashMap<>();
	public static String keyName(int code) {
		try { return net.minecraft.client.util.InputUtil.fromKeyCode(code, 0).getLocalizedText().getString().toUpperCase(); } catch (Throwable t) { return "KEY " + code; }
	}
	public static final java.util.Set<String> favs = new java.util.LinkedHashSet<>();
	public static void toggleFav(String id) { if (!favs.remove(id)) favs.add(id); save(); }
	public static int lcol(int i, int t) { i = Math.max(0, Math.min(LCOL.length - 1, i)); int v = LCOL[i]; return v == -1 ? (Theme.accent & 0xFFFFFF) : v == -2 ? pick[t] & 0xFFFFFF : v; }
	public static String colName(int i, int t) { return i == LCOL.length - 1 ? String.format("#%06X", pick[t] & 0xFFFFFF) : LCOL_NAMES[Math.max(0, Math.min(LCOL.length - 1, i))]; }
	private static boolean loaded;

	private static Path file() { return FabricLoader.getInstance().getConfigDir().resolve("cloudy-mods.json"); }

	public static boolean isOn(String id) { load(); Boolean b = on.get(id); return b == null ? (id.equals("lyrics") || id.equals("sky") || id.equals("freelook") || id.equals("freecam") || id.startsWith("mousefx") || id.equals("itemphysics") || id.equals("lyricscard") || id.equals("playerhead")) : b; } // Lyrics sind standardmaessig an
	public static void set(String id, boolean v) { load(); on.put(id, v); save(); }
	public static boolean anyHud() { for (Def d : DEFS) if (d.cat().equals("HUD") && isOn(d.id())) return true; return false; }

	public static void load() {
		if (loaded) return;
		loaded = true;
		try {
			Path f = file();
			if (Files.exists(f)) {
				JsonObject o = JsonParser.parseString(Files.readString(f)).getAsJsonObject();
				if (o.has("on")) for (var e : o.getAsJsonObject("on").entrySet()) on.put(e.getKey(), e.getValue().getAsBoolean());
				if (o.has("scale")) scale = Math.max(0.5f, Math.min(2f, o.get("scale").getAsFloat()));
				if (o.has("pos")) for (var e : o.getAsJsonObject("pos").entrySet()) { var a = e.getValue().getAsJsonArray(); pos.put(e.getKey(), new float[]{a.get(0).getAsFloat(), a.get(1).getAsFloat(), a.get(2).getAsFloat()}); }
				if (o.has("top")) top = o.get("top").getAsBoolean();
				if (o.has("menu")) menu = o.get("menu").getAsBoolean();
				if (o.has("lyricsMode")) lyricsMode = o.get("lyricsMode").getAsInt();
				if (o.has("lyricsOffset")) lyricsOffset = o.get("lyricsOffset").getAsInt();
				if (o.has("lyricsLife")) lyricsLife = Math.max(600, Math.min(4000, o.get("lyricsLife").getAsInt()));
				if (o.has("pickCols")) { var a = o.getAsJsonArray("pickCols"); for (int i = 0; i < pick.length && i < a.size(); i++) pick[i] = a.get(i).getAsInt() & 0xFFFFFF; }
				if (o.has("fogMode")) fogMode = Math.max(0, Math.min(2, o.get("fogMode").getAsInt()));
				if (o.has("fogCol")) fogCol = o.get("fogCol").getAsInt();
				if (o.has("fogDist")) fogDist = Math.max(0, Math.min(4, o.get("fogDist").getAsInt()));
				if (o.has("favs")) for (var e : o.getAsJsonArray("favs")) favs.add(e.getAsString());
				if (o.has("hbStyle")) hbStyle = Math.max(0, Math.min(2, o.get("hbStyle").getAsInt()));
				if (o.has("hbCol")) hbCol = o.get("hbCol").getAsInt();
				if (o.has("hbSel")) hbSel = o.get("hbSel").getAsInt();
				if (o.has("heartMode")) heartMode = Math.max(0, Math.min(2, o.get("heartMode").getAsInt()));
				if (o.has("heartCol")) heartCol = o.get("heartCol").getAsInt();
				if (o.has("lyricsMotion")) lyricsMotion = Math.max(0, Math.min(LMOTION.length - 1, o.get("lyricsMotion").getAsInt()));
				if (o.has("lyricsAlpha")) lyricsAlpha = Math.max(20, Math.min(100, o.get("lyricsAlpha").getAsInt()));
				if (o.has("lyricsSize")) lyricsSize = Math.max(50, Math.min(200, o.get("lyricsSize").getAsInt()));
				if (o.has("lyricsCard")) lyricsCard = o.get("lyricsCard").getAsBoolean();
				if (o.has("skyBeat")) skyBeat = Math.max(0, Math.min(2, o.get("skyBeat").getAsInt()));
				if (o.has("crossStyle")) crossStyle = Math.max(0, Math.min(Crosshair.STYLES.length - 1, o.get("crossStyle").getAsInt()));
				if (o.has("crossSize")) crossSize = Math.max(2, Math.min(20, o.get("crossSize").getAsInt()));
				if (o.has("crossThick")) crossThick = Math.max(1, Math.min(4, o.get("crossThick").getAsInt()));
				if (o.has("crossGap")) crossGap = Math.max(0, Math.min(12, o.get("crossGap").getAsInt()));
				if (o.has("crossCol")) crossCol = o.get("crossCol").getAsInt();
				if (o.has("crossOutline")) crossOutline = o.get("crossOutline").getAsBoolean();
				if (o.has("crossDyn")) crossDyn = o.get("crossDyn").getAsBoolean();
				if (o.has("wingSize")) wingSize = Math.max(40, Math.min(200, o.get("wingSize").getAsInt()));
				if (o.has("wingY")) wingY = Math.max(-25, Math.min(25, o.get("wingY").getAsInt()));
				if (o.has("armCol")) armCol = o.get("armCol").getAsInt();
				if (o.has("foodCol")) foodCol = o.get("foodCol").getAsInt();
				if (o.has("keys")) for (var e : o.getAsJsonObject("keys").entrySet()) keys.put(e.getKey(), e.getValue().getAsInt());
				if (o.has("cloudMode")) cloudMode = Math.max(0, Math.min(2, o.get("cloudMode").getAsInt()));
				if (o.has("cloudCol")) cloudCol = o.get("cloudCol").getAsInt();
				if (o.has("bgStyle")) bgStyle = Math.max(0, Math.min(1, o.get("bgStyle").getAsInt()));
				if (o.has("skySrc")) skySrc = Math.max(0, Math.min(2, o.get("skySrc").getAsInt()));
				if (o.has("skyCol")) skyCol = o.get("skyCol").getAsInt();
				if (o.has("skyStr")) skyStr = Math.max(10, Math.min(100, o.get("skyStr").getAsInt()));
				if (o.has("lyricsFont")) lyricsFont = Math.max(0, Math.min(2, o.get("lyricsFont").getAsInt()));
				if (o.has("lyricsFx")) lyricsFx = Math.max(0, Math.min(3, o.get("lyricsFx").getAsInt()));
				if (o.has("lyricsCur")) lyricsCur = o.get("lyricsCur").getAsInt();
				if (o.has("lyricsOld")) lyricsOld = o.get("lyricsOld").getAsInt();
				return;
			}
		} catch (Exception e) { CloudyClient.LOG.warn("cloudy-mods.json unlesbar", e); }
		// erster Start: Werte aus den Launcher-Einstellungen uebernehmen
		on.put("fps", CloudyClient.HUD_FPS); on.put("ping", CloudyClient.HUD_PING); on.put("coords", CloudyClient.HUD_COORDS); on.put("armor", CloudyClient.HUD_ARMOR);
		on.put("sprint", false); on.put("zoom", true);
		save();
	}

	public static void save() {
		try {
			JsonObject o = new JsonObject(), m = new JsonObject();
			for (var e : on.entrySet()) m.addProperty(e.getKey(), e.getValue());
			JsonObject pp = new JsonObject();
			for (var e : pos.entrySet()) { var a = new com.google.gson.JsonArray(); for (float v : e.getValue()) a.add(v); pp.add(e.getKey(), a); }
			o.add("pos", pp);
			o.add("on", m); o.addProperty("scale", scale); o.addProperty("top", top); o.addProperty("menu", menu); o.addProperty("lyricsMode", lyricsMode); o.addProperty("lyricsOffset", lyricsOffset); { var pa = new com.google.gson.JsonArray(); for (int v : pick) pa.add(v); o.add("pickCols", pa); } o.addProperty("bgStyle", bgStyle); { var ko = new com.google.gson.JsonObject(); for (var e : keys.entrySet()) ko.addProperty(e.getKey(), e.getValue()); o.add("keys", ko); } o.addProperty("hbStyle", hbStyle); o.addProperty("hbCol", hbCol); o.addProperty("hbSel", hbSel); o.addProperty("heartMode", heartMode); o.addProperty("heartCol", heartCol); o.addProperty("lyricsMotion", lyricsMotion); o.addProperty("lyricsAlpha", lyricsAlpha); o.addProperty("lyricsSize", lyricsSize); o.addProperty("lyricsCard", lyricsCard); o.addProperty("skyBeat", skyBeat); o.addProperty("armCol", armCol); o.addProperty("wingSize", wingSize); o.addProperty("crossStyle", crossStyle); o.addProperty("crossSize", crossSize); o.addProperty("crossThick", crossThick); o.addProperty("crossGap", crossGap); o.addProperty("crossCol", crossCol); o.addProperty("crossOutline", crossOutline); o.addProperty("crossDyn", crossDyn); o.addProperty("wingY", wingY); o.addProperty("foodCol", foodCol); o.addProperty("fogMode", fogMode); o.addProperty("fogCol", fogCol); o.addProperty("fogDist", fogDist); { var fa = new com.google.gson.JsonArray(); for (String s : favs) fa.add(s); o.add("favs", fa); } o.addProperty("cloudMode", cloudMode); o.addProperty("cloudCol", cloudCol); o.addProperty("skySrc", skySrc); o.addProperty("skyCol", skyCol); o.addProperty("skyStr", skyStr); o.addProperty("lyricsLife", lyricsLife); o.addProperty("lyricsFont", lyricsFont); o.addProperty("lyricsFx", lyricsFx); o.addProperty("lyricsCur", lyricsCur); o.addProperty("lyricsOld", lyricsOld);
			Files.createDirectories(file().getParent());
			Files.writeString(file(), o.toString());
		} catch (Exception e) { CloudyClient.LOG.warn("cloudy-mods.json konnte nicht gespeichert werden", e); }
	}
}
