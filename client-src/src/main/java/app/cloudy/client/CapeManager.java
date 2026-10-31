package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/** Lädt den eigenen Umhang (PNG) aus -Dcloudy.cape=… und registriert ihn als Textur. */
public final class CapeManager {
	private static Identifier id;
	private static boolean tried;

	public static Identifier get() {
		if (!CloudyClient.CAPE) return null;
		if (!tried) {
			tried = true;
			String p = System.getProperty("cloudy.cape", "");
			if (!p.isEmpty()) {
				try (InputStream in = Files.newInputStream(Path.of(p))) {
					NativeImage img = NativeImage.read(in);
					Identifier i = Identifier.of("cloudy-client", "cape");
					MinecraftClient.getInstance().getTextureManager().registerTexture(i, new NativeImageBackedTexture(img));
					id = i;
				} catch (Exception e) {
					CloudyClient.LOG.warn("Umhang konnte nicht geladen werden", e);
				}
			}
		}
		return id;
	}
}
