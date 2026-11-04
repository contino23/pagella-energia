#!/usr/bin/env bash
# Prova se questa rete può scaricare dal Portale Offerte (200 = sì, 403 = rete bloccata).
codice=$(curl -s -o /dev/null -w '%{http_code}' -m 30 -A "PagellaEnergia/0.1 (+https://github.com/contino23/pagella-energia)" \
  https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page)
case "$codice" in
  200) echo "OK ($codice): da qui il Portale si scarica. Il raccoglitore può girare su questa macchina." ;;
  403) echo "BLOCCATO ($codice): il Portale rifiuta questa rete (di solito perché è un datacenter)." ; exit 1 ;;
  *)   echo "RISPOSTA INATTESA ($codice): controlla la connessione e riprova." ; exit 2 ;;
esac
