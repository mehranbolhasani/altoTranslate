#!/usr/bin/env bash
#
# build-zip.sh — Package Alto Translate into a Chrome Web Store-ready ZIP.
#
# Reads the version from manifest.json, copies an explicit include list into a
# staging directory, strips dev-only artifacts (the live-reload script tags and
# the localhost CSP entry), then writes dist/alto-translate-v{VERSION}.zip.
# Missing files print a warning but do not abort (the file structure may evolve).

set -u

# --- Locate repo root (this script lives in scripts/) -------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# --- Read version from manifest.json ------------------------------------------
# Prefer jq; fall back to grep+sed if jq is not installed.
if command -v jq >/dev/null 2>&1; then
  VERSION=$(jq -r '.version' manifest.json 2>/dev/null)
else
  VERSION=$(grep -E '"version"[[:space:]]*:' manifest.json \
            | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' \
            | head -1)
fi

if [ -z "${VERSION:-}" ]; then
  echo "Error: could not read version from manifest.json" >&2
  exit 1
fi

echo "Building Alto Translate v${VERSION}..."

OUTFILE="dist/alto-translate-v${VERSION}.zip"
STAGE_DIR="dist/.stage"

# --- Prepare dist/ + clean staging dir ----------------------------------------
mkdir -p dist
rm -f "$OUTFILE"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

# --- Explicit include list ----------------------------------------------------
# Each entry is a path relative to repo root. This is intentionally explicit
# (no `zip -r .`) so we know exactly what ships to the Web Store.
INCLUDE=(
  manifest.json
  privacy.html

  icons/icon16.png
  icons/icon48.png
  icons/icon128.png
  icons/icon.svg

  background/background.js

  content/content.js
  content/content.css

  options/options.html
  options/options.mjs
  options/options.css

  onboarding/onboarding.html
  onboarding/onboarding.mjs
  onboarding/onboarding.css

  vocabulary/vocabulary.html
  vocabulary/vocabulary.mjs
  vocabulary/vocabulary.css

  utils/constants.js
  utils/languages.js
  utils/error-messages.js
  utils/themes.js
  utils/mymemory_infer_source.js
  utils/selection_context.js
  utils/api-alto-cloud.js
  utils/api-gemini.js
  utils/api-deepl.js
  utils/api-azure.js
  utils/api-libretranslate.js
  utils/dark-mode.js
  utils/storage.js
  utils/alto-select.js
  utils/tailwind.css

  vendor/motion-lib.js
)

# Add all woff2 fonts (glob). nullglob makes the array empty if none match.
shopt -s nullglob
FONT_FILES=(utils/fonts/*.woff2)
shopt -u nullglob

# --- Copy into staging, warn for each missing path ----------------------------
EXISTING=()
MISSING=0
copy_if_exists() {
  local path="$1"
  if [ -e "$path" ]; then
    mkdir -p "$STAGE_DIR/$(dirname "$path")"
    cp -p "$path" "$STAGE_DIR/$path"
    EXISTING+=("$path")
  else
    echo "  ! Warning: missing '$path' — skipping" >&2
    MISSING=$((MISSING + 1))
  fi
}

for path in "${INCLUDE[@]}"; do
  copy_if_exists "$path"
done
for path in "${FONT_FILES[@]:-}"; do
  [ -n "$path" ] && copy_if_exists "$path"
done

if [ "${#EXISTING[@]}" -eq 0 ]; then
  echo "Error: no files to package." >&2
  exit 1
fi

# --- Strip dev-only artifacts from the staged copy ----------------------------
# These exist for local live-reload only and must not ship to the Web Store.
STRIP_HTML=(
  options/options.html
  onboarding/onboarding.html
  vocabulary/vocabulary.html
)
for f in "${STRIP_HTML[@]}"; do
  if [ -f "$STAGE_DIR/$f" ]; then
    # Remove any <script ...> line referencing dev-reload.js.
    sed -i.bak '/dev-reload\.js/d' "$STAGE_DIR/$f" && rm -f "$STAGE_DIR/$f.bak"
  fi
done

# Remove the dev-only localhost entry from connect-src in the staged manifest.
if [ -f "$STAGE_DIR/manifest.json" ]; then
  sed -i.bak 's# http://localhost:\*##g' "$STAGE_DIR/manifest.json" && rm -f "$STAGE_DIR/manifest.json.bak"
fi

# --- Zip from inside the staging dir so paths stay relative -------------------
# -X : discard extra file attributes (keeps the archive clean & portable)
# -q : quiet (no per-file progress). Directory structure is preserved.
( cd "$STAGE_DIR" && zip -X -q "$ROOT_DIR/$OUTFILE" "${EXISTING[@]}" )

# Drop the staging dir once the zip is written.
rm -rf "$STAGE_DIR"

if [ ! -f "$OUTFILE" ]; then
  echo "Error: zip creation failed." >&2
  exit 1
fi

# --- Summary ------------------------------------------------------------------
# `unzip -l` ends with a summary line like "   47 files" — grab the count.
FILE_COUNT=$(unzip -l "$OUTFILE" | awk '/[0-9]+ files$/ {print $(NF-1); exit}')
SIZE=$(du -h "$OUTFILE" | cut -f1)

echo "✓ Created ${OUTFILE}"
echo "✓ ${FILE_COUNT} files, ${SIZE}"
[ "$MISSING" -gt 0 ] && echo "  ($MISSING file(s) were missing and skipped)" >&2

exit 0
