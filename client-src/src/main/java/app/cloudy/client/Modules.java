package app.cloudy.client;

import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.decoration.ArmorStandEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.player.PlayerAbilities;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.Vec3d;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.item.Items;

import java.util.ArrayList;
import java.util.List;

/** Wurst × Meteor: Module im Meteor-Stil (ClickGUI, Anzeigeliste), Funktionen im Wurst-Stil. */
public final class Modules {
	public static final List<Module> all = new ArrayList<>();

	public static void init() {
		all.add(new KillAura());
		all.add(new Fly());
		all.add(new Speed());
		all.add(new Sprint());
		all.add(new Fullbright());
		all.add(new AutoTotem());
		all.add(new Jesus());
		all.add(new Glide());
		all.add(new Scaffold());
		all.add(new AntiAfk());
		all.add(new Esp());
		all.add(new Aimbot());
		all.add(new AutoClicker());
		all.add(new Spider());
		all.add(new AirJump());
		all.add(new HighJump());
		all.add(new AutoWalk());
		all.add(new AutoSneak());
	}

	static class KillAura extends Module {
		KillAura() { super("KillAura", "Combat", "Greift Wesen in Reichweite automatisch an"); }
		@Override public void tick() {
			if (mc.player == null || mc.interactionManager == null || mc.world == null) return;
			if (mc.player.getAttackCooldownProgress(0.5f) < 1.0f) return;
			Entity best = null; double bestD = 4.2;
			for (Entity e : mc.world.getEntities()) {
				if (!(e instanceof LivingEntity le) || e == mc.player || !le.isAlive() || e instanceof ArmorStandEntity) continue;
				double d = mc.player.distanceTo(e);
				if (d < bestD) { bestD = d; best = e; }
			}
			if (best != null) {
				mc.interactionManager.attackEntity(mc.player, best);
				mc.player.swingHand(Hand.MAIN_HAND);
			}
		}
	}

	static class Fly extends Module {
		Fly() { super("Fly", "Movement", "Fliegen wie im Kreativmodus"); }
		@Override public void tick() {
			if (mc.player == null) return;
			PlayerAbilities a = mc.player.getAbilities();
			a.allowFlying = true; a.flying = true; a.setFlySpeed(0.08f);
		}
		@Override public void onDisable() {
			if (mc.player == null) return;
			PlayerAbilities a = mc.player.getAbilities();
			a.flying = false; a.setFlySpeed(0.05f);
			a.allowFlying = mc.player.isCreative() || mc.player.isSpectator();
		}
	}

	static class Speed extends Module {
		Speed() { super("Speed", "Movement", "Schneller laufen"); }
		@Override public void tick() {
			if (mc.player == null || mc.player.input == null) return;
			float f = mc.player.input.movementForward, s = mc.player.input.movementSideways;
			if (f == 0 && s == 0) return;
			double yaw = Math.toRadians(mc.player.getYaw());
			double dx = -Math.sin(yaw) * f + Math.cos(yaw) * s, dz = Math.cos(yaw) * f + Math.sin(yaw) * s;
			double len = Math.sqrt(dx * dx + dz * dz);
			double sp = 0.32;
			mc.player.setVelocity(dx / len * sp, mc.player.getVelocity().y, dz / len * sp);
		}
	}

	static class Sprint extends Module {
		Sprint() { super("Sprint", "Movement", "Rennt immer, wenn du vorwärts gehst"); }
		@Override public void tick() {
			if (mc.player == null || mc.player.input == null) return;
			if (mc.player.input.movementForward > 0 && !mc.player.horizontalCollision && !mc.player.isSneaking())
				mc.player.setSprinting(true);
		}
	}

	static class Fullbright extends Module {
		Fullbright() { super("Fullbright", "Render", "Alles hell, auch in Höhlen"); }
		@Override public void tick() {
			if (mc.player == null) return;
			StatusEffectInstance cur = mc.player.getStatusEffect(StatusEffects.NIGHT_VISION);
			if (cur == null || cur.getDuration() < 220)
				mc.player.addStatusEffect(new StatusEffectInstance(StatusEffects.NIGHT_VISION, 400, 0, false, false));
		}
		@Override public void onDisable() {
			if (mc.player != null) mc.player.removeStatusEffect(StatusEffects.NIGHT_VISION);
		}
	}

