package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.text.Text;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Zusatz-Mods von Cloudy Mods: Anzeigen (Biom, Licht, Nether-Koordinaten, Tag, Haltbarkeit, Pfeile, Traenke, Effekte, Server, Spielzeit, Todespunkt, Essen, Leben, Blickziel)
 *  und Komfort (Tooltips mit Haltbarkeit, Todespunkt im Chat, Auto-GG). Alles eigener Code, jeder Schalter steht in Cloudy Mods und ist standardmaessig aus. */
public final class Extras {
	private static final long START = System.currentTimeMillis();
	private static String death;
	private static boolean wasDead;
	private static long lastGg;

	public static void init() {
		try {
			net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents.END_CLIENT_TICK.register(Extras::tick);
		} catch (Throwable ignored) {}
		// Tooltips: je nach Fabric-API-Version liegt der Callback in einem anderen Paket – darum ueber Reflection, damit der Build nie daran scheitert
		for (String cn : new String[]{"net.fabricmc.fabric.api.client.item.v1.ItemTooltipCallback", "net.fabricmc.fabric.api.item.v1.ItemTooltipCallback"}) {
			try {
				Class<?> cb = Class.forName(cn);
				Object ev = cb.getField("EVENT").get(null);
				Object proxy = java.lang.reflect.Proxy.newProxyInstance(cb.getClassLoader(), new Class<?>[]{cb}, (pr, m, a) -> {
					if (m.getDeclaringClass() == Object.class) return m.getName().equals("hashCode") ? System.identityHashCode(pr) : m.getName().equals("equals") ? pr == a[0] : "tooltip";
					try { tooltip((ItemStack) a[0], (List<Text>) a[a.length - 1]); } catch (Throwable ignored) {}
					return null;
				});
				ev.getClass().getMethod("register", Object.class).invoke(ev, proxy);
				break;
			} catch (Throwable ignored) {}
		}
		try {
			net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents.GAME.register((msg, overlay) -> {
				try {
					if (overlay || !ModConfig.isOn("autogg")) return;
					String s = msg.getString().toLowerCase(Locale.ROOT);
					long now = System.currentTimeMillis();
					if (now - lastGg < 30000) return;
					if (s.contains("you won") || s.contains("winner") || s.contains("game over") || s.contains("victory")) {
						MinecraftClient mc = MinecraftClient.getInstance();
						if (mc.player != null && mc.getNetworkHandler() != null) { lastGg = now; mc.getNetworkHandler().sendChatMessage("gg"); }
					}
				} catch (Throwable ignored) {}
			});
		} catch (Throwable ignored) {}
	}

	@SuppressWarnings("unchecked")
	private static void tooltip(ItemStack stack, List<Text> lines) {
		if (!ModConfig.isOn("tooltips") || stack == null || stack.isEmpty()) return;
		if (stack.isDamageable()) lines.add(Text.literal("Durability: " + (stack.getMaxDamage() - stack.getDamage()) + " / " + stack.getMaxDamage()).formatted(net.minecraft.util.Formatting.GRAY));
		lines.add(Text.literal(net.minecraft.registry.Registries.ITEM.getId(stack.getItem()).toString()).formatted(net.minecraft.util.Formatting.DARK_GRAY));
	}

	private static void tick(MinecraftClient mc) {
		try {
			if (mc.player == null) { wasDead = false; return; }
			boolean dead = mc.player.getHealth() <= 0f || mc.player.isDead();
			if (dead && !wasDead) {
				death = String.format("%.0f / %.0f / %.0f", mc.player.getX(), mc.player.getY(), mc.player.getZ());
				if (ModConfig.isOn("deathpos")) mc.player.sendMessage(Text.literal("Cloudy: you died at " + death), false);
			}
			wasDead = dead;
		} catch (Throwable ignored) {}
	}

	private static int count(MinecraftClient mc, java.util.function.Predicate<ItemStack> p) {
		int n = 0; var inv = mc.player.getInventory();
		for (int i = 0; i < inv.size(); i++) { ItemStack st = inv.getStack(i); if (!st.isEmpty() && p.test(st)) n += st.getCount(); }
		return n;
	}

	private static String time(int ticks) { int s = Math.max(0, ticks / 20); return (s / 60) + ":" + String.format("%02d", s % 60); }

