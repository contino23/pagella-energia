/**
 * Sconti sul prezzo dell'energia, espressi per kWh o Smc, per mostrarli nella scheda accanto al listino.
 * Stesse regole della stima: valgono solo gli sconti del primo anno (ingresso o entro 12 mesi)
 * e, per gli scaglioni di consumo, solo quello che contiene il consumo annuo.
 */
import type { Offerta, Sconto } from "./modello.js";

const FASCIA_SCONTO: Record<string, "F1" | "F2" | "F3"> = { "11": "F1", "12": "F2", "13": "F3" };

/**
 * Fascia oraria a cui si applica lo sconto (solo luce), dal tracciato o, nelle fotografie
 * precedenti al 5/11/2026 che non lo salvavano, dal nome ("Sconto F1").
 */
export function fasciaSconto(s: Sconto): "F1" | "F2" | "F3" | undefined {
  if (s.componenteFascia) return FASCIA_SCONTO[s.componenteFascia];
  const m = /\bF([123])\b/.exec(s.nome);
  return m ? (`F${m[1]}` as "F1" | "F2" | "F3") : undefined;
}

export interface ScontoUnita {
  nome: string;
  /** Sconto per unità (€/kWh o €/Smc) mentre è attivo. */
  perUnita: number;
  /** true se serve una condizione (domiciliazione, bolletta online, altro). */
  condizionato: boolean;
  /** Testo breve: "con domiciliazione bancaria", "il primo anno", "per 6 mesi"… */
  quando: string;
  /** Lo sconto è già compreso nella spesa annua stimata (incondizionato) oppure no. */
  nellaStima: boolean;
}

const QUANDO_CONDIZIONE: Record<string, string> = {
  BOLLETTA_ONLINE: "con bolletta online",
  DOMICILIAZIONE: "con domiciliazione bancaria",
  DOMICILIAZIONE_E_ONLINE: "con domiciliazione e bolletta online",
};

/** Per gli sconti con condizione "altro", la condizione si capisce quasi sempre dal nome. */
function condizioneDaNome(nome: string): string {
  const n = nome.toLowerCase();
  if (/domicilia|\brid\b|\bsdd\b|addebito/.test(n)) return "con domiciliazione bancaria";
  if (/bollett\w* (web|online|digital)|e-?mail|paperless/.test(n)) return "con bolletta online";
  if (/\bsoci?\b/.test(n)) return "solo per i soci";
  if (/dual|luce e gas|gas e luce/.test(n)) return "con luce e gas insieme";
  if (/fibra|internet|giga|mobile/.test(n)) return "con altri servizi del venditore";
  return `a condizione: ${nome.trim().replace(/^sconto\s+/i, "")}`;
}

export function scontiPerUnita(o: Offerta, consumoAnnuo: number, prezzoUnita: number, quote?: { F1: number; F2: number; F3: number }): ScontoUnita[] {
  const out: ScontoUnita[] = [];
  for (const s of o.sconti) {
    if (s.validita !== "INGRESSO" && s.validita !== "ENTRO_12_MESI") continue;
    const importi = s.importi.filter((i) => (i.validoDa === undefined && i.validoFino === undefined)
      || (consumoAnnuo >= (i.validoDa ?? 0) && consumoAnnuo <= (i.validoFino ?? Infinity)));
    let perUnita = 0;
    for (const i of importi) {
      if (i.tipo !== "VENDITA") continue;
      if (i.unita === "EUR_KWH" || i.unita === "EUR_SMC") perUnita += i.valore;
      else if (i.unita === "PERCENTUALE") perUnita += (prezzoUnita * i.valore) / 100;
    }
    // Uno sconto di una sola fascia vale, in media, per la quota di consumi di quella fascia.
    const f = o.commodity !== "gas" ? fasciaSconto(s) : undefined;
    if (f && quote) perUnita *= quote[f];
    if (perUnita <= 0) continue;
    const condizionato = s.condizione !== "NESSUNA";
    const periodo = s.meseValidita !== undefined ? "per un mese" : s.durataMesi && s.durataMesi < 12 ? `per ${s.durataMesi} mesi` : "il primo anno";
    const quando = condizionato ? (QUANDO_CONDIZIONE[s.condizione] ?? condizioneDaNome(s.nome)) : periodo;
    out.push({ nome: s.nome.trim(), perUnita: Math.round(perUnita * 1e5) / 1e5, condizionato, quando, nellaStima: !condizionato });
  }
  // Gli sconti con la stessa condizione e lo stesso periodo (es. uno per fascia) diventano uno solo.
  const uniti = new Map<string, ScontoUnita>();
  for (const x of out) {
    const k = `${x.condizionato}|${x.quando}`;
    const g = uniti.get(k);
    if (g) g.perUnita = Math.round((g.perUnita + x.perUnita) * 1e5) / 1e5;
    else uniti.set(k, { ...x });
  }
  // Prima quelli per tutti, poi quelli a condizione; al massimo tre.
  return [...uniti.values()].sort((a, b) => Number(a.condizionato) - Number(b.condizionato)).slice(0, 3);
}
