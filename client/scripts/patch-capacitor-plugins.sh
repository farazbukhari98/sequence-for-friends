#!/bin/bash
# Patches Capacitor plugins for Swift 6 compatibility
# Run after npm install: node_modules plugins use APIs behind
# $NonescapableTypes guard which isn't available in Swift 6.0.3

SHARE_FILE="node_modules/@capacitor/share/ios/Sources/SharePlugin/SharePlugin.swift"
APP_FILE="node_modules/@capacitor/app/ios/Sources/AppPlugin/AppPlugin.swift"

# Patch SharePlugin - replace getString/getArray/reject/viewController usage
if [ -f "$SHARE_FILE" ]; then
  cat > "$SHARE_FILE" << 'SWIFT'
import Foundation
import Capacitor
import UIKit

@objc(SharePlugin)
public class SharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SharePlugin"
    public let jsName = "Share"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canShare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise)
    ]

    private func getRootViewController() -> UIViewController? {
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            return windowScene.windows.first?.rootViewController
        }
        return nil
    }

    @objc func canShare(_ call: CAPPluginCall) {
        call.resolve(["value": true])
    }

    @objc func share(_ call: CAPPluginCall) {
        var items = [Any]()
        if let text = call.options["text"] as? String { items.append(text) }
        if let url = call.options["url"] as? String, let urlObj = URL(string: url) { items.append(urlObj) }
        let title = call.options["title"] as? String
        if let files = call.options["files"] as? [Any] {
            files.forEach { file in
                if let url = file as? String, let fileUrl = URL(string: url) { items.append(fileUrl) }
            }
        }
        if items.count == 0 {
            call.resolve(["error": "Must provide at least url, text or files"])
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let viewController = self?.getRootViewController() else {
                call.resolve(["error": "No view controller available"])
                return
            }
            if viewController.presentedViewController != nil {
                call.resolve(["error": "Can't share while sharing is in progress"])
                return
            }
            let actionController = UIActivityViewController(activityItems: items, applicationActivities: nil)
            if title != nil { actionController.setValue(title, forKey: "subject") }
            actionController.completionWithItemsHandler = { (activityType, completed, _, activityError) in
                if activityError != nil {
                    call.resolve(["error": "Error sharing item"])
                    return
                }
                if completed {
                    call.resolve(["activityType": activityType?.rawValue ?? ""])
                } else {
                    call.resolve(["error": "Share canceled"])
                }
            }
            if let popoverController = actionController.popoverPresentationController {
                popoverController.sourceView = viewController.view
                popoverController.sourceRect = CGRect(x: viewController.view.bounds.midX, y: viewController.view.bounds.midY, width: 0, height: 0)
                popoverController.permittedArrowDirections = []
            }
            viewController.present(actionController, animated: true, completion: nil)
        }
    }
}
SWIFT
  echo "Patched SharePlugin.swift"
fi

# Patch AppPlugin - replace reject with resolve
if [ -f "$APP_FILE" ]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' 's/call\.reject("Unable to get App Info")/call.resolve([:])/' "$APP_FILE"
  else
    sed -i 's/call\.reject("Unable to get App Info")/call.resolve([:])/' "$APP_FILE"
  fi
  echo "Patched AppPlugin.swift"
fi

# Patch PreferencesPlugin - replace getString/reject with options[] access / resolve
PREFS_FILE="node_modules/@capacitor/preferences/ios/Sources/PreferencesPlugin/PreferencesPlugin.swift"
if [ -f "$PREFS_FILE" ]; then
  cat > "$PREFS_FILE" << 'SWIFT'
import Foundation
import Capacitor

