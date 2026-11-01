package app.cloudy.client;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.fabric.api.client.rendering.v1.LivingEntityFeatureRendererRegistrationCallback;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.entity.PlayerEntityRenderer;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.CRC32;
import java.util.zip.Deflater;

/**
 * Cosmetics aus dem Cloudy-Shop (Hut, Flügel, Schild). Die ausgewählten Items stehen in der Datei -Dcloudy.cosmetics=…
 * Texturen werden im Code gezeichnet (kein AWT), Modelle aus einfachen Quadern gebaut. Umhänge laufen über CapeMixin.
 */
public final class Cosmetics {
	public static String cape, hat, wings, shield;
	public static final List<String> owned = new ArrayList<>();
	public static ModelPart model;
	public static final Identifier TEX = Identifier.of("cloudy-client", "cosmetics");
	private static boolean ready;

	public static boolean any() { return hat != null || wings != null || shield != null || ZZ4.handles(cape); }

	/** Liest Auswahl und Besitz, hängt den Renderer an alle Spieler-Renderer (gezeichnet wird nur für dich) und fügt den Cosmetics-Knopf ein. */
	public static void init() {
		try {
			String p = System.getProperty("cloudy.cosmetics", "");
			if (p.isEmpty()) return;
			JsonObject root = JsonParser.parseString(Files.readString(Path.of(p))).getAsJsonObject();
			JsonObject eq = root.has("equip") ? root.getAsJsonObject("equip") : new JsonObject();
			cape = str(eq, "cape");
			hat = str(eq, "hat");
			wings = str(eq, "wings");
			shield = str(eq, "shield");
			if (root.has("owned")) for (var e : root.getAsJsonArray("owned")) owned.add(e.getAsString());
			LivingEntityFeatureRendererRegistrationCallback.EVENT.register((entityType, entityRenderer, helper, context) -> {
				if (entityRenderer instanceof PlayerEntityRenderer pr) helper.register(new CosmeticFeature(pr));
			});
			ScreenEvents.AFTER_INIT.register((client, screen, w, h) -> {
				try { ScreenEvents.afterRender(screen).register((s, ctx, mx, my, dt) -> { try { MouseFx.render(ctx, mx, my); } catch (Throwable ignored) {} }); } catch (Throwable ignored) {}
				if (client.world != null && !(screen instanceof net.minecraft.client.gui.screen.ChatScreen)) {
					try { ScreenEvents.afterRender(screen).register((s, ctx, mx, my, dt) -> { try { Lyrics.pauseRender(ctx); } catch (Throwable ignored) {} }); } catch (Throwable ignored) {}
				}
				if (screen instanceof GameMenuScreen || screen instanceof TitleScreen)
				{
					Screens.getButtons(screen).add(ButtonWidget.builder(Text.literal("Cosmetics"), b -> client.setScreen(new CosmeticsScreen(screen))).dimensions(w - 106, 6, 100, 20).build());
					Screens.getButtons(screen).add(ButtonWidget.builder(Text.literal("Cloudy Mods"), b -> client.setScreen(new CloudyModsScreen(screen))).dimensions(w - 106, 30, 100, 20).build());
				}
			});
			CloudyClient.LOG.info("Cosmetics aktiv: hat={}, wings={}, shield={}, besitzt={}", hat, wings, shield, owned.size());
		} catch (Exception e) {
			CloudyClient.LOG.warn("Cosmetics konnten nicht geladen werden", e);
		}
	}

	public static String get(String cat) {
		return switch (cat) { case "hat" -> hat; case "wings" -> wings; case "shield" -> shield; default -> cape; };
	}

