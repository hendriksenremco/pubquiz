#!/usr/bin/env bash
# Draait de QuizNote-agent één keer. De systemd-service start hem steeds opnieuw; zie agent/README.md.
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
# Vast model: het standaardmodel op de server kan extra tegoed vragen.
claude -p "$(cat agent/prompt.md)" \
  --model opus \
  --permission-mode auto \
  --permission-prompts none \
  >"$LOG" 2>&1 || echo "De run is mislukt; zie $LOG" >&2

# Gebruikslimiet van Claude bereikt? Meld het één keer als issue en wacht tot de volgende run.
# Lukt een run weer, dan gaat dat issue vanzelf dicht.
LIMIT_TITLE="Agent: gebruikslimiet van Claude bereikt"
LIMIT_ISSUE="$(gh issue list --state open --search "\"$LIMIT_TITLE\" in:title" --json number -q '.[0].number' 2>/dev/null || true)"
if grep -qiE 'usage limit|rate limit|limit reached|requires usage credits|out of (usage|credits)' "$LOG"; then
  if [ -z "$LIMIT_ISSUE" ]; then
    gh issue create --title "$LIMIT_TITLE" --label vraag \
      --body "De run van $(date '+%-d %B %Y %H:%M') stopte op de gebruikslimiet van Claude. De agent probeert het bij de volgende run opnieuw en sluit dit issue zodra het weer lukt. Melding: $(grep -iE -m1 'limit|credits' "$LOG")" >/dev/null
  fi
elif [ -n "$LIMIT_ISSUE" ]; then
  gh issue close "$LIMIT_ISSUE" --comment "De run van $(date '+%-d %B %Y %H:%M') lukte weer." >/dev/null
fi

# Logs van meer dan 30 dagen weg.
find "$DIR/logs" -name '*.log' -mtime +30 -delete

# De agent draait doorlopend: systemd start meteen een nieuwe run zodra deze klaar is.
# Wacht eerst als er geen ruimte of geen werk is, zodat hij de limiet niet opstookt.
if grep -qiE 'usage limit|rate limit|limit reached|requires usage credits|out of (usage|credits)' "$LOG"; then
  sleep "${QUIZNOTE_AGENT_PAUSE_LIMIT:-3600}"     # gebruikslimiet: een uur
elif grep -q 'GEEN WERK' "$LOG"; then
  sleep "${QUIZNOTE_AGENT_PAUSE_IDLE:-3600}"      # niets te doen: een uur
elif grep -q 'WACHT OP CI' "$LOG"; then
  sleep "${QUIZNOTE_AGENT_PAUSE_CI:-600}"         # CI loopt nog: tien minuten
else
  sleep "${QUIZNOTE_AGENT_PAUSE:-60}"
fi
