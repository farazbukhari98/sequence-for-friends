# SwiftUI Parity Matrix

This file is the migration baseline for the native iOS rewrite. The browser client remains the UX reference until every row below is green.

| Area | Reference Source | Native Status | Notes |
| --- | --- | --- | --- |
| App startup | `client/src/App.tsx` | In progress | SwiftUI runtime path now replaces the Capacitor startup path. |
| Auth | `client/src/hooks/useAuth.ts`, `redesign/components/AuthScreen.tsx` | In progress | Native Apple sign-in flow is wired to the same `/api/auth/apple` contract, with reinstall-safe local reset logic added. |
| Onboarding | `redesign/components/OnboardingScreen.tsx` | In progress | Native avatar picker, registration flow, and username availability checks are wired. |
| Home | `redesign/components/HomeScreen.tsx` | In progress | Create room, join room, and bot game flows are wired natively. |
| Profile | `redesign/components/ProfileScreen.tsx` | In progress | Profile load/update and sign-out are wired natively. |
| Friends | `redesign/components/FriendsScreen.tsx` | In progress | Search, request, accept, reject, and remove flows are wired natively. |
| Lobby | `redesign/components/LobbyScreen.tsx` | In progress | Room display, ready/start, team-switch approval, kick controls, add-bot shortcuts, and room settings are wired natively. |
| Game | `redesign/components/GameScreen.tsx` | In progress | Native board/hand/action shell is in place, with turn timer, disconnect banner, bounded recovery overlay, dead-card replacement CTA, and improved action-step guidance added. |
| Replay / Winner | `redesign/components/ReplayBoard.tsx`, `GameScreen.tsx` | In progress | Native cut-card modal, sequence celebration, winner modal, series countdown, score recap, and bot replay flow are now wired; visual/device parity still needs validation. |
| Deep links | `client/src/App.tsx`, `worker/src/index.ts` | In progress | Custom scheme and universal link parsing are wired to native routing. |
| Push | `client/src/hooks/usePush.ts` | In progress | APNs registration path is native, and permission is now user-triggered instead of requested on launch. |
| Reconnect | `client/src/hooks/useSocket.ts`, `lib/reconnect.ts` | In progress | Stored room session, offline-aware recovery state, and bounded reconnect retries are native; full device validation remains. |
| Stability | `client/src/hooks/useAuth.ts`, `client/src/hooks/useSocket.ts`, `worker/src/room-do.ts` | In progress | Reinstall-safe auth reset and stale disconnect-skip timer fixes are implemented, but still need physical-device regression validation. |
| Capacitor cleanup | `client/ios/App`, `client/package.json` | In progress | The iOS target no longer links `CapApp-SPM` or the old Sign in with Apple bridge plugin; remaining web-side Capacitor packages still exist for the browser reference client. |

## Acceptance Gates

- No row is marked complete until manual device validation matches the current browser behavior.
- The existing worker contract stays unchanged during this migration.
- Capacitor/web dependencies are not removed from the iOS target until all rows needed for release are green.
