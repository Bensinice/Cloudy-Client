package app.cloudy.client;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.ChatScreen;

import java.util.ArrayList;
import java.util.List;

/** Cloudy-Profilkarte: Level, Cloudy+, Lieblings-Cosmetic, Spielzeit, Abzeichen, Freund hinzufuegen / Party / Wolken-Post. Daten vom Konto-Server ueber den Launcher. */
public final class ProfileScreen extends SocialScreen {
	private final String name;
	private JsonObject data; private String error, note = "";

	public ProfileScreen(String name) {
		super("Profile");
		this.name = name;
		JsonObject a = new JsonObject(); a.addProperty("name", name);
		Social.rpc("profile", a, r -> { if (r.has("ok") && r.get("ok").getAsBoolean()) data = r; else error = r.has("error") ? r.get("error").getAsString() : "Profile not available."; });
		if (!Social.launcher()) error = "Start Minecraft from the Cloudy launcher to see profiles.";
	}

	private static String str(JsonObject o, String k) { return o != null && o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : ""; }
	private static boolean bool(JsonObject o, String k) { return o != null && o.has(k) && o.get(k).getAsBoolean(); }

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		renderBackground(c, mx, my, delta); btns.clear();
		card(c, 280, 190);
		MinecraftClient mc = MinecraftClient.getInstance(); boolean face = false;
		if (mc.world != null) for (net.minecraft.client.network.AbstractClientPlayerEntity p : mc.world.getPlayers()) if (p.getName().getString().equalsIgnoreCase(name)) { try { net.minecraft.client.gui.PlayerSkinDrawer.draw(c, p.getSkinTextures(), cx + 14, cy + 12, 40); face = true; } catch (Throwable ignored) {} break; }
		if (!face) Ui.cloud(c, cx + 14, cy + 18, 20, 0xFFFFFFFF);
		Ui.txt(c, name, cx + 64, cy + 14, 0xFFFFFFFF);
		if (error != null) { Ui.txt(c, "☁ Cloudy player?", cx + 64, cy + 26, 0xFF7F8CB0); int y = cy + 70; for (String l : wrap(error, cw - 28)) { Ui.txt(c, l, cx + 14, y, 0xFFFF8A8A); y += 11; } }
		else if (data == null) Ui.ctr(c, "Loading profile" + ".".repeat((int) (System.currentTimeMillis() / 400 % 4)), cx + cw / 2, cy + 80, 0xFFAFC4DA);
		else {
			String acc = str(data, "name"); boolean plus = bool(data, "plus"), online = bool(data, "online");
			Ui.txt(c, (acc.equalsIgnoreCase(name) ? "" : "Cloudy: " + acc + "  ") + (online ? "● online" : "○ offline"), cx + 64, cy + 26, online ? 0xFF7CE0A0 : 0xFF7F8CB0);
			int y = cy + 52;
			int lvl = data.has("level") ? data.get("level").getAsInt() : 0; long min = data.has("playMin") ? data.get("playMin").getAsLong() : 0;
			stat(c, cx + 14, y, "Level", String.valueOf(lvl)); stat(c, cx + 14 + (cw - 28) / 3, y, "Play time", min >= 60 ? (min / 60) + " h" : min + " min"); stat(c, cx + 14 + (cw - 28) * 2 / 3, y, "Cloudy+", plus ? "yes ★" : "no");
			y += 30;
			String fav = ""; if (data.has("equip") && data.get("equip").isJsonObject()) { JsonObject eq = data.getAsJsonObject("equip"); for (String k : new String[] { "wings", "cape", "pet", "hat" }) if (eq.has(k)) { fav = Cosmetics.nameOf(eq.get(k).getAsString()); break; } }
			Ui.txt(c, "Favourite cosmetic: ", cx + 14, y, 0xFF7F8CB0); Ui.txt(c, fav.isEmpty() ? "-" : fav, cx + 14 + Ui.w("Favourite cosmetic: "), y, 0xFFFFFFFF); y += 14;
			List<String> badges = new ArrayList<>();
			for (String k : new String[] { "tags", "badges" }) if (data.has(k) && data.get(k).isJsonArray()) for (JsonElement e : data.getAsJsonArray(k)) { String t = e.isJsonObject() ? str(e.getAsJsonObject(), "name") : e.getAsString(); if (t.startsWith("clan:")) t = "[" + t.split(":")[1] + "]"; if (!t.isEmpty()) badges.add(t.equals("plus") ? "Cloudy+" : t); }
			Ui.txt(c, "Badges: ", cx + 14, y, 0xFF7F8CB0); int x = cx + 14 + Ui.w("Badges: ");
			if (badges.isEmpty()) Ui.txt(c, "-", x, y, 0xFFFFFFFF);
			for (String b : badges) { int w = Ui.w(b) + 8; if (x + w > cx + cw - 12) break; c.fill(x, y - 2, x + w, y + 10, 0x553A6AB0); Ui.txt(c, b, x + 4, y, 0xFFFFE08A); x += w + 4; }
			int by = cy + ch - 28;
			if (!bool(data, "self")) {
				if (bool(data, "friend")) {
					btn(cx + 14, by, 80, "Party invite", true, () -> { Social.invite(acc); note = "Invite sent."; });
					btn(cx + 98, by, 80, "Cloud mail", false, () -> MinecraftClient.getInstance().setScreen(new ChatScreen("/post " + acc + " ")));
				} else if (bool(data, "pending")) Ui.txt(c, "Friend request sent", cx + 14, by + 5, 0xFFAFC4DA);
				else btn(cx + 14, by, 100, "Add friend", true, () -> { JsonObject a = new JsonObject(); a.addProperty("name", acc); Social.rpc("friendAdd", a, r -> { note = r.has("ok") && r.get("ok").getAsBoolean() ? "Friend request sent!" : str(r, "error"); if (r.has("ok") && r.get("ok").getAsBoolean()) data.addProperty("pending", true); }); note = "Sending ..."; });
			}
			if (!note.isEmpty()) Ui.txt(c, note, cx + 14, by - 13, 0xFF9FD3FF);
		}
		btn(cx + cw - 74, cy + ch - 28, 60, "Close", false, this::close);
		drawBtns(c, mx, my);
	}

	private static void stat(DrawContext c, int x, int y, String label, String val) { Ui.txt(c, label, x, y, 0xFF7F8CB0); Ui.txt(c, val, x, y + 11, 0xFFFFFFFF); }
}
