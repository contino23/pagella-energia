/** Lettore dei file "PO_Parametri_Mercato_Libero_{E|G}_AAAAMMGG.csv". */
import type { Parametro } from "@pagella/core";

/** Divide una riga CSV rispettando i campi tra virgolette. */
export function campiCsv(riga: string): string[] {
  const out: string[] = [];
  let cur = "";
  let virgolette = false;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (c === '"') {
      if (virgolette && riga[i + 1] === '"') { cur += '"'; i++; }
      else virgolette = !virgolette;
    } else if (c === "," && !virgolette) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function leggiParametriCsv(csv: string): { parametri: Parametro[]; scartate: string[] } {
  const righe = csv.replace(/^﻿/, "").split(/\r?\n/).filter((r) => r.trim() !== "");
  const [intest, ...corpo] = righe;
  if (!intest || !/nome_parametro/i.test(intest)) {
    throw new Error("File parametri non riconosciuto: manca l'intestazione nome_parametro,valore,descrizione");
  }
  const parametri: Parametro[] = [];
  const scartate: string[] = [];
  for (const r of corpo) {
    const [nome, valore, ...descr] = campiCsv(r);
    const n = Number(valore);
    if (!nome || !Number.isFinite(n)) { scartate.push(r); continue; }
    parametri.push({ nome, valore: n, descrizione: descr.join(",") });
  }
  return { parametri, scartate };
}
