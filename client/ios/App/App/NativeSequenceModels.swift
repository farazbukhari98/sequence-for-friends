import Foundation

enum NativeScreen: String {
    case loading
    case auth
    case onboarding
    case home
    case profile
    case friends
    case lobby
    case game
}

struct AvatarOption: Identifiable, Hashable {
    let id: String
    let emoji: String
}

enum NativeTheme {
    static let avatarOptions: [AvatarOption] = [
        .init(id: "bear", emoji: "🐻"),
        .init(id: "fox", emoji: "🦊"),
        .init(id: "cat", emoji: "🐱"),
        .init(id: "dog", emoji: "🐶"),
        .init(id: "owl", emoji: "🦉"),
        .init(id: "unicorn", emoji: "🦄"),
        .init(id: "dragon", emoji: "🐉"),
        .init(id: "octopus", emoji: "🐙"),
        .init(id: "penguin", emoji: "🐧"),
        .init(id: "koala", emoji: "🐨"),
        .init(id: "lion", emoji: "🦁"),
        .init(id: "wolf", emoji: "🐺"),
        .init(id: "eagle", emoji: "🦅"),
        .init(id: "rabbit", emoji: "🐰"),
        .init(id: "panda", emoji: "🐼"),
        .init(id: "alien", emoji: "👾"),
    ]

    static let avatarColors = [
        "#6366f1",
        "#8b5cf6",
        "#ec4899",
        "#ef4444",
        "#f97316",
        "#eab308",
        "#22c55e",
        "#14b8a6",
        "#06b6d4",
        "#3b82f6",
    ]
}

enum TeamColor: String, Codable, CaseIterable {
    case blue
    case green
    case red

    var letter: String {
        String(rawValue.uppercased().prefix(1))
    }

    var classicHex: String {
        switch self {
        case .blue: return "#2980b9"
        case .green: return "#27ae60"
        case .red: return "#c0392b"
        }
    }
}

enum GameVariant: String, Codable, Equatable {
    case classic
    case kingOfTheBoard = "king-of-the-board"
}

struct UserProfile: Codable, Equatable {
    let id: String
    let username: String
    let displayName: String
    let avatarId: String
    let avatarColor: String
    let createdAt: Double?
}

struct AuthAppleResponse: Codable {
    let needsUsername: Bool
    let sessionToken: String?
    let tempToken: String?
    let suggestedName: String?
    let user: UserProfile?
}

struct AuthCompleteResponse: Codable {
    let sessionToken: String
    let user: UserProfile
}

struct ProfileResponse: Codable {
    let user: UserProfile
    let stats: UserStats
}

struct SearchProfilesResponse: Codable {
    let results: [FriendInfo]
}

struct FriendsResponse: Codable {
    let friends: [FriendInfo]
}

struct FriendRequestsResponse: Codable {
    let requests: [FriendRequest]
}

struct SuccessResponse: Codable {
    let success: Bool
    let autoAccepted: Bool?
    let inviteId: String?
}

struct UserStats: Codable, Equatable {
    let gamesPlayed: Int
    let gamesWon: Int
    let gamesLost: Int
    let winRate: Int
    let sequencesCompleted: Int
    let currentWinStreak: Int
    let longestWinStreak: Int
    let gamesByTeamColor: [String: Int]
    let cardsPlayed: Int
    let twoEyedJacksUsed: Int
    let oneEyedJacksUsed: Int
    let deadCardsReplaced: Int
    let totalTurnsTaken: Int
    let firstMoveGames: Int
    let firstMoveWins: Int
    let seriesPlayed: Int
    let seriesWon: Int
    let seriesLost: Int
    let totalPlayTimeMs: Int
    let fastestWinMs: Int?
    let impossibleBotWins: Int
    let hasBeatImpossibleBot: Bool

