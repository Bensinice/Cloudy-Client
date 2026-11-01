import SwiftUI
import WebKit

/// Zeigt die Cloudy-Oberflaeche, die der Launcher am PC bereitstellt (lib/remote.js). Die Anmeldung per PIN bleibt gespeichert (Cookie im WebView-Speicher).
struct CloudyWebView: UIViewRepresentable {
    let url: URL
    let reloadToken: Int
    let onFail: () -> Void
    let onOK: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let w = WKWebView(frame: .zero, configuration: cfg)
        w.navigationDelegate = context.coordinator
        w.uiDelegate = context.coordinator
        w.scrollView.contentInsetAdjustmentBehavior = .never
        w.scrollView.bounces = false
        w.isOpaque = false
        w.backgroundColor = UIColor(red: 0.71, green: 0.85, blue: 1.0, alpha: 1)
        w.allowsBackForwardNavigationGestures = false
        w.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12))
        context.coordinator.lastToken = reloadToken
        return w
    }

    func updateUIView(_ w: WKWebView, context: Context) {
        context.coordinator.parent = self
        if context.coordinator.lastToken != reloadToken {
            context.coordinator.lastToken = reloadToken
            w.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12))
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: CloudyWebView
        var lastToken = 0
        init(_ p: CloudyWebView) { parent = p }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { parent.onOK() }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { parent.onFail() }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { parent.onFail() }

        // Links zu anderen Seiten (Modrinth, Discord ...) im normalen Browser oeffnen; die Cloudy-Seite selbst bleibt in der App.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let u = action.request.url, let h = u.host, h != parent.url.host, action.navigationType == .linkActivated || action.targetFrame == nil {
                UIApplication.shared.open(u); decisionHandler(.cancel); return
            }
            decisionHandler(.allow)
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let u = action.request.url { UIApplication.shared.open(u) }
            return nil
        }

        // alert()/confirm() der Oberflaeche (z. B. beim Loeschen) als echte iOS-Dialoge
        private func top() -> UIViewController? {
            UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first?.rootViewController
        }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            top()?.present(a, animated: true) ?? completionHandler()
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            top()?.present(a, animated: true) ?? completionHandler(false)
        }
    }
}
