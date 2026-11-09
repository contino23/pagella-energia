/**
 * Pagella di un'offerta: voto 0–10 per voce e voto complessivo pesato.
 * La metodologia è pubblica; ogni punto tolto ha un motivo leggibile.
 *
 * Pesi: Prezzo 60%, Vincoli 20%, Trasparenza 10%, Affidabilità del venditore 10%.
 * Finché l'affidabilità non è calcolabile (serve lo storico), il suo peso
 * si ridistribuisce in proporzione sulle altre voci.
 */
import type { StimaSpesa } from "./calcolo-luce.js";
import type { Offerta } from "./modello.js";
import { penaleRecesso, testoPenale } from "./penale.js";

export const PESI = { prezzo: 0.6, vincoli: 0.2, trasparenza: 0.1, affidabilita: 0.1 } as const;
export type NomeVoce = keyof typeof PESI;

export interface VocePagella {
  voce: NomeVoce;
  voto: number | null; // null = non ancora disponibile
  peso: number; // peso effettivo usato
  motivi: string[];
}

export interface Pagella {
  codiceOfferta: string;
  voto: number;
  voci: VocePagella[];
  /** Informazioni utili che non incidono sul voto. */
  note: string[];
}

export interface MetricheVenditore {
  /** Voto 0–10 già calcolato dallo storico (spread, stabilità, trasmissione dei ribassi). */
  voto: number;
  motivi: string[];
}

const clamp = (x: number) => Math.max(0, Math.min(10, x));
const arrot = (x: number) => Math.round(x * 10) / 10;
const euro = (x: number) => `${Math.round(x).toLocaleString("it-IT")} €`;

/**
 * Voto prezzo: quanto costa in più, in percentuale, rispetto alla più economica confrontabile.
 *  - fino a +10%: da 10 a 6 (0,4 punti per ogni 1%);
 *  - oltre: da 6 a 0, che si raggiunge a +50% (0,15 punti per ogni 1%).
 * Così un voto alto vuol dire davvero "vicina alla migliore": il 6 corrisponde a circa
 * 1 € ogni 10 € in più della più economica. La più economica è calcolata escludendo
 * le spese sotto la metà della mediana, che di solito sono errori nei dati pubblicati.
 */
export const SOGLIE_PREZZO = { sufficienza: 0.1, zero: 0.5 } as const;

export function votoDaScarto(scarto: number): number {
  const { sufficienza, zero } = SOGLIE_PREZZO;
  if (scarto <= 0) return 10;
  if (scarto <= sufficienza) return 10 - (4 * scarto) / sufficienza;
  return Math.max(0, 6 - (6 * (scarto - sufficienza)) / (zero - sufficienza));
}

export function riferimentoPrezzo(confrontabili: number[]): number {
  const ord = [...confrontabili].sort((a, b) => a - b);
  const mediana = ord[Math.floor((ord.length - 1) / 2)] ?? 0;
  return ord.find((x) => x >= mediana / 2) ?? ord[0] ?? 0;
}

export function votoPrezzo(spesa: number, confrontabili: number[]): VocePagella {
  const n = confrontabili.length;
  if (n <= 1) return { voce: "prezzo", voto: 10, peso: PESI.prezzo, motivi: ["Unica offerta confrontabile"] };
  const minimo = Math.min(riferimentoPrezzo(confrontabili), spesa);
  const scarto = minimo > 0 ? spesa / minimo - 1 : 0;
  const voto = arrot(votoDaScarto(scarto));
  const piuCare = confrontabili.filter((x) => x > spesa + 0.005).length;
  const motivi = [
    spesa - minimo < 1
      ? "È l'offerta più economica tra quelle confrontabili"
      : `Costa ${euro(spesa - minimo)} l'anno in più della più economica (+${Math.round(scarto * 100)}%)`,
    `Più economica di ${Math.floor((100 * piuCare) / n)}% delle ${numeroIt(n)} offerte confrontabili`,
  ];
  return { voce: "prezzo", voto, peso: PESI.prezzo, motivi };
}

const numeroIt = (x: number) => x.toLocaleString("it-IT", { useGrouping: "always" as unknown as boolean });

