# Raccoglitore dei dati di Pagella Energia: ogni giorno scarica i file del Portale Offerte,
# crea la fotografia, controlla i calcoli e pubblica i dati nel repository GitHub.
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates curl tzdata \
 && rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Rome \
    REPO=contino23/pagella-energia \
    ORARI="09:20 14:20" \
    CARTELLA=/dati
COPY aggiorna.sh pianifica.sh prova.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh && mkdir -p /dati && chown node:node /dati
USER node
VOLUME /dati
# Sano se l'ultimo aggiornamento riuscito ha meno di 36 ore (o se non è ancora mai partito).
HEALTHCHECK --interval=30m --timeout=10s --start-period=48h \
  CMD test -f /dati/ultimo-ok && [ $(( $(date +%s) - $(cat /dati/ultimo-ok) )) -lt 129600 ]
CMD ["pianifica.sh"]
