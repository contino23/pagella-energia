/**
 * Inserimento manuale come percorso guidato: una domanda per schermata.
 * I dati finiscono nel # dell'indirizzo della pagina risultati, quindi non arrivano mai al server.
 */
import { stimaConsumoGas, stimaConsumoLuce, ZONA_CLIMATICA_TIPICA, type Persone } from "@pagella/core";
import { caricaComuni, URL_RISULTATI, type Comune } from "./dati.js";
import { h, numero } from "./formato.js";

type Passo = "fornitura" | "comune" | "sai" | "persone" | "usi" | "stima" | "dettagli";
const GRUPPI = ["Fornitura", "Comune", "Consumo", "Dettagli"];
const CHIAVI_BOLLETTA = ["nome", "tp", "pv", "qf", "pd", "pa", "pen", "sa", "letti", "cod"];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const form = $<HTMLFormElement>("#guida");
const el = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
const radio = (n: string) => form.querySelector<HTMLInputElement>(`input[name="${n}"]:checked`)?.value;
const num = (x: string) => Number(x.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
const etichetta = (c: Comune) => `${c.nome} (${c.sigla})`;

const iniziali = new URLSearchParams(location.hash.slice(1));
const daBolletta = iniziali.has("letti") || iniziali.has("nome") || iniziali.has("pv");
let comuni: Comune[] = [];
let comune: Comune | undefined;
let storia: Passo[] = [];
let stimaCalcolata = 0;

const commodity = () => (radio("c") === "gas" ? "gas" : "luce") as "luce" | "gas";
const unita = () => (commodity() === "gas" ? "Smc" : "kWh");

function percorso(): Passo[] {
  const p: Passo[] = ["fornitura", "comune", "sai"];
  if (radio("sai") === "no") p.push("persone", "usi", "stima");
  p.push("dettagli");
  return p;
}

function mostra(passo: Passo, focus = true) {
  form.querySelectorAll<HTMLElement>(".passo").forEach((s) => (s.hidden = s.dataset.passo !== passo));
  const c = commodity();
  form.querySelectorAll<HTMLElement>("[data-solo]").forEach((x) => (x.hidden = x.dataset.solo !== c));
  form.querySelectorAll<HTMLElement>(".unita").forEach((x) => (x.textContent = unita()));
  if (passo === "usi") $("#campo-mq").hidden = c !== "gas" || !el("riscaldamento").checked;
  if (passo === "stima") preparaStima();
  const sezione = form.querySelector<HTMLElement>(`[data-passo="${passo}"]`)!;
  const gruppo = Number(sezione.dataset.gruppo);
  $("#barra").style.width = `${(gruppo / GRUPPI.length) * 100}%`;
  $("#passo-n").textContent = `Passo ${gruppo} di ${GRUPPI.length} · ${GRUPPI[gruppo - 1]}`;
  $("#indietro").style.visibility = storia.length > 1 ? "visible" : "hidden";
  const avanti = $<HTMLButtonElement>("#avanti");
  avanti.textContent = passo === "dettagli" ? "Vedi le offerte" : passo === "stima" ? "Va bene, avanti" : "Avanti";
  // Nelle domande a scelta singola si va avanti toccando la risposta.
  avanti.hidden = passo === "fornitura" || passo === "persone" || (passo === "sai" && !radio("sai"));
  window.scrollTo({ top: 0 });
  if (!focus) return;
  const primo = passo === "comune" ? el("comune") : passo === "sai" && radio("sai") === "si" ? el("cons") : sezione.querySelector<HTMLElement>("h1");
  if (primo?.tagName === "H1") primo.setAttribute("tabindex", "-1");
  primo?.focus({ preventScroll: true });
}

function vai(passo: Passo) {
  storia.push(passo);
  history.pushState({ passi: storia.length }, "");
  mostra(passo);
}

function errore(id: string, input: HTMLInputElement, msg: string | null): boolean {
  const e = $(`#${id}`);
  e.hidden = !msg;
  e.textContent = msg ?? "";
  input.setAttribute("aria-invalid", msg ? "true" : "false");
  if (msg) input.focus();
  return !msg;
}

function valida(passo: Passo): boolean {
  if (passo === "comune") return errore("err-comune", el("comune"), comune ? null : "Scegli il tuo comune dall'elenco: scrivi le prime lettere e toccalo.");
  if (passo === "sai" && radio("sai") === "si") return errore("err-cons", el("cons"), num(el("cons").value) > 0 ? null : `Scrivi il consumo annuo in ${unita()}, oppure scegli "No, aiutami a stimarlo".`);
  if (passo === "stima") return num(el("cons-stima").value) > 0;
  return true;
}

function avanti() {
  const ora = storia[storia.length - 1]!;
  if (!valida(ora)) return;
  if (ora === "dettagli") return fine();
  const p = percorso();
  vai(p[p.indexOf(ora) + 1]!);
}

/* ---------- comune ---------- */

function suggerisci() {
  const q = el("comune").value.trim().toLowerCase();
  const ul = $("#suggerimenti");
  if (comune && etichetta(comune).toLowerCase() === q) { ul.innerHTML = ""; return; }
  comune = undefined;
  const trovati = q.length < 2 ? [] : [
    ...comuni.filter((c) => c.nome.toLowerCase() === q),
    ...comuni.filter((c) => c.nome.toLowerCase().startsWith(q) && c.nome.toLowerCase() !== q),
  ].slice(0, 6);
  ul.innerHTML = trovati.map((c) => `<li><button type="button" data-comune="${h(c.codice)}">${h(c.nome)} <span>(${h(c.sigla)})</span></button></li>`).join("")
    || (q.length >= 2 ? `<li class="nessuno">Nessun comune trovato con questo nome</li>` : "");
}

function scegliComune(c: Comune) {
  comune = c;
  el("comune").value = etichetta(c);
  $("#suggerimenti").innerHTML = "";
  $("#err-comune").hidden = true;
  const zona = ZONA_CLIMATICA_TIPICA[c.regione] ?? "D";
  const z = form.querySelector<HTMLInputElement>(`input[name="zona"][value="${zona}"]`);
  if (z) z.checked = true;
  $("#zona-nota").textContent = `L'abbiamo proposta per ${c.nome}: cambiala solo se la conosci.`;
}

/* ---------- stima ---------- */

function preparaStima() {
  const persone = Number(radio("persone") ?? 3) as Persone;
  const gas = commodity() === "gas";
  const zona = (radio("zona") ?? "D") as "D";
  const mq = num(el("mq").value) || 80;
  stimaCalcolata = gas
    ? stimaConsumoGas({ persone, cucina: el("cucina").checked, acquaCalda: el("acquaCalda").checked, riscaldamento: el("riscaldamento").checked, metriQuadri: mq, zona })
    : stimaConsumoLuce({ persone, induzione: el("induzione").checked, scaldabagno: el("scaldabagno").checked, condizionatore: el("condizionatore").checked, pompaDiCalore: el("pompaDiCalore").checked, autoElettrica: el("autoElettrica").checked });
  $("#stima-valore").textContent = `${numero(stimaCalcolata)} ${unita()}`;
  el("cons-stima").value = String(stimaCalcolata);
  const chi = persone === 5 ? "5 o più persone" : persone === 1 ? "1 persona" : `${persone} persone`;
  const usi = gas
    ? ["cucina", "acquaCalda", "riscaldamento"].filter((k) => el(k).checked).map((k) => ({ cucina: "fornelli", acquaCalda: "acqua calda", riscaldamento: `riscaldamento di ${numero(mq)} m² in zona ${zona}` })[k]!)
    : ["induzione", "scaldabagno", "condizionatore", "pompaDiCalore", "autoElettrica"].filter((k) => el(k).checked).map((k) => ({ induzione: "induzione", scaldabagno: "scaldabagno elettrico", condizionatore: "condizionatore", pompaDiCalore: "riscaldamento elettrico", autoElettrica: "auto elettrica" })[k]!);
  $("#stima-spiega").textContent = `Per una casa con ${chi}${usi.length ? `, con ${usi.join(", ")}` : ""}. Lo usiamo per calcolare la spesa con ogni offerta.`;
}

/* ---------- fine ---------- */

function fine() {
  const c = commodity();
  const cambiata = iniziali.get("c") && iniziali.get("c") !== c;
  const p = new URLSearchParams(iniziali);
  // Se cambi fornitura, i dati letti dalla bolletta non valgono più.
  if (cambiata) CHIAVI_BOLLETTA.forEach((k) => p.delete(k));
  p.set("c", c);
  p.set("cons", String(radio("sai") === "no" ? num(el("cons-stima").value) : num(el("cons").value)));
  p.set("comune", comune!.codice);
  if (c === "luce") { p.set("kw", radio("kw") ?? "3"); p.set("res", radio("res") ?? "1"); p.delete("zona"); }
  else { p.set("zona", radio("zona") ?? "D"); p.delete("kw"); p.set("res", "1"); }
  const spesa = num(el("spesa").value), cod = el("cod").value.trim().toUpperCase();
  if (spesa > 0) p.set("spesa", String(spesa)); else p.delete("spesa");
  if (cod) p.set("cod", cod); else if (!daBolletta || cambiata) p.delete("cod");
  location.href = `${URL_RISULTATI}#${p.toString()}`;
}

/* ---------- avvio ---------- */

async function avvia() {
  // Precompila con quello che sappiamo già (per esempio dalla bolletta letta).
  const c = iniziali.get("c") === "gas" ? "gas" : "luce";
  form.querySelector<HTMLInputElement>(`input[name="c"][value="${c}"]`)!.checked = !!iniziali.get("c");
  const kw = iniziali.get("kw") ?? "3";
  (form.querySelector<HTMLInputElement>(`input[name="kw"][value="${kw}"]`) ?? form.querySelector<HTMLInputElement>(`input[name="kw"][value="3"]`))!.checked = true;
  form.querySelector<HTMLInputElement>(`input[name="res"][value="${iniziali.get("res") === "0" ? "0" : "1"}"]`)!.checked = true;
  form.querySelector<HTMLInputElement>(`input[name="zona"][value="D"]`)!.checked = true;
  const cons = Number(iniziali.get("cons"));
  if (cons > 0) { form.querySelector<HTMLInputElement>(`input[name="sai"][value="si"]`)!.checked = true; el("cons").value = String(cons); $("#campo-consumo").hidden = false; }
  if (Number(iniziali.get("spesa")) > 0) el("spesa").value = iniziali.get("spesa")!;
  if (iniziali.get("cod")) el("cod").value = iniziali.get("cod")!;
  if (el("spesa").value || el("cod").value) ($("#facoltativo") as HTMLDetailsElement).open = true;

  comuni = await caricaComuni();
  const com = comuni.find((x) => x.codice === iniziali.get("comune"));
  if (com) scegliComune(com);
  const z = iniziali.get("zona");
  if (z) { const r = form.querySelector<HTMLInputElement>(`input[name="zona"][value="${z}"]`); if (r) r.checked = true; }

  // Si parte dalla prima cosa che manca.
  const inizio: Passo = !iniziali.get("c") ? "fornitura" : !com ? "comune" : !(cons > 0) ? "sai" : "dettagli";
  storia = [inizio];
  history.replaceState({ passi: 1 }, "");
  mostra(inizio, false);
}

form.addEventListener("submit", (e) => { e.preventDefault(); avanti(); });
$("#indietro").addEventListener("click", () => history.back());
window.addEventListener("popstate", () => {
  if (storia.length > 1) { storia.pop(); mostra(storia[storia.length - 1]!); }
});
form.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name === "c") { el("cons").value = ""; }
  if (t.name === "sai") {
    $("#campo-consumo").hidden = t.value !== "si";
    $("#avanti").hidden = false;
    if (t.value === "si") el("cons").focus();
  }
  if (t.name === "riscaldamento") $("#campo-mq").hidden = !t.checked;
});
// Nelle domande a scelta singola basta toccare la risposta (anche quella già scelta, tornando indietro).
form.addEventListener("click", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.tagName === "INPUT" && t.dataset.avanti !== undefined) setTimeout(avanti, 150);
});
el("cons").addEventListener("input", () => { $("#err-cons").hidden = true; });
el("comune").addEventListener("input", suggerisci);
el("comune").addEventListener("keydown", (e) => {
  // Invio sceglie il primo comune suggerito.
  if (e.key !== "Enter" || comune) return;
  const primo = $("#suggerimenti").querySelector<HTMLButtonElement>("[data-comune]");
  if (primo) { e.preventDefault(); primo.click(); }
});
$("#suggerimenti").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-comune]");
  const c = b && comuni.find((x) => x.codice === b.dataset.comune);
  if (c) { scegliComune(c); setTimeout(avanti, 150); }
});

avvia().catch(() => {
  $("#passo-n").textContent = "Non siamo riusciti a caricare l'elenco dei comuni. Ricarica la pagina tra qualche minuto.";
});
