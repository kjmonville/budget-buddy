import SwiftUI

struct LoginView: View {
    @Environment(AuthStore.self) private var auth

    @State private var mode: Mode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var error = ""
    @State private var working = false

    enum Mode { case login, register }

    private var api: APIClient { APIClient(baseURL: Config.apiBase, auth: auth) }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 6) {
                HStack(spacing: 10) {
                    Image("BudgetBuddyMark")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 36, height: 36)
                    Text("Budget Buddy")
                        .font(.largeTitle.bold())
                        .foregroundStyle(Color.bbIndigo)
                }
                Text(mode == .login ? "Sign in to continue" : "Create your account")
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))

                SecureField("Password", text: $password)
                    .textContentType(mode == .login ? .password : .newPassword)
                    .padding(12)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
            .padding(.horizontal)

            if !error.isEmpty {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button(action: submit) {
                HStack {
                    if working { ProgressView().tint(.white) }
                    Text(mode == .login ? "Sign in" : "Create account").bold()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.bbIndigo, in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(.white)
            }
            .disabled(working || email.isEmpty || password.isEmpty)
            .padding(.horizontal)

            Button {
                mode = (mode == .login) ? .register : .login
                error = ""
            } label: {
                Text(mode == .login ? "Need an account? Sign up" : "Have an account? Sign in")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }

    private func submit() {
        let e = email.trimmingCharacters(in: .whitespaces).lowercased()
        let p = password
        working = true
        error = ""
        Task {
            do {
                let resp = (mode == .login)
                    ? try await api.login(email: e, password: p)
                    : try await api.register(email: e, password: p)
                auth.setToken(resp.token, email: resp.email)
            } catch {
                self.error = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            working = false
        }
    }
}
