#!/usr/bin/env bash
# Package the Samsung Tizen widget with the SERAPH UI inside.
#   TIZEN_PROFILE=seraph ./tizen/build.sh
# Needs the Tizen CLI (Tizen Studio) for a signed .wgt; without it you get an unsigned zip.
set -euo pipefail
cd "$(dirname "$0")"

(cd ../web && bun install --frozen-lockfile >/dev/null && bun run build >/dev/null)

OUT=build/widget
rm -rf build && mkdir -p "$OUT"
cp -r ../web/build/. "$OUT/"
cp config.xml icon.png "$OUT/"
# Samsung's webapis (network IP for LAN discovery, screensaver control) only exist when this
# script is included; it's served by the TV itself, so add it to the widget build only.
# Only the first </head>: a later one sits inside a JavaScript string (SvelteKit's error page).
sed -i.bak '0,/<\/head>/s##<script src="$WEBAPIS/webapis/webapis.js"></script></head>#' "$OUT/index.html" && rm -f "$OUT/index.html.bak"

if command -v tizen >/dev/null 2>&1; then
  tizen package -t wgt -s "${TIZEN_PROFILE:-seraph}" -- "$OUT" -o build
  echo "Signed widget: $(ls build/*.wgt)"
else
  (cd "$OUT" && zip -qr ../SERAPH-unsigned.wgt .)
  echo "Tizen CLI not found → tizen/build/SERAPH-unsigned.wgt (sign it before installing; see README)."
fi