	/** Setzt ein Item (oder null = ablegen) und speichert die Auswahl, damit der Launcher sie übernimmt. */
	public static void set(String cat, String id) {
		switch (cat) { case "hat" -> hat = id; case "wings" -> wings = id; case "shield" -> shield = id; default -> cape = id; }
		try {
			String p = System.getProperty("cloudy.cosmetics", "");
			if (p.isEmpty()) return;
			JsonObject root = JsonParser.parseString(Files.readString(Path.of(p))).getAsJsonObject(), eq = new JsonObject();
			if (cape != null) eq.addProperty("cape", cape);
			if (hat != null) eq.addProperty("hat", hat);
			if (wings != null) eq.addProperty("wings", wings);
			if (shield != null) eq.addProperty("shield", shield);
			root.add("equip", eq);
			Files.writeString(Path.of(p), root.toString());
		} catch (Exception e) {
			CloudyClient.LOG.warn("Cosmetics konnten nicht gespeichert werden", e);
		}
	}


	public static final String[] ALL = {"cape-cloud", "cape-aurora", "cape-sunset", "cape-galaxy", "cape-fire", "cape-ocean", "cape-sakura",
		"hat-top", "hat-gold", "hat-wizard", "hat-santa", "hat-witch", "hat-crown", "hat-halo", "hat-party", "hat-frost", "hat-zzv", "hat-zzb", "hat-zsh", "hat-zif",
		"wings-angel", "wings-neon", "wings-fire", "wings-bat", "wings-crystal", "wings-shadow", "shield-cloud", "shield-sun", "shield-dragon", "shield-forest", "shield-ice",
		"cape-nebula", "cape-emerald", "cape-royal",
		"cape-zz4", "cape-zz4m", "cape-zz3", "cape-zz3s", "cape-zz5", "cape-zk5", "wings-zz4", "wings-zz4m", "wings-zz3", "wings-zz3s", "wings-zz5", "wings-zk5",
		"shield-zz4", "shield-zz4m", "shield-zz3", "shield-zz3s", "shield-zz5", "cape-yy", "shield-yy",
		"wings-zv", "wings-zs", "wings-zf", "wings-zb", "cape-zbs", "cape-ghg"};

	/** Umhaenge aus normalen 64x32-Texturen (in den Mod gepackt): fuer dich und fuer andere Cloudy-Spieler. */
	public static boolean isTexCape(String id) { return false; } // zbs/ghg laufen jetzt ueber das Z4-Umhangmodell (ZZ4)
	private static final java.util.Map<String, Identifier> CAPETEX = new java.util.HashMap<>();
	public static Identifier capeTex(String id) {
		if (!isTexCape(id)) return null;
		Identifier have = CAPETEX.get(id);
		if (have != null) return have;
		try (java.io.InputStream in = Cosmetics.class.getResourceAsStream("/cloudy-cos/cape_" + id.substring(5) + ".png")) {
			if (in == null) return null;
			Identifier i = Identifier.of("cloudy-client", "texcape_" + id.substring(5));
			MinecraftClient.getInstance().getTextureManager().registerTexture(i, new NativeImageBackedTexture(NativeImage.read(in)));
			CAPETEX.put(id, i);
			return i;
		} catch (Exception e) { CloudyClient.LOG.warn("Umhang-Textur fehlt: " + id, e); return null; }
	}

