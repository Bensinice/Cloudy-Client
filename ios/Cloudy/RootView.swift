import SwiftUI

/// Erster Start: Adresse des Cloudy-Launchers am PC eintragen (steht dort unter Einstellungen -> Handy-Fernsteuerung). Danach oeffnet die App direkt die Cloudy-Oberflaeche.
struct RootView: View {
    @AppStorage("pcURL") private var pcURL = ""
    @State private var input = ""
    @State private var failed = false
    @State private var reloadToken = 0
    @State private var hint = ""

    private func normalize(_ s: String) -> String? {
        var t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return nil }
        if !t.lowercased().hasPrefix("http://") && !t.lowercased().hasPrefix("https://") { t = "http://" + t }
        guard var c = URLComponents(string: t), let host = c.host, !host.isEmpty else { return nil }
        if c.port == nil && c.scheme == "http" { c.port = 3377 }
        c.path = ""; c.query = nil; c.fragment = nil
        return c.string
    }

    var body: some View {
        if pcURL.isEmpty || URL(string: pcURL) == nil {
            setup
        } else {
            ZStack {
                CloudyWebView(url: URL(string: pcURL)!, reloadToken: reloadToken, onFail: { failed = true }, onOK: { failed = false })
                    .ignoresSafeArea()
                if failed { errorView }
            }
        }
    }

    private var setup: some View {
        VStack(spacing: 16) {
            Text("☁️").font(.system(size: 64))
            Text("Cloudy").font(.largeTitle.bold())
            Text("Gib die Adresse deines PCs ein. Du findest sie in Cloudy am PC unter Einstellungen → Handy-Fernsteuerung (zum Beispiel 192.168.1.5:3377). PC und iPhone müssen im selben WLAN sein.")
                .multilineTextAlignment(.center).foregroundColor(.secondary).font(.callout)
            TextField("192.168.1.5:3377", text: $input)
                .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                .padding(14).background(RoundedRectangle(cornerRadius: 14).stroke(Color.accentColor, lineWidth: 1.5))
            if !hint.isEmpty { Text(hint).foregroundColor(.red).font(.footnote) }
            Button(action: {
                if let u = normalize(input) { pcURL = u; hint = "" } else { hint = "Das sieht nicht wie eine Adresse aus." }
            }) { Text("Verbinden").bold().frame(maxWidth: .infinity).padding(14).background(Color.accentColor).foregroundColor(.white).cornerRadius(14) }
        }
        .padding(28)
    }

    private var errorView: some View {
        VStack(spacing: 14) {
            Text("PC nicht erreichbar").font(.title2.bold())
            Text("Ist Cloudy am PC geöffnet, die Fernsteuerung eingeschaltet und das iPhone im selben WLAN?\n\(pcURL)")
                .multilineTextAlignment(.center).foregroundColor(.secondary).font(.callout)
            Button("Erneut versuchen") { failed = false; reloadToken += 1 }.buttonStyle(.borderedProminent)
            Button("Adresse ändern") { failed = false; input = pcURL; pcURL = "" }.buttonStyle(.bordered)
        }
        .padding(28).frame(maxWidth: .infinity, maxHeight: .infinity).background(.regularMaterial)
    }
}
