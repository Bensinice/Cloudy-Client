package app.cloudy.client.mixin;

import net.minecraft.client.option.SimpleOption;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Setzt den Wert einer Option ohne Bereichspruefung (fuer Zoom unter FOV 30). */
@Mixin(SimpleOption.class)
public interface OptionAccessor {
	@Accessor("value")
	void cloudy$setRaw(Object v);
}
