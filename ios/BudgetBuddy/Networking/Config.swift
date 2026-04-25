import Foundation

enum Config {
    /// Base URL for the Budget Buddy worker. Reads `BB_API_BASE` from Info.plist
    /// so dev/prod can be configured per build configuration without code changes.
    /// Falls back to localhost dev for the simulator.
    static var apiBase: URL {
        if let s = Bundle.main.object(forInfoDictionaryKey: "BB_API_BASE") as? String,
           let u = URL(string: s) {
            return u
        }
        return URL(string: "http://localhost:5173/api")!
    }
}
