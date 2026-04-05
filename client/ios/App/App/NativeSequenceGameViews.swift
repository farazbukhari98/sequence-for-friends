import SwiftUI
import UIKit

extension AppModel {
    func leaveRoom(clearError: Bool = true) {
        clearActiveRoom(notifyServer: true, destination: user == nil ? .auth : .home, clearError: clearError)
    }

    func toggleReady() async {
        let _: SuccessResponse? = try? await socketManager.request(type: "toggle-ready")
    }

    func startGame() async {
        let _: SuccessResponse? = try? await socketManager.request(type: "start-game")
    }

    func continueSeries() async {
        let _: SuccessResponse? = try? await socketManager.request(type: "continue-series")
    }

    func endSeries() async {
        let _: SuccessResponse? = try? await socketManager.request(type: "end-series")
    }

    func addBot(difficulty: String) async {
        let _: SuccessResponse? = try? await socketManager.request(type: "add-bot", data: ["difficulty": difficulty])
    }

    func updateRoomSettings(turnTimeLimit: Int? = nil, sequencesToWin: Int? = nil, sequenceLength: Int? = nil, seriesLength: Int? = nil, gameVariant: GameVariant? = nil) async {
        let _: SuccessResponse? = try? await socketManager.request(
            type: "update-room-settings",
            data: UpdateRoomSettingsPayload(
                turnTimeLimit: turnTimeLimit,
                sequencesToWin: sequencesToWin,
                sequenceLength: sequenceLength,
                seriesLength: seriesLength,
                gameVariant: gameVariant
            )
        )
    }

    func requestTeamSwitch(to teamIndex: Int) async {
        let _: SuccessResponse? = try? await socketManager.request(type: "request-team-switch", data: ["toTeamIndex": teamIndex])
    }

    func respondToTeamSwitch(playerID: String, approved: Bool) async {
        let _: SuccessResponse? = try? await socketManager.request(type: "respond-team-switch", data: TeamSwitchResponsePayload(playerId: playerID, approved: approved))
        teamSwitchRequest = nil
    }

    @discardableResult
    func sendGameAction(_ action: GameAction) async -> MoveResult? {
        do {
            return try await socketManager.request(type: "game-action", data: action)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func kickPlayer(_ playerID: String) async {
        try? await socketManager.send(type: "kick-player", data: ["playerId": playerID])
    }
}

struct NativeBackground: View {
    var body: some View {
        LinearGradient(colors: [Color(hex: "#050505"), Color(hex: "#0b1020")], startPoint: .top, endPoint: .bottom)
            .overlay(alignment: .top) {
                RadialGradient(colors: [Color(hex: "#6366f1").opacity(0.35), .clear], center: .top, startRadius: 10, endRadius: 320)
                    .ignoresSafeArea()
            }
            .ignoresSafeArea()
    }
}

struct NativeLoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView().tint(.white)
            Text("Loading...").foregroundStyle(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
}

@MainActor
enum NativeHaptics {
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    static func notify(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        UINotificationFeedbackGenerator().notificationOccurred(type)
    }
}

struct NativeToast: View {
    let text: String
    let onClose: () -> Void

    var body: some View {
        HStack {
            Text(text).font(.footnote.weight(.semibold))
            Spacer()
            Button("Dismiss", action: onClose)
        }
        .padding()
        .background(Color.red.opacity(0.92), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.horizontal, 16)
    }
}

struct ConnectionStatusOverlay: View {
    @ObservedObject var model: AppModel

    var body: some View {
        let status = model.connectionStatus

        VStack {
            Spacer()
            NativeCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        if status.phase == .recovering || status.phase == .offline {
                            ProgressView().tint(.white)
                        }
                        Text(title(for: status))
                            .font(.headline.weight(.bold))
                    }
                    if let message = status.message {
                        Text(message)
                            .foregroundStyle(.white.opacity(0.75))
                    }
                    if status.phase == .recovering, status.attempt > 0 {
                        Text("Attempt \(status.attempt) of \(NativeConfig.reconnectRetryDelays.count)")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    HStack(spacing: 12) {
                        if status.canRetry {
                            NativePrimaryButton(title: "Try Again") {
                                model.retryConnectionRecovery()
                            }
                        }
                        NativeSecondaryButton(title: "Back to Home") {
                            model.returnHomeFromConnectionFailure()
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func title(for status: ConnectionStatus) -> String {
        switch status.phase {
        case .recovering:
            return "Restoring Connection"
        case .offline:
            return "You're Offline"
        case .terminalFailure:
            return "Couldn't Reconnect"
        default:
            return "Connection Update"
        }
    }
}

struct NativeCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Color.white.opacity(0.08)))
    }
}

struct NativePrimaryButton: View {
    let title: String
    var disabled = false
    var tintColor: Color? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline.weight(.bold))
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(disabled ? Color.white.opacity(0.08) : (tintColor ?? Color(hex: "#6366f1")),
                            in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .disabled(disabled)
    }
}

struct NativeSecondaryButton: View {
    let title: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.white.opacity(0.08)))
                .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .disabled(disabled)
    }
}

struct AvatarBubble: View {
    let avatarID: String
    let avatarColor: String
    var size: CGFloat = 52

    var body: some View {
        Text(NativeTheme.avatarOptions.first(where: { $0.id == avatarID })?.emoji ?? "👤")
            .font(.system(size: size * 0.54))
            .frame(width: size, height: size)
            .background(Color(hex: avatarColor), in: Circle())
    }
}

struct AvatarPickerView: View {
    @Binding var selectedAvatarID: String
    @Binding var selectedColor: String

    var body: some View {
        VStack(spacing: 16) {
            AvatarBubble(avatarID: selectedAvatarID, avatarColor: selectedColor)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
                ForEach(NativeTheme.avatarOptions) { option in
                    Button { selectedAvatarID = option.id } label: { Text(option.emoji).font(.largeTitle).padding(10).background(Color.white.opacity(selectedAvatarID == option.id ? 0.12 : 0.04), in: RoundedRectangle(cornerRadius: 16, style: .continuous)) }
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 5), spacing: 12) {
                ForEach(NativeTheme.avatarColors, id: \.self) { color in
                    Circle().fill(Color(hex: color)).frame(width: 34, height: 34).overlay(Circle().stroke(.white, lineWidth: selectedColor == color ? 2 : 0)).onTapGesture { selectedColor = color }
                }
            }
        }
    }
}

struct StatsSummaryView: View {
    let stats: UserStats

    var body: some View {
        NativeCard {
            VStack(spacing: 12) {
                HStack { StatValue(title: "Win Rate", value: "\(stats.winRate)%"); StatValue(title: "Games", value: "\(stats.gamesPlayed)"); StatValue(title: "Wins", value: "\(stats.gamesWon)") }
                HStack { StatValue(title: "Best Streak", value: "\(stats.longestWinStreak)"); StatValue(title: "Sequences", value: "\(stats.sequencesCompleted)"); StatValue(title: "Cards", value: "\(stats.cardsPlayed)") }
            }
        }
    }
}

struct NativeLobbyView: View {
    @ObservedObject var model: AppModel
    @State private var timer = 0
    @State private var sequences = 2
    @State private var sequenceLength = 5
    @State private var seriesLength = 0
    @State private var gameVariant: GameVariant = .classic
    @State private var showingLeaveConfirmation = false
    @State private var showingInviteSheet = false
    @State private var copiedRoomCode = false
    @State private var showSettings = false
    @State private var isSyncingFromServer = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                lobbyHeader

