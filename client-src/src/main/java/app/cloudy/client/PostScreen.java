package app.cloudy.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.ChatScreen;

import java.util.List;

/** Wolken-Post: zuletzt empfangene Nachrichten, Antworten oeffnet den Chat mit "/post Name ". */
public final class PostScreen extends SocialScreen {
	private int page;
	public PostScreen() { super("Cloud mail"); }

	@Override
	public void render(DrawContext c, int mx, int my, float delta) {
		renderBackground(c, mx, my, delta); btns.clear();
		card(c, 300, 170);
		Ui.cloud(c, cx + 10, cy + 10, 12, 0xFFFFFFFF);
		Ui.txt(c, "Cloud mail", cx + 40, cy + 12, 0xFFFFFFFF);
		List<String[]> l; synchronized (Social.MAIL) { l = List.copyOf(Social.MAIL); }
		if (l.isEmpty()) { Ui.ctr(c, "No cloud mail yet.", cx + cw / 2, cy + 60, 0xFFAFC4DA); Ui.ctr(c, "Send one with /post <friend> <text>", cx + cw / 2, cy + 74, 0xFF7F8CB0); }
		else {
			page = Math.max(0, Math.min(page, l.size() - 1)); String[] m = l.get(page);
			long ago = Math.max(0, (System.currentTimeMillis() - Long.parseLong(m[2])) / 60000);
			Ui.txt(c, "From " + m[0], cx + 14, cy + 36, Theme.accent | 0xFF000000);
			Ui.txt(c, ago < 1 ? "just now" : ago + " min ago", cx + cw - 14 - Ui.w(ago < 1 ? "just now" : ago + " min ago"), cy + 36, 0xFF7F8CB0);
			int y = cy + 52; for (String line : wrap(m[1], cw - 28)) { if (y > cy + ch - 40) break; Ui.txt(c, line, cx + 14, y, 0xFFFFFFFF); y += 11; }
			final String from = m[0];
			btn(cx + 14, cy + ch - 28, 80, "Reply", true, () -> MinecraftClient.getInstance().setScreen(new ChatScreen("/post " + from + " ")));
			if (l.size() > 1) { Ui.ctr(c, (page + 1) + " / " + l.size(), cx + cw / 2, cy + ch - 23, 0xFFAFC4DA); btn(cx + cw / 2 - 52, cy + ch - 28, 22, "<", false, () -> page = Math.max(0, page - 1)); btn(cx + cw / 2 + 30, cy + ch - 28, 22, ">", false, () -> page++); }
		}
		btn(cx + cw - 94, cy + ch - 28, 80, "Close", false, this::close);
		drawBtns(c, mx, my);

	}
}
