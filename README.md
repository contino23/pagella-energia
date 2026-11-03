# Pagella Energia

Confronto neutrale e gratuito delle offerte luce e gas del mercato libero italiano,
costruito sui dati aperti del Portale Offerte (ARERA / Acquirente Unico).
Nessuna commissione dai venditori, nessun account richiesto.

## Struttura

```
packages/core   modello dati e tabelle dei codici, condivisi da pipeline, sito e app
pipeline/       lettura quotidiana dei file open data e creazione dello storico
data/raw/       file originali scaricati dal Portale (non versionati)
data/fotografie una cartella per giorno: offerte normalizzate, manifest, report qualità
docs/           documentazione ufficiale di riferimento
```

## Uso

```bash
npm install
npm test                                              # test del lettore
npm run leggi -- ../data/raw/2026-11-03 ../data/fotografie
```

Il lettore produce, per ogni giorno:

- `offerte.json.gz`: tutte le offerte normalizzate più i parametri regolati;
- `manifest.json`: file di origine con impronta SHA-256, conteggi, versione del lettore;
- `qualita.json`: anomalie trovate nei dati (codici sconosciuti, offerte incomplete…).

Il lettore non si ferma mai per un dato inatteso: lo conserva e lo segnala nel report.
Esce con errore solo se manca un file essenziale o un file è vuoto.

## Codici del tracciato

Ogni voce in `packages/core/src/codici.ts` indica la propria fonte:

- `regole`: "Regole per il calcolo della Spesa" v3.02 (Acquirente Unico, dicembre 2022);
- `manuale`: Manuale operativo di compilazione delle offerte (2018);
- `dedotto`: ricavato dai dati, da confermare.

## Fonte e licenza dei dati

Dati: Portale Offerte, sezione Open Data, riuso libero citando la fonte "Portale Offerte".
Si usano solo i file della sezione Open Data, mai le pagine o le API interne del Portale.

Codice: AGPL-3.0-or-later.