                if let roomInfo = model.roomInfo, let me = model.playerID {
                    lobbyContent(roomInfo: roomInfo, me: me)
                }
            }
            .padding(.bottom, 32)
        }
        .sheet(isPresented: $showingInviteSheet) {
            if let roomCode = model.roomInfo?.code {
                NativeInviteFriendsSheet(model: model, roomCode: roomCode)
            }
        }
        .onAppear {
            syncLocalSettings(from: model.roomInfo)
        }
        .onChange(of: model.roomInfo) { _, roomInfo in
            syncLocalSettings(from: roomInfo)
        }
        .onChange(of: gameVariant) { _, newVariant in
            if newVariant == .kingOfTheBoard {
                // Set sequenceLength silently to avoid double-submit from its observer
                isSyncingFromServer = true
                sequenceLength = 5
                DispatchQueue.main.async { isSyncingFromServer = false }
            }
            autoApplySettings()
        }
        .onChange(of: timer) { _, _ in autoApplySettings() }
        .onChange(of: sequences) { _, _ in autoApplySettings() }
        .onChange(of: sequenceLength) { _, _ in autoApplySettings() }
        .onChange(of: seriesLength) { _, _ in autoApplySettings() }
        .alert("Leave Room?", isPresented: $showingLeaveConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Leave", role: .destructive) { model.leaveRoom() }
        } message: {
            Text("Leaving as host will close the room for everyone.")
        }
    }

    // MARK: - Header

    private var lobbyHeader: some View {
        HStack {
            Button(action: {
                if model.roomInfo?.hostId == model.playerID, (model.roomInfo?.players.count ?? 0) > 1 {
                    showingLeaveConfirmation = true
                } else {
                    model.leaveRoom()
                }
            }) {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            Spacer()
            Text(model.roomInfo?.name ?? "Lobby")
                .font(.headline.weight(.bold))
            Spacer()
            if model.roomInfo?.hostId == model.playerID {
                Button(action: { showSettings.toggle() }) {
                    Image(systemName: showSettings ? "gearshape.fill" : "gearshape")
                        .font(.body.weight(.semibold))
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                }
            } else {
                Color.clear.frame(width: 36, height: 36)
            }
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Content

    @ViewBuilder
    private func lobbyContent(roomInfo: RoomInfo, me: String) -> some View {
        // Room code card
        lobbyRoomCodeCard(roomInfo: roomInfo)
            .padding(.horizontal, 16)

        // Settings strip
        LobbySettingsStrip(roomInfo: roomInfo)
            .padding(.horizontal, 16)

        // Alerts
        lobbyAlerts(roomInfo: roomInfo, me: me)

        // Host settings
        if roomInfo.hostId == me, showSettings {
            lobbyHostSettings(roomInfo: roomInfo)
                .padding(.horizontal, 16)
                .transition(.opacity.combined(with: .move(edge: .top)))
        }

        // Team cards
        lobbyTeamCards(roomInfo: roomInfo, me: me)

        // Team switch request
        if roomInfo.hostId == me, let request = model.teamSwitchRequest {
            NativeCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Team Switch Request").font(.headline.weight(.bold))
                    Text("\(request.playerName) wants to switch teams.")
                        .foregroundStyle(.white.opacity(0.75))
                    HStack(spacing: 12) {
                        NativePrimaryButton(title: "Approve") {
                            Task { await model.respondToTeamSwitch(playerID: request.playerId, approved: true) }
                        }
                        NativeSecondaryButton(title: "Decline") {
                            Task { await model.respondToTeamSwitch(playerID: request.playerId, approved: false) }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }

        // Action buttons
        VStack(spacing: 10) {
            NativePrimaryButton(title: mePlayer(for: roomInfo, playerID: me)?.ready == true ? "Ready" : "Ready Up") {
                Task { await model.toggleReady() }
            }
            if roomInfo.hostId == me {
                NativePrimaryButton(
                    title: startButtonTitle(roomInfo: roomInfo),
                    disabled: !canStartGame(roomInfo: roomInfo),
                    tintColor: Color(hex: "#22c55e")
                ) {
                    Task { await model.startGame() }
                }
            }
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Room Code Card

    @ViewBuilder
    private func lobbyRoomCodeCard(roomInfo: RoomInfo) -> some View {
        NativeCard {
            VStack(spacing: 14) {
                Text("ROOM CODE")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.5))
                Text(roomInfo.code)
                    .font(.system(size: 32, weight: .black, design: .rounded))
                    .tracking(4)

                HStack(spacing: 8) {
                    Button(action: {
                        UIPasteboard.general.string = roomInfo.code
                        copiedRoomCode = true
                        NativeHaptics.impact(.light)
                        Task {
                            try? await Task.sleep(nanoseconds: 1_500_000_000)
                            copiedRoomCode = false
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: copiedRoomCode ? "checkmark" : "doc.on.doc")
                                .font(.caption.weight(.bold))
                            Text(copiedRoomCode ? "Copied" : "Copy")
                                .font(.caption.weight(.bold))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.08), in: Capsule())
                        .contentShape(Capsule())
                    }

                    ShareLink(item: "https://sequence-for-friends.farazbukhari98.workers.dev/join/\(roomInfo.code)") {
                        HStack(spacing: 6) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.caption.weight(.bold))
                            Text("Share")
                                .font(.caption.weight(.bold))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.08), in: Capsule())
                    }

                    if model.user != nil {
                        Button(action: { showingInviteSheet = true }) {
                            HStack(spacing: 6) {
                                Image(systemName: "person.badge.plus")
                                    .font(.caption.weight(.bold))
                                Text("Invite")
                                    .font(.caption.weight(.bold))
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color(hex: "#6366f1").opacity(0.3), in: Capsule())
                            .contentShape(Capsule())
                        }
                    }
                }
            }
        }
    }

    // MARK: - Alerts

    @ViewBuilder
    private func lobbyAlerts(roomInfo: RoomInfo, me: String) -> some View {
        if let response = model.teamSwitchResponse, response.playerId == me {
            NativeCard {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(response.approved ? "Switch Approved" : "Switch Denied")
                            .font(.subheadline.weight(.bold))
                        Text(response.approved ? "Your team was changed." : "Your request was denied.")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    Spacer()
                    Button(action: { model.clearTeamSwitchResponse() }) {
                        Image(systemName: "xmark")
                            .font(.caption.weight(.bold))
                            .frame(width: 28, height: 28)
                            .background(Color.white.opacity(0.1), in: Circle())
                    }
                }
            }
            .padding(.horizontal, 16)
        }

        if let gameModeInfo = model.gameModeInfo {
            NativeGameModeModal(gameModeInfo: gameModeInfo) {
                model.clearGameModeInfo()
            }
        }
    }

    // MARK: - Host Settings

    @ViewBuilder
    private func lobbyHostSettings(roomInfo: RoomInfo) -> some View {
        NativeCard {
            VStack(spacing: 16) {
                HStack {
                    Text("Game Settings")
                        .font(.headline.weight(.bold))
                    Spacer()
                }

                LobbyOptionRow(title: "TIMER", icon: "timer") {
                    LobbySegmentPicker(
                        selection: $timer,
                        options: [(0, "None"), (15, "15s"), (30, "30s"), (60, "60s"), (120, "2m")]
                    )
                }

                LobbyOptionRow(title: "VARIANT", icon: "crown.fill") {
                    LobbySegmentPicker(
                        selection: $gameVariant,
                        options: [(.classic, "Classic"), (.kingOfTheBoard, "King Zone")],
                        disabledOptions: roomInfo.maxPlayers < 4 || roomInfo.players.contains(where: { $0.isBot == true }) ? [.kingOfTheBoard] : [],
                        activeColor: gameVariant == .kingOfTheBoard ? Color(hex: "#d4a017") : nil
                    )
                }

                if gameVariant != .kingOfTheBoard {
                    Text(roomInfo.players.contains(where: { $0.isBot == true })
                         ? "Remove bots to enable King of the Board."
                         : roomInfo.maxPlayers < 4
                            ? "King of the Board requires a 4-seat-or-larger room."
                            : "King of the Board is multiplayer-only and works in 4+ player team games.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.72))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if gameVariant == .kingOfTheBoard {
                    HStack(spacing: 10) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(
                                LinearGradient(colors: [Color(hex: "#facc15"), Color(hex: "#f59e0b")],
                                               startPoint: .top, endPoint: .bottom)
                            )
                            .frame(width: 32, height: 32)
                            .background(Color(hex: "#facc15").opacity(0.15), in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text("King of the Board")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Color(hex: "#facc15"))
                            Text("Shared 3x3 hotspot. Zone sequences = 2 pts, normal = 1 pt. First to 3 wins.")
                                .font(.caption2)
                                .foregroundStyle(.white.opacity(0.72))
                        }
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(hex: "#facc15").opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color(hex: "#facc15").opacity(0.2), lineWidth: 1))
                }

                LobbyOptionRow(title: "SEQUENCES TO WIN", icon: "star.fill") {
                    if gameVariant == .kingOfTheBoard {
                        Text("First to 3 points")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.9))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        LobbySegmentPicker(
                            selection: $sequences,
                            options: [(1, "1"), (2, "2"), (3, "3"), (4, "4")]
                        )
                    }
                }

                LobbyOptionRow(title: "MODE", icon: "square.grid.3x3.fill") {
                    LobbySegmentPicker(
                        selection: $sequenceLength,
                        options: [(4, "Blitz"), (5, "Standard")],
                        disabled: gameVariant == .kingOfTheBoard
                    )
                }

                if gameVariant == .kingOfTheBoard {
                    Text("King of the Board always uses standard 5-chip sequences.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.72))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                LobbyOptionRow(title: "SERIES", icon: "trophy.fill") {
                    LobbySegmentPicker(
                        selection: $seriesLength,
                        options: [(0, "Single"), (3, "Bo3"), (5, "Bo5"), (7, "Bo7")]
                    )
                }

                HStack(spacing: 10) {
                    if gameVariant == .kingOfTheBoard {
                        Text("Bots are disabled in King of the Board.")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.58))
                    } else {
                        Text("Add Bot:")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.5))

                        ForEach(lobbyBotOptions, id: \.0) { difficulty, label, colorHex in
                            Button(action: {
                                Task { await model.addBot(difficulty: difficulty) }
                                NativeHaptics.impact(.light)
                            }) {
                                Text(label)
                                    .font(.caption.weight(.bold))
                                    .frame(width: 32, height: 32)
                                    .background(Color(hex: colorHex).opacity(0.2), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                                    .foregroundStyle(Color(hex: colorHex))
                                    .contentShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }

                        Spacer()
                    }
                }
            }
        }
    }

    private var lobbyBotOptions: [(String, String, String)] {
        [("easy", "E", "#22c55e"), ("medium", "M", "#eab308"), ("hard", "H", "#ef4444"), ("impossible", "X", "#a855f7")]
    }

    // MARK: - Team Cards

    @ViewBuilder
    private func lobbyTeamCards(roomInfo: RoomInfo, me: String) -> some View {
        ForEach(0..<roomInfo.teamCount, id: \.self) { teamIndex in
            let teamColor = roomInfo.players.first(where: { $0.teamIndex == teamIndex })?.teamColor ?? .blue
            NativeCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color(hex: teamColor.classicHex))
                            .frame(width: 24, height: 24)
                            .overlay {
                                Text(teamColor.letter)
                                    .font(.system(size: 10, weight: .black))
                            }
                        Text("Team \(teamColor.letter)")
                            .font(.subheadline.weight(.bold))
                        Spacer()
                        Text("\(roomInfo.players.filter { $0.teamIndex == teamIndex }.count)")
                            .font(.caption.monospacedDigit().weight(.bold))
                            .foregroundStyle(.white.opacity(0.5))
                    }

                    ForEach(roomInfo.players.filter { $0.teamIndex == teamIndex }) { player in
                        LobbyPlayerRow(player: player, isHost: player.id == roomInfo.hostId, isMe: player.id == me, canKick: roomInfo.hostId == me && player.id != me) {
                            Task { await model.kickPlayer(player.id) }
                        }
                    }

                    if mePlayer(for: roomInfo, playerID: me)?.teamIndex != teamIndex {
                        Button(action: {
                            Task { await model.requestTeamSwitch(to: teamIndex) }
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.left.arrow.right")
                                    .font(.caption2.weight(.semibold))
                                Text("Switch to this team")
                                    .font(.caption.weight(.semibold))
                            }
                            .foregroundStyle(Color(hex: teamColor.classicHex))
                            .padding(.top, 4)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Helpers

    private func mePlayer(for roomInfo: RoomInfo, playerID: String) -> PublicPlayer? {
        roomInfo.players.first(where: { $0.id == playerID })
    }

    private func canStartGame(roomInfo: RoomInfo) -> Bool {
        let validPlayerCounts = [2, 3, 4, 6, 8, 9, 10, 12]
        guard validPlayerCounts.contains(roomInfo.players.count) else { return false }
        guard roomInfo.players.allSatisfy({ $0.ready }) else { return false }
        if roomInfo.gameVariant == .kingOfTheBoard {
            return roomInfo.players.count >= 4 && !roomInfo.players.contains(where: { $0.isBot == true })
        }
        return true
    }

    private func startButtonTitle(roomInfo: RoomInfo) -> String {
        if roomInfo.gameVariant == .kingOfTheBoard, roomInfo.players.count < 4 {
            return "Need 4+ Players"
        }
        if roomInfo.gameVariant == .kingOfTheBoard, roomInfo.players.contains(where: { $0.isBot == true }) {
            return "Remove Bots First"
        }
        if !roomInfo.players.allSatisfy({ $0.ready }) {
            return "Waiting for Players"
        }
        return "Begin Game"
    }

    private func syncLocalSettings(from roomInfo: RoomInfo?) {
        isSyncingFromServer = true
        timer = roomInfo?.turnTimeLimit ?? 0
        sequences = roomInfo?.sequencesToWin ?? 2
        sequenceLength = roomInfo?.sequenceLength ?? 5
        seriesLength = roomInfo?.seriesLength ?? 0
        gameVariant = roomInfo?.gameVariant ?? .classic
        DispatchQueue.main.async { isSyncingFromServer = false }
    }

    private func autoApplySettings() {
        guard !isSyncingFromServer else { return }
        Task {
            await model.updateRoomSettings(
                turnTimeLimit: timer,
                sequencesToWin: gameVariant == .kingOfTheBoard ? nil : sequences,
                sequenceLength: gameVariant == .kingOfTheBoard ? 5 : sequenceLength,
                seriesLength: seriesLength,
                gameVariant: gameVariant
            )
        }
    }
}

// MARK: - Lobby sub-components

private struct LobbySettingsStrip: View {
    let roomInfo: RoomInfo

    private var isKotB: Bool { roomInfo.gameVariant == .kingOfTheBoard }

    var body: some View {
        HStack(spacing: 0) {
            LobbyInfoChip(icon: "person.2.fill", value: "\(roomInfo.teamCount) Teams")
            LobbyInfoChip(
                icon: isKotB ? "crown.fill" : "square.grid.3x3.fill",
                value: isKotB ? "King Zone" : (roomInfo.sequenceLength == 4 ? "Blitz" : "Standard"),
                tintColor: isKotB ? Color(hex: "#facc15") : nil
            )
            LobbyInfoChip(icon: "trophy.fill", value: roomInfo.seriesLength == 0 ? "Single" : "Bo\(roomInfo.seriesLength)")
            LobbyInfoChip(icon: "timer", value: roomInfo.turnTimeLimit == 0 ? "No Timer" : "\(roomInfo.turnTimeLimit)s")
        }
    }
}

private struct LobbyInfoChip: View {
    let icon: String
    let value: String
    var tintColor: Color? = nil

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(tintColor ?? .white.opacity(0.4))
            Text(value)
                .font(.caption2.weight(.bold))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct LobbyPlayerRow: View {
    let player: PublicPlayer
    let isHost: Bool
    let isMe: Bool
    let canKick: Bool
    let onKick: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(player.ready ? Color.green : Color.white.opacity(0.15))
                .frame(width: 8, height: 8)

            Text(player.name)
                .font(.subheadline.weight(.semibold))

            if player.isBot == true {
                Text("BOT")
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(hex: "#a855f7").opacity(0.2), in: Capsule())
                    .foregroundStyle(Color(hex: "#a855f7"))
            }
            if isHost {
                Text("HOST")
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.white.opacity(0.08), in: Capsule())
            }
            if isMe {
                Text("YOU")
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(hex: "#6366f1").opacity(0.3), in: Capsule())
                    .foregroundStyle(Color(hex: "#818cf8"))
            }

            Spacer()

            Text(player.ready ? "READY" : "WAITING")
                .font(.caption2.weight(.bold))
                .foregroundStyle(player.ready ? Color.green : .white.opacity(0.4))

            if canKick {
                Button(action: onKick) {
                    Image(systemName: "xmark")
                        .font(.caption2.weight(.bold))
                        .frame(width: 24, height: 24)
                        .background(Color.red.opacity(0.15), in: Circle())
                        .foregroundStyle(.red.opacity(0.8))
                        .contentShape(Circle())
                }
            }
        }
        .padding(.vertical, 2)
    }
}

