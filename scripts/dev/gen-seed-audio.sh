#!/bin/zsh
# Erzeugt SYNTHETISCHE Demo-Musik für die Kür-Seeds.
# Bewusst KEINE echten Aufnahmen der im Seed genannten Werke (Urheberrecht) —
# das hier sind eigene, generierte Arpeggien, nur als Demo-Ton.
set -eu
OUT="$1"
mkdir -p "$OUT"

# name|dauer_s|f1|f2|f3|f4|notenlaenge
ROWS=(
  "seed-routine-feuervogel|150|261.63|329.63|392.00|523.25|0.40"
  "seed-routine-mondlicht|165|220.00|261.63|329.63|440.00|0.55"
  "seed-routine-sommerregen|138|293.66|349.23|440.00|587.33|0.35"
  "seed-routine-tanz-der-funken|172|246.94|311.13|369.99|493.88|0.32"
  "seed-routine-kleine-welle|120|196.00|246.94|293.66|392.00|0.50"
  "seed-routine-nordwind|158|233.08|277.18|349.23|466.16|0.30"
)

for row in "${ROWS[@]}"; do
  IFS='|' read -r name dur f1 f2 f3 f4 s <<< "$row"
  # 4-Ton-Arpeggio, 10 ms Attack (kein Klicken) + exponentielles Abklingen.
  n="mod(floor(t/${s}),4)"
  freq="if(eq(${n},0),${f1},if(eq(${n},1),${f2},if(eq(${n},2),${f3},${f4})))"
  env="min(1,mod(t,${s})/0.01)*exp(-2.2*mod(t,${s}))"
  expr="0.32*${env}*sin(2*PI*(${freq})*t)"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "aevalsrc=exprs='${expr}':s=22050:d=${dur}" \
    -c:a libmp3lame -b:a 32k -ac 1 \
    "${OUT}/${name}.mp3"
  echo "$(stat -f%z "${OUT}/${name}.mp3") ${name}.mp3"
done
