package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Spotify-Menue im Spiel (Taste I): Song, Steuerung, Playlists und Lyrics-Schalter. Daten kommen vom Cloudy-Launcher (Datei -Dcloudy.spotify), Befehle gehen an ihn zurueck. */
public class SpotifyScreen extends Screen {
	private record Hit(int x, int y, int w, int h, Runnable run) {}
	private record Pl(String name, String uri, int total) {}
	private final List<Hit> hits = new ArrayList<>();
	private final Screen parent;
	private final List<Pl> pls = new ArrayList<>();
	private boolean connected = true, wasDown;
	private String listErr = "", msg = "", localMsg = "";
	private long msgT, fileMt = -1, lastRead, localT;
	private int scroll, maxScroll, px, py, pw, ph;

	public SpotifyScreen(Screen parent) {
		super(Text.literal("Cloudy Spotify"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		pw = Math.min(this.width - 16, 460); ph = Math.min(this.height - 16, 270);
		px = (this.width - pw) / 2; py = (this.height - ph) / 2;
	}

	@Override
	public boolean shouldPause() { return false; }

	@Override
	public void renderBackground(DrawContext c, int mx, int my, float delta) {
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, MinecraftClient.getInstance().world == null ? 0x55000000 : 0x77050A16);
	}

	private void readList() {
		long now = System.currentTimeMillis();
		if (now - lastRead < 500) return;
		lastRead = now;
		try {
			String p = System.getProperty("cloudy.spotify", "");
			if (p.isEmpty()) { connected = false; listErr = "Start Minecraft with the Cloudy launcher to use Spotify here."; return; }
			Path f = Path.of(p);
			if (!Files.exists(f)) { listErr = "Waiting for the launcher ..."; return; }
			long mt = Files.getLastModifiedTime(f).toMillis();
			if (mt == fileMt) return;
			fileMt = mt;
			JsonObject o = JsonParser.parseString(Files.readString(f)).getAsJsonObject();
			connected = !o.has("connected") || o.get("connected").getAsBoolean();
			listErr = o.has("error") ? o.get("error").getAsString() : "";
			pls.clear();
			if (o.has("playlists")) {
				JsonArray a = o.getAsJsonArray("playlists");
				for (JsonElement e : a) { JsonObject q = e.getAsJsonObject(); pls.add(new Pl(q.get("name").getAsString(), q.get("uri").getAsString(), q.has("total") ? q.get("total").getAsInt() : -1)); }
			}
			if (o.has("msg")) { JsonObject m = o.getAsJsonObject("msg"); long t = m.has("t") ? m.get("t").getAsLong() : 0; if (t > msgT) { msgT = t; msg = m.has("text") ? m.get("text").getAsString() : ""; } }
		} catch (Exception ignored) {}
	}

	private void cmd(String c, String ok) {
		boolean sent = SpotifyCmd.send(c);
		localMsg = sent ? ok : "Spotify control only works when started from the Cloudy launcher."; localT = System.currentTimeMillis();
	}

	private void btn(DrawContext c, int mx, int my, int x, int y, int w, int h, String label, boolean primary, Runnable run) {
		boolean hv = Ui.in(mx, my, x, y, w, h);
		Ui.button(c, this.textRenderer, x, y, w, h, label, hv, primary);
		hits.add(new Hit(x, y, w, h, run));
	}

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load();
		ModConfig.load();
		Lyrics.refresh();
		readList();
		hits.clear();
		c.fill(px, py, px + pw, py + ph, 0xCC070D1C);
		c.fill(px, py, px + pw, py + 1, 0x55FFFFFF);
		c.fill(px, py + ph - 1, px + pw, py + ph, 0x33FFFFFF);
		c.fill(px, py, px + 1, py + ph, 0x33FFFFFF);
		c.fill(px + pw - 1, py, px + pw, py + ph, 0x33FFFFFF);
		Ui.txt(c, "Spotify", px + 12, py + 9, 0xFFFFFFFF);
		btn(c, mx, my, px + pw - 26, py + 6, 18, 16, "x", false, this::close);

		// links: aktueller Song
		int lx = px + 12, ly = py + 30, lw = 170;
		String ti = Lyrics.nowTitle();
		var cov = Lyrics.nowCover();
		c.fill(lx, ly, lx + 64, ly + 64, 0xFF16213F);
		if (cov != null) c.drawTexture(net.minecraft.client.render.RenderLayer::getGuiTextured, cov, lx, ly, 0f, 0f, 64, 64, 64, 64);
		if (ti.isEmpty()) {
			Ui.txt(c, "Nothing playing", lx + 72, ly + 6, 0xFFB8C6E8);
			Ui.txt(c, "Start a song in Spotify", lx + 72, ly + 20, 0xFF7F8CA3);
		} else {
			Ui.txt(c, Ui.trim(ti, lw - 72), lx + 72, ly + 6, 0xFFFFFFFF);
			Ui.txt(c, Ui.trim(Lyrics.nowArtist(), lw - 72), lx + 72, ly + 20, 0xFFB8C6E8);
			Ui.txt(c, Lyrics.nowTime(), lx + 72, ly + 34, 0xFF7F8CA3);
			Ui.txt(c, Lyrics.hasLyrics() ? "Lyrics synced" : "No lyrics", lx + 72, ly + 48, Lyrics.hasLyrics() ? 0xFF6FF0B0 : 0xFF7F8CA3);
		}
		int by = ly + 70;
		c.fill(lx, by, lx + lw, by + 3, 0x44FFFFFF);
		c.fill(lx, by, lx + (int) (lw * Lyrics.nowProgress()), by + 3, 0xFF000000 | Theme.accent);
		int cy = by + 12, bw = 52;
		btn(c, mx, my, lx, cy, bw, 20, "Prev", false, () -> cmd("prev", "Previous song"));
		btn(c, mx, my, lx + bw + 7, cy, bw, 20, Lyrics.nowPlaying() ? "Pause" : "Play", true, () -> cmd(Lyrics.nowPlaying() ? "pause" : "resume", Lyrics.nowPlaying() ? "Paused" : "Resumed"));
		btn(c, mx, my, lx + 2 * (bw + 7), cy, bw, 20, "Next", false, () -> cmd("skip", "Next song"));
		int vy = cy + 28;
		Ui.txt(c, "Volume", lx, vy + 5, 0xFFB8C6E8);
		for (int i = 0; i < 4; i++) { final int v = new int[] {0, 30, 60, 100}[i]; btn(c, mx, my, lx + 48 + i * 31, vy, 28, 16, v + "", false, () -> cmd("vol:" + v, "Volume " + v + "%")); }

		// Lyrics-Schalter
		int sy = vy + 26;
		boolean lyOn = ModConfig.isOn("lyrics");
		Ui.txt(c, "Lyrics in game", lx, sy + 2, 0xFFFFFFFF);
		Ui.toggle(c, lx + lw - 26, sy, lyOn);
		hits.add(new Hit(lx + lw - 26, sy, 24, 12, () -> ModConfig.set("lyrics", !ModConfig.isOn("lyrics"))));
		sy += 18;
		Ui.txt(c, "Song card", lx, sy + 2, 0xFFFFFFFF);
		Ui.toggle(c, lx + lw - 26, sy, ModConfig.lyricsCard);
		hits.add(new Hit(lx + lw - 26, sy, 24, 12, () -> { ModConfig.lyricsCard = !ModConfig.lyricsCard; ModConfig.save(); }));
		sy += 18;
		Ui.txt(c, "Lyrics size " + ModConfig.lyricsSize + "%", lx, sy + 4, 0xFFFFFFFF);
		btn(c, mx, my, lx + lw - 56, sy, 26, 14, "-", false, () -> { ModConfig.lyricsSize = Math.max(50, ModConfig.lyricsSize - 10); ModConfig.save(); });
		btn(c, mx, my, lx + lw - 28, sy, 26, 14, "+", false, () -> { ModConfig.lyricsSize = Math.min(200, ModConfig.lyricsSize + 10); ModConfig.save(); });

		// rechts: Playlists
		int rx = px + 12 + lw + 14, rw = px + pw - 12 - rx, top = py + 30, bottom = py + ph - 26;
		c.fill(rx, top, rx + rw, bottom, 0x66101A33);
		Ui.txt(c, "Playlists", rx + 6, top + 5, 0xFFFFFFFF);
		int listTop = top + 20, rowH = 20, visible = (bottom - listTop) / rowH;
		maxScroll = Math.max(0, (pls.size() - visible) * rowH);
		scroll = Math.max(0, Math.min(maxScroll, scroll));
		if (!connected || pls.isEmpty()) {
			String t = !connected ? "Spotify is not connected. Connect it in the launcher: Settings > Spotify." : listErr.isEmpty() ? "No playlists yet ..." : listErr;
			int yy = listTop + 4;
			for (var line : this.textRenderer.wrapLines(Ui.t(t), rw - 12)) { c.drawText(this.textRenderer, line, rx + 6, yy, 0xFFB8C6E8, true); yy += 10; }
		} else {
			c.enableScissor(rx, listTop, rx + rw, bottom);
			for (int i = 0; i < pls.size(); i++) {
				int yy = listTop + i * rowH - scroll;
				if (yy + rowH < listTop || yy > bottom) continue;
				Pl p = pls.get(i);
				boolean hv = Ui.in(mx, my, rx, yy, rw, rowH - 2) && my >= listTop && my < bottom;
				c.fill(rx + 2, yy, rx + rw - 2, yy + rowH - 2, hv ? 0xCC2A3A66 : 0x66202C4C);
				Ui.txt(c, Ui.trim(p.name(), rw - 60), rx + 8, yy + 6, 0xFFFFFFFF);
				if (p.total() >= 0) Ui.txt(c, p.total() + "", rx + rw - 8 - Ui.w(p.total() + ""), yy + 6, 0xFF7F8CA3);
				if (my >= listTop && my < bottom) hits.add(new Hit(rx + 2, yy, rw - 4, rowH - 2, () -> cmd("play:" + p.uri(), "Starting " + p.name())));
			}
			c.disableScissor();
		}
		// Statuszeile
		long now = System.currentTimeMillis();
		String st = now - localT < 4000 ? localMsg : (now - msgT < 6000 ? msg : "");
		if (st.isEmpty()) st = "Press " + keyName() + " or Esc to close.";
		Ui.txt(c, Ui.trim(st, pw - 24), px + 12, py + ph - 16, 0xFF8FA3C8);
		poll(mx, my);
	}

	private static String keyName() {
		try { return CloudyClient.spotKey.getBoundKeyLocalizedText().getString(); } catch (Throwable t) { return "the key"; }
	}

	private void poll(int mx, int my) {
		boolean down = false;
		try { down = org.lwjgl.glfw.GLFW.glfwGetMouseButton(MinecraftClient.getInstance().getWindow().getHandle(), 0) == 1; } catch (Throwable ignored) {}
		if (down && !wasDown) for (Hit h : hits) if (Ui.in(mx, my, h.x(), h.y(), h.w(), h.h())) { h.run().run(); break; }
		wasDown = down;
	}

	@Override
	public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
		try { if (CloudyClient.spotKey != null && CloudyClient.spotKey.matchesKey(keyCode, scanCode)) { close(); return true; } } catch (Throwable ignored) {}
		return super.keyPressed(keyCode, scanCode, modifiers);
	}

	@Override
	public boolean mouseScrolled(double mx, double my, double hx, double vy) {
		scroll = Math.max(0, Math.min(maxScroll, scroll - (int) Math.signum(vy) * 20));
		return true;
	}

	@Override
	public void close() {
		ModConfig.save();
		if (this.client != null) this.client.setScreen(parent);
	}
}