private struct LobbySegmentPicker<T: Hashable>: View {
    @Binding var selection: T
    let options: [(T, String)]
    var disabled = false
    var disabledOptions: Set<T> = []
    var activeColor: Color? = nil

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                let isSelected = selection == option.0
                let isOptionDisabled = disabled || disabledOptions.contains(option.0)
                let selectedColor = activeColor ?? Color(hex: "#6366f1")
                Button(action: {
                    guard !isOptionDisabled else { return }
                    NativeHaptics.selection()
                    selection = option.0
                }) {
                    Text(option.1)
                        .font(.caption.weight(isSelected ? .bold : .medium))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(
                            isSelected ? selectedColor : Color.white.opacity(isOptionDisabled ? 0.03 : 0.06),
                            in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                        )
                        .foregroundStyle(isOptionDisabled ? .white.opacity(0.35) : .white)
                        .opacity(isOptionDisabled ? 0.6 : 1.0)
                        .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .disabled(isOptionDisabled)
            }
        }
    }
}

private struct LobbyOptionRow<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.4))
                Text(title)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white.opacity(0.4))
            }
            content
        }
    }
}

private struct NativeInviteFriendsSheet: View {
    @ObservedObject var model: AppModel
    let roomCode: String
    @Environment(\.dismiss) private var dismiss

    @State private var invitingUserID: String?
    @State private var invitedUserIDs = Set<String>()

