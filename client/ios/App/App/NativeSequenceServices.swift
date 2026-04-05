import Foundation
import AuthenticationServices
import Network
import OSLog
import Security
import SwiftUI
import UIKit
import UserNotifications

enum NativeConfig {
    static let apiBaseURL = URL(string: "https://sequence-for-friends.farazbukhari98.workers.dev")!
    static let websocketBaseURL = URL(string: "wss://sequence-for-friends.farazbukhari98.workers.dev")!
    static let reconnectRetryDelays: [UInt64] = [0, 500_000_000, 1_500_000_000, 3_000_000_000]
    static let reconnectVisibleDelay: UInt64 = 850_000_000
    static let websocketHeartbeatInterval: UInt64 = 20_000_000_000
}

extension Notification.Name {
    static let apnsDeviceTokenDidUpdate = Notification.Name("apnsDeviceTokenDidUpdate")
    static let inviteRoomDidOpen = Notification.Name("inviteRoomDidOpen")
}

private let nativeLogger = Logger(
    subsystem: "com.farazbukhari.sequence",
    category: "NativeSequence"
)

enum ConnectionPhase: String, Equatable {
    case idle
    case connecting
    case attached
    case recovering
    case offline
    case terminalFailure
}

struct ConnectionStatus: Equatable {
    let phase: ConnectionPhase
    let message: String?
    let attempt: Int
    let canRetry: Bool

    static let idle = ConnectionStatus(phase: .idle, message: nil, attempt: 0, canRetry: false)

    static func connecting(_ message: String) -> ConnectionStatus {
        ConnectionStatus(phase: .connecting, message: message, attempt: 0, canRetry: false)
    }

    static func attached(_ message: String? = nil) -> ConnectionStatus {
        ConnectionStatus(phase: .attached, message: message, attempt: 0, canRetry: false)
    }

    static func recovering(message: String, attempt: Int) -> ConnectionStatus {
        ConnectionStatus(phase: .recovering, message: message, attempt: attempt, canRetry: false)
    }

    static func offline(_ message: String) -> ConnectionStatus {
        ConnectionStatus(phase: .offline, message: message, attempt: 0, canRetry: true)
    }

    static func terminalFailure(_ message: String, canRetry: Bool) -> ConnectionStatus {
        ConnectionStatus(phase: .terminalFailure, message: message, attempt: 0, canRetry: canRetry)
    }
}

enum PushPermissionState: Equatable {
    case unknown
    case notDetermined
    case denied
    case authorized

    var isAuthorized: Bool {
        self == .authorized
    }
}

enum UsernameAvailabilityState: Equatable {
    case idle
    case checking
    case available
    case unavailable(String)
}

struct UsernameAvailabilityResponse: Codable {
    let available: Bool
    let error: String?
}

enum NativeReconnectErrorCode: String, Codable {
    case invalidToken = "INVALID_TOKEN"
    case roomExpired = "ROOM_EXPIRED"
}

struct AnyEncodable: Encodable {
    private let encodeBlock: (Encoder) throws -> Void

    init<T: Encodable>(_ wrapped: T) {
        encodeBlock = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeBlock(encoder)
    }
}

struct APIError: LocalizedError {
    let message: String
    let statusCode: Int?

    var errorDescription: String? { message }
}

enum DeepLinkParser {
    static func roomCode(from url: URL) -> String? {
        if url.scheme == "sequencegame" {
            let parts = url.pathComponents.filter { $0 != "/" }
            if ["join", "invite"].contains(url.host ?? ""), let code = parts.first {
                return normalized(code)
            }
        }

        let pathParts = url.pathComponents.filter { $0 != "/" }
        if pathParts.count >= 2, ["join", "invite"].contains(pathParts[0]) {
            return normalized(pathParts[1])
        }

        if let room = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { ["room", "code"].contains($0.name) })?
            .value {
            return normalized(room)
        }

        return nil
    }

    private static func normalized(_ code: String) -> String {
        code.uppercased().replacingOccurrences(of: "[^A-Z0-9]", with: "", options: .regularExpression)
    }
}

final class SessionStore {
    private enum DefaultsKey {
        static let user = "native_user"
        static let installSentinel = "native_install_sentinel"
        static let appleUserID = "native_apple_user_id"
        static let lastPushToken = "native_last_push_token"
    }

