import SwiftUI

struct LockView: View {
    @Environment(AuthStore.self) private var auth

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
        .task { await tryUnlock() }
    }

    private func unlock() {
        Task { await tryUnlock() }
    }

    private func tryUnlock() async {
        guard !isUnlocking else { return }
        isUnlocking = true
        errorMessage = ""
        let success = await auth.unlockWithBiometrics()
        isUnlocking = false
        if !success {
            errorMessage = "Face ID failed. Try again or sign in with password."
        }
    }
}