	/** Hauptfarben (0 = hell, 1 = dunkel/Akzent) fuer Icons und Vorschau. */
	public static int color(String id, int n) {
		int i = idx(id);
		if (i >= 0) return COL[i][Math.min(n, COL[i].length - 1)];
		return switch (id) {
			case "cape-cloud" -> n == 0 ? 0xFFEAF3FF : 0xFF9BD2FF;
			case "cape-aurora" -> n == 0 ? 0xFF35E0A1 : 0xFF6A5CFF;
			case "cape-sunset" -> n == 0 ? 0xFFFFB347 : 0xFFD6336C;
			case "cape-galaxy" -> n == 0 ? 0xFF6A3DD6 : 0xFF14081F;
			case "cape-fire" -> n == 0 ? 0xFFFFD23A : 0xFFE23B1A;
			case "cape-ocean" -> n == 0 ? 0xFF5EE7FF : 0xFF0A4FA3;
			case "cape-sakura" -> n == 0 ? 0xFFFFD1E3 : 0xFFE0577F;
			case "cape-nebula" -> n == 0 ? 0xFFB06BFF : 0xFF2A0B6B;
			case "cape-emerald" -> n == 0 ? 0xFF6DFFB0 : 0xFF0B6B45;
			case "cape-royal" -> n == 0 ? 0xFFFFD24A : 0xFF7A1FB3;
			case "cape-zz4", "wings-zz4", "shield-zz4" -> n == 0 ? 0xFFC04BFF : n == 1 ? 0xFF4B0A8A : 0xFFE8B0FF;
			case "cape-zz4m", "wings-zz4m", "shield-zz4m" -> n == 0 ? 0xFFE8E8F0 : n == 1 ? 0xFF3A3A48 : 0xFFFFFFFF;
			case "cape-zz3", "wings-zz3", "shield-zz3" -> n == 0 ? 0xFFFF3B2F : n == 1 ? 0xFF4A0A0A : 0xFFFF9A8A;
			case "cape-zz3s", "wings-zz3s", "shield-zz3s" -> n == 0 ? 0xFFFFC21A : n == 1 ? 0xFF8A4A00 : 0xFFFFF0A0;
			case "cape-zz5", "wings-zz5", "shield-zz5" -> n == 0 ? 0xFFE02A2A : n == 1 ? 0xFF3A0808 : 0xFFE8B04A;
			case "cape-yy", "shield-yy" -> n == 0 ? 0xFFF2F2F2 : n == 1 ? 0xFF14141A : 0xFFB8B8C4;
			case "cape-zk5", "wings-zk5" -> n == 0 ? 0xFFFFFFFF : n == 1 ? 0xFF8A8A96 : 0xFFE8E8F0;
			default -> n == 0 ? 0xFFFFFFFF : 0xFF9BD2FF;
		};
	}

	public static String catOf(String id) {
		int i = id.indexOf('-');
		return i > 0 ? id.substring(0, i) : null;
	}

	public static String nameOf(String id) {
		return switch (id) {
			case "hat-top" -> "Top Hat";
			case "hat-wizard" -> "Wizard Hat";
			case "wings-angel" -> "Angel Wings";
			case "wings-neon" -> "Neon Wings";
			case "shield-cloud" -> "Cloud Shield";
			case "shield-sun" -> "Sun Shield";
			case "cape-cloud" -> "Cloud Cape";
			case "cape-aurora" -> "Aurora Cape";
			case "cape-sunset" -> "Sunset Cape";
			case "cape-galaxy" -> "Galaxy Cape";
			case "cape-fire" -> "Fire Cape";
			case "hat-gold" -> "Golden Top Hat";
			case "hat-santa" -> "Santa Hat";
			case "hat-witch" -> "Witch Hat";
			case "hat-crown" -> "Crown";
			case "hat-halo" -> "Halo";
			case "wings-fire" -> "Fire Wings";
			case "wings-bat" -> "Bat Wings";
			case "shield-dragon" -> "Dragon Shield";
			case "shield-forest" -> "Forest Shield";
			case "cape-ocean" -> "Ocean Cape";
			case "cape-sakura" -> "Sakura Cape";
			case "wings-crystal" -> "Crystal Wings";
			case "wings-shadow" -> "Shadow Wings";
			case "shield-ice" -> "Ice Shield";
			case "cape-nebula" -> "Nebula Cape";
			case "cape-emerald" -> "Emerald Cape";
			case "cape-royal" -> "Royal Cape";
			case "cape-zz4" -> "ZZ4 Cape";
			case "cape-zz4m" -> "ZZ4 15M Cape";
			case "cape-zz3" -> "ZZ3 Cape";
			case "cape-zz3s" -> "ZZ3 1M Cape";
			case "cape-zz5" -> "ZZ5 2M Cape";
			case "cape-zk5" -> "500K Cape";
			case "cape-yy" -> "Yin Yang Cape";
			case "shield-yy" -> "Yin Yang Shield";
			case "wings-zz4" -> "ZZ4 Wings";
			case "wings-zz4m" -> "ZZ4 15M Wings";
			case "wings-zz3" -> "ZZ3 Wings";
			case "wings-zz3s" -> "ZZ3 1M Wings";
			case "wings-zz5" -> "ZZ5 2M Wings";
			case "wings-zk5" -> "500K Wings";
			case "shield-zz4" -> "ZZ4 Shield";
			case "shield-zz4m" -> "ZZ4 15M Shield";
			case "shield-zz3" -> "ZZ3 Shield";
			case "shield-zz3s" -> "ZZ3 1M Shield";
			case "shield-zz5" -> "ZZ5 2M Shield";
			case "hat-party" -> "Party Hat";
			case "hat-frost" -> "Frost Hat";
			case "hat-zzv" -> "Zigzag Hat Violet";
			case "hat-zzb" -> "Zigzag Top Hat Blue";
			case "hat-zsh" -> "Shadow Hat";
			case "hat-zif" -> "Ice Feather Hat";
			default -> id;
		};
	}

