/**
 * Estrae dal testo di una bolletta (formato ARERA dal 1° luglio 2025) i dati utili al confronto.
 * Funzione pura: il testo arriva già estratto dal PDF, sul dispositivo dell'utente.
 *
 * Strategia: il codice offerta del "Box dell'offerta" si cerca confrontando le parole del testo
 * con i codici del Portale Offerte di oggi, così non serve conoscere l'impaginazione di ogni venditore.
 * Consumi e potenza si cercano accanto alle etichette standard della bolletta.
 */
import type { Commodity } from "./modello.js";

export interface DatiBolletta {
  codiceOfferta?: string;
  commodity?: Exclude<Commodity, "dual">;
  consumoAnnuo?: number;
  potenzaKw?: number;
  residente?: boolean;
  cap?: string;
  /** Quali campi sono stati trovati, per mostrare all'utente cosa verificare. */
  trovati: string[];
}

const numero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/** Normalizza il testo: spazi singoli, niente a capo spezzati in mezzo ai codici. */
export function normalizzaTesto(t: string): string {
  return t.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\r/g, "");
}

export function estraiDatiBolletta(testo: string, codiciNoti: ReadonlySet<string>): DatiBolletta {
  const t = normalizzaTesto(testo);
  const piatto = t.replace(/\n/g, " ");
  const out: DatiBolletta = { trovati: [] };

  // 1. Codice offerta: una parola presente tra i codici del Portale (anche spezzata da uno spazio).
  const parole = piatto.match(/[A-Z0-9]{12,40}/g) ?? [];
  let codice = parole.find((p) => codiciNoti.has(p));
  if (!codice) {
    // L'estrazione dal PDF a volte spezza un codice lungo in due o tre pezzi.
    const pezzi = piatto.split(/\s+/).filter((p) => /^[A-Z0-9]+$/.test(p));
    for (let i = 0; i < pezzi.length && !codice; i++) {
      const due = pezzi[i]! + (pezzi[i + 1] ?? "");
      const tre = due + (pezzi[i + 2] ?? "");
      codice = [due, tre].find((c) => codiciNoti.has(c));
    }
  }
  if (!codice) {
    const m = /codice\s+offerta\s*:?\s*([A-Z0-9]{12,40})/i.exec(piatto);
    if (m) codice = m[1];
  }
  if (codice) {
    out.codiceOfferta = codice;
    out.trovati.push("codice offerta");
  }

  // 2. Luce o gas: dal codice (7° carattere E/G nei codici del Portale) o dalle unità usate.
  const tipo = codice?.charAt(6);
  if (tipo === "E") out.commodity = "luce";
  else if (tipo === "G") out.commodity = "gas";
  else if (/\bSmc\b/.test(piatto) && !/\bkWh\b/.test(piatto)) out.commodity = "gas";
  else if (/\bkWh\b/.test(piatto)) out.commodity = "luce";
  const unita = out.commodity === "gas" ? "Smc" : "kWh";

  // 3. Consumo annuo: "Consumo annuo ... 2.700 kWh" (entro poche parole dall'etichetta).
  const reConsumo = new RegExp(`consumo\\s+(?:annuo|annuale|degli ultimi 12 mesi)[^\\d]{0,80}?(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:,\\d+)?)\\s*${unita}`, "i");
  const mc = reConsumo.exec(piatto);
  if (mc) {
    const v = numero(mc[1]!);
    if (v > 0 && v < 1_000_000) {
      out.consumoAnnuo = Math.round(v);
      out.trovati.push("consumo annuo");
    }
  }

  // 4. Potenza impegnata (solo luce).
  if (out.commodity !== "gas") {
    const mp = /potenza\s+(?:impegnata|contrattuale|disponibile)[^\d]{0,40}?(\d{1,2}(?:,\d{1,2})?)\s*kW\b/i.exec(piatto);
    if (mp) {
      out.potenzaKw = numero(mp[1]!);
      out.trovati.push("potenza");
    }
  }

  // 5. Residenza: la bolletta riporta "domestico residente" o "non residente".
  if (/non\s+residente/i.test(piatto)) {
    out.residente = false;
    out.trovati.push("residenza");
  } else if (/\bresidente\b/i.test(piatto)) {
    out.residente = true;
    out.trovati.push("residenza");
  }

  // 6. CAP dell'indirizzo di fornitura.
  const ia = /(?:indirizzo|luogo|punto)\s+di\s+fornitura[^\n]{0,160}?\b(\d{5})\b/i.exec(t) ?? /fornitura[\s\S]{0,200}?\b(\d{5})\s+[A-ZÀ-Úa-zà-ú' ]{2,40}\(?[A-Z]{2}\)?/.exec(t);
  if (ia) {
    out.cap = ia[1];
    out.trovati.push("CAP di fornitura");
  }
  return out;
}