	/** Text eines Extras-Chips oder null (dann wird nichts angezeigt). */
	public static String text(String id, MinecraftClient mc) {
		try {
			var p = mc.player; var w = mc.world;
			switch (id) {
				case "biome": { var k = w.getBiome(p.getBlockPos()).getKey(); return k.isPresent() ? "Biome: " + pretty(k.get().getValue().getPath()) : null; }
				case "light": return "Light: " + w.getLightLevel(p.getBlockPos());
				case "nether": {
					boolean nether = w.getRegistryKey() == net.minecraft.world.World.NETHER;
					return nether ? String.format("Overworld %.0f / %.0f", p.getX() * 8, p.getZ() * 8) : String.format("Nether %.0f / %.0f", p.getX() / 8, p.getZ() / 8);
				}
				case "day": { long t = w.getTimeOfDay(); long d = t / 24000L, tod = t % 24000L; int h = (int) ((tod / 1000 + 6) % 24), m = (int) ((tod % 1000) * 60 / 1000); return String.format("Day %d  %02d:%02d", d + 1, h, m); }
				case "durability": { ItemStack st = p.getMainHandStack(); return st.isDamageable() ? "Durability: " + (st.getMaxDamage() - st.getDamage()) + "/" + st.getMaxDamage() : null; }
				case "arrows": return "Arrows: " + count(mc, s -> s.isOf(Items.ARROW) || s.isOf(Items.SPECTRAL_ARROW) || s.isOf(Items.TIPPED_ARROW));
				case "potions": return "Potions: " + count(mc, s -> s.isOf(Items.POTION) || s.isOf(Items.SPLASH_POTION) || s.isOf(Items.LINGERING_POTION));
				case "held": { ItemStack st = p.getMainHandStack(); if (st.isEmpty()) return null; Object it = st.getItem(); int n = count(mc, s -> s.getItem() == it); return st.getName().getString() + ": " + n; }
				case "server": { var e = mc.getCurrentServerEntry(); return e == null ? "Singleplayer" : e.address; }
				case "session": { long s = (System.currentTimeMillis() - START) / 1000; return String.format("Session %d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60); }
				case "effects": {
					List<String> l = new ArrayList<>();
					for (StatusEffectInstance e : p.getStatusEffects()) { if (l.size() >= 3) break; l.add(e.getEffectType().value().getName().getString() + (e.getAmplifier() > 0 ? " " + (e.getAmplifier() + 1) : "") + " " + (e.isInfinite() ? "∞" : time(e.getDuration()))); }
					return l.isEmpty() ? null : String.join("  ·  ", l);
				}
				case "death": return death == null ? null : "Death: " + death;
				case "food": return String.format("Food %d  Sat %.1f", p.getHungerManager().getFoodLevel(), p.getHungerManager().getSaturationLevel());
				case "health": return String.format("HP %.1f", p.getHealth() + p.getAbsorptionAmount());
				case "target": {
					HitResult h = mc.crosshairTarget;
					if (h instanceof BlockHitResult bh && h.getType() == HitResult.Type.BLOCK) { BlockPos bp = bh.getBlockPos(); return "Looking at: " + w.getBlockState(bp).getBlock().getName().getString(); }
					return null;
				}
				default: return null;
			}
		} catch (Throwable t) { return null; }
	}

	private static String pretty(String s) { String[] a = s.split("_"); StringBuilder b = new StringBuilder(); for (String x : a) { if (x.isEmpty()) continue; if (b.length() > 0) b.append(' '); b.append(Character.toUpperCase(x.charAt(0))).append(x.substring(1)); } return b.toString(); }

	public static final String[] IDS = {"biome", "light", "nether", "day", "durability", "arrows", "potions", "held", "server", "session", "effects", "death", "food", "health", "target"};
	public static boolean is(String id) { for (String s : IDS) if (s.equals(id)) return true; return false; }
	public static String sample(String id) {
		return switch (id) {
			case "biome" -> "Biome: Plains"; case "light" -> "Light: 15"; case "nether" -> "Nether 16 / -4"; case "day" -> "Day 12  06:30"; case "durability" -> "Durability: 231/250";
			case "arrows" -> "Arrows: 64"; case "potions" -> "Potions: 6"; case "held" -> "Cobblestone: 128"; case "server" -> "play.example.net"; case "session" -> "Session 0:42:10";
			case "effects" -> "Speed 2 1:42"; case "death" -> "Death: 128 / 64 / -32"; case "food" -> "Food 20  Sat 5.0"; case "health" -> "HP 20.0"; case "target" -> "Looking at: Stone"; default -> id;
		};
	}
}