	private static String str(JsonObject o, String k) {
		return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : null;
	}

	public static boolean isSelf(SkinTextures st) {
		MinecraftClient mc = MinecraftClient.getInstance();
		return mc.player != null && st != null && mc.player.getSkinTextures().texture().equals(st.texture());
	}

	// Jedes Item bekommt eine Zelle (64x48) im 256x256-Atlas. Form (Hut/Flügel/Schild) und Farben stehen in der Tabelle.
	private static final String[] IDS = {"hat-top", "hat-gold", "hat-wizard", "hat-santa", "hat-witch", "hat-crown", "hat-halo",
		"wings-angel", "wings-neon", "wings-fire", "wings-bat", "wings-crystal", "wings-shadow", "shield-cloud", "shield-sun", "shield-dragon", "shield-forest", "shield-ice", "hat-party", "hat-frost", "hat-zzv", "hat-zzb", "hat-zsh", "hat-zif"};
	private static final int[][] COL = {
		{0xFF2A2A3C, 0xFF1C1C28, 0xFF6DB8FF, 0xFF2F7FE0}, {0xFFF4C430, 0xFFB8860B, 0xFFE23B3B, 0xFF9E1B1B},
		{0xFF8B5CF6, 0xFF5B34C4, 0xFFA98BFF, 0xFF7C5CE0, 0xFFFFD24A}, {0xFFFFFFFF, 0xFFD8E4F0, 0xFFE0262E, 0xFFA3121A, 0xFFFFFFFF},
		{0xFF2B2B38, 0xFF15151D, 0xFF3A3A4A, 0xFF22222C, 0xFFFF8A1F}, {0xFFFFD24A, 0xFFE8A317}, {0xFFFFF7B0, 0xFFFFD24A},
		{0xFFFFFFFF, 0xFFBCD9FF, 0xFFEAF3FF}, {0xFF00E5FF, 0xFFFF3DD0, 0xFFE8FFFF}, {0xFFFFD23A, 0xFFE23B1A, 0xFFFFF1B0}, {0xFF4A2A6A, 0xFF14081F, 0xFFB07CFF},
		{0xFFB9F6FF, 0xFF6A7BFF, 0xFFFFFFFF}, {0xFF3B2A55, 0xFF07050D, 0xFFB07CFF},
		{0xFF9BD2FF, 0xFF2F7FE0}, {0xFFFFD24A, 0xFFE8741A}, {0xFFE23B3B, 0xFF3A0A0A, 0xFFFFD24A}, {0xFF5BD98A, 0xFF1B6A45, 0xFFFFFFFF}, {0xFFD9F6FF, 0xFF4AA8D8, 0xFFFFFFFF},
		{0xFFFF4FA3, 0xFFC02275, 0xFFFFE14A, 0xFFE0B800, 0xFFFFFFFF}, {0xFF8FE3FF, 0xFF3FA9D6, 0xFFFFFFFF, 0xFFD8F1FA, 0xFFFFFFFF},
		{0xFF6D28D9, 0xFF3B1A8A, 0xFFB26BFF, 0xFF7C3AED, 0xFFE9D5FF}, {0xFF1D4ED8, 0xFF0B2A78, 0xFF60A5FA, 0xFF2563EB}, {0xFF1B1030, 0xFF07050D, 0xFF3B2A55, 0xFF15101F, 0xFFB07CFF}, {0xFFBFEAFF, 0xFF8FD3F0, 0xFFEFFBFF, 0xFFA9E3F7, 0xFFFFFFFF}};
	private static final int SZ = 512; // Atlas: 4 Spalten à 64 px, genug Zeilen für alle Items

