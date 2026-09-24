#!/bin/sh
# Gera dist/baixar-audio-drive-<versão>.zip, pronto para a Chrome Web Store.
set -e
cd "$(dirname "$0")/.."
VERSAO=$(node -p "require('./extensao/manifest.json').version")
mkdir -p dist
rm -f "dist/baixar-audio-drive-$VERSAO.zip"
(cd extensao && zip -qr "../dist/baixar-audio-drive-$VERSAO.zip" .)
echo "dist/baixar-audio-drive-$VERSAO.zip"
