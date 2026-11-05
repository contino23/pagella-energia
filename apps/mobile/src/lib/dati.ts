/**
 * Dati del mercato: gli stessi file pubblicati ogni giorno per il sito.
 * Si scaricano una volta al giorno e restano sul telefono, così l'app funziona anche offline.
 */
import { File, Paths } from "expo-file-system";
import type { Offerta, Parametro, ScenariIndici } from "@pagella/core";

export const SITO = process.env.EXPO_PUBLIC_SITO ?? "https://contino23.github.io/pagella-energia/";
const DATI = `${SITO}dati/`;

export interface Migliore { codice: string; nome: string; sito?: string; prezzo: Offerta["prezzo"]; durataMesi: number | null; voto: number; spesaAnnua: number; avvisi: number }
export interface Mercato {
  data: string;
  conteggi: { offerte: number; venditori: number };
  parametri: { luce: Parametro[]; gas: Parametro[] };
  scenari: ScenariIndici;
  indici: Array<{ mese: string; PUN: number | null; PSV: number | null }>;
  famigliaTipo: { luce: { consumoAnnuoKwh: number; potenzaKw: number; residente: boolean }; gas: { consumoAnnuoSmc: number } };
  migliori: { luce: Migliore[]; gas: Migliore[] };
}
export interface Comune { codice: string; nome: string; sigla: string; provincia: string; regione: string; cap: string[] }
export interface Dati { mercato: Mercato; offerte: Offerta[]; comuni: Comune[]; daCache: boolean }

const file = (nome: string) => new File(Paths.document, nome);

async function scarica(nome: string): Promise<string> {
  const r = await fetch(`${DATI}${nome}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${nome}: ${r.status}`);
  return r.text();
}

async function salvato(nome: string): Promise<string | null> {
  try {
    const f = file(nome);
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

async function salva(nome: string, testo: string) {
  try {
    const f = file(nome);
    if (!f.exists) f.create();
    await f.write(testo);
  } catch {
    // Se il telefono non ha spazio, l'app funziona lo stesso: riscaricherà la prossima volta.
  }
}

const leggiComuni = (testo: string): Comune[] =>
  (JSON.parse(testo) as { comuni: string[][] }).comuni.map(([codice, nome, sigla, provincia, regione, cap]) => ({
    codice: codice!, nome: nome!, sigla: sigla!, provincia: provincia!, regione: regione!, cap: (cap ?? "").split(" ").filter(Boolean),
  }));

/** Mercato aggiornato se possibile, altrimenti l'ultima copia salvata. */
export async function caricaDati(): Promise<Dati> {
  const [mercatoLocale, offerteLocali, comuniLocali] = await Promise.all(["mercato.json", "offerte.json", "comuni.json"].map(salvato));
  let mercatoTesto = mercatoLocale;
  let daCache = true;
  try {
    mercatoTesto = await scarica("mercato.json");
    daCache = false;
  } catch {
    if (!mercatoTesto) throw new Error("Serve la connessione a Internet per scaricare le offerte la prima volta.");
  }
  const mercato = JSON.parse(mercatoTesto!) as Mercato;
  const vecchio = mercatoLocale ? (JSON.parse(mercatoLocale) as Mercato).data : null;

  let offerteTesto = offerteLocali;
  if (!daCache && (vecchio !== mercato.data || !offerteTesto)) {
    offerteTesto = await scarica("offerte.json");
    await salva("offerte.json", offerteTesto);
  }
  let comuniTesto = comuniLocali;
  if (!comuniTesto && !daCache) {
    comuniTesto = await scarica("comuni.json");
    await salva("comuni.json", comuniTesto);
  }
  if (!daCache) await salva("mercato.json", mercatoTesto!);
  if (!offerteTesto || !comuniTesto) throw new Error("Dati incompleti: riprova con la connessione attiva.");
  return { mercato, offerte: (JSON.parse(offerteTesto) as { offerte: Offerta[] }).offerte, comuni: leggiComuni(comuniTesto), daCache };
}
