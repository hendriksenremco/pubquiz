#!/usr/bin/env bash
# Vindt werk in een clone dat niet op GitHub staat: commits die op geen enkele remote-branch staan,
# en wijzigingen die nog niet gecommit zijn. Zo blijft een mislukte push (zoals op 8 november 2026,
# toen het token niet naar pubquiz-site mocht schrijven) niet onopgemerkt op de server liggen.
#
#   agent/unpushed.sh <clone>                 schrijft per probleem één regel; niets = alles staat op GitHub
#   agent/unpushed.sh <clone> --bundle <map>  bewaart de niet-gepushte commits ook als git-bundle in <map>
#
# Kijkt alleen naar wat git al weet (geen fetch): run.sh haalt eerst op.
set -uo pipefail

repo="$1"
bundle_dir=""
[ "${2:-}" = "--bundle" ] && bundle_dir="${3:?map voor de bundle ontbreekt}"
[ -d "$repo/.git" ] || exit 0
name="$(basename "$repo")"

branches=()
while IFS= read -r branch; do
  count="$(git -C "$repo" rev-list --count "refs/heads/$branch" --not --remotes 2>/dev/null || echo 0)"
  if [ "$count" -gt 0 ]; then
    [ "$count" -eq 1 ] && what="1 commit op $branch staat" || what="$count commits op $branch staan"
    echo "$name: $what niet op GitHub"
    branches+=("refs/heads/$branch")
  fi
done < <(git -C "$repo" for-each-ref --format='%(refname:short)' refs/heads)

changed="$(git -C "$repo" status --porcelain --untracked-files=normal -- . ':(exclude)node_modules' 2>/dev/null | wc -l | tr -d ' ')"
if [ "$changed" -eq 1 ]; then
  echo "$name: 1 bestand met een wijziging die niet gecommit is"
elif [ "$changed" -gt 1 ]; then
  echo "$name: $changed bestanden met wijzigingen die niet gecommit zijn"
fi

# Een kopie van de commits, zodat ze een reset of een nieuwe clone overleven.
# Terughalen: git fetch <bundle> <branch>:<branch>
if [ -n "$bundle_dir" ] && [ "${#branches[@]}" -gt 0 ]; then
  mkdir -p "$bundle_dir"
  git -C "$repo" bundle create -q "$bundle_dir/$name-$(date +%F_%H%M).bundle" "${branches[@]}" --not --remotes \
    2>/dev/null || true
fi
exit 0
