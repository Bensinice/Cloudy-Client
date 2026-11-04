import Foundation
import Security
import WebKit

/// Sichert die Anmeldung (Cookie "cloudy_remote") im iOS-Schluesselbund. WKWebView kann Cookies beim Beenden der App verlieren;
/// so bleibt man angemeldet. Es wird nie ein Passwort gespeichert, nur das vom PC ausgestellte Sitzungs-Token.
enum SessionStore {
    private static let service = "app.cloudy.session"
    private static let name = "cloudy_remote"

    private static func query(_ host: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: host]
    }

    static func save(_ token: String, host: String) {
        let data = Data(token.utf8)
        var q = query(host)
        let upd = SecItemUpdate(q as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if upd == errSecItemNotFound {
            q[kSecValueData as String] = data
            q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(q as CFDictionary, nil)
        }
    }

    static func load(host: String) -> String? {
        var q = query(host)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    static func clear(host: String) { SecItemDelete(query(host) as CFDictionary) }

    /// Cookie aus dem WebView in den Schluesselbund uebernehmen (nach jedem Laden und beim Wechsel in den Hintergrund).
    static func backup(_ store: WKHTTPCookieStore, host: String) {
        store.getAllCookies { cs in
            if let c = cs.first(where: { $0.name == name && $0.domain.contains(host) || ($0.name == name && host.contains($0.domain)) }), !c.value.isEmpty {
                save(c.value, host: host)
            }
        }
    }

    /// Vor dem Laden: fehlt das Cookie im WebView, aus dem Schluesselbund wieder einsetzen (90 Tage; der PC verlaengert es beim Benutzen).
    static func restore(_ store: WKHTTPCookieStore, host: String, done: @escaping () -> Void) {
        store.getAllCookies { cs in
            if cs.contains(where: { $0.name == name && !$0.value.isEmpty }) { done(); return }
            guard let t = load(host: host),
                  let c = HTTPCookie(properties: [.name: name, .value: t, .domain: host, .path: "/",
                                                  .expires: Date().addingTimeInterval(90 * 86400), .secure: "FALSE"]) else { done(); return }
            store.setCookie(c) { done() }
        }
    }
}
