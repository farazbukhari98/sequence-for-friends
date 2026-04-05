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
        guard let userId = user?.id else { return }
        screen = .profile
        async let profileTask: () = loadProfile()
        async let detailedTask: () = loadDetailedStats()
        async let friendsTask: () = loadFriends()
        async let recentTask: () = loadRecentGames(userId: userId)
        _ = await (profileTask, detailedTask, friendsTask, recentTask)
    }

    func loadRecentGames(userId: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let response: GameHistoryResponse = try await apiClient.request(path: "/api/stats/me/history?limit=5&offset=0", token: token)
            let summaries = parseGameHistory(response.games, userId: userId)
            recentGames = summaries
            recentGamesStatusMessage = response.games.isEmpty || !summaries.isEmpty
                ? nil
                : "We found completed matches, but couldn't match them to your account history."
        } catch {
            recentGames = []
            recentGamesStatusMessage = "Couldn't load recent game history right now."
        }
    }

    private func parseGameHistory(_ games: [GameHistoryGame], userId: String) -> [GameHistorySummary] {
        games.compactMap { game -> GameHistorySummary? in
            guard let me = game.participants.first(where: { $0.userId == userId }) else { return nil }
            return GameHistorySummary(
                id: game.id,
                endedAt: Double(game.endedAt),
                durationMs: game.durationMs,
                gameVariant: game.gameVariant,
                botDifficulty: game.botDifficulty,
                wasStalemate: game.wasStalemate != 0,
                myWon: me.won != 0,
                myTeamColor: me.teamColor,
                playerCount: game.playerCount
            )
        }
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

    func loadDetailedStats() async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let response: DetailedStatsResponse = try await apiClient.request(path: "/api/stats/me/detailed", token: token)
            detailedStats = response
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadFriendProfile(username: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let response: FriendProfileResponse = try await apiClient.request(path: "/api/profile/\(username)", token: token)
            viewingProfile = response
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadFriendDetailedStats(username: String) async {
        do {
            let response: DetailedStatsResponse = try await apiClient.request(path: "/api/stats/\(username)/detailed")
            viewingDetailedStats = response
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadHeadToHead(userId: String) async {
        guard let token = sessionStore.sessionToken() else { return }
        do {
            let response: HeadToHeadResponse = try await apiClient.request(path: "/api/stats/head-to-head/\(userId)", token: token)
            headToHead = response
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadGameHistory(mode: String? = nil, difficulty: String? = nil, variant: String? = nil, result: String? = nil, offset: Int = 0) async {
        guard let token = sessionStore.sessionToken(), let userId = user?.id else { return }
        var path = "/api/stats/me/history?limit=20&offset=\(offset)"
        if let mode { path += "&mode=\(mode)" }
        if let difficulty { path += "&difficulty=\(difficulty)" }
        if let variant { path += "&variant=\(variant)" }
        if let result { path += "&result=\(result)" }

        do {
            let response: GameHistoryResponse = try await apiClient.request(path: path, token: token)
            let summaries = parseGameHistory(response.games, userId: userId)
            if offset == 0 {
                gameHistoryList = summaries
            } else {
                gameHistoryList.append(contentsOf: summaries)
            }
            gameHistoryHasMore = summaries.count >= 20
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func openFriendProfile(_ friend: FriendInfo) async {
        friendProfileUserId = friend.userId
        viewingProfile = nil
        viewingDetailedStats = nil
        headToHead = nil
        screen = .friendProfile
        async let profileTask: () = loadFriendProfile(username: friend.username)
        async let statsTask: () = loadFriendDetailedStats(username: friend.username)
        async let h2hTask: () = loadHeadToHead(userId: friend.userId)
        _ = await (profileTask, statsTask, h2hTask)
    }

    func openFriendProfileFromSearch(_ result: SearchResult) async {
        let friend = FriendInfo(userId: result.id, username: result.username, displayName: result.displayName, avatarId: result.avatarId, avatarColor: result.avatarColor, since: nil, hasBeatImpossibleBot: nil)
        await openFriendProfile(friend)
    }

    func openGameHistory() async {
        gameHistoryList = []
        gameHistoryHasMore = true
        screen = .gameHistory
        await loadGameHistory()
    }

    func createRoom(roomName: String, maxPlayers: Int, teamCount: Int, turnTimeLimit: Int, sequencesToWin: Int) async {
        guard let playerName = user?.displayName else { return }
        do {
            errorMessage = nil
            cancelRecovery()
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
            cancelRecovery()
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
            cancelRecovery()
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
                case .friendProfile: FriendProfileView(model: model)
                case .gameHistory: GameHistoryView(model: model)
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
            Task { await model.loadProfile() }
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

// ProfileView is now in NativeSequenceProfileViews.swift

struct EditProfileSheet: View {
    @ObservedObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var displayName = ""
    @State private var avatarID = "bear"
    @State private var avatarColor = "#6366f1"

    var body: some View {
        ZStack {
            Color(hex: "#0a0a1a").ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    sheetHeader(title: "Edit Profile", onClose: { dismiss() })
                    AvatarPickerView(selectedAvatarID: $avatarID, selectedColor: $avatarColor)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("DISPLAY NAME").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.5))
                        TextField("Display Name", text: $displayName)
                            .font(.headline)
                            .padding(14)
                            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.white.opacity(0.08)))
                    }
                    NativePrimaryButton(title: "Save") {
                        Task {
                            await model.updateProfile(displayName: displayName, avatarID: avatarID, avatarColor: avatarColor)
                            dismiss()
                        }
                    }
                }
                .padding(24)
            }
        }
        .presentationDetents([.large])
        .onAppear {
            displayName = model.user?.displayName ?? ""
            avatarID = model.user?.avatarId ?? "bear"
            avatarColor = model.user?.avatarColor ?? "#6366f1"
        }
    }
}

private struct QuickStatCard: View {
    let title: String
    let value: String
    let accent: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.monospacedDigit().weight(.black))
                .foregroundStyle(Color(hex: accent))
            Text(title)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(hex: accent).opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct ModeCard: View {
    let name: String
    let breakdown: ModeBreakdown

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(name)
                .font(.subheadline.weight(.bold))
                .lineLimit(1)
            Text("\(breakdown.gamesPlayed) games")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.6))
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4).fill(Color.white.opacity(0.1))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(hex: "#22c55e"))
                        .frame(width: geo.size.width * CGFloat(breakdown.winRate) / 100)
                }
            }
            .frame(height: 6)
            Text("\(breakdown.winRate)% win rate")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.5))
        }
        .padding(12)
        .frame(width: 140)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

