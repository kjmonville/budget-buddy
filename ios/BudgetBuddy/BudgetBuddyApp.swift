import SwiftUI

@main
struct BudgetBuddyApp: App {
    @State private var auth = AuthStore()
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(store)
        }
    }
}