    private enum KeychainAccount {
        static let sessionToken = "session_token"
        static let roomSession = "room_session"
    }

    private let defaults = UserDefaults.standard
    private let service = "com.farazbukhari.sequence"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    func saveSessionToken(_ token: String?) {
        setKeychainData(token.map { Data($0.utf8) }, account: KeychainAccount.sessionToken)
    }

    func sessionToken() -> String? {
        guard let data = keychainData(account: KeychainAccount.sessionToken) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func clearSessionToken() {
        setKeychainData(nil, account: KeychainAccount.sessionToken)
    }

    func saveUser(_ user: UserProfile?) {
        if let user, let data = try? encoder.encode(user) {
            defaults.set(data, forKey: DefaultsKey.user)
        } else {
            defaults.removeObject(forKey: DefaultsKey.user)
        }
    }

    func storedUser() -> UserProfile? {
        guard let data = defaults.data(forKey: DefaultsKey.user) else { return nil }
        return try? decoder.decode(UserProfile.self, from: data)
    }

    func saveRoomSession(_ session: RoomSession?) {
        if let session, let data = try? encoder.encode(session) {
            setKeychainData(data, account: KeychainAccount.roomSession)
        } else {
            setKeychainData(nil, account: KeychainAccount.roomSession)
        }
    }

    func roomSession() -> RoomSession? {
        guard let data = keychainData(account: KeychainAccount.roomSession) else { return nil }
        return try? decoder.decode(RoomSession.self, from: data)
    }

    func saveAppleUserID(_ userID: String?) {
        if let userID, !userID.isEmpty {
            defaults.set(userID, forKey: DefaultsKey.appleUserID)
        } else {
            defaults.removeObject(forKey: DefaultsKey.appleUserID)
        }
    }

    func appleUserID() -> String? {
        defaults.string(forKey: DefaultsKey.appleUserID)
    }

    func saveLastPushToken(_ token: String?) {
        if let token, !token.isEmpty {
            defaults.set(token, forKey: DefaultsKey.lastPushToken)
        } else {
            defaults.removeObject(forKey: DefaultsKey.lastPushToken)
        }
    }

    func lastPushToken() -> String? {
        defaults.string(forKey: DefaultsKey.lastPushToken)
    }

    func prepareInstall() -> Bool {
        let hasSentinel = defaults.string(forKey: DefaultsKey.installSentinel) != nil
        let hasPersistedArtifacts =
            sessionToken() != nil ||
            roomSession() != nil ||
            storedUser() != nil ||
            appleUserID() != nil ||
            lastPushToken() != nil

        if !hasSentinel && hasPersistedArtifacts {
            nativeLogger.notice("Detected reinstall with persisted secure artifacts; clearing local state")
            clearInstallScopedState()
        }

        if !hasSentinel {
            defaults.set(UUID().uuidString, forKey: DefaultsKey.installSentinel)
        }

        return !hasSentinel && hasPersistedArtifacts
    }

    func hasPersistedAuthArtifacts() -> Bool {
        sessionToken() != nil || roomSession() != nil || storedUser() != nil || appleUserID() != nil
    }

    func clearInstallScopedState() {
        clearSessionToken()
        saveUser(nil)
        saveRoomSession(nil)
        saveAppleUserID(nil)
        saveLastPushToken(nil)
    }

    private func keychainData(account: String) -> Data? {
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ] as CFDictionary
        var item: CFTypeRef?
        guard SecItemCopyMatching(query, &item) == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return data
    }

    private func setKeychainData(_ data: Data?, account: String) {
        let baseQuery = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ] as CFDictionary
        SecItemDelete(baseQuery)
        guard let data else { return }
        SecItemAdd([
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecValueData: data,
        ] as CFDictionary, nil)
    }
}

final class APIClient: @unchecked Sendable {
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(session: URLSession = .shared) {
        self.session = session
    }

    func request<Response: Decodable>(
        path: String,
        method: String = "GET",
        token: String? = nil,
        body: AnyEncodable? = nil
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: NativeConfig.apiBaseURL) else {
            throw APIError(message: "Invalid request URL", statusCode: nil)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Invalid response", statusCode: nil)
        }

        guard 200..<300 ~= http.statusCode else {
            let message = (try? decoder.decode([String: String].self, from: data)["error"]) ?? "Request failed (\(http.statusCode))"
            throw APIError(message: message, statusCode: http.statusCode)
        }

