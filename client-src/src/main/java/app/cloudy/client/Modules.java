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
		all.add(new AutoEat());
		all.add(new NoFall());
		all.add(new Step());
		all.add(new AutoRespawn());
		all.add(new AutoTool());
		all.add(new AutoJump());
		all.add(new SafeWalk());
		all.add(new AntiKnockback());
		all.add(new AutoFish());
		all.add(new AutoMine());
		all.add(new FastLadder());
		all.add(new AntiBlind());
		all.add(new BoatFly());
		all.add(new ElytraBoost());
		all.add(new AutoRefill());
		all.add(new Parkour());
		all.add(new BunnyHop());
		all.add(new AutoLog());
		all.add(new LongJump());
		all.add(new AutoBow());
		all.add(new AntiVoid());
		all.add(new ChestStealer());
		all.add(new Dolphin());
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

	// ---------- Neue Module (0.9.139) ----------

	static class AutoEat extends Module {
		private boolean eating; private int prev = -1;
		AutoEat() { super("AutoEat", "Player", "Isst automatisch Essen aus der Hotbar, wenn du Hunger hast"); }
		@Override public void tick() {
			if (mc.player == null || mc.currentScreen != null) { stop(); return; }
			var inv = mc.player.getInventory();
			if (mc.player.getHungerManager().getFoodLevel() >= 16) { stop(); return; }
			if (!eating) {
				for (int i = 0; i < 9; i++) {
					if (inv.getStack(i).get(net.minecraft.component.DataComponentTypes.FOOD) == null) continue;
					prev = inv.selectedSlot; inv.selectedSlot = i; eating = true; break;
				}
			}
			if (eating) {
				if (inv.getStack(inv.selectedSlot).get(net.minecraft.component.DataComponentTypes.FOOD) == null) { stop(); return; }
				mc.options.useKey.setPressed(true);
			}
		}
		private void stop() {
			if (!eating) return;
			eating = false; mc.options.useKey.setPressed(false);
			if (mc.player != null && prev >= 0 && prev < 9) mc.player.getInventory().selectedSlot = prev;
			prev = -1;
		}
		@Override public void onDisable() { stop(); }
	}

	static class NoFall extends Module {
		NoFall() { super("NoFall", "Player", "Kein Fallschaden (meldet dem Server Bodenkontakt)"); }
		@Override public void tick() {
			if (mc.player == null || mc.player.networkHandler == null || mc.player.isCreative()) return;
			if (mc.player.fallDistance > 2.5f && mc.player.getVelocity().y < -0.3)
				mc.player.networkHandler.sendPacket(new net.minecraft.network.packet.c2s.play.PlayerMoveC2SPacket.OnGroundOnly(true, mc.player.horizontalCollision));
		}
	}

	static class Step extends Module {
		Step() { super("Step", "Movement", "Steigt ganze Bloecke hoch ohne zu springen"); }
		private void h(double v) {
			if (mc.player == null) return;
			var a = mc.player.getAttributeInstance(net.minecraft.entity.attribute.EntityAttributes.STEP_HEIGHT);
			if (a != null && a.getBaseValue() != v) a.setBaseValue(v);
		}
		@Override public void tick() { h(mc.player != null && mc.player.isSneaking() ? 0.6 : 1.0); }
		@Override public void onDisable() { h(0.6); }
	}

	static class AutoRespawn extends Module {
		AutoRespawn() { super("AutoRespawn", "Player", "Steht nach dem Tod sofort wieder auf"); }
		@Override public void tick() {
			if (mc.player != null && mc.currentScreen instanceof net.minecraft.client.gui.screen.DeathScreen) { mc.player.requestRespawn(); mc.setScreen(null); }
		}
	}

	static class AutoTool extends Module {
		AutoTool() { super("AutoTool", "Player", "Nimmt beim Abbauen das schnellste Werkzeug aus der Hotbar"); }
		@Override public void tick() {
			if (mc.player == null || mc.world == null || mc.currentScreen != null || !mc.options.attackKey.isPressed()) return;
			if (!(mc.crosshairTarget instanceof BlockHitResult bh) || bh.getType() != net.minecraft.util.hit.HitResult.Type.BLOCK) return;
			var st = mc.world.getBlockState(bh.getBlockPos());
			var inv = mc.player.getInventory();
			int best = inv.selectedSlot; float bs = inv.getStack(best).getMiningSpeedMultiplier(st);
			for (int i = 0; i < 9; i++) { float f = inv.getStack(i).getMiningSpeedMultiplier(st); if (f > bs + 0.01f) { bs = f; best = i; } }
			inv.selectedSlot = best;
		}
	}

	static class AutoJump extends Module {
		AutoJump() { super("AutoJump", "Movement", "Springt automatisch, wenn du gegen eine Stufe laeufst"); }
		@Override public void tick() {
			if (mc.player != null && mc.player.isOnGround() && mc.player.horizontalCollision && !mc.player.isSneaking() && mc.player.input != null && mc.player.input.movementForward > 0) mc.player.jump();
		}
	}

	static class SafeWalk extends Module {
		private boolean held;
		SafeWalk() { super("SafeWalk", "Movement", "Schleicht automatisch an Kanten, damit du nicht runterfaellst"); }
		@Override public void tick() {
			if (mc.player == null || mc.world == null || mc.currentScreen != null) { rel(); return; }
			Vec3d v = mc.player.getVelocity(), p = mc.player.getPos();
			boolean edge = mc.player.isOnGround() && mc.world.getBlockState(BlockPos.ofFloored(p.x + v.x * 4, p.y - 0.6, p.z + v.z * 4)).isAir() && mc.world.getBlockState(BlockPos.ofFloored(p.x + v.x * 4, p.y - 1.6, p.z + v.z * 4)).isAir();
			if (edge) { mc.options.sneakKey.setPressed(true); held = true; } else rel();
		}
		private void rel() { if (held) { mc.options.sneakKey.setPressed(false); held = false; } }
		@Override public void onDisable() { rel(); }
	}

	static class AntiKnockback extends Module {
		AntiKnockback() { super("AntiKnockback", "Combat", "Verringert den Rueckstoss, wenn du getroffen wirst"); }
		@Override public void tick() {
			if (mc.player == null) return;
			if (mc.player.hurtTime == mc.player.maxHurtTime - 1 && mc.player.maxHurtTime > 0) { Vec3d v = mc.player.getVelocity(); mc.player.setVelocity(v.x * 0.15, Math.min(v.y, 0.1), v.z * 0.15); }
		}
	}

	static class AutoFish extends Module {
		private int wait, recast; private double lastY = Double.NaN;
		AutoFish() { super("AutoFish", "Player", "Zieht die Angel ein, wenn etwas anbeisst, und wirft neu aus"); }
		@Override public void tick() {
			if (mc.player == null || mc.interactionManager == null || mc.currentScreen != null) return;
			if (!mc.player.getMainHandStack().isOf(Items.FISHING_ROD)) return;
			if (recast > 0) { if (--recast == 0) mc.interactionManager.interactItem(mc.player, Hand.MAIN_HAND); return; }
			var hook = mc.player.fishHook;
			if (hook == null) { lastY = Double.NaN; wait = 0; return; }
			if (!hook.isTouchingWater()) { lastY = hook.getY(); wait = 0; return; }
			wait++;
			double y = hook.getY();
			if (wait > 30 && !Double.isNaN(lastY) && lastY - y > 0.12) {
				mc.interactionManager.interactItem(mc.player, Hand.MAIN_HAND);
				mc.player.swingHand(Hand.MAIN_HAND);
				recast = 15; wait = 0; lastY = Double.NaN; return;
			}
			lastY = y;
		}
	}

	static class AutoMine extends Module {
		private boolean held;
		AutoMine() { super("AutoMine", "World", "Baut den anvisierten Block automatisch ab"); }
		@Override public void tick() {
			boolean on = mc.player != null && mc.currentScreen == null && mc.crosshairTarget != null && mc.crosshairTarget.getType() == net.minecraft.util.hit.HitResult.Type.BLOCK;
			if (on) { mc.options.attackKey.setPressed(true); held = true; } else if (held) { mc.options.attackKey.setPressed(false); held = false; }
		}
		@Override public void onDisable() { if (held) mc.options.attackKey.setPressed(false); held = false; }
	}

	static class FastLadder extends Module {
		FastLadder() { super("FastLadder", "Movement", "Klettert Leitern und Ranken schneller hoch"); }
		@Override public void tick() {
			if (mc.player == null || !mc.player.isClimbing() || mc.player.isSneaking()) return;
			if (mc.player.horizontalCollision || mc.options.jumpKey.isPressed()) { Vec3d v = mc.player.getVelocity(); mc.player.setVelocity(v.x, 0.28, v.z); }
		}
	}

	static class AntiBlind extends Module {
		AntiBlind() { super("AntiBlind", "Render", "Entfernt Blindheit, Dunkelheit und Uebelkeit"); }
		@Override public void tick() {
			if (mc.player == null) return;
			if (mc.player.hasStatusEffect(StatusEffects.BLINDNESS)) mc.player.removeStatusEffect(StatusEffects.BLINDNESS);
			if (mc.player.hasStatusEffect(StatusEffects.DARKNESS)) mc.player.removeStatusEffect(StatusEffects.DARKNESS);
			if (mc.player.hasStatusEffect(StatusEffects.NAUSEA)) mc.player.removeStatusEffect(StatusEffects.NAUSEA);
		}
	}

	static class BoatFly extends Module {
		BoatFly() { super("BoatFly", "Movement", "Boot fliegt mit Leertaste hoch"); }
		@Override public void tick() {
			if (mc.player == null) return;
			Entity veh = mc.player.getVehicle();
			if (veh == null || !(veh instanceof net.minecraft.entity.vehicle.AbstractBoatEntity)) return;
			Vec3d v = veh.getVelocity();
			veh.setVelocity(v.x, mc.options.jumpKey.isPressed() ? 0.3 : Math.max(v.y, -0.05), v.z);
		}
	}

	static class ElytraBoost extends Module {
		ElytraBoost() { super("ElytraBoost", "Movement", "Beschleunigt beim Elytra-Gleiten in Blickrichtung (W halten)"); }
		@Override public void tick() {
			if (mc.player == null || !mc.player.isGliding() || !mc.options.forwardKey.isPressed()) return;
			Vec3d look = mc.player.getRotationVector(), v = mc.player.getVelocity();
			if (v.length() < 1.6) mc.player.setVelocity(v.add(look.multiply(0.05)));
		}
	}

	static class AutoRefill extends Module {
		private final net.minecraft.item.Item[] last = new net.minecraft.item.Item[9]; private int cd;
		AutoRefill() { super("AutoRefill", "Player", "Fuellt leere Hotbar-Plaetze mit dem gleichen Item aus dem Inventar auf"); }
		@Override public void tick() {
			if (mc.player == null || mc.interactionManager == null || mc.currentScreen != null) return;
			if (cd > 0) { cd--; return; }
			var inv = mc.player.getInventory();
			for (int h = 0; h < 9; h++) {
				var st = inv.getStack(h);
				if (!st.isEmpty()) { last[h] = st.getItem(); continue; }
				if (last[h] == null) continue;
				for (int i = 9; i < 36; i++) {
					if (!inv.getStack(i).isOf(last[h])) continue;
					mc.interactionManager.clickSlot(mc.player.playerScreenHandler.syncId, i, h, SlotActionType.SWAP, mc.player);
					cd = 4; return;
				}
				last[h] = null;
			}
		}
	}

	static class Parkour extends Module {
		Parkour() { super("Parkour", "Movement", "Springt automatisch an Blockkanten ab"); }
		@Override public void tick() {
			if (mc.player == null || mc.world == null || !mc.player.isOnGround() || mc.player.isSneaking()) return;
			Vec3d v = mc.player.getVelocity(), p = mc.player.getPos();
			if (v.horizontalLengthSquared() < 0.002) return;
			if (mc.world.getBlockState(BlockPos.ofFloored(p.x + v.x * 2, p.y - 0.5, p.z + v.z * 2)).isAir()) mc.player.jump();
		}
	}

	static class BunnyHop extends Module {
		BunnyHop() { super("BunnyHop", "Movement", "Huepft beim Laufen automatisch"); }
		@Override public void tick() {
			if (mc.player == null || mc.player.input == null || !mc.player.isOnGround() || mc.player.isSneaking() || mc.player.isTouchingWater()) return;
			if (mc.player.input.movementForward != 0 || mc.player.input.movementSideways != 0) mc.player.jump();
		}
	}

	static class AutoLog extends Module {
		AutoLog() { super("AutoLog", "Combat", "Trennt die Verbindung, wenn deine Leben unter 3 Herzen fallen"); }
		@Override public void tick() {
			if (mc.player == null || mc.player.networkHandler == null || mc.player.isCreative() || !mc.player.isAlive()) return;
			if (mc.player.getHealth() <= 6f) {
				set(false);
				mc.player.networkHandler.getConnection().disconnect(net.minecraft.text.Text.literal("[Cloudy] AutoLog: wenig Leben (" + Math.round(mc.player.getHealth()) + " HP)"));
			}
		}
	}

	static class LongJump extends Module {
		private boolean was;
		LongJump() { super("LongJump", "Movement", "Weitere Spruenge beim Rennen"); }
		@Override public void tick() {
			if (mc.player == null) return;
			boolean d = mc.options.jumpKey.isPressed();
			if (d && !was && mc.player.isOnGround() && mc.player.isSprinting()) {
				double yaw = Math.toRadians(mc.player.getYaw());
				Vec3d v = mc.player.getVelocity();
				mc.player.setVelocity(-Math.sin(yaw) * 0.75, Math.max(v.y, 0.42), Math.cos(yaw) * 0.75);
			}
			was = d;
		}
	}

	static class AutoBow extends Module {
		AutoBow() { super("AutoBow", "Combat", "Laesst den Bogen automatisch los, sobald er voll gespannt ist"); }
		@Override public void tick() {
			if (mc.player == null || mc.interactionManager == null || !mc.player.isUsingItem()) return;
			if (mc.player.getActiveItem().isOf(Items.BOW) && mc.player.getItemUseTime() >= 20) mc.interactionManager.stopUsingItem(mc.player);
		}
	}

	static class AntiVoid extends Module {
		AntiVoid() { super("AntiVoid", "Movement", "Wirft dich nach oben, wenn du ins Void faellst"); }
		@Override public void tick() {
			if (mc.player == null || mc.world == null) return;
			if (mc.player.getY() < mc.world.getBottomY() + 1 && mc.player.getVelocity().y < 0) { Vec3d v = mc.player.getVelocity(); mc.player.setVelocity(v.x, 1.2, v.z); mc.player.fallDistance = 0; }
		}
	}

	static class ChestStealer extends Module {
		private int cd, idx;
		ChestStealer() { super("ChestStealer", "World", "Raeumt geoeffnete Truhen automatisch in dein Inventar"); }
		@Override public void tick() {
			if (mc.player == null || mc.interactionManager == null) return;
			if (!(mc.currentScreen instanceof net.minecraft.client.gui.screen.ingame.GenericContainerScreen gs)) { idx = 0; return; }
			if (cd > 0) { cd--; return; }
			var h = gs.getScreenHandler(); int n = h.getRows() * 9;
			while (idx < n) {
				int i = idx++;
				if (h.getSlot(i).hasStack()) { mc.interactionManager.clickSlot(h.syncId, i, 0, SlotActionType.QUICK_MOVE, mc.player); cd = 2; return; }
			}
		}
	}

	static class Dolphin extends Module {
		Dolphin() { super("Dolphin", "Movement", "Schwimmt automatisch oben und schneller im Wasser"); }
		@Override public void tick() {
			if (mc.player == null || !mc.player.isTouchingWater() || mc.player.isSneaking() || mc.player.isSwimming()) return;
			Vec3d v = mc.player.getVelocity(); mc.player.setVelocity(v.x * 1.04, Math.max(v.y, 0.04), v.z * 1.04);
		}
	}
}