	private static int idx(String id) { for (int i = 0; i < IDS.length; i++) if (IDS[i].equals(id)) return i; return -1; }
	private static boolean isTop(String id) { return id.equals("hat-top") || id.equals("hat-gold") || id.equals("hat-zzb"); }
	private static boolean isWiz(String id) { return id.equals("hat-wizard") || id.equals("hat-santa") || id.equals("hat-witch") || id.equals("hat-party") || id.equals("hat-frost") || id.equals("hat-zzv") || id.equals("hat-zsh") || id.equals("hat-zif"); }

	/** Baut Textur und Modell beim ersten Zeichnen. */
	public static boolean ensure() {
		if (ready) return model != null;
		ready = true;
		try {
			int[] px = new int[SZ * SZ];
			ModelData md = new ModelData();
			ModelPartData r = md.getRoot();
			for (int i = 0; i < IDS.length; i++) {
				String id = IDS[i]; int u = (i % 4) * 64, v = (i / 4) * 48; int[] c = COL[i];
				if (isTop(id)) {
					box(r, id + ".brim", u, v, -5, -9.5f, -5, 10, 1, 10); box(r, id + ".tube", u, v + 12, -3.5f, -16.5f, -3.5f, 7, 7, 7); box(r, id + ".band", u, v + 27, -4, -11.5f, -4, 8, 2, 8);
					fill(px, u, v, 40, 11, c[0], c[1]); fill(px, u, v + 12, 28, 14, c[0], c[1]); fill(px, u, v + 27, 32, 10, c[2], c[3]);
				} else if (isWiz(id)) {
					box(r, id + ".brim", u, v, -6, -9.5f, -6, 12, 1, 12); box(r, id + ".c1", u, v + 14, -4, -13.5f, -4, 8, 4, 8); box(r, id + ".c2", u, v + 27, -3, -17.5f, -3, 6, 4, 6); box(r, id + ".c3", u, v + 38, -1.5f, -21.5f, -1.5f, 3, 4, 3);
					fill(px, u, v, 48, 13, c[0], c[1]); fill(px, u, v + 14, 32, 12, c[2], c[3]); fill(px, u, v + 27, 24, 10, c[2], c[3]); fill(px, u, v + 38, 12, 7, c[2], c[3]);
					for (int[] s : new int[][]{{2, 17}, {8, 20}, {12, 16}, {18, 21}, {4, 30}, {10, 33}, {16, 29}, {6, 40}}) dot(px, u + s[0], v + s[1], c[4]);
				} else if (id.equals("hat-crown")) {
					box(r, id + ".base", u, v, -4, -10, -4, 8, 2, 8);
					box(r, id + ".s1", u, v + 12, -4, -13, -4, 2, 3, 2); box(r, id + ".s2", u, v + 12, 2, -13, -4, 2, 3, 2); box(r, id + ".s3", u, v + 12, -4, -13, 2, 2, 3, 2); box(r, id + ".s4", u, v + 12, 2, -13, 2, 2, 3, 2);
					fill(px, u, v, 32, 10, c[0], c[1]); fill(px, u, v + 12, 8, 5, c[0], c[1]);
					for (int k = 0; k < 4; k++) dot(px, u + 2 + k * 8, v + 5, 0xFFE23B3B);
				} else if (id.equals("hat-halo")) {
					box(r, id, u, v, -3.5f, -14, -3.5f, 7, 1, 7); fill(px, u, v, 28, 8, c[0], c[1]);
				} else if (id.startsWith("wings-")) {
					wing(r, id, u, v);
					for (int k = 0; k < FN; k++) {
						int uu = u + (k % 7) * 8, vv = v + (k < 7 ? 0 : 26), len = FLEN[k];
						fill(px, uu, vv, 8, len + 1, c[1], c[1]);
						feather(px, uu + 1, vv + 1, len, c[0], c[1], c[2]); feather(px, uu + 5, vv + 1, len, c[0], c[1], c[2]);
					}
				} else if (id.startsWith("shield-")) {
					box(r, id, u, v, -3f, 0, -3.6f, 8, 11, 1); // gehalten: Platte vor dem Arm, wie ein Schild in der Hand
					fill(px, u, v, 18, 19, c[0], c[1]);
					for (int[] f : new int[][]{{u + 1, v + 1}, {u + 10, v + 1}}) {
						if (id.equals("shield-cloud")) { disc(px, f[0] + 3, f[1] + 5, 2, 0xFFFFFFFF); disc(px, f[0] + 5, f[1] + 5, 2, 0xFFFFFFFF); disc(px, f[0] + 4, f[1] + 4, 2, 0xFFFFFFFF); }
						else if (id.equals("shield-sun")) { disc(px, f[0] + 4, f[1] + 5, 2, 0xFFFFF4C2); dot(px, f[0] + 4, f[1] + 1, 0xFFFFF4C2); dot(px, f[0] + 4, f[1] + 9, 0xFFFFF4C2); dot(px, f[0], f[1] + 5, 0xFFFFF4C2); dot(px, f[0] + 7, f[1] + 5, 0xFFFFF4C2); }
						else { disc(px, f[0] + 4, f[1] + 5, 2, c[2]); dot(px, f[0] + 4, f[1] + 1, c[2]); dot(px, f[0] + 4, f[1] + 9, c[2]); }
					}
				}
			}
			NativeImage img = NativeImage.read(new ByteArrayInputStream(png(px, SZ, SZ)));
			MinecraftClient.getInstance().getTextureManager().registerTexture(TEX, new NativeImageBackedTexture(img));
			model = TexturedModelData.of(md, SZ, SZ).createModel();
		} catch (Exception e) {
			CloudyClient.LOG.warn("Cosmetics-Textur fehlgeschlagen", e);
			model = null;
		}
		return model != null;
	}

