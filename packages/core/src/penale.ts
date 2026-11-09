/**
 * Quanto dura il vincolo della penale di uscita e, quando è scritto, quanto costa.
 * Il Portale Offerte dice solo SE c'è una penale: la durata la ricaviamo, in quest'ordine,
 * dal testo della condizione, dalla durata dell'offerta e dalla sua descrizione.
 */
import type { Offerta } from "./modello.js";

export interface Penale {
  /** Mesi dall'attivazione entro cui cambiare costa una penale. */
  mesi?: number;
  /** Importo fisso in euro, solo quando il venditore lo scrive in chiaro. */
  importo?: number;
  /** L'importo è un massimo (cala nel tempo o dipende dalla perdita del venditore). */
  massimo?: boolean;
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

export function importoNelTesto(t: string): { importo: number; massimo: boolean } | undefined {
  if (/per ogni mese|per ciascun mese|\/mese|per kwh|per smc/i.test(t)) return undefined;
  const m = /(pari a|massimo di|fino a)\s*(?:un massimo di\s*)?(?:euro\s*|€\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|euro)/i.exec(t);
  if (!m) return undefined;
  const importo = Number(m[2]!.replace(",", "."));
  if (!(importo > 0)) return undefined;
  return { importo, massimo: /massim|fino a|nel primo mese|inferiore/i.test(t) };
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
    return { ...(d.penaleMesi ? { mesi: d.penaleMesi } : {}), ...(d.penaleImporto ? { importo: d.penaleImporto } : {}), ...(d.penaleMassimo ? { massimo: true } : {}), ...(d.penaleFinoAl ? { finoAl: d.penaleFinoAl } : {}) };
  const testi = o.condizioni.filter((c) => c.tipo === "ONERI_RECESSO_ANTICIPATO").map((c) => c.testo).join(" ").replace(/\s+/g, " ");
  if (RE_NESSUNA.test(testi)) return null;
  const durata = o.durataMesi && o.durataMesi !== 99 && o.durataMesi > 0 ? o.durataMesi : undefined;
  // La durata dell'offerta vale più del testo, dove spesso compaiono mesi e anni di esempi o scaglioni.
  const mesi = durata ?? mesiEspliciti(testi) ?? mesiNelTesto(o.descrizione) ?? mesiNelTesto(o.nome) ?? mesiNelTesto(testi);
  const finoAl = mesi ? undefined : dataNelTesto(testi) ?? dataNelTesto(o.descrizione);
  const imp = importoNelTesto(testi);
  return { ...(mesi ? { mesi } : {}), ...(imp ? { importo: imp.importo, ...(imp.massimo ? { massimo: true } : {}) } : {}), ...(finoAl ? { finoAl } : {}) };
}

/** Frase breve per l'avviso: "se cambi fornitore nei primi 36 mesi (3 anni)". */
export function testoPenale(p: Penale): string {
  const quando = p.mesi
    ? `se cambi fornitore nei primi ${testoMesi(p.mesi)} dall'attivazione`
    : p.finoAl
      ? `se cambi fornitore prima del ${p.finoAl}`
      : "se cambi fornitore prima della scadenza (la durata non è indicata: verificala nel contratto)";
  const euro = p.importo ? `${p.importo.toLocaleString("it-IT", { maximumFractionDigits: 2 })} €` : "";
  return p.importo ? `${quando}: ${p.massimo ? "fino a " : ""}${euro}` : quando;
}

/** "36 mesi (3 anni)", "12 mesi", "10 anni". */
export function testoMesi(m: number): string {
  if (m >= 60 && m % 12 === 0) return `${m / 12} anni`;
  if (m >= 24 && m % 12 === 0) return `${m} mesi (${m / 12} anni)`;
  return `${m} mesi`;
}

/** Per quanto resta bloccato il prezzo di un'offerta a prezzo fisso. */
export function bloccoPrezzo(o: Offerta): { mesi?: number; finoAl?: string } {
  if (o.durataMesi && o.durataMesi !== 99 && o.durataMesi > 0) return { mesi: o.durataMesi };
  const d = o.derivati;
  if (d.penaleCalcolata) return { ...(d.bloccoMesi ? { mesi: d.bloccoMesi } : {}), ...(d.bloccoFinoAl ? { finoAl: d.bloccoFinoAl } : {}) };
  const mesi = mesiNelTesto(o.descrizione) ?? mesiNelTesto(o.nome);
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
      ...(p?.importo ? { penaleImporto: p.importo } : {}),
      ...(p?.massimo ? { penaleMassimo: true } : {}),
      ...(p?.finoAl ? { penaleFinoAl: p.finoAl } : {}),
      ...(b.mesi ? { bloccoMesi: b.mesi } : {}),
      ...(b.finoAl ? { bloccoFinoAl: b.finoAl } : {}),
      penaleCalcolata: true,
    },
  };
}
