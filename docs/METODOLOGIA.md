# Metodologia di Pagella Energia

Documento pubblico: spiega come stimiamo la spesa e come assegniamo il voto.
Ogni scelta è dichiarata; quando cambia, cambia qui.

## Fonte dei dati

- Offerte e parametri regolati: file open data del Portale Offerte (ARERA / Acquirente Unico),
  aggiornati ogni giorno. Riuso libero citando la fonte "Portale Offerte".
- Prezzi storici degli indici (PUN, PSV, PSBIL, CMEM, PE): file open data del Portale Offerte.
- Aggiornamento automatico due volte al giorno (circa alle 9:20 e alle 14:20): scarichiamo i file,
  li controlliamo e pubblichiamo i dati solo se tutti i controlli passano. Altrimenti restano
  quelli del giorno prima. La data dei dati è sempre indicata sul sito e nell'app.
- Accise e addizionali regionali del gas: tabelle ufficiali vigenti, aggiornate a mano (ultimo
  aggiornamento: ottobre 2026), perché non sono negli open data.

Pagella Energia non riceve commissioni né compensi dai venditori.

## Stima della spesa annua

Seguiamo le "Regole per il calcolo della Spesa" v3.02 di Acquirente Unico, cioè lo stesso
algoritmo del Portale Offerte, con queste differenze:

1. **Offerte variabili.** Il Portale usa le quotazioni future di mercato elaborate da Acquirente
   Unico, non pubblicate. Noi usiamo la **media degli ultimi 3 mesi** di ciascun indice: è il
   riferimento più vicino al mercato attuale tra quelli pubblici. Per ogni variabile mostriamo
   anche una **forchetta**: la spesa con l'indice al minimo e al massimo degli ultimi 12 mesi.
2. **Indice unico per tutte le fasce orarie**, perché lo storico pubblico del PUN è monorario.
3. **Gas: scaglioni progressivi** per distribuzione, UG2, accise e addizionale regionale, come
   avviene in bolletta (il documento AU usa la sola fascia del consumo totale).
4. **IVA gas:** 10% sulla quota dei primi 480 Smc, 22% sul resto.
5. **Sconti:** il totale principale include solo gli sconti senza condizioni validi nel primo
   anno, come il Portale. Mostriamo a parte la spesa con gli sconti per bolletta online o
   domiciliazione. Gli sconti successivi al primo anno sono segnalati ma non inclusi.
   Uno sconto limitato a una fascia oraria (F1, F2 o F3) vale solo sui consumi di quella fascia.
6. **Dati anomali:** offerte con prezzi palesemente errati (es. oltre 1 €/kWh) non entrano in
   classifica e sono segnalate come "dati non affidabili".

Profili di consumo predefiniti: quelli del Portale (luce domestica F1 33%, F2 31%, F3 36%;
gas: profili di prelievo mensili AU per zona climatica).

## Cosa vedi in ogni scheda

- **Prezzo energia.** Offerte a prezzo fisso: il prezzo medio della materia prima per kWh o Smc,
  IVA e imposte escluse, come da listino. Offerte variabili: quanto il venditore aggiunge
  all'indice (es. "PUN + 0,012 €/kWh"), con accanto il valore approssimativo di oggi.
- **Prezzo con gli sconti.** Se l'offerta ha sconti sul prezzo dell'energia, sotto il listino
  compare il prezzo scontato: in verde se lo sconto vale per tutti (ed è già nella spesa annua),
  in blu se serve una condizione (domiciliazione, bolletta online, essere soci…), che indichiamo.
  Mostriamo solo gli sconti dichiarati al Portale Offerte: le promozioni di altri canali non ci sono.
- **Quota fissa.** Quanto il venditore chiede ogni mese a prescindere dai consumi; non comprende
  le quote fisse di rete e oneri, uguali per tutti.
- **Tipo di prezzo.** Fisso (con i mesi per cui è bloccato) o variabile.
- **Risparmio, spesa annua e al mese.** Stima per i prossimi 12 mesi con i tuoi consumi e il tuo
  comune, IVA e imposte comprese. Il risparmio è rispetto alla tua offerta; sotto i 12 € l'anno
  consideriamo la tua offerta già tra le più convenienti.
- **Avvisi.** In arancio penali di uscita, depositi, costi una tantum, sconti solo iniziali e
  servizi aggiuntivi; in blu quanto può variare la rata delle offerte variabili.

## La tua bolletta

La bolletta in PDF viene letta sul tuo dispositivo, nel browser o nell'app, e non viene mai
inviata a un server. Prima dei risultati mostriamo cosa abbiamo letto, da confermare o correggere.
Il voto della tua offerta si calcola così:

