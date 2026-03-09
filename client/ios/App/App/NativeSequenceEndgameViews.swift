import SwiftUI

struct SequenceCelebrationState: Identifiable, Equatable {
    let id = UUID()
    let teamIndex: Int
    let teamColor: TeamColor
    let playerNames: [String]
    let pointsAwarded: Int
    let totalScore: Int
    let usedKingZone: Bool
    let scoreToWin: Int
    let gameVariant: GameVariant
}

struct NativeCutCardsModal: View {
    let cutCards: [CutCard]
    let dealerIndex: Int
    let players: [PublicPlayer]
    let onDismiss: () -> Void

    var body: some View {
        modalOverlay {
            VStack(spacing: 18) {
                Text("Cutting for Deal")
                    .font(.title2.weight(.black))
                VStack(spacing: 10) {
                    ForEach(Array(cutCards.enumerated()), id: \.offset) { index, cut in
                        HStack {
                            Text(players.first(where: { $0.id == cut.playerId })?.name ?? "Player")
                                .font(.headline.weight(.semibold))
                            Spacer()
                            let display = CardRules.display(cut.card)
                            HStack(spacing: 4) {
                                Text(display.rank)
                                Text(display.suit)
                                    .foregroundStyle(Color(hex: display.suitColorHex))
                            }
                            .font(.headline.monospacedDigit().weight(.bold))
                            if index == dealerIndex {
                                Text("DEALER")
                                    .font(.caption2.weight(.bold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color(hex: "#6366f1"), in: Capsule())
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
                Text("Lowest card deals. Play starts to their left.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.72))
                    .multilineTextAlignment(.center)
                NativePrimaryButton(title: "Got It", action: onDismiss)
            }
        }
        .onAppear {
            NativeHaptics.impact(.light)
        }
    }
}

struct NativeSequenceCelebrationModal: View {
    let celebration: SequenceCelebrationState
    let onDismiss: () -> Void

    var body: some View {
        modalOverlay {
            VStack(spacing: 18) {
                Circle()
                    .fill(Color(hex: celebration.teamColor.classicHex))
                    .frame(width: 88, height: 88)
                    .overlay {
                        Text("★")
                            .font(.system(size: 36, weight: .black))
                    }

                Text(celebration.usedKingZone && celebration.gameVariant == .kingOfTheBoard ? "KING ZONE!" : "SEQUENCE!")
                    .font(.system(size: 30, weight: .black, design: .rounded))

                Text("Team \(celebration.teamColor.rawValue.uppercased())")
                    .font(.headline.weight(.bold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color(hex: celebration.teamColor.classicHex).opacity(0.22), in: Capsule())

                Text(celebration.playerNames.joined(separator: " & "))
                    .font(.headline.weight(.semibold))
                    .multilineTextAlignment(.center)

                Text(scoreSummary)
                    .foregroundStyle(.white.opacity(0.72))
                    .multilineTextAlignment(.center)

                NativeSecondaryButton(title: "Dismiss", action: onDismiss)
            }
        }
        .onAppear {
            NativeHaptics.notify(.success)
        }
    }

    private var scoreSummary: String {
        let pointLabel = celebration.pointsAwarded == 1 ? "point" : "points"
        let zoneText = celebration.usedKingZone && celebration.gameVariant == .kingOfTheBoard
            ? " in the king zone"
            : ""
        return "scored \(celebration.pointsAwarded) \(pointLabel)\(zoneText). Total: \(celebration.totalScore)/\(celebration.scoreToWin)"
    }
}

struct NativeWinnerModal: View {
    let state: ClientGameState
    let roomInfo: RoomInfo
    let playerID: String
    let winnerTeamIndex: Int
    let onLeave: () -> Void
    let onContinueSeries: () async -> Void
    let onEndSeries: () async -> Void

    @State private var countdown = 5
    @State private var loading = false
    @State private var didTriggerContinue = false
    @State private var showReplay = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.72)
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 18) {
                    Circle()
                        .fill(Color(hex: winnerColor.classicHex))
                        .frame(width: 100, height: 100)
                        .overlay {
                            Text(isSeriesOver || isWinner ? "🏆" : "🎉")
                                .font(.system(size: 42))
                        }

                    Text(titleText)
                        .font(.system(size: 32, weight: .black, design: .rounded))
                        .multilineTextAlignment(.center)

                    Text(teamBadgeText)
                        .font(.headline.weight(.bold))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(Color(hex: winnerColor.classicHex).opacity(0.22), in: Capsule())
                        .overlay(Capsule().stroke(Color(hex: winnerColor.classicHex), lineWidth: 1))

                    if let seriesState = roomInfo.seriesState {
                        NativeCard {
                            VStack(spacing: 14) {
                                if !isSeriesOver {
                                    Text("Game \(displayGamesPlayed) of \(seriesState.seriesLength)")
                                        .font(.subheadline.weight(.semibold))
                                }
                                HStack(spacing: 12) {
                                    ForEach(Array(state.config.teamColors.enumerated()), id: \.offset) { index, color in
                                        VStack(spacing: 8) {
                                            Circle()
                                                .fill(Color(hex: color.classicHex))
                                                .frame(width: 34, height: 34)
                                                .overlay {
                                                    Text(color.letter)
                                                        .font(.caption.weight(.black))
                                                }
                                            Text("\(displayWins[safe: index] ?? 0)")
                                                .font(.title3.monospacedDigit().weight(.black))
                                        }
                                        .frame(maxWidth: .infinity)
                                    }
                                }
                                Text(isSeriesOver ? "Best of \(seriesState.seriesLength)" : "First to \(Int(ceil(Double(seriesState.seriesLength) / 2.0))) wins")
                                    .font(.footnote)
                                    .foregroundStyle(.white.opacity(0.72))
                            }
                        }
                    }

                    SequenceRecapBoardView(
                        completedSequences: state.completedSequences,
                        winnerTeamIndex: winnerTeamIndex,
                        teamColor: winnerColor
                    )

                    Text(winningPlayers.map(\.name).joined(separator: " & "))
                        .font(.headline.weight(.semibold))
                        .multilineTextAlignment(.center)

                    Text(messageText)
                        .foregroundStyle(.white.opacity(0.76))
                        .multilineTextAlignment(.center)

                    winnerActions
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 28)
            }
        }
        .task(id: countdownTaskID) {
            guard roomInfo.seriesState != nil, !isSeriesOver, isHost, !didTriggerContinue else { return }
            if countdown <= 0 {
                didTriggerContinue = true
                loading = true
                await onContinueSeries()
                loading = false
                return
            }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            guard !Task.isCancelled else { return }
            countdown -= 1
        }
        .overlay {
            if showReplay {
                NativeReplayBoardModal(
                    eventLog: state.eventLog,
                    boardChips: state.boardChips,
                    completedSequences: state.completedSequences,
                    winnerTeamIndex: winnerTeamIndex,
                    teamColors: state.config.teamColors
                ) {
                    showReplay = false
                }
            }
        }
        .onAppear {
            NativeHaptics.notify(isWinner ? .success : .warning)
        }
    }

    @ViewBuilder
    private var winnerActions: some View {
        VStack(spacing: 12) {
            if roomInfo.seriesState == nil {
                NativePrimaryButton(title: "Back to Home", action: onLeave)
            } else if !isSeriesOver {
                Text(loading ? "Starting next game..." : "Next game in \(countdown)...")
                    .font(.headline.monospacedDigit().weight(.bold))

                if isHost, !loading {
                    NativeSecondaryButton(title: "End Series Now") {
                        Task {
                            loading = true
                            await onEndSeries()
                            loading = false
                        }
                    }
                } else if !isHost {
                    NativeSecondaryButton(title: "Leave Series", action: onLeave)
                }
            } else {
                NativePrimaryButton(title: "Back to Home", action: onLeave)
            }

            if isBotGame {
                NativeSecondaryButton(title: "Watch Replay") {
                    showReplay = true
                }
            }
        }
    }

    private var countdownTaskID: String {
        "\(countdown)-\(loading)-\(didTriggerContinue)-\(roomInfo.seriesState?.gamesPlayed ?? -1)"
    }

    private var isWinner: Bool {
        winningPlayers.contains(where: { $0.id == playerID })
    }

    private var isBotGame: Bool {
        state.players.contains(where: { $0.isBot == true })
    }

    private var isHost: Bool {
        roomInfo.hostId == playerID
    }

    private var isSeriesOver: Bool {
        roomInfo.seriesState?.seriesWinnerTeamIndex != nil
    }

    private var winnerColor: TeamColor {
        state.config.teamColors[safe: winnerTeamIndex] ?? .blue
    }

    private var winningPlayers: [PublicPlayer] {
        state.players.filter { $0.teamIndex == winnerTeamIndex }
    }

    private var titleText: String {
        if isSeriesOver { return "Series Complete!" }
        return isWinner ? "Victory!" : "Game Over!"
    }

    private var teamBadgeText: String {
        if isSeriesOver {
            return "Team \(winnerColor.rawValue.uppercased()) wins the series!"
        }
        return "Team \(winnerColor.rawValue.uppercased()) Wins!"
    }

    private var messageText: String {
        if isSeriesOver {
            return isWinner ? "You won the series!" : "Great series. Better luck next time."
        }
        return isWinner ? "Congratulations on your victory!" : "Great game. Better luck next time."
    }

    private var displayWins: [Int] {
        guard let teamWins = roomInfo.seriesState?.teamWins else { return [] }
        if isSeriesOver { return teamWins }
        return teamWins.enumerated().map { index, wins in
            index == winnerTeamIndex ? wins + 1 : wins
        }
    }

    private var displayGamesPlayed: Int {
        guard let gamesPlayed = roomInfo.seriesState?.gamesPlayed else { return 0 }
        return isSeriesOver ? gamesPlayed : gamesPlayed + 1
    }
}

private struct SequenceRecapBoardView: View {
    let completedSequences: [SequenceLine]
    let winnerTeamIndex: Int
    let teamColor: TeamColor

    var body: some View {
        NativeCard {
            VStack(spacing: 14) {
                Text("Winning Sequences")
                    .font(.headline.weight(.bold))
                GeometryReader { geometry in
                    let metrics = boardMetrics(for: geometry.size.width, maxWidth: 320, spacing: 2)
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(metrics.cellSize), spacing: 2), count: 10), spacing: 2) {
                        ForEach(0..<100, id: \.self) { index in
                            let row = index / 10
                            let col = index % 10
                            let key = "\(row),\(col)"
                            let winningIndex = winningCells[key]
                            let isCorner = CardRules.isCorner(row: row, col: col)

                            ZStack {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(Color.white.opacity(0.05))
                                if let winningIndex {
                                    Circle()
                                        .fill(Color(hex: teamColor.classicHex))
                                        .padding(4)
                                        .overlay {
                                            Text(teamColor.letter)
                                                .font(.system(size: max(8, metrics.cellSize * 0.32), weight: .black))
                                        }
                                        .shadow(color: Color(hex: teamColor.classicHex).opacity(0.8), radius: 8)
                                        .opacity(0.96)
                                        .scaleEffect(1.0)
                                        .animation(.easeInOut.delay(Double(winningIndex) * 0.2), value: winningIndex)
                                } else if isCorner {
                                    Text("★")
                                        .foregroundStyle(Color.yellow.opacity(0.9))
                                }
                            }
                            .frame(width: metrics.cellSize, height: metrics.cellSize)
                        }
                    }
                }
                .frame(height: 320)

                Text("\(winningSequenceCount) sequence\(winningSequenceCount == 1 ? "" : "s") completed")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.72))
            }
        }
    }

    private var winningCells: [String: Int] {
        var cells: [String: Int] = [:]
        for (sequenceIndex, sequence) in completedSequences.enumerated() where sequence.teamIndex == winnerTeamIndex {
            for cell in sequence.cells where cell.count == 2 {
                let key = "\(cell[0]),\(cell[1])"
                if cells[key] == nil {
                    cells[key] = sequenceIndex
                }
            }
        }
        return cells
    }

    private var winningSequenceCount: Int {
        completedSequences.filter { $0.teamIndex == winnerTeamIndex }.count
    }
}

