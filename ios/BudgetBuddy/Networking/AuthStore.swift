import Foundation
import Security
import Observation

/// JWT storage backed by the Keychain. Single source of truth for auth state.
@Observable
@MainActor
final class AuthStore {
    private static let service = "org.bandwidth.BudgetBuddy"
    private static let account = "jwt"

    private(set) var token: String?
    private(set) var email: String?

    init() {
        self.token = Self.read()
    }

    var isAuthenticated: Bool { token != nil }

    func setToken(_ t: String, email: String?) {
        Self.write(t)
        self.token = t
        self.email = email
    }

    func clear() {
        Self.delete()
        token = nil
        email = nil
    }

    // MARK: - Keychain

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private static func read() -> String? {
        var q = baseQuery()
        q[kSecReturnData as String]  = true
        q[kSecMatchLimit as String]  = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let s = String(data: data, encoding: .utf8) else { return nil }
        return s
    }

    private static func write(_ token: String) {
        let data = Data(token.utf8)
        let q = baseQuery()
        let attrs: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(q as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = q
            add[kSecValueData as String] = data
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    private static func delete() {
        SecItemDelete(baseQuery() as CFDictionary)
    }
}
