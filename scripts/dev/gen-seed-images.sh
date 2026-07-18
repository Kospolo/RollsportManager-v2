#!/bin/zsh
# Erzeugt SYNTHETISCHE Demo-Bilder für die Kür-Seeds (Kür-Cover, Migration 0057).
# Bewusst KEINE Fotos — hier turnen KINDER; ein Seed-Bild darf niemals eine
# echte Person zeigen. Das sind rein generierte Farbverläufe mit Rauschen,
# analog zu scripts/dev/gen-seed-audio.sh für die Musik. Bewusst KLEIN gehalten
# (wenige KB): der Seed liegt im Repo, ein Cover ist nur Deko.
set -eu
OUT="$1"
mkdir -p "$OUT"

# name|farbe_oben|farbe_unten
ROWS=(
  "seed-routine-feuervogel-cover|0xB3320A|0xF2A007"
  "seed-routine-sommerregen-cover|0x1B4F72|0x7FB3D5"
)

for row in "${ROWS[@]}"; do
  IFS='|' read -r name c0 c1 <<< "$row"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "gradients=s=640x360:c0=${c0}:c1=${c1}:type=radial:d=1:n=2" \
    -frames:v 1 -update 1 \
    "${OUT}/${name}.png"
  echo "$(stat -f%z "${OUT}/${name}.png") ${name}.png"
done