@MainActor @ViewBuilder
private func insightsCard(_ insights: StatsInsights, stats: UserStats) -> some View {
    NativeCard {
        VStack(alignment: .leading, spacing: 10) {
            Text("Insights").font(.headline.weight(.bold))
            if let avg = insights.avgGameDurationMs {
                InsightRow(icon: "clock.fill", title: "Avg Game Duration", value: formatDuration(avg))
            }
            if let color = insights.favoriteTeamColor {
                InsightRow(icon: "paintpalette.fill", title: "Favorite Team", value: color.capitalized)
            }
            InsightRow(icon: "suit.spade.fill", title: "Jack Usage", value: "\(Int(insights.jackUsageRate * 100))%")
            if let fmwr = insights.firstMoveWinRate {
                InsightRow(icon: "1.circle.fill", title: "First Move Win Rate", value: "\(fmwr)%")
            }
            if let avgT = insights.avgTurnsPerGame {
                InsightRow(icon: "arrow.triangle.2.circlepath", title: "Avg Turns/Game", value: String(format: "%.1f", avgT))
            }
            if let avgS = insights.avgSequencesPerGame {
                InsightRow(icon: "square.stack.3d.up.fill", title: "Avg Sequences/Game", value: String(format: "%.1f", avgS))
            }
            InsightRow(icon: "hourglass", title: "Total Play Time", value: insights.totalPlayTimeFormatted)
            if stats.hasBeatImpossibleBot {
                InsightRow(icon: "trophy.fill", title: "Impossible Victories", value: "\(stats.impossibleBotWins)")
            }
        }
    }
}

private struct InsightRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.5))
                .frame(width: 20)
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.8))
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
        }
    }
}

