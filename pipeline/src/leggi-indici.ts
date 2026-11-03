/**
 * Lettore del file "prezzi storici degli indici" del Portale Offerte.
 * Formato: CSV con ";" e virgola decimale, una riga per mese (AnnoMese = AAAAMM).
 * Colonne attuali: PUN €/kWh, PSV €/Smc, PE €/kWh, CMEM €/Smc, Pfor €/Smc, Psbil €/Smc.
 */
export interface ValoreIndice {
  mese: string; // "2026-09"
  indici: Record<string, number>; // chiave normalizzata: "PUN", "PSV", "PE", "CMEM", "PFOR", "PSBIL"
}

/** "PUN (€/kWh)" → "PUN"; tollera intestazioni con codifica rovinata. */
export function nomeIndice(intestazione: string): string {
  return intestazione.replace(/\(.*\)/, "").trim().toUpperCase();
}

export function leggiIndiciCsv(csv: string): ValoreIndice[] {
  const righe = csv.replace(/^﻿/, "").split(/\r?\n/).filter((r) => r.trim() !== "");
  const [intest, ...corpo] = righe;
  if (!intest || !/^AnnoMese;/i.test(intest)) throw new Error("File indici non riconosciuto: manca la colonna AnnoMese");
  const nomi = intest.split(";").slice(1).map(nomeIndice);
  const out: ValoreIndice[] = [];
  for (const r of corpo) {
    const [am, ...valori] = r.split(";");
    if (!am || !/^\d{6}$/.test(am.trim())) continue;
    const indici: Record<string, number> = {};
    valori.forEach((v, i) => {
      const n = Number(v.trim().replace(",", "."));
      if (v.trim() !== "" && Number.isFinite(n) && nomi[i]) indici[nomi[i]!] = n;
    });
    out.push({ mese: `${am.slice(0, 4)}-${am.slice(4, 6)}`, indici });
  }
  return out.sort((a, b) => a.mese.localeCompare(b.mese));
}
