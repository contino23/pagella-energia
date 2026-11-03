/**
 * Scenari di prezzo per le offerte variabili.
 *
 * Scelta di metodo (3/11/2026): voto e classifica usano la media degli ultimi 3 mesi
 * di ciascun indice, il riferimento più vicino al mercato attuale tra quelli pubblici.
 * La forchetta mostra la spesa con il valore minimo e massimo degli ultimi 12 mesi.
 */
import type { ScenarioIndici } from "./calcolo-luce.js";

export interface ValoreIndiceMese {
  mese: string; // "AAAA-MM"
  indici: Record<string, number>;
}

export interface ScenariIndici {
  centrale: ScenarioIndici;
  basso: ScenarioIndici;
  alto: ScenarioIndici;
}

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
export const nomeMese = (m: string) => `${MESI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export const MESI_SCENARIO_CENTRALE = 3;

export function creaScenari(storico: ValoreIndiceMese[], mesiCentrale = MESI_SCENARIO_CENTRALE): ScenariIndici {
  const ord = [...storico].sort((a, b) => a.mese.localeCompare(b.mese));
  const ultimi12 = ord.slice(-12);
  const recenti = ord.slice(-mesiCentrale);
  const nomi = new Set(ultimi12.flatMap((r) => Object.keys(r.indici)));
  const centrale: Record<string, number> = {}, basso: Record<string, number> = {}, alto: Record<string, number> = {};
  for (const k of nomi) {
    const r = recenti.map((x) => x.indici[k]).filter((v): v is number => v !== undefined);
    const a = ultimi12.map((x) => x.indici[k]).filter((v): v is number => v !== undefined);
    if (r.length) centrale[k] = r.reduce((s, v) => s + v, 0) / r.length;
    if (a.length) { basso[k] = Math.min(...a); alto[k] = Math.max(...a); }
  }
  const periodo = (xs: ValoreIndiceMese[]) => (xs.length ? `${nomeMese(xs[0]!.mese)} – ${nomeMese(xs.at(-1)!.mese)}` : "nessun dato");
  return {
    centrale: { valori: centrale, descrizione: `Media ${periodo(recenti)}` },
    basso: { valori: basso, descrizione: `Valore minimo ${periodo(ultimi12)}` },
    alto: { valori: alto, descrizione: `Valore massimo ${periodo(ultimi12)}` },
  };
}

/** Spesa stimata nei tre scenari; per le offerte fisse i tre valori coincidono. */
export function forchetta<T extends { totale: number }>(calcola: (s: ScenarioIndici) => T, scenari: ScenariIndici) {
  const c = calcola(scenari.centrale);
  return { centrale: c, minimo: calcola(scenari.basso).totale, massimo: calcola(scenari.alto).totale };
}
