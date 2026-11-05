#!/usr/bin/env bash
# Corrige MODULE_NOT_FOUND @ngrok/ngrok-linux-x64-gnu no eas build --local
# (optionalDependency some vezes nao instala no cache do npx).
set -euo pipefail

VER="${1:-27.4.1}"
NPX_ROOT="${HOME}/.npm/_npx"

echo "==> Preinstall eas-cli-local-build-plugin@${VER} + ngrok linux x64"
tmpdir=$(mktemp -d)
cd "$tmpdir"
npm init -y >/dev/null 2>&1
npm install --no-fund --no-audit \
  "eas-cli-local-build-plugin@${VER}" \
  "@ngrok/ngrok-linux-x64-gnu@1.7.0"

# Espalha o native package em todos os caches npx que ja tem @ngrok/ngrok
if [[ -d "$NPX_ROOT" ]]; then
  while IFS= read -r ngrok_dir; do
    parent="$(dirname "$ngrok_dir")"
    if [[ ! -d "$parent/ngrok-linux-x64-gnu" ]]; then
      echo "patch $parent"
      cp -a "$tmpdir/node_modules/@ngrok/ngrok-linux-x64-gnu" "$parent/"
    fi
  done < <(find "$NPX_ROOT" -type d -path '*/node_modules/@ngrok/ngrok' 2>/dev/null)
fi

node -e "require('${tmpdir}/node_modules/@ngrok/ngrok'); console.log('ngrok OK')"
echo "==> OK. Rode:"
echo "    cd $(cd "$(dirname "$0")/.." && pwd)"
echo "    eas build --platform android --profile production --local"
