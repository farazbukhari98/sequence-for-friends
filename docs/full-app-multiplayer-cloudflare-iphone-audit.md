# Full App, Multiplayer, iPhone UI, and Cloudflare Audit

Date: 2026-04-24

Scope: Expo React Native app, shared game rules/types, Cloudflare Worker backend, Durable Object multiplayer flow, D1/KV/APNs/deep-link configuration, and current dirty UI/UX changes. Cloudflare checks were limited to GET, OPTIONS, and local/config inspection.

Research baseline:
- Apple lists iPhone 17 Pro at 6.3 inches, 1206x2622 pixels, with Dynamic Island.
- Apple HIG layout guidance emphasizes using safe areas and avoiding content behind system UI.
- Use Your Loaf lists iPhone 17 Pro at 402x874 points and iPhone 17 Pro Max at 440x956 points.
- Sources: [Apple iPhone 17 Pro specs](https://www.apple.com/iphone-17-pro/specs/), [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout), [iPhone 17 point sizes](https://useyourloaf.com/blog/iphone-17-screen-sizes/).

## Verification Run

Passing checks:
- `npm test`: passed 5 files / 59 tests.
- `npm run build`: passed Worker TypeScript build.
- `cd client/sequence-app && npm run typescript`: passed.
- `cd client/sequence-app && npm test -- --runInBand`: passed 2 suites / 10 tests.

Cloudflare non-mutating checks:
- `GET /.well-known/apple-app-site-association`: 200 JSON with app ID `469Q8Z675Y.com.farazbukhari.sequence` and paths `/join/*`, `/invite/*`.
- `GET /privacy`: 200 HTML.
- `GET /join/abc12`: 200 HTML and redirects to `sequencegame://join/ABC12`.
- `OPTIONS /api/profile/me`: 204 with CORS headers.
- `GET /api/profile/me`: 401 `{"error":"Unauthorized"}`.
- `wrangler secret list --config worker/wrangler.toml`: secrets exist for `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, and `AUTH_SECRET`.
- `wrangler deployments list --config worker/wrangler.toml`: blocked by missing/invalid `CLOUDFLARE_API_TOKEN`.
- `wrangler d1 migrations list sequence-db --config worker/wrangler.toml`: failed because Wrangler looked in `worker/migrations`, while migrations live under `worker/src/db/migrations`.

## Priority Findings

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| P1-01 | High | Cloudflare / iOS release | Expo build cannot claim universal links because associated domains are missing from Expo entitlements. |
| P1-02 | High | APNs / release | Expo APNs entitlement is `development`, while Worker config sends to production APNs. |
| P1-03 | High | Multiplayer navigation | Create/join/bot game screens navigate to lobby even when WebSocket setup fails. |
| P1-04 | High | Multiplayer settings | Create-room UI can send invalid timer values and the Worker accepts them. |
| P1-05 | High | D1 / deploy | Wrangler migrations are wired to the wrong directory and migrations may conflict with schema-created databases. |
| P2-01 | Medium | Deep links | Push/universal-link invite handling only logs the room code and does not route the user into join flow. |
| P2-02 | Medium | UI / iPhone | App shells and game screen do not consistently use safe-area insets, risking Dynamic Island/status/home indicator overlap. |
| P2-03 | Medium | UI / theme | Home screen still renders dark text directly on green felt. |
| P2-04 | Medium | UX actions | Lobby share button and friend invite button are visible placeholders. |
| P2-05 | Medium | Multiplayer UX | Team switch, series continuation, emotes, quick messages, and bot removal exist in protocol/server but are not meaningfully wired in UI. |
| P2-06 | Medium | Game UX | Game timer is static and does not count down from `turnStartedAt`. |
| P2-07 | Medium | Error handling | Invalid/stale game actions fail silently after optimistic UI clearing. |
| P2-08 | Medium | Profile / avatars | Expo avatar IDs do not match Worker validation, so new avatar choices can be discarded. |
| P2-09 | Medium | Auth / push | Client sign-out does not call backend session delete, so APNs tokens can remain registered. |
| P3-01 | Low | Join UX | Join screen says 4-letter code, but Worker generates 5-character room codes. |
| P3-02 | Low | iPhone forms | Several form screens lack keyboard avoidance on small iPhones. |
| P3-03 | Low | Cloudflare security | API CORS allows `*`; acceptable for bearer-token native APIs but too broad if web clients are added. |
| P3-04 | Low | Legal copy | Privacy page says tokens expire after 30 days, while auth code uses 7 days. |

## Cloudflare And Release Config

### P1-01: Expo universal links are not configured

References:
- `client/sequence-app/app.config.ts`: iOS config has no `associatedDomains`.
- `client/sequence-app/ios/Sequence/Sequence.entitlements`: contains APNs entitlement only.
- `client/ios/App/App/App.entitlements`: legacy native app has `applinks:sequence.wf`.
- `worker/src/index.ts`: AASA route returns app ID `469Q8Z675Y.com.farazbukhari.sequence` and `/join/*`, `/invite/*`.

Reproduction:
1. Build/install the Expo iOS app.
2. Open `https://sequence.wf/join/ABCDE`.
3. The web fallback can load, but iOS will not hand off as a universal link unless the shipped app has `com.apple.developer.associated-domains`.

Recommended fix:
- Add `associatedDomains: ["applinks:sequence.wf"]` to Expo iOS config and ensure the generated entitlements include `com.apple.developer.associated-domains`.
- Keep AASA app ID aligned with the final Expo bundle identifier and Apple Team ID.

Acceptance criteria:
- A production/TestFlight Expo build opens `https://sequence.wf/join/ABCDE` directly into the app.
- `xcrun simctl openurl` or device testing confirms the route is claimed by the app, not Safari.

### P1-02: APNs environment mismatch

References:
- `client/sequence-app/ios/Sequence/Sequence.entitlements:5-6`: `aps-environment` is `development`.
- `worker/wrangler.toml:32`: `APNS_SANDBOX = "false"`.
- `worker/src/apns.ts:169`: APNs topic is `com.farazbukhari.sequence`.

Risk:
- Development tokens sent to production APNs will fail. Production tokens sent to sandbox APNs will fail. This breaks invite notifications depending on build channel.

Recommended fix:
- Decide release channels explicitly:
  - Development builds: `aps-environment=development`, `APNS_SANDBOX=true`.
  - TestFlight/App Store builds: `aps-environment=production`, `APNS_SANDBOX=false`.
- Prefer environment-specific Wrangler configs or vars rather than hand-editing.

Acceptance criteria:
- A dev build registers a sandbox token and receives a test push through sandbox APNs.
- A TestFlight build registers a production token and receives a test push through production APNs.

### P1-05: D1 migrations are not wired correctly

References:
- `worker/wrangler.toml`: no `migrations_dir`.
- `worker/src/db/migrations/0001_add_trophies.sql`
- `worker/src/db/migrations/0002_add_game_variant.sql`
- `worker/src/db/schema.sql:46`: includes `impossible_bot_wins`.
- `worker/src/db/schema.sql:63`: includes `game_variant`.
- `worker/src/db/schema.sql:68`: includes `bot_difficulty`.

Reproduction:
1. Run `npx wrangler d1 migrations list sequence-db --config worker/wrangler.toml`.
2. Wrangler looks in `worker/migrations` and fails because migrations are under `worker/src/db/migrations`.

Risk:
- Production or preview D1 migrations may be skipped.
- If a database is initialized from `schema.sql` and then migrations are applied, duplicate-column errors are likely because schema already contains columns added by migrations.

Recommended fix:
- Add the correct migrations directory in Wrangler config or move migrations to the expected `worker/migrations` path.
- Make schema/migrations single-source:
  - Either schema is a snapshot and migrations are used only after initial schema creation, or
  - migrations fully define database evolution from empty state.
- Add a CI check that runs `wrangler d1 migrations list --local` or equivalent config validation.

Acceptance criteria:
- `wrangler d1 migrations list sequence-db --config worker/wrangler.toml` finds the migrations.
- Applying migrations to a fresh local D1 database succeeds.
- Applying migrations to the expected production baseline does not duplicate existing columns.

### P3-03: CORS is broad

References:
- `worker/src/api.ts:29-36`: API response CORS sets `Access-Control-Allow-Origin: *`.
- `worker/src/api.ts:39-48`: preflight CORS also allows `*`.

Risk:
- Bearer-token native APIs can tolerate broad CORS more than cookie APIs, but if web clients are introduced, all browser origins can attempt authenticated calls with stolen or user-provided bearer tokens.

Recommended fix:
- Keep broad CORS only if the product is native-only and token-based.
- If web clients exist, restrict origins to owned domains and known preview domains.

Acceptance criteria:
- CORS behavior is documented.
- Browser clients outside allowed origins are blocked if web is supported.

### P3-04: Privacy token lifetime copy is stale

References:
- `worker/src/index.ts:153`: privacy page says auth tokens expire after 30 days.
- `worker/src/auth.ts:185-190`: session expiry is 7 days.

Recommended fix:
- Update privacy copy to match implementation or update implementation to match policy.

Acceptance criteria:
- Privacy policy and code agree on token retention/expiry.

## Multiplayer Logic And Game Flow

### P1-03: Failed create/join flows still navigate to lobby

References:
- `client/sequence-app/stores/gameStore.ts:92-107`: `createRoom` catches errors, sets status, disconnects, and does not rethrow.
- `client/sequence-app/stores/gameStore.ts:110-125`: `createBotGame` catches errors and does not rethrow.
- `client/sequence-app/stores/gameStore.ts:128-154`: `joinRoom` catches errors and does not rethrow.
- `client/sequence-app/stores/gameStore.ts:374`: `_connectWebSocket` catches connection setup errors and updates store state.
- `client/sequence-app/app/(main)/create-room.tsx:27-36`: always pushes lobby after `await createRoom`.
- `client/sequence-app/app/(main)/join-room.tsx:27-29`: always pushes lobby after `await joinRoom`.
- `client/sequence-app/app/(main)/solo-practice.tsx:26-34`: always replaces with lobby after `await createBotGame`.
- `client/sequence-app/services/socket.ts:86-98`: requests are queued before knowing send succeeds.
- `client/sequence-app/services/socket.ts:125-129`: `sendRaw` silently does nothing if the socket is not open.

Reproduction:
1. Disable network or point `EXPO_PUBLIC_WS_URL` to an invalid backend.
2. Tap Create Room, Join Room, or Solo Practice.
3. Screen navigates to lobby even though the room was not created/joined.

Recommended fix:
- Make store actions throw or return `{ ok, error }`.
- Have screens navigate only after `room` and current player state are valid.
- Make `socket.request()` reject immediately if socket is not open.

Acceptance criteria:
- Network failure keeps the user on the current screen.
- A visible error explains the failure.
- Lobby cannot render a fake/empty room after failed setup.

### P1-04: Timer values are invalid and unvalidated

References:
- `client/sequence-app/app/(main)/create-room.tsx:22`: `turnTimeLimit` is an unrestricted number.
- `client/sequence-app/app/(main)/create-room.tsx:81`: Stepper allows 10-second increments from 10 to 120.
- `worker/src/room-logic.ts:321-323`: Worker assigns `settings.turnTimeLimit` with no allow-list validation.
- `shared/types.ts`: valid timer options are intended to be `0 | 15 | 20 | 30 | 45 | 60 | 90 | 120`.

Reproduction:
1. Open Create Room.
2. Set timer to 10, 40, 50, 70, 80, 100, or 110 seconds.
3. Create room; client can send values outside the shared valid options.

Recommended fix:
- Replace numeric stepper with a segmented picker/select using valid timer options.
- Validate settings in shared code and Worker room creation/update paths.
- Reject invalid values with a typed error sent back to the client.

Acceptance criteria:
- UI can only choose `0, 15, 20, 30, 45, 60, 90, 120`.
- Worker rejects invalid timer values even if sent by a modified client.
- Tests cover valid and invalid timer settings.

### P2-05: Protocol features are not wired into UI

References:
- `client/sequence-app/stores/gameStore.ts:249-257`: team switch request exists; response is a console warning.
- `client/sequence-app/stores/gameStore.ts:340-345`: incoming team switch, turn timeout, emote, and quick-message events are ignored.
- `worker/src/room-do.ts:900-953`: team switch request/response implemented server-side.
- `worker/src/room-do.ts:956-1024`: continue/end series implemented server-side.
- `worker/src/room-do.ts:1048-1068`: remove bot implemented server-side.
- `worker/src/room-do.ts:1070-1094`: emote and quick message implemented server-side.

Risk:
- The game advertises or carries protocol support that users cannot actually operate.
- Incoming events can be dropped silently, creating inconsistent expectations between players.

Recommended fix:
- Decide which features are shipping now.
- For shipping features, add visible controls and event UI:
  - Team switch request/approve/deny.
  - Continue/end series on results screen.
  - Remove bot control for host.
  - Emote/quick-message controls and received-message display.
- For non-shipping features, hide controls and remove dead protocol branches from the client UI path until ready.

Acceptance criteria:
- Every server-supported visible feature has an end-to-end UI path.
- Incoming events are either rendered or intentionally ignored with no visible affordance.
- Jest/store tests cover incoming event handling.

### P2-06: Turn timer does not count down

References:
- `client/sequence-app/app/(game)/game.tsx:328-330`: displays `{gameState.turnTimeLimit}s`.
- `shared/types.ts`: game state includes `turnStartedAt`.

Reproduction:
1. Start a timed game.
2. Observe the timer label during a turn.
3. It remains static instead of showing remaining time.

Recommended fix:
- Compute remaining time from `turnStartedAt` and `turnTimeLimit`.
- Update once per second while game is active.
- Render warning state near timeout.
- Pause/hide timer for untimed games.

Acceptance criteria:
- Timer decreases every second.
- Timer resets on turn change.
- Timer matches server timeout behavior within one second.

### P2-07: Game action errors are invisible

References:
- `client/sequence-app/app/(game)/game.tsx:240-246`: clears selection/highlights immediately after sending action.
- `client/sequence-app/stores/gameStore.ts:225-228`: `sendGameAction` catches and logs errors only.

Risk:
- If the server rejects a stale or invalid action, users get no clear error and may think their tap worked.

Recommended fix:
- Return request success/failure from `sendGameAction`.
- Keep selection/highlights until the server accepts the action or explicitly reset with an error toast.
- Surface invalid target, not-your-turn, and room-closed errors.

Acceptance criteria:
- Rejected moves produce visible feedback.
- Selection state is not cleared as if the move succeeded.
- Tests cover rejected action responses.

### P3-01: Join code copy and validation mismatch

References:
- `worker/src/index.ts:20-25`: room codes are generated with 5 characters.
- `client/sequence-app/app/(main)/join-room.tsx:43`: copy says "4-letter code".
- `client/sequence-app/app/(main)/join-room.tsx:48`: placeholder is `ABCD`.
- `client/sequence-app/app/(main)/join-room.tsx:51`: input maxLength is 6.
- `client/sequence-app/app/(main)/join-room.tsx:59`: join button enables at 4 characters.

Recommended fix:
- Standardize room code length in shared constants.
- Update copy, placeholder, max length, and disabled validation.

Acceptance criteria:
- Join button enables only for valid room code length/format.
- Copy and placeholder match generated codes.

## iPhone UI And UX

Target point-size matrix:
- 320x568
- 375x667
- 375x812
- 390x844
- 393x852
- 402x874
- 414x896
- 420x912
- 428x926
- 430x932
- 440x956

### P2-02: Safe-area support is incomplete

References:
- `client/sequence-app/app/_layout.tsx:27-31`: root wraps screens in `Background` only, no `SafeAreaProvider`/screen safe-area policy.
- `client/sequence-app/components/ui/HeaderBar.tsx:47-53`: header uses fixed padding/minHeight, not safe-area insets.
- `client/sequence-app/app/(game)/game.tsx:451`: game content starts with normal margin inside full-screen background.
- `client/sequence-app/app.config.ts:17`: `supportsTablet: true`, so static dimensions are more risky outside one portrait phone shape.

Risk:
- Header/game controls can sit under Dynamic Island/status bar on iPhone 17 Pro and prior notched iPhones.
- Bottom controls can conflict with home indicator on small screens.

Recommended fix:
- Add `react-native-safe-area-context` provider at the app root if not already installed.
- Apply top insets to headers and bottom insets to persistent action areas/game hand tray.
- Test the full matrix above, especially 320x568, 375x812, 402x874, and 440x956.

Acceptance criteria:
- No tappable control or important text overlaps status bar, Dynamic Island, or home indicator.
- Game board, hand, and action tray remain usable on 320x568.

### P2-03: Home text violates the new felt-table contrast rule

References:
- `client/sequence-app/app/(main)/home.tsx:164-171`: greeting text uses `colors.text` and `colors.textSecondary` directly over green felt.

Reproduction:
1. Open Home after the redesign.
2. Greeting/subtext render dark on dark green, unlike the stated rule that text on felt should be bright.

Recommended fix:
- Use bright/on-dark theme tokens for text directly on felt.
- Reserve dark text tokens for bone/card surfaces.

Acceptance criteria:
- Home greeting and supporting text pass contrast checks against the felt background.
- Text inside cards remains dark and readable.

### P2-04: Visible placeholder actions remain

References:
- `client/sequence-app/app/(game)/lobby.tsx:99-106`: share button handler is `/* Share room code */`.
- `client/sequence-app/app/(main)/friend-profile.tsx:113-120`: "Invite to Game" handler is a placeholder comment.

Recommended fix:
- Implement share via React Native `Share` with room code and universal link.
- Disable or hide friend invite unless there is an active room, or implement invite-to-active-room flow.

Acceptance criteria:
- Tapping Share opens the native share sheet with room code and `https://sequence.wf/join/{code}`.
- Tapping Invite to Game either sends an invite or is hidden/disabled with clear state.

### P2-08: Avatar choices are inconsistent between Expo and Worker

References:
- `client/sequence-app/theme/index.ts`: `AVATAR_SYMBOLS` now uses card/game-night IDs such as `spade`, `heart`, `diamond`, and `club`.
- `worker/src/api.ts:20-27`: `VALID_AVATAR_IDS` accepts older IDs such as `bear`, `fox`, and `cat`.
- `worker/src/api.ts:259`: invalid avatar ID falls back to `bear`.

Risk:
- Users can select a new visual avatar in the Expo UI but the backend can discard it and persist a fallback.

Recommended fix:
- Move avatar IDs into shared types/constants.
- Update Worker validation to accept the Expo avatar IDs.
- Add migration or fallback handling for legacy animal IDs if existing users have them.

Acceptance criteria:
- Every avatar selectable in Expo is accepted by the Worker.
- Legacy avatar IDs still render or migrate cleanly.

### P3-02: Forms need keyboard-aware layouts

References:
- `client/sequence-app/app/(main)/create-room.tsx`
- `client/sequence-app/app/(main)/join-room.tsx`
- `client/sequence-app/app/(main)/friends.tsx`
- `client/sequence-app/app/(auth)/onboarding.tsx`

Risk:
- On 320x568 and 375x667 devices, keyboard can cover input fields or primary buttons.

Recommended fix:
- Use `KeyboardAvoidingView`/keyboard-aware scrolling on form-heavy screens.
- Ensure primary submit buttons remain reachable with the keyboard open.

Acceptance criteria:
- On 320x568 and 375x667, every text input can be focused and submitted without hidden controls.

## Additional UX/Data Issues

### Home quick stats are hard-coded

References:
- `client/sequence-app/app/(main)/home.tsx:115-126`: quick stats render `0`, `0%`, and `0` rather than live profile stats.

Recommended fix:
- Bind quick stats to profile/stat store data or remove the stat cards until populated.

Acceptance criteria:
- Stats reflect real backend/profile data after load.
- Loading and empty states are visually distinct from real zero values.

### Splash color still uses old dark-blue theme

References:
- `client/sequence-app/app.config.ts:11-14`: splash background color is `#0a0e1a`.

Recommended fix:
- Update splash background to match the new felt/wood theme.

Acceptance criteria:
- Cold start does not flash the old visual theme before rendering the redesigned app.

## Follow-Up Test Coverage

Recommended tests to add next:
- Timer validation:
  - client UI only emits valid timer values.
  - Worker rejects invalid timer values from direct WebSocket requests.
- Client/server highlighted-cell parity:
  - valid card highlights match server move validation for normal cards, one-eyed jacks, and two-eyed jacks.
- Reconnect and room lifecycle:
  - reconnect after socket drop.
  - host leave/transfer behavior.
  - room closed behavior.
- Dead-card replacement:
  - valid replacement succeeds.
  - invalid replacement returns a visible error.
- Results and series:
  - game over navigates to results.
  - continue series and end series are available when configured.
- Cloudflare routes:
  - AASA returns valid JSON and correct app ID.
  - `/join/:code` returns expected fallback/deep-link HTML.
  - CORS preflight behavior is intentional and tested.
- iPhone UI smoke tests:
  - screenshot matrix for 320x568 through 440x956.
  - safe-area assertions for header, game board, hand tray, and bottom actions.

