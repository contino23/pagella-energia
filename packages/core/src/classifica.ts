/**
 * Classifica delle offerte per un profilo: filtra quelle sottoscrivibili,
 * stima la spesa nei tre scenari, assegna la pagella e ordina.
 * Usata sia dal sito nel browser sia dalla pipeline (classifiche nazionali).
 */
import { stimaSpesaGas, type ProfiloGas } from "./calcolo-gas.js";
import { stimaSpesaLuce, type ProfiloLuce, type StimaSpesa } from "./calcolo-luce.js";
import type { Offerta, Parametro } from "./modello.js";
import { creaPagella, type Pagella } from "./pagella.js";
import { forchetta, type ScenariIndici } from "./scenari.js";

export interface Luogo {
  /** Codice ISTAT del comune (6 cifre), se noto. */
  comune?: string;
  /** Codice ISTAT della provincia (3 cifre). */
  provincia?: string;
  /** Codice ISTAT della regione (2 cifre). */
  regione: string;
}

export type ProfiloClassifica =
  | { commodity: "luce"; luce: ProfiloLuce; luogo?: Luogo }
  | { commodity: "gas"; gas: ProfiloGas; luogo?: Luogo };

export interface RisultatoOfferta {
  offerta: Offerta;
  stima: StimaSpesa;
  minimo: number;
  massimo: number;
  pagella: Pagella;
  avvisi: Avviso[];
}

export interface Avviso {
  tipo: "warn" | "info";
  titolo: string;
  testo: string;
}

const RE_RISERVATA = /dipendent|\bsoci\b|convenzion/i;

/** L'offerta è sottoscrivibile in questo luogo? Senza luogo: solo offerte nazionali. */
export function disponibileIn(o: Offerta, luogo?: Luogo): boolean {
  if (!o.zone) return true;
  if (!luogo) return false;
  return (
    o.zone.regioni.includes(luogo.regione) ||
    (!!luogo.provincia && o.zone.province.includes(luogo.provincia)) ||
    (!!luogo.comune && o.zone.comuni.includes(luogo.comune))
  );
}

export function adattaAlProfilo(o: Offerta, p: ProfiloClassifica): boolean {
  if (o.commodity !== p.commodity || o.cliente !== "domestico" || !o.offertaSingola) return false;
  if (p.commodity === "luce") {
    if (p.luce.residente && o.residenza === "non_residenti") return false;
    if (!p.luce.residente && o.residenza === "residenti") return false;
    const c = p.luce.consumoAnnuoKwh, k = p.luce.potenzaKw;
    if ((o.consumoMin ?? 0) > c || (o.consumoMax ?? Infinity) < c) return false;
    if ((o.potenzaMin ?? 0) > k || (o.potenzaMax ?? Infinity) < k) return false;
  } else {
    const c = p.gas.consumoAnnuoSmc;
    if ((o.consumoMin ?? 0) > c || (o.consumoMax ?? Infinity) < c) return false;
  }
  return disponibileIn(o, p.luogo);
}

const euro = (x: number) => `${Math.round(x).toLocaleString("it-IT")} €`;

