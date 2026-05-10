import Foundation
import Security
import LocalAuthentication
import Observation

/// JWT storage backed by the Keychain. Single source of truth for auth state.
@Observable
@MainActor
final class AuthStore {
    private static let service           = "org.bandwidth.BudgetBuddy"
    private static let account           = "jwt"
    private static let credentialsAccount = "credentials"  // biometric-protected email+password
    private static let emailAccount      = "userEmail"
    private static let udBiometricEnabled = "biometricEnabled"

    private(set) var token: String?
    private(set) var email: String?

    // Pending biometric enrollment — set after a successful password login,
    // cleared once the user responds to the "Use Face ID?" prompt.
    private(set) var hasPendingBiometricEnrollment = false
    private var pendingEnrollmentEmail = ""
    private var pendingEnrollmentPassword = ""

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
        // One-time migration: remove old jwt-biometric slot replaced by credentials slot.
        Self.deleteLegacyBiometricSlot()

        if UserDefaults.standard.bool(forKey: Self.udBiometricEnabled) {
            // Don't read the token yet — Face ID is required first.
            // Migrate email from UserDefaults to Keychain on first launch after upgrade.
            if let legacyEmail = UserDefaults.standard.string(forKey: "userEmail") {
                Self.writeEmail(legacyEmail)
                UserDefaults.standard.removeObject(forKey: "userEmail")
            }
            self.email = Self.readEmail()
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
            Self.writeEmail(email)
        }
    }

    // MARK: - Biometric enrollment

    /// Queue a biometric enrollment offer after a successful password login.
    /// RootView observes hasPendingBiometricEnrollment and shows the "Use Face ID?" alert.
    func offerBiometricEnrollment(email: String, password: String) {
        pendingEnrollmentEmail = email
        pendingEnrollmentPassword = password
        hasPendingBiometricEnrollment = true
    }

    /// Called when user accepts the "Use Face ID?" prompt.
    func acceptBiometricEnrollment() {
        enableBiometrics(email: pendingEnrollmentEmail, password: pendingEnrollmentPassword)
        clearPendingEnrollment()
    }

    /// Called when user declines the "Use Face ID?" prompt.
    func declineBiometricEnrollment() {
        clearPendingEnrollment()
    }

    private func clearPendingEnrollment() {
        hasPendingBiometricEnrollment = false
        pendingEnrollmentEmail = ""
        pendingEnrollmentPassword = ""
    }

    /// Store email + password in the biometric-protected Keychain slot so Face ID can re-authenticate.
    func enableBiometrics(email: String, password: String) {
        Self.writeCredentials(email: email, password: password)
        biometricEnabled = true
    }

    func disableBiometrics() {
        Self.deleteCredentials()
        biometricEnabled = false
        isLocked = false
    }

    // MARK: - Biometric unlock

    /// Prompt Face ID and return the stored credentials on success.
    /// Returns nil if Face ID fails or no credentials are stored.
    /// The caller is responsible for calling api.login() and then setToken() + unlock().
    func getStoredCredentials() async -> (email: String, password: String)? {
        let context = LAContext()
        let granted = await withCheckedContinuation { cont in
            context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Unlock Budget Buddy"
            ) { ok, _ in cont.resume(returning: ok) }
        }
        guard granted else { return nil }
        return Self.readCredentials(context: context)
    }

    /// Call after a successful Face ID → api.login() sequence to complete the unlock.
    func unlock() {
        isLocked = false
    }

    // MARK: - Lock / cancel

    /// Lock the app on background — token cleared from memory, credentials slot intact.
    func lock() {
        guard biometricEnabled else { return }
        token = nil
        isLocked = true
    }

    /// User chose to fall back to password from the lock screen.
    func cancelLock() {
        isLocked = false
    }

    // MARK: - Session management

    /// Full sign-out: clears the session token AND all biometric state.
    /// Next app launch requires a fresh password login.
    func logout() {
        Self.delete()
        Self.deleteCredentials()
        Self.deleteEmail()
        biometricEnabled = false
        token = nil
        email = nil
        isLocked = false
        clearPendingEnrollment()
    }

    /// Full wipe (account deletion): same as logout.
    func clear() {
        logout()
    }

    // MARK: - Keychain (standard JWT slot)

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String:          kSecClassGenericPassword,
            kSecAttrService as String:    service,
            kSecAttrAccount as String:    account,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
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

    // MARK: - Keychain (biometric-protected credentials slot)

    private struct StoredCredentials: Codable {
        let email: String
        let password: String
    }

    private static func writeCredentials(email: String, password: String) {
        deleteCredentials()
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else { return }
        let creds = StoredCredentials(email: email, password: password)
        guard let data = try? JSONEncoder().encode(creds) else { return }
        let add: [String: Any] = [
            kSecClass as String:             kSecClassGenericPassword,
            kSecAttrService as String:       service,
            kSecAttrAccount as String:       credentialsAccount,
            kSecValueData as String:         data,
            kSecAttrAccessControl as String: access,
        ]
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func readCredentials(context: LAContext) -> (email: String, password: String)? {
        let query: [String: Any] = [
            kSecClass as String:                    kSecClassGenericPassword,
            kSecAttrService as String:              service,
            kSecAttrAccount as String:              credentialsAccount,
            kSecReturnData as String:               true,
            kSecMatchLimit as String:               kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let creds = try? JSONDecoder().decode(StoredCredentials.self, from: data)
        else { return nil }
        return (creds.email, creds.password)
    }

    private static func deleteCredentials() {
        let context = LAContext()
        context.interactionNotAllowed = true
        let q: [String: Any] = [
            kSecClass as String:                    kSecClassGenericPassword,
            kSecAttrService as String:              service,
            kSecAttrAccount as String:              credentialsAccount,
            kSecUseAuthenticationContext as String: context,
        ]
        SecItemDelete(q as CFDictionary)
    }

    /// One-time migration: silently remove the old jwt-biometric Keychain slot.
    private static func deleteLegacyBiometricSlot() {
        let context = LAContext()
        context.interactionNotAllowed = true
        let q: [String: Any] = [
            kSecClass as String:                    kSecClassGenericPassword,
            kSecAttrService as String:              service,
            kSecAttrAccount as String:              "jwt-biometric",
            kSecUseAuthenticationContext as String: context,
        ]
        SecItemDelete(q as CFDictionary)
    }

    // MARK: - Keychain (email slot)

    private static func emailQuery() -> [String: Any] {
        [
            kSecClass as String:          kSecClassGenericPassword,
            kSecAttrService as String:    service,
            kSecAttrAccount as String:    emailAccount,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
    }

    private static func readEmail() -> String? {
        var q = emailQuery()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let s = String(data: data, encoding: .utf8) else { return nil }
        return s
    }

    private static func writeEmail(_ email: String) {
        let data = Data(email.utf8)
        let q = emailQuery()
        let attrs: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(q as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = q
            add[kSecValueData as String] = data
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    private static func deleteEmail() {
        SecItemDelete(emailQuery() as CFDictionary)
    }
}
