/**
 * Penale di uscita (oneri di recesso anticipato).
 * Il Portale Offerte dice solo SE c'è una penale. Mostriamo quanto costa solo quando il venditore
 * lo scrive nero su bianco nella condizione; altrimenti avvisiamo che potrebbe esserci e di leggere
 * il contratto, senza indovinare durata o importo.
 */
import type { Offerta } from "./modello.js";

export interface Penale {
  /** Mesi dall'attivazione entro cui cambiare costa una penale. */
  mesi?: number;
  /** Quanto costa, a parole ("fino a 300 € il 1° anno, 200 € il 2°"), solo se scritto in chiaro nella condizione. */
  costo?: string;
  /** Data di fine del vincolo, quando il venditore indica una data invece dei mesi (gg/mm/aaaa). */
  finoAl?: string;
}

/** Alcuni venditori compilano la voce "oneri di recesso" proprio per dire che non ce ne sono. */
const RE_NESSUNA = /non applica alcun onere|non prevede (alcun|nessun)[a-z ]{0,12}oner|non sono previsti oneri|non (è|e') previsto alcun onere/i;

const NUMERI: Record<string, number> = { un: 1, uno: 1, primo: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, dodici: 12, diciotto: 18, ventiquattro: 24, trentasei: 36 };
const n = (x: string) => (/^\d+$/.test(x) ? Number(x) : NUMERI[x.toLowerCase()]);

/** Cerca una durata ("primi 24 mesi", "primo anno", "dieci anni") in un testo. */
export function mesiNelTesto(t: string): number | undefined {
  const s = t.replace(/\s+/g, " ");
  const parola = "(\\d{1,3}|un|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|dodici|diciotto|ventiquattro|trentasei)";
  let m = new RegExp(`${parola}\\s*\\(?\\s*(?:\\d{1,3}\\s*)?\\)?\\s*mes[ei]`, "i").exec(s);
  if (m) { const v = n(m[1]!); if (v && v >= 1 && v <= 120) return v; }
  if (/\bprimo anno\b/i.test(s)) return 12;
  m = new RegExp(`${parola}\\s*ann[oi]`, "i").exec(s);
  if (m) { const v = n(m[1]!); if (v && v >= 1 && v <= 10) return v * 12; }
  return undefined;
}

const ORDINALI: Record<string, number> = { primo: 1, secondo: 2, terzo: 3, quarto: 4, quinto: 5 };
const euro = (x: string) => `${Number(x.replace(/\.(?=\d{3})/g, "").replace(",", ".")).toLocaleString("it-IT", { maximumFractionDigits: 2 })} €`;
const NUM = "(\\d{1,4}(?:[.,]\\d{1,2})?)";

/** Il costo della penale come lo scrive il venditore, in una frase breve. undefined se non è chiaro. */
export function costoNelTesto(testo: string): string | undefined {
  const t = testo.replace(/\s+/g, " ");
  const iva = /iva esclusa|oltre iva|\+ ?iva/i.test(t) ? " + IVA" : "";
  // 300 euro per il primo anno, 200 euro per il secondo anno...
  const anni = [...t.matchAll(new RegExp(`${NUM}\\s*(?:€|euro)[^.;€]{0,40}?\\b(primo|secondo|terzo|quarto|quinto) anno`, "gi"))];
  if (anni.length >= 2) return `fino a ${anni.map((m) => `${euro(m[1]!)} il ${ORDINALI[m[2]!.toLowerCase()]}° anno`).join(", ")}${iva}`;
  // 3 € x kW di potenza x n° mesi residui; 0,12 €/kW * potenza * n° giorni
  let m = new RegExp(`${NUM}\\s*(?:€|euro)\\s*(?:\\/|x|×|\\*|per)\\s*kW`, "i").exec(t);
  if (m) {
    const unita = /giorn/i.test(t) ? "giorno" : /mes/i.test(t) ? "mese" : null;
    if (unita) return `fino a ${euro(m[1]!)} per ogni kW di potenza e per ogni ${unita} che manca alla scadenza${iva}`;
  }
  // 1,99 € per ogni mese residuo; 8 € × n° mesi; 12 € per nr. di mesi residui; 20 euro per mese residuo
  m = new RegExp(`${NUM}\\s*(?:€|euro)(?:\\s*\\([^)]*\\))?\\s*(?:per ogni|per ciascun|per|x|×|\\*)\\s*(?:(?:il\\s*)?(?:n°|nr\\.?|numero)\\s*)?(?:di\\s*|dei\\s*)?mes[ei]`, "i").exec(t);
  if (m) return `fino a ${euro(m[1]!)} per ogni mese che manca alla scadenza${iva}`;
  // 138€ nel primo mese di fornitura, 132€ nel secondo...
  m = new RegExp(`${NUM}\\s*(?:€|euro)\\s*nel primo mese`, "i").exec(t);
  if (m) return `fino a ${euro(m[1]!)}, che cala ogni mese${iva}`;
  // importo massimo di 200 €, fino a un massimo di 90 €, pari a 30 €, pari ad € 240,00
  const importi = [
    ...t.matchAll(new RegExp(`(?:massim\\w*|fino a|pari ad?|non superiore a)[^.;€\\d]{0,40}?${NUM}\\s*(?:€|euro)`, "gi")),
    ...t.matchAll(new RegExp(`(?:massim\\w*|fino a|pari ad?|non superiore a)[^.;€\\d]{0,40}?(?:€|euro)\\s*${NUM}`, "gi")),
  ].filter((x) => !/per ogni|per ciascun|\/mese|al mese|\/kw|per kwh|per smc|%/i.test(t.slice(x.index!, x.index! + x[0].length + 12)))
    .map((x) => Number(x[1]!.replace(/\.(?=\d{3})/g, "").replace(",", ".")))
    .filter((x) => x >= 1);
  if (importi.length) {
    const max = Math.max(...importi);
    const tetto = importi.length > 1 || /massim|fino a|non superiore|inferiore|non potrà superare/i.test(t);
    return `${tetto ? "fino a " : ""}${euro(String(max).replace(".", ","))}${iva}`;
  }
  return undefined;
}

/** Durata scritta in modo esplicito: "nei primi 24 mesi", "durante il primo anno". */
function mesiEspliciti(t: string): number | undefined {
  const m = /(?:recesso|recede)[^.;]{0,25}?(?:entro|nei|durante|nel corso de[il])\s+(?:i |il )?prim[oi]\b[^.;]{0,20}/i.exec(t);
  return m ? mesiNelTesto(m[0]) : undefined;
}

function dataNelTesto(t: string): string | undefined {
  const m = /(?:fino al|entro il|scadenza del|al)\s+(\d{1,2})\/(\d{1,2})\/(20\d\d)/i.exec(t);
  return m ? `${m[1]!.padStart(2, "0")}/${m[2]!.padStart(2, "0")}/${m[3]}` : undefined;
}

/** null = nessuna penale. Altrimenti quello che sappiamo della penale (può essere vuoto). */
export function penaleRecesso(o: Offerta): Penale | null {
  if (!o.derivati.haPenaleRecesso) return null;
  const d = o.derivati;
  if (d.penaleCalcolata)
    return { ...(d.penaleMesi ? { mesi: d.penaleMesi } : {}), ...(d.penaleCosto ? { costo: d.penaleCosto } : {}), ...(d.penaleFinoAl ? { finoAl: d.penaleFinoAl } : {}) };
  const testi = o.condizioni.filter((c) => c.tipo === "ONERI_RECESSO_ANTICIPATO").map((c) => c.testo).join(" ").replace(/\s+/g, " ");
  if (RE_NESSUNA.test(testi)) return null;
  const durata = o.durataMesi && o.durataMesi !== 99 && o.durataMesi > 0 ? o.durataMesi : undefined;
  // La durata dell'offerta vale più del testo, dove spesso compaiono mesi e anni di esempi o scaglioni.
  const mesi = durata ?? mesiEspliciti(testi) ?? mesiBloccoNelTesto(o.descrizione) ?? mesiNelTesto(o.nome) ?? mesiNelTesto(testi) ?? mesiNelTesto(o.descrizione);
  const finoAl = mesi ? undefined : dataNelTesto(testi) ?? dataNelTesto(o.descrizione);
  const costo = costoNelTesto(testi);
  return { ...(mesi ? { mesi } : {}), ...(costo ? { costo } : {}), ...(finoAl ? { finoAl } : {}) };
}

/** Avviso per la scheda: con il costo solo se il venditore lo scrive, altrimenti invito a leggere il contratto. */
export function avvisoPenale(p: Penale): { titolo: string; testo: string } {
  if (!p.costo) return { titolo: "Possibile penale di uscita:", testo: "potrebbero esserci oneri di recesso anticipato, leggi bene il contratto prima di firmare" };
  const quando = p.mesi
    ? `se cambi fornitore nei primi ${testoMesi(p.mesi)}`
    : p.finoAl ? `se cambi fornitore prima del ${p.finoAl}` : "se cambi fornitore prima della scadenza";
  return { titolo: "Penale di uscita", testo: `${quando}: ${p.costo}` };
}

/** Frase per i motivi della pagella. */
export function testoPenale(p: Penale): string {
  const a = avvisoPenale(p);
  return p.costo ? `Penale ${a.testo}` : "Possibile penale di uscita: leggi bene il contratto";
}

/** "36 mesi (3 anni)", "12 mesi", "10 anni". */
export function testoMesi(m: number): string {
  if (m >= 60 && m % 12 === 0) return `${m / 12} anni`;
  if (m >= 24 && m % 12 === 0) return `${m} mesi (${m / 12} anni)`;
  return `${m} mesi`;
}

/** Durata del blocco scritta nella descrizione: "bloccato per dieci anni", "fisso e invariabile per 36 mesi". */
export function mesiBloccoNelTesto(t: string): number | undefined {
  const m = /(?:bloccat\w*|bloccare|fiss[oa]|invariabil\w*|garantit\w*)\b[^.]{0,40}?\bper\s+[^.]{0,25}?(?:mes[ei]|ann[oi])/i.exec(t);
  return m ? mesiNelTesto(m[0]) : undefined;
}

/** Per quanto resta bloccato il prezzo di un'offerta a prezzo fisso. */
export function bloccoPrezzo(o: Offerta): { mesi?: number; finoAl?: string } {
  if (o.durataMesi && o.durataMesi !== 99 && o.durataMesi > 0) return { mesi: o.durataMesi };
  const d = o.derivati;
  if (d.penaleCalcolata) return { ...(d.bloccoMesi ? { mesi: d.bloccoMesi } : {}), ...(d.bloccoFinoAl ? { finoAl: d.bloccoFinoAl } : {}) };
  const mesi = mesiBloccoNelTesto(o.descrizione) ?? mesiNelTesto(o.nome);
  const finoAl = mesi ? undefined : dataNelTesto(o.descrizione);
  return { ...(mesi ? { mesi } : {}), ...(finoAl ? { finoAl } : {}) };
}

/** Ricava penale e blocco dai testi completi, da salvare nell'offerta prima di accorciare i testi. */
export function conPenaleCalcolata(o: Offerta): Offerta {
  const p = penaleRecesso(o);
  const b = bloccoPrezzo(o);
  return {
    ...o,
    derivati: {
      ...o.derivati,
      haPenaleRecesso: p !== null,
      ...(p?.mesi ? { penaleMesi: p.mesi } : {}),
      ...(p?.costo ? { penaleCosto: p.costo } : {}),
      ...(p?.finoAl ? { penaleFinoAl: p.finoAl } : {}),
      ...(b.mesi ? { bloccoMesi: b.mesi } : {}),
      ...(b.finoAl ? { bloccoFinoAl: b.finoAl } : {}),
      penaleCalcolata: true,
    },
  };
}