	// ---------- Bild-Items (Galaxie-Set): hochaufloesende PNG-Texturen aus dem Mod, Quader mit Abmessungen wie das Bild ----------
	public record Img(String id, String key, int dx, int dy, boolean wings) {}
	private static final Img[] IMGS = {
	};
	public static final class ImgModel { public ModelPart[] rs, ls; public ModelPart one; public Identifier tr, tl, t1; }
	private static final java.util.Map<String, ImgModel> IMG_CACHE = new java.util.HashMap<>();

	public static Img imgOf(String id) {
		if (id == null) return null;
		for (Img i : IMGS) if (i.id().equals(id)) return i;
		return null;
	}

	private static Identifier loadPng(String name) throws IOException {
		try (java.io.InputStream in = Cosmetics.class.getResourceAsStream("/cloudy-cos/" + name + ".png")) {
			if (in == null) throw new IOException("fehlt: " + name);
			NativeImage img = NativeImage.read(in);
			Identifier id = Identifier.of("cloudy-client", "cos_" + name);
			MinecraftClient.getInstance().getTextureManager().registerTexture(id, new NativeImageBackedTexture(img));
			return id;
		}
	}

	private static ModelPart cube(float x, float y, float z, int dx, int dy, ModelTransform t) {
		ModelData md = new ModelData();
		md.getRoot().addChild("p", ModelPartBuilder.create().uv(0, 0).cuboid(x, y, z, dx, dy, 1), t);
		return TexturedModelData.of(md, 2 + 2 * dx, 1 + dy).createModel().getChild("p"); // Texturgroesse = Quader-Layout, die PNG darf beliebig hoeher aufgeloest sein
	}