	static class AutoTotem extends Module {
		private int cd;
		AutoTotem() { super("AutoTotem", "Combat", "Legt automatisch ein Totem in die zweite Hand"); }
		@Override public void tick() {
			if (mc.player == null || mc.interactionManager == null || mc.currentScreen != null) return;
			if (cd > 0) { cd--; return; }
			if (mc.player.getOffHandStack().isOf(Items.TOTEM_OF_UNDYING)) return;
			var inv = mc.player.getInventory();
			for (int i = 0; i < 36; i++) {
				if (!inv.getStack(i).isOf(Items.TOTEM_OF_UNDYING)) continue;
				int slot = i < 9 ? 36 + i : i;
				mc.interactionManager.clickSlot(mc.player.playerScreenHandler.syncId, slot, 40, SlotActionType.SWAP, mc.player);
				cd = 6;
				return;
			}
		}
	}

	static class Jesus extends Module {
		Jesus() { super("Jesus", "Movement", "Auf Wasser laufen (Sneaken zum Sinken)"); }
		@Override public void tick() {
			if (mc.player == null || mc.player.isSneaking()) return;
			if (mc.player.isTouchingWater()) { Vec3d v = mc.player.getVelocity(); mc.player.setVelocity(v.x, 0.12, v.z); }
		}
	}

	static class Glide extends Module {
		Glide() { super("Glide", "Movement", "Langsam fallen statt abstuerzen"); }
		@Override public void tick() {
			if (mc.player == null || mc.player.isOnGround() || mc.player.getAbilities().flying) return;
			Vec3d v = mc.player.getVelocity();
			if (v.y < -0.1) mc.player.setVelocity(v.x, -0.1, v.z);
		}
	}

	static class Scaffold extends Module {
		private int cd;
		Scaffold() { super("Scaffold", "Movement", "Setzt Bloecke unter deine Fuesse (Block in der Hand)"); }
		@Override public void tick() {
			if (mc.player == null || mc.world == null || mc.interactionManager == null || mc.currentScreen != null) return;
			if (cd > 0) { cd--; return; }
			if (!(mc.player.getMainHandStack().getItem() instanceof net.minecraft.item.BlockItem)) return;
			BlockPos target = mc.player.getBlockPos().down();
			if (!mc.world.getBlockState(target).isAir()) return;
			for (Direction d : new Direction[] {Direction.DOWN, Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST}) {
				BlockPos nb = target.offset(d);
				if (mc.world.getBlockState(nb).isAir()) continue;
				Direction face = d.getOpposite();
				Vec3d hit = Vec3d.ofCenter(nb).add(face.getOffsetX() * 0.5, face.getOffsetY() * 0.5, face.getOffsetZ() * 0.5);
				mc.interactionManager.interactBlock(mc.player, Hand.MAIN_HAND, new BlockHitResult(hit, face, nb, false));
				mc.player.swingHand(Hand.MAIN_HAND);
				cd = 2;
				return;
			}
		}
	}

	static class AntiAfk extends Module {
		private int t;
		AntiAfk() { super("AntiAFK", "Movement", "Dreht sich und springt ab und zu, damit du nicht als AFK giltst"); }
		@Override public void tick() {
			if (mc.player == null) return;
			t++;
			if (t % 200 == 0) mc.player.setYaw(mc.player.getYaw() + 25f);
			if (t % 600 == 0 && mc.player.isOnGround()) mc.player.jump();
		}
	}

	static class Esp extends Module {
		Esp() { super("ESP", "Render", "Laesst Spieler und Wesen durch Waende leuchten"); }
		@Override public void tick() {
			if (mc.player == null || mc.world == null) return;
			for (Entity e : mc.world.getEntities()) if (e instanceof LivingEntity && e != mc.player && !(e instanceof ArmorStandEntity)) e.setGlowing(true);
		}
		@Override public void onDisable() {
			if (mc.world == null) return;
			for (Entity e : mc.world.getEntities()) if (e instanceof LivingEntity && e != mc.player) e.setGlowing(false);
		}
	}

