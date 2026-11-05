/** Formati e piccoli aiuti condivisi tra le pagine. */
import type { Offerta, RisultatoOfferta } from "@pagella/core";

/** Numeri all'italiana con il punto delle migliaia anche a 4 cifre (1.166, non 1166). */
const fmtIntero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" as unknown as boolean });
export const numero = (x: number) => fmtIntero.format(Math.round(x));
export const euro = (x: number) => `${numero(x)} €`;
export const voto = (v: number) => (v === 10 ? "10" : v.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const classeVoto = (v: number) => (v >= 6 ? "pe-grade-good" : "pe-grade-warn");
export const prezzoKwh = (x: number, unita: "kWh" | "Smc") => `${x.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/${unita}`;

const SIGLE = new Set(["PUN", "PSV", "GPL", "EE", "WEB", "SDD", "PLUS"]);
/** "SCUDO 24 LUCE" → "Scudo 24 Luce": solo se il nome è tutto maiuscolo. */
export function nomeLeggibile(nome: string): string {
  const pulito = nome.replace(/\s+/g, " ").trim();
  if (/[a-zà-ú]/.test(pulito)) return pulito;
  return pulito
    .split(" ")
    .map((p) => (SIGLE.has(p) && p !== "PLUS" && p !== "WEB" ? p : /\d/.test(p) ? p : p.charAt(0) + p.slice(1).toLowerCase()))
    .join(" ");
}

/** "https://www.fastweb.it/" → "fastweb.it" */
export function dominio(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function descriviPrezzo(o: Pick<Offerta, "prezzo" | "durataMesi" | "commodity">): string {
  if (o.prezzo === "variabile") return `Prezzo variabile, segue il ${o.commodity === "gas" ? "PSV" : "PUN"}`;
  if (o.prezzo === "misto") return "Prezzo in parte fisso, in parte variabile";
  if (o.durataMesi && o.durataMesi < 99) return `Prezzo fisso ${o.durataMesi} mesi`;
  return "Prezzo fisso";
}

/** Escape per testo inserito in HTML generato dallo script. */
export function h(x: unknown): string {
  return String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const ICONE = {
  birra: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 11h1a3 3 0 0 1 0 6h-1"></path><path d="M5 8h12v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"></path><path d="M6 8a2.5 2.5 0 0 1 1.5-4.5c.9 0 1.6.4 2 1A3 3 0 0 1 15 5a2 2 0 0 1 2 2v1"></path><path d="M9 12v5"></path><path d="M13 12v5"></path></svg>',
  fulmine: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"></path></svg>',
  fiamma: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z"></path></svg>',
  spunta: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>',
  attenzione: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg>',
  salita: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17 9 11l4 4 8-8"></path><path d="M14 7h7v7"></path></svg>',
  esterno: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg>',
};

const dec = (x: number, n: number) => x.toLocaleString("it-IT", { minimumFractionDigits: n, maximumFractionDigits: n });

/** I tre dati "a colpo d'occhio" di un'offerta: prezzo dell'energia, quota fissa, tipo di prezzo. */
export function fattiOfferta(r: RisultatoOfferta, quotaLetta?: number): Array<{ etichetta: string; valore: string; nota?: string }> {
  const o = r.offerta;
  const u = o.commodity === "gas" ? "Smc" : "kWh";
  const indice = o.commodity === "gas" ? "PSV" : "PUN";
  const si = r.stima.sintesi;
  const variabile = si.spreadUnita !== undefined;
  const prezzo = variabile
    ? { etichetta: "Prezzo energia", valore: `${indice} + ${dec(si.spreadUnita!, 3)}`, nota: `€/${u} · oggi circa ${dec(si.prezzoUnita, 3)}` }
    : { etichetta: "Prezzo energia", valore: dec(si.prezzoUnita, 3), nota: `€/${u}` };
  const q = Math.round((quotaLetta ?? si.quotaFissaMese) * 100) / 100;
  const quota = { etichetta: "Quota fissa", valore: Number.isInteger(q) ? String(q) : dec(q, 2), nota: "€/mese" };
  const tipo = o.prezzo === "variabile" ? { valore: "Variabile", nota: "cambia ogni mese" }
    : o.prezzo === "misto" ? { valore: "Misto", nota: "in parte fisso" }
    : o.durataMesi && o.durataMesi < 99 ? { valore: "Fisso", nota: `bloccato ${o.durataMesi} mesi` }
    : { valore: "Fisso", nota: "durata indeterminata" };
  return [prezzo, quota, { etichetta: "Tipo di prezzo", ...tipo }];
}