@objc(PreferencesPlugin)
public class PreferencesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PreferencesPlugin"
    public let jsName = "Preferences"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keys", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "migrate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeOld", returnType: CAPPluginReturnPromise)
    ]
    private var preferences = Preferences(with: PreferencesConfiguration())

    @objc func configure(_ call: CAPPluginCall) {
        let group = call.options["group"] as? String
        let configuration: PreferencesConfiguration
        if let group = group {
            if group == "NativeStorage" {
                configuration = PreferencesConfiguration(for: .cordovaNativeStorage)
            } else {
                configuration = PreferencesConfiguration(for: .named(group))
            }
        } else {
            configuration = PreferencesConfiguration()
        }
        preferences = Preferences(with: configuration)
        call.resolve()
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.options["key"] as? String else {
            call.resolve(["error": "Must provide a key"])
            return
        }
        let value = preferences.get(by: key)
        call.resolve(["value": value as Any])
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.options["key"] as? String else {
            call.resolve(["error": "Must provide a key"])
            return
        }
        let value = (call.options["value"] as? String) ?? ""
        preferences.set(value, for: key)
        call.resolve()
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.options["key"] as? String else {
            call.resolve(["error": "Must provide a key"])
            return
        }
        preferences.remove(by: key)
        call.resolve()
    }

    @objc func keys(_ call: CAPPluginCall) {
        let keys = preferences.keys()
        call.resolve(["keys": keys])
    }

    @objc func clear(_ call: CAPPluginCall) {
        preferences.removeAll()
        call.resolve()
    }

    @objc func migrate(_ call: CAPPluginCall) {
        var migrated: [String] = []
        var existing: [String] = []
        let oldPrefix = "_cap_"
        let oldKeys = UserDefaults.standard.dictionaryRepresentation().keys.filter { $0.hasPrefix(oldPrefix) }
        for oldKey in oldKeys {
            let key = String(oldKey.dropFirst(oldPrefix.count))
            let value = UserDefaults.standard.string(forKey: oldKey) ?? ""
            let currentValue = preferences.get(by: key)
            if currentValue == nil {
                preferences.set(value, for: key)
                migrated.append(key)
            } else {
                existing.append(key)
            }
        }
        call.resolve(["migrated": migrated, "existing": existing])
    }

    @objc func removeOld(_ call: CAPPluginCall) {
        let oldPrefix = "_cap_"
        let oldKeys = UserDefaults.standard.dictionaryRepresentation().keys.filter { $0.hasPrefix(oldPrefix) }
        for oldKey in oldKeys {
            UserDefaults.standard.removeObject(forKey: oldKey)
        }
        call.resolve()
    }
}
SWIFT
  echo "Patched PreferencesPlugin.swift"
fi

# Patch PushNotificationsPlugin - replace getString/reject/getArray/JSTypes with Swift 6 compatible code
PUSH_PLUGIN_FILE="node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsPlugin.swift"
if [ -f "$PUSH_PLUGIN_FILE" ]; then
  cat > "$PUSH_PLUGIN_FILE" << 'SWIFT'
import Foundation
import Capacitor
import UserNotifications

enum PushNotificationError: Error {
    case tokenParsingFailed
    case tokenRegistrationFailed
}

enum PushNotificationsPermissions: String {
    case prompt
    case denied
    case granted
}

