import SwiftUI

struct LockView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.api) private var api
    @Environment(\.scenePhase) private var scenePhase

    @State private var errorMessage = ""
    @State private var isUnlocking = false

    var body: some View {
        VStack(spacing: 32) {
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
                if let email = auth.email {
                    Text(email)
                        .foregroundStyle(.secondary)
                }
            }

            VStack(spacing: 12) {
                Button(action: unlock) {
                    HStack {
                        if isUnlocking {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "faceid")
                        }
                        Text("Unlock with Face ID").bold()
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.bbIndigo, in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(.white)
                }
                .disabled(isUnlocking)
                .padding(.horizontal)

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Button {
                    auth.cancelLock()
                } label: {
                    Text("Sign in with password")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await tryUnlock() } }
        }
    }

    private func unlock() {
        Task { await tryUnlock() }
    }

    private func tryUnlock() async {
        guard !isUnlocking else { return }
        isUnlocking = true
        errorMessage = ""

        // Step 1: Face ID → retrieve stored credentials from Keychain.
        guard let (email, password) = await auth.getStoredCredentials() else {
            isUnlocking = false
            errorMessage = "Face ID failed. Try again or sign in with password."
            return
        }

        // Step 2: Exchange credentials for a fresh JWT — never stale.
        guard let api else {
            isUnlocking = false
            errorMessage = "Unable to connect. Sign in with password."
            return
        }
        do {
            let resp = try await api.login(email: email, password: password)
            auth.setToken(resp.token, email: resp.email)
            auth.unlock()
        } catch {
            isUnlocking = false
            let msg = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            // Credentials rejected by server (shouldn't happen unless password changed externally)
            if msg.contains("401") || msg.lowercased().contains("unauthorized") || msg.lowercased().contains("invalid") {
                auth.disableBiometrics()
                auth.cancelLock()
            } else {
                errorMessage = "Sign in failed. Check your connection or sign in with password."
            }
        }
    }
}
