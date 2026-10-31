# QuizNote-agent

Een Claude-sessie die doorlopend zelf aan QuizNote werkt, op de thuisserver (Ubuntu). Wat hij per run doet, staat in [`prompt.md`](prompt.md).

- Hij kiest het volgende **[Claude]**-punt uit `TODO.md`, of pakt eerst zijn eigen pull requests op (falende CI, commentaar van Remco).
- Hij werkt op een branch `agent/…` en opent een pull request met het label `agent`. Samenvoegen doet Remco.
- Moet Remco iets beslissen, dan opent hij een issue met het label `vraag`.
- De e2e-tests en de build draaien niet op de server maar in GitHub Actions op macOS (`.github/workflows/ci.yml`).

## Eenmalig inrichten op de server

Nodig: `git`, Node 22, pnpm 8, de GitHub CLI (`gh`) en Claude Code, ingelogd. `gh` hoeft niet ingelogd te zijn: de agent gebruikt zijn eigen token.

```sh
# 1. GitHub: een fine-grained token met alleen toegang tot hendriksenremco/pubquiz
#    (Contents, Issues en Pull requests: read and write; Actions en Commit statuses: read).
#    Het token staat in een eigen bestand; de gewone GitHub-login van de server blijft onaangeroerd.
umask 077; mkdir -p ~/.config/quiznote-agent
cat > ~/.config/quiznote-agent/github-token   # plak het token, Enter, Ctrl+D

# 2. De clone voor de agent, en de labels.
mkdir -p ~/quiznote-agent
git clone https://github.com/hendriksenremco/pubquiz.git ~/quiznote-agent/pubquiz
cd ~/quiznote-agent/pubquiz
export GH_TOKEN="$(cat ~/.config/quiznote-agent/github-token)"
gh label create agent --color 1f6feb --description "Werk van de QuizNote-agent" || true
gh label create vraag --color ffa53d --description "Vraag van de agent aan Remco" || true

# 3. De service: draait doorlopend, ook als je niet ingelogd bent.
mkdir -p ~/.config/systemd/user
cp agent/quiznote-agent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now quiznote-agent.service
sudo loginctl enable-linger "$USER"
```

## Gebruik

```sh
systemctl --user status quiznote-agent        # draait hij?
ls ~/quiznote-agent/logs/                     # wat hij deed
systemctl --user disable --now quiznote-agent # stoppen
```

De clone in `~/quiznote-agent/pubquiz` is alleen voor de agent: elke run zet hem terug op `master`. Werk er zelf niet in.