        return try decoder.decode(Response.self, from: data)
    }
}

@MainActor
final class PushPermissionCoordinator {
    func authorizationStatus() async -> UNAuthorizationStatus {
        await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                continuation.resume(returning: settings.authorizationStatus)
            }
        }
    }

    func requestAuthorization() async throws -> Bool {
        try await withCheckedThrowingContinuation { continuation in
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

@MainActor
final class SocketManager: @unchecked Sendable {
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private var task: URLSessionWebSocketTask?
    private var pending = [String: (Result<Data, Error>) -> Void]()
    private var receiveTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?
    private var nextMessageID = 0

    var onConnected: (() -> Void)?
    var onDisconnected: (() -> Void)?
    var onError: ((String) -> Void)?
    var onTransportInterrupted: ((String) -> Void)?
    var onRoomInfo: ((RoomInfo) -> Void)?
    var onGameState: ((ClientGameState) -> Void)?
    var onCutCards: (([CutCard]) -> Void)?
    var onTeamSwitchRequest: ((TeamSwitchRequest) -> Void)?
    var onTeamSwitchResponse: ((TeamSwitchResponse) -> Void)?
    var onGameModeInfo: ((GameModeInfo) -> Void)?
    var onRoomClosed: ((String) -> Void)?

    func connect(path: String, authToken: String?) async throws {
        disconnect(notify: false)
        guard let baseURL = URL(string: path, relativeTo: NativeConfig.websocketBaseURL) else {
            throw APIError(message: "Invalid socket URL", statusCode: nil)
        }
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: true)!
        if let authToken {
            components.queryItems = (components.queryItems ?? []) + [URLQueryItem(name: "auth", value: authToken)]
        }
        guard let url = components.url else { throw APIError(message: "Invalid socket URL", statusCode: nil) }
        task = URLSession.shared.webSocketTask(with: url)
        task?.resume()
        try await waitForSocketOpen()
        onConnected?()
        receiveTask = Task { [weak self] in await self?.receiveLoop() }
        heartbeatTask = Task { [weak self] in await self?.heartbeatLoop() }
    }

    func disconnect(notify: Bool = true) {
        receiveTask?.cancel()
        receiveTask = nil
        heartbeatTask?.cancel()
        heartbeatTask = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        pending.values.forEach { $0(.failure(APIError(message: "Connection closed", statusCode: nil))) }
        pending.removeAll()
        if notify {
            onDisconnected?()
        }
    }

    func send(type: String, data: Encodable? = nil) async throws {
        _ = try await requestRaw(type: type, data: data, expectResponse: false)
    }

    func request<Response: Decodable>(type: String, data: Encodable? = nil) async throws -> Response {
        let raw = try await requestRaw(type: type, data: data, expectResponse: true)
        return try decodeObject(raw)
    }

    private func waitForSocketOpen() async throws {
        guard let task else {
            throw APIError(message: "Socket is not available", statusCode: nil)
        }
        try await sendPing(on: task)
    }

    private func requestRaw(type: String, data: Encodable?, expectResponse: Bool) async throws -> Data {
        guard let task else {
            throw APIError(message: "Connection is not active", statusCode: nil)
        }

        let messageID = expectResponse ? "msg_\(nextMessageID + 1)" : nil
        nextMessageID += 1
        var envelope: [String: Any] = ["type": type]
        if let messageID { envelope["id"] = messageID }
        if let data { envelope["data"] = try encodeJSONObject(data) }
        let payload = try JSONSerialization.data(withJSONObject: envelope)
        let text = String(decoding: payload, as: UTF8.self)

        if !expectResponse {
            do {
                try await task.send(.string(text))
            } catch {
                handleTransportFailure(error)
                throw error
            }
            return Data()
        }

        return try await withCheckedThrowingContinuation { continuation in
            let timeoutTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(10))
                guard let messageID else { return }
                self?.pending.removeValue(forKey: messageID)?(.failure(APIError(message: "Request timeout", statusCode: nil)))
            }

            pending[messageID!] = { result in
                timeoutTask.cancel()
                switch result {
                case .success(let value):
                    continuation.resume(returning: value)
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }

            Task {
                do {
                    try await task.send(.string(text))
                } catch {
                    let handler = self.pending.removeValue(forKey: messageID!)
                    handler?(.failure(error))
                    self.handleTransportFailure(error)
                }
            }
        }
    }

    private func sendPing(on task: URLSessionWebSocketTask) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            task.sendPing { error in
                error.map { continuation.resume(throwing: $0) } ?? continuation.resume()
            }
        }
    }

    private func heartbeatLoop() async {
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: NativeConfig.websocketHeartbeatInterval)
            guard !Task.isCancelled, let task else { break }
            do {
                try await sendPing(on: task)
            } catch {
                handleTransportFailure(error)
                break
            }
        }
    }

    private func handleTransportFailure(_ error: Error) {
        let description = error.localizedDescription
        if description.lowercased() == "cancelled" || (error as NSError).code == NSURLErrorCancelled {
            return
        }
        onTransportInterrupted?(description)
        disconnect()
    }

    private func receiveLoop() async {
        while !Task.isCancelled, let activeTask = task {
            do {
                let message = try await activeTask.receive()
                switch message {
                case .string(let text): try await handleMessage(text)
                case .data(let data): try await handleMessage(String(decoding: data, as: UTF8.self))
                @unknown default: break
                }
            } catch {
                if Task.isCancelled || task == nil {
                    break
                }
                handleTransportFailure(error)
                break
            }
        }
    }

    private func handleMessage(_ text: String) async throws {
        guard let object = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any], let type = object["type"] as? String else { return }
        if type == "response", let id = object["id"] as? String, let handler = pending.removeValue(forKey: id) {
            let payload = try JSONSerialization.data(withJSONObject: object["data"] ?? [:])
            handler(.success(payload))
            return
        }

        let payload = object["data"] ?? [:]
        switch type {
        case "error": onError?(stringValue(payload) ?? "Unknown socket error")
        case "room-updated": onRoomInfo?(try decodeObject(payload))
        case "game-started", "game-state-updated": onGameState?(try decodeObject(payload))
        case "cut-result": onCutCards?((try? decodeObject(payload)) ?? [])
        case "team-switch-request": onTeamSwitchRequest?(try decodeObject(payload))
        case "team-switch-response": onTeamSwitchResponse?(try decodeObject(payload))
        case "game-mode-changed": onGameModeInfo?(try decodeObject(payload))
        case "room-closed": onRoomClosed?(stringValue(payload) ?? "Room closed")
        default: break
        }
    }

    private func encodeJSONObject(_ value: Encodable) throws -> Any {
        try JSONSerialization.jsonObject(with: encoder.encode(AnyEncodable(value)))
    }

    private func decodeObject<T: Decodable>(_ object: Any) throws -> T {
        let data = try JSONSerialization.data(withJSONObject: object)
        return try decoder.decode(T.self, from: data)
    }

    private func decodeObject<T: Decodable>(_ data: Data) throws -> T {
        try decoder.decode(T.self, from: data)
    }

    private func stringValue(_ object: Any) -> String? {
        if let string = object as? String { return string }
        if let payload = object as? [String: Any], let string = payload["message"] as? String { return string }
        return nil
    }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var screen: NativeScreen = .loading
    @Published var user: UserProfile?
    @Published var roomInfo: RoomInfo?
    @Published var gameState: ClientGameState?
    @Published var playerID: String?
    @Published var onboardingTempToken: String?
    @Published var suggestedDisplayName = ""
    @Published var pendingRoomCode: String?
    @Published var isConnected = false
    @Published var errorMessage: String?
    @Published var stats = UserStats.empty
    @Published var detailedStats: DetailedStatsResponse?
    @Published var friends: [FriendInfo] = []
    @Published var friendRequests: [FriendRequest] = []
    @Published var searchResults: [SearchResult] = []
    @Published var viewingProfile: FriendProfileResponse?
    @Published var viewingDetailedStats: DetailedStatsResponse?
    @Published var headToHead: HeadToHeadResponse?
    @Published var recentGames: [GameHistorySummary] = []
    @Published var recentGamesStatusMessage: String?
    @Published var gameHistoryList: [GameHistorySummary] = []
    @Published var gameHistoryHasMore = true
    @Published var friendProfileUserId: String?
    @Published var teamSwitchRequest: TeamSwitchRequest?
    @Published var teamSwitchResponse: TeamSwitchResponse?
    @Published var gameModeInfo: GameModeInfo?
    @Published var connectionStatus = ConnectionStatus.idle
    @Published var connectionSurfaceVisible = false
    @Published var pushPermissionState: PushPermissionState = .unknown
    @Published var usernameAvailability: UsernameAvailabilityState = .idle

    let sessionStore = SessionStore()
    let apiClient = APIClient()
    let socketManager = SocketManager()
    private let pushPermissionCoordinator = PushPermissionCoordinator()
    private let networkMonitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "com.farazbukhari.sequence.network")
    private var observersInstalled = false
    private var recoveryTask: Task<Void, Never>?
    private var recoveryGeneration = 0
    private var recoveryVisibilityTask: Task<Void, Never>?
    private var usernameCheckGeneration = 0
    private var networkAvailable = true
    private var sceneIsActive = true

    init() {
        socketManager.onConnected = { [weak self] in self?.handleSocketConnected() }
        socketManager.onDisconnected = { [weak self] in self?.isConnected = false }
        socketManager.onError = { [weak self] message in
            nativeLogger.error("Socket error: \(message, privacy: .public)")
            self?.errorMessage = message
        }
        socketManager.onTransportInterrupted = { [weak self] reason in
            Task { @MainActor [weak self] in
                await self?.handleTransportInterrupted(reason: reason)
            }
        }
        socketManager.onRoomInfo = { [weak self] info in
            guard let self else { return }
            self.roomInfo = info
            if self.screen == .home {
                self.screen = .lobby
            }
            if self.sessionStore.roomSession() != nil {
                self.setConnectionStatus(.attached())
            }
        }
        socketManager.onGameState = { [weak self] state in
            guard let self else { return }
            self.gameState = state
            self.screen = .game
            self.setConnectionStatus(.attached())
        }
        socketManager.onCutCards = { _ in }
        socketManager.onTeamSwitchRequest = { [weak self] in self?.teamSwitchRequest = $0 }
        socketManager.onTeamSwitchResponse = { [weak self] in self?.teamSwitchResponse = $0 }
        socketManager.onGameModeInfo = { [weak self] in self?.gameModeInfo = $0 }
        socketManager.onRoomClosed = { [weak self] reason in
            guard let self else { return }
            self.clearActiveRoom(notifyServer: false, destination: .home, clearError: false)
            self.errorMessage = reason
        }
        startNetworkMonitor()
    }

    deinit {
        networkMonitor.cancel()
        recoveryTask?.cancel()
        recoveryVisibilityTask?.cancel()
    }

    func bootstrap() async {
        observeNotifications()
        let reinstallDetected = sessionStore.prepareInstall()
        if reinstallDetected {
            errorMessage = "Local session reset after reinstall. Sign in again to continue."
        }

        user = sessionStore.storedUser()
        await refreshPushPermissionState(registerIfAuthorized: false)

        if let code = pendingRoomCode, user != nil {
            screen = .home
            pendingRoomCode = code
        }

        guard let token = sessionStore.sessionToken() else {
            screen = .auth
            setConnectionStatus(.idle)
            return
        }

        do {
            let response: AuthCompleteResponse = try await apiClient.request(path: "/api/auth/refresh", method: "POST", token: token)
            sessionStore.saveSessionToken(response.sessionToken)
            sessionStore.saveUser(response.user)
            user = response.user
            screen = .home
            await refreshPushPermissionState(registerIfAuthorized: true)
            await reconnectIfPossible(reason: "bootstrap", force: true)
        } catch {
            nativeLogger.error("Bootstrap refresh failed: \(error.localizedDescription, privacy: .public)")
            clearLocalAuthState()
            screen = .auth
            setConnectionStatus(.idle)
        }
    }

    func handleDeepLink(_ url: URL) {
        if let code = DeepLinkParser.roomCode(from: url) {
            pendingRoomCode = code
            if user != nil, screen == .auth {
                screen = .home
            }
        }
    }

    func handleScenePhase(_ phase: ScenePhase) {
        sceneIsActive = phase == .active
        guard phase == .active else { return }
        Task { @MainActor in
            await refreshPushPermissionState(registerIfAuthorized: user != nil)
            await reconnectIfPossible(reason: "scene-active")
        }
    }

    func signIn(identityToken: String, givenName: String?, familyName: String?) async {
        do {
            let body = ["identityToken": identityToken, "givenName": givenName, "familyName": familyName]
            let response: AuthAppleResponse = try await apiClient.request(path: "/api/auth/apple", method: "POST", body: AnyEncodable(body))
            if response.needsUsername {
                onboardingTempToken = response.tempToken
                suggestedDisplayName = response.suggestedName ?? ""
                usernameAvailability = .idle
                screen = .onboarding
            } else if let token = response.sessionToken, let user = response.user {
                sessionStore.saveSessionToken(token)
                sessionStore.saveUser(user)
                self.user = user
                screen = .home
                setConnectionStatus(.idle)
                await refreshPushPermissionState(registerIfAuthorized: true)
            }
        } catch {
            nativeLogger.error("Apple sign-in exchange failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = error.localizedDescription
        }
    }

    func completeRegistration(username: String, displayName: String, avatarID: String, avatarColor: String) async {
        guard let onboardingTempToken else { return }
        do {
            let body = ["tempToken": onboardingTempToken, "username": username, "displayName": displayName, "avatarId": avatarID, "avatarColor": avatarColor]
            let response: AuthCompleteResponse = try await apiClient.request(path: "/api/auth/complete-registration", method: "POST", body: AnyEncodable(body))
            sessionStore.saveSessionToken(response.sessionToken)
            sessionStore.saveUser(response.user)
            user = response.user
            screen = .home
            self.onboardingTempToken = nil
            usernameAvailability = .idle
            await refreshPushPermissionState(registerIfAuthorized: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        let _: SuccessResponse? = try? await apiClient.request(path: "/api/auth/session", method: "DELETE", token: sessionStore.sessionToken())
        clearActiveRoom(notifyServer: false, destination: .auth, clearError: true)
        clearLocalAuthState()
        screen = .auth
    }

    func reconnectIfPossible(reason: String = "manual", force: Bool = false) async {
        guard sceneIsActive, user != nil, sessionStore.roomSession() != nil else {
            setConnectionStatus(.idle)
            return
        }

        if !networkAvailable {
            setConnectionStatus(.offline("Waiting for network to restore your game."))
            return
        }

        if force {
            cancelRecovery()
        } else if recoveryTask != nil {
            return
        }

        guard let roomSession = sessionStore.roomSession() else { return }
        isConnected = false
        recoveryGeneration += 1
        let currentGeneration = recoveryGeneration
        recoveryTask = Task { [weak self] in
            await self?.runRecovery(roomSession: roomSession, reason: reason, generation: currentGeneration)
        }
    }

    func recordAppleUserID(_ userID: String) {
        sessionStore.saveAppleUserID(userID)
    }

    func handleAppleAuthorizationFailure(_ error: Error) async {
        guard let authorizationError = error as? ASAuthorizationError else {
            errorMessage = error.localizedDescription
            return
        }

        if authorizationError.code == .canceled {
            return
        }

        nativeLogger.error("Apple authorization failed: \(authorizationError.code.rawValue, privacy: .public)")
        if sessionStore.hasPersistedAuthArtifacts() {
            sessionStore.clearInstallScopedState()
            clearLocalAuthState()
            clearActiveRoom(notifyServer: false, destination: .auth, clearError: false)
        }

        switch authorizationError.code {
        case .failed, .invalidResponse, .unknown, .notHandled, .notInteractive, .matchedExcludedCredential:
            errorMessage = "Sign in with Apple failed. Local session data was reset. Please try again."
        default:
            errorMessage = authorizationError.localizedDescription
        }
    }

    func checkUsernameAvailability(_ rawValue: String) async {
        let normalized = normalizedUsername(rawValue)
        if normalized.isEmpty {
            usernameAvailability = .idle
            return
        }
        if normalized.count < 3 {
            usernameAvailability = .unavailable("Username must be at least 3 characters.")
            return
        }
        if normalized.count > 20 {
            usernameAvailability = .unavailable("Username must be 20 characters or fewer.")
            return
        }

        usernameCheckGeneration += 1
        let currentGeneration = usernameCheckGeneration
        usernameAvailability = .checking

        do {
            let path = "/api/auth/check-username?username=\(normalized.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? normalized)"
            let response: UsernameAvailabilityResponse = try await apiClient.request(path: path)
            guard currentGeneration == usernameCheckGeneration else { return }
            usernameAvailability = response.available ? .available : .unavailable(response.error ?? "Username is already taken.")
        } catch {
            guard currentGeneration == usernameCheckGeneration else { return }
            usernameAvailability = .unavailable("Couldn't verify the username right now.")
        }
    }

    func refreshPushPermissionState(registerIfAuthorized: Bool) async {
        let status = await pushPermissionCoordinator.authorizationStatus()
        switch status {
        case .authorized, .provisional, .ephemeral:
            pushPermissionState = .authorized
            if registerIfAuthorized {
                pushPermissionCoordinator.registerForRemoteNotifications()
            }
        case .denied:
            pushPermissionState = .denied
        case .notDetermined:
            pushPermissionState = .notDetermined
        @unknown default:
            pushPermissionState = .unknown
        }
    }

    func requestPushPermission() async {
        do {
            let granted = try await pushPermissionCoordinator.requestAuthorization()
            await refreshPushPermissionState(registerIfAuthorized: granted)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func openPushSettings() {
        pushPermissionCoordinator.openSystemSettings()
    }

    func retryConnectionRecovery() {
        Task { @MainActor in
            await reconnectIfPossible(reason: "manual-retry", force: true)
        }
    }

    func returnHomeFromConnectionFailure() {
        clearActiveRoom(notifyServer: false, destination: .home, clearError: true)
        setConnectionStatus(.idle)
    }

    func clearActiveRoom(notifyServer: Bool, destination: NativeScreen, clearError: Bool) {
        cancelRecovery()
        if notifyServer {
            Task { try? await socketManager.send(type: "leave-room") }
        }
        socketManager.disconnect()
        roomInfo = nil
        gameState = nil
        playerID = nil
        sessionStore.saveRoomSession(nil)
        isConnected = false
        screen = destination
        setConnectionStatus(.idle)
        if clearError {
            errorMessage = nil
        }
        if destination == .home {
            Task { await loadProfile() }
        }
    }

    private func reconnect(roomCode: String, token: String) async throws -> ReconnectResponse {
        try await socketManager.connect(path: "/ws/reconnect?token=\(token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? token)", authToken: sessionStore.sessionToken())
        let response: ReconnectResponse = try await socketManager.request(type: "reconnect-to-room", data: ["roomCode": roomCode, "token": token])
        if response.success {
            roomInfo = response.roomInfo
            gameState = response.gameState
            playerID = response.playerId
            screen = response.gameState == nil ? .lobby : .game
            setConnectionStatus(.attached())
        }
        return response
    }

    func observeNotifications() {
        guard !observersInstalled else { return }
        observersInstalled = true

        NotificationCenter.default.addObserver(forName: .inviteRoomDidOpen, object: nil, queue: .main) { [weak self] note in
            guard let self else { return }
            let roomCode = (note.object as? String)?.uppercased()
            Task { @MainActor in
                self.pendingRoomCode = roomCode
                if self.user != nil {
                    self.screen = .home
                }
            }
        }
        NotificationCenter.default.addObserver(forName: .apnsDeviceTokenDidUpdate, object: nil, queue: .main) { [weak self] note in
            guard let self else { return }
            let token = note.object as? String
            Task { @MainActor in
                guard let token, !token.isEmpty else { return }
                if self.sessionStore.lastPushToken() == token {
                    return
                }
                self.sessionStore.saveLastPushToken(token)
                let _: SuccessResponse? = try? await self.apiClient.request(path: "/api/push/register", method: "POST", token: self.sessionStore.sessionToken(), body: AnyEncodable(["token": token]))
            }
        }
    }

    private func handleSocketConnected() {
        isConnected = true
        if sessionStore.roomSession() != nil, connectionStatus.phase != .recovering {
            setConnectionStatus(.attached())
        }
    }

    private func handleTransportInterrupted(reason: String) async {
        nativeLogger.notice("Socket transport interrupted: \(reason, privacy: .public)")
        guard sessionStore.roomSession() != nil, user != nil else {
            setConnectionStatus(.idle)
            return
        }
        await reconnectIfPossible(reason: reason)
    }

    private func runRecovery(roomSession: RoomSession, reason: String, generation: Int) async {
        nativeLogger.notice("Starting native recovery flow: \(reason, privacy: .public)")
        var lastError = "Couldn't restore the room."

        for (index, delay) in NativeConfig.reconnectRetryDelays.enumerated() {
            guard !Task.isCancelled, generation == recoveryGeneration else { return }
            if delay > 0 {
                try? await Task.sleep(nanoseconds: delay)
            }

            guard !Task.isCancelled, generation == recoveryGeneration else { return }

            if !networkAvailable {
                recoveryTask = nil
                setConnectionStatus(.offline("Waiting for network to restore your game."))
                return
            }

            setConnectionStatus(.recovering(message: "Restoring your game…", attempt: index + 1), delayedSurface: true)

            do {
                let response = try await reconnect(roomCode: roomSession.roomCode, token: roomSession.token)
                guard generation == recoveryGeneration else { return }

                if response.success, response.roomInfo != nil, response.playerId != nil {
                    recoveryTask = nil
                    setConnectionStatus(.attached())
                    return
                }

                if response.errorCode == .invalidToken || response.errorCode == .roomExpired {
                    recoveryTask = nil
                    nativeLogger.notice("Recovery reached terminal state: \(response.errorCode?.rawValue ?? "unknown", privacy: .public)")
                    clearActiveRoom(notifyServer: false, destination: .home, clearError: false)
                    errorMessage = response.error ?? "The room is no longer available."
                    return
                }

                lastError = response.error ?? lastError
            } catch {
                guard generation == recoveryGeneration else { return }
                lastError = error.localizedDescription
            }
        }

        guard generation == recoveryGeneration else { return }
        recoveryTask = nil
        setConnectionStatus(.terminalFailure(lastError, canRetry: true))
    }

    private func setConnectionStatus(_ status: ConnectionStatus, delayedSurface: Bool = false) {
        let previousPhase = connectionStatus.phase
        connectionStatus = status
        recoveryVisibilityTask?.cancel()
        recoveryVisibilityTask = nil

        if status.phase != previousPhase {
            if status.phase == .attached && (previousPhase == .recovering || previousPhase == .offline) {
                NativeHaptics.notify(.success)
            } else if status.phase == .terminalFailure {
                NativeHaptics.notify(.error)
            }
        }

        switch status.phase {
        case .recovering:
            connectionSurfaceVisible = false
            if delayedSurface {
                recoveryVisibilityTask = Task { [weak self] in
                    try? await Task.sleep(nanoseconds: NativeConfig.reconnectVisibleDelay)
                    guard let self, self.connectionStatus.phase == .recovering else { return }
                    self.connectionSurfaceVisible = true
                }
            } else {
                connectionSurfaceVisible = true
            }
        case .offline, .terminalFailure:
            connectionSurfaceVisible = true
        default:
            connectionSurfaceVisible = false
        }
    }

    func cancelRecovery() {
        recoveryGeneration += 1
        recoveryTask?.cancel()
        recoveryTask = nil
        recoveryVisibilityTask?.cancel()
        recoveryVisibilityTask = nil
        connectionSurfaceVisible = false
    }

    private func clearLocalAuthState() {
        sessionStore.saveSessionToken(nil)
        sessionStore.saveUser(nil)
        sessionStore.saveRoomSession(nil)
        sessionStore.saveLastPushToken(nil)
        user = nil
        roomInfo = nil
        gameState = nil
        playerID = nil
        onboardingTempToken = nil
        suggestedDisplayName = ""
        usernameAvailability = .idle
        stats = .empty
        detailedStats = nil
        friends = []
        friendRequests = []
        searchResults = []
        viewingProfile = nil
        viewingDetailedStats = nil
        headToHead = nil
        recentGames = []
        recentGamesStatusMessage = nil
        gameHistoryList = []
        gameHistoryHasMore = true
        friendProfileUserId = nil
        teamSwitchRequest = nil
        teamSwitchResponse = nil
        gameModeInfo = nil
        isConnected = false
    }

    private func startNetworkMonitor() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let available = path.status == .satisfied
                self.networkAvailable = available
                if !available, self.sessionStore.roomSession() != nil {
                    self.cancelRecovery()
                    self.setConnectionStatus(.offline("Waiting for network to restore your game."))
                } else if available, self.connectionStatus.phase == .offline, self.user != nil, self.sceneIsActive {
                    await self.reconnectIfPossible(reason: "network-restored", force: true)
                }
            }
        }
        networkMonitor.start(queue: networkQueue)
    }

    private func normalizedUsername(_ rawValue: String) -> String {
        rawValue
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9_]", with: "", options: .regularExpression)
    }
}
