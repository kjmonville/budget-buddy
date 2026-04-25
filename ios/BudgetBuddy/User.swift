import Foundation

struct User: Codable, Hashable {
    let id: String
    let email: String
}

struct AuthResponse: Codable {
    let ok: Bool
    let email: String
    let token: String
}
