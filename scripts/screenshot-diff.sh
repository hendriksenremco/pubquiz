#!/usr/bin/env bash
# Vergelijkt de screenshots van master met die van een pull request (ImageMagick 6 of 7).
#
#   scripts/screenshot-diff.sh <map-master> <map-pr> <uitvoermap>
#
# Schrijft per veranderd of nieuw scherm een png naar <uitvoermap>: links master, rechts de
# pull request met de verschillen in amber. Daarnaast komt er <uitvoermap>/comment.md, het
# commentaar voor de pull request. Daarin staat {{URL}} waar de map met plaatjes moet komen.
#
# Kleine verschillen tellen niet: video's lopen door en lettertypen worden niet elke keer
# precies even zacht getekend. Bijstellen kan met FUZZ (kleurverschil) en MIN_PIXELS
# (minimaal aantal veranderde pixels).
set -euo pipefail

base=$1
pr=$2
out=$3
FUZZ=${FUZZ:-8%}
MIN_PIXELS=${MIN_PIXELS:-100}
AMBER='#ffa53d'

if command -v magick >/dev/null; then
  im() { magick "$@"; }
  compare_() { magick compare "$@"; }
  identify_() { magick identify "$@"; }
else
  im() { convert "$@"; }
  compare_() { compare "$@"; }
  identify_() { identify "$@"; }
fi

mkdir -p "$out"

# Alleen de screenshots van de tests zelf; in submappen staan de traces van gefaalde tests.
list() { [ -d "$1" ] && find "$1" -maxdepth 1 -name '*.png' -exec basename {} \; | sort || true; }
mapfile -t base_files < <(list "$base")
mapfile -t pr_files < <(list "$pr")

changed=()
added=()
removed=()
same=0

# Twee plaatjes naast elkaar, met een smalle witte strook ertussen.
side_by_side() {
  im "$1" \( -size 24x1 xc:white \) "$2" \
    -background white -gravity north +append "$3"
}

for name in "${pr_files[@]}"; do
  [ -n "$name" ] || continue
  if [ ! -f "$base/$name" ]; then
    added+=("$name")
    cp "$pr/$name" "$out/$name"
    continue
  fi
  old=$base/$name
  new=$pr/$name
  size_old=$(identify_ -format '%wx%h' "$old")
  size_new=$(identify_ -format '%wx%h' "$new")
  if [ "$size_old" != "$size_new" ]; then
    changed+=("$name|afmeting $size_old → $size_new")
    side_by_side "$old" "$new" "$out/$name"
    continue
  fi
  # compare geeft exitcode 1 bij verschillen; het aantal pixels staat op stderr.
  work=$(mktemp -d)
  pixels=$(compare_ -metric AE -fuzz "$FUZZ" -highlight-color white -lowlight-color black \
    -compose src "$old" "$new" "$work/mask.png" 2>&1 >/dev/null || true)
  pixels=${pixels%%[^0-9.e+]*}
  pixels=$(printf '%.0f' "${pixels:-0}")
  if [ "$pixels" -lt "$MIN_PIXELS" ]; then
    same=$((same + 1))
  else
    # Losse pixels zie je niet: maak er vlakken van, licht amber gekleurd en met een amber rand.
    im "$work/mask.png" -colorspace gray -morphology Dilate Disk:8 "$work/region.png"
    im "$work/region.png" -morphology EdgeOut Disk:2 "$work/edge.png"
    im "$new" \
      \( -size "$size_new" xc:"$AMBER" \( "$work/region.png" -evaluate multiply 0.3 \) \
      -alpha off -compose copy_opacity -composite \) -compose over -composite \
      \( -size "$size_new" xc:"$AMBER" "$work/edge.png" -alpha off -compose copy_opacity -composite \) \
      -compose over -composite "$work/marked.png"
    side_by_side "$old" "$work/marked.png" "$out/$name"
    changed+=("$name|$pixels pixels")
  fi
  rm -rf "$work"
done

for name in "${base_files[@]}"; do
  [ -n "$name" ] || continue
  [ -f "$pr/$name" ] || removed+=("$name")
done

total=${#pr_files[@]}
[ -n "${pr_files[0]:-}" ] || total=0
{
  echo '<!-- pr-screenshots -->'
  echo '### Screenshots'
  echo
  if [ "$total" -eq 0 ]; then
    echo 'Deze pull request heeft geen screenshots opgeleverd. Kijk in de e2e-tests wat er misging.'
  elif [ ${#changed[@]} -eq 0 ] && [ ${#added[@]} -eq 0 ] && [ ${#removed[@]} -eq 0 ]; then
    echo "Geen verschillen met master in de $total screenshots."
  else
    echo "Van de $total screenshots zijn er ${#changed[@]} veranderd, ${#added[@]} nieuw en ${#removed[@]} verdwenen; $same zijn gelijk."
  fi
  if [ ${#changed[@]} -gt 0 ]; then
    echo
    echo '#### Veranderd'
    echo
    echo 'Links master, rechts deze pull request. De verschillen zijn amber.'
    for entry in "${changed[@]}"; do
      name=${entry%%|*}
      echo
      echo "**$name** (${entry#*|})"
      echo
      echo "![$name]({{URL}}/$name)"
    done
  fi
  if [ ${#added[@]} -gt 0 ]; then
    echo
    echo '#### Nieuw'
    for name in "${added[@]}"; do
      echo
      echo "**$name**"
      echo
      echo "![$name]({{URL}}/$name)"
    done
  fi
  if [ ${#removed[@]} -gt 0 ]; then
    echo
    echo '#### Verdwenen'
    echo
    for name in "${removed[@]}"; do echo "- $name"; done
  fi
  echo
  echo "<sub>Kleine verschillen tellen niet mee (fuzz $FUZZ, minder dan $MIN_PIXELS pixels). Een scherm dat alleen bij master ontbreekt, kan ook een test zijn die daar faalde.</sub>"
} >"$out/comment.md"

cat "$out/comment.md"
