package app.cloudy.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * 3D-Chrombuchstaben fuer die Lyrics (Dateien in /cloudy-cos/letters/, Masse aus letters.json).
 * Einheit = 1 Block, Grossbuchstaben 1,5 hoch, Ursprung unten links auf der Grundlinie, Y oben, +Z vorne.
 */
public final class ChromeLetters {
	private ChromeLetters() {}

	private record G(String file, float adv) {}
	private static final Map<Character, G> GL = new HashMap<>();
	private static float space = 0.4f;
	private static boolean loaded, ok;
	public static final float CAP = 1.5f;

	private static void load() {
		if (loaded) return;
		loaded = true;
		try (InputStream in = ChromeLetters.class.getResourceAsStream("/cloudy-cos/letters/letters.json")) {
			if (in == null) throw new java.io.IOException("letters.json fehlt");
			JsonObject j = JsonParser.parseString(new String(in.readAllBytes(), StandardCharsets.UTF_8)).getAsJsonObject();
			if (j.has("spaceWidth")) space = j.get("spaceWidth").getAsFloat();
			for (var e : j.getAsJsonObject("glyphs").entrySet()) {
				if (e.getKey().isEmpty()) continue;
				JsonObject g = e.getValue().getAsJsonObject();
				String f = g.get("file").getAsString();
				f = f.substring(f.lastIndexOf('/') + 1);
				GL.put(e.getKey().charAt(0), new G(f, g.get("advance").getAsFloat()));
			}
			ok = !GL.isEmpty();
		} catch (Exception e) { CloudyClient.LOG.warn("3D-Buchstaben nicht verfuegbar", e); ok = false; }
	}

	public static boolean available() { load(); return ok; }

	/** Zeichen auf ein vorhandenes Modell abbilden: Kleinbuchstaben -> gross, Umlaute/Akzente -> Grundbuchstabe, Apostroph-Varianten -> '. */
	private static char norm(char ch) {
		if (ch == '’' || ch == '‘' || ch == '`') return '\'';
		if (ch == '–' || ch == '—') return '-';
		String s = java.text.Normalizer.normalize(String.valueOf(ch), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
		if (s.isEmpty()) return ch;
		if (ch == 'ß') return 'S';
		return Character.toUpperCase(s.charAt(0));
	}

	/** Breite eines Wortes in Bloecken (ohne Abstand danach). */
	public static float width(String w) {
		load();
		float x = 0;
		for (int i = 0; i < w.length(); i++) { G g = GL.get(norm(w.charAt(i))); x += g != null ? g.adv() : space; }
		return Math.max(0f, x - 0.1875f); // letzter Vorschub ohne Luft danach
	}

	public static float space() { load(); return space; }

	/** Wort zeichnen, Ursprung = unten links auf der Grundlinie (glTF-Raum). Unbekannte Zeichen bleiben als Luecke. */
	public static void draw(MatrixStack ms, VertexConsumerProvider vcp, String w, int argb, int light) {
		load();
		if (!ok) return;
		float x = 0;
		for (int i = 0; i < w.length(); i++) {
			char ch = norm(w.charAt(i));
			G g = GL.get(ch);
			if (g == null) { x += space; continue; }
			ms.push();
			ms.translate(x, 0f, 0f);
			String key = "l_" + g.file().replace(".glb", "").toLowerCase(java.util.Locale.ROOT);
			GLB.drawRes(ms, vcp, key, "/cloudy-cos/letters/" + g.file(), argb, light);
			ms.pop();
			x += g.adv();
		}
	}
}
