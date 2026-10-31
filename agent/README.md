# QuizNote-agent

Een Claude-sessie die elke nacht zelf aan QuizNote werkt, op de thuisserver (Ubuntu). Wat hij per run doet, staat in [`prompt.md`](prompt.md).

- Hij kiest het volgende **[Claude]**-punt uit `TODO.md`, of pakt eerst zijn eigen pull requests op (falende CI, commentaar van Remco).
- Hij werkt op een branch `agent/…` en opent een pull request met het label `agent`. Samenvoegen doet Remco.
- Moet Remco iets beslissen, dan opent hij een issue met het label `vraag`.
- De e2e-tests en de build draaien niet op de server maar in GitHub Actions op macOS (`.github/workflows/ci.yml`).

## Eenmalig inrichten op de server

Nodig: `git`, Node 22, pnpm 8, de GitHub CLI (`gh`) en Claude Code, ingelogd.

```sh
# 1. GitHub: een fine-grained token met alleen toegang tot hendriksenremco/pubquiz
#    (Contents, Pull requests en Issues: read and write).
gh auth login
gh auth setup-git

# 2. De clone voor de agent, en de labels.
mkdir -p ~/quiznote-agent
gh repo clone hendriksenremco/pubquiz ~/quiznote-agent/pubquiz
cd ~/quiznote-agent/pubquiz
gh label create agent --color 1f6feb --description "Werk van de QuizNote-agent" || true
gh label create vraag --color ffa53d --description "Vraag van de agent aan Remco" || true

# 3. De timer (elke nacht om 02:17), ook als je niet ingelogd bent.
mkdir -p ~/.config/systemd/user
cp agent/quiznote-agent.service agent/quiznote-agent.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now quiznote-agent.timer
sudo loginctl enable-linger "$USER"
```

## Gebruik

```sh
systemctl --user start quiznote-agent    # nu één run
systemctl --user list-timers             # wanneer de volgende run is
ls ~/quiznote-agent/logs/                # wat hij deed
systemctl --user disable --now quiznote-agent.timer   # stoppen
```

De clone in `~/quiznote-agent/pubquiz` is alleen voor de agent: elke run zet hem terug op `master`. Werk er zelf niet in.
