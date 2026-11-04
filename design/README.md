# Pagella Energia

Pagella Energia dà un voto alla bolletta della luce e del gas e mostra le offerte per risparmiare. È un servizio gratuito per tutti: nessuna registrazione, nessuna email, nessuna commissione dai venditori. La bolletta viene letta sul dispositivo e non viene mai caricata su un server. I dati vengono dagli open data del Portale Offerte di ARERA.

Questo sistema vale per il sito e per l'app (iPhone e Android): stessi colori, stesso carattere, stessi componenti.

## Come parliamo

Parliamo come una persona competente che spiega a un amico: frasi brevi, dirette, in seconda persona ("tu").

- **Prima il numero, poi la spiegazione.** "Risparmi 334 € l'anno", non "Potresti ottenere un risparmio significativo".
- **Sempre anno e mese.** La spesa annua da sola è astratta: accanto c'è sempre la rata mensile.
- **Diciamo le cose scomode.** Penali, depositi, sconti solo iniziali vanno scritti in chiaro, nell'avviso arancio della scheda.
- **Dichiariamo le ipotesi.** Ogni stima porta la fonte e l'ipotesi usata: "Stima con PUN 0,182 €/kWh, media luglio–settembre 2026. Fonte: Portale Offerte ARERA".
- **Neutrali.** Nessun venditore viene lodato o criticato: parlano il voto e i motivi.
- No: superlativi, punti esclamativi, urgenza ("solo oggi!"), emoji, gergo di settore non spiegato. "Componente PCV" diventa "costi del venditore".

Formati: euro con il punto per le migliaia e il simbolo dopo, `1.166 €`; decimali con la virgola, `0,182 €/kWh`; voti con un decimale, `9,9` (il 10 senza decimali). Date per esteso: "3 novembre 2026".

Parole del servizio:

| Diciamo | Non diciamo |
| --- | --- |
| voto, pagella | punteggio, rating |
| spesa annua, al mese | costo stimato totale |
| penale di uscita | oneri di recesso anticipato |
| prezzo bloccato 24 mesi | prezzo fisso a durata determinata |
| segue il PUN / il PSV | indicizzato |

## Colori

Il fondo è sempre bianco (`surface`), il testo nero quasi puro (`ink`). Il colore ha tre compiti, e solo quelli.

1. **Luce e gas.** La luce è gialla (`luce`), il gas è blu (`gas`): ogni elemento che riguarda una delle due usa il suo colore e la sua icona, il fulmine o la fiamma. Le versioni chiare (`luce-tint`, `gas-tint`) fanno da fondo a etichette e intestazioni, con il testo in `on-luce` e `on-gas`. Il giallo pieno non va mai usato come colore del testo: si usa come fondo (il riquadro del risparmio, con testo `on-luce-strong`) o come icona su `ink`.
2. **Il giudizio.** Verde (`good`) per i voti da 6 in su e per le conferme; arancio (`warn`) per i voti sotto 6 e per gli avvisi su penali e costi extra. Sono colori di stato, non decorazione.
3. **L'informazione sul rischio.** Il blu chiaro (`info-tint` con `on-info`) segnala l'incertezza del prezzo delle offerte variabili. È diverso dall'arancio: non è un difetto dell'offerta, è un'informazione.

Arancio e blu si distinguono anche per luminosità, non solo per tinta. Ogni coppia testo/fondo indicata nei token supera 4,5:1.

## Carattere

Un solo carattere: **DM Sans** (Google Fonts), dal 400 all'800. Titoli in 800 con spaziatura leggermente stretta, testo in 400. Tutti i numeri usano le cifre tabellari (`font-variant-numeric: tabular-nums`), così spese e voti restano allineati in colonna. Il testo corrente non scende sotto 15px, le note sotto 12px.

## Spazi e forme

Scala di spaziatura a 4px (`space-1` … `space-12`). Raggi morbidi ma non tondi: `radius-sm` per i riquadri interni, `radius-md` per pulsanti e schede in app, `radius-lg` sul sito, `radius-pill` per etichette e filtri. Le schede si distinguono con un bordo `line` da 1,5px, non con ombre; la scheda in evidenza (la prima della classifica) ha il bordo `ink` da 2px.

Ogni elemento toccabile è alto almeno `touch-target` (44px). Una sola azione principale per schermata: il pulsante nero "Carica la bolletta".

## Icone

Icone lineari a tratto 2–2,4px, angoli e terminali arrotondati, disegnate in SVG nel colore del testo. Il set di base:

- **fulmine**: la luce (e il marchio)
- **fiamma**: il gas
- **spunta**: conferme ("Nessuna penale, nessun costo extra")
- **triangolo con punto esclamativo**: avviso arancio
- **freccia in salita**: avviso blu sul prezzo variabile
- **lucchetto**: la bolletta resta sul dispositivo

Nessuna emoji, nessuna illustrazione decorativa.

## Marchio

Il marchio provvisorio è un fulmine `luce` dentro una tessera quadrata `ink` con raggio 8px, seguito dalla scritta "Pagella Energia" in DM Sans 800. Non c'è ancora un file del logo: quando ci sarà, andrà nel gruppo Logos.

## Componenti

Ogni componente ha la sua scheda con le regole d'uso. In sintesi:

- **Scheda offerta**: nome, tipo di prezzo, voto e tre riquadri (Risparmi all'anno, Spesa annua, Al mese), poi un avviso o la riga di conferma. È il cuore del servizio.
- **Avviso**: arancio per penali e costi extra, blu per il rischio prezzo, riga verde quando non c'è nulla da segnalare.
- **Voto**: il numero e la barra a dieci segmenti.
- **Pagella**: le quattro voci con peso (Prezzo 60%, Vincoli 20%, Trasparenza 10%, Venditore 10%).
- **Risparmio**: il riquadro giallo con il risparmio della prima in classifica.
- **Selettore luce/gas**: etichette e schede per separare luce e gas.
- **Grafico indice**: PUN o PSV degli ultimi 12 mesi, con evidenziati i 3 mesi usati per il voto.
- **Pulsante**: primario nero, secondario con bordo.

## Dati e onestà

Ogni pagina che mostra stime riporta sotto la fonte e le ipotesi, in `caption`. Le offerte con dati incompleti o anomali non entrano in classifica. Il voto segue la metodologia pubblica del progetto.
