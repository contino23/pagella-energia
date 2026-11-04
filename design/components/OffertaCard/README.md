# OffertaCard

La scheda di un'offerta: in un colpo d'occhio voto, risparmio annuo, spesa annua e rata mensile, con l'avviso su penali e costi extra.

## Struttura

1. Intestazione: posizione (`#1`), nome dell'offerta, tipo di prezzo ("Prezzo fisso 24 mesi", "Prezzo variabile, segue il PUN"); a destra il voto (`pe-grade`).
2. Tre riquadri `pe-figures`, sempre in quest'ordine: **Risparmi** (verde, `pe-figure-save`), **Spesa annua**, **Al mese**. Il risparmio è calcolato rispetto all'offerta attuale dell'utente; senza bolletta caricata il primo riquadro sparisce e restano due riquadri.
3. Una sola riga di stato, sempre presente: un `pe-alert-warn` se ci sono penali, depositi o costi extra; un `pe-alert-info` per le variabili; altrimenti la riga `pe-ok` "Nessuna penale, nessun costo extra". Penali e variabile insieme: prima l'arancio, poi il blu.

## Varianti

- `pe-card-top`: la prima della classifica, bordo `ink` da 2px; può aprire sotto Pagella e Il prezzo spiegato.
- Compatta (home, classifiche nazionali): una riga con nome e sottotitolo a sinistra, voto, spesa annua e al mese a destra.

## Regole

- Il nome è quello del Portale Offerte, ripulito da maiuscole gridate ("SCUDO 24 LUCE" diventa "Scudo 24 Luce").
- Non mostrare mai il risparmio senza la spesa annua accanto.
- Importi arrotondati all'euro; la rata mensile è la spesa annua divisa per 12.
