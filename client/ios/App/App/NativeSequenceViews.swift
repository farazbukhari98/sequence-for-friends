import AuthenticationServices
import SwiftUI

extension AppModel {
    func inviteFriend(userID: String, roomCode: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let _: SuccessResponse = try await apiClient.request(
                path: "/api/invite",
                method: "POST",
                token: token,
                body: AnyEncodable(["friendId": userID, "roomCode": roomCode])
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearTeamSwitchResponse() {
        teamSwitchResponse = nil
    }

    func clearGameModeInfo() {
        gameModeInfo = nil
    }

    func handleAppleAuthorization(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let error):
            await handleAppleAuthorizationFailure(error)
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let identityToken = String(data: tokenData, encoding: .utf8)
            else {
                errorMessage = "Failed to get identity token"
                return
            }
            recordAppleUserID(credential.user)
            await signIn(identityToken: identityToken, givenName: credential.fullName?.givenName, familyName: credential.fullName?.familyName)
        }
    }

    func openProfile() async {
        screen = .profile
        await loadProfile()
    }

    func openFriends() async {
        screen = .friends
        await loadFriends()
    }

    func loadProfile() async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let response: ProfileResponse = try await apiClient.request(path: "/api/profile/me", token: token)
            user = response.user
            stats = response.stats
            sessionStore.saveUser(response.user)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateProfile(displayName: String, avatarID: String, avatarColor: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let _: SuccessResponse = try await apiClient.request(path: "/api/profile/me", method: "PATCH", token: token, body: AnyEncodable(UpdateProfilePayload(displayName: displayName, avatarId: avatarID, avatarColor: avatarColor)))
            if let current = user {
                user = UserProfile(id: current.id, username: current.username, displayName: displayName, avatarId: avatarID, avatarColor: avatarColor, createdAt: current.createdAt)
                sessionStore.saveUser(user)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadFriends() async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            async let friendsResponse: FriendsResponse = apiClient.request(path: "/api/friends", token: token)
            async let requestsResponse: FriendRequestsResponse = apiClient.request(path: "/api/friends/requests", token: token)
            friends = try await friendsResponse.friends
            friendRequests = try await requestsResponse.requests
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func searchProfiles(_ query: String) async {
        guard let token = sessionStore.sessionToken(), query.count >= 2 else { searchResults = []; return }
        do {
            let path = "/api/profile/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)"
            let response: SearchProfilesResponse = try await apiClient.request(path: path, token: token)
            searchResults = response.results
        } catch {
            searchResults = []
        }
    }

    func sendFriendRequest(username: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let _: SuccessResponse = try await apiClient.request(path: "/api/friends/request", method: "POST", token: token, body: AnyEncodable(["username": username]))
            await loadFriends()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func acceptFriendRequest(userID: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let _: SuccessResponse = try await apiClient.request(path: "/api/friends/accept", method: "POST", token: token, body: AnyEncodable(["userId": userID]))
            await loadFriends()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func rejectFriendRequest(userID: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let _: SuccessResponse = try await apiClient.request(path: "/api/friends/reject", method: "POST", token: token, body: AnyEncodable(["userId": userID]))
            await loadFriends()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeFriend(userID: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let _: SuccessResponse = try await apiClient.request(path: "/api/friends/\(userID)", method: "DELETE", token: token)
            await loadFriends()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createRoom(roomName: String, maxPlayers: Int, teamCount: Int, turnTimeLimit: Int, sequencesToWin: Int) async {
        guard let playerName = user?.displayName else { return }
        do {
            errorMessage = nil
            connectionStatus = .connecting("Creating room…")
            try await socketManager.connect(path: "/ws/create", authToken: sessionStore.sessionToken())
            let response: CreateRoomResponse = try await socketManager.request(type: "create-room", data: CreateRoomPayload(roomName: roomName, playerName: playerName, maxPlayers: maxPlayers, teamCount: teamCount, turnTimeLimit: turnTimeLimit, sequencesToWin: sequencesToWin))
            guard response.success, let roomCode = response.roomCode, let token = response.token, let playerId = response.playerId else {
                throw APIError(message: response.error ?? "Failed to create room", statusCode: nil)
            }
            playerID = playerId
            sessionStore.saveRoomSession(RoomSession(roomCode: roomCode, token: token, playerId: playerId))
            connectionStatus = .attached()
            screen = .lobby
        } catch {
            connectionStatus = .idle
            errorMessage = error.localizedDescription
        }
    }

    func createBotGame(difficulty: String, sequenceLength: Int, sequencesToWin: Int, seriesLength: Int) async {
        guard let playerName = user?.displayName else { return }
        do {
            errorMessage = nil
            connectionStatus = .connecting("Creating bot game…")
            try await socketManager.connect(path: "/ws/create", authToken: sessionStore.sessionToken())
            let response: CreateRoomResponse = try await socketManager.request(type: "create-bot-game", data: CreateBotGamePayload(playerName: playerName, difficulty: difficulty, sequenceLength: sequenceLength, sequencesToWin: sequencesToWin, seriesLength: seriesLength))
            guard response.success, let roomCode = response.roomCode, let token = response.token, let playerId = response.playerId else {
                throw APIError(message: response.error ?? "Failed to create bot game", statusCode: nil)
            }
            playerID = playerId
            sessionStore.saveRoomSession(RoomSession(roomCode: roomCode, token: token, playerId: playerId))
            connectionStatus = .attached()
            screen = .game
        } catch {
            connectionStatus = .idle
            errorMessage = error.localizedDescription
        }
    }

    func joinRoom(code: String) async {
        guard let playerName = user?.displayName else { return }
        do {
            errorMessage = nil
            let normalized = code.uppercased()
            connectionStatus = .connecting("Joining room…")
            try await socketManager.connect(path: "/ws/room/\(normalized)", authToken: sessionStore.sessionToken())
            let response: JoinRoomResponse = try await socketManager.request(type: "join-room", data: JoinRoomPayload(roomCode: normalized, playerName: playerName, token: nil))
            guard response.success, let roomInfo = response.roomInfo, let token = response.token, let playerId = response.playerId else {
                throw APIError(message: response.error ?? "Failed to join room", statusCode: nil)
            }
            self.roomInfo = roomInfo
            self.playerID = playerId
            sessionStore.saveRoomSession(RoomSession(roomCode: normalized, token: token, playerId: playerId))
            pendingRoomCode = nil
            connectionStatus = .attached()
            screen = roomInfo.phase == "in-game" ? .game : .lobby
        } catch {
            connectionStatus = .idle
            errorMessage = error.localizedDescription
        }
    }
}

struct RootContentView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        ZStack(alignment: .top) {
            NativeBackground()
            Group {
                switch model.screen {
                case .loading: NativeLoadingView()
                case .auth: AuthView(model: model)
                case .onboarding: OnboardingView(model: model)
                case .home: HomeView(model: model)
                case .profile: ProfileView(model: model)
                case .friends: FriendsView(model: model)
                case .lobby: NativeLobbyView(model: model)
                case .game: NativeGameView(model: model)
                }
            }
            if model.connectionSurfaceVisible && (model.screen == .lobby || model.screen == .game) {
                ConnectionStatusOverlay(model: model)
            }
            if let error = model.errorMessage {
                NativeToast(text: error) { model.errorMessage = nil }
                    .padding(.top, 12)
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct AuthView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            LogoView(title: "Sequence", subtitle: "for Friends")
            SignInWithAppleButton(.signIn, onRequest: { request in
                request.requestedScopes = [.fullName, .email]
            }, onCompletion: { result in
                Task { await model.handleAppleAuthorization(result) }
            })
            .signInWithAppleButtonStyle(.white)
            .frame(height: 52)
            .padding(.horizontal, 24)
            Text("Play the classic card-sequence board game with friends")
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
        .padding()
    }
}

struct OnboardingView: View {
    @ObservedObject var model: AppModel
    @State private var username = ""
    @State private var displayName = ""
    @State private var avatarID = NativeTheme.avatarOptions.first?.id ?? "bear"
    @State private var avatarColor = NativeTheme.avatarColors.first ?? "#6366f1"

    var body: some View {
        let normalizedUsername = username
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9_]", with: "", options: .regularExpression)
        let canContinue = normalizedUsername.count >= 3 && normalizedUsername.count <= 20 && model.usernameAvailability == .available

        ScrollView {
            VStack(spacing: 20) {
                Text("Create Your Profile").font(.system(size: 32, weight: .bold, design: .rounded))
                Text("Choose a username and avatar").foregroundStyle(.white.opacity(0.7))
                AvatarPickerView(selectedAvatarID: $avatarID, selectedColor: $avatarColor)
                NativeCard {
                    VStack(spacing: 14) {
                        TextField("Username", text: $username).textInputAutocapitalization(.never)
                        Divider().background(.white.opacity(0.1))
                        TextField("Display Name", text: $displayName)
                        switch model.usernameAvailability {
                        case .idle:
                            Text("Usernames use lowercase letters, numbers, and underscores.")
                                .font(.footnote)
                                .foregroundStyle(.white.opacity(0.65))
                        case .checking:
                            Text("Checking username availability…")
                                .font(.footnote)
                                .foregroundStyle(.white.opacity(0.75))
                        case .available:
                            Text("Username is available.")
                                .font(.footnote)
                                .foregroundStyle(.green)
                        case .unavailable(let message):
                            Text(message)
                                .font(.footnote)
                                .foregroundStyle(.red.opacity(0.9))
                        }
                    }
                }
                NativePrimaryButton(title: "Continue", disabled: !canContinue) {
                    Task {
                        await model.completeRegistration(
                            username: normalizedUsername,
                            displayName: displayName.isEmpty ? model.suggestedDisplayName : displayName,
                            avatarID: avatarID,
                            avatarColor: avatarColor
                        )
                    }
                }
            }
            .padding(24)
        }
        .onAppear { if displayName.isEmpty { displayName = model.suggestedDisplayName } }
        .onChange(of: username) { _, newValue in
            Task { await model.checkUsernameAvailability(newValue) }
        }
    }
}

struct HomeView: View {
    enum ActiveSheet: String, Identifiable { case create, join, bot; var id: String { rawValue } }

    @ObservedObject var model: AppModel
    @State private var activeSheet: ActiveSheet?

    var body: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                Button { Task { await model.openProfile() } } label: {
                    AvatarBubble(avatarID: model.user?.avatarId ?? "bear", avatarColor: model.user?.avatarColor ?? "#6366f1")
                }
                Spacer()
                Button(action: { Task { await model.openFriends() } }) {
                    HStack(spacing: 6) {
                        Image(systemName: "person.2.fill")
                            .font(.subheadline)
                        Text("Friends")
                            .font(.subheadline.weight(.semibold))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.08), in: Capsule())
                    .contentShape(Capsule())
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)

            Spacer()

            // Logo area
            LogoView(title: "Sequence", subtitle: "Classic Edition")

            Spacer()

            // Notifications / invite cards
            VStack(spacing: 12) {
                if model.pendingRoomCode != nil {
                    NativeCard {
                        HStack(spacing: 12) {
                            Text("🎮")
                                .font(.title2)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Game Invite!")
                                    .font(.subheadline.weight(.bold))
                                Text("Tap Join Game to enter the room.")
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                            Spacer()
                        }
                    }
                    .padding(.horizontal, 24)
                }
                if model.pushPermissionState != .authorized {
                    NativeCard {
                        HStack(spacing: 12) {
                            Text("🔔")
                                .font(.title2)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Enable Notifications")
                                    .font(.subheadline.weight(.bold))
                                Text("Get notified when friends invite you.")
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                            Spacer()
                            if model.pushPermissionState == .denied {
                                Button(action: { model.openPushSettings() }) {
                                    Text("Settings")
                                        .font(.caption.weight(.bold))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(Color.white.opacity(0.1), in: Capsule())
                                }
                            } else {
                                Button(action: { Task { await model.requestPushPermission() } }) {
                                    Text("Enable")
                                        .font(.caption.weight(.bold))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(Color(hex: "#6366f1"), in: Capsule())
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                }
            }

            // Main action buttons
            VStack(spacing: 12) {
                HomeActionButton(
                    icon: "plus.circle.fill",
                    title: "Create Game",
                    subtitle: "Host a room for friends",
                    accentHex: "#6366f1"
                ) { activeSheet = .create }

                HomeActionButton(
                    icon: "cpu.fill",
                    title: "Play vs Bot",
                    subtitle: "Practice against AI",
                    accentHex: "#8b5cf6"
                ) { activeSheet = .bot }

                HomeActionButton(
                    icon: "arrow.right.circle.fill",
                    title: "Join Game",
                    subtitle: "Enter a room code",
                    accentHex: "#06b6d4"
                ) { activeSheet = .join }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .create: CreateRoomSheet(model: model)
            case .join: JoinRoomSheet(model: model, initialCode: model.pendingRoomCode)
            case .bot: BotGameSheet(model: model)
            }
        }
        .onAppear {
            if model.pendingRoomCode != nil { activeSheet = .join }
        }
    }
}

private struct HomeActionButton: View {
    let icon: String
    let title: String
    let subtitle: String
    let accentHex: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(Color(hex: accentHex))
                    .frame(width: 44, height: 44)
                    .background(Color(hex: accentHex).opacity(0.15), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline.weight(.bold))
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.3))
            }
            .padding(16)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.white.opacity(0.06)))
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
    }
}