    var body: some View {
        NavigationStack {
            Group {
                if model.friends.isEmpty {
                    VStack(spacing: 16) {
                        Text("No friends to invite.")
                            .font(.headline.weight(.bold))
                        Text("Add friends from the Friends screen, then come back to invite them.")
                            .foregroundStyle(.white.opacity(0.72))
                            .multilineTextAlignment(.center)
                    }
                    .padding(24)
                } else {
                    ScrollView {
                        VStack(spacing: 14) {
                            ForEach(model.friends) { friend in
                                NativeCard {
                                    HStack {
                                        AvatarBubble(avatarID: friend.avatarId, avatarColor: friend.avatarColor)
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(friend.displayName)
                                                .font(.headline.weight(.semibold))
                                            Text("@\(friend.username)")
                                                .foregroundStyle(.white.opacity(0.65))
                                        }
                                        Spacer()
                                        if invitedUserIDs.contains(friend.userId) {
                                            Text("Sent!")
                                                .font(.footnote.weight(.bold))
                                                .foregroundStyle(.green)
                                        } else {
                                            Button(invitingUserID == friend.userId ? "..." : "Invite") {
                                                invitingUserID = friend.userId
                                                Task {
                                                    await model.inviteFriend(userID: friend.userId, roomCode: roomCode)
                                                    invitedUserIDs.insert(friend.userId)
                                                    invitingUserID = nil
                                                }
                                            }
                                            .buttonStyle(.borderedProminent)
                                            .disabled(invitingUserID == friend.userId)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(20)
                    }
                }
            }
            .navigationTitle("Invite Friend")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .task {
            if model.friends.isEmpty {
                await model.loadFriends()
            }
        }
    }
}

private struct NativeGameModeModal: View {
    let gameModeInfo: GameModeInfo
    let onDismiss: () -> Void

    var body: some View {
        NativeCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text(primaryMode.icon)
                        .font(.system(size: 28))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(primaryMode.title)
                            .font(.headline.weight(.black))
                        Text("\(gameModeInfo.changedBy) selected a special game mode.")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    Spacer()
                }
                Text(primaryMode.description)
                    .foregroundStyle(.white.opacity(0.78))
                VStack(alignment: .leading, spacing: 8) {
                    Text("How to Play")
                        .font(.subheadline.weight(.bold))
                    ForEach(primaryMode.howToPlay, id: \.self) { item in
                        Text("• \(item)")
                            .foregroundStyle(.white.opacity(0.72))
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("Tips")
                        .font(.subheadline.weight(.bold))
                    ForEach(primaryMode.tips, id: \.self) { item in
                        Text("• \(item)")
                            .foregroundStyle(.white.opacity(0.72))
                    }
                }
                if additionalModes.isEmpty == false {
                    Text("Also enabled: \(additionalModes.map(\.title).joined(separator: ", "))")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.78))
                }
                NativePrimaryButton(title: "Got It", action: onDismiss)
            }
        }
    }

    private var primaryMode: NativeGameModeDescriptor {
        let modes = gameModeInfo.modes
        if modes.contains("king-of-the-board") { return .kingOfTheBoard }
        if modes.contains("speed-sequence") { return .speedSequence }
        if modes.contains("blitz") { return .blitz }
        if modes.contains("series") { return .series }
        return .custom
    }

    private var additionalModes: [NativeGameModeDescriptor] {
        gameModeInfo.modes.compactMap { NativeGameModeDescriptor(rawValue: $0) }
            .filter { $0 != primaryMode && $0 != .custom }
    }
}

private enum NativeGameModeDescriptor: String {
    case kingOfTheBoard = "king-of-the-board"
    case blitz
    case speedSequence = "speed-sequence"
    case series
    case custom

    var icon: String {
        switch self {
        case .kingOfTheBoard: return "👑"
        case .blitz: return "⚡"
        case .speedSequence: return "🏎️"
        case .series: return "🏆"
        case .custom: return "⚙️"
        }
    }

    var title: String {
        switch self {
        case .kingOfTheBoard: return "King of the Board"
        case .blitz: return "Blitz Mode"
        case .speedSequence: return "Speed Sequence"
        case .series: return "Series Mode"
        case .custom: return "Custom Game Mode"
        }
    }

    var description: String {
        switch self {
        case .kingOfTheBoard:
            return "Everyone fights over a shared 3x3 king zone. Sequences through that zone score 2 points, and the zone moves after each score."
        case .blitz:
            return "A faster-paced variant where you only need 4 chips in a row instead of 5."
        case .speedSequence:
            return "Blitz mode with a 15-second turn timer for the fastest matches."
        case .series:
            return "Play multiple games to decide the overall champion."
        case .custom:
            return "This room uses custom settings that differ from standard rules."
        }
    }

    var howToPlay: [String] {
        switch self {
        case .kingOfTheBoard:
            return [
                "Standard 5-chip Sequence rules still apply.",
                "Any sequence touching the king zone scores 2 points.",
                "The first team to reach 3 points wins."
            ]
        case .blitz:
            return [
                "Form a sequence of 4 chips in a row.",
                "Wild corners still count toward sequences.",
                "All other rules stay the same."
            ]
        case .speedSequence:
            return [
                "You only get 15 seconds per turn.",
                "Form sequences of 4 chips in a row.",
                "If time runs out, your turn is skipped."
            ]
        case .series:
            return [
                "Win multiple games to win the series.",
                "Best of 3 means first to 2 wins.",
                "Teams stay the same throughout the series."
            ]
        case .custom:
            return [
                "Check the lobby settings carefully before play starts.",
                "Timer, sequence length, and win conditions may differ."
            ]
        }
    }

    var tips: [String] {
        switch self {
        case .kingOfTheBoard:
            return [
                "Save flexible cards and jacks for the hotspot.",
                "A safe 1-point line outside the zone can still win races."
            ]
        case .blitz:
            return [
                "Blocking matters even more in shorter games.",
                "Corner spaces become more valuable."
            ]
        case .speedSequence:
            return [
                "Plan while other players are moving.",
                "Trust fast reads over perfect calculation."
            ]
        case .series:
            return [
                "Adapt between games.",
                "Keep the long set in mind, not just one board."
            ]
        case .custom:
            return [
                "Make sure everyone understands the room settings.",
                "Ask the host if any rules are unclear."
            ]
        }
    }
}

private struct CompactGameHeader: View {
    let state: ClientGameState?
    let playerID: String?
    let turnTimeLimit: Int
    let turnStartedAt: Double?
    var gameVariant: GameVariant = .classic
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.body.weight(.semibold))
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                }

                if gameVariant == .kingOfTheBoard {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(
                            LinearGradient(colors: [Color(hex: "#facc15"), Color(hex: "#f59e0b")],
                                           startPoint: .top, endPoint: .bottom)
                        )
                }

                Spacer()

                TurnIndicatorView(state: state, playerID: playerID)

                Spacer()

                if turnTimeLimit > 0, state?.winnerTeamIndex == nil {
                    TurnTimerPill(turnTimeLimit: turnTimeLimit, turnStartedAt: turnStartedAt, isCompact: true)
                } else {
                    Color.clear.frame(width: 36, height: 36)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 50)

            if gameVariant == .kingOfTheBoard {
                LinearGradient(colors: [Color(hex: "#facc15").opacity(0.3), Color(hex: "#f59e0b").opacity(0.1)],
                               startPoint: .leading, endPoint: .trailing)
                    .frame(height: 1)
            }
        }
    }
}

private struct TurnIndicatorView: View {
    let state: ClientGameState?
    let playerID: String?
    @State private var wasMyTurn = false

    var body: some View {
        HStack(spacing: 8) {
            if isMyTurn {
                Circle()
                    .fill(teamColor)
                    .frame(width: 8, height: 8)
                    .shadow(color: teamColor.opacity(0.8), radius: 4)
                    .modifier(PulsingGlow())

                Text("YOUR TURN")
                    .font(.subheadline.weight(.black))
                    .foregroundStyle(teamColor)
            } else if let currentPlayer {
                if !currentPlayer.connected {
                    Circle()
                        .fill(Color.white.opacity(0.3))
                        .frame(width: 8, height: 8)
                    Text("Skipping \(currentPlayer.name)...")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.5))
                } else {
                    Circle()
                        .fill(opponentTeamColor)
                        .frame(width: 8, height: 8)
                    Text("Waiting for \(currentPlayer.name)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.7))
                }
            } else if state?.winnerTeamIndex != nil {
                Text("Game Over")
                    .font(.subheadline.weight(.black))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(isMyTurn ? teamColor.opacity(0.15) : Color.white.opacity(0.04), in: Capsule())
        .onChange(of: isMyTurn) { _, newValue in
            if newValue && !wasMyTurn {
                NativeHaptics.notify(.warning)
            }
            wasMyTurn = newValue
        }
        .onAppear { wasMyTurn = isMyTurn }
    }

    private var isMyTurn: Bool {
        guard let state, let playerID else { return false }
        return state.players[safe: state.currentPlayerIndex]?.id == playerID
    }

    private var currentPlayer: PublicPlayer? {
        state?.players[safe: state?.currentPlayerIndex ?? -1]
    }

    private var teamColor: Color {
        guard let state, let playerID else { return Color(hex: "#6366f1") }
        let myTeamIndex = state.players.first(where: { $0.id == playerID })?.teamIndex ?? 0
        let color = state.config.teamColors[safe: myTeamIndex] ?? .blue
        return Color(hex: color.classicHex)
    }

    private var opponentTeamColor: Color {
        guard let state, let currentPlayer else { return Color.white.opacity(0.5) }
        let color = state.config.teamColors[safe: currentPlayer.teamIndex] ?? .blue
        return Color(hex: color.classicHex)
    }
}

private struct PulsingGlow: ViewModifier {
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.5 : 1.0)
            .opacity(isPulsing ? 0.6 : 1.0)
            .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isPulsing)
            .onAppear { isPulsing = true }
    }
}

