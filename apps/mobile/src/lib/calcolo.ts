/** Classifica e voto della tua offerta: stessa logica del sito (apps/web/src/scripts/risultati.ts). */
import {
  classifica, offertaDaBolletta, valutaOfferta, votoPrezzo, ZONA_CLIMATICA_TIPICA,
  type DatiBolletta, type ProfiloClassifica, type RisultatoOfferta, type VocePagella,
} from "@pagella/core";
import type { Dati } from "./dati";

export type Zona = "B" | "C" | "D" | "E" | "F";
export interface Profilo {
  c: "luce" | "gas";
  cons: number;
  kw: number;
  res: boolean;
  comune?: string;
  zona: Zona;
  cod?: string;
  spesa?: number;
  bolletta?: Pick<DatiBolletta, "nomeOfferta" | "tipoPrezzo" | "prezzoVendita" | "quotaFissaMese" | "periodo" | "penaleRecesso" | "spesaAnnua">;
  /** La bolletta è stata letta dall'app (per l'etichetta "Bolletta letta"). */
  daBolletta: boolean;
}

export const profiloIniziale = (c: "luce" | "gas" = "luce"): Profilo => ({ c, cons: 0, kw: 3, res: true, zona: "D", daBolletta: false });

/** Consumo e comune sono obbligatori: senza, la classifica sarebbe fuorviante. */
export const profiloCompleto = (p: Profilo) => p.cons > 0 && !!p.comune;

export interface Esito {
  risultati: RisultatoOfferta[];
  tua: RisultatoOfferta | null;
  origine: "portale" | "bolletta" | "spesa" | null;
  soloPrezzo: VocePagella | null;
  riferimento: number | null;
}

export function zonaPerComune(dati: Dati, comune?: string): Zona | undefined {
  const c = dati.comuni.find((x) => x.codice === comune);
  return c ? ZONA_CLIMATICA_TIPICA[c.regione] : undefined;
}

export function calcola(p: Profilo, dati: Dati): Esito {
  const com = dati.comuni.find((c) => c.codice === p.comune);
  const luogo = com ? { comune: com.codice, provincia: com.provincia, regione: com.regione } : undefined;
  const profilo: ProfiloClassifica = p.c === "luce"
    ? { commodity: "luce", luce: { consumoAnnuoKwh: p.cons, potenzaKw: p.kw, residente: p.res }, ...(luogo ? { luogo } : {}) }
    : { commodity: "gas", gas: { consumoAnnuoSmc: p.cons, regione: com?.regione ?? "09", zonaClimatica: p.zona }, ...(luogo ? { luogo } : {}) };
  const { mercato, offerte } = dati;
  let risultati = classifica(offerte, profilo, mercato.parametri, mercato.scenari);
  const propria = p.cod ? offerte.find((o) => o.codice.toUpperCase() === p.cod!.toUpperCase()) : undefined;
  let tua = propria ? valutaOfferta(propria, profilo, mercato.parametri, mercato.scenari, risultati) : null;
  let origine: Esito["origine"] = tua ? "portale" : null;
  if (!tua && p.bolletta?.prezzoVendita !== undefined) {
    const ricostruita = offertaDaBolletta({ ...p.bolletta, commodity: p.c, ...(p.cod ? { codiceOfferta: p.cod } : {}), trovati: [] }, mercato.indici, mercato.parametri);
    tua = ricostruita ? valutaOfferta(ricostruita, profilo, mercato.parametri, mercato.scenari, risultati) : null;
    if (tua) origine = "bolletta";
  }
  if (tua) risultati = risultati.filter((r) => r.offerta.codice !== tua!.offerta.codice);
  const spesa = p.spesa ?? p.bolletta?.spesaAnnua;
  let soloPrezzo: VocePagella | null = null;
  if (!tua && spesa && risultati.length) {
    soloPrezzo = votoPrezzo(spesa, [...risultati.map((r) => r.stima.totale), spesa]);
    origine = "spesa";
  }
  return { risultati, tua, origine, soloPrezzo, riferimento: tua ? tua.stima.totale : spesa ?? null };
}
