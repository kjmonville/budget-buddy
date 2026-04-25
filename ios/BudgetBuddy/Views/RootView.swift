import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(AppStore.self) private var store

    private var api: APIClient { APIClient(baseURL: Config.apiBase, auth: auth) }

    var body: some View {
        Group {
            if auth.isAuthenticated {
                CalendarView()
                    .task { await store.load(api: api) }
            } else {
                LoginView()
            }
        }
        .environment(\.api, api)
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