private struct CompactScoreStrip: View {
    let teamColors: [TeamColor]
    let scores: [Int]
    let scoreToWin: Int
    var gameVariant: GameVariant = .classic
    @State private var glowingTeam: Int?

    var body: some View {
        Group {
            if gameVariant == .kingOfTheBoard {
                kingOfTheBoardStrip
            } else {
                classicStrip
            }
        }
        .onChange(of: scores) { oldValue, newValue in
            for index in newValue.indices {
                let old = oldValue[safe: index] ?? 0
                if newValue[index] > old {
                    glowingTeam = index
                    Task {
                        try? await Task.sleep(nanoseconds: 1_500_000_000)
                        glowingTeam = nil
                    }
                    break
                }
            }
        }
    }

    private var classicStrip: some View {
        HStack(spacing: 14) {
            ForEach(Array(teamColors.enumerated()), id: \.offset) { index, color in
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color(hex: color.classicHex))
                        .frame(width: 22, height: 22)
                        .overlay {
                            Text(color.letter)
                                .font(.system(size: 10, weight: .black))
                        }
                        .shadow(color: glowingTeam == index ? Color(hex: color.classicHex).opacity(0.9) : .clear, radius: 8)

                    HStack(spacing: 3) {
                        ForEach(0..<scoreToWin, id: \.self) { pip in
                            Circle()
                                .fill(pip < (scores[safe: index] ?? 0)
                                      ? Color(hex: color.classicHex)
                                      : Color.white.opacity(0.15))
                                .frame(width: 8, height: 8)
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.05), in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 36)
    }

    private var kingOfTheBoardStrip: some View {
        HStack(spacing: 12) {
            ForEach(Array(teamColors.enumerated()), id: \.offset) { index, color in
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color(hex: color.classicHex))
                        .frame(width: 28, height: 28)
                        .overlay {
                            Text(color.letter)
                                .font(.system(size: 12, weight: .black))
                        }
                        .shadow(color: glowingTeam == index ? Color(hex: color.classicHex).opacity(0.9) : .clear, radius: 10)

                    Text("\(scores[safe: index] ?? 0)/\(scoreToWin)")
                        .font(.system(size: 20, weight: .black, design: .rounded).monospacedDigit())

                    Image(systemName: "crown.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(
                            LinearGradient(colors: [Color(hex: "#facc15"), Color(hex: "#f59e0b")],
                                           startPoint: .top, endPoint: .bottom)
                        )
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.05), in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 52)
    }
}

private struct KingZoneScoringLegend: View {
    let onInfoTap: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "crown.fill")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color(hex: "#facc15"))
            Text("Zone = 2 pts")
                .font(.caption2.weight(.semibold))
            Text("\u{00B7}")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(0.4))
            Text("Normal = 1 pt")
                .font(.caption2.weight(.semibold))
            Text("\u{00B7}")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(0.4))
            Text("First to 3 wins")
                .font(.caption2.weight(.semibold))
            Button(action: onInfoTap) {
                Image(systemName: "info.circle")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
        .foregroundStyle(.white.opacity(0.65))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }
}

private struct KingZoneScoringInfoModal: View {
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.72)
                .ignoresSafeArea()
                .onTapGesture(perform: onDismiss)
            NativeCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(
                                LinearGradient(colors: [Color(hex: "#facc15"), Color(hex: "#f59e0b")],
                                               startPoint: .top, endPoint: .bottom)
                            )
                        Text("King of the Board")
                            .font(.headline.weight(.black))
                        Spacer()
                    }
                    Text("Teams fight over a shared 3x3 king zone on the board.")
                        .foregroundStyle(.white.opacity(0.78))
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Scoring")
                            .font(.subheadline.weight(.bold))
                        Text("Any sequence through the king zone scores 2 points.")
                            .foregroundStyle(.white.opacity(0.72))
                        Text("Sequences outside the zone score 1 point.")
                            .foregroundStyle(.white.opacity(0.72))
                        Text("First team to 3 points wins the game.")
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Tips")
                            .font(.subheadline.weight(.bold))
                        Text("Save flexible cards and jacks for the hotspot.")
                            .foregroundStyle(.white.opacity(0.72))
                        Text("A safe 1-point line outside the zone can still win races.")
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    NativePrimaryButton(title: "Got It", action: onDismiss)
                }
            }
            .padding(.horizontal, 20)
        }
    }
}

private struct GameEventToast: View {
    let text: String
    let teamColor: Color
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 8) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(teamColor)
            } else {
                Circle()
                    .fill(teamColor)
                    .frame(width: 6, height: 6)
            }
            Text(text)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(teamColor.opacity(0.3), lineWidth: 1))
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

struct NativeGameView: View {
    @ObservedObject var model: AppModel
    @State private var selectedCard: String?
    @State private var selectedCell: (Int, Int)?
    @State private var showCutCards = false
    @State private var sequenceCelebration: SequenceCelebrationState?
    @State private var previousScores: [Int] = []
    @State private var lastEventCount = 0
    @State private var activeToast: (text: String, color: Color, icon: String?)?
    @State private var chipAnimationTrigger: String = ""
    @State private var scorePopText: String?
    @State private var scorePopUsedKingZone: Bool = false
    @State private var showGameModeInfo = false

    private var state: ClientGameState? { model.gameState }
    private let boardSpacing: CGFloat = 2

    var body: some View {
        ZStack(alignment: .top) {
            turnBackgroundGlow
            gameContent
            toastOverlay
            modalOverlays
        }
        .onAppear {
            previousScores = state?.teamScores ?? []
            lastEventCount = state?.eventLog.count ?? 0
            showCutCards = !(state?.cutCards?.isEmpty ?? true)
        }
        .onChange(of: state?.cutCards?.map(\.card).joined(separator: "|") ?? "") { _, signature in
            showCutCards = !signature.isEmpty
        }
        .onChange(of: state?.teamScores ?? []) { _, currentScores in
            handleScoreChange(currentScores)
        }
        .onChange(of: state?.eventLog.count ?? 0) { _, newCount in
            handleNewEvents(newCount)
        }
        .task(id: sequenceCelebration?.id) {
            guard sequenceCelebration != nil else { return }
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            if !Task.isCancelled { sequenceCelebration = nil }
        }
    }

    @ViewBuilder
    private var turnBackgroundGlow: some View {
        ZStack {
            if let state, state.config.gameVariant == .kingOfTheBoard {
                RadialGradient(
                    colors: [Color(hex: "#facc15").opacity(0.04), .clear],
                    center: .center, startRadius: 40, endRadius: 280
                )
                .ignoresSafeArea()
            }
            if let state, let playerID = model.playerID, isMyTurn(state: state, playerID: playerID) {
                let myTeamIndex = state.players.first(where: { $0.id == playerID })?.teamIndex ?? 0
                let tc = state.config.teamColors[safe: myTeamIndex] ?? .blue
                RadialGradient(
                    colors: [Color(hex: tc.classicHex).opacity(0.08), .clear],
                    center: .center, startRadius: 50, endRadius: 300
                )
                .ignoresSafeArea()
            }
        }
    }

    @ViewBuilder
    private var gameContent: some View {
        VStack(spacing: 0) {
            CompactGameHeader(
                state: state,
                playerID: model.playerID,
                turnTimeLimit: state?.turnTimeLimit ?? 0,
                turnStartedAt: state?.turnStartedAt,
                gameVariant: state?.config.gameVariant ?? .classic,
                onBack: { model.leaveRoom() }
            )

            if let state, let playerID = model.playerID {
                gamePlayArea(state: state, playerID: playerID)
            } else {
                Spacer()
                Text("Waiting for game state...").foregroundStyle(.white.opacity(0.7))
                Spacer()
            }
        }
    }

    @ViewBuilder
    private func gamePlayArea(state: ClientGameState, playerID: String) -> some View {
        let seqCells = sequenceCellLookup(state: state)
        let highlighted = highlightedCells(state: state, playerID: playerID)

        CompactScoreStrip(
            teamColors: state.config.teamColors,
            scores: state.teamScores,
            scoreToWin: state.config.scoreToWin,
            gameVariant: state.config.gameVariant
        )
        .padding(.horizontal, 16)
        .overlay(alignment: .top) {
            if let scorePopText {
                HStack(spacing: 4) {
                    Text(scorePopText)
                        .font(.system(size: 18, weight: .black, design: .rounded))
                    if scorePopUsedKingZone {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color(hex: "#facc15"))
                    }
                }
                .foregroundStyle(scorePopUsedKingZone ? Color(hex: "#facc15") : .white)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .offset(y: -28)
            }
        }