    static let empty = UserStats(
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        winRate: 0,
        sequencesCompleted: 0,
        currentWinStreak: 0,
        longestWinStreak: 0,
        gamesByTeamColor: [:],
        cardsPlayed: 0,
        twoEyedJacksUsed: 0,
        oneEyedJacksUsed: 0,
        deadCardsReplaced: 0,
        totalTurnsTaken: 0,
        firstMoveGames: 0,
        firstMoveWins: 0,
        seriesPlayed: 0,
        seriesWon: 0,
        seriesLost: 0,
        totalPlayTimeMs: 0,
        fastestWinMs: nil,
        impossibleBotWins: 0,
        hasBeatImpossibleBot: false
    )
}

struct FriendInfo: Codable, Identifiable, Equatable {
    let userId: String
    let username: String
    let displayName: String
    let avatarId: String
    let avatarColor: String
    let since: Double?
    let hasBeatImpossibleBot: Bool?

    var id: String { userId }
}

struct FriendRequest: Codable, Identifiable, Equatable {
    let userId: String
    let username: String
    let displayName: String
    let avatarId: String
    let avatarColor: String
    let sentAt: Double

    var id: String { userId }
}

struct SeriesState: Codable, Equatable {
    let seriesLength: Int
    let gamesPlayed: Int
    let teamWins: [Int]
    let seriesWinnerTeamIndex: Int?
}

struct PublicPlayer: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let seatIndex: Int
    let teamIndex: Int
    let teamColor: TeamColor
    let connected: Bool
    let ready: Bool
    let handCount: Int
    let topDiscard: String?
    let discardCount: Int
    let isBot: Bool?
}

struct RoomInfo: Codable, Equatable {
    let code: String
    let name: String
    let hostId: String
    let phase: String
    let players: [PublicPlayer]
    let maxPlayers: Int
    let teamCount: Int
    let gameVariant: GameVariant
    let turnTimeLimit: Int
    let sequencesToWin: Int
    let sequenceLength: Int
    let seriesLength: Int
    let seriesState: SeriesState?
}

struct GameConfig: Codable, Equatable {
    let playerCount: Int
    let teamCount: Int
    let teamColors: [TeamColor]
    let gameVariant: GameVariant
    let sequencesToWin: Int
    let scoreToWin: Int
    let sequenceLength: Int
    let handSize: Int
}

struct SequenceLine: Codable, Equatable {
    let cells: [[Int]]
    let teamIndex: Int
}

struct KingZone: Codable, Equatable {
    let id: String
    let center: [Int]
    let cells: [[Int]]
}

struct GameEvent: Codable, Equatable, Identifiable {
    let id: String
    let timestamp: Double
    let type: String
    let playerId: String?
    let playerName: String?
    let teamIndex: Int?
    let teamColor: TeamColor?
    let card: String?
    let position: [Int]?
    let sequenceCount: Int?
    let pointsAwarded: Int?
    let totalScore: Int?
    let usedKingZone: Bool?
}

struct MoveScoringSummary: Codable, Equatable {
    let pointsAwarded: Int
    let totalScore: Int
    let usedKingZone: Bool
    let sequenceCount: Int
}

struct MoveResult: Codable, Equatable {
    let success: Bool
    let error: String?
    let playerId: String?
    let scoring: MoveScoringSummary?
    let winnerTeamIndex: Int?
    let gameOver: Bool?
}

struct CutCard: Codable, Equatable, Identifiable {
    let playerId: String
    let card: String
    let rank: Int

    var id: String { playerId }
}

struct ClientGameState: Codable, Equatable {
    let phase: String
    let config: GameConfig
    let players: [PublicPlayer]
    let dealerIndex: Int
    let currentPlayerIndex: Int
    let deckCount: Int
    let boardChips: [[Int?]]
    let lockedCells: [[String]]
    let sequencesCompleted: [Int]
    let teamScores: [Int]
    let completedSequences: [SequenceLine]
    let kingZone: KingZone?
    let myHand: [String]
    let myPlayerId: String
    let deadCardReplacedThisTurn: Bool
    let pendingDraw: Bool
    let lastRemovedCell: [Int]?
    let winnerTeamIndex: Int?
    let lastMove: MoveResult?
    let cutCards: [CutCard]?
    let turnTimeLimit: Int
    let turnStartedAt: Double?
    let eventLog: [GameEvent]
}