struct ProfileView: View {
    @ObservedObject var model: AppModel
    @State private var displayName = ""
    @State private var avatarID = "bear"
    @State private var avatarColor = "#6366f1"

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HeaderBar(title: "Profile") { model.screen = .home }
                AvatarPickerView(selectedAvatarID: $avatarID, selectedColor: $avatarColor)
                TextField("Display Name", text: $displayName).textFieldStyle(.roundedBorder).padding(.horizontal, 24)
                NativePrimaryButton(title: "Save Profile") { Task { await model.updateProfile(displayName: displayName, avatarID: avatarID, avatarColor: avatarColor) } }
                    .padding(.horizontal, 24)
                StatsSummaryView(stats: model.stats)
                    .padding(.horizontal, 24)
                NativeSecondaryButton(title: "Sign Out") { Task { await model.signOut() } }
                    .padding(.horizontal, 24)
            }
        }
        .onAppear {
            displayName = model.user?.displayName ?? ""
            avatarID = model.user?.avatarId ?? "bear"
            avatarColor = model.user?.avatarColor ?? "#6366f1"
        }
    }
}

struct FriendsView: View {
    @ObservedObject var model: AppModel
    @State private var query = ""

    var body: some View {
        VStack(spacing: 16) {
            HeaderBar(title: "Friends") { model.screen = .home }
            TextField("Search by username", text: $query)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 24)
                .onChange(of: query) { _, newValue in Task { await model.searchProfiles(newValue) } }
            ScrollView {
                VStack(spacing: 16) {
                    if !query.isEmpty {
                        ForEach(model.searchResults.filter { result in !model.friends.contains(where: { $0.userId == result.userId }) }) { friend in
                            FriendRow(friend: friend, trailing: { Task { await model.sendFriendRequest(username: friend.username) } }, actionTitle: "Add")
                        }
                    } else {
                        ForEach(model.friendRequests) { request in
                            FriendRow(friend: FriendInfo(userId: request.userId, username: request.username, displayName: request.displayName, avatarId: request.avatarId, avatarColor: request.avatarColor, since: nil, hasBeatImpossibleBot: nil), trailing: { Task { await model.acceptFriendRequest(userID: request.userId) } }, actionTitle: "Accept")
                        }
                        ForEach(model.friends) { friend in
                            FriendRow(friend: friend, trailing: { Task { await model.removeFriend(userID: friend.userId) } }, actionTitle: "Remove")
                        }
                    }
                }
                .padding(.horizontal, 24)
            }
        }
    }
}

