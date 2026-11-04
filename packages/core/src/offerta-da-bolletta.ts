/**
 * Offerta ricostruita dalla bolletta, per dare un voto anche alle offerte che non sono più
 * in vendita (e quindi non compaiono nel Portale Offerte di oggi): è il caso più comune.
 *
 * Dalla bolletta ARERA (dal 2025) prendiamo i prezzi della sola "spesa per la vendita":
 *  - a consumo, €/kWh o €/Smc: comprende materia prima, perdite, dispacciamento e spread;
 *  - quota fissa, €/mese.
 * Rete, oneri e imposte sono regolati e uguali per tutti: li ricalcola il motore come per le altre offerte.
 *
 * Prezzo variabile: togliamo dal prezzo pagato il valore dell'indice nei mesi fatturati e otteniamo
 * lo spread complessivo; nello scenario di oggi l'offerta costa indice di oggi + quello spread.
 * Prezzo fisso: il prezzo pagato vale anche per i prossimi 12 mesi.
 */
import { mappaParametri } from "./calcolo-luce.js";
import type { DatiBolletta } from "./lettura-bolletta.js";
import type { Offerta, Parametro } from "./modello.js";

export interface IndiceMese {
  mese: string; // "AAAA-MM"
  PUN?: number | null;
  PSV?: number | null;
}

export const CODICE_DA_BOLLETTA = "DALLA-BOLLETTA";

/** Mesi "AAAA-MM" compresi tra da e a, estremi inclusi. */
function mesiTra(da: string, a: string): string[] {
  const out: string[] = [];
  let [y, m] = da.split("-").map(Number) as [number, number];
  const [ya, ma] = a.split("-").map(Number) as [number, number];
  for (let i = 0; i < 24 && (y < ya || (y === ya && m <= ma)); i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/** Media dell'indice nei mesi fatturati; se mancano, null. */
export function indiceNelPeriodo(storico: IndiceMese[], nome: "PUN" | "PSV", periodo?: { da: string; a: string }): number | null {
  if (!periodo) return null;
  const mesi = new Set(mesiTra(periodo.da, periodo.a));
  const v = storico.filter((r) => mesi.has(r.mese)).map((r) => r[nome]).filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export function offertaDaBolletta(d: DatiBolletta, storico: IndiceMese[], parametri: { luce: Parametro[]; gas: Parametro[] }): Offerta | null {
  if (!d.commodity || d.prezzoVendita === undefined) return null;
  const luce = d.commodity === "luce";
  const unita = luce ? "EUR_KWH" : "EUR_SMC";
  const variabile = d.tipoPrezzo === "variabile";
  let energia = d.prezzoVendita;
  let indice: Offerta["indice"];
  if (variabile) {
    const idx = indiceNelPeriodo(storico, luce ? "PUN" : "PSV", d.periodo);
    if (idx === null) return null; // senza l'indice dei mesi fatturati non sappiamo separare lo spread
    const lambda = luce ? mappaParametri(parametri.luce)("lambda") : 0;
    energia = d.prezzoVendita - idx * (1 + lambda);
    indice = luce ? { codice: "01", etichetta: "PUN" } : { codice: "03", etichetta: "PSV" };
  }
  // Il motore aggiunge già DISPbt (luce) alla commercializzazione: la togliamo dalla quota fissa letta.
  const dispbt = luce ? mappaParametri(parametri.luce)("dispbt_d") : 0;
  const quotaAnno = d.quotaFissaMese !== undefined ? d.quotaFissaMese * 12 - dispbt : 0;
  const componenti: Offerta["componenti"] = [
    { nome: "Energia (dalla bolletta)", descrizione: "", ruolo: "energia", isSpread: variabile, tipologia: "", prezzi: [{ valore: energia, unita }] },
  ];
  if (quotaAnno !== 0) componenti.push({ nome: "Quota fissa (dalla bolletta)", descrizione: "", ruolo: "quota_fissa", isSpread: false, tipologia: "", prezzi: [{ valore: quotaAnno, unita: "EUR_ANNO" }] });

  return {
    codice: d.codiceOfferta ?? CODICE_DA_BOLLETTA,
    pivaVenditore: "",
    commodity: d.commodity,
    nome: d.nomeOfferta ?? "La tua offerta",
    descrizione: "Ricostruita dai prezzi della tua bolletta",
    cliente: "domestico",
    residenza: "tutti",
    prezzo: variabile ? "variabile" : "fisso",
    durataMesi: null,
    ...(indice ? { indice } : {}),
    fasce: "F0",
    validaDal: "",
    validaAl: "",
    offertaSingola: true,
    offerteCongiunte: [],
    attivazione: [],
    operazioniContrattuali: [],
    pagamenti: [],
    garanzie: "",
    contatti: { telefono: "" },
    componenti,
    componentiRegolate: [],
    dispacciamento: [],
    condizioni: [],
    sconti: [],
    servizi: [],
    zone: null,
    derivati: { haPenaleRecesso: d.penaleRecesso ?? false, haCondizioniLimitanti: false, haServiziAggiuntivi: false, disponibileOvunque: true },
  };
}
