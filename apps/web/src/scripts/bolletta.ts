/**
 * Lettura della bolletta nel browser: il file non lascia mai il dispositivo.
 * PDF → testo con pdf.js (caricato solo quando serve) → dati con estraiDatiBolletta.
 * Prima di mostrare i risultati facciamo vedere all'utente cosa abbiamo letto, passo per passo.
 */
import { estraiDatiBolletta, type DatiBolletta } from "@pagella/core";
import { caricaComuni, caricaOfferte, URL_RISULTATI, type Comune } from "./dati.js";
import { euro, h, ICONE, numero } from "./formato.js";

export async function testoDaPdf(file: File, avanzamento?: (pagina: number, totale: number) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pagine: string[] = [];
  const totale = Math.min(doc.numPages, 6);
  for (let n = 1; n <= totale; n++) {
    avanzamento?.(n, totale);
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

export interface EsitoLettura {
  dati: DatiBolletta;
  comune?: Comune;
  /** Il codice offerta è tra quelle pubblicate oggi nel Portale. */
  nelPortale: boolean;
  offerteConfrontate: number;
}

type Passo = "apri" | "testo" | "offerta";

export async function leggiBolletta(file: File, passo: (p: Passo, dettaglio?: string) => void = () => {}): Promise<EsitoLettura> {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
    throw new Error("Per ora leggiamo le bollette in PDF. La lettura delle foto arriverà presto: intanto puoi inserire i dati a mano.");
  }
  passo("apri");
  const offerteP = caricaOfferte();
  const testo = await testoDaPdf(file, (n, tot) => passo("testo", `pagina ${n} di ${tot}`));
  const offerte = await offerteP;
  passo("offerta", `${numero(offerte.length)} offerte di oggi`);
  const codici = new Set(offerte.map((o) => o.codice));
  const dati = estraiDatiBolletta(testo, codici);
  let comune: Comune | undefined;
  if (dati.cap) comune = (await caricaComuni()).find((c) => c.cap.includes(dati.cap!));
  const esito: EsitoLettura = { dati, nelPortale: !!dati.codiceOfferta && codici.has(dati.codiceOfferta), offerteConfrontate: offerte.length };
  if (comune) esito.comune = comune;
  return esito;
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
  if (e.comune) p.set("comune", e.comune.codice);
  // Prezzi letti in bolletta: servono a dare il voto anche alle offerte non più in vendita.
  if (d.nomeOfferta) p.set("nome", d.nomeOfferta);
  if (d.tipoPrezzo) p.set("tp", d.tipoPrezzo === "variabile" ? "v" : "f");
  if (d.prezzoVendita !== undefined) p.set("pv", String(d.prezzoVendita));
  if (d.quotaFissaMese !== undefined) p.set("qf", String(d.quotaFissaMese));
  if (d.periodo) { p.set("pd", d.periodo.da); p.set("pa", d.periodo.a); }
  if (d.penaleRecesso !== undefined) p.set("pen", d.penaleRecesso ? "1" : "0");
  if (d.spesaAnnua) p.set("sa", String(Math.round(d.spesaAnnua)));
  p.set("letti", d.trovati.join(","));
  return `${URL_RISULTATI}#${p.toString()}`;
}

const prezzo = (x: number, u: string) => `${x.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 4 })} €/${u}`;

/** Righe del riepilogo: cosa abbiamo letto e cosa manca. */
function righeRiepilogo(e: EsitoLettura): Array<{ etichetta: string; valore?: string; nota?: string }> {
  const d = e.dati;
  const gas = d.commodity === "gas";
  const u = gas ? "Smc" : "kWh";
  const righe: Array<{ etichetta: string; valore?: string; nota?: string }> = [
    { etichetta: "Fornitura", valore: d.commodity ? (gas ? "Gas" : "Luce") : undefined },
    { etichetta: "Offerta", valore: d.nomeOfferta ?? d.codiceOfferta, nota: d.codiceOfferta && d.nomeOfferta ? d.codiceOfferta : undefined },
    {
      etichetta: "Prezzo",
      valore: d.prezzoVendita !== undefined ? `${d.tipoPrezzo === "variabile" ? "Variabile" : d.tipoPrezzo === "fisso" ? "Fisso" : ""} · ${prezzo(d.prezzoVendita, u)}`.replace(/^ · /, "") : d.tipoPrezzo ? (d.tipoPrezzo === "variabile" ? "Variabile" : "Fisso") : undefined,
      nota: d.quotaFissaMese !== undefined ? `più ${d.quotaFissaMese.toLocaleString("it-IT", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} € al mese di quota fissa` : undefined,
    },
    { etichetta: "Consumo annuo", valore: d.consumoAnnuo ? `${numero(d.consumoAnnuo)} ${u}` : undefined },
  ];
  if (!gas) righe.push({ etichetta: "Potenza", valore: d.potenzaKw ? `${String(d.potenzaKw).replace(".", ",")} kW` : undefined });
  righe.push({ etichetta: "Comune", valore: e.comune ? `${e.comune.nome} (${e.comune.sigla})` : d.cap ? `CAP ${d.cap}` : undefined });
  if (!gas) righe.push({ etichetta: "Residente", valore: d.residente === undefined ? undefined : d.residente ? "Sì" : "No" });
  righe.push({ etichetta: "Spesa ultimo anno", valore: d.spesaAnnua ? euro(d.spesaAnnua) : undefined });
  return righe;
}

function htmlEsito(e: EsitoLettura): string {
  const d = e.dati;
  if (e.nelPortale) return `<p class="lettura-nota buona">${ICONE.spunta}<span>La tua offerta è tra le ${numero(e.offerteConfrontate)} pubblicate oggi nel Portale Offerte: il voto è calcolato con le sue condizioni ufficiali.</span></p>`;
  if (d.prezzoVendita !== undefined) return `<p class="lettura-nota">${ICONE.spunta}<span>La tua offerta non è più in vendita, ma abbiamo letto i suoi prezzi in bolletta: il voto è calcolato con quelli.</span></p>`;
  if (d.spesaAnnua) return `<p class="lettura-nota">${ICONE.attenzione}<span>Non abbiamo trovato i prezzi della tua offerta: il voto sarà sul solo prezzo, partendo da quanto hai speso nell'ultimo anno.</span></p>`;
  return `<p class="lettura-nota">${ICONE.attenzione}<span>Non abbiamo trovato prezzi né spesa annua: nella pagina dei risultati scrivi quanto spendi all'anno per avere il voto.</span></p>`;
}

/** Collega un'area di caricamento (drag & drop + selettore file) alla lettura con riepilogo. */
export function collegaCaricatore(area: HTMLElement, input: HTMLInputElement, stato: HTMLElement): void {
  const pannello = document.createElement("div");
  pannello.className = "lettura";
  pannello.setAttribute("aria-live", "polite");
  const originali = () => [...area.children].filter((c) => c !== pannello) as HTMLElement[];
  const mostraPannello = (html: string) => {
    for (const c of originali()) c.hidden = true;
    area.classList.add("in-lettura");
    pannello.innerHTML = html;
    if (!pannello.isConnected) area.append(pannello);
  };
  const ripristina = () => {
    pannello.remove();
    area.classList.remove("in-lettura");
    for (const c of originali()) c.hidden = false;
    input.value = "";
  };

  const PASSI: Array<[Passo, string]> = [["apri", "Apro il PDF sul tuo dispositivo"], ["testo", "Leggo il testo della bolletta"], ["offerta", "Riconosco la tua offerta"]];
  const disegnaPassi = (attuale: Passo, dettaglio?: string) => {
    const i = PASSI.findIndex(([p]) => p === attuale);
    mostraPannello(`<strong class="lettura-titolo">Sto leggendo la bolletta…</strong><ol class="lettura-passi">${PASSI.map(([, t], j) =>
      `<li class="${j < i ? "fatto" : j === i ? "ora" : ""}"><span class="segno" aria-hidden="true">${j < i ? ICONE.spunta : ""}</span><span>${h(t)}${j === i && dettaglio ? ` <small>· ${h(dettaglio)}</small>` : ""}</span></li>`).join("")}</ol>
      <p class="lettura-privacy">Il file non viene caricato su nessun server.</p>`);
  };

  const gestisci = async (file?: File | null) => {
    if (!file) return;
    stato.classList.remove("errore");
    stato.textContent = "";
    try {
      disegnaPassi("apri");
      const esito = await leggiBolletta(file, disegnaPassi);
      if (esito.dati.trovati.length === 0) throw new Error("Non abbiamo trovato i dati in questa bolletta. Puoi inserirli a mano: servono pochi secondi.");
      const righe = righeRiepilogo(esito);
      const mancanti = righe.filter((r) => !r.valore).length;
      const icona = esito.dati.commodity === "gas" ? ICONE.fiamma : ICONE.fulmine;
      mostraPannello(`<span class="pe-chip pe-chip-${esito.dati.commodity ?? "luce"}" style="align-self:flex-start">${icona}Bolletta letta</span>
        <strong class="lettura-titolo">Ecco cosa abbiamo letto</strong>
        <dl class="lettura-dati">${righe.map((r) => `<div class="${r.valore ? "" : "manca"}"><dt>${h(r.etichetta)}</dt><dd>${r.valore ? `${h(r.valore)}${r.nota ? `<small>${h(r.nota)}</small>` : ""}` : "Non trovato, lo potrai inserire tu"}</dd></div>`).join("")}</dl>
        ${htmlEsito(esito)}
        <a class="pe-btn" href="${h(indirizzoRisultati(esito))}" data-conferma>Vedi il voto e le offerte</a>
        <span class="lettura-sotto">${mancanti ? "Ti chiederemo i dati che mancano, con poche domande." : "Se qualcosa non torna, potrai correggerlo nella pagina dei risultati."} <button type="button" class="lettura-altra">Carica un'altra bolletta</button></span>`);
      pannello.querySelector<HTMLAnchorElement>("[data-conferma]")!.focus();
      pannello.querySelector("[data-conferma]")!.addEventListener("click", () => {
        // Sulla pagina risultati cambia solo il #: chiudiamo il pannello e torniamo in cima.
        setTimeout(() => { ripristina(); window.scrollTo({ top: 0 }); }, 0);
      });
      pannello.querySelector(".lettura-altra")!.addEventListener("click", () => { ripristina(); input.click(); });
    } catch (err) {
      ripristina();
      stato.classList.add("errore");
      stato.textContent = err instanceof Error ? err.message : "Non siamo riusciti a leggere il file.";
    }
  };
  input.addEventListener("change", () => gestisci(input.files?.[0]));
  area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("sopra"); });
  area.addEventListener("dragleave", () => area.classList.remove("sopra"));
  area.addEventListener("drop", (e) => { e.preventDefault(); area.classList.remove("sopra"); gestisci(e.dataTransfer?.files?.[0]); });
}