private struct CreateRoomSheet: View {
    @ObservedObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var roomName = ""
    @State private var maxPlayers = 2
    @State private var turnTimeLimit = 0
    @State private var sequencesToWin = 2

    var body: some View {
        ZStack {
            Color(hex: "#0a0a1a").ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    sheetHeader(title: "Create Game", onClose: { dismiss() })

                    // Room name
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ROOM NAME").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.5))
                        TextField("My Room", text: $roomName)
                            .font(.headline)
                            .padding(14)
                            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.white.opacity(0.08)))
                    }

                    // Players
                    GameOptionRow(title: "PLAYERS", icon: "person.2.fill") {
                        GameStepper(value: $maxPlayers, range: 2...12)
                    }

                    // Timer
                    GameOptionRow(title: "TURN TIMER", icon: "timer") {
                        GameSegmentPicker(
                            selection: $turnTimeLimit,
                            options: [
                                (0, "None"), (15, "15s"), (30, "30s"), (60, "60s"), (120, "2m")
                            ]
                        )
                    }

                    // Sequences to win
                    GameOptionRow(title: "SEQUENCES TO WIN", icon: "star.fill") {
                        GameSegmentPicker(
                            selection: $sequencesToWin,
                            options: [(1, "1"), (2, "2"), (3, "3"), (4, "4")]
                        )
                    }

                    NativePrimaryButton(title: "Create Room") {
                        let teamCount = maxPlayers <= 3 ? maxPlayers : (maxPlayers.isMultiple(of: 2) ? 2 : 3)
                        Task { await model.createRoom(roomName: roomName, maxPlayers: maxPlayers, teamCount: teamCount, turnTimeLimit: turnTimeLimit, sequencesToWin: sequencesToWin); dismiss() }
                    }
                }
                .padding(24)
            }
        }
        .presentationDetents([.large])
    }
}

