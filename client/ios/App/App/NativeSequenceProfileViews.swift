import SwiftUI

// MARK: - Redesigned Profile View

struct ProfileView: View {
    @ObservedObject var model: AppModel
    @State private var showingEditSheet = false

    private var detailed: DetailedStatsResponse? { model.detailedStats }
    private var achievements: [Achievement] {
        computeAchievements(stats: model.stats, detailed: detailed)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                HeaderBar(title: "Profile") { model.screen = .home }

                profileHeader
                    .padding(.horizontal, 24)

                HandRankCardFan(stats: model.stats)
                    .padding(.horizontal, 24)

                TrophyWallSection(achievements: achievements)
                    .padding(.horizontal, 24)

                if let d = detailed {
                    PokerChipInsightsGrid(insights: d.insights, stats: d.overall)
                        .padding(.horizontal, 24)
                }

                if let d = detailed {
                    modeBreakdownSection(d)
                        .padding(.horizontal, 24)
                }

                if let d = detailed, d.series.played > 0 {
                    seriesCard(d.series)
                        .padding(.horizontal, 24)
                }

                recentGamesSection
                    .padding(.horizontal, 24)

                NativeSecondaryButton(title: "Sign Out") { Task { await model.signOut() } }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 32)
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            EditProfileSheet(model: model)
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 10) {
            AvatarBubble(avatarID: model.user?.avatarId ?? "bear", avatarColor: model.user?.avatarColor ?? "#6366f1", size: 72)
            Text(model.user?.displayName ?? "").font(.title2.weight(.bold))
            Text("@\(model.user?.username ?? "")").foregroundStyle(.white.opacity(0.6))
            if let d = detailed {
                Text("Member since \(memberSinceText(d.memberSince))")
                    .font(.caption).foregroundStyle(.white.opacity(0.5))
            }
            HStack(spacing: 12) {
                Button { Task { await model.openFriends() } } label: {
                    Text("\(model.friends.count) Friends")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(Color.white.opacity(0.08), in: Capsule())
                }
                Button { showingEditSheet = true } label: {
                    Text("Edit Profile")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(Color.white.opacity(0.08), in: Capsule())
                }
            }
        }
    }

    // MARK: - Mode Breakdown (with suit motifs)

    @ViewBuilder
    private func modeBreakdownSection(_ d: DetailedStatsResponse) -> some View {
        let modes = modeList(d.byMode)
        let variants = variantList(d.byVariant)
        let allCards = modes + variants
        if !allCards.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Game Modes").font(.headline.weight(.bold))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(allCards, id: \.0) { name, breakdown, suit, suitColor in
                            SuitModeCard(name: name, breakdown: breakdown, suit: suit, suitColor: suitColor)
                        }
                    }
                }
            }
        }
    }

    private func modeList(_ modes: ModeBreakdowns) -> [(String, ModeBreakdown, String, String)] {
        var list: [(String, ModeBreakdown, String, String)] = []
        if let m = modes.botEasy { list.append(("Bot Easy", m, "♦", "#ef4444")) }
        if let m = modes.botMedium { list.append(("Bot Medium", m, "♣", "#a855f7")) }
        if let m = modes.botHard { list.append(("Bot Hard", m, "♥", "#ef4444")) }
        if let m = modes.botImpossible { list.append(("Bot Impossible", m, "♠", "#ffffff")) }
        if let m = modes.multiplayer { list.append(("Multiplayer", m, "★", "#facc15")) }
        return list
    }

    private func variantList(_ variants: VariantBreakdowns) -> [(String, ModeBreakdown, String, String)] {
        var list: [(String, ModeBreakdown, String, String)] = []
        if let c = variants.classic { list.append(("Classic", c, "♠♥♦♣", "#6366f1")) }
        if let k = variants.kingOfTheBoard { list.append(("King of the Board", k, "♛", "#facc15")) }
        return list
    }

    // MARK: - Series Card

    @ViewBuilder
    private func seriesCard(_ series: SeriesStats) -> some View {
        NativeCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Series").font(.headline.weight(.bold))
                HStack {
                    StatValue(title: "Played", value: "\(series.played)")
                    StatValue(title: "Won", value: "\(series.won)")
                    StatValue(title: "Lost", value: "\(series.lost)")
                    StatValue(title: "Win %", value: "\(series.winRate)%")
                }
            }
        }
    }

    // MARK: - Recent Games

    private var recentGamesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Recent Games").font(.headline.weight(.bold))
                Spacer()
                if model.stats.gamesPlayed > 0 {
                    Button("View All") { Task { await model.openGameHistory() } }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(hex: "#6366f1"))
                }
            }
            if model.recentGames.isEmpty && model.stats.gamesPlayed == 0 {
                Text("No games played yet.")
                    .foregroundStyle(.white.opacity(0.5))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            } else if model.recentGames.isEmpty {
                Text(model.recentGamesStatusMessage ?? "Recent game history is not available for these matches yet.")
                    .foregroundStyle(.white.opacity(0.5))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            } else {
                ForEach(model.recentGames) { game in
                    GameHistoryRow(game: game)
                }
            }
        }
    }

    private func memberSinceText(_ timestamp: Double) -> String {
        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        return formatter.string(from: date)
    }
}

