import Foundation

enum APIError: Error, LocalizedError {
    case http(Int, String?)
    case decode(Error)
    case transport(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .http(_, let msg):  return msg ?? "Request failed"
        case .decode(let e):     return "Decode error: \(e.localizedDescription)"
        case .transport(let e):  return e.localizedDescription
        case .unauthorized:      return "Session expired. Please log in again."
        }
    }
}

/// Thin URLSession wrapper. Reads the JWT from AuthStore on every call so
/// fresh tokens after login are picked up without rewiring.
struct APIClient: @unchecked Sendable {
    let baseURL: URL
    let auth: AuthStore       // @MainActor-isolated; only read via `await currentToken()`
    let session: URLSession

    init(baseURL: URL, auth: AuthStore, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.auth = auth
        self.session = session
    }

    // MARK: - Public endpoints

    // Auth
    func register(email: String, password: String) async throws -> AuthResponse {
        try await post("/auth/register", body: ["email": email, "password": password], authed: false)
    }
    func login(email: String, password: String) async throws -> AuthResponse {
        try await post("/auth/login", body: ["email": email, "password": password], authed: false)
    }

    // Balance
    func getBalance() async throws -> AccountBalance {
        try await get("/balance")
    }
    func setBalance(amount: Double, balanceDate: String) async throws {
        let _: EmptyOK = try await put("/balance", body: ["amount": AnyEncodable(amount),
                                                          "balance_date": AnyEncodable(balanceDate)])
    }

    // Recurring
    func getRecurring() async throws -> [RecurringTransaction] {
        try await get("/recurring")
    }
    func createRecurring(_ data: NewRecurring) async throws -> RecurringTransaction {
        try await post("/recurring", body: data)
    }
    func updateRecurring(id: String, _ data: NewRecurring) async throws -> RecurringTransaction {
        try await put("/recurring/\(id)", body: data)
    }
    func deleteRecurring(id: String) async throws {
        let _: EmptyOK = try await delete("/recurring/\(id)")
    }

    // Adhoc
    func getAdhoc() async throws -> [AdhocTransaction] {
        try await get("/adhoc")
    }
    func createAdhoc(_ data: NewAdhoc) async throws -> AdhocTransaction {
        try await post("/adhoc", body: data)
    }
    func updateAdhoc(id: String, _ data: NewAdhoc) async throws -> AdhocTransaction {
        try await put("/adhoc/\(id)", body: data)
    }
    func deleteAdhoc(id: String) async throws {
        let _: EmptyOK = try await delete("/adhoc/\(id)")
    }

    // Skipped
    func getSkipped() async throws -> [SkippedOccurrence] {
        try await get("/skipped")
    }
    func skip(transactionId: String, kind: String, date: String) async throws -> SkippedOccurrence {
        try await post("/skipped", body: ["transaction_id": transactionId,
                                          "transaction_type": kind,
                                          "date": date])
    }
    func unskip(id: String) async throws {
        let _: EmptyOK = try await delete("/skipped/\(id)")
    }

    // MARK: - Verbs

    private func get<R: Decodable>(_ path: String) async throws -> R {
        try await send(path, method: "GET", body: Optional<EmptyOK>.none, authed: true)
    }
    private func post<B: Encodable, R: Decodable>(_ path: String, body: B, authed: Bool = true) async throws -> R {
        try await send(path, method: "POST", body: body, authed: authed)
    }
    private func put<B: Encodable, R: Decodable>(_ path: String, body: B) async throws -> R {
        try await send(path, method: "PUT", body: body, authed: true)
    }
    private func delete<R: Decodable>(_ path: String) async throws -> R {
        try await send(path, method: "DELETE", body: Optional<EmptyOK>.none, authed: true)
    }

    // MARK: - Core

    private func send<B: Encodable, R: Decodable>(
        _ path: String,
        method: String,
        body: B?,
        authed: Bool
    ) async throws -> R {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if authed, let t = await currentToken() {
            req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await session.data(for: req)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = resp as? HTTPURLResponse else {
            throw APIError.http(0, "Invalid response")
        }
        if http.statusCode == 401 {
            await MainActor.run { auth.logout() }
            throw APIError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            let msg = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw APIError.http(http.statusCode, msg)
        }

        if data.isEmpty, let empty = EmptyOK() as? R { return empty }
        do {
            return try JSONDecoder().decode(R.self, from: data)
        } catch {
            throw APIError.decode(error)
        }
    }

    @MainActor
    private func currentToken() -> String? { auth.token }
}

private struct ErrorBody: Decodable { let error: String? }

/// Sentinel for endpoints that return `{ ok: true }` and we don't care.
struct EmptyOK: Codable { var ok: Bool? }

/// Lets us pack heterogenous values into a body dictionary while staying Encodable.
struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void
    init<T: Encodable>(_ v: T) { self._encode = v.encode }
    func encode(to encoder: Encoder) throws { try _encode(encoder) }
}
