/**
 * Lettura della bolletta nel browser: il file non lascia mai il dispositivo.
 * PDF → testo con pdf.js (caricato solo quando serve) → dati con estraiDatiBolletta.
 */
import { estraiDatiBolletta, type DatiBolletta } from "@pagella/core";
import { caricaComuni, caricaOfferte, URL_RISULTATI } from "./dati.js";

export async function testoDaPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pagine: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
    const contenuto = await (await doc.getPage(n)).getTextContent();
    let riga = "", y: number | null = null;
    const righe: string[] = [];
    for (const it of contenuto.items as Array<{ str: string; transform: number[] }>) {
      const yy = Math.round(it.transform[5] ?? 0);
      if (y !== null && Math.abs(yy - y) > 2) { righe.push(riga); riga = ""; }
      riga += (riga && !riga.endsWith(" ") ? " " : "") + it.str;
      y = yy;
    }
    righe.push(riga);
    pagine.push(righe.join("\n"));
  }
  await doc.destroy();
  return pagine.join("\n");
}

export interface EsitoLettura { dati: DatiBolletta; comune?: string }

export async function leggiBolletta(file: File): Promise<EsitoLettura> {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
    throw new Error("Per ora leggiamo le bollette in PDF. La lettura delle foto arriverà presto: intanto puoi inserire i dati a mano.");
  }
  const [testo, offerte] = await Promise.all([testoDaPdf(file), caricaOfferte()]);
  const dati = estraiDatiBolletta(testo, new Set(offerte.map((o) => o.codice)));
  let comune: string | undefined;
  if (dati.cap) {
    const comuni = await caricaComuni();
    comune = comuni.find((c) => c.cap.includes(dati.cap!))?.codice;
  }
  return comune ? { dati, comune } : { dati };
}

/** Indirizzo della pagina risultati: i dati stanno dopo il #, quindi non arrivano mai al server. */
export function indirizzoRisultati(e: EsitoLettura): string {
  const p = new URLSearchParams();
  const d = e.dati;
  p.set("c", d.commodity ?? "luce");
  if (d.consumoAnnuo) p.set("cons", String(d.consumoAnnuo));
  if (d.potenzaKw) p.set("kw", String(d.potenzaKw));
  if (d.residente !== undefined) p.set("res", d.residente ? "1" : "0");
  if (d.codiceOfferta) p.set("cod", d.codiceOfferta);
  if (e.comune) p.set("comune", e.comune);
  p.set("letti", d.trovati.join(","));
  return `${URL_RISULTATI}#${p.toString()}`;
}

/** Collega un'area di caricamento (drag & drop + selettore file) alla lettura. */
export function collegaCaricatore(area: HTMLElement, input: HTMLInputElement, stato: HTMLElement): void {
  const gestisci = async (file?: File | null) => {
    if (!file) return;
    stato.classList.remove("errore");
    stato.textContent = "Sto leggendo la bolletta sul tuo dispositivo…";
    try {
      const esito = await leggiBolletta(file);
      if (esito.dati.trovati.length === 0) throw new Error("Non abbiamo trovato i dati in questa bolletta. Puoi inserirli a mano: servono pochi secondi.");
      location.href = indirizzoRisultati(esito);
    } catch (err) {
      stato.classList.add("errore");
      stato.textContent = err instanceof Error ? err.message : "Non siamo riusciti a leggere il file.";
    }
  };
  input.addEventListener("change", () => gestisci(input.files?.[0]));
  area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("sopra"); });
  area.addEventListener("dragleave", () => area.classList.remove("sopra"));
  area.addEventListener("drop", (e) => { e.preventDefault(); area.classList.remove("sopra"); gestisci(e.dataTransfer?.files?.[0]); });
}