const RE_DEPOSITO = /deposit|cauzion|fideiussion/i;
const RE_NESSUN_DEPOSITO = /nessun|non (è|e'|viene|sarà) richiest|non prevede|non richiede|non c'è bisogno|non (è|e') necessari|^\s*(no|sepa)\s*$/i;

export function votoVincoli(o: Offerta): VocePagella {
  let v = 10;
  const motivi: string[] = [];
  const penale = penaleRecesso(o);
  if (penale) {
    v -= 4;
    motivi.push(`Penale ${testoPenale(penale)}`);
  }
  if (RE_DEPOSITO.test(o.garanzie) && !RE_NESSUN_DEPOSITO.test(o.garanzie)) {
    v -= 1;
    motivi.push("Può essere richiesto un deposito cauzionale o una garanzia");
  }
  if (motivi.length === 0) motivi.push("Nessuna penale di uscita né garanzie richieste");
  return { voce: "vincoli", voto: clamp(v), peso: PESI.vincoli, motivi };
}

export function votoTrasparenza(o: Offerta, stima: StimaSpesa): VocePagella {
  let v = 10;
  const motivi: string[] = [];
  // Quanta parte della convenienza viene da sconti temporanei (entro i primi 12 mesi).
  const temporanei = o.sconti.some((s) => s.validita === "INGRESSO" || s.validita === "ENTRO_12_MESI" || s.meseValidita !== undefined || (s.durataMesi ?? 99) < 12);
  const sconti = -(stima.voci.find((x) => x.voce === "sconti")?.importo ?? 0);
  if (temporanei && sconti > 0 && stima.totale > 0) {
    const quota = sconti / (stima.totale + sconti);
    const meno = Math.min(4, quota * 40);
    if (meno >= 0.5) {
      v -= meno;
      motivi.push(`Il ${Math.round(quota * 100)}% del risparmio stimato viene da sconti validi solo all'inizio`);
    }
  }
  const unaTantum = stima.voci.find((x) => x.voce === "una_tantum")?.importo ?? 0;
  if (unaTantum > 0) {
    v -= Math.min(2, unaTantum / 50);
    motivi.push(`Costi una tantum di ${euro(unaTantum)}`);
  }
  if (o.derivati.haServiziAggiuntivi) {
    v -= 1;
    motivi.push("Include prodotti o servizi aggiuntivi da valutare a parte");
  }
  if (stima.avvisi.length > 0) {
    v -= 2;
    motivi.push("Dati dell'offerta incompleti: stima meno precisa");
  }
  if (motivi.length === 0) motivi.push("Prezzo chiaro, senza sconti temporanei né costi extra");
  return { voce: "trasparenza", voto: arrot(clamp(v)), peso: PESI.trasparenza, motivi };
}

export function creaPagella(
  o: Offerta,
  stima: StimaSpesa,
  spesaConfrontabili: number[],
  venditore?: MetricheVenditore,
  /** Spesa con indice al minimo e al massimo degli ultimi 12 mesi (solo variabili). */
  forchettaSpesa?: { minimo: number; massimo: number },
): Pagella {
  const voci: VocePagella[] = [
    votoPrezzo(stima.totale, spesaConfrontabili),
    votoVincoli(o),
    votoTrasparenza(o, stima),
    venditore
      ? { voce: "affidabilita", voto: clamp(venditore.voto), peso: PESI.affidabilita, motivi: venditore.motivi }
      : { voce: "affidabilita", voto: null, peso: 0, motivi: ["In arrivo: serve lo storico delle offerte del venditore"] },
  ];
  const pesoTotale = voci.reduce((s, x) => s + (x.voto === null ? 0 : PESI[x.voce]), 0);
  for (const x of voci) x.peso = x.voto === null ? 0 : Math.round((PESI[x.voce] / pesoTotale) * 1000) / 1000;
  const voto = arrot(voci.reduce((s, x) => s + (x.voto ?? 0) * x.peso, 0));

  const note: string[] = [];
  if (o.prezzo === "variabile") {
    note.push(`Prezzo variabile${o.indice ? ` legato a ${o.indice.etichetta}` : ""}: la spesa reale seguirà il mercato`);
    if (forchettaSpesa && forchettaSpesa.massimo - forchettaSpesa.minimo >= 1)
      note.push(`Negli ultimi 12 mesi questa offerta sarebbe costata tra ${euro(forchettaSpesa.minimo)} e ${euro(forchettaSpesa.massimo)} l'anno`);
  }
  if (o.prezzo === "fisso" && o.durataMesi) note.push(`Prezzo bloccato per ${o.durataMesi} mesi`);
  if (stima.totaleConScontiCondizionati < stima.totale - 1)
    note.push(`Con bolletta online o domiciliazione scende a ${euro(stima.totaleConScontiCondizionati)}`);
  if (o.sconti.some((s) => s.validita === "OLTRE_12_MESI")) note.push("Prevede sconti oltre il primo anno, non inclusi nella stima");
  return { codiceOfferta: o.codice, voto, voci, note };
}
