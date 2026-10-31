package app.cloudy.client;

import net.minecraft.client.MinecraftClient;

public abstract class Module {
	public final String name, category, desc;
	public boolean enabled;
	protected final MinecraftClient mc = MinecraftClient.getInstance();

	protected Module(String name, String category, String desc) {
		this.name = name; this.category = category; this.desc = desc;
	}
	public void toggle() { set(!enabled); }
	public void set(boolean on) {
		if (on == enabled) return;
		enabled = on;
		if (on) onEnable(); else onDisable();
	}
	public void onEnable() {}
	public void onDisable() {}
	public void tick() {}
}