private struct NativeReplayBoardModal: View {
    let eventLog: [GameEvent]
    let boardChips: [[Int?]]
    let completedSequences: [SequenceLine]
    let winnerTeamIndex: Int
    let teamColors: [TeamColor]
    let onClose: () -> Void

    @State private var currentStep = -1
    @State private var isPlaying = true

    var body: some View {
        modalOverlay {
            VStack(spacing: 16) {
                HStack {
                    Text("Play-by-Play Recap")
                        .font(.title3.weight(.black))
                    Spacer()
                    Button("Close", action: onClose)
                        .font(.subheadline.weight(.semibold))
                }

                if replayEvents.isEmpty {
                    Text("No moves to replay.")
                        .foregroundStyle(.white.opacity(0.72))
                    NativePrimaryButton(title: "Done", action: onClose)
                } else {
                    GeometryReader { geometry in
                        let metrics = boardMetrics(for: geometry.size.width, maxWidth: 340, spacing: 2)
                        LazyVGrid(columns: Array(repeating: GridItem(.fixed(metrics.cellSize), spacing: 2), count: 10), spacing: 2) {
                            ForEach(0..<100, id: \.self) { index in
                                let row = index / 10
                                let col = index % 10
                                ReplayBoardCellView(
                                    chip: displayBoard[row][col],
                                    teamColors: teamColors,
                                    isActive: activeCell?.0 == row && activeCell?.1 == col,
                                    isWinningCell: showWinningHighlight && winningCells.contains("\(row),\(col)"),
                                    isCorner: CardRules.isCorner(row: row, col: col),
                                    size: metrics.cellSize
                                )
                            }
                        }
                        .frame(width: metrics.boardSide, height: metrics.boardSide)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                    .frame(height: 340)

                    Text(caption)
                        .font(.subheadline.weight(.semibold))
                        .multilineTextAlignment(.center)

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.08))
                            Capsule()
                                .fill(Color(hex: winnerColor.classicHex))
                                .frame(width: geometry.size.width * progress)
                        }
                    }
                    .frame(height: 8)

                    HStack(spacing: 12) {
                        if !isPlaying {
                            NativeSecondaryButton(title: "Replay") {
                                currentStep = -1
                                isPlaying = true
                            }
                        }
                        NativePrimaryButton(title: "Done", action: onClose)
                    }
                }
            }
        }
        .task(id: replayTaskID) {
            guard isPlaying, !replayEvents.isEmpty else { return }
            let totalSteps = replayEvents.count
            if currentStep > totalSteps {
                isPlaying = false
                return
            }

            let delay: UInt64
            if currentStep < 0 {
                delay = 800_000_000
            } else if currentStep >= totalSteps {
                delay = 2_000_000_000
            } else {
                delay = 1_500_000_000
            }

            try? await Task.sleep(nanoseconds: delay)
            guard !Task.isCancelled else { return }
            currentStep += 1
        }
        .onAppear {
            NativeHaptics.impact(.light)
        }
    }

    private var replayTaskID: String {
        "\(currentStep)-\(isPlaying)-\(replayEvents.count)"
    }

    private var replayEvents: [ReplayEvent] {
        eventLog.compactMap { event in
            guard
                let position = event.position,
                position.count == 2,
                let teamIndex = event.teamIndex,
                event.type == "chip-placed" || event.type == "chip-removed"
            else {
                return nil
            }

            return ReplayEvent(
                type: event.type,
                position: (position[0], position[1]),
                teamIndex: teamIndex,
                playerName: event.playerName ?? "Player",
                card: event.card ?? ""
            )
        }
        .suffix(8)
    }

    private var startingBoard: [[Int?]] {
        var board = boardChips
        for event in replayEvents.reversed() {
            let row = event.position.0
            let col = event.position.1
            if event.type == "chip-placed" {
                board[row][col] = nil
            } else {
                board[row][col] = event.teamIndex
            }
        }
        return board
    }

    private var displayBoard: [[Int?]] {
        var board = startingBoard
        guard currentStep >= 0 else { return board }
        for index in 0...min(currentStep, replayEvents.count - 1) {
            let event = replayEvents[index]
            if event.type == "chip-placed" {
                board[event.position.0][event.position.1] = event.teamIndex
            } else {
                board[event.position.0][event.position.1] = nil
            }
        }
        return board
    }

    private var activeCell: (Int, Int)? {
        guard replayEvents.indices.contains(currentStep) else { return nil }
        return replayEvents[currentStep].position
    }

    private var winningCells: Set<String> {
        var cells = Set<String>()
        for sequence in completedSequences where sequence.teamIndex == winnerTeamIndex {
            for position in sequence.cells where position.count == 2 {
                cells.insert("\(position[0]),\(position[1])")
            }
        }
        return cells
    }

    private var showWinningHighlight: Bool {
        currentStep >= replayEvents.count
    }

    private var caption: String {
        if currentStep < 0 {
            return "Rewinding..."
        }
        if currentStep >= replayEvents.count {
            return "Game Over!"
        }
        let event = replayEvents[currentStep]
        let cardName = CardRules.fullName(event.card)
        if event.type == "chip-removed" {
            return "\(event.playerName) removed a chip\(cardName.isEmpty ? "" : " with \(cardName)")"
        }
        return "\(event.playerName) played \(cardName)"
    }

    private var progress: CGFloat {
        guard !replayEvents.isEmpty else { return 0 }
        return min(1, CGFloat(currentStep + 1) / CGFloat(replayEvents.count))
    }

    private var winnerColor: TeamColor {
        teamColors[safe: winnerTeamIndex] ?? .blue
    }

}

