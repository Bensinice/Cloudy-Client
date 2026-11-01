package app.cloudy.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.List;

/** Einstieg. Cloudy übergibt per -Dcloudy.mods=cape,hud und -Dcloudy.cheats=1, was aktiv ist. */
public class CloudyClient implements ClientModInitializer {
	public static final Logger LOG = LoggerFactory.getLogger("cloudy-client");
	public static boolean TITLE = !"0".equals(System.getProperty("cloudy.title"));
	private static boolean shiftDown;
	public static boolean CAPE, HUD, CHEATS, HUD_FPS, HUD_PING, HUD_ARMOR, HUD_COORDS;
	private static KeyBinding menuKey, reloadKey, cosKey, zoomKey, modsKey;
	public static boolean STYLE = true;

	@Override
	public void onInitializeClient() {
		List<String> mods = Arrays.asList(System.getProperty("cloudy.mods", "").split(","));
		CAPE = mods.contains("cape");
		List<String> hud = Arrays.asList(System.getProperty("cloudy.hud", "").split(","));
		HUD_FPS = hud.contains("fps");
		HUD_PING = hud.contains("ping");
		HUD_ARMOR = hud.contains("armor");
		HUD_COORDS = hud.contains("coords");
		HUD = mods.contains("hud") || HUD_FPS || HUD_PING || HUD_ARMOR || HUD_COORDS;
		if (mods.contains("hud") && System.getProperty("cloudy.hud") == null) HUD_FPS = HUD_COORDS = true;
		CHEATS = "1".equals(System.getProperty("cloudy.cheats"));

		if (CHEATS) {
			Modules.init();
			menuKey = KeyBindingHelper.registerKeyBinding(
				new KeyBinding("key.cloudy.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.cloudy"));
			ClientTickEvents.END_CLIENT_TICK.register(mc -> {
				if (mc.player == null || mc.world == null) return;
				while (menuKey.wasPressed()) { if (mc.currentScreen == null) mc.setScreen(new ClickGui()); }
				try { boolean d = GLFW.glfwGetKey(mc.getWindow().getHandle(), GLFW.GLFW_KEY_RIGHT_SHIFT) == GLFW.GLFW_PRESS; if (d && !shiftDown && mc.currentScreen == null) mc.setScreen(new ClickGui()); shiftDown = d; } catch (Throwable ignored) {}
				for (Module m : Modules.all) if (m.enabled) m.tick();
			});
		}
		// F7: Ressourcenpakete und Shader neu laden (neu installierte Pakete ohne Neustart). Mods selbst lassen sich zur Laufzeit nicht nachladen.
		reloadKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.cloudy.reload", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_F7, "category.cloudy"));
		cosKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.cloudy.cosmetics", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_K, "category.cloudy"));
		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (cosKey.wasPressed()) if (mc.currentScreen == null) mc.setScreen(new CosmeticsScreen(null));
			while (reloadKey.wasPressed()) {
				if (mc.player != null) mc.player.sendMessage(net.minecraft.text.Text.literal("Cloudy: Lyrics + Ressourcen werden neu geladen …"), true);
				try { Lyrics.reload(); } catch (Throwable ignored) {}
				mc.reloadResources();
			}
		});
		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			if (TITLE && mc.currentScreen != null && mc.currentScreen.getClass() == net.minecraft.client.gui.screen.TitleScreen.class) mc.setScreen(new CloudyTitleScreen());
		});
		// Vanilla-Menue: oben links ein Knopf, der zurueck zum Cloudy-Menue fuehrt
		net.fabricmc.fabric.api.client.screen.v1.ScreenEvents.AFTER_INIT.register((client, screen, sw, sh) -> {
			if (!TITLE && screen.getClass() == net.minecraft.client.gui.screen.TitleScreen.class) {
				net.fabricmc.fabric.api.client.screen.v1.Screens.getButtons(screen).add(net.minecraft.client.gui.widget.ButtonWidget.builder(net.minecraft.text.Text.literal("Cloudy menu"), b -> { TITLE = true; client.setScreen(new CloudyTitleScreen()); }).dimensions(6, 6, 90, 20).build());
			}
		});
		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			if (mc.world == null || mc.player == null || (mc.world.getTime() % 100) == 0) try { mc.getWindow().setTitle("Cloudy"); } catch (Throwable ignored) {}
		});
		zoomKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.cloudy.zoom", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_C, "category.cloudy"));
		modsKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.cloudy.mods", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_H, "category.cloudy"));
		ModConfig.load();
		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			Hud.pollClicks(mc);
			Qol.tick(mc, zoomKey);
			try { Hotkeys.tick(mc); } catch (Throwable ignored) {}
			while (modsKey.wasPressed()) if (mc.currentScreen == null) mc.setScreen(new CloudyModsScreen(null));
		});
		Cosmetics.init();
		ClientTickEvents.END_CLIENT_TICK.register(mc -> { try { CosmeticNet.tick(mc); } catch (Throwable ignored) {} });
		CreamHeist.init();
		HudRenderCallback.EVENT.register(Hud::render);
		try { Extras.init(); } catch (Throwable ignored) {}
		try {
			KeyBinding lookKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.cloudy.freelook", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_LEFT_ALT, "category.cloudy"));
			KeyBinding freeKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.cloudy.freecam", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_F6, "category.cloudy"));
			KeyBinding togKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.cloudy.freelook_toggle", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_F8, "category.cloudy"));
			FreeCam.init(lookKey, freeKey, togKey);
		} catch (Throwable t) { LOG.warn("Freelook/Freecam nicht verfuegbar", t); }
		try { SpotifyCmd.init(); } catch (Throwable t) { LOG.warn("Spotify-Befehle nicht verfuegbar", t); }
		LOG.info("Cloudy Client geladen (cape={}, hud={}, cheats={})", CAPE, HUD, CHEATS);
	}
}
