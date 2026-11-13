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
		new Def("fps", "FPS counter", "HUD", "Shows how many frames per second your game renders"),
		new Def("ping", "Ping", "HUD", "Shows your connection delay to the server in milliseconds"),
		new Def("coords", "Coordinates", "HUD", "Shows your X / Y / Z position in the world"),
		new Def("dir", "Compass", "HUD", "Shows which direction you are facing (N, E, S, W) and the exact angle"),
		new Def("cps", "Clicks per second", "HUD", "Counts your left and right clicks per second"),
		new Def("keys", "Keystrokes", "HUD", "Shows W, A, S, D, space and mouse buttons lighting up when you press them"),
		new Def("lyricscard", "Song card", "HUD", "Shows the Spotify cover, title and the current lyrics line on screen. Move it in the HUD editor"),
		new Def("armor", "Armor status", "HUD", "Shows your armor pieces and how much durability they have left"),
		new Def("speed", "Speed", "HUD", "Shows how fast you move in blocks per second"),
		new Def("clock", "Clock", "HUD", "Shows the time of your computer"),
		new Def("memory", "Memory usage", "HUD", "Shows how much Java memory Minecraft is using"),
		new Def("sprint", "Auto sprint", "QoL", "You sprint automatically when you walk forward"),
		new Def("zoom", "Zoom", "QoL", "Hold C to zoom in (or switch to toggle in Options). Scroll the mouse wheel to zoom closer or further"),
		new Def("freelook", "Freelook", "QoL", "Hold Left Alt to look around your player without turning your character"),
		new Def("freecam", "Freecam", "QoL", "Press F6 to fly a free camera while your player stays where it is"),
		new Def("sky", "Custom sky", "QoL", "Colors the sky, clouds and fog with your shop sky, your theme or your own color"),
		new Def("lyrics", "Spotify lyrics", "QoL", "Shows the lyrics of your Spotify song in the game. All settings are in Cloudify (key I)"),
		new Def("itemphysics", "Item physics", "QoL", "Dropped items lie flat on the ground instead of spinning in the air"),
		new Def("crosshair", "Custom crosshair", "QoL", "Replaces the crosshair with your own: style, size, gap, color and outline"),
		new Def("wingadj", "Wing size & height", "QoL", "Makes your wings cosmetic bigger or smaller and moves it up or down"),
		new Def("mousefx", "Menu mouse effects", "QoL", "Main switch for the click and cursor effects in menus"),
		new Def("mousefx_click", "Click ripple", "QoL", "A ring with sparkles appears where you click in menus (needs Menu mouse effects)"),
		new Def("mousefx_trail", "Cursor trail", "QoL", "A soft glowing trail follows your cursor in menus (needs Menu mouse effects)"),
		new Def("timer", "Timer", "HUD", "A stopwatch or countdown on your screen, with keys for start/stop and reset"),
		new Def("totem", "Totem counter", "HUD", "Shows how many Totems of Undying you carry (red at zero)"),
		new Def("hotbar", "Custom hotbar & hearts", "QoL", "Redraws the hotbar, hearts, armor and food bar in a clean style and your colors"),
		new Def("playerhead", "Player head", "HUD", "Shows your skin face in the top-left corner"),
		new Def("biome", "Biome", "HUD", "Shows the name of the biome you are standing in"),
		new Def("light", "Light level", "HUD", "Shows the light level at your feet (monsters can spawn at 0)"),
		new Def("nether", "Nether coordinates", "HUD", "Shows where you would be in the Nether or Overworld (x8 / ÷8)"),
		new Def("day", "Day counter", "HUD", "Shows the world day and the in-game time"),
		new Def("durability", "Tool durability", "HUD", "Shows how much durability the item in your hand has left"),
		new Def("arrows", "Arrow counter", "HUD", "Shows how many arrows you carry"),
		new Def("potions", "Potion counter", "HUD", "Shows how many potions you carry"),
		new Def("held", "Item counter", "HUD", "Shows how many of the item in your hand you carry in total"),
		new Def("server", "Server address", "HUD", "Shows the address of the server you are playing on"),
		new Def("session", "Play time", "HUD", "Shows how long you have been playing this session"),
		new Def("effects", "Potion effects", "HUD", "Shows your active effects and how long they last"),
		new Def("death", "Last death point", "HUD", "Shows the coordinates where you died last"),
		new Def("food", "Food & saturation", "HUD", "Shows your hunger and saturation as numbers"),
		new Def("health", "Health", "HUD", "Shows your health as a number, including absorption hearts"),
		new Def("target", "Block you look at", "HUD", "Shows the name of the block in your crosshair"),
		new Def("nohurtcam", "No hurt shake", "QoL", "The camera does not shake when you take damage"),
		new Def("tooltips", "Better tooltips", "QoL", "Item tooltips also show durability and the item ID"),
		new Def("deathpos", "Death point in chat", "QoL", "Writes your death coordinates into your chat (only you see it)"),
		new Def("autogg", "Auto GG", "QoL", "Writes your GG message once when a game ends (set the message in Options)"),
		new Def("fullbright", "Fullbright", "QoL", "Lets you see clearly in caves and at night"));
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
	public static final String[] LPOS = {"Words in world (3D sky)", "Near hotbar", "Top center", "Screen center", "Left list", "Words (flat)", "Chrome letters (3D)"};
	public static final String[] LFONT = {"Extended", "Poppins", "Minecraft", "Montserrat", "Kanit", "Fredoka", "Unbounded", "Bebas Neue", "Pacifico", "Caveat"}, LFX = {"Glow", "Shadow", "Outline", "None"};
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
	/** Herzen: Stil, Animation, Groesse in %, Versatz in Pixeln. Timer: Modus, Countdown-Sekunden, Zehntel anzeigen. */
	public static int heartStyle = 0, heartAnim = 3, heartScale = 100, heartDx = 0, heartDy = 0, timerMode = 0, timerCount = 300;
	public static boolean timerTenths = true;
	public static final String[] HEART_STYLE = {"Classic", "Round", "Pixel", "Bar"}, HEART_ANIM = {"Off", "Wave", "Pulse", "Low HP shake"}, TIMER_MODE = {"Stopwatch", "Countdown"};
	/** Zoom: halten oder umschalten, Stufe (wird gespeichert), Mausempfindlichkeit beim Zoomen verringern. AutoGG: Nachricht. Cloudify: Theme. */
	public static boolean zoomHold = true, zoomSens = true;
	public static float zoomLevel = 3f;
	public static int autoggMsg = 0, cfTheme = 0;
	public static final String[] GG_MSGS = {"gg", "GG", "gg wp", "Good game!"};
	public static int wingSize = 100, wingY = 0; // Prozent / Schritte zu 0,02 Bloecken (positiv = hoeher)
	public static final String[] HB_STYLE = {"Dark", "Theme", "Custom color"}, HEART_MODE = {"Vanilla", "Theme", "Custom color"}, LMOTION = {"Float", "Fall", "Rise", "Drift", "Pop", "Wave", "Shake", "Slam"}, BEAT = {"Off", "Subtle", "Strong"};
	public static void hotbarReset() { hbStyle = 1; hbCol = 9; hbSel = 1; heartMode = 1; heartCol = 9; heartStyle = 0; heartAnim = 3; heartScale = 100; heartDx = 0; heartDy = 0; armCol = 1; foodCol = 9; pick[5] = 0x1B2236; pick[6] = 0x9FD3FF; pick[7] = 0xFF4D6D; pick[8] = 0x9FD3FF; pick[9] = 0xF2A24B; save(); }
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
				if (o.has("lyricsMode")) lyricsMode = Math.max(0, Math.min(LPOS.length - 1, o.get("lyricsMode").getAsInt()));
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
				if (o.has("heartStyle")) heartStyle = Math.max(0, Math.min(HEART_STYLE.length - 1, o.get("heartStyle").getAsInt()));
				if (o.has("heartAnim")) heartAnim = Math.max(0, Math.min(HEART_ANIM.length - 1, o.get("heartAnim").getAsInt()));
				if (o.has("heartScale")) heartScale = Math.max(50, Math.min(200, o.get("heartScale").getAsInt()));
				if (o.has("heartDx")) heartDx = Math.max(-60, Math.min(60, o.get("heartDx").getAsInt()));
				if (o.has("heartDy")) heartDy = Math.max(-60, Math.min(60, o.get("heartDy").getAsInt()));
				if (o.has("timerMode")) timerMode = Math.max(0, Math.min(1, o.get("timerMode").getAsInt()));
				if (o.has("timerCount")) timerCount = Math.max(10, Math.min(36000, o.get("timerCount").getAsInt()));
				if (o.has("timerTenths")) timerTenths = o.get("timerTenths").getAsBoolean();
				if (o.has("timerMs") && !Timer.running) Timer.acc = Math.max(0L, o.get("timerMs").getAsLong());
				if (o.has("armCol")) armCol = o.get("armCol").getAsInt();
				if (o.has("foodCol")) foodCol = o.get("foodCol").getAsInt();
				if (o.has("keys")) for (var e : o.getAsJsonObject("keys").entrySet()) keys.put(e.getKey(), e.getValue().getAsInt());
				if (o.has("cloudMode")) cloudMode = Math.max(0, Math.min(2, o.get("cloudMode").getAsInt()));
				if (o.has("cloudCol")) cloudCol = o.get("cloudCol").getAsInt();
				if (o.has("bgStyle")) bgStyle = Math.max(0, Math.min(1, o.get("bgStyle").getAsInt()));
				if (o.has("skySrc")) skySrc = Math.max(0, Math.min(2, o.get("skySrc").getAsInt()));
				if (o.has("skyCol")) skyCol = o.get("skyCol").getAsInt();
				if (o.has("skyStr")) skyStr = Math.max(10, Math.min(100, o.get("skyStr").getAsInt()));
				if (o.has("lyricsFont")) lyricsFont = Math.max(0, Math.min(LFONT.length - 1, o.get("lyricsFont").getAsInt()));
				if (o.has("lyricsFx")) lyricsFx = Math.max(0, Math.min(3, o.get("lyricsFx").getAsInt()));
				if (o.has("lyricsCur")) lyricsCur = o.get("lyricsCur").getAsInt();
				if (o.has("lyricsOld")) lyricsOld = o.get("lyricsOld").getAsInt();
				if (o.has("zoomHold")) zoomHold = o.get("zoomHold").getAsBoolean();
				if (o.has("zoomSens")) zoomSens = o.get("zoomSens").getAsBoolean();
				if (o.has("zoomLevel")) zoomLevel = Math.max(1.2f, Math.min(30f, o.get("zoomLevel").getAsFloat()));
				if (o.has("autoggMsg")) autoggMsg = Math.max(0, Math.min(GG_MSGS.length - 1, o.get("autoggMsg").getAsInt()));
				if (o.has("cfTheme")) cfTheme = Math.max(0, o.get("cfTheme").getAsInt());
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
			o.add("on", m); o.addProperty("scale", scale); o.addProperty("top", top); o.addProperty("menu", menu); o.addProperty("lyricsMode", lyricsMode); o.addProperty("lyricsOffset", lyricsOffset); { var pa = new com.google.gson.JsonArray(); for (int v : pick) pa.add(v); o.add("pickCols", pa); } o.addProperty("bgStyle", bgStyle); { var ko = new com.google.gson.JsonObject(); for (var e : keys.entrySet()) ko.addProperty(e.getKey(), e.getValue()); o.add("keys", ko); } o.addProperty("hbStyle", hbStyle); o.addProperty("hbCol", hbCol); o.addProperty("hbSel", hbSel); o.addProperty("heartMode", heartMode); o.addProperty("heartCol", heartCol); o.addProperty("lyricsMotion", lyricsMotion); o.addProperty("lyricsAlpha", lyricsAlpha); o.addProperty("lyricsSize", lyricsSize); o.addProperty("lyricsCard", lyricsCard); o.addProperty("skyBeat", skyBeat); o.addProperty("armCol", armCol); o.addProperty("wingSize", wingSize); o.addProperty("crossStyle", crossStyle); o.addProperty("crossSize", crossSize); o.addProperty("crossThick", crossThick); o.addProperty("crossGap", crossGap); o.addProperty("crossCol", crossCol); o.addProperty("crossOutline", crossOutline); o.addProperty("crossDyn", crossDyn); o.addProperty("wingY", wingY); o.addProperty("heartStyle", heartStyle); o.addProperty("heartAnim", heartAnim); o.addProperty("heartScale", heartScale); o.addProperty("heartDx", heartDx); o.addProperty("heartDy", heartDy); o.addProperty("timerMode", timerMode); o.addProperty("timerCount", timerCount); o.addProperty("timerTenths", timerTenths); o.addProperty("timerMs", Timer.elapsed()); o.addProperty("foodCol", foodCol); o.addProperty("fogMode", fogMode); o.addProperty("fogCol", fogCol); o.addProperty("fogDist", fogDist); { var fa = new com.google.gson.JsonArray(); for (String s : favs) fa.add(s); o.add("favs", fa); } o.addProperty("cloudMode", cloudMode); o.addProperty("cloudCol", cloudCol); o.addProperty("skySrc", skySrc); o.addProperty("skyCol", skyCol); o.addProperty("skyStr", skyStr); o.addProperty("lyricsLife", lyricsLife); o.addProperty("lyricsFont", lyricsFont); o.addProperty("lyricsFx", lyricsFx); o.addProperty("lyricsCur", lyricsCur); o.addProperty("lyricsOld", lyricsOld);
			o.addProperty("zoomHold", zoomHold); o.addProperty("zoomSens", zoomSens); o.addProperty("zoomLevel", zoomLevel); o.addProperty("autoggMsg", autoggMsg); o.addProperty("cfTheme", cfTheme);
			Files.createDirectories(file().getParent());
			Files.writeString(file(), o.toString());
		} catch (Exception e) { CloudyClient.LOG.warn("cloudy-mods.json konnte nicht gespeichert werden", e); }
	}
}
