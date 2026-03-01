import Foundation
import Capacitor
import AuthenticationServices
import UIKit

@objc(SignInWithApplePlugin)
public class SignInWithApplePlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "SignInWithApplePlugin"
    public let jsName = "SignInWithApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var currentCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        self.currentCall = call

        DispatchQueue.main.async {
            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    // MARK: - ASAuthorizationControllerDelegate

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = currentCall else { return }

        if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
            guard let identityTokenData = appleIDCredential.identityToken,
                  let identityToken = String(data: identityTokenData, encoding: .utf8) else {
                call.resolve(["error": "Failed to get identity token"])
                currentCall = nil
                return
            }

            var result: [String: Any] = [
                "identityToken": identityToken
            ]

            if let givenName = appleIDCredential.fullName?.givenName {
                result["givenName"] = givenName
            }
            if let familyName = appleIDCredential.fullName?.familyName {
                result["familyName"] = familyName
            }

            call.resolve(result)
        } else {
            call.resolve(["error": "Unexpected credential type"])
        }

        currentCall = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = currentCall else { return }

        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                call.resolve(["error": "User cancelled", "code": "CANCELED"])
            case .failed:
                call.resolve(["error": "Authorization failed"])
            case .invalidResponse:
                call.resolve(["error": "Invalid response"])
            case .notHandled:
                call.resolve(["error": "Not handled"])
            case .unknown:
                call.resolve(["error": "Unknown error"])
            case .notInteractive:
                call.resolve(["error": "Not interactive"])
            @unknown default:
                call.resolve(["error": "Unknown error"])
            }
        } else {
            call.resolve(["error": error.localizedDescription])
        }

        currentCall = nil
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            return window
        }
        return UIWindow()
    }
}
