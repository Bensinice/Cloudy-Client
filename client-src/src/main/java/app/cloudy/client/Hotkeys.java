package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

import java.util.HashMap;
import java.util.Map;

/** Eigene Tastenkuerzel fuer Cloudy-Mods: schalten einen Mod im Spiel an oder aus. Belegungen, die mit Minecraft-Tasten oder anderen Mods kollidieren, werden abgelehnt. */
public final class Hotkeys {
	private Hotkeys() {}
	private static final Map<String, Boolean> down = new HashMap<>();

	public static void tick(MinecraftClient mc) {
		if (mc.player == null || mc.currentScreen != null) { down.clear(); return; }
		long w = mc.getWindow().getHandle();
		for (var e : ModConfig.keys.entrySet()) {
			boolean d = GLFW.glfwGetKey(w, e.getValue()) == GLFW.GLFW_PRESS, was = down.getOrDefault(e.getKey(), false);
			down.put(e.getKey(), d);
			if (d && !was) {
				boolean now = !ModConfig.isOn(e.getKey());
				ModConfig.set(e.getKey(), now);
				String n = e.getKey();
				for (var df : ModConfig.DEFS) if (df.id().equals(e.getKey())) n = df.name();
				mc.player.sendMessage(Text.literal(n + ": " + (now ? "ON" : "OFF")), true);
			}
		}
	}

	/** null = frei, sonst Grund der Ablehnung. */
	public static String conflict(String modId, int code) {
		if (code == GLFW.GLFW_KEY_ESCAPE) return "Escape is reserved";
		for (var e : ModConfig.keys.entrySet()) if (e.getValue() == code && !e.getKey().equals(modId)) {
			String n = e.getKey();
			for (var df : ModConfig.DEFS) if (df.id().equals(e.getKey())) n = df.name();
			return "Already used by " + n;
		}
		try {
			for (KeyBinding k : MinecraftClient.getInstance().options.allKeys) {
				InputUtil.Key b = net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper.getBoundKeyOf(k);
				if (b.getCategory() == InputUtil.Type.KEYSYM && b.getCode() == code) return "Used by Minecraft: " + Text.translatable(k.getTranslationKey()).getString();
			}
		} catch (Throwable ignored) {}
		return null;
	}
}
