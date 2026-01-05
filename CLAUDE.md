# Claude Code Instructions

## Project Overview
Sequence for Friends is a real-time multiplayer web app for playing the classic Sequence board game. It uses a React frontend with Vite and a Node.js/Express/Socket.IO backend.

## Tech Stack
- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + Socket.IO
- **Shared Types**: TypeScript definitions in `/shared/types.ts`
- **Styling**: CSS with custom properties
- **Deployment**: Render (see render.yaml)

## Project Structure
- `client/` - React frontend (Vite)
- `server/` - Express backend with Socket.IO
- `shared/` - Shared TypeScript types
- `tests/` - Vitest tests

## Development Commands
```bash
npm install          # Install all dependencies
npm run dev          # Run dev server (client + server)
npm run build        # Build for production
npm start            # Start production server
npm test             # Run tests
```

## Key Files
- `server/src/index.ts` - Main server entry, Socket.IO setup
- `server/src/rooms.ts` - Room management
- `server/src/gameState.ts` - Game state management
- `server/src/rules/engine.ts` - Game rules engine
- `client/src/components/GameScreen.tsx` - Main game UI
- `shared/types.ts` - Shared TypeScript interfaces

## Game Features
- 2-12 players with team support
- Real-time multiplayer via Socket.IO
- Mobile-first design with pinch-zoom
- Two-eyed jacks (wild), one-eyed jacks (remove)
- Dead card replacement
- Sequence locking and win detection