/** Avvisi da mostrare nella scheda: arancio per vincoli e costi extra, blu per il prezzo variabile. */
export function avvisiOfferta(o: Offerta, stima: StimaSpesa, minimo: number, massimo: number): Avviso[] {
  const out: Avviso[] = [];
  if (o.derivati.haPenaleRecesso)
    out.push({ tipo: "warn", titolo: "Penale di uscita", testo: o.durataMesi ? `se cambi prima dei ${o.durataMesi} mesi` : "se cambi prima della scadenza del prezzo bloccato" });
  if (/deposit|cauzion|fideiussion/i.test(o.garanzie) && !/nessun|non (è|e'|viene|sarà) richiest|non prevede|non richiede|non c'è bisogno|non (è|e') necessari|^\s*(no|sepa)\s*$/i.test(o.garanzie))
    out.push({ tipo: "warn", titolo: "Deposito cauzionale", testo: "che può essere richiesto all'attivazione" });
  const ut = stima.voci.find((v) => v.voce === "una_tantum")?.importo ?? 0;
  if (ut > 0) out.push({ tipo: "warn", titolo: "Costo una tantum", testo: `di ${euro(ut)}, già incluso nella spesa del primo anno` });
  const sconti = -(stima.voci.find((v) => v.voce === "sconti")?.importo ?? 0);
  if (sconti > 0 && o.sconti.some((s) => s.validita !== "OLTRE_12_MESI"))
    out.push({ tipo: "warn", titolo: "Sconti solo iniziali", testo: `${euro(sconti)} di sconti valgono solo nel primo anno: dopo la spesa sale` });
  if (o.derivati.haServiziAggiuntivi) out.push({ tipo: "warn", titolo: "Servizi aggiuntivi", testo: "inclusi nell'offerta: verifica se ti servono e se costano" });
  if (o.prezzo === "variabile" && massimo - minimo >= 12)
    out.push({ tipo: "info", titolo: "La rata cambia ogni mese.", testo: `Negli ultimi 12 mesi sarebbe stata tra ${euro(minimo / 12)} e ${euro(massimo / 12)} al mese.` });
  return out;
}

export interface OpzioniClassifica {
  /** Tieni solo la migliore offerta di ciascun venditore. */
  unaPerVenditore?: boolean;
  /** Escludi le offerte riservate (dipendenti, soci, convenzioni). */
  escludiRiservate?: boolean;
  limite?: number;
}

export function classifica(
  offerte: Offerta[],
  profilo: ProfiloClassifica,
  parametri: { luce: Parametro[]; gas: Parametro[] },
  scenari: ScenariIndici,
  opzioni: OpzioniClassifica = {},
): RisultatoOfferta[] {
  const candidate = offerte.filter((o) => adattaAlProfilo(o, profilo) && !(opzioni.escludiRiservate && RE_RISERVATA.test(`${o.nome} ${o.descrizione}`)));
  const calcola = (o: Offerta) =>
    forchetta((s) => (profilo.commodity === "luce" ? stimaSpesaLuce(o, profilo.luce, parametri.luce, s) : stimaSpesaGas(o, profilo.gas, parametri.gas, s)), scenari);
  const stimate = candidate.map((o) => ({ o, f: calcola(o) })).filter((x) => x.f.centrale.calcolabile);
  const spese = stimate.map((x) => x.f.centrale.totale);
  let risultati: RisultatoOfferta[] = stimate.map(({ o, f }) => ({
    offerta: o,
    stima: f.centrale,
    minimo: f.minimo,
    massimo: f.massimo,
    pagella: creaPagella(o, f.centrale, spese, undefined, f),
    avvisi: avvisiOfferta(o, f.centrale, f.minimo, f.massimo),
  }));
  risultati.sort((a, b) => b.pagella.voto - a.pagella.voto || a.stima.totale - b.stima.totale);
  if (opzioni.unaPerVenditore) {
    const visti = new Set<string>();
    risultati = risultati.filter((r) => (visti.has(r.offerta.pivaVenditore) ? false : (visti.add(r.offerta.pivaVenditore), true)));
  }
  return opzioni.limite ? risultati.slice(0, opzioni.limite) : risultati;
}

/** Valuta un'offerta specifica (quella dell'utente) rispetto a un insieme già classificato. */
export function valutaOfferta(
  o: Offerta,
  profilo: ProfiloClassifica,
  parametri: { luce: Parametro[]; gas: Parametro[] },
  scenari: ScenariIndici,
  confrontabili: RisultatoOfferta[],
): RisultatoOfferta | null {
  const f = forchetta((s) => (profilo.commodity === "luce" ? stimaSpesaLuce(o, profilo.luce, parametri.luce, s) : stimaSpesaGas(o, profilo.gas, parametri.gas, s)), scenari);
  if (!f.centrale.calcolabile) return null;
  const spese = [...confrontabili.map((r) => r.stima.totale), f.centrale.totale];
  return {
    offerta: o,
    stima: f.centrale,
    minimo: f.minimo,
    massimo: f.massimo,
    pagella: creaPagella(o, f.centrale, spese, undefined, f),
    avvisi: avvisiOfferta(o, f.centrale, f.minimo, f.massimo),
  };
}

/** Zona climatica prevalente per regione, usata come valore iniziale per il gas (modificabile). */
export const ZONA_CLIMATICA_TIPICA: Record<string, "B" | "C" | "D" | "E" | "F"> = {
  "01": "E", "02": "F", "03": "E", "04": "F", "05": "E", "06": "E", "07": "D", "08": "E",
  "09": "D", "10": "E", "11": "D", "12": "D", "13": "E", "14": "D", "15": "C", "16": "C",
  "17": "D", "18": "C", "19": "B", "20": "C",
};
