import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    private var api: APIClient { APIClient(baseURL: Config.apiBase, auth: auth) }

    var body: some View {
        Group {
            if auth.isLocked {
                LockView()
            } else if auth.isAuthenticated {
                CalendarView()
                    .task { await store.load(api: api) }
                    .overlay {
                        // Cover sensitive content before iOS takes the app-switcher screenshot (issue 9)
                        if scenePhase == .inactive || scenePhase == .background {
                            Color(UIColor.systemBackground)
                                .ignoresSafeArea()
                                .overlay(
                                    Image(systemName: "lock.fill")
                                        .font(.system(size: 48))
                                        .foregroundStyle(.secondary)
                                )
                        }
                    }
            } else {
                LoginView()
            }
        }
        .environment(\.api, api)
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { auth.lock() }
        }
        .alert("Use Face ID?", isPresented: Binding(
            get: { auth.hasPendingBiometricEnrollment },
            set: { if !$0 { auth.declineBiometricEnrollment() } }
        )) {
            Button("Enable Face ID") { auth.acceptBiometricEnrollment() }
            Button("Not Now", role: .cancel) { auth.declineBiometricEnrollment() }
        } message: {
            Text("Unlock Budget Buddy instantly with Face ID next time.")
        }
    }
}

// MARK: - APIClient via environment

private struct APIKey: EnvironmentKey {
    static let defaultValue: APIClient? = nil
}

extension EnvironmentValues {
    var api: APIClient? {
        get { self[APIKey.self] }
        set { self[APIKey.self] = newValue }
    }
}
