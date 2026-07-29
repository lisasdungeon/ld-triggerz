#!/usr/bin/env bash
set -euo pipefail

# Build a clean release zip for LD Triggerz.
# The zip is written to ../../zips/ld-triggerz-<version>.zip.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$MODULE_DIR/.." && pwd)"
ZIPS_DIR="$ROOT_DIR/../zips"

VERSION="$(node -p "require('$MODULE_DIR/module.json').version")"
ZIP_NAME="ld-triggerz-${VERSION}.zip"
ZIP_PATH="$ZIPS_DIR/$ZIP_NAME"

echo "Building LD Triggerz release v$VERSION..."

mkdir -p "$ZIPS_DIR"
rm -f "$ZIP_PATH"

cd "$MODULE_DIR"
zip -r "$ZIP_PATH" \
  module.json \
  main.js \
  README.md \
  LICENSE \
  CHANGELOG.md \
  src \
  styles \
  templates \
  lang \
  -x "*/.*" \
  -x "*/tests/*" \
  -x "*/scripts/*" \
  -x "*/docs/*" \
  -x "package.json" \
  -x "*.zip"

echo "Release zip created: $ZIP_PATH"
