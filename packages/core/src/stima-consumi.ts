/**
 * Stima del consumo annuo per chi non lo conosce, a partire da poche domande.
 * Valori indicativi, arrotondati, pensati per scegliere l'ordine di grandezza giusto: se il
 * consumo è scritto in bolletta, quello vale sempre di più.
 *
 * Luce: base per numero di persone (la "famiglia tipo" ARERA è 2.700 kWh l'anno) più gli
 * apparecchi elettrici che pesano davvero.
 * Gas: cucina e acqua calda per numero di persone (dalle simulazioni del Portale Offerte),
 * riscaldamento autonomo per metri quadri e zona climatica.

 */
import type { ZonaClimatica } from "./calcolo-gas.js";

export type Persone = 1 | 2 | 3 | 4 | 5;

export interface RisposteLuce {
  persone: Persone;
  /** Piano cottura a induzione o forno elettrico usato spesso. */
  induzione?: boolean;
  /** Acqua calda con scaldabagno elettrico (boiler). */
  scaldabagno?: boolean;
  /** Condizionatore usato d'estate. */
  condizionatore?: boolean;
  /** Riscaldamento con pompa di calore o stufe elettriche. */
  pompaDiCalore?: boolean;
  /** Auto elettrica ricaricata a casa. */
  autoElettrica?: boolean;
}

export const LUCE_BASE: Record<Persone, number> = { 1: 1400, 2: 2000, 3: 2500, 4: 2900, 5: 3300 };
export const LUCE_EXTRA = { induzione: 450, scaldabagno: 900, condizionatore: 350, pompaDiCalore: 2500, autoElettrica: 2000 } as const;

export function stimaConsumoLuce(r: RisposteLuce): number {
  let kwh = LUCE_BASE[r.persone];
  for (const k of Object.keys(LUCE_EXTRA) as Array<keyof typeof LUCE_EXTRA>) if (r[k]) kwh += LUCE_EXTRA[k];
  return Math.round(kwh / 50) * 50;
}

export interface RisposteGas {
  persone: Persone;
  cucina: boolean;
  acquaCalda: boolean;
  riscaldamento: boolean;
  /** Superficie riscaldata, solo con riscaldamento autonomo. */
  metriQuadri?: number;
  zona: ZonaClimatica;
}

export const GAS_CUCINA: Record<Persone, number> = { 1: 135, 2: 135, 3: 170, 4: 170, 5: 230 };
export const GAS_ACQUA_CALDA: Record<Persone, number> = { 1: 310, 2: 350, 3: 400, 4: 450, 5: 510 };
/** Smc l'anno per metro quadro riscaldato, per zona climatica. */
export const GAS_RISCALDAMENTO_MQ: Record<string, number> = { A: 4, B: 6, C: 9, D: 13, E: 16, F: 20 };

export function stimaConsumoGas(r: RisposteGas): number {
  let smc = 0;
  if (r.cucina) smc += GAS_CUCINA[r.persone];
  if (r.acquaCalda) smc += GAS_ACQUA_CALDA[r.persone];
  if (r.riscaldamento) smc += Math.max(0, r.metriQuadri ?? 80) * (GAS_RISCALDAMENTO_MQ[r.zona] ?? 13);
  return Math.round(smc / 10) * 10;
}