// MARK: - Playing Card View

private struct PlayingCardView: View {
    let topText: String
    let mainValue: String
    let bottomText: String
    let accentHex: String
    let watermarkSuit: String
    var isHero: Bool = false

    private let goldGradient = LinearGradient(
        colors: [Color(hex: "#d4a017"), Color(hex: "#f59e0b")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )

    var body: some View {
        VStack(spacing: isHero ? 6 : 4) {
            Text(topText)
                .font(isHero ? .caption.weight(.bold) : .caption2.weight(.medium))
                .foregroundStyle(.white.opacity(0.5))
                .textCase(.uppercase)
                .tracking(1.2)

            Text(mainValue)
                .font(isHero
                    ? .system(size: 44, weight: .black, design: .rounded)
                    : .system(size: 28, weight: .black, design: .rounded))
                .foregroundStyle(Color(hex: accentHex))

            Text(bottomText)
                .font(isHero ? .subheadline.weight(.black) : .caption.weight(.bold))
                .foregroundStyle(.white.opacity(isHero ? 0.85 : 0.6))
        }
        .frame(width: isHero ? 130 : 100, height: isHero ? 180 : 140)
        .background {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(0.06))
                Text(watermarkSuit)
                    .font(.system(size: isHero ? 80 : 60))
                    .foregroundStyle(.white.opacity(0.03))
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(goldGradient, lineWidth: isHero ? 1.5 : 1)
        )
        .shadow(color: Color(hex: "#d4a017").opacity(isHero ? 0.3 : 0.15), radius: isHero ? 16 : 8)
    }
}

// MARK: - Hand Rank Card Fan

struct HandRankCardFan: View {
    let stats: UserStats

    private var handRank: HandRank { .from(winRate: stats.winRate) }

    var body: some View {
        ZStack {
            // Left card — Games Played
            PlayingCardView(
                topText: "Played",
                mainValue: "\(stats.gamesPlayed)",
                bottomText: "Games",
                accentHex: "#06b6d4",
                watermarkSuit: "♦"
            )
            .rotationEffect(.degrees(-8), anchor: .bottom)
            .offset(x: -72)
            .zIndex(0)

            // Right card — Win Streak
            PlayingCardView(
                topText: "Streak",
                mainValue: "\(stats.currentWinStreak)",
                bottomText: stats.longestWinStreak > 0 ? "Best: \(stats.longestWinStreak)" : "Wins",
                accentHex: "#22c55e",
                watermarkSuit: "♣"
            )
            .rotationEffect(.degrees(8), anchor: .bottom)
            .offset(x: 72)
            .zIndex(0)

            // Center card — Win Rate + Hand Rank (on top)
            PlayingCardView(
                topText: handRank.suitSymbol,
                mainValue: "\(stats.winRate)%",
                bottomText: handRank.displayName,
                accentHex: "#d4a017",
                watermarkSuit: "♠",
                isHero: true
            )
            .zIndex(1)
        }
        .frame(height: 200)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Trophy Badge View

private struct TrophyBadgeView: View {
    let achievement: Achievement

    private var colorHex: String { achievement.category.colorHex }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(achievement.isUnlocked
                        ? Color(hex: colorHex).opacity(0.15)
                        : Color.white.opacity(0.04))
                    .frame(width: 56, height: 56)

                if achievement.isUnlocked {
                    Circle()
                        .stroke(Color(hex: colorHex), lineWidth: 2)
                        .frame(width: 56, height: 56)
                }

                Image(systemName: achievement.icon)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(achievement.isUnlocked
                        ? Color(hex: colorHex)
                        : .white.opacity(0.2))

                if !achievement.isUnlocked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white.opacity(0.3))
                        .offset(x: 18, y: 18)
                }
            }
            .shadow(color: achievement.isUnlocked ? Color(hex: colorHex).opacity(0.5) : .clear, radius: 8)

            Text(achievement.title)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(achievement.isUnlocked ? 0.9 : 0.4))
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.08))
                    Capsule()
                        .fill(Color(hex: colorHex))
                        .frame(width: geo.size.width * achievement.progress)
                }
            }
            .frame(height: 4)

            Text("\(achievement.currentValue)/\(achievement.targetValue)")
                .font(.system(size: 9, weight: .medium).monospacedDigit())
                .foregroundStyle(.white.opacity(0.35))
        }
    }
}