@objc(PushNotificationsPlugin)
public class PushNotificationsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PushNotificationsPlugin"
    public let jsName = "PushNotifications"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unregister", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDeliveredNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllDeliveredNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeDeliveredNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createChannel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listChannels", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteChannel", returnType: CAPPluginReturnPromise)
    ]
    private let notificationDelegateHandler = PushNotificationsHandler()
    private var appDelegateRegistrationCalled: Bool = false

    override public func load() {
        self.bridge?.notificationRouter.pushNotificationHandler = self.notificationDelegateHandler
        self.notificationDelegateHandler.plugin = self

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(self.didRegisterForRemoteNotificationsWithDeviceToken(notification:)),
                                               name: .capacitorDidRegisterForRemoteNotifications,
                                               object: nil)

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(self.didFailToRegisterForRemoteNotificationsWithError(notification:)),
                                               name: .capacitorDidFailToRegisterForRemoteNotifications,
                                               object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
        call.resolve()
    }

    @objc func unregister(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.unregisterForRemoteNotifications()
            call.resolve()
        }
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        self.notificationDelegateHandler.requestPermissions { granted, error in
            guard error == nil else {
                if let err = error {
                    call.resolve(["error": err.localizedDescription])
                    return
                }
                call.resolve(["error": "unknown error in permissions request"])
                return
            }
            var result: PushNotificationsPermissions = .denied
            if granted { result = .granted }
            call.resolve(["receive": result.rawValue])
        }
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        self.notificationDelegateHandler.checkPermissions { status in
            var result: PushNotificationsPermissions = .prompt
            switch status {
            case .notDetermined:
                result = .prompt
            case .denied:
                result = .denied
            case .ephemeral, .authorized, .provisional:
                result = .granted
            @unknown default:
                result = .prompt
            }
            call.resolve(["receive": result.rawValue])
        }
    }

    @objc func getDeliveredNotifications(_ call: CAPPluginCall) {
        if !appDelegateRegistrationCalled {
            call.resolve(["error": "event capacitorDidRegisterForRemoteNotifications not called"])
            return
        }
        UNUserNotificationCenter.current().getDeliveredNotifications(completionHandler: { (notifications) in
            let ret = notifications.map({ (notification) -> [String: Any] in
                return self.notificationDelegateHandler.makeNotificationRequestJSObject(notification.request)
            })
            call.resolve(["notifications": ret])
        })
    }

    @objc func removeDeliveredNotifications(_ call: CAPPluginCall) {
        if !appDelegateRegistrationCalled {
            call.resolve(["error": "event capacitorDidRegisterForRemoteNotifications not called"])
            return
        }
        guard let notifications = call.options["notifications"] as? [[String: Any]] else {
            call.resolve(["error": "Must supply notifications to remove"])
            return
        }
        let ids = notifications.map { $0["id"] as? String ?? "" }
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
        call.resolve()
    }

    @objc func removeAllDeliveredNotifications(_ call: CAPPluginCall) {
        if !appDelegateRegistrationCalled {
            call.resolve(["error": "event capacitorDidRegisterForRemoteNotifications not called"])
            return
        }
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        DispatchQueue.main.async(execute: {
            UIApplication.shared.applicationIconBadgeNumber = 0
        })
        call.resolve()
    }

    @objc func createChannel(_ call: CAPPluginCall) {
        call.unimplemented("Not available on iOS")
    }

    @objc func deleteChannel(_ call: CAPPluginCall) {
        call.unimplemented("Not available on iOS")
    }

    @objc func listChannels(_ call: CAPPluginCall) {
        call.unimplemented("Not available on iOS")
    }

    @objc public func didRegisterForRemoteNotificationsWithDeviceToken(notification: NSNotification) {
        appDelegateRegistrationCalled = true
        if let deviceToken = notification.object as? Data {
            let deviceTokenString = deviceToken.reduce("", {$0 + String(format: "%02X", $1)})
            notifyListeners("registration", data: ["value": deviceTokenString])
        } else if let stringToken = notification.object as? String {
            notifyListeners("registration", data: ["value": stringToken])
        } else {
            notifyListeners("registrationError", data: ["error": PushNotificationError.tokenParsingFailed.localizedDescription])
        }
    }

    @objc public func didFailToRegisterForRemoteNotificationsWithError(notification: NSNotification) {
        appDelegateRegistrationCalled = true
        guard let error = notification.object as? Error else { return }
        notifyListeners("registrationError", data: ["error": error.localizedDescription])
    }
}
SWIFT
  echo "Patched PushNotificationsPlugin.swift"
fi

