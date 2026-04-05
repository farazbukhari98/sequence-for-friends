import Foundation

// MARK: - Hand Rank (poker hand based on win rate)

enum HandRank: Int, CaseIterable {
    case highCard = 0
    case onePair
    case twoPair
    case threeOfAKind
    case straight
    case flush
    case fullHouse
    case fourOfAKind
    case straightFlush
    case royalFlush

    var displayName: String {
        switch self {
        case .highCard: return "High Card"
        case .onePair: return "One Pair"
        case .twoPair: return "Two Pair"
        case .threeOfAKind: return "Three of a Kind"
        case .straight: return "Straight"
        case .flush: return "Flush"
        case .fullHouse: return "Full House"
        case .fourOfAKind: return "Four of a Kind"
        case .straightFlush: return "Straight Flush"
        case .royalFlush: return "Royal Flush"
        }
    }

    var suitSymbol: String {
        switch self {
        case .highCard, .onePair: return "♣"
        case .twoPair, .threeOfAKind: return "♦"
        case .straight, .flush: return "♥"
        case .fullHouse, .fourOfAKind: return "♠"
        case .straightFlush, .royalFlush: return "♠♥"
        }
    }

    static func from(winRate: Int) -> HandRank {
        switch winRate {
        case 90...100: return .royalFlush
        case 80..<90: return .straightFlush
        case 70..<80: return .fourOfAKind
        case 60..<70: return .fullHouse
        case 50..<60: return .flush
        case 40..<50: return .straight
        case 30..<40: return .threeOfAKind
        case 20..<30: return .twoPair
        case 10..<20: return .onePair
        default: return .highCard
        }
    }
}

// MARK: - Achievement System

enum AchievementCategory: String {
    case milestone
    case streak
    case mastery
    case style
    case social

    var colorHex: String {
        switch self {
        case .milestone: return "#06b6d4"
        case .streak: return "#f97316"
        case .mastery: return "#ef4444"
        case .style: return "#a855f7"
        case .social: return "#22c55e"
        }
    }
}

struct Achievement: Identifiable, Equatable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let category: AchievementCategory
    let currentValue: Int
    let targetValue: Int

    var isUnlocked: Bool { currentValue >= targetValue }
    var progress: Double { targetValue > 0 ? min(1.0, Double(currentValue) / Double(targetValue)) : 0 }
}

func computeAchievements(stats: UserStats, detailed: DetailedStatsResponse?) -> [Achievement] {
    let botDifficultiesBeaten: Int = {
        guard let modes = detailed?.byMode else { return 0 }
        var count = 0
        if (modes.botEasy?.gamesWon ?? 0) > 0 { count += 1 }
        if (modes.botMedium?.gamesWon ?? 0) > 0 { count += 1 }
        if (modes.botHard?.gamesWon ?? 0) > 0 { count += 1 }
        if (modes.botImpossible?.gamesWon ?? 0) > 0 { count += 1 }
        return count
    }()

    let fastestUnder120: Int = {
        guard let ms = stats.fastestWinMs, ms > 0, ms < 120_000 else { return 0 }
        return 1
    }()

    let playTimeHours = stats.totalPlayTimeMs / 3_600_000

    return [
        Achievement(
            id: "first_blood", title: "First Blood",
            description: "Play your first game",
            icon: "flame", category: .milestone,
            currentValue: min(stats.gamesPlayed, 1), targetValue: 1
        ),
        Achievement(
            id: "centurion", title: "Centurion",
            description: "Play 100 games",
            icon: "shield.fill", category: .milestone,
            currentValue: stats.gamesPlayed, targetValue: 100
        ),
        Achievement(
            id: "on_fire", title: "On Fire",
            description: "Win 5 games in a row",
            icon: "flame.fill", category: .streak,
            currentValue: stats.longestWinStreak, targetValue: 5
        ),
        Achievement(
            id: "unstoppable", title: "Unstoppable",
            description: "Win 10 games in a row",
            icon: "bolt.fill", category: .streak,
            currentValue: stats.longestWinStreak, targetValue: 10
        ),
        Achievement(
            id: "bot_slayer", title: "Bot Slayer",
            description: "Beat every bot difficulty",
            icon: "cpu", category: .mastery,
            currentValue: botDifficultiesBeaten, targetValue: 4
        ),
        Achievement(
            id: "impossible_victor", title: "Impossible Victor",
            description: "Defeat the Impossible bot",
            icon: "crown.fill", category: .mastery,
            currentValue: stats.hasBeatImpossibleBot ? 1 : 0, targetValue: 1
        ),
        Achievement(
            id: "jack_master", title: "Jack Master",
            description: "Use 50 two-eyed jacks",
            icon: "suit.spade.fill", category: .style,
            currentValue: stats.twoEyedJacksUsed, targetValue: 50
        ),
        Achievement(
            id: "speed_demon", title: "Speed Demon",
            description: "Win a game in under 2 minutes",
            icon: "hare.fill", category: .style,
            currentValue: fastestUnder120, targetValue: 1
        ),
        Achievement(
            id: "marathon", title: "Marathon",
            description: "Play for 10 hours total",
            icon: "figure.run", category: .style,
            currentValue: playTimeHours, targetValue: 10
        ),
        Achievement(
            id: "socialite", title: "Socialite",
            description: "Play 10 multiplayer games",
            icon: "person.2.fill", category: .social,
            currentValue: detailed?.byMode.multiplayer?.gamesPlayed ?? 0, targetValue: 10
        ),
        Achievement(
            id: "king_maker", title: "King Maker",
            description: "Win a King of the Board game",
            icon: "crown", category: .social,
            currentValue: detailed?.byVariant.kingOfTheBoard?.gamesWon ?? 0, targetValue: 1
        ),
        Achievement(
            id: "series_champ", title: "Series Champ",
            description: "Win a series",
            icon: "trophy.fill", category: .social,
            currentValue: stats.seriesWon, targetValue: 1
        ),
    ]
}