// MARK: - Trophy Wall Section

struct TrophyWallSection: View {
    let achievements: [Achievement]

    private let columns = [GridItem(.adaptive(minimum: 90, maximum: 110), spacing: 16)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Trophy Wall").font(.headline.weight(.bold))
                Spacer()
                let unlocked = achievements.filter(\.isUnlocked).count
                Text("\(unlocked)/\(achievements.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.5))
            }

            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(achievements) { achievement in
                    TrophyBadgeView(achievement: achievement)
                }
            }
        }
    }
}

// MARK: - Poker Chip View

private struct PokerChipView: View {
    let value: String
    let label: String
    let colorHex: String

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                // Outer ring
                Circle()
                    .stroke(Color(hex: colorHex), lineWidth: 3)
                    .frame(width: 68, height: 68)

                // Inner fill
                Circle()
                    .fill(Color(hex: colorHex).opacity(0.12))
                    .frame(width: 62, height: 62)

                // Dashed inner ring (chip detail)
                Circle()
                    .stroke(Color(hex: colorHex).opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .frame(width: 52, height: 52)

                Text(value)
                    .font(.subheadline.weight(.black))
                    .foregroundStyle(Color(hex: colorHex))
                    .minimumScaleFactor(0.7)
            }

            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.white.opacity(0.6))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

// MARK: - Poker Chip Insights Grid

struct PokerChipInsightsGrid: View {
    let insights: StatsInsights
    let stats: UserStats

    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("The Deal").font(.headline.weight(.bold))

            LazyVGrid(columns: columns, spacing: 16) {
                if let avg = insights.avgGameDurationMs {
                    PokerChipView(value: formatDuration(avg), label: "Avg Game", colorHex: "#3b82f6")
                }
                PokerChipView(value: insights.totalPlayTimeFormatted, label: "Play Time", colorHex: "#3b82f6")
                PokerChipView(value: "\(Int(insights.jackUsageRate * 100))%", label: "Jack Rate", colorHex: "#22c55e")
                if let fmwr = insights.firstMoveWinRate {
                    PokerChipView(value: "\(fmwr)%", label: "1st Move Win", colorHex: "#22c55e")
                }
                if let avgT = insights.avgTurnsPerGame {
                    PokerChipView(value: String(format: "%.1f", avgT), label: "Avg Turns", colorHex: "#a855f7")
                }
                if let avgS = insights.avgSequencesPerGame {
                    PokerChipView(value: String(format: "%.1f", avgS), label: "Avg Seq.", colorHex: "#a855f7")
                }
            }
        }
    }

    private func formatDuration(_ ms: Int) -> String {
        let totalSeconds = ms / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return minutes > 0 ? "\(minutes)m \(seconds)s" : "\(seconds)s"
    }
}

// MARK: - Suit Mode Card (restyled ModeCard)

private struct SuitModeCard: View {
    let name: String
    let breakdown: ModeBreakdown
    let suit: String
    let suitColor: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(name)
                    .font(.subheadline.weight(.bold))
                    .lineLimit(1)
                Spacer()
                Text(suit)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color(hex: suitColor))
            }
            Text("\(breakdown.gamesPlayed) games")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.6))
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4).fill(Color.white.opacity(0.1))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(hex: suitColor).opacity(0.8))
                        .frame(width: geo.size.width * CGFloat(breakdown.winRate) / 100)
                }
            }
            .frame(height: 6)
            Text("\(breakdown.winRate)% win rate")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.5))
        }
        .padding(12)
        .frame(width: 150)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
