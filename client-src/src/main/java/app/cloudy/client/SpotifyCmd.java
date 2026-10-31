package app.cloudy.client;

import com.mojang.brigadier.Command;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.minecraft.text.Text;

import java.nio.file.Files;
import java.nio.file.Path;

/** Chat-Befehle fuer Spotify: /pause, /resume, /skip, /prev. Der Befehl wird in eine Datei geschrieben, die der Launcher ausfuehrt (-Dcloudy.cmd). */
public final class SpotifyCmd {
	private SpotifyCmd() {}

	public static void init() {
		ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
			reg(dispatcher, "pause", "Spotify pausiert");
			reg(dispatcher, "resume", "Spotify spielt weiter");
			reg(dispatcher, "skip", "Naechster Song");
			reg(dispatcher, "prev", "Vorheriger Song");
		});
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
