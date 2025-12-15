# Sequence for Friends

A real-time multiplayer web app to play the classic board game **Sequence** with friends. Mobile-first design with smooth pinch-zoom and touch interactions.

## Features

- **2-12 players** in teams or individually
- **Real-time multiplayer** via Socket.IO
- **Mobile-first design** with large touch targets
- **Pinch-zoom and pan** for the game board
- **Complete Sequence rules** including:
  - Two-eyed jacks (wild placement)
  - One-eyed jacks (remove opponent chips)
  - Dead card replacement
  - Sequence locking
  - Win conditions (2 sequences for 2-team, 1 for 3-team)
- **Reconnect support** via player tokens stored in localStorage
- **Colorblind-safe** chip design with letters (B/G/R)

## Quick Start

### Development

```bash
# Install dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# Run in development mode
npm run dev
```

This starts:
- Server on `http://localhost:3001`
- Client on `http://localhost:5173`

### Production Build

```bash
npm run build
npm start
```

The server will serve the built client on port 3001 (or `PORT` env var).

### Running Tests

```bash
npm test
```

## How to Play

### Creating a Game

1. Open the app on your phone or browser
2. Tap **Create Game**
3. Enter your name and select the number of players
4. Share the **room code** with your friends

### Joining a Game

1. Open the app
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

## Gestures (Mobile)

| Gesture | Action |
|---------|--------|
| **Pinch** | Zoom in/out on the board |
| **Drag** (when zoomed) | Pan around the board |
| **Double-tap** | Reset zoom to default |
| **Tap card** | Select/deselect card |
| **Tap cell** | Select placement target |

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + Socket.IO
- **State**: In-memory (no database)
- **Styling**: CSS with custom properties

## Deploying to Render

1. Push this repo to GitHub
2. Create a new **Web Service** on Render
3. Connect your GitHub repo
4. Render will auto-detect the `render.yaml` configuration
5. Deploy!

Or use the Render Blueprint:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## Project Structure

```
SequenceForFriends/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   └── styles/       # Global CSS
│   └── ...
├── server/               # Express backend
│   └── src/
│       ├── rules/        # Game rule engine
│       └── ...
├── shared/               # Shared TypeScript types
│   └── types.ts
├── tests/                # Vitest tests
└── render.yaml           # Render deployment config
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

## Known Limitations

- No spectator mode (yet)
- No chat feature (yet)
- Rooms expire after 24 hours of inactivity
- Maximum 12 players per room

## License

MIT
