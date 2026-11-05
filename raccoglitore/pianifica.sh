#!/usr/bin/env bash
# Esegue aggiorna.sh agli orari in $ORARI (ora italiana) e, se ESEGUI_SUBITO=1, anche all'avvio.
# Se KUMA_PUSH_URL è impostato, dopo ogni giro avvisa Uptime Kuma (up se riuscito, down se fallito).
set -uo pipefail
log() { echo "[$(date '+%F %T')] $*"; }

avvisa() {
  [ -n "${KUMA_PUSH_URL:-}" ] || return 0
  curl -fsS -m 15 -o /dev/null -G "${KUMA_PUSH_URL%%\?*}" \
    --data-urlencode "status=$1" --data-urlencode "msg=$2" --data-urlencode "ping=" \
    || log "Avviso a Uptime Kuma non inviato"
}

giro() {
  aggiorna.sh 2>&1 | tee "$CARTELLA/ultimo-giro.log"
  local esito=${PIPESTATUS[0]}
  local ultima; ultima=$(grep -v '^\s*$' "$CARTELLA/ultimo-giro.log" | tail -1 | sed 's/^\[[^]]*\] //' | cut -c1-200)
  if [ "$esito" -eq 0 ]; then
    avvisa up "$ultima"
  else
    log "Giro non riuscito: riprovo al prossimo orario"
    avvisa down "Giro non riuscito: $ultima"
  fi
}

[ "${ESEGUI_SUBITO:-0}" = "1" ] && giro
while true; do
  ora=$(date +%s); prossimo=""
  for o in $ORARI; do
    t=$(date -d "today $o" +%s); [ "$t" -le "$ora" ] && t=$(date -d "tomorrow $o" +%s)
    if [ -z "$prossimo" ] || [ "$t" -lt "$prossimo" ]; then prossimo=$t; fi
  done
  log "Prossimo giro: $(date -d "@$prossimo" '+%F %H:%M')"
  sleep $(( prossimo - ora ))
  giro
done
