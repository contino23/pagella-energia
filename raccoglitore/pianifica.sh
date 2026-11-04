#!/usr/bin/env bash
# Esegue aggiorna.sh agli orari in $ORARI (ora italiana) e, se ESEGUI_SUBITO=1, anche all'avvio.
set -uo pipefail
giro() { aggiorna.sh || echo "[$(date '+%F %T')] Giro non riuscito: riprovo al prossimo orario"; }
[ "${ESEGUI_SUBITO:-0}" = "1" ] && giro
while true; do
  ora=$(date +%s); prossimo=""
  for o in $ORARI; do
    t=$(date -d "today $o" +%s); [ "$t" -le "$ora" ] && t=$(date -d "tomorrow $o" +%s)
    if [ -z "$prossimo" ] || [ "$t" -lt "$prossimo" ]; then prossimo=$t; fi
  done
  echo "[$(date '+%F %T')] Prossimo giro: $(date -d "@$prossimo" '+%F %H:%M')"
  sleep $(( prossimo - ora ))
  giro
done
