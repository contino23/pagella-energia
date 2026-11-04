/** Caricamento dei dati statici pubblicati dalla pipeline (una volta per pagina). */
import type { Offerta, Parametro, ScenariIndici } from "@pagella/core";

export interface Mercato {
  data: string;
  conteggi: { offerte: number; venditori: number };
  parametri: { luce: Parametro[]; gas: Parametro[] };
  scenari: ScenariIndici;
  indici: Array<{ mese: string; PUN: number | null; PSV: number | null }>;
}
export interface Comune { codice: string; nome: string; sigla: string; provincia: string; regione: string; cap: string[] }

const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
const cache = new Map<string, Promise<unknown>>();
function carica<T>(nome: string): Promise<T> {
  if (!cache.has(nome)) {
    cache.set(nome, fetch(`${base}dati/${nome}`).then((r) => {
      if (!r.ok) throw new Error(`Impossibile scaricare ${nome} (${r.status})`);
      return r.json();
    }));
  }
  return cache.get(nome) as Promise<T>;
}

export const caricaMercato = () => carica<Mercato>("mercato.json");
export const caricaOfferte = () => carica<{ data: string; offerte: Offerta[] }>("offerte.json").then((x) => x.offerte);
export const caricaComuni = () =>
  carica<{ comuni: string[][] }>("comuni.json").then((x) =>
    x.comuni.map(([codice, nome, sigla, provincia, regione, cap]) => ({ codice: codice!, nome: nome!, sigla: sigla!, provincia: provincia!, regione: regione!, cap: (cap ?? "").split(" ").filter(Boolean) })),
  );

export const URL_RISULTATI = `${base}risultati/`;