private struct ReplayEvent {
    let type: String
    let position: (Int, Int)
    let teamIndex: Int
    let playerName: String
    let card: String
}

private struct ReplayBoardCellView: View {
    let chip: Int?
    let teamColors: [TeamColor]
    let isActive: Bool
    let isWinningCell: Bool
    let isCorner: Bool
    let size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(isWinningCell ? Color.white.opacity(0.1) : Color.white.opacity(0.05))
            if let chip, let color = teamColors[safe: chip] {
                Circle()
                    .fill(Color(hex: color.classicHex))
                    .padding(4)
                    .overlay {
                        Text(color.letter)
                            .font(.caption2.weight(.black))
                    }
                    .shadow(color: isWinningCell ? Color(hex: color.classicHex).opacity(0.9) : .clear, radius: 10)
                    .scaleEffect(isActive ? 1.08 : 1.0)
            } else if isCorner {
                Text("★")
                    .foregroundStyle(Color.yellow.opacity(0.9))
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).stroke(isActive ? Color.white : Color.clear, lineWidth: 1.5))
        .frame(width: size, height: size)
    }
}

private func boardMetrics(for availableWidth: CGFloat, maxWidth: CGFloat, spacing: CGFloat) -> (boardSide: CGFloat, cellSize: CGFloat) {
    let boardSide = max(220, min(availableWidth, maxWidth))
    let cellSize = floor((boardSide - spacing * 9) / 10)
    let normalizedBoardSide = cellSize * 10 + spacing * 9
    return (normalizedBoardSide, cellSize)
}

@MainActor
@ViewBuilder
private func modalOverlay<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    ZStack {
        Color.black.opacity(0.72)
            .ignoresSafeArea()
        NativeCard {
            content()
        }
        .padding(.horizontal, 20)
    }
}