        if state.config.gameVariant == .kingOfTheBoard {
            KingZoneScoringLegend {
                showGameModeInfo = true
            }
            .padding(.horizontal, 16)
        }

        GameBoardGrid(
            state: state,
            highlightedCells: highlighted,
            selectedCell: selectedCell,
            sequenceCells: seqCells,
            kingZone: state.kingZone,
            chipAnimationTrigger: chipAnimationTrigger,
            onCellTap: { row, col in
                selectedCell = (row, col)
                NativeHaptics.selection()
            }
        )
        .padding(.horizontal, 8)
        .padding(.vertical, 4)

        actionPanel(state: state, playerID: playerID)
            .padding(.vertical, 4)

        adaptiveHand(state: state, playerID: playerID)
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
    }

    @ViewBuilder
    private var toastOverlay: some View {
        if let toast = activeToast {
            GameEventToast(text: toast.text, teamColor: toast.color, icon: toast.icon)
                .padding(.top, 54)
        }
    }

    @ViewBuilder
    private var modalOverlays: some View {
        if showGameModeInfo {
            KingZoneScoringInfoModal {
                showGameModeInfo = false
            }
        }

        if showCutCards, let state, let cutCards = state.cutCards {
            NativeCutCardsModal(cutCards: cutCards, dealerIndex: state.dealerIndex, players: state.players) {
                showCutCards = false
            }
        }

        if let sequenceCelebration, state?.winnerTeamIndex == nil {
            NativeSequenceCelebrationModal(celebration: sequenceCelebration) {
                self.sequenceCelebration = nil
            }
        }

        if let state, let roomInfo = model.roomInfo, let playerID = model.playerID, let winnerTeamIndex = state.winnerTeamIndex {
            NativeWinnerModal(
                state: state,
                roomInfo: roomInfo,
                playerID: playerID,
                winnerTeamIndex: winnerTeamIndex,
                onLeave: { model.leaveRoom() },
                onContinueSeries: { await model.continueSeries() },
                onEndSeries: { await model.endSeries() }
            )
        }
    }

    @ViewBuilder
    private func actionPanel(state: ClientGameState, playerID: String) -> some View {
        let teamTint = myTeamColor(state: state, playerID: playerID)

        if state.pendingDraw, isMyTurn(state: state, playerID: playerID) {
            NativePrimaryButton(title: "Draw Card", tintColor: teamTint) {
                Task {
                    if let result = await model.sendGameAction(GameAction(type: "draw", card: nil, targetRow: nil, targetCol: nil)), result.success {
                        selectedCard = nil
                        selectedCell = nil
                        NativeHaptics.impact(.light)
                    }
                }
            }
            .padding(.horizontal, 16)
        } else if selectedCell != nil {
            HStack(spacing: 12) {
                NativeSecondaryButton(title: "Cancel") {
                    selectedCell = nil
                }
                NativePrimaryButton(title: confirmTitle(for: selectedCard), tintColor: teamTint) {
                    guard let selectedCard, let selectedCell else { return }
                    let type: String
                    switch CardRules.jackType(for: selectedCard) {
                    case "two-eyed": type = "play-two-eyed"
                    case "one-eyed": type = "play-one-eyed"
                    default: type = "play-normal"
                    }
                    Task {
                        if let result = await model.sendGameAction(GameAction(type: type, card: selectedCard, targetRow: selectedCell.0, targetCol: selectedCell.1)), result.success {
                            self.selectedCard = nil
                            self.selectedCell = nil
                            NativeHaptics.impact(type == "play-one-eyed" ? .rigid : .medium)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        } else {
            Text(stepHint(state: state, playerID: playerID))
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.72))
                .padding(.horizontal, 20)
                .multilineTextAlignment(.center)
                .animation(.easeInOut(duration: 0.3), value: stepHint(state: state, playerID: playerID))
        }
    }

    @ViewBuilder
    private func adaptiveHand(state: ClientGameState, playerID: String) -> some View {
        let teamTint = myTeamColor(state: state, playerID: playerID)
        let canReplace = canReplaceDeadCard(state: state, playerID: playerID)
        let boardChips = state.boardChips

        GeometryReader { geometry in
            let layout = handLayout(cardCount: state.myHand.count, availableWidth: geometry.size.width)

            HStack(spacing: layout.spacing) {
                ForEach(Array(state.myHand.enumerated()), id: \.offset) { _, card in
                    let isDead = CardRules.isDeadCard(card, boardChips: boardChips)
                    AdaptiveHandCard(
                        card: card,
                        isSelected: selectedCard == card,
                        isDead: isDead,
                        canReplace: canReplace,
                        cardWidth: layout.cardWidth,
                        cardHeight: layout.cardHeight,
                        teamColor: teamTint,
                        onSelect: {
                            selectedCard = selectedCard == card ? nil : card
                            selectedCell = nil
                            NativeHaptics.selection()
                        },
                        onReplace: {
                            Task {
                                let action = GameAction(type: "replace-dead", card: card, targetRow: nil, targetCol: nil)
                                if let result = await model.sendGameAction(action), result.success {
                                    selectedCard = nil
                                    selectedCell = nil
                                    NativeHaptics.notify(.success)
                                }
                            }
                        }
                    )
                }
            }
            .frame(maxWidth: .infinity)
        }
        .frame(height: estimatedHandHeight(cardCount: state.myHand.count))
    }

    private func handLayout(cardCount: Int, availableWidth: CGFloat) -> (cardWidth: CGFloat, cardHeight: CGFloat, spacing: CGFloat) {
        let count = max(1, cardCount)
        let minSpacing: CGFloat = 3
        let maxCardWidth: CGFloat = 72
        let totalMinSpacing = minSpacing * CGFloat(count - 1)
        let rawCardWidth = floor((availableWidth - totalMinSpacing) / CGFloat(count))
        let cardWidth = min(maxCardWidth, rawCardWidth)
        let cardHeight = cardWidth * 1.33
        let remainingSpace = availableWidth - cardWidth * CGFloat(count)
        let spacing = count > 1 ? min(CGFloat(10), max(minSpacing, remainingSpace / CGFloat(count - 1))) : CGFloat(0)
        return (cardWidth, cardHeight, spacing)
    }

    private func estimatedHandHeight(cardCount: Int) -> CGFloat {
        let count = max(1, cardCount)
        let maxCardWidth: CGFloat = 72
        let totalMinSpacing: CGFloat = 3 * CGFloat(count - 1)
        let screenWidth: CGFloat = 370 // conservative estimate
        let rawCardWidth = floor((screenWidth - totalMinSpacing) / CGFloat(count))
        let cardWidth = min(maxCardWidth, rawCardWidth)
        return cardWidth * 1.33 + 8
    }

    private func myTeamColor(state: ClientGameState, playerID: String) -> Color {
        let myTeamIndex = state.players.first(where: { $0.id == playerID })?.teamIndex ?? 0
        let color = state.config.teamColors[safe: myTeamIndex] ?? .blue
        return Color(hex: color.classicHex)
    }

    private func isMyTurn(state: ClientGameState, playerID: String) -> Bool {
        state.players[safe: state.currentPlayerIndex]?.id == playerID
    }

    private func canReplaceDeadCard(state: ClientGameState, playerID: String) -> Bool {
        isMyTurn(state: state, playerID: playerID) && !state.pendingDraw && !state.deadCardReplacedThisTurn
    }

    private func confirmTitle(for card: String?) -> String {
        CardRules.jackType(for: card ?? "") == "one-eyed" ? "Remove Chip" : "Place Chip"
    }

    private func stepHint(state: ClientGameState, playerID: String) -> String {
        if state.winnerTeamIndex != nil {
            return "Game complete."
        }
        if !isMyTurn(state: state, playerID: playerID) {
            if let current = state.players[safe: state.currentPlayerIndex], !current.connected {
                return "Skipping \(current.name) while they reconnect."
            }
            return "Opponent is thinking..."
        }
        if state.pendingDraw {
            return "Draw to finish your turn."
        }
        if selectedCard == nil {
            if state.config.gameVariant == .kingOfTheBoard {
                return "Select a card. Aim for the crown zone for 2x points!"
            }
            return "Select a card from your hand."
        }
        return "Select a highlighted space on the board."
    }

    private func handleScoreChange(_ currentScores: [Int]) {
        guard let state, let playerID = model.playerID else {
            previousScores = currentScores
            return
        }

        let lastScoringPlayer = state.lastMove?.playerId.flatMap { id in
            state.players.first(where: { $0.id == id })
        }
        let lastScoringTeamIndex = lastScoringPlayer?.teamIndex

        for index in currentScores.indices {
            let previous = previousScores[safe: index] ?? 0
            if currentScores[index] > previous {
                let scoring = lastScoringTeamIndex == index ? state.lastMove?.scoring : nil
                let pointsAwarded = scoring?.pointsAwarded ?? (currentScores[index] - previous)
                let totalScore = scoring?.totalScore ?? currentScores[index]
                let usedKingZone = scoring?.usedKingZone ?? (pointsAwarded > 1)
                let isLocalScorer = lastScoringPlayer?.id == playerID

                // Score pop animation for KotB — always show, even for local scorer
                if state.config.gameVariant == .kingOfTheBoard {
                    scorePopUsedKingZone = usedKingZone
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                        scorePopText = "+\(pointsAwarded)"
                    }
                    Task {
                        try? await Task.sleep(nanoseconds: 1_200_000_000)
                        withAnimation(.easeOut(duration: 0.3)) {
                            scorePopText = nil
                        }
                    }
                }

                // Haptics — always fire for scoring events
                if index == state.players.first(where: { $0.id == playerID })?.teamIndex {
                    NativeHaptics.notify(.success)
                    if usedKingZone {
                        Task {
                            try? await Task.sleep(nanoseconds: 300_000_000)
                            NativeHaptics.impact(.heavy)
                        }
                    }
                } else {
                    NativeHaptics.impact(.heavy)
                }

                // Celebration modal — skip for local scorer (they see their own move result)
                if !isLocalScorer {
                    let players = state.players
                        .filter { $0.teamIndex == index }
                        .map(\.name)
                    sequenceCelebration = SequenceCelebrationState(
                        teamIndex: index,
                        teamColor: state.config.teamColors[safe: index] ?? .blue,
                        playerNames: players,
                        pointsAwarded: pointsAwarded,
                        totalScore: totalScore,
                        usedKingZone: usedKingZone,
                        scoreToWin: state.config.scoreToWin,
                        gameVariant: state.config.gameVariant
                    )
                }

                break
            }
        }
        previousScores = currentScores
    }

    private func highlightedCells(state: ClientGameState, playerID: String) -> Set<String> {
        CardRules.highlightedCells(for: selectedCard, state: state, playerId: playerID)
    }

    private func sequenceCellLookup(state: ClientGameState) -> [String: Int] {
        var result: [String: Int] = [:]
        for seq in state.completedSequences {
            for cell in seq.cells where cell.count == 2 {
                result["\(cell[0]),\(cell[1])"] = seq.teamIndex
            }
        }
        return result
    }

    private func handleNewEvents(_ newCount: Int) {
        guard let state, let playerID = model.playerID else {
            lastEventCount = newCount
            return
        }
        guard newCount > lastEventCount else {
            lastEventCount = newCount
            return
        }

        let newEvents = Array(state.eventLog.suffix(newCount - lastEventCount))
        lastEventCount = newCount

        for event in newEvents {
            guard event.playerId != playerID else { continue }
            let text: String
            switch event.type {
            case "chip-placed":
                let cardName = CardRules.fullName(event.card ?? "")
                text = "\(event.playerName ?? "Player") played \(cardName)"
            case "chip-removed":
                text = "\(event.playerName ?? "Player") removed a chip!"
            case "card-replaced", "dead-card-replaced":
                text = "\(event.playerName ?? "Player") replaced a dead card"
            case "sequence-completed":
                let points = event.pointsAwarded ?? 1
                let pointLabel = points == 1 ? "point" : "points"
                if event.usedKingZone == true {
                    text = "\(event.playerName ?? "Player") scored \(points) \(pointLabel) in the king zone"
                } else {
                    text = "\(event.playerName ?? "Player") scored \(points) \(pointLabel)"
                }
            case "turn-timeout":
                text = "\(event.playerName ?? "Player")'s turn was skipped"
            case "player-disconnected":
                text = "\(event.playerName ?? "Player") disconnected"
            case "player-reconnected":
                text = "\(event.playerName ?? "Player") reconnected"
            default:
                continue
            }

            let teamIndex = event.teamIndex ?? 0
            let color = state.config.teamColors[safe: teamIndex] ?? .blue
            let isKingZoneEvent = event.type == "sequence-completed" && event.usedKingZone == true
            let toastColor = isKingZoneEvent ? Color(hex: "#facc15") : Color(hex: color.classicHex)
            let toastIcon: String? = isKingZoneEvent ? "crown.fill" : nil

            withAnimation(.easeInOut(duration: 0.3)) {
                activeToast = (text: text, color: toastColor, icon: toastIcon)
            }
            Task {
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                withAnimation(.easeOut(duration: 0.3)) {
                    activeToast = nil
                }
            }
            break
        }
    }

}

