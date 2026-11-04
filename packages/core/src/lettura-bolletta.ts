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
  /** Dal Box dell'offerta e dallo scontrino dell'energia (bolletta ARERA dal 2025). */
  nomeOfferta?: string;
  tipoPrezzo?: "fisso" | "variabile";
  /** Prezzo medio della "spesa per la vendita" a consumo, €/kWh o €/Smc, IVA esclusa. */
  prezzoVendita?: number;
  /** Quota fissa della "spesa per la vendita", €/mese. */
  quotaFissaMese?: number;
  /** Mesi del periodo fatturato, "AAAA-MM". */
  periodo?: { da: string; a: string };
  penaleRecesso?: boolean;
  /** "Spesa annua sostenuta" negli ultimi 12 mesi, € IVA inclusa. */
  spesaAnnua?: number;
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

  // 7. Box dell'offerta: nome e tipo di prezzo.
  const mn = /(?:denominazione commerciale dell'offerta|nome (?:dell')?offerta)[ \t]*:?[ \t]+([^\n]{2,60})/i.exec(t);
  if (mn) {
    out.nomeOfferta = mn[1]!.trim();
    out.trovati.push("nome offerta");
  }
  const mt = /tipo(?:logia)? (?:di )?(?:offerta|prezzo)[ \t]*:?[ \t]+(?:a )?prezzo (fisso|variabile)|tipo di prezzo[ \t]*:?[ \t]+(fisso|variabile)/i.exec(t);
  if (mt) out.tipoPrezzo = (mt[1] ?? mt[2])!.toLowerCase() as "fisso" | "variabile";

  // 8. Scontrino dell'energia: "di cui spesa per la vendita … 0,245077 €/kWh" e "… 5,050000 €/mese".
  const reVendita = new RegExp(`spesa per la vendita[^\\n]*?(\\d+,\\d+)\\s*€\\s*/\\s*${unita}`, "i");
  const mv = reVendita.exec(t);
  if (mv) {
    const v = numero(mv[1]!);
    if (v > 0 && v < (unita === "Smc" ? 5 : 1)) {
      out.prezzoVendita = v;
      out.trovati.push("prezzo dell'energia");
    }
  }
  const mq = /spesa per la vendita[^\n]*?(\d+,\d+)\s*€\s*\/\s*(mese|anno)\b/i.exec(t);
  if (mq) {
    const v = numero(mq[1]!) / (mq[2]!.toLowerCase() === "anno" ? 12 : 1);
    if (v >= 0 && v < 100) {
      out.quotaFissaMese = v;
      out.trovati.push("quota fissa");
    }
  }

  // 9. Periodo fatturato.
  const mper = /periodo[^\n]{0,40}?fatturazion\w*\s*:?\s*(?:dal\s+)?\d{2}\/(\d{2})\/(\d{4})\s*(?:-|–|al)\s*\d{2}\/(\d{2})\/(\d{4})/i.exec(piatto);
  if (mper) out.periodo = { da: `${mper[2]}-${mper[1]}`, a: `${mper[4]}-${mper[3]}` };

  // 10. Oneri di recesso anticipato.
  const mr = /oneri di recesso anticipato[ \t]*:?[ \t]+([^\n]{1,60})/i.exec(t);
  if (mr) out.penaleRecesso = !/non (?:present|previst|applicat)|assent|nessun|^\s*no\b|^\s*0(?:,0+)?\s*€?\s*$/i.test(mr[1]!);

  // 11. Spesa annua sostenuta (obbligatoria nella bolletta sintetica).
  const ms = /spesa annua(?: sostenuta)?\s*:?\s*(?:€\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:€|euro)?/i.exec(piatto);
  if (ms) {
    const v = numero(ms[1]!);
    if (v > 10 && v < 50_000) {
      out.spesaAnnua = v;
      out.trovati.push("spesa annua");
    }
  }
  return out;
}