	static class Aimbot extends Module {
		Aimbot() { super("Aimbot", "Combat", "Dreht den Blick weich auf das naechste Wesen in Reichweite"); }
		@Override public void tick() {
			if (mc.player == null || mc.world == null || mc.currentScreen != null) return;
			Entity best = null; double bestD = 5.5;
			for (Entity e : mc.world.getEntities()) {
				if (!(e instanceof LivingEntity le) || e == mc.player || !le.isAlive() || e instanceof ArmorStandEntity) continue;
				double d = mc.player.distanceTo(e);
				if (d < bestD) { bestD = d; best = e; }
			}
			if (best == null) return;
			Vec3d t = best.getPos().add(0, best.getHeight() * 0.6, 0), p = mc.player.getEyePos(), dv = t.subtract(p);
			float yaw = (float) Math.toDegrees(Math.atan2(dv.z, dv.x)) - 90f, pitch = (float) -Math.toDegrees(Math.atan2(dv.y, Math.sqrt(dv.x * dv.x + dv.z * dv.z)));
			float dy = net.minecraft.util.math.MathHelper.wrapDegrees(yaw - mc.player.getYaw()), dp = pitch - mc.player.getPitch();
			mc.player.setYaw(mc.player.getYaw() + dy * 0.35f);
			mc.player.setPitch(net.minecraft.util.math.MathHelper.clamp(mc.player.getPitch() + dp * 0.35f, -90f, 90f));
		}
	}

	static class AutoClicker extends Module {
		AutoClicker() { super("AutoClicker", "Combat", "Greift automatisch an, was du anvisierst (nach vollem Cooldown)"); }
		@Override public void tick() {
			if (mc.player == null || mc.interactionManager == null || mc.currentScreen != null) return;
			if (mc.player.getAttackCooldownProgress(0.5f) < 1.0f) return;
			if (mc.crosshairTarget instanceof net.minecraft.util.hit.EntityHitResult hit && hit.getEntity() instanceof LivingEntity le && le.isAlive()) {
				mc.interactionManager.attackEntity(mc.player, hit.getEntity());
				mc.player.swingHand(Hand.MAIN_HAND);
			}
		}
	}

	static class Spider extends Module {
		Spider() { super("Spider", "Movement", "Klettert an Waenden hoch, wenn du dagegen laeufst"); }
		@Override public void tick() {
			if (mc.player == null || !mc.player.horizontalCollision || mc.player.isSneaking()) return;
			Vec3d v = mc.player.getVelocity();
			mc.player.setVelocity(v.x, 0.2, v.z);
		}
	}

	static class AirJump extends Module {
		private boolean was;
		AirJump() { super("AirJump", "Movement", "Springen in der Luft (Leertaste neu druecken)"); }
		@Override public void tick() {
			if (mc.player == null || mc.currentScreen != null) return;
			boolean d = mc.options.jumpKey.isPressed();
			if (d && !was && !mc.player.isOnGround() && !mc.player.isTouchingWater()) mc.player.jump();
			was = d;
		}
	}

	static class HighJump extends Module {
		private boolean was;
		HighJump() { super("HighJump", "Movement", "Spruenge werden viel hoeher"); }
		@Override public void tick() {
			if (mc.player == null) return;
			boolean d = mc.options.jumpKey.isPressed();
			if (d && !was && mc.player.isOnGround()) { Vec3d v = mc.player.getVelocity(); mc.player.setVelocity(v.x, 0.85, v.z); }
			was = d;
		}
	}

	static class AutoWalk extends Module {
		AutoWalk() { super("AutoWalk", "Movement", "Laeuft von selbst vorwaerts"); }
		@Override public void tick() { if (mc.player != null && mc.currentScreen == null) mc.options.forwardKey.setPressed(true); }
		@Override public void onDisable() { mc.options.forwardKey.setPressed(false); }
	}

	static class AutoSneak extends Module {
		AutoSneak() { super("AutoSneak", "Movement", "Haelt Schleichen dauerhaft gedrueckt"); }
		@Override public void tick() { if (mc.player != null && mc.currentScreen == null) mc.options.sneakKey.setPressed(true); }
		@Override public void onDisable() { mc.options.sneakKey.setPressed(false); }
	}
}