	private static final int[] WSEG = {6, 6, 4};

	/** Fluegel aus 3 Gliedern (innen, Mitte, Spitze), jedes haengt am vorherigen und schlaegt etwas spaeter. */
	private static ModelPart[] wingModel(int side, int dy) {
		ModelData md = new ModelData();
		ModelPartData par = md.getRoot();
		String[] n = {"a", "b", "c"};
		int u = 0;
		for (int k = 0; k < WSEG.length; k++) {
			int d = WSEG[k];
			ModelTransform t = k == 0 ? ModelTransform.pivot(side * 1.5f, 0.5f, 2.2f) : ModelTransform.pivot(side * WSEG[k - 1], 0, 0);
			par = par.addChild(n[k], ModelPartBuilder.create().uv(u, 0).cuboid(side > 0 ? 0 : -d, 0, 0, d, dy, 1), t);
			u += 2 + 2 * d;
		}
		ModelPart a = TexturedModelData.of(md, u, 1 + dy).createModel().getChild("a"); // Texturgroesse = Layout, die PNG darf viel hoeher aufgeloest sein
		return new ModelPart[]{a, a.getChild("b"), a.getChild("b").getChild("c")};
	}

	public static ImgModel imgModel(Img i) {
		ImgModel m = IMG_CACHE.get(i.id());
		if (m != null) return m;
		m = new ImgModel();
		try {
			if (i.wings()) {
				m.tr = loadPng("wingsheet_" + i.key() + "_r"); m.tl = loadPng("wingsheet_" + i.key() + "_l");
				m.rs = wingModel(1, i.dy());
				m.ls = wingModel(-1, i.dy());
			} else {
				m.t1 = loadPng("shield_" + i.key());
				m.one = cube(-5.5f, 0, -3.6f, i.dx(), i.dy(), ModelTransform.NONE);
			}
		} catch (Exception e) {
			CloudyClient.LOG.warn("Bild-Cosmetic fehlgeschlagen: " + i.id(), e);
			m = new ImgModel();
		}
		IMG_CACHE.put(i.id(), m);
		return m;
	}

	public static String[] parts(String id) {
		if (isTop(id)) return new String[]{id + ".brim", id + ".tube", id + ".band"};
		if (isWiz(id)) return new String[]{id + ".brim", id + ".c1", id + ".c2", id + ".c3"};
		if (id.equals("hat-crown")) return new String[]{id + ".base", id + ".s1", id + ".s2", id + ".s3", id + ".s4"};
		if (idx(id) >= 0 && (id.equals("hat-halo") || id.startsWith("shield-"))) return new String[]{id};
		return new String[0];
	}

	private static void box(ModelPartData r, String n, int u, int v, float x, float y, float z, int dx, int dy, int dz) {
		r.addChild(n, ModelPartBuilder.create().uv(u, v).cuboid(x, y, z, dx, dy, dz), ModelTransform.NONE);
	}

	/** 12 Federn pro Fluegel (7 Schwungfedern im Faecher + 5 kleine Deckfedern), jede ein eigener Quader mit Federtextur. */
	public static final int FN = 12;
	public static final int[] FANG = {22, 42, 62, 82, 102, 122, 142, 32, 57, 82, 107, 132}, FLEN = {9, 12, 15, 17, 17, 15, 12, 6, 7, 8, 8, 7};
	private static void wing(ModelPartData r, String n, int u, int v) {
		for (int k = 0; k < FN; k++) {
			int len = FLEN[k], uu = u + (k % 7) * 8, vv = v + (k < 7 ? 0 : 26);
			float z = 2.2f + (k < 7 ? k * 0.03f : 0.35f + (k - 7) * 0.03f);
			r.addChild(n + ".r" + k, ModelPartBuilder.create().uv(uu, vv).cuboid(-1.5f, -len, 0, 3, len, 1), ModelTransform.pivot(1.3f, 2.5f, z));
			r.addChild(n + ".l" + k, ModelPartBuilder.create().uv(uu, vv).cuboid(-1.5f, -len, 0, 3, len, 1), ModelTransform.pivot(-1.3f, 2.5f, z));
		}
	}

