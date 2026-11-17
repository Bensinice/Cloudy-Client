package app.cloudy.client.mixin;

import net.minecraft.client.gui.screen.ingame.CreativeInventoryScreen;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.client.gui.screen.ingame.InventoryScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;

/** Dunkles Inventar (Texturen vom Launcher): Titel wie „Inventar“ oder „Truhe“ sind sonst dunkelgrau auf dunkel -> hell zeichnen. */
@Mixin({ HandledScreen.class, InventoryScreen.class, CreativeInventoryScreen.class })
public abstract class InvTitleMixin {
	@ModifyConstant(method = "drawForeground", constant = @Constant(intValue = 4210752), require = 0)
	private int cloudy$lightTitle(int c) { return app.cloudy.client.ModConfig.invDark ? 0xE4E6EE : c; }
}
