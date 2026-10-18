#!/usr/bin/env bash
# Rasterise an SVG at 2x with headless Chrome: to-png.sh in.svg out.png
set -euo pipefail
in="$1"; out="$2"
read -r W H < <(grep -o 'width="[0-9]*" height="[0-9]*"' "$in" | head -1 | tr -dc '0-9 \n' | awk '{print $1, $2}')
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --default-background-color=00000000 \
  --window-size="$W,$H" --screenshot="$out" "file://$(cd "$(dirname "$in")" && pwd)/$(basename "$in")" >/dev/null 2>&1
echo "$out"