private struct AdaptiveHandCard: View {
    let card: String
    let isSelected: Bool
    let isDead: Bool
    let canReplace: Bool
    let cardWidth: CGFloat
    let cardHeight: CGFloat
    let teamColor: Color
    let onSelect: () -> Void
    let onReplace: () -> Void

    private var display: CardDisplay {
        CardRules.display(card)
    }

    var body: some View {
        ZStack {
            VStack(spacing: max(2, cardWidth * 0.04)) {
                Text(display.rank)
                    .font(.system(size: max(10, cardWidth * 0.26), weight: .bold, design: .rounded).monospacedDigit())
                Text(display.suit)
                    .font(.system(size: max(10, cardWidth * 0.26), weight: .bold))
                    .foregroundStyle(Color(hex: display.suitColorHex))
            }
            .frame(width: cardWidth, height: cardHeight)
            .background(
                Color.white.opacity(isDead ? 0.03 : (isSelected ? 0.14 : 0.06)),
                in: RoundedRectangle(cornerRadius: min(16, cardWidth * 0.22), style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: min(16, cardWidth * 0.22), style: .continuous)
                    .stroke(
                        isDead ? Color.orange.opacity(0.9) : (isSelected ? teamColor : Color.white.opacity(0.08)),
                        lineWidth: isSelected ? 2 : (isDead ? 1.5 : 1)
                    )
            )
            .shadow(color: isSelected ? teamColor.opacity(0.4) : .clear, radius: 8)
            .overlay(alignment: .topTrailing) {
                if isDead {
                    Text("DEAD")
                        .font(.system(size: max(7, cardWidth * 0.12), weight: .bold))
                        .padding(.horizontal, max(3, cardWidth * 0.06))
                        .padding(.vertical, max(2, cardWidth * 0.03))
                        .background(Color.orange.opacity(0.9), in: Capsule())
                        .padding(max(3, cardWidth * 0.06))
                }
            }
            .overlay(alignment: .bottom) {
                if isDead && canReplace {
                    Button(action: onReplace) {
                        Text("Replace")
                            .font(.system(size: max(8, cardWidth * 0.14), weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color.orange.opacity(0.85), in: Capsule())
                    }
                    .offset(y: max(6, cardHeight * 0.08))
                }
            }
            .opacity(isDead ? 0.7 : 1.0)
        }
        .scaleEffect(isSelected ? 1.06 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
        .onTapGesture(perform: onSelect)
    }
}

private struct TurnTimerPill: View {
    let turnTimeLimit: Int
    let turnStartedAt: Double?
    let isCompact: Bool
    @State private var now = Date()
    @State private var previousRemaining: Int = -1

    init(turnTimeLimit: Int, turnStartedAt: Double?, isCompact: Bool = false) {
        self.turnTimeLimit = turnTimeLimit
        self.turnStartedAt = turnStartedAt
        self.isCompact = isCompact
    }

    var body: some View {
        HStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.15), lineWidth: 2.5)
                Circle()
                    .trim(from: 0, to: progressFraction)
                    .stroke(urgencyColor, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: isCompact ? 18 : 22, height: isCompact ? 18 : 22)

            Text("\(remainingSeconds)s")
                .font(isCompact ? .caption.monospacedDigit().weight(.bold) : .subheadline.monospacedDigit().weight(.bold))
                .foregroundStyle(urgencyColor)
        }
        .padding(.horizontal, isCompact ? 10 : 14)
        .padding(.vertical, isCompact ? 6 : 8)
        .background(urgencyBackground, in: Capsule())
        .scaleEffect(remainingSeconds <= 5 && remainingSeconds > 0 ? pulseScale : 1.0)
        .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: remainingSeconds <= 5)
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { value in
            now = value
            let current = remainingSeconds
            if current != previousRemaining {
                if current <= 5 && current > 0 {
                    NativeHaptics.impact(.light)
                } else if current == 0 && previousRemaining > 0 {
                    NativeHaptics.notify(.error)
                }
                previousRemaining = current
            }
        }
        .onAppear { previousRemaining = remainingSeconds }
    }

    private var remainingSeconds: Int {
        guard let turnStartedAt else { return turnTimeLimit }
        let elapsed = max(0, Int(now.timeIntervalSince1970 - turnStartedAt / 1000.0))
        return max(0, turnTimeLimit - elapsed)
    }

    private var progressFraction: CGFloat {
        guard turnTimeLimit > 0 else { return 1 }
        return CGFloat(remainingSeconds) / CGFloat(turnTimeLimit)
    }

    private var urgencyColor: Color {
        if remainingSeconds <= 0 { return .red }
        if remainingSeconds <= 5 { return .red }
        if remainingSeconds <= 10 { return Color(hex: "#f59e0b") }
        return .white
    }

    private var urgencyBackground: some ShapeStyle {
        if remainingSeconds <= 5 { return Color.red.opacity(0.2) }
        if remainingSeconds <= 10 { return Color(hex: "#f59e0b").opacity(0.12) }
        return Color.white.opacity(0.08)
    }

    private var pulseScale: CGFloat {
        remainingSeconds <= 3 ? 1.06 : 1.03
    }
}

