import Foundation
import Security
import LocalAuthentication
import Observation

/// JWT storage backed by the Keychain. Single source of truth for auth state.
@Observable
@MainActor
final class AuthStore {
    private static let service = "org.bandwidth.BudgetBuddy"
    private static let account = "jwt"
    private static let biometricAccount = "jwt-biometric"
    private static let udBiometricEnabled = "biometricEnabled"
    private static let udUserEmail = "userEmail"

    private(set) var token: String?
    private(set) var email: String?

    // Face ID state
    var biometricEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: Self.udBiometricEnabled) }
        set { UserDefaults.standard.set(newValue, forKey: Self.udBiometricEnabled) }
    }
    private(set) var isLocked: Bool = false

    var canUseBiometrics: Bool {
        let ctx = LAContext()
        var err: NSError?
        return ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err)
    }

    init() {
        if UserDefaults.standard.bool(forKey: Self.udBiometricEnabled) {
            // Don't read the token yet — Face ID is required first
            self.email = UserDefaults.standard.string(forKey: Self.udUserEmail)
            self.isLocked = true
        } else {
            self.token = Self.read()
        }
    }

    var isAuthenticated: Bool { token != nil }

    func setToken(_ t: String, email: String?) {
        Self.write(t)
        self.token = t
        self.email = email
        if let email {
            UserDefaults.standard.set(email, forKey: Self.udUserEmail)
        }
    }

    func enableBiometrics() {
        guard let t = token else { return }
        Self.writeBiometric(t)
        biometricEnabled = true
    }

    func disableBiometrics() {
        Self.deleteBiometric()
        biometricEnabled = false
        isLocked = false
    }

    func unlockWithBiometrics() async -> Bool {
        let context = LAContext()
        let granted = await withCheckedContinuation { cont in
            context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Unlock Budget Buddy"
            ) { ok, _ in cont.resume(returning: ok) }
        }
        guard granted else { return false }
        let query: [String: Any] = [
            kSecClass as String:              kSecClassGenericPassword,
            kSecAttrService as String:        Self.service,
            kSecAttrAccount as String:        Self.biometricAccount,
            kSecReturnData as String:         true,
            kSecMatchLimit as String:         kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let t = String(data: data, encoding: .utf8) else { return false }
        token = t
        isLocked = false
        return true
    }

    /// Lock the app — token cleared from memory, biometric slot intact. Face ID unlocks on next open.
    func lock() {
        guard biometricEnabled else { return }
        token = nil
        isLocked = true
    }

    /// User chose to fall back to password from the lock screen — drop the lock without disabling biometrics.
    func cancelLock() {
        isLocked = false
    }

    /// Normal sign-out: clears the session but keeps the biometric slot so Face ID can sign back in.
    func logout() {
        Self.delete()
        token = nil
        isLocked = false
    }

    /// Full wipe: removes everything including the biometric slot (e.g. account deletion).
    func clear() {
        Self.delete()
        Self.deleteBiometric()
        token = nil
        email = nil
        isLocked = false
        biometricEnabled = false
        UserDefaults.standard.removeObject(forKey: Self.udUserEmail)
    }

    // MARK: - Keychain (standard slot)

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private static func read() -> String? {
        var q = baseQuery()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
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

    // MARK: - Keychain (biometric-protected slot)

    private static func writeBiometric(_ token: String) {
        // Delete any existing item first to avoid errSecDuplicateItem
        deleteBiometric()
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else { return }
        let add: [String: Any] = [
            kSecClass as String:               kSecClassGenericPassword,
            kSecAttrService as String:         service,
            kSecAttrAccount as String:         biometricAccount,
            kSecValueData as String:           Data(token.utf8),
            kSecAttrAccessControl as String:   access,
        ]
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func deleteBiometric() {
        // Use an LAContext with interactionNotAllowed=true to suppress Face ID prompt on delete
        let context = LAContext()
        context.interactionNotAllowed = true
        let q: [String: Any] = [
            kSecClass as String:                       kSecClassGenericPassword,
            kSecAttrService as String:                 service,
            kSecAttrAccount as String:                 biometricAccount,
            kSecUseAuthenticationContext as String:    context,
        ]
        SecItemDelete(q as CFDictionary)
    }
}
