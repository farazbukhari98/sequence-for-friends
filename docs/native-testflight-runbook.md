# Native TestFlight Runbook

Use this checklist before uploading any iOS build for internal or external TestFlight.

## Build

```bash
cd /Users/farazbukhari/Documents/SequenceForFriends/client/ios/App
./scripts/archive-testflight.sh
```

Current native candidate build number: `30`

## Automated Verification

- Run `npm test` from the repo root.
- Build the app for iOS Simulator from `client/ios/App/App.xcodeproj`.
- Confirm the app launches to the native auth flow without an automatic push permission prompt.

## Manual Device Gates

- Fresh install -> Sign in with Apple -> create room -> join room.
- Sign in -> delete app -> reinstall same build -> Sign in with Apple again.
- Join a live room, background the app, foreground it, and confirm it reattaches without a visible reconnect loop.
- Disable network during a live room, restore network, and confirm the app transitions through offline recovery without repeated reconnect banners.
- Tap a push invite and a universal link invite and confirm both route to the correct room code.

## Release Notes / Review Notes

- Explain that push permission is requested from an in-app prompt after sign-in, not on launch.
- Include “what to test” steps for creating a bot game so reviewers can validate the full game loop solo.
- Call out that the reconnect flow was hardened for background/foreground and transient network interruption recovery.