private func formatDuration(_ ms: Int) -> String {
    let seconds = ms / 1000
    if seconds < 60 { return "\(seconds)s" }
    let minutes = seconds / 60
    let secs = seconds % 60
    if minutes < 60 { return secs > 0 ? "\(minutes)m \(secs)s" : "\(minutes)m" }
    let hours = minutes / 60
    let mins = minutes % 60
    return mins > 0 ? "\(hours)h \(mins)m" : "\(hours)h"
}

struct FriendsView: View {
    @ObservedObject var model: AppModel
    @State private var query = ""
    @State private var selectedTab = 0

    private var requestCount: Int { model.friendRequests.count }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar(title: "Friends (\(model.friends.count))") { model.screen = .home }
                .padding(.bottom, 8)

            // Search bar
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.white.opacity(0.4))
                TextField("Search username or name", text: $query)
                    .textInputAutocapitalization(.never)
                if !query.isEmpty {
                    Button { query = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.white.opacity(0.4))
                    }
                }
            }
            .padding(12)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .padding(.horizontal, 24)
            .padding(.bottom, 12)
            .onChange(of: query) { _, newValue in Task { await model.searchProfiles(newValue) } }

            if query.isEmpty {
                // Segmented control
                HStack(spacing: 0) {
                    segmentButton("Friends", tag: 0)
                    segmentButton("Requests" + (requestCount > 0 ? " (\(requestCount))" : ""), tag: 1)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 8)
            }

            ScrollView {
                VStack(spacing: 10) {
                    if !query.isEmpty {
                        // Search results
                        ForEach(model.searchResults) { result in
                            searchResultRow(result)
                        }
                        if model.searchResults.isEmpty && query.count >= 2 {
                            Text("No users found")
                                .foregroundStyle(.white.opacity(0.5))
                                .padding(.top, 20)
                        }
                    } else if selectedTab == 0 {
                        // Friends list
                        if model.friends.isEmpty {
                            VStack(spacing: 8) {
                                Text("No friends yet")
                                    .font(.headline).foregroundStyle(.white.opacity(0.5))
                                Text("Search for users to add friends")
                                    .font(.subheadline).foregroundStyle(.white.opacity(0.4))
                            }
                            .padding(.top, 40)
                        }
                        ForEach(model.friends) { friend in
                            Button { Task { await model.openFriendProfile(friend) } } label: {
                                NativeCard {
                                    HStack(spacing: 12) {
                                        AvatarBubble(avatarID: friend.avatarId, avatarColor: friend.avatarColor)
                                        VStack(alignment: .leading, spacing: 2) {
                                            HStack(spacing: 6) {
                                                Text(friend.displayName).fontWeight(.semibold)
                                                if friend.hasBeatImpossibleBot == true {
                                                    Text("💀").font(.caption)
                                                }
                                            }
                                            Text("@\(friend.username)")
                                                .font(.caption)
                                                .foregroundStyle(.white.opacity(0.6))
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.white.opacity(0.3))
                                    }
                                }
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) { Task { await model.removeFriend(userID: friend.userId) } } label: {
                                    Label("Remove", systemImage: "person.badge.minus")
                                }
                            }
                        }
                    } else {
                        // Requests tab
                        if model.friendRequests.isEmpty {
                            Text("No pending requests")
                                .foregroundStyle(.white.opacity(0.5))
                                .padding(.top, 40)
                        }
                        ForEach(model.friendRequests) { request in
                            NativeCard {
                                HStack(spacing: 12) {
                                    AvatarBubble(avatarID: request.avatarId, avatarColor: request.avatarColor)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(request.displayName).fontWeight(.semibold)
                                        Text("@\(request.username)")
                                            .font(.caption)
                                            .foregroundStyle(.white.opacity(0.6))
                                    }
                                    Spacer()
                                    Button { Task { await model.acceptFriendRequest(userID: request.userId) } } label: {
                                        Text("Accept")
                                            .font(.caption.weight(.bold))
                                            .padding(.horizontal, 12).padding(.vertical, 8)
                                            .background(Color(hex: "#22c55e"), in: Capsule())
                                    }
                                    Button { Task { await model.rejectFriendRequest(userID: request.userId) } } label: {
                                        Image(systemName: "xmark")
                                            .font(.caption.weight(.bold))
                                            .padding(8)
                                            .background(Color.white.opacity(0.1), in: Circle())
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
    }

    @ViewBuilder
    private func searchResultRow(_ result: SearchResult) -> some View {
        NativeCard {
            HStack(spacing: 12) {
                AvatarBubble(avatarID: result.avatarId, avatarColor: result.avatarColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.displayName).fontWeight(.semibold)
                    Text("@\(result.username)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }
                Spacer()
                switch result.friendStatus {
                case "friend":
                    Button { Task { await model.openFriendProfileFromSearch(result) } } label: {
                        Text("Friends")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(hex: "#22c55e"))
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Color(hex: "#22c55e").opacity(0.15), in: Capsule())
                    }
                case "pending_sent":
                    Text("Pending")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.5))
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Color.white.opacity(0.06), in: Capsule())
                case "pending_received":
                    Button { Task { await model.acceptFriendRequest(userID: result.id); await model.searchProfiles(query) } } label: {
                        Text("Accept")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Color(hex: "#22c55e"), in: Capsule())
                    }
                default:
                    Button { Task { await model.sendFriendRequest(username: result.username); await model.searchProfiles(query) } } label: {
                        Text("Add")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Color(hex: "#6366f1"), in: Capsule())
                    }
                }
            }
        }
    }

    private func segmentButton(_ title: String, tag: Int) -> some View {
        Button {
            selectedTab = tag
        } label: {
            Text(title)
                .font(.subheadline.weight(selectedTab == tag ? .bold : .medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    selectedTab == tag ? Color(hex: "#6366f1") : Color.white.opacity(0.06),
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                )
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

// MARK: - FriendProfileView

struct FriendProfileView: View {
    @ObservedObject var model: AppModel

    private var profile: FriendProfileResponse? { model.viewingProfile }
    private var detailed: DetailedStatsResponse? { model.viewingDetailedStats }
    private var h2h: HeadToHeadResponse? { model.headToHead }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HeaderBar(title: "Profile") { model.screen = .friends }

                if let p = profile {
                    // Profile Header
                    VStack(spacing: 10) {
                        AvatarBubble(avatarID: p.user.avatarId, avatarColor: p.user.avatarColor, size: 72)
                        Text(p.user.displayName).font(.title2.weight(.bold))
                        Text("@\(p.user.username)").foregroundStyle(.white.opacity(0.6))
                        HStack(spacing: 16) {
                            if let ts = p.user.createdAt {
                                Text("Member since \(memberSinceText(ts))")
                                    .font(.caption).foregroundStyle(.white.opacity(0.5))
                            }
                            Text("\(p.friendCount) Friends")
                                .font(.caption).foregroundStyle(.white.opacity(0.5))
                        }
                        friendActionButton(status: p.friendStatus, userId: p.user.id, username: p.user.username)
                    }
                    .padding(.horizontal, 24)

                    // Head-to-Head
                    if let h = h2h, h.gamesPlayed > 0 {
                        headToHeadCard(h, name: p.user.displayName)
                            .padding(.horizontal, 24)
                    } else if h2h != nil {
                        NativeCard {
                            VStack(spacing: 6) {
                                Text("You vs \(p.user.displayName)").font(.headline.weight(.bold))
                                Text("Haven't played together yet")
                                    .font(.subheadline).foregroundStyle(.white.opacity(0.5))
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .padding(.horizontal, 24)
                    }

                    // Quick Stats
                    HStack(spacing: 12) {
                        QuickStatCard(title: "Win Rate", value: "\(p.stats.winRate)%", accent: "#6366f1")
                        QuickStatCard(title: "Games", value: "\(p.stats.gamesPlayed)", accent: "#06b6d4")
                        QuickStatCard(title: "Streak", value: "\(p.stats.currentWinStreak)", accent: "#22c55e")
                        QuickStatCard(title: "Best", value: "\(p.stats.longestWinStreak)", accent: "#f97316")
                    }
                    .padding(.horizontal, 24)

                    // Mode Breakdown
                    if let d = detailed {
                        let modes = modeList(d.byMode)
                        if !modes.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Game Modes").font(.headline.weight(.bold))
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 10) {
                                        ForEach(modes, id: \.0) { name, breakdown in
                                            ModeCard(name: name, breakdown: breakdown)
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 24)
                        }
                    }

                    // Recent Games Together
                    if let h = h2h, !h.recentGames.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Recent Games Together").font(.headline.weight(.bold))
                            ForEach(h.recentGames) { game in
                                GameHistoryRow(game: game)
                            }
                        }
                        .padding(.horizontal, 24)
                    }
                } else {
                    ProgressView()
                        .padding(.top, 40)
                }
            }
            .padding(.bottom, 32)
        }
    }

    @ViewBuilder
    private func friendActionButton(status: String, userId: String, username: String) -> some View {
        switch status {
        case "friend":
            Button { Task { await model.removeFriend(userID: userId); await model.loadFriendProfile(username: username) } } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark")
                    Text("Friends")
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Color(hex: "#22c55e").opacity(0.2), in: Capsule())
                .foregroundStyle(Color(hex: "#22c55e"))
            }
        case "pending_sent":
            Text("Request Sent")
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Color.white.opacity(0.08), in: Capsule())
                .foregroundStyle(.white.opacity(0.5))
        case "pending_received":
            Button { Task { await model.acceptFriendRequest(userID: userId); await model.loadFriendProfile(username: username) } } label: {
                Text("Accept Request")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Color(hex: "#22c55e"), in: Capsule())
            }
        default:
            Button { Task { await model.sendFriendRequest(username: username); await model.loadFriendProfile(username: username) } } label: {
                HStack(spacing: 6) {
                    Image(systemName: "person.badge.plus")
                    Text("Add Friend")
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Color(hex: "#6366f1"), in: Capsule())
            }
        }
    }

    @ViewBuilder
    private func headToHeadCard(_ h: HeadToHeadResponse, name: String) -> some View {
        NativeCard {
            VStack(spacing: 12) {
                Text("You vs \(name)").font(.headline.weight(.bold))

                // Win bar
                GeometryReader { geo in
                    let total = max(h.myWins + h.theirWins, 1)
                    let myWidth = geo.size.width * CGFloat(h.myWins) / CGFloat(total)
                    HStack(spacing: 2) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(hex: "#6366f1"))
                            .frame(width: max(myWidth, h.myWins > 0 ? 4 : 0))
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(hex: "#ef4444"))
                            .frame(width: max(geo.size.width - myWidth - 2, h.theirWins > 0 ? 4 : 0))
                    }
                }
                .frame(height: 10)

                Text("\(h.myWins) wins – \(h.theirWins) wins")
                    .font(.subheadline.weight(.semibold))

                HStack(spacing: 20) {
                    VStack(spacing: 2) {
                        Text("Same Team").font(.caption2.weight(.medium)).foregroundStyle(.white.opacity(0.5))
                        Text("\(h.sameTeamGames) games (\(h.sameTeamWins) W)")
                            .font(.caption.weight(.semibold))
                    }
                    VStack(spacing: 2) {
                        Text("Opposing").font(.caption2.weight(.medium)).foregroundStyle(.white.opacity(0.5))
                        Text("\(h.oppositeTeamGames) games (\(h.oppositeTeamMyWins) W)")
                            .font(.caption.weight(.semibold))
                    }
                }
            }
        }
    }

    private func modeList(_ modes: ModeBreakdowns) -> [(String, ModeBreakdown)] {
        var list: [(String, ModeBreakdown)] = []
        if let m = modes.botEasy { list.append(("Bot Easy", m)) }
        if let m = modes.botMedium { list.append(("Bot Medium", m)) }
        if let m = modes.botHard { list.append(("Bot Hard", m)) }
        if let m = modes.botImpossible { list.append(("Bot Impossible", m)) }
        if let m = modes.multiplayer { list.append(("Multiplayer", m)) }
        return list
    }

    private func memberSinceText(_ timestamp: Double) -> String {
        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        return formatter.string(from: date)
    }
}