1. **Offerta ancora in vendita:** la troviamo nel Portale Offerte con il codice della bolletta e
   usiamo le sue condizioni ufficiali.
2. **Offerta non più in vendita** (il caso più comune): la ricostruiamo con i prezzi della
   "spesa per la vendita" stampati in bolletta. Per le variabili, il prezzo pagato meno l'indice
   dei mesi fatturati dà il ricarico del venditore, che applichiamo all'indice di oggi.
3. **Mancano anche i prezzi:** voto sul solo prezzo, confrontando la spesa annua indicata in
   bolletta (o scritta da te) con la spesa stimata delle altre offerte. È un confronto
   approssimato, e lo diciamo.

La spesa dell'ultimo anno scritta in bolletta può essere diversa dalla nostra stima: la prima
dipende dai prezzi passati, la seconda dai prezzi di oggi, uguali per tutte le offerte.

## Se non conosci il consumo annuo

Per confrontare le offerte servono almeno il **consumo annuo** e il **comune**. Se non hai la
bolletta sotto mano, puoi stimare il consumo con poche domande. La stima è indicativa: se trovi
il consumo in bolletta, usa quello.

- **Luce:** si parte dal numero di persone in casa (1.400 kWh per una persona, 2.000 per due,
  2.500 per tre, 2.900 per quattro, 3.300 per cinque o più), poi si aggiunge qualcosa per ogni
  grande consumo elettrico: piano a induzione o forno elettrico +450, scaldabagno elettrico +900,
  condizionatore +350, riscaldamento con pompa di calore o stufe elettriche +2.500,
  auto elettrica ricaricata a casa +2.000.
- **Gas:** cucina (135-230 Smc l'anno secondo le persone), acqua calda (310-510 Smc) e
  riscaldamento autonomo, che dipende dai metri quadri e dalla zona climatica del comune
  (da 4 Smc al metro quadro in zona A a 20 in zona F).

Se non lo cambi, residente è impostato su "sì" e la potenza su 3 kW, il valore più comune.

## Il voto

Voto da 0 a 10 per ogni voce, voto complessivo pesato:

| Voce | Peso | Cosa misura |
|---|---|---|
| Prezzo | 60% | Quanto costa in più, in percentuale, della più economica tra le offerte confrontabili per il tuo profilo e il tuo comune. 10 = la più economica; +5% → 8; +10% → 6 (sufficienza); +25% → 3,8; +50% o più → 0. Come riferimento non si usano spese sotto la metà della mediana, quasi sempre errori nei dati pubblicati. |
| Vincoli | 20% | Parte da 10. −4 se c'è una penale di recesso anticipato; −1 se può essere richiesto un deposito o una garanzia. |
| Trasparenza | 10% | Parte da 10. Fino a −4 in proporzione a quanto della convenienza viene da sconti solo iniziali; fino a −2 per costi una tantum; −1 per servizi aggiuntivi inclusi; −2 se i dati sono incompleti. |
| Affidabilità del venditore | 10% | Dallo storico: spread sull'indice nel tempo, frequenza delle modifiche, rapidità nel trasferire i ribassi. **In arrivo**: finché non è disponibile, il suo peso si ripartisce in proporzione sulle altre voci. |

Prezzo fisso e variabile non sono premiati né penalizzati in sé: è una scelta dell'utente.

## Decisioni e date

- 3/11/2026: pesi 60/20/10/10; scenario centrale per le variabili = media ultimi 3 mesi.
- 4/11/2026: il voto prezzo non è più la posizione in classifica (dava 9 e 10 a centinaia di offerte quasi uguali) ma lo scarto in euro dalla più economica, con la sufficienza a +10%.
- 4/11/2026: se l'offerta della bolletta non è più in vendita, la ricostruiamo dai prezzi della "spesa per la vendita" stampati in bolletta (per le variabili: prezzo pagato meno l'indice dei mesi fatturati = spread) e la valutiamo come le altre. Se mancano anche quelli, diamo il voto sul solo prezzo partendo dalla spesa annua.
- 5/11/2026: nelle schede, sotto il prezzo di listino, il prezzo con gli sconti sul prezzo dell'energia (verde se vale per tutti, blu se serve una condizione come la domiciliazione). Gli sconti limitati a una fascia oraria (F1, F2 o F3) ora valgono solo sui consumi di quella fascia: prima uno sconto ripetuto per le tre fasce veniva contato tre volte.
- 9/11/2026: consumo annuo e comune sono obbligatori per vedere le offerte; chi non conosce il consumo può stimarlo con poche domande (persone in casa, elettrodomestici, metri quadri per il gas).
