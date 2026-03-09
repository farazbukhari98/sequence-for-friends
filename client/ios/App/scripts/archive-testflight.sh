#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/App.xcodeproj"
SCHEME="App"
ARCHIVE_PATH="${ARCHIVE_PATH:-/tmp/SequenceForFriends.xcarchive}"
EXPORT_PATH="${EXPORT_PATH:-/tmp/SequenceForFriendsExport}"
EXPORT_OPTIONS_PLIST="${EXPORT_OPTIONS_PLIST:-$ROOT_DIR/../ExportOptions.plist}"
TEAM_ID="${TEAM_ID:-469Q8Z675Y}"

echo "Archiving $SCHEME from $PROJECT_PATH"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  -destination "generic/platform=iOS" \
  archive

echo "Exporting archive to $EXPORT_PATH"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -allowProvisioningUpdates

echo "Archive complete."
echo "Archive: $ARCHIVE_PATH"
echo "Export:  $EXPORT_PATH"
