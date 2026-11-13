package app.cloudy.client;

import com.mojang.brigadier.Command;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.minecraft.text.Text;
import net.minecraft.text.MutableText;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.HoverEvent;
import net.minecraft.util.Formatting;
import com.mojang.brigadier.arguments.IntegerArgumentType;

import java.nio.file.Files;
import java.nio.file.Path;

/** Chat-Befehle fuer Spotify: /pause, /resume, /skip, /prev und /playlist (Uebersicht, Songs, Abspielen). Der Befehl wird in eine Datei geschrieben, die der Launcher ausfuehrt (-Dcloudy.cmd). */
public final class SpotifyCmd {
	private SpotifyCmd() {}

	private static boolean chatWait;
	private static int page;

	public static void init() {
		ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
			reg(dispatcher, "pause", "Spotify pausiert");
			reg(dispatcher, "resume", "Spotify spielt weiter");
			reg(dispatcher, "skip", "Naechster Song");
			reg(dispatcher, "prev", "Vorheriger Song");
			// /playlist: Uebersicht -> Playlist anklicken -> Songs -> Song anklicken -> Wiedergabe
			dispatcher.register(ClientCommandManager.literal("playlist")
				.executes(ctx -> { listPlaylists(); return Command.SINGLE_SUCCESS; })
				.then(ClientCommandManager.literal("open").then(ClientCommandManager.argument("n", IntegerArgumentType.integer(1)).executes(ctx -> { openNr(IntegerArgumentType.getInteger(ctx, "n")); return Command.SINGLE_SUCCESS; })))
				.then(ClientCommandManager.literal("play").then(ClientCommandManager.argument("n", IntegerArgumentType.integer(1)).executes(ctx -> { playNr(IntegerArgumentType.getInteger(ctx, "n")); return Command.SINGLE_SUCCESS; })))
				.then(ClientCommandManager.literal("page").then(ClientCommandManager.argument("n", IntegerArgumentType.integer(1)).executes(ctx -> { page = IntegerArgumentType.getInteger(ctx, "n") - 1; showSongs(); return Command.SINGLE_SUCCESS; })))
				.then(ClientCommandManager.literal("all").executes(ctx -> { SpotifyData.Pl p = SpotifyData.current(); if (p == null) say(Text.literal("Open a playlist first: /playlist").formatted(Formatting.GRAY)); else if (SpotifyData.playAll(p)) say(Text.literal("\u266B Playing " + p.name()).formatted(Formatting.GREEN)); else noLauncher(); return Command.SINGLE_SUCCESS; }))
				.then(ClientCommandManager.literal("next").executes(ctx -> { if (send("skip")) say(Text.literal("\u266B Next song").formatted(Formatting.GREEN)); else noLauncher(); return Command.SINGLE_SUCCESS; }))
				.then(ClientCommandManager.literal("prev").executes(ctx -> { if (send("prev")) say(Text.literal("\u266B Previous song").formatted(Formatting.GREEN)); else noLauncher(); return Command.SINGLE_SUCCESS; })));
		});
		// Songs erscheinen, sobald der Launcher sie geliefert hat
		net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			if (!chatWait) return;
			SpotifyData.read();
			if (SpotifyData.trLoading) return;
			chatWait = false; page = 0; showSongs();
		});
	}

	private static void say(Text t) { var mc = net.minecraft.client.MinecraftClient.getInstance(); if (mc.inGameHud != null) mc.inGameHud.getChatHud().addMessage(t); }
	private static void noLauncher() { say(Text.literal("Spotify control only works when Minecraft was started from the Cloudy launcher.").formatted(Formatting.RED)); }

	private static MutableText click(String label, String cmd, String hover, Formatting col) {
		return Text.literal(label).styled(s -> s.withColor(col).withClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, cmd)).withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Text.literal(hover))));
	}

	private static void listPlaylists() {
		SpotifyData.read();
		if (!SpotifyData.launcher) { noLauncher(); return; }
		if (!SpotifyData.connected) { say(Text.literal("Spotify is not connected. Connect it in the launcher: Settings > Spotify.").formatted(Formatting.RED)); return; }
		if (SpotifyData.pls.isEmpty()) { say(Text.literal(SpotifyData.err.isEmpty() ? "No playlists found yet. The launcher loads them every few seconds - try again in a moment." : SpotifyData.err).formatted(Formatting.GRAY)); return; }
		say(Text.literal("\u266B Your playlists").formatted(Formatting.AQUA, Formatting.BOLD).append(Text.literal("  (click one to see its songs)").formatted(Formatting.GRAY)));
		for (int i = 0; i < SpotifyData.pls.size(); i++) {
			SpotifyData.Pl p = SpotifyData.pls.get(i);
			say(Text.literal(" " + (i + 1) + ". ").formatted(Formatting.DARK_GRAY).append(click(p.name(), "/playlist open " + (i + 1), "Show the songs of " + p.name(), Formatting.WHITE)).append(Text.literal(p.total() >= 0 ? "  " + p.total() + " songs" : "").formatted(Formatting.GRAY)));
		}
	}

	private static void openNr(int n) {
		SpotifyData.read();
		if (n < 1 || n > SpotifyData.pls.size()) { say(Text.literal("There is no playlist " + n + ". Type /playlist for the list.").formatted(Formatting.RED)); return; }
		SpotifyData.Pl p = SpotifyData.pls.get(n - 1);
		if (!SpotifyData.open(p)) { noLauncher(); return; }
		say(Text.literal("\u266B Loading " + p.name() + " ...").formatted(Formatting.GRAY));
		chatWait = true;
	}

	private static void showSongs() {
		SpotifyData.Pl p = SpotifyData.current();
		if (p == null) { say(Text.literal("Open a playlist first: /playlist").formatted(Formatting.GRAY)); return; }
		if (!SpotifyData.trErr.isEmpty()) { say(Text.literal(SpotifyData.trErr).formatted(Formatting.RED)); return; }
		int per = 20, n = SpotifyData.tracks.size(), pages = Math.max(1, (n + per - 1) / per);
		page = Math.max(0, Math.min(pages - 1, page));
		say(Text.literal("\u266B " + p.name()).formatted(Formatting.AQUA, Formatting.BOLD).append(Text.literal("  " + n + " songs  ").formatted(Formatting.GRAY)).append(click("[\u25B6 Play all]", "/playlist all", "Play the whole playlist", Formatting.GREEN)));
		for (int i = page * per; i < Math.min(n, (page + 1) * per); i++) {
			SpotifyData.Tr t = SpotifyData.tracks.get(i);
			say(Text.literal(" " + (i + 1) + ". ").formatted(Formatting.DARK_GRAY).append(click(t.name(), "/playlist play " + (i + 1), "Play " + t.name(), Formatting.WHITE)).append(Text.literal(t.artist().isEmpty() ? "" : "  " + t.artist()).formatted(Formatting.GRAY)));
		}
		if (pages > 1) {
			MutableText nav = Text.literal(" Page " + (page + 1) + "/" + pages + "  ").formatted(Formatting.GRAY);
			if (page > 0) nav.append(click("[< Back]", "/playlist page " + page, "Previous page", Formatting.YELLOW)).append(Text.literal(" "));
			if (page < pages - 1) nav.append(click("[Next >]", "/playlist page " + (page + 2), "Next page", Formatting.YELLOW));
			say(nav);
		}
	}

	private static void playNr(int n) {
		SpotifyData.Pl p = SpotifyData.current();
		if (p == null || n < 1 || n > SpotifyData.tracks.size()) { say(Text.literal("Open a playlist first: /playlist").formatted(Formatting.GRAY)); return; }
		SpotifyData.Tr t = SpotifyData.tracks.get(n - 1);
		if (SpotifyData.play(p, t)) say(Text.literal("\u266B Playing " + t.name() + (t.artist().isEmpty() ? "" : " - " + t.artist())).formatted(Formatting.GREEN)); else noLauncher();
	}

	/** Befehl an den Launcher (pause, resume, skip, prev, play:spotify:playlist:ID, vol:0-100). Gibt false zurueck, wenn das Spiel nicht ueber Cloudy gestartet wurde. */
	public static boolean send(String cmd) {
		String p = System.getProperty("cloudy.cmd", "");
		if (p.isEmpty()) return false;
		try { Files.writeString(Path.of(p), cmd + "|" + System.currentTimeMillis()); return true; } catch (Exception e) { return false; }
	}

	private static void reg(com.mojang.brigadier.CommandDispatcher<net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource> d, String name, String msg) {
		d.register(ClientCommandManager.literal(name).executes(ctx -> {
			String p = System.getProperty("cloudy.cmd", "");
			if (p.isEmpty()) { ctx.getSource().sendFeedback(Text.literal("Spotify-Steuerung nur ueber den Cloudy-Launcher verfuegbar.")); return 0; }
			try { Files.writeString(Path.of(p), name + "|" + System.currentTimeMillis()); }
			catch (Exception e) { ctx.getSource().sendFeedback(Text.literal("Spotify-Befehl fehlgeschlagen: " + e.getMessage())); return 0; }
			ctx.getSource().sendFeedback(Text.literal("\u266B " + msg));
			return Command.SINGLE_SUCCESS;
		}));
	}
}
