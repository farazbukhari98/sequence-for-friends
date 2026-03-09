# Sequence for Friends

A real-time multiplayer **iOS app** for playing the classic board game **Sequence** with friends. The active product is a native SwiftUI client backed by a Cloudflare Worker multiplayer server.

## Features

- **2-12 players** in teams or individually
- **Real-time multiplayer** via WebSocket room state
- **Native SwiftUI iOS client**
- **Complete Sequence rules** including:
  - Two-eyed jacks (wild placement)
  - One-eyed jacks (remove opponent chips)
  - Dead card replacement
  - Sequence locking
  - Win conditions (2 sequences for 2-team, 1 for 3-team)
- **King Of The Board** multiplayer mode
- **Reconnect support** with persisted room sessions
- **Colorblind-safe** chip design with letters (B/G/R)

## Quick Start

### Development

```bash
npm install

# Run the backend locally
npm run dev
```

This starts the Cloudflare Worker locally.

### Validation

```bash
npm test
npm run build
```

### Native iOS Build

```bash
npm run build:ios
```

Or build directly:

```bash
xcodebuild -project client/ios/App/App.xcodeproj -scheme App \
  -destination "platform=iOS Simulator,name=iPhone 17 Pro" build
```

### Running Tests

```bash
npm test
```

## How to Play

### Creating a Game

1. Open the iOS app
2. Tap **Create Game**
3. Enter your name and select the number of players
4. Share the **room code** with your friends

### Joining a Game

1. Open the iOS app
2. Tap **Join Game**
3. Enter the room code and your name
4. Wait for the host to start

### Playing

1. **Tap a card** in your hand to select it
2. **Tap a highlighted cell** on the board to place your chip
3. **Tap Confirm** to commit your move
4. **Tap Draw Card** to end your turn

### Special Cards

- **Two-eyed Jacks** (J♦, J♣): Place your chip on ANY open space
- **One-eyed Jacks** (J♥, J♠): Remove an opponent's chip (not from completed sequences)

### Dead Cards

If both spaces for a card are occupied, it shows a **DEAD** badge. Tap **Replace** to discard it and draw a new card (once per turn).

### Winning

- **2-team games**: Complete **2 sequences** to win
- **3-team games**: Complete **1 sequence** to win

A sequence is 5 chips in a row (horizontal, vertical, or diagonal). Corners are wild and count for everyone!

## Tech Stack

- **Client**: SwiftUI + UIKit integration where needed
- **Backend**: Cloudflare Worker + Durable Objects + D1
- **Shared rules/types**: TypeScript
- **Tests**: Vitest

## Project Structure

```
SequenceForFriends/
├── client/
│   └── ios/              # Native iOS app
├── worker/               # Cloudflare Worker backend
│   └── src/
│       ├── rules/        # Game rule engine
│       └── ...
├── shared/               # Shared TypeScript types
│   └── types.ts
├── tests/                # Vitest tests
└── docs/                 # Release/runbook docs
```

## Game Rules Reference

### Valid Player Counts
2, 3, 4, 6, 8, 9, 10, 12

### Team Assignment
- 2-3 players: Individual play
- 4+ players: Teams (alternating seats)

### Cards Per Player
| Players | Cards |
|---------|-------|
| 2 | 7 |
| 3-4 | 6 |
| 6 | 5 |
| 8-9 | 4 |
| 10-12 | 3 |

### Overlap Rule
In 2-sequence mode, your second sequence can share **at most 1 chip** from your first sequence (corners don't count toward this limit).

## iOS Development

The app is fully native SwiftUI. There is no browser client in the active repo layout.

### Native Runtime Notes

- Do not depend on bundled web assets for the iOS runtime.
- Push permission is user-triggered after sign-in, not requested at launch.
- Reinstall/regression validation must include uninstall -> reinstall -> Sign in with Apple on the same build.

### Building for TestFlight

```bash
cd client/ios/App
./scripts/archive-testflight.sh
```

See [`docs/native-testflight-runbook.md`](/Users/farazbukhari/Documents/SequenceForFriends/docs/native-testflight-runbook.md) for the full release checklist, including reconnect and reinstall auth regression gates.

## Known Limitations

- No spectator mode (yet)
- No chat feature (yet)
- Rooms expire after 24 hours of inactivity
- Maximum 12 players per room

## License

MIT