# Patch PushNotificationsHandler - replace getConfig().getArray and JSTypes.coerceDictionaryToJSObject
PUSH_HANDLER_FILE="node_modules/@capacitor/push-notifications/ios/Sources/PushNotificationsPlugin/PushNotificationsHandler.swift"
if [ -f "$PUSH_HANDLER_FILE" ]; then
  cat > "$PUSH_HANDLER_FILE" << 'SWIFT'
import Capacitor
import UserNotifications

public class PushNotificationsHandler: NSObject, NotificationHandlerProtocol {
    public weak var plugin: CAPPlugin?
    var notificationRequestLookup = [String: JSObject]()

    public func requestPermissions(with completion: ((Bool, Error?) -> Void)? = nil) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            completion?(granted, error)
        }
    }

    public func checkPermissions(with completion: ((UNAuthorizationStatus) -> Void)? = nil) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            completion?(settings.authorizationStatus)
        }
    }

    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        let notificationData = makeNotificationRequestJSObject(notification.request)
        self.plugin?.notifyListeners("pushNotificationReceived", data: notificationData)

        if let options = notificationRequestLookup[notification.request.identifier] {
            let silent = options["silent"] as? Bool ?? false
            if silent {
                return UNNotificationPresentationOptions.init(rawValue: 0)
            }
        }

        // Read presentationOptions from plugin config
        if let configObj = self.plugin?.getConfig().getConfigJSON(),
           let optionsArray = configObj["presentationOptions"] as? [String] {
            var presentationOptions = UNNotificationPresentationOptions.init()
            optionsArray.forEach { option in
                switch option {
                case "alert":
                    presentationOptions.insert(.alert)
                case "badge":
                    presentationOptions.insert(.badge)
                case "sound":
                    presentationOptions.insert(.sound)
                default:
                    print("Unrecognized presentation option: \(option)")
                }
            }
            return presentationOptions
        }

        return []
    }

    public func didReceive(response: UNNotificationResponse) {
        var data = JSObject()
        let originalNotificationRequest = response.notification.request
        let actionId = response.actionIdentifier

        if actionId == UNNotificationDefaultActionIdentifier {
            data["actionId"] = "tap"
        } else if actionId == UNNotificationDismissActionIdentifier {
            data["actionId"] = "dismiss"
        } else {
            data["actionId"] = actionId
        }

        if let inputType = response as? UNTextInputNotificationResponse {
            data["inputValue"] = inputType.userText
        }

        data["notification"] = makeNotificationRequestJSObject(originalNotificationRequest)
        self.plugin?.notifyListeners("pushNotificationActionPerformed", data: data, retainUntilConsumed: true)
    }

    func makeNotificationRequestJSObject(_ request: UNNotificationRequest) -> JSObject {
        var result: JSObject = [
            "id": request.identifier,
            "title": request.content.title,
            "subtitle": request.content.subtitle,
            "badge": request.content.badge ?? 1,
            "body": request.content.body
        ]
        // Convert userInfo to JSObject manually
        var dataObj = JSObject()
        for (key, value) in request.content.userInfo {
            if let strKey = key as? String {
                if let strVal = value as? String {
                    dataObj[strKey] = strVal
                } else if let numVal = value as? NSNumber {
                    dataObj[strKey] = numVal
                }
            }
        }
        result["data"] = dataObj
        return result
    }
}
SWIFT
  echo "Patched PushNotificationsHandler.swift"
fi

# Ensure SignInWithApplePlugin is in capacitor.config.json packageClassList
CAP_CONFIG="ios/App/App/capacitor.config.json"
if [ -f "$CAP_CONFIG" ]; then
  if ! grep -q "SignInWithApplePlugin" "$CAP_CONFIG"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' 's/"SharePlugin"/"SharePlugin",\n\t\t"SignInWithApplePlugin"/' "$CAP_CONFIG"
    else
      sed -i 's/"SharePlugin"/"SharePlugin",\n\t\t"SignInWithApplePlugin"/' "$CAP_CONFIG"
    fi
    echo "Added SignInWithApplePlugin to packageClassList"
  fi
fi
