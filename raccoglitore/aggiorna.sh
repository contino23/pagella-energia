#!/usr/bin/env bash
# Un giro di aggiornamento. Esce con 0 anche se i dati di oggi erano già pubblicati.
set -euo pipefail
: "${GITHUB_TOKEN:?Manca GITHUB_TOKEN (token con permesso Contents: read and write sul solo repository)}"
REPO_DIR="$CARTELLA/repo"
log() { echo "[$(date '+%F %T')] $*"; }
# Il token non viene mai scritto su disco: passa solo come intestazione delle chiamate git.
AUTH="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"
g() { git -c "http.https://github.com/.extraheader=$AUTH" "$@"; }

if [ ! -d "$REPO_DIR/.git" ]; then
  log "Prima esecuzione: scarico il repository $REPO"
  g clone --depth 50 "https://github.com/$REPO.git" "$REPO_DIR"
fi
cd "$REPO_DIR"
g fetch --depth 50 origin main
git reset -q --hard origin/main
git clean -qfdx -e node_modules

# Il token vale ancora e può scrivere? (push di prova: non cambia niente nel repository)
if ! g push --dry-run -q origin HEAD:main 2>/dev/null; then
  log "ERRORE: GitHub rifiuta il token (scaduto, revocato o senza permesso Contents: Read and write)"
  exit 1
fi

log "Dipendenze"
npm ci --no-audit --no-fund --loglevel=error

log "Download dal Portale Offerte"
OUT=$(npm run -s scarica)
echo "$OUT"
DATA=$(echo "$OUT" | sed -n 's/^Data dei file: //p' | tail -1)
[ -n "$DATA" ] || { log "Data dei file non trovata"; exit 1; }

if [ -d "data/fotografie/$DATA" ] && git diff --quiet -- data/indici; then
  log "Dati del $DATA già pubblicati: niente da fare"
  date +%s > "$CARTELLA/ultimo-ok"
  exit 0
fi

if [ ! -d "data/fotografie/$DATA" ]; then
  log "Fotografia del $DATA"
  npm run -s leggi -- "../data/raw/$DATA" ../data/fotografie
fi
log "Controlli"
npm test --silent
npm run -s dati-web >/dev/null

git add data/fotografie data/indici
git -c user.name="pagella-energia-bot" -c user.email="pagella-energia-bot@users.noreply.github.com" commit -q -m "Dati del $DATA"
g push -q origin HEAD:main
rm -rf data/raw
date +%s > "$CARTELLA/ultimo-ok"
log "Pubblicati i dati del $DATA"