private struct JoinRoomSheet: View {
    @ObservedObject var model: AppModel
    let initialCode: String?
    @Environment(\.dismiss) private var dismiss
    @State private var roomCode = ""

    var body: some View {
        ZStack {
            Color(hex: "#0a0a1a").ignoresSafeArea()

            VStack(spacing: 24) {
                sheetHeader(title: "Join Game", onClose: { dismiss() })

                VStack(alignment: .leading, spacing: 8) {
                    Text("ROOM CODE").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.5))
                    TextField("ABCDEF", text: $roomCode)
                        .textInputAutocapitalization(.characters)
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .multilineTextAlignment(.center)
                        .padding(16)
                        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.white.opacity(0.08)))
                }

                NativePrimaryButton(title: "Join Room", disabled: roomCode.count < 4) {
                    Task { await model.joinRoom(code: roomCode); dismiss() }
                }

                Spacer()
            }
            .padding(24)
        }
        .presentationDetents([.medium])
        .onAppear { roomCode = initialCode ?? "" }
    }
}

private struct BotGameSheet: View {
    @ObservedObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var difficulty = "medium"
    @State private var sequenceLength = 5
    @State private var sequencesToWin = 2
    @State private var seriesLength = 0

    private var difficultyInfo: (emoji: String, color: String) {
        switch difficulty {
        case "easy": return ("🟢", "#22c55e")
        case "medium": return ("🟡", "#eab308")
        case "hard": return ("🔴", "#ef4444")
        case "impossible": return ("💀", "#a855f7")
        default: return ("🟡", "#eab308")
        }
    }

