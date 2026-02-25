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
  sed -i '' 's/call\.reject("Unable to get App Info")/call.resolve([:])/' "$APP_FILE"
  echo "Patched AppPlugin.swift"
fi