private struct GameBoardGrid: View {
    let state: ClientGameState
    let highlightedCells: Set<String>
    let selectedCell: (Int, Int)?
    let sequenceCells: [String: Int]
    let kingZone: KingZone?
    let chipAnimationTrigger: String
    let onCellTap: (Int, Int) -> Void

    private let boardSpacing: CGFloat = 2

    var body: some View {
        GeometryReader { geometry in
            let side = min(geometry.size.width, geometry.size.height)
            let boardSide = max(220, side)
            let cellSize = floor((boardSide - boardSpacing * 9) / 10)
            let normalizedSide = cellSize * 10 + boardSpacing * 9

            LazyVGrid(
                columns: Array(repeating: GridItem(.fixed(cellSize), spacing: boardSpacing), count: 10),
                spacing: boardSpacing
            ) {
                ForEach(0..<100, id: \.self) { index in
                    let row = index / 10
                    let col = index % 10
                    let cellKey = "\(row),\(col)"
                    let isHighlighted = highlightedCells.contains(cellKey)

                    BoardCellView(
                        card: CardRules.boardLayout[row][col],
                        chip: state.boardChips[row][col],
                        teamColors: state.config.teamColors,
                        highlighted: isHighlighted,
                        selected: selectedCell?.0 == row && selectedCell?.1 == col,
                        isSequenceCell: sequenceCells[cellKey] != nil,
                        sequenceTeamIndex: sequenceCells[cellKey],
                        isKingZoneCell: kingZone?.cells.contains(where: { $0 == [row, col] }) == true,
                        isKingZoneCenter: kingZone?.center == [row, col],
                        size: cellSize,
                        animationTrigger: chipAnimationTrigger
                    )
                    .onTapGesture {
                        if isHighlighted {
                            onCellTap(row, col)
                        }
                    }
                }
            }
            .frame(width: normalizedSide, height: normalizedSide)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private struct BoardCellView: View {
    let card: String
    let chip: Int?
    let teamColors: [TeamColor]
    let highlighted: Bool
    let selected: Bool
    let isSequenceCell: Bool
    let sequenceTeamIndex: Int?
    let isKingZoneCell: Bool
    let isKingZoneCenter: Bool
    let size: CGFloat
    let animationTrigger: String

    init(card: String, chip: Int?, teamColors: [TeamColor], highlighted: Bool, selected: Bool,
         isSequenceCell: Bool = false, sequenceTeamIndex: Int? = nil, isKingZoneCell: Bool = false,
         isKingZoneCenter: Bool = false, size: CGFloat, animationTrigger: String = "") {
        self.card = card
        self.chip = chip
        self.teamColors = teamColors
        self.highlighted = highlighted
        self.selected = selected
        self.isSequenceCell = isSequenceCell
        self.sequenceTeamIndex = sequenceTeamIndex
        self.isKingZoneCell = isKingZoneCell
        self.isKingZoneCenter = isKingZoneCenter
        self.size = size
        self.animationTrigger = animationTrigger
    }

    private var display: CardDisplay {
        CardRules.display(card)
    }

    var body: some View {
        ZStack {
            // Cell background
            if card == "W" {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: "#fbbf24").opacity(0.2), Color(hex: "#f59e0b").opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Text("★")
                    .font(.system(size: max(10, size * 0.36), weight: .bold))
                    .foregroundStyle(
                        LinearGradient(colors: [Color(hex: "#fbbf24"), Color(hex: "#f59e0b")],
                                       startPoint: .top, endPoint: .bottom)
                    )
            } else {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(cellBackground)

                VStack(spacing: 1) {
                    Text(display.rank)
                        .font(.system(size: max(7, size * 0.22), weight: .bold, design: .rounded))
                    Text(display.suit)
                        .font(.system(size: max(7, size * 0.22), weight: .bold))
                        .foregroundStyle(Color(hex: display.suitColorHex))
                }
            }

            if isKingZoneCell {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [Color(hex: "#facc15").opacity(0.35), Color(hex: "#f59e0b").opacity(0.18), .clear],
                            center: .center,
                            startRadius: 4,
                            endRadius: size * 0.6
                        )
                    )
                    .modifier(KingZoneShimmer())
                    .overlay {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(Color(hex: "#facc15").opacity(0.5), lineWidth: 1.5)
                    }
                    .modifier(KingZonePulse())
            }

            // Crown icon + 2x badge on king zone center when no chip
            if isKingZoneCenter && chip == nil {
                VStack(spacing: 0) {
                    Image(systemName: "crown.fill")
                        .font(.system(size: max(6, size * 0.24), weight: .bold))
                        .foregroundStyle(
                            LinearGradient(colors: [Color(hex: "#facc15"), Color(hex: "#f59e0b")],
                                           startPoint: .top, endPoint: .bottom)
                        )
                        .opacity(0.85)
                    Text("2x")
                        .font(.system(size: max(5, size * 0.16), weight: .black, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(colors: [Color(hex: "#facc15"), Color(hex: "#f59e0b")],
                                           startPoint: .top, endPoint: .bottom)
                        )
                        .opacity(0.8)
                }
            }

            // Chip
            if let chip, let color = teamColors[safe: chip] {
                Circle()
                    .fill(Color(hex: color.classicHex))
                    .frame(width: chipSize, height: chipSize)
                    .overlay {
                        if isSequenceCell {
                            Circle()
                                .stroke(Color.white.opacity(0.5), lineWidth: 1.5)
                        }
                    }
                    .shadow(
                        color: isSequenceCell
                            ? Color(hex: color.classicHex).opacity(0.7)
                            : Color(hex: color.classicHex).opacity(0.3),
                        radius: isSequenceCell ? 6 : 2
                    )
                    .scaleEffect(isSequenceCell ? 1.08 : 1.0)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .overlay(borderOverlay)
        .frame(width: size, height: size)
        .animation(.spring(response: 0.35, dampingFraction: 0.7), value: chip != nil)
    }

    private var chipSize: CGFloat {
        isSequenceCell ? size * 0.56 : size * 0.50
    }

    private var cellBackground: some ShapeStyle {
        if isSequenceCell, let seqTeam = sequenceTeamIndex, let color = teamColors[safe: seqTeam] {
            return Color(hex: color.classicHex).opacity(0.1)
        }
        if isKingZoneCell {
            return Color(hex: "#f59e0b").opacity(0.12)
        }
        return Color.white.opacity(0.06)
    }

    @ViewBuilder
    private var borderOverlay: some View {
        if selected {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(Color.yellow, lineWidth: 2)
                .shadow(color: Color.yellow.opacity(0.4), radius: 4)
        } else if highlighted {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(Color(hex: "#6366f1").opacity(0.8), lineWidth: 2)
                .modifier(HighlightPulse())
        } else if isKingZoneCell {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(Color(hex: "#facc15").opacity(0.5), lineWidth: 1.5)
        } else if isSequenceCell, let seqTeam = sequenceTeamIndex, let color = teamColors[safe: seqTeam] {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .stroke(Color(hex: color.classicHex).opacity(0.3), lineWidth: 1)
        } else {
            Color.clear
        }
    }
}

private struct HighlightPulse: ViewModifier {
    @State private var pulsing = false

    func body(content: Content) -> some View {
        content
            .opacity(pulsing ? 0.5 : 1.0)
            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: pulsing)
            .onAppear { pulsing = true }
    }
}

private struct KingZoneShimmer: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: max(0, phase - 0.15)),
                        .init(color: Color(hex: "#facc15").opacity(0.25), location: phase),
                        .init(color: .clear, location: min(1, phase + 0.15))
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            .onAppear {
                withAnimation(.linear(duration: 2.5).repeatForever(autoreverses: false)) {
                    phase = 1.0
                }
            }
    }
}

private struct KingZonePulse: ViewModifier {
    @State private var glowing = false

    func body(content: Content) -> some View {
        content
            .shadow(color: Color(hex: "#facc15").opacity(glowing ? 0.5 : 0.15), radius: 4)
            .animation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true), value: glowing)
            .onAppear { glowing = true }
    }
}

struct StatValue: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 6) {
            Text(value).font(.headline.weight(.bold))
            Text(title).font(.caption).foregroundStyle(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.replacingOccurrences(of: "#", with: "")
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let red = Double((value >> 16) & 0xFF) / 255
        let green = Double((value >> 8) & 0xFF) / 255
        let blue = Double(value & 0xFF) / 255
        self.init(red: red, green: green, blue: blue)
    }
}