    var body: some View {
        ZStack {
            Color(hex: "#0a0a1a").ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    sheetHeader(title: "Play vs Bot", onClose: { dismiss() })

                    // Difficulty
                    GameOptionRow(title: "DIFFICULTY", icon: "cpu.fill") {
                        GameSegmentPicker(
                            selection: $difficulty,
                            options: [
                                ("easy", "Easy"), ("medium", "Med"), ("hard", "Hard"), ("impossible", "💀")
                            ]
                        )
                    }

                    // Mode
                    GameOptionRow(title: "MODE", icon: "square.grid.3x3.fill") {
                        GameSegmentPicker(
                            selection: $sequenceLength,
                            options: [(5, "Standard"), (4, "Blitz")]
                        )
                    }

                    // Sequences to win
                    GameOptionRow(title: "SEQUENCES TO WIN", icon: "star.fill") {
                        GameSegmentPicker(
                            selection: $sequencesToWin,
                            options: [(1, "1"), (2, "2"), (3, "3"), (4, "4")]
                        )
                    }

                    // Series
                    GameOptionRow(title: "SERIES", icon: "trophy.fill") {
                        GameSegmentPicker(
                            selection: $seriesLength,
                            options: [(0, "Single"), (3, "Bo3"), (5, "Bo5"), (7, "Bo7")]
                        )
                    }

                    NativePrimaryButton(title: "Start Game") {
                        Task { await model.createBotGame(difficulty: difficulty, sequenceLength: sequenceLength, sequencesToWin: sequencesToWin, seriesLength: seriesLength); dismiss() }
                    }
                }
                .padding(24)
            }
        }
        .presentationDetents([.large])
    }
}

