package app.cloudy.client.opt;

import app.cloudy.client.Theme;
import app.cloudy.client.Ui;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

/**
 * Store im Spiel fuer Ressourcenpakete und Shader (Modrinth, kostenlos): stoebern, suchen, Kategorien, Vorschau mit Beschreibung und Bild,
 * Download mit Fortschritt, Installiert-Liste mit An/Aus und Entfernen. Eigene Datei im Paket "opt": scheitert sie an einer anderen Minecraft-Version, wird der Client ohne sie gebaut.
 */
public class StoreScreen extends Screen {
	/** Einstieg (per Reflection aus dem Kern aufgerufen). */
	public static void open(String type, Screen parent) { MinecraftClient.getInstance().setScreen(new StoreScreen(type, parent)); }

	private static final HttpClient HTTP = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).connectTimeout(java.time.Duration.ofSeconds(10)).build();
	private static final ExecutorService POOL = Executors.newFixedThreadPool(3, r -> { Thread t = new Thread(r, "cloudy-store"); t.setDaemon(true); return t; });
	private static final Map<String, Identifier> TEX = new HashMap<>();
	private static final Set<String> TEX_LOADING = new HashSet<>();

	private record Item(String id, String title, String author, String desc, String icon, String gallery, long downloads, List<String> cats) {}
	private record Hit(int x, int y, int w, int h, Runnable run) {}

	private final Screen parent;
	private final boolean shader;
	private final String type, gameVersion;
	private int tab = 0, cat = 0, sel = -1, scroll = 0, page = 0;
	private String query = "";
	private boolean focus;
	private volatile boolean loading, hasMore;
	private volatile String msg = "";
	private volatile List<Item> items = new ArrayList<>();
	private final Map<String, Float> progress = new HashMap<>();
	private final Set<String> busy = Collections.synchronizedSet(new HashSet<>());
	private final List<Hit> hits = new ArrayList<>();
	private List<String> installed = new ArrayList<>();
	private long installedAt = 0;
	private int px, py, pw, ph;

	private static final String[] RP_CATS = {"", "vanilla-like", "themed", "realistic", "simplistic", "gui", "combat", "decoration", "fantasy", "utility", "cursed"};
	private static final String[] SH_CATS = {"", "vanilla-like", "semi-realistic", "realistic", "cartoon", "fantasy", "atmosphere", "potato", "low", "medium", "high"};

	private StoreScreen(String type, Screen parent) {
		super(Text.literal(type.equals("shader") ? "Shader Store" : "Pack Store"));
		this.type = type; this.shader = type.equals("shader"); this.parent = parent;
		String v = "1.21.4";
		try { String g = MinecraftClient.getInstance().getGameVersion(); if (g != null && !g.isEmpty()) v = g; } catch (Throwable ignored) {}
		this.gameVersion = v;
	}

	private String[] cats() { return shader ? SH_CATS : RP_CATS; }
	private Path dir() { return FabricLoader.getInstance().getGameDir().resolve(shader ? "shaderpacks" : "resourcepacks"); }
	private Path registry() { return FabricLoader.getInstance().getConfigDir().resolve("cloudy-store.json"); }

	@Override protected void init() {
		pw = Math.min(this.width - 12, 580); ph = Math.min(this.height - 12, 310);
		px = (this.width - pw) / 2; py = (this.height - ph) / 2;
		if (items.isEmpty() && !loading) search(true);
	}

	// ---------- Netzwerk ----------
	private static String get(String url) throws Exception {
		HttpRequest r = HttpRequest.newBuilder(URI.create(url)).header("User-Agent", "CloudyClient/0.7 (minecraft launcher)").timeout(java.time.Duration.ofSeconds(20)).GET().build();
		HttpResponse<String> s = HTTP.send(r, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
		if (s.statusCode() != 200) throw new RuntimeException("HTTP " + s.statusCode());
		return s.body();
	}

	private static String q(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }

	private void search(boolean reset) {
		if (loading) return;
		loading = true; msg = "";
		if (reset) { page = 0; sel = -1; scroll = 0; items = new ArrayList<>(); }
		final int pg = page; final String qs = query, c = cats()[cat];
		POOL.execute(() -> {
			try {
				String facets = "[[\"project_type:" + type + "\"],[\"versions:" + gameVersion + "\"]" + (c.isEmpty() ? "" : ",[\"categories:" + c + "\"]") + "]";
				String url = "https://api.modrinth.com/v2/search?query=" + q(qs) + "&facets=" + q(facets) + "&limit=20&offset=" + (pg * 20) + "&index=" + (qs.isEmpty() ? "downloads" : "relevance");
				JsonArray hitsA = JsonParser.parseString(get(url)).getAsJsonObject().getAsJsonArray("hits");
				List<Item> out = new ArrayList<>(items);
				for (JsonElement e : hitsA) {
					JsonObject o = e.getAsJsonObject();
					List<String> cs = new ArrayList<>();
					if (o.has("display_categories")) for (JsonElement x : o.getAsJsonArray("display_categories")) cs.add(x.getAsString());
					else if (o.has("categories")) for (JsonElement x : o.getAsJsonArray("categories")) cs.add(x.getAsString());
					String gal = o.has("featured_gallery") && !o.get("featured_gallery").isJsonNull() ? o.get("featured_gallery").getAsString() : "";
					if (gal.isEmpty() && o.has("gallery") && o.getAsJsonArray("gallery").size() > 0) gal = o.getAsJsonArray("gallery").get(0).getAsString();
					out.add(new Item(o.get("project_id").getAsString(), o.get("title").getAsString(), o.get("author").getAsString(), o.get("description").getAsString(),
						o.has("icon_url") && !o.get("icon_url").isJsonNull() ? o.get("icon_url").getAsString() : "", gal, o.get("downloads").getAsLong(), cs));
				}
				items = out; hasMore = hitsA.size() >= 20;
				if (out.isEmpty()) msg = "Nothing found for Minecraft " + gameVersion + ".";
			} catch (Exception e) { msg = "Could not reach Modrinth (" + e.getMessage() + ")."; }
			loading = false;
		});
	}

	/** Bild laden (Icon oder Vorschau). Wird erst im Haupt-Thread als Textur registriert. */
	private Identifier tex(String url) {
		if (url == null || url.isEmpty()) return null;
		Identifier id = TEX.get(url);
		if (id != null) return id;
		synchronized (TEX_LOADING) { if (!TEX_LOADING.add(url)) return null; }
		POOL.execute(() -> {
			try {
				HttpRequest r = HttpRequest.newBuilder(URI.create(url)).header("User-Agent", "CloudyClient/0.7").timeout(java.time.Duration.ofSeconds(20)).GET().build();
				byte[] b = HTTP.send(r, HttpResponse.BodyHandlers.ofByteArray()).body();
				var img = javax.imageio.ImageIO.read(new ByteArrayInputStream(b));
				if (img == null) return;
				if (img.getWidth() > 512) { int nw = 512, nh = Math.max(1, img.getHeight() * 512 / img.getWidth()); var sc = new java.awt.image.BufferedImage(nw, nh, java.awt.image.BufferedImage.TYPE_INT_ARGB); var g = sc.createGraphics(); g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR); g.drawImage(img, 0, 0, nw, nh, null); g.dispose(); img = sc; }
				ByteArrayOutputStream bo = new ByteArrayOutputStream(); javax.imageio.ImageIO.write(img, "png", bo);
				final byte[] png = bo.toByteArray(); final int w = img.getWidth(), h = img.getHeight();
				MinecraftClient.getInstance().execute(() -> {
					try (InputStream in = new ByteArrayInputStream(png)) {
						NativeImage ni = NativeImage.read(in);
						Identifier i = Identifier.of("cloudy-client", "store/" + Integer.toHexString(url.hashCode()) + "_" + w + "x" + h);
						MinecraftClient.getInstance().getTextureManager().registerTexture(i, new NativeImageBackedTexture(ni));
						TEX.put(url, i);
						DIM.put(i, new int[]{w, h});
					} catch (Exception ignored) {}
				});
			} catch (Exception ignored) {}
		});
		return null;
	}
	private static final Map<Identifier, int[]> DIM = new HashMap<>();

	private void drawImg(DrawContext c, String url, int x, int y, int bw, int bh) {
		Identifier id = tex(url);
		c.fill(x, y, x + bw, y + bh, 0x66141E3A);
		if (id == null) return;
		int[] d = DIM.getOrDefault(id, new int[]{bw, bh});
		float s = Math.min(bw / (float) d[0], bh / (float) d[1]);
		int dw = Math.max(1, Math.round(d[0] * s)), dh = Math.max(1, Math.round(d[1] * s));
		c.drawTexture(net.minecraft.client.render.RenderLayer::getGuiTextured, id, x + (bw - dw) / 2, y + (bh - dh) / 2, 0f, 0f, dw, dh, dw, dh);
	}

	// ---------- Installation ----------
	private JsonObject reg() { try { return JsonParser.parseString(Files.readString(registry())).getAsJsonObject(); } catch (Exception e) { return new JsonObject(); } }
	private void saveReg(JsonObject o) { try { Files.writeString(registry(), o.toString()); } catch (Exception ignored) {} }
	private String regKey(String id) { return type + ":" + id; }
	private boolean isInstalled(Item it) {
		JsonObject r = reg();
		if (!r.has(regKey(it.id))) return false;
		return Files.exists(dir().resolve(r.get(regKey(it.id)).getAsString()));
	}

	private void install(Item it) {
		if (busy.contains(it.id) || isInstalled(it)) { msg = it.title + " is already installed."; return; }
		busy.add(it.id); progress.put(it.id, 0f); msg = "";
		POOL.execute(() -> {
			Path tmp = null;
			try {
				JsonArray vs = JsonParser.parseString(get("https://api.modrinth.com/v2/project/" + it.id + "/version?game_versions=" + q("[\"" + gameVersion + "\"]"))).getAsJsonArray();
				if (vs.size() == 0) throw new RuntimeException("no version for Minecraft " + gameVersion);
				JsonObject ver = vs.get(0).getAsJsonObject();
				for (JsonElement e : vs) if ("release".equals(e.getAsJsonObject().get("version_type").getAsString())) { ver = e.getAsJsonObject(); break; }
				JsonObject file = null;
				for (JsonElement e : ver.getAsJsonArray("files")) { JsonObject f = e.getAsJsonObject(); if (file == null || (f.has("primary") && f.get("primary").getAsBoolean())) file = f; }
				if (file == null) throw new RuntimeException("no file");
				String name = file.get("filename").getAsString().replaceAll("[^A-Za-z0-9._ +()-]", "_");
				Files.createDirectories(dir());
				Path dst = dir().resolve(name);
				if (Files.exists(dst)) throw new RuntimeException("file already exists");
				tmp = dir().resolve(name + ".part");
				HttpRequest r = HttpRequest.newBuilder(URI.create(file.get("url").getAsString())).header("User-Agent", "CloudyClient/0.7").GET().build();
				HttpResponse<InputStream> resp = HTTP.send(r, HttpResponse.BodyHandlers.ofInputStream());
				if (resp.statusCode() != 200) throw new RuntimeException("HTTP " + resp.statusCode());
				long total = file.has("size") ? file.get("size").getAsLong() : resp.headers().firstValueAsLong("content-length").orElse(0);
				try (InputStream in = resp.body(); var out = Files.newOutputStream(tmp)) {
					byte[] buf = new byte[32768]; long got = 0; int n;
					while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); got += n; if (total > 0) progress.put(it.id, Math.min(0.99f, got / (float) total)); }
				}
				Files.move(tmp, dst, StandardCopyOption.REPLACE_EXISTING);
				JsonObject rg = reg(); rg.addProperty(regKey(it.id), name); saveReg(rg);
				msg = it.title + " installed." + (shader && !FabricLoader.getInstance().isModLoaded("iris") ? " Shaders need the Iris mod." : "");
				installedAt = 0;
			} catch (Exception e) {
				msg = "Download failed: " + e.getMessage();
				try { if (tmp != null) Files.deleteIfExists(tmp); } catch (Exception ignored) {}
			}
			busy.remove(it.id); progress.remove(it.id);
		});
	}

	private void refreshInstalled() {
		if (System.currentTimeMillis() - installedAt < 1500) return;
		installedAt = System.currentTimeMillis();
		List<String> l = new ArrayList<>();
		try (Stream<Path> s = Files.exists(dir()) ? Files.list(dir()) : Stream.<Path>empty()) {
			s.forEach(p -> { String n = p.getFileName().toString(); if (n.endsWith(".part") || n.startsWith(".")) return; if (Files.isDirectory(p) || n.toLowerCase().endsWith(".zip")) l.add(n); });
		} catch (Exception ignored) {}
		Collections.sort(l, String.CASE_INSENSITIVE_ORDER);
		installed = l;
	}

	private Path irisCfg() { return FabricLoader.getInstance().getConfigDir().resolve("iris.properties"); }
	private java.util.Properties irisProps() { var p = new java.util.Properties(); try (var in = Files.newInputStream(irisCfg())) { p.load(in); } catch (Exception ignored) {} return p; }

	private boolean enabled(String name) {
		try {
			if (shader) { var p = irisProps(); return name.equals(p.getProperty("shaderPack")) && !"false".equals(p.getProperty("enableShaders", "true")); }
			return MinecraftClient.getInstance().getResourcePackManager().getEnabledIds().contains("file/" + name);
		} catch (Throwable t) { return false; }
	}

	private void toggle(String name) {
		try {
			boolean on = !enabled(name);
			if (shader) {
				var p = irisProps();
				if (on) { p.setProperty("shaderPack", name); p.setProperty("enableShaders", "true"); } else p.setProperty("enableShaders", "false");
				try (var out = Files.newOutputStream(irisCfg())) { p.store(out, "Updated by Cloudy"); }
				msg = FabricLoader.getInstance().isModLoaded("iris") ? (on ? "Shader selected. Open Video Settings > Shader Packs or restart to apply it." : "Shaders disabled. Restart to apply.") : "Iris is not installed. Install shaders from the launcher to get Iris.";
			} else {
				var mc = MinecraftClient.getInstance(); var mgr = mc.getResourcePackManager();
				mgr.scanPacks();
				if (on) mgr.enable("file/" + name); else mgr.disable("file/" + name);
				mc.options.refreshResourcePacks(mgr);
				msg = on ? "Enabled " + name : "Disabled " + name;
			}
		} catch (Throwable t) { msg = "Could not change the pack: " + t.getMessage(); }
	}

	private void remove(String name) {
		try {
			if (enabled(name)) toggle(name);
			Path p = dir().resolve(name);
			if (Files.isDirectory(p)) try (Stream<Path> w = Files.walk(p)) { w.sorted(java.util.Comparator.reverseOrder()).forEach(x -> x.toFile().delete()); } else Files.deleteIfExists(p);
			JsonObject rg = reg(); List<String> del = new ArrayList<>();
			for (var e : rg.entrySet()) if (e.getKey().startsWith(type + ":") && e.getValue().getAsString().equals(name)) del.add(e.getKey());
			del.forEach(rg::remove); saveReg(rg);
			msg = "Removed " + name; installedAt = 0;
		} catch (Exception e) { msg = "Could not remove: " + e.getMessage(); }
	}

	// ---------- Zeichnen ----------
	@Override public void renderBackground(DrawContext c, int mx, int my, float d) {
		if (MinecraftClient.getInstance().world == null) Ui.scene(c, this.width, this.height);
		c.fill(0, 0, this.width, this.height, 0x99050A16);
	}

	private void btn(DrawContext c, int mx, int my, int x, int y, int w, int h, String label, boolean primary, Runnable run) {
		boolean hv = Ui.in(mx, my, x, y, w, h);
		c.fill(x, y, x + w, y + h, primary ? (hv ? Ui.mix(Theme.accent, 0xFFFFFFFF, 0.2f) : Theme.accent) : hv ? 0xAA3A4A78 : 0x88202C4C);
		Ui.ctr(c, label, x + w / 2, y + (h - 8) / 2, primary ? 0xFF0B1226 : 0xFFFFFFFF);
		hits.add(new Hit(x, y, w, h, run));
	}

	private String catName(String s) { return s.isEmpty() ? "All" : Character.toUpperCase(s.charAt(0)) + s.substring(1).replace('-', ' '); }
	private static String fmt(long n) { return n >= 1_000_000 ? String.format("%.1fM", n / 1e6) : n >= 1000 ? (n / 1000) + "K" : String.valueOf(n); }

	@Override public void render(DrawContext c, int mx, int my, float delta) {
		super.render(c, mx, my, delta);
		Theme.load(); hits.clear();
		int x = px, y = py, w = pw, h = ph;
		Ui.glass(c, x, y, w, h);
		c.fill(x, y, x + w, y + 24, 0xAA0B1226); c.fill(x, y + 23, x + w, y + 24, Theme.accent);
		Ui.txt(c, "CLOUDY", x + 10, y + 8, Theme.accent);
		Ui.txt(c, shader ? "SHADER STORE" : "PACK STORE", x + 10 + Ui.w("CLOUDY") + 5, y + 8, 0xFFFFFFFF);
		Ui.txt(c, "FREE", x + 10 + Ui.w("CLOUDY SHADER STORE") + 12, y + 8, 0xFF7FE3A8);
		btn(c, mx, my, x + w - 90, y + 3, 40, 18, "X", false, this::close);
		btn(c, mx, my, x + w - 186, y + 3, 90, 18, tab == 0 ? "INSTALLED" : "STORE", false, () -> { tab = 1 - tab; scroll = 0; installedAt = 0; });
		int top = y + 30;
		if (tab == 0) store(c, mx, my, x, top, w, h - 30 - 20); else installedTab(c, mx, my, x, top, w, h - 30 - 20);
		Ui.txt(c, Ui.trim(msg, w - 20), x + 10, y + h - 14, msg.startsWith("Could") || msg.startsWith("Download failed") || msg.startsWith("Nothing") ? 0xFFFF8A8A : 0xFFA9D4FF);
	}

	private void store(DrawContext c, int mx, int my, int x, int y, int w, int h) {
		// Kategorien + Suche
		int cx = x + 8;
		String[] cs = cats();
		for (int i = 0; i < cs.length; i++) {
			String n = catName(cs[i]); int cw = Ui.w(n) + 10;
			if (cx + cw > x + w - 150) break;
			final int ii = i; boolean on = cat == i;
			btn(c, mx, my, cx, y, cw, 16, n, on, () -> { cat = ii; search(true); });
			cx += cw + 3;
		}
		int sx = x + w - 142, sw = 134;
		c.fill(sx, y, sx + sw, y + 16, focus ? 0xAA25335C : 0x88202C4C); c.fill(sx, y + 15, sx + sw, y + 16, focus ? Theme.accent : 0x33FFFFFF);
		Ui.txt(c, query.isEmpty() && !focus ? "Search..." : Ui.trim(query, sw - 10) + (focus && System.currentTimeMillis() / 500 % 2 == 0 ? "_" : ""), sx + 5, y + 4, query.isEmpty() ? 0xFF7F8CB0 : 0xFFFFFFFF);
		hits.add(new Hit(sx, y, sw, 16, () -> focus = true));
		int ly = y + 22, lh = h - 22, lw = (int) ((w - 24) * 0.54f), rw = w - 24 - lw - 6, lx = x + 8, rx = lx + lw + 6;
		List<Item> it = items;
		int rh = 30, total = it.size() * rh + (hasMore ? 22 : 0);
		int maxS = Math.max(0, total - lh); scroll = Math.max(0, Math.min(scroll, maxS));
		c.enableScissor(lx, ly, lx + lw, ly + lh);
		for (int i = 0; i < it.size(); i++) {
			int ry = ly + i * rh - scroll; if (ry + rh < ly || ry > ly + lh) continue;
			Item m = it.get(i); boolean hv = Ui.in(mx, my, lx, ry, lw, rh - 2) && my >= ly && my < ly + lh, s = i == sel;
			c.fill(lx, ry, lx + lw, ry + rh - 2, s ? Ui.mix(0xFF1B2A55, Theme.accent, 0.5f) : hv ? 0x88283760 : 0x66141E3A);
			drawImg(c, m.icon, lx + 3, ry + 3, 24, 24);
			Ui.txt(c, Ui.trim(m.title, lw - 90), lx + 32, ry + 5, 0xFFFFFFFF);
			Ui.txt(c, Ui.trim(m.author + " | " + fmt(m.downloads), lw - 90), lx + 32, ry + 16, 0xFF8794B8);
			boolean got = isInstalledCached(m);
			Ui.txt(c, busy.contains(m.id) ? (int) (progress.getOrDefault(m.id, 0f) * 100) + "%" : got ? "OK" : "", lx + lw - 30, ry + 10, got ? 0xFF7FE3A8 : Theme.accent);
			final int ii = i; if (my >= ly && my < ly + lh) hits.add(new Hit(lx, ry, lw, rh - 2, () -> sel = ii));
		}
		if (hasMore) { int ry = ly + it.size() * rh - scroll; if (ry < ly + lh && ry + 20 > ly) btn(c, mx, my, lx, ry, lw, 20, loading ? "LOADING..." : "LOAD MORE", false, () -> { page++; search(false); }); }
		c.disableScissor();
		if (loading && it.isEmpty()) Ui.ctr(c, "Loading...", lx + lw / 2, ly + 30, 0xFF8794B8);
		// Vorschau
		c.fill(rx, ly, rx + rw, ly + lh, 0x55070D1C);
		if (sel >= 0 && sel < it.size()) {
			Item m = it.get(sel);
			int ih = Math.min(86, lh / 2 - 6);
			drawImg(c, m.gallery.isEmpty() ? m.icon : m.gallery, rx + 4, ly + 4, rw - 8, ih);
			int ty = ly + ih + 10;
			Ui.txt(c, Ui.trim(m.title, rw - 10), rx + 6, ty, 0xFFFFFFFF); ty += 11;
			Ui.txt(c, "by " + m.author + " | " + fmt(m.downloads) + " downloads", rx + 6, ty, 0xFF8794B8); ty += 11;
			String perf = null; for (String k : m.cats) if (k.equals("potato") || k.equals("low") || k.equals("medium") || k.equals("high") || k.equals("screenshot")) perf = k;
			if (shader) { Ui.txt(c, "Performance: " + (perf == null ? "unknown" : catName(perf)), rx + 6, ty, 0xFFFFD34D); ty += 11; }
			Ui.txt(c, "Minecraft " + gameVersion + (shader ? " | needs Iris" : ""), rx + 6, ty, 0xFF7FE3A8); ty += 13;
			for (String ln : wrap(m.desc, rw - 12)) { if (ty > ly + lh - 30) break; Ui.txt(c, ln, rx + 6, ty, 0xFFC8D4F0); ty += 10; }
			int by = ly + lh - 22;
			if (busy.contains(m.id)) {
				float p = progress.getOrDefault(m.id, 0f);
				c.fill(rx + 6, by, rx + rw - 6, by + 18, 0xFF39425F); c.fill(rx + 6, by, rx + 6 + (int) ((rw - 12) * p), by + 18, Theme.accent);
				Ui.ctr(c, "Downloading " + (int) (p * 100) + "%", rx + rw / 2, by + 5, 0xFFFFFFFF);
			} else if (isInstalledCached(m)) btn(c, mx, my, rx + 6, by, rw - 12, 18, "INSTALLED  (see Installed tab)", false, () -> { tab = 1; scroll = 0; installedAt = 0; });
			else btn(c, mx, my, rx + 6, by, rw - 12, 18, "GET  (free)", true, () -> install(m));
		} else Ui.ctr(c, "Pick a pack to see details", rx + rw / 2, ly + lh / 2 - 4, 0xFF8794B8);
	}

	private final Map<String, Boolean> instCache = new HashMap<>(); private long instCacheAt;
	private boolean isInstalledCached(Item m) {
		if (System.currentTimeMillis() - instCacheAt > 1500) { instCache.clear(); instCacheAt = System.currentTimeMillis(); }
		return instCache.computeIfAbsent(m.id, k -> isInstalled(m));
	}

	private List<String> wrap(String s, int max) {
		List<String> out = new ArrayList<>(); StringBuilder cur = new StringBuilder();
		for (String wd : s.split("\\s+")) {
			if (Ui.w(cur + (cur.length() > 0 ? " " : "") + wd) > max && cur.length() > 0) { out.add(cur.toString()); cur = new StringBuilder(); }
			if (cur.length() > 0) cur.append(' '); cur.append(wd);
		}
		if (cur.length() > 0) out.add(cur.toString());
		return out;
	}

	private void installedTab(DrawContext c, int mx, int my, int x, int y, int w, int h) {
		refreshInstalled();
		int lx = x + 8, lw = w - 16, rh = 24;
		Ui.txt(c, (shader ? "Installed shaders" : "Installed resource packs") + " (" + installed.size() + ")", lx, y + 2, 0xFF8794B8);
		int ly = y + 16, lh = h - 16;
		int maxS = Math.max(0, installed.size() * rh - lh); scroll = Math.max(0, Math.min(scroll, maxS));
		c.enableScissor(lx, ly, lx + lw, ly + lh);
		for (int i = 0; i < installed.size(); i++) {
			int ry = ly + i * rh - scroll; if (ry + rh < ly || ry > ly + lh) continue;
			String n = installed.get(i); boolean on = enabled(n);
			c.fill(lx, ry, lx + lw, ry + rh - 2, 0x66141E3A);
			c.fill(lx, ry, lx + 2, ry + rh - 2, on ? Theme.accent : 0xFF39425F);
			Ui.txt(c, Ui.trim(n, lw - 150), lx + 8, ry + 8, on ? 0xFFFFFFFF : 0xFFA9B6D6);
			if (my >= ly && my < ly + lh) {
				btn(c, mx, my, lx + lw - 140, ry + 3, 64, 16, on ? "ON" : "OFF", on, () -> toggle(n));
				btn(c, mx, my, lx + lw - 72, ry + 3, 64, 16, "REMOVE", false, () -> remove(n));
			}
		}
		c.disableScissor();
		if (installed.isEmpty()) Ui.ctr(c, "Nothing installed yet. Open the STORE tab.", x + w / 2, ly + 30, 0xFF8794B8);
	}

	// ---------- Eingabe ----------
	@Override public boolean mouseClicked(double mx, double my, int button) {
		if (button != 0) return super.mouseClicked(mx, my, button);
		boolean f = focus; focus = false;
		for (int i = hits.size() - 1; i >= 0; i--) { Hit h = hits.get(i); if (Ui.in((int) mx, (int) my, h.x(), h.y(), h.w(), h.h())) { h.run().run(); return true; } }
		return super.mouseClicked(mx, my, button);
	}

	@Override public boolean charTyped(char chr, int mods) {
		if (focus && chr >= 32 && query.length() < 30) { query += chr; return true; }
		return super.charTyped(chr, mods);
	}

	@Override public boolean keyPressed(int key, int scan, int mods) {
		if (focus) {
			if (key == 259 && !query.isEmpty()) { query = query.substring(0, query.length() - 1); return true; }
			if (key == 257) { focus = false; search(true); return true; }
			if (key == 256) { focus = false; return true; }
			return true;
		}
		return super.keyPressed(key, scan, mods);
	}

	@Override public boolean mouseScrolled(double mx, double my, double hx, double vy) { scroll = Math.max(0, scroll - (int) Math.signum(vy) * 30); return true; }

	@Override public void close() { if (this.client != null) this.client.setScreen(parent); }
}