	private static int lerp(int a, int b, float t) {
		int r = 0;
		for (int s = 24; s >= 0; s -= 8) r |= (int) (((a >>> s) & 255) * (1 - t) + ((b >>> s) & 255) * t) << s;
		return r;
	}

	private static void put(int[] px, int x, int y, int c) { if (x >= 0 && y >= 0 && x < SZ && y < SZ) px[y * SZ + x] = c; }
	private static void dot(int[] px, int x, int y, int c) { put(px, x, y, c); }
	private static void fill(int[] px, int x, int y, int w, int h, int c1, int c2) {
		for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) put(px, x + i, y + j, lerp(c1, c2, h <= 1 ? 0 : j / (float) (h - 1)));
	}
	private static void disc(int[] px, int cx, int cy, int r, int c) {
		for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) put(px, cx + i, cy + j, c);
	}
	private static void feather(int[] px, int x, int y, int len, int c0, int c1, int c2) {
		for (int j = 0; j < len; j++) {
			float t = j / (float) Math.max(1, len - 1); // 0 = Spitze, 1 = Ansatz
			int base = lerp(c1, c0, Math.min(1f, t * 1.4f));
			for (int i = 0; i < 3; i++) {
				if (j < 2 && i != 1) { put(px, x + i, y + j, 0); continue; } // spitz zulaufend
				int col = base;
				if (i == 1) col = lerp(base, c2, j % 2 == 0 ? 0.6f : 0.25f); // Mittelrippe
				else if (j % 3 == 0) col = lerp(base, c2, 0.22f); // Fahnen
				if (j == 0) col = c2;
				put(px, x + i, y + j, col);
			}
		}
	}

	// ---------- Minimaler PNG-Encoder (ohne AWT, damit nichts mit macOS/LWJGL kollidiert) ----------
	private static byte[] png(int[] px, int w, int h) throws IOException {
		ByteArrayOutputStream raw = new ByteArrayOutputStream();
		for (int y = 0; y < h; y++) {
			raw.write(0);
			for (int x = 0; x < w; x++) { int c = px[y * w + x]; raw.write(c >> 16 & 255); raw.write(c >> 8 & 255); raw.write(c & 255); raw.write(c >>> 24); }
		}
		Deflater d = new Deflater();
		d.setInput(raw.toByteArray());
		d.finish();
		ByteArrayOutputStream z = new ByteArrayOutputStream();
		byte[] buf = new byte[4096];
		while (!d.finished()) z.write(buf, 0, d.deflate(buf));
		d.end();
		ByteArrayOutputStream hd = new ByteArrayOutputStream();
		DataOutputStream hs = new DataOutputStream(hd);
		hs.writeInt(w); hs.writeInt(h); hs.write(8); hs.write(6); hs.write(0); hs.write(0); hs.write(0);
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		out.write(new byte[]{(byte) 137, 80, 78, 71, 13, 10, 26, 10});
		chunk(out, "IHDR", hd.toByteArray());
		chunk(out, "IDAT", z.toByteArray());
		chunk(out, "IEND", new byte[0]);
		return out.toByteArray();
	}

	private static void chunk(OutputStream o, String type, byte[] data) throws IOException {
		DataOutputStream d = new DataOutputStream(o);
		byte[] t = type.getBytes(StandardCharsets.US_ASCII);
		d.writeInt(data.length);
		d.write(t);
		d.write(data);
		CRC32 crc = new CRC32();
		crc.update(t);
		crc.update(data);
		d.writeInt((int) crc.getValue());
	}
}
