# Claude Code Instructions

## Project Overview
Sequence for Friends is a real-time multiplayer web app for playing the classic Sequence board game. It uses a React frontend with Vite and a Cloudflare Workers + Durable Objects backend with native WebSockets.

## Tech Stack
- **Frontend**: React + Vite + TypeScript
- **Backend**: Cloudflare Workers + Durable Objects (WebSocket Hibernation API)
- **Shared Types**: TypeScript definitions in `/shared/types.ts`
- **Styling**: CSS with custom properties
- **Deployment**: Cloudflare Workers (`wrangler deploy`)
- **iOS**: Capacitor native app

## Project Structure
- `client/` - React frontend (Vite)
- `worker/` - Cloudflare Worker + Durable Object backend
- `shared/` - Shared TypeScript types
- `tests/` - Vitest tests
- `server/` - Legacy Express/Socket.IO backend (reference only)

## Development Commands
```bash
npm install                    # Install root dependencies
cd worker && npm install       # Install worker dependencies
cd client && npm install       # Install client dependencies
npm run dev                    # Run dev (worker + client concurrently)
npm run dev:worker             # Run Cloudflare Worker locally (wrangler dev)
npm run dev:client             # Run Vite dev server
npm run build                  # Build client for production
npm run deploy                 # Deploy worker to Cloudflare
npm test                       # Run tests
```

## Key Files
- `worker/src/index.ts` - Worker entry, HTTP routes, WebSocket upgrade routing
- `worker/src/room-do.ts` - Durable Object: room state, WebSocket handlers, timers
- `worker/src/room-logic.ts` - Room helper functions (create, join, state transforms)
- `worker/src/protocol.ts` - WebSocket message types (ClientMessage/ServerMessage)
- `worker/src/rules/engine.ts` - Game rules engine
- `worker/src/bot.ts` - Bot AI logic
- `client/src/hooks/useSocket.ts` - WebSocket client hook
- `client/src/lib/websocket.ts` - WebSocket wrapper with reconnect + correlation IDs
- `client/src/components/GameScreen.tsx` - Main game UI
- `shared/types.ts` - Shared TypeScript interfaces

## Architecture
- **1 Durable Object per room** - isolated state, connections, timers
- **KV namespace** (`PLAYER_TOKENS`) for token→roomCode reconnection lookup
- **WebSocket Hibernation API** - DO sleeps when idle, wakes on message
- **Alarm API** - single alarm with priority queue for turn timeouts, bot turns, cleanup
- **Native WebSocket** protocol with JSON messages (`{ type, id?, data }`)
- **Correlation IDs** for request/response pattern (replaces Socket.IO callbacks)

## Game Features
- 2-12 players with team support
- Real-time multiplayer via native WebSockets
- Mobile-first design with pinch-zoom
- Two-eyed jacks (wild), one-eyed jacks (remove)
- Dead card replacement
- Sequence locking and win detection
- AI bot opponents (easy/medium/hard)
- Series mode (best of 3/5/7)
