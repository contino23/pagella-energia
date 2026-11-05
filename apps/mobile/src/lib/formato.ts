/** Formati all'italiana, senza dipendere da Intl (non uguale su tutti i telefoni). */
import type { Offerta } from "@pagella/core";

export function numero(x: number): string {
  const n = Math.round(Math.abs(x)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return x < 0 && Math.round(x) !== 0 ? `-${n}` : n;
}
export const euro = (x: number) => `${numero(x)} €`;
export function decimali(x: number, cifre: number): string {
  const [i, d] = Math.abs(x).toFixed(cifre).split(".");
  return `${x < 0 ? "-" : ""}${numero(Number(i))}${d ? `,${d}` : ""}`;
}
export const voto = (v: number) => (v === 10 ? "10" : decimali(v, 1));
export const prezzoUnita = (x: number, u: "kWh" | "Smc") => `${decimali(x, 3)} €/${u}`;

const SIGLE = new Set(["PUN", "PSV", "GPL", "EE"]);
export function nomeLeggibile(nome: string): string {
  const p = nome.replace(/\s+/g, " ").trim();
  if (/[a-zà-ú]/.test(p)) return p;
  return p.split(" ").map((w) => (SIGLE.has(w) || /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");
}

export function dominio(url?: string | null): string {
  if (!url) return "";
  const m = /^(?:https?:\/\/)?(?:www\.)?([^/?#]+)/i.exec(url);
  return m?.[1] ?? "";
}

export function descriviPrezzo(o: Pick<Offerta, "prezzo" | "durataMesi" | "commodity">): string {
  if (o.prezzo === "variabile") return `Prezzo variabile, segue il ${o.commodity === "gas" ? "PSV" : "PUN"}`;
  if (o.prezzo === "misto") return "Prezzo in parte fisso, in parte variabile";
  if (o.durataMesi && o.durataMesi < 99) return `Prezzo fisso ${o.durataMesi} mesi`;
  return "Prezzo fisso";
}

export function giudizio(v: number): string {
  return v >= 8 ? "Ottima: tra le più convenienti per te"
    : v >= 6 ? "Sufficiente: ci sono offerte simili o un po' migliori"
    : v >= 4 ? "Insufficiente: stai pagando più del necessario"
    : "Gravemente insufficiente: puoi risparmiare molto";
}