struct TeamSwitchRequest: Codable, Equatable {
    let playerId: String
    let playerName: String
    let fromTeamIndex: Int
    let toTeamIndex: Int
}

struct TeamSwitchResponse: Codable, Equatable {
    let playerId: String
    let approved: Bool
    let playerName: String
}

struct GameModeInfo: Codable, Equatable {
    struct ModeSettings: Codable, Equatable {
        let sequenceLength: Int
        let turnTimeLimit: Int
        let seriesLength: Int
        let gameVariant: GameVariant
    }

    let modes: [String]
    let changedBy: String
    let settings: ModeSettings
}

struct CreateRoomResponse: Codable {
    let success: Bool
    let roomCode: String?
    let playerId: String?
    let token: String?
    let error: String?
}

struct JoinRoomResponse: Codable {
    let success: Bool
    let roomInfo: RoomInfo?
    let playerId: String?
    let token: String?
    let error: String?
}

struct ReconnectResponse: Codable {
    let success: Bool
    let roomInfo: RoomInfo?
    let gameState: ClientGameState?
    let playerId: String?
    let error: String?
    let errorCode: NativeReconnectErrorCode?
}

struct GameAction: Codable, Equatable {
    let type: String
    let card: String?
    let targetRow: Int?
    let targetCol: Int?
}

struct RoomSession: Codable, Equatable {
    let roomCode: String
    let token: String
    let playerId: String
}

struct CreateRoomPayload: Encodable {
    let roomName: String
    let playerName: String
    let maxPlayers: Int
    let teamCount: Int
    let turnTimeLimit: Int
    let sequencesToWin: Int
}

struct CreateBotGamePayload: Encodable {
    let playerName: String
    let difficulty: String
    let sequenceLength: Int
    let sequencesToWin: Int
    let seriesLength: Int
}

struct JoinRoomPayload: Encodable {
    let roomCode: String
    let playerName: String
    let token: String?
}

struct UpdateProfilePayload: Encodable {
    let displayName: String
    let avatarId: String
    let avatarColor: String
}

struct UpdateRoomSettingsPayload: Encodable {
    let turnTimeLimit: Int?
    let sequencesToWin: Int?
    let sequenceLength: Int?
    let seriesLength: Int?
    let gameVariant: GameVariant?
}

struct TeamSwitchResponsePayload: Encodable {
    let playerId: String
    let approved: Bool
}

enum CardRules {
    static let twoEyedJacks = ["JD", "JC"]
    static let oneEyedJacks = ["JH", "JS"]
    static let boardLayout: [[String]] = [
        ["W", "2S", "3S", "4S", "5S", "6S", "7S", "8S", "9S", "W"],
        ["6C", "5C", "4C", "3C", "2C", "AH", "KH", "QH", "TH", "TS"],
        ["7C", "AS", "2D", "3D", "4D", "5D", "6D", "7D", "9H", "QS"],
        ["8C", "KS", "6C", "5C", "4C", "3C", "2C", "8D", "8H", "KS"],
        ["9C", "QS", "7C", "6H", "5H", "4H", "AH", "9D", "7H", "AS"],
        ["TC", "TS", "8C", "7H", "2H", "3H", "KH", "TD", "6H", "2D"],
        ["QC", "9S", "9C", "8H", "9H", "TH", "QH", "QD", "5H", "3D"],
        ["KC", "8S", "TC", "QC", "KC", "AC", "AD", "KD", "4H", "4D"],
        ["AC", "7S", "6S", "5S", "4S", "3S", "2S", "2H", "3H", "5D"],
        ["W", "AD", "KD", "QD", "TD", "9D", "8D", "7D", "6D", "W"],
    ]

    static func isCorner(row: Int, col: Int) -> Bool {
        (row == 0 || row == 9) && (col == 0 || col == 9)
    }

    static func jackType(for card: String) -> String? {
        if twoEyedJacks.contains(card) { return "two-eyed" }
        if oneEyedJacks.contains(card) { return "one-eyed" }
        return nil
    }

