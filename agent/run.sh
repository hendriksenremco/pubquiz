#!/usr/bin/env bash
# Draait de QuizNote-agent één keer. Wordt gestart door de systemd-timer; zie agent/README.md.
set -euo pipefail

DIR="${QUIZNOTE_AGENT_DIR:-$HOME/quiznote-agent}"
REPO="$DIR/pubquiz"
mkdir -p "$DIR/logs"
LOG="$DIR/logs/$(date +%F_%H%M).log"

# Het GitHub-token van de agent staat in een eigen bestand. Zo blijft de gewone
# GitHub-login van de server (gh, git) onaangeroerd.
TOKEN_FILE="${QUIZNOTE_AGENT_TOKEN:-$HOME/.config/quiznote-agent/github-token}"
[ -r "$TOKEN_FILE" ] || { echo "Geen token in $TOKEN_FILE" >&2; exit 1; }
export GH_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
export GH_CONFIG_DIR="$DIR/gh"   # eigen gh-instellingen, los van ~/.config/gh

# Nooit twee runs tegelijk.
exec 9>"$DIR/.lock"
flock -n 9 || { echo "De agent draait al." >&2; exit 0; }

# Deze clone is alleen voor de agent: elke run begint schoon vanaf master.
[ -d "$REPO/.git" ] || git -c credential.helper= -c 'credential.helper=!gh auth git-credential' \
  clone https://github.com/hendriksenremco/pubquiz.git "$REPO"
cd "$REPO"
# Alleen in deze clone gebruikt git het token van de agent.
git config credential.helper ''
git config --add credential.helper '!gh auth git-credential'
git remote set-url origin https://github.com/hendriksenremco/pubquiz.git
git fetch --prune origin
git checkout -q -f master
git reset -q --hard origin/master
git clean -qfd -e node_modules
pnpm install --frozen-lockfile >/dev/null

unset ELECTRON_RUN_AS_NODE
claude -p "$(cat agent/prompt.md)" \
  --permission-mode auto \
  --permission-prompts none \
  >"$LOG" 2>&1 || echo "De run is mislukt; zie $LOG" >&2

# Logs van meer dan 30 dagen weg.
find "$DIR/logs" -name '*.log' -mtime +30 -delete