// MARK: - Game-styled picker components

private struct GameSegmentPicker<T: Hashable>: View {
    @Binding var selection: T
    let options: [(T, String)]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                let isSelected = selection == option.0
                Button(action: {
                    NativeHaptics.selection()
                    selection = option.0
                }) {
                    Text(option.1)
                        .font(.subheadline.weight(isSelected ? .bold : .medium))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity)
                        .background(
                            isSelected ? Color(hex: "#6366f1") : Color.white.opacity(0.06),
                            in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                        )
                        .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
    }
}

private struct GameStepper: View {
    @Binding var value: Int
    let range: ClosedRange<Int>

    var body: some View {
        HStack(spacing: 14) {
            Button(action: {
                if value > range.lowerBound { value -= 1; NativeHaptics.selection() }
            }) {
                Image(systemName: "minus")
                    .font(.headline.weight(.bold))
                    .frame(width: 40, height: 40)
                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(value <= range.lowerBound)
            .opacity(value <= range.lowerBound ? 0.3 : 1)

            Text("\(value)")
                .font(.title2.monospacedDigit().weight(.black))
                .frame(minWidth: 40)

            Button(action: {
                if value < range.upperBound { value += 1; NativeHaptics.selection() }
            }) {
                Image(systemName: "plus")
                    .font(.headline.weight(.bold))
                    .frame(width: 40, height: 40)
                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(value >= range.upperBound)
            .opacity(value >= range.upperBound ? 0.3 : 1)
        }
    }
}

private struct GameOptionRow<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.5))
                Text(title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.5))
            }
            content
        }
    }
}

@MainActor @ViewBuilder
private func sheetHeader(title: String, onClose: @escaping () -> Void) -> some View {
    HStack {
        Text(title)
            .font(.title2.weight(.black))
        Spacer()
        Button(action: onClose) {
            Image(systemName: "xmark")
                .font(.subheadline.weight(.bold))
                .frame(width: 32, height: 32)
                .background(Color.white.opacity(0.1), in: Circle())
                .contentShape(Circle())
        }
    }
}

private struct LogoView: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: "#6366f1"), Color(hex: "#8b5cf6")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 88, height: 88)
                    .shadow(color: Color(hex: "#6366f1").opacity(0.4), radius: 20, y: 4)
                Text("S")
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
            }
            Text(title)
                .font(.system(size: 36, weight: .bold, design: .rounded))
            Text(subtitle)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.5))
        }
    }
}

struct HeaderBar: View {
    let title: String
    let back: () -> Void

    var body: some View {
        HStack {
            Button("Back", action: back)
            Spacer()
            Text(title).font(.headline)
            Spacer()
            Color.clear.frame(width: 40, height: 1)
        }
        .padding(.horizontal, 24)
    }
}

private struct FriendRow: View {
    let friend: FriendInfo
    let trailing: () -> Void
    let actionTitle: String

    var body: some View {
        NativeCard {
            HStack {
                AvatarBubble(avatarID: friend.avatarId, avatarColor: friend.avatarColor)
                VStack(alignment: .leading) {
                    Text(friend.displayName).fontWeight(.semibold)
                    Text("@\(friend.username)").foregroundStyle(.white.opacity(0.65))
                }
                Spacer()
                Button(actionTitle, action: trailing).buttonStyle(.borderedProminent)
            }
        }
    }
}