    static func findCardPositions(_ card: String) -> [[Int]] {
        var positions: [[Int]] = []
        for rowIndex in boardLayout.indices {
            for colIndex in boardLayout[rowIndex].indices where boardLayout[rowIndex][colIndex] == card {
                positions.append([rowIndex, colIndex])
            }
        }
        return positions
    }

    static func isDeadCard(_ card: String, boardChips: [[Int?]]) -> Bool {
        guard !card.hasPrefix("J") else { return false }
        return findCardPositions(card).allSatisfy { position in
            boardChips[position[0]][position[1]] != nil
        }
    }

    static func display(_ card: String) -> CardDisplay {
        guard card.count == 2, card != "W" else {
            return CardDisplay(rank: card == "W" ? "★" : card, suit: "", suitColorHex: "#facc15")
        }

        let ranks: [Character: String] = [
            "A": "A", "K": "K", "Q": "Q", "J": "J", "T": "10",
            "9": "9", "8": "8", "7": "7", "6": "6", "5": "5", "4": "4", "3": "3", "2": "2",
        ]
        let suits: [Character: (symbol: String, color: String)] = [
            "S": ("♠", "#f8fafc"),
            "C": ("♣", "#f8fafc"),
            "H": ("♥", "#ef4444"),
            "D": ("♦", "#ef4444"),
        ]

        let rank = ranks[card.first ?? " "] ?? String(card.prefix(1))
        let suitInfo = suits[card.last ?? " "] ?? ("", "#f8fafc")
        return CardDisplay(rank: rank, suit: suitInfo.symbol, suitColorHex: suitInfo.color)
    }

    static func fullName(_ card: String) -> String {
        guard card.count == 2, card != "W" else { return card == "W" ? "Wild Corner" : card }
        let ranks: [Character: String] = [
            "A": "Ace", "K": "King", "Q": "Queen", "J": "Jack",
            "T": "10", "9": "9", "8": "8", "7": "7", "6": "6",
            "5": "5", "4": "4", "3": "3", "2": "2",
        ]
        let suits: [Character: String] = [
            "S": "Spades", "H": "Hearts", "D": "Diamonds", "C": "Clubs",
        ]
        guard let rank = card.first, let suit = card.last else { return card }
        return "\(ranks[rank] ?? String(rank)) of \(suits[suit] ?? String(suit))"
    }

    static func highlightedCells(
        for selectedCard: String?,
        state: ClientGameState,
        playerId: String
    ) -> Set<String> {
        guard
            let selectedCard,
            let currentPlayer = state.players[safe: state.currentPlayerIndex],
            currentPlayer.id == playerId,
            !state.pendingDraw
        else {
            return []
        }

        let myTeamIndex = state.players.first(where: { $0.id == playerId })?.teamIndex ?? -1
        switch jackType(for: selectedCard) {
        case "two-eyed":
            return emptyPlacements(state: state)
        case "one-eyed":
            return removablePlacements(state: state, myTeamIndex: myTeamIndex)
        default:
            return Set(findCardPositions(selectedCard).compactMap { position in
                state.boardChips[position[0]][position[1]] == nil ? "\(position[0]),\(position[1])" : nil
            })
        }
    }

    private static func emptyPlacements(state: ClientGameState) -> Set<String> {
        var cells = Set<String>()
        for row in 0..<10 {
            for col in 0..<10 where !isCorner(row: row, col: col) {
                guard state.boardChips[row][col] == nil else { continue }
                if state.lastRemovedCell == [row, col] { continue }
                cells.insert("\(row),\(col)")
            }
        }
        return cells
    }

    private static func removablePlacements(state: ClientGameState, myTeamIndex: Int) -> Set<String> {
        var locked = Set<String>()
        state.lockedCells.forEach { $0.forEach { locked.insert($0) } }
        var cells = Set<String>()
        for row in 0..<10 {
            for col in 0..<10 where !isCorner(row: row, col: col) {
                guard let chip = state.boardChips[row][col] else { continue }
                if chip == myTeamIndex || locked.contains("\(row),\(col)") { continue }
                cells.insert("\(row),\(col)")
            }
        }
        return cells
    }
}

struct CardDisplay: Equatable {
    let rank: String
    let suit: String
    let suitColorHex: String
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
