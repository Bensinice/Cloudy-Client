package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Spotify-Daten vom Launcher (-Dcloudy.spotify): Playlists, Songs einer geoeffneten Playlist und Meldungen.
 * Gemeinsam fuer das Cloudify-Menue (Taste I) und den Chat-Befehl /playlist. Befehle gehen ueber SpotifyCmd an den Launcher.
 */
public final class SpotifyData {
	private SpotifyData() {}

	public record Pl(String name, String uri, int total) {
		public String id() { int i = uri.lastIndexOf(':'); return i < 0 ? uri : uri.substring(i + 1); }
	}
	public record Tr(String name, String artist, String uri) {}

	public static final List<Pl> pls = new ArrayList<>();
	public static final List<Tr> tracks = new ArrayList<>();
	public static boolean connected = true, launcher = true, trLoading;
	public static String err = "", msg = "", trErr = "", trId = "";
	public static long msgT;
	private static long fileMt = -1, lastRead, trReqAt, trT;

	/** Datei hoechstens alle 300 ms neu lesen (nur wenn geaendert). */
	public static void read() {
		long now = System.currentTimeMillis();
		if (trLoading && now - trReqAt > 20000) { trLoading = false; trErr = "No answer from the launcher. Is Spotify connected in the launcher?"; }
		if (now - lastRead < 300) return;
		lastRead = now;
		try {
			String p = System.getProperty("cloudy.spotify", "");
			if (p.isEmpty()) { launcher = false; connected = false; err = "Start Minecraft with the Cloudy launcher to use Spotify here."; return; }
			Path f = Path.of(p);
			if (!Files.exists(f)) { err = "Waiting for the launcher ..."; return; }
			long mt = Files.getLastModifiedTime(f).toMillis();
			if (mt == fileMt) return;
			fileMt = mt;
			JsonObject o = JsonParser.parseString(Files.readString(f)).getAsJsonObject();
			connected = !o.has("connected") || o.get("connected").getAsBoolean();
			err = o.has("error") ? o.get("error").getAsString() : "";
			pls.clear();
			if (o.has("playlists")) for (JsonElement e : o.getAsJsonArray("playlists")) {
				JsonObject q = e.getAsJsonObject();
				String name = q.has("name") ? q.get("name").getAsString() : "", uri = q.has("uri") ? q.get("uri").getAsString() : "";
				if (name.isBlank() || uri.isBlank()) continue; // keine leeren oder erfundenen Eintraege
				pls.add(new Pl(name, uri, q.has("total") ? q.get("total").getAsInt() : -1));
			}
			if (o.has("msg")) { JsonObject m = o.getAsJsonObject("msg"); long t = m.has("t") ? m.get("t").getAsLong() : 0; if (t > msgT) { msgT = t; msg = m.has("text") ? m.get("text").getAsString() : ""; } }
			if (o.has("tracks") && o.get("tracks").isJsonObject()) {
				JsonObject t = o.getAsJsonObject("tracks");
				String id = t.has("id") ? t.get("id").getAsString() : "";
				long tt = t.has("t") ? t.get("t").getAsLong() : 0;
				if (id.equals(trId) && tt >= trReqAt - 1000 && tt != trT) {
					trT = tt; trLoading = false;
					tracks.clear();
					boolean ok = t.has("ok") && t.get("ok").getAsBoolean();
					trErr = ok ? "" : t.has("error") ? t.get("error").getAsString() : "Could not load this playlist.";
					if (t.has("items")) for (JsonElement e : t.getAsJsonArray("items")) {
						JsonObject q = e.getAsJsonObject();
						String n = q.has("n") ? q.get("n").getAsString() : "", u = q.has("u") ? q.get("u").getAsString() : "";
						if (!n.isBlank() && u.startsWith("spotify:track:")) tracks.add(new Tr(n, q.has("a") ? q.get("a").getAsString() : "", u));
					}
					if (ok && tracks.isEmpty()) trErr = "This playlist has no songs that can be played.";
				}
			}
		} catch (Exception ignored) {}
	}

	/** Playlist oeffnen: der Launcher holt die Songs und schreibt sie in die Datei. false = Launcher nicht erreichbar. */
	public static boolean open(Pl p) {
		trId = p.id(); tracks.clear(); trErr = ""; trLoading = true; trReqAt = System.currentTimeMillis();
		boolean ok = SpotifyCmd.send("tracks:" + p.id());
		if (!ok) { trLoading = false; trErr = "Spotify control only works when Minecraft was started from the Cloudy launcher."; }
		return ok;
	}

	public static Pl current() { for (Pl p : pls) if (p.id().equals(trId)) return p; return null; }

	/** Song einer Playlist abspielen (Playlist laeuft danach weiter, Weiter/Zurueck funktionieren). */
	public static boolean play(Pl p, Tr t) { return SpotifyCmd.send("playtrack:" + p.uri() + "," + t.uri()); }
	public static boolean playAll(Pl p) { return SpotifyCmd.send("play:" + p.uri()); }
}