// MARK: - GameHistoryView

struct GameHistoryView: View {
    @ObservedObject var model: AppModel
    @State private var modeFilter: String? = nil
    @State private var difficultyFilter: String? = nil
    @State private var resultFilter: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar(title: "Game History") { model.screen = .profile }
                .padding(.bottom, 8)

            // Filter chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(title: "All", selected: modeFilter == nil && resultFilter == nil) {
                        modeFilter = nil; difficultyFilter = nil; resultFilter = nil; reloadHistory()
                    }
                    FilterChip(title: "Bot", selected: modeFilter == "bot") {
                        modeFilter = "bot"; reloadHistory()
                    }
                    FilterChip(title: "Multiplayer", selected: modeFilter == "multiplayer") {
                        modeFilter = "multiplayer"; difficultyFilter = nil; reloadHistory()
                    }

                    if modeFilter == "bot" {
                        Divider().frame(height: 20)
                        ForEach(["easy", "medium", "hard", "impossible"], id: \.self) { diff in
                            FilterChip(title: diff.capitalized, selected: difficultyFilter == diff) {
                                difficultyFilter = difficultyFilter == diff ? nil : diff; reloadHistory()
                            }
                        }
                    }

                    Divider().frame(height: 20)
                    FilterChip(title: "Wins", selected: resultFilter == "wins") {
                        resultFilter = resultFilter == "wins" ? nil : "wins"; reloadHistory()
                    }
                    FilterChip(title: "Losses", selected: resultFilter == "losses") {
                        resultFilter = resultFilter == "losses" ? nil : "losses"; reloadHistory()
                    }
                }
                .padding(.horizontal, 24)
            }
            .padding(.bottom, 12)

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(model.gameHistoryList) { game in
                        GameHistoryRow(game: game)
                    }

                    if model.gameHistoryHasMore && !model.gameHistoryList.isEmpty {
                        Button("Load More") {
                            Task {
                                await model.loadGameHistory(
                                    mode: modeFilter,
                                    difficulty: difficultyFilter,
                                    result: resultFilter,
                                    offset: model.gameHistoryList.count
                                )
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(hex: "#6366f1"))
                        .padding(.vertical, 16)
                    }

                    if model.gameHistoryList.isEmpty {
                        Text("No games found")
                            .foregroundStyle(.white.opacity(0.5))
                            .padding(.top, 40)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
    }

    private func reloadHistory() {
        Task {
            await model.loadGameHistory(
                mode: modeFilter,
                difficulty: difficultyFilter,
                result: resultFilter
            )
        }
    }
}

private struct FilterChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(selected ? .bold : .medium))
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(
                    selected ? Color(hex: "#6366f1") : Color.white.opacity(0.06),
                    in: Capsule()
                )
        }
    }
}

struct GameHistoryRow: View {
    let game: GameHistorySummary

    var body: some View {
        HStack(spacing: 12) {
            // W/L badge
            Text(game.myWon ? "W" : "L")
                .font(.caption.weight(.black))
                .foregroundStyle(game.myWon ? Color(hex: "#22c55e") : Color(hex: "#ef4444"))
                .frame(width: 28, height: 28)
                .background(
                    (game.myWon ? Color(hex: "#22c55e") : Color(hex: "#ef4444")).opacity(0.15),
                    in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                )

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    if let diff = game.botDifficulty {
                        Text("vs Bot (\(diff.capitalized))")
                            .font(.subheadline.weight(.semibold))
                    } else {
                        Text("\(game.playerCount) Players")
                            .font(.subheadline.weight(.semibold))
                    }
                    if game.gameVariant == "king-of-the-board" {
                        Text("KOTB")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color(hex: "#f97316").opacity(0.2), in: Capsule())
                            .foregroundStyle(Color(hex: "#f97316"))
                    }
                }
                Text("\(gameDate(game.endedAt)) · \(formatDuration(game.durationMs))")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
            }

            Spacer()

            // Team color dot
            Circle()
                .fill(teamDotColor(game.myTeamColor))
                .frame(width: 10, height: 10)
        }
        .padding(12)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func gameDate(_ timestamp: Double) -> String {
        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter.string(from: date)
    }

    private func teamDotColor(_ color: String) -> Color {
        switch color {
        case "blue": return Color(hex: "#2980b9")
        case "green": return Color(hex: "#27ae60")
        case "red": return Color(hex: "#c0392b")
        default: return .gray
        }
    }
}
