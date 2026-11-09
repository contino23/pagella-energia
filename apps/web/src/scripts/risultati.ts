/**
 * Pagina risultati: legge i dati dal # dell'indirizzo (o dal modulo), calcola nel browser
 * la classifica con @pagella/core e disegna le schede. Nessun dato lascia il dispositivo.
 */
import { classifica, offertaDaBolletta, valutaOfferta, votoPrezzo, ZONA_CLIMATICA_TIPICA, type DatiBolletta, type Offerta, type ProfiloClassifica, type RisultatoOfferta, type VocePagella } from "@pagella/core";
import { collegaCaricatore } from "./bolletta.js";
import { caricaComuni, caricaMercato, caricaOfferte, type Comune, type Mercato } from "./dati.js";
import { classeVoto, descriviPrezzo, dominio, euro, fattiOfferta, h, ICONE, nomeLeggibile, numero, prezzoKwh, voto } from "./formato.js";

type Filtro = "tutte" | "fisso" | "variabile" | "fissoPulite" | "variabilePulite";
interface Stato {
  c: "luce" | "gas";
  cons: number;
  kw: number;
  res: boolean;
  comune?: string;
  zona: "B" | "C" | "D" | "E" | "F";
  cod?: string;
  spesa?: number;
  letti: string[];
  /** Dati letti in bolletta per ricostruire un'offerta non più in vendita. */
  bolletta?: Pick<DatiBolletta, "nomeOfferta" | "tipoPrezzo" | "prezzoVendita" | "quotaFissaMese" | "periodo" | "penaleRecesso" | "spesaAnnua">;
}

type Origine = "portale" | "bolletta" | "spesa" | null;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const form = $<HTMLFormElement>("#dati");
let mercato: Mercato, offerte: Offerta[], comuni: Comune[];
let risultati: RisultatoOfferta[] = [];
let tua: RisultatoOfferta | null = null;
let origine: Origine = null;
let soloPrezzo: VocePagella | null = null;
let ultimo: Stato | null = null;
let riferimento: number | null = null;
let filtro: Filtro = "tutte";
let mostrate = 10;

function leggiHash(): Stato {
  const p = new URLSearchParams(location.hash.slice(1));
  const c = p.get("c") === "gas" ? "gas" : "luce";
  const num = (k: string, d: number) => (Number(p.get(k)) > 0 ? Number(p.get(k)) : d);
  const s: Stato = {
    c,
    cons: num("cons", 0),
    kw: num("kw", 3),
    res: p.get("res") !== "0",
    zona: (p.get("zona") as Stato["zona"]) || "D",
    letti: (p.get("letti") ?? "").split(",").filter(Boolean),
  };
  const comune = p.get("comune"), cod = p.get("cod"), spesa = Number(p.get("spesa"));
  if (comune) s.comune = comune;
  if (cod) s.cod = cod.toUpperCase();
  if (spesa > 0) s.spesa = spesa;
  const b: NonNullable<Stato["bolletta"]> = {};
  const nome = p.get("nome"), tp = p.get("tp"), pv = Number(p.get("pv")), qf = Number(p.get("qf")), pd = p.get("pd"), pa = p.get("pa"), pen = p.get("pen"), sa = Number(p.get("sa"));
  if (nome) b.nomeOfferta = nome.slice(0, 80);
  if (tp === "v" || tp === "f") b.tipoPrezzo = tp === "v" ? "variabile" : "fisso";
  if (pv > 0 && pv < 5) b.prezzoVendita = pv;
  if (qf >= 0 && p.get("qf")) b.quotaFissaMese = qf;
  if (pd && pa && /^\d{4}-\d{2}$/.test(pd) && /^\d{4}-\d{2}$/.test(pa)) b.periodo = { da: pd, a: pa };
  if (pen === "0" || pen === "1") b.penaleRecesso = pen === "1";
  if (sa > 0) b.spesaAnnua = sa;
  if (Object.keys(b).length) s.bolletta = b;
  return s;
}

function aggiungiBolletta(p: URLSearchParams, b: NonNullable<Stato["bolletta"]>) {
  if (b.nomeOfferta) p.set("nome", b.nomeOfferta);
  if (b.tipoPrezzo) p.set("tp", b.tipoPrezzo === "variabile" ? "v" : "f");
  if (b.prezzoVendita !== undefined) p.set("pv", String(b.prezzoVendita));
  if (b.quotaFissaMese !== undefined) p.set("qf", String(b.quotaFissaMese));
  if (b.periodo) { p.set("pd", b.periodo.da); p.set("pa", b.periodo.a); }
  if (b.penaleRecesso !== undefined) p.set("pen", b.penaleRecesso ? "1" : "0");
  if (b.spesaAnnua) p.set("sa", String(b.spesaAnnua));
}

function scriviHash(s: Stato) {
  const p = new URLSearchParams({ c: s.c, res: s.res ? "1" : "0" });
  if (s.cons > 0) p.set("cons", String(s.cons));
  if (s.c === "luce") p.set("kw", String(s.kw));
  else p.set("zona", s.zona);
  if (s.comune) p.set("comune", s.comune);
  if (s.cod) p.set("cod", s.cod);
  if (s.spesa) p.set("spesa", String(s.spesa));
  if (s.bolletta) aggiungiBolletta(p, s.bolletta);
  if (s.letti.length) p.set("letti", s.letti.join(","));
  history.replaceState(null, "", `#${p.toString()}`);
}

const etichettaComune = (c: Comune) => `${c.nome} (${c.sigla})`;

function riempiModulo(s: Stato) {
  (form.elements.namedItem(s.c) as HTMLInputElement).checked = true;
  (form.elements.namedItem("cons") as HTMLInputElement).value = s.cons > 0 ? String(s.cons) : "";
  (form.elements.namedItem("kw") as HTMLInputElement).value = String(s.kw).replace(".", ",");
  (form.elements.namedItem("res") as HTMLInputElement).checked = s.res;
  (form.elements.namedItem("zona") as HTMLSelectElement).value = s.zona;
  (form.elements.namedItem("cod") as HTMLInputElement).value = s.cod ?? "";
  (form.elements.namedItem("spesa") as HTMLInputElement).value = s.spesa ? String(s.spesa) : "";
  const com = comuni.find((c) => c.codice === s.comune);
  (form.elements.namedItem("comune") as HTMLInputElement).value = com ? etichettaComune(com) : "";
  aggiornaCampi(s.c);
}

function aggiornaCampi(c: "luce" | "gas") {
  document.querySelectorAll<HTMLElement>("[data-solo]").forEach((el) => (el.hidden = el.dataset.solo !== c));
  $("#unita").textContent = c === "gas" ? "Smc" : "kWh";
}

function leggiModulo(): Stato {
  const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value.trim();
  const c = (form.elements.namedItem("gas") as HTMLInputElement).checked ? "gas" : "luce";
  const n = (x: string) => Number(x.replace(/\./g, "").replace(",", "."));
  const testoComune = v("comune").toLowerCase();
  const com = comuni.find((x) => etichettaComune(x).toLowerCase() === testoComune) ?? comuni.find((x) => x.nome.toLowerCase() === testoComune);
  const s: Stato = { c, cons: n(v("cons")) || 0, kw: n(v("kw")) || 3, res: (form.elements.namedItem("res") as HTMLInputElement).checked, zona: v("zona") as Stato["zona"], letti: [] };
  if (com) s.comune = com.codice;
  if (v("cod")) s.cod = v("cod").toUpperCase();
  if (n(v("spesa")) > 0) s.spesa = n(v("spesa"));
  // I prezzi letti in bolletta restano validi finché non cambi fornitura o codice.
  if (ultimo?.bolletta && ultimo.c === s.c && ultimo.cod === s.cod) { s.bolletta = ultimo.bolletta; s.letti = ultimo.letti; }
  return s;
}

function profiloDa(s: Stato): ProfiloClassifica {
  const com = comuni.find((c) => c.codice === s.comune);
  const luogo = com ? { comune: com.codice, provincia: com.provincia, regione: com.regione } : undefined;
  if (s.c === "luce") return { commodity: "luce", luce: { consumoAnnuoKwh: s.cons, potenzaKw: s.kw, residente: s.res }, ...(luogo ? { luogo } : {}) };
  return { commodity: "gas", gas: { consumoAnnuoSmc: s.cons, regione: com?.regione ?? "09", zonaClimatica: s.zona }, ...(luogo ? { luogo } : {}) };
}

/* ---------- disegno ---------- */

function htmlAvvisi(r: RisultatoOfferta): string {
  if (r.avvisi.length === 0) return `<div class="pe-ok">${ICONE.spunta}Nessuna penale, nessun costo extra</div>`;
  const warn = r.avvisi.filter((a) => a.tipo === "warn");
  const info = r.avvisi.filter((a) => a.tipo === "info");
  return `<div class="avvisi">${warn.length ? `<div class="pe-alert pe-alert-warn">${ICONE.attenzione}<span>${warn.map((a) => `<strong>${h(a.titolo)}</strong> ${h(a.testo)}`).join("<br>")}</span></div>` : ""}${info.map((a) => `<div class="pe-alert pe-alert-info">${ICONE.salita}<span><strong>${h(a.titolo)}</strong> ${h(a.testo)}</span></div>`).join("")}</div>`;
}

function htmlNumeri(r: RisultatoOfferta): string {
  const spesa = r.stima.totale;
  let primo = "";
  if (riferimento !== null) {
    const diff = riferimento - spesa;
    primo = diff >= 1
      ? `<div class="pe-figure pe-figure-save"><span class="pe-figure-label">Risparmio annuo</span><span class="pe-figure-value">${euro(diff)}</span></div>`
      : `<div class="pe-figure"><span class="pe-figure-label">Rispetto alla tua</span><span class="pe-figure-value">+${euro(-diff)}</span></div>`;
  }
  return `<div class="pe-figures"${riferimento === null ? ' style="grid-template-columns:repeat(2,minmax(0,1fr))"' : ""}>${primo}<div class="pe-figure"><span class="pe-figure-label">Spesa annua</span><span class="pe-figure-value">${euro(spesa)}</span></div><div class="pe-figure"><span class="pe-figure-label">Al mese</span><span class="pe-figure-value">${euro(spesa / 12)}</span></div></div>`;
}

function htmlPagella(r: RisultatoOfferta): string {
  const nomi: Record<string, string> = { prezzo: "Prezzo", vincoli: "Vincoli", trasparenza: "Trasparenza", affidabilita: "Venditore" };
  const pesi: Record<string, string> = { prezzo: "60%", vincoli: "20%", trasparenza: "10%", affidabilita: "10%" };
  const righe = r.pagella.voci.map((v) =>
    v.voto === null
      ? `<span class="pe-report-muted">${nomi[v.voce]} <span class="pe-report-weight">${pesi[v.voce]}</span></span><div class="pe-report-pending"></div><span class="pe-report-muted" style="font-size:12px;text-align:right">presto</span>`
      : `<span>${nomi[v.voce]} <span class="pe-report-weight">${pesi[v.voce]}</span></span><div class="pe-meter"><div class="pe-meter-fill ${v.voto >= 6 ? "good" : "warn"}" style="width:${v.voto * 10}%"></div></div><span class="pe-report-score">${voto(v.voto)}</span>`,
  ).join("");
  const motivi = r.pagella.voci.filter((v) => v.voto !== null).flatMap((v) => v.motivi);
  return `<div><h3>Pagella</h3><div class="pe-report">${righe}</div><ul class="motivi">${motivi.map((m) => `<li>${h(m)}</li>`).join("")}</ul></div>`;
}

function htmlPrezzo(r: RisultatoOfferta): string {
  const v = Object.fromEntries(r.stima.voci.map((x) => [x.voce, x.importo]));
  const energia = v.energia ?? 0;
  const venditore = (v.commercializzazione ?? 0) + (v.una_tantum ?? 0) + (v.sconti ?? 0);
  const rete = (v.dispacciamento ?? 0) + (v.rete ?? 0) + (v.oneri ?? 0);
  const imposte = (v.accise ?? 0) + (v.iva ?? 0);
  const unita = r.offerta.commodity === "gas" ? "Smc" : "kWh";
  const parti = [energia, Math.max(venditore, 0), rete, imposte];
  const colori = ["var(--ink)", "#5b6675", "#aeb8c4", "#dce2e8"];
  const sito = r.offerta.contatti.urlOfferta || r.offerta.contatti.sito;
  const link = sito ? `<a class="collegamento" href="${h(sito.startsWith("http") ? sito : `https://${sito}`)}" target="_blank" rel="noopener noreferrer">Vai all'offerta sul sito del venditore ${ICONE.esterno}</a>` : "";
  return `<div><h3>Il prezzo spiegato</h3><div class="barra-prezzo" role="img" aria-label="Composizione della spesa annua">${parti.map((p, i) => `<div style="flex:${Math.max(p, 0.01)};background:${colori[i]}"></div>`).join("")}</div>
  <div class="voce-prezzo"><span>Energia · ${prezzoKwh(r.stima.prezzoMedioEnergiaKwh, unita)}</span><strong>${euro(energia)}</strong></div>
  <div class="voce-prezzo"><span>Costi del venditore</span><strong>${euro(venditore)}</strong></div>
  <div class="voce-prezzo tenue"><span>Rete e oneri, uguali per tutti</span><span>${euro(rete)}</span></div>
  <div class="voce-prezzo tenue"><span>Imposte</span><span>${euro(imposte)}</span></div>
  <p class="fonte" style="margin:8px 0 12px">Codice offerta ${h(r.offerta.codice)}</p>${link}</div>`;
}

function htmlFatti(r: RisultatoOfferta, colonna = false, quotaLetta?: number): string {
  return `<dl class="fatti${colonna ? " fatti-colonna" : ""}">${fattiOfferta(r, quotaLetta).map((f) => `<div><dt>${h(f.etichetta)}</dt><dd>${h(f.valore)}${f.nota ? `<small>${h(f.nota)}</small>` : ""}${(f.sconti ?? []).map((x) => `<span class="sconto${x.condizionato ? " cond" : ""}">${h(x.testo)}</span>`).join("")}</dd></div>`).join("")}</dl>`;
}

function htmlScheda(r: RisultatoOfferta, pos: number, aperta: boolean): string {
  const o = r.offerta;
  const venditore = dominio(o.contatti.sito);
  return `<article class="pe-card${aperta ? " pe-card-top" : ""}" style="border-radius:var(--radius-lg);padding:18px 22px">
    <div class="scheda-testa">
      <div class="nome"><span class="pe-card-rank">#${pos}</span><span class="pe-card-name">${h(nomeLeggibile(o.nome))}</span>${venditore ? `<span class="pe-card-sub">${h(venditore)}</span>` : ""}</div>
      <span class="pe-grade ${classeVoto(r.pagella.voto)}"${aperta ? "" : ' style="font-size:30px"'}>${voto(r.pagella.voto)}</span>
    </div>
    ${htmlFatti(r)}
    ${htmlNumeri(r)}
    ${htmlAvvisi(r)}
    ${aperta ? `<div class="dettagli">${htmlPagella(r)}${htmlPrezzo(r)}</div>` : ""}
    <button type="button" class="filtro altre" data-scheda="${h(o.codice)}" aria-expanded="${aperta}" style="align-self:flex-start">${aperta ? "Nascondi pagella e prezzo spiegato" : "Vedi pagella e prezzo spiegato"}</button>
  </article>`;
}

let aperte = new Set<string>();
/** La prima scheda è aperta di partenza: qui finisce se l'utente la chiude. */
let chiuse = new Set<string>();
/** Su telefono la prima scheda parte chiusa: la lista resta compatta e si scorre meglio. */
const stretto = () => matchMedia("(max-width: 560px)").matches;
const eAperta = (codice: string, i: number) => aperte.has(codice) || (i === 0 && !chiuse.has(codice) && !stretto());

function filtrati(): RisultatoOfferta[] {
  return risultati.filter((r) =>
    filtro === "fisso" ? r.offerta.prezzo === "fisso" : filtro === "variabile" ? r.offerta.prezzo === "variabile" : filtro === "fissoPulite" ? r.offerta.prezzo === "fisso" && r.avvisi.every((a) => a.tipo !== "warn") : filtro === "variabilePulite" ? r.offerta.prezzo === "variabile" && r.avvisi.every((a) => a.tipo !== "warn") : true,
  );
}

function disegnaLista() {
  const lista = filtrati();
  $("#conteggio").textContent = `${numero(risultati.length)} confrontate · ordinate per voto`;
  $("#lista").innerHTML = lista.length
    ? lista.slice(0, mostrate).map((r, i) => htmlScheda(r, i + 1, eAperta(r.offerta.codice, i))).join("")
    : `<div class="vuoto">Nessuna offerta con questo filtro per i tuoi dati.</div>`;
  const altre = $("#altre");
  altre.hidden = lista.length <= mostrate;
  altre.textContent = `Mostra altre ${Math.min(10, lista.length - mostrate)} offerte`;
}

function htmlVoto(v: number, dimensione = 40): string {
  return `<span><span class="pe-grade ${classeVoto(v)}" style="font-size:${dimensione}px">${voto(v)}</span><span class="pe-grade-of">/10</span></span>`;
}

function htmlMetro(v: number): string {
  return `<div class="pe-meter" role="img" aria-label="Voto ${voto(v)} su 10"><div class="pe-meter-fill ${v >= 6 ? "good" : "warn"}" style="width:${v * 10}%"></div></div>`;
}

function giudizio(v: number): string {
  return v >= 8 ? "Ottima: tra le più convenienti per te" : v >= 6 ? "Sufficiente: ci sono offerte simili o un po' migliori" : v >= 4 ? "Insufficiente: stai pagando più del necessario" : "Gravemente insufficiente: puoi risparmiare molto";
}

function disegnaTua(s: Stato) {
  const box = $("#tua-offerta");
  const risp = $("#risparmio");
  const icona = s.c === "luce" ? ICONE.fulmine : ICONE.fiamma;
  const chip = `<span class="pe-chip pe-chip-${s.c}" style="align-self:flex-start">${icona}${s.letti.length ? `Bolletta ${s.c} letta` : s.c === "luce" ? "Luce" : "Gas"}</span>`;
  const spesaBolletta = s.bolletta?.spesaAnnua;
  const notaSpesa = spesaBolletta && tua
    ? `<p class="nota-tua">Nell'ultimo anno hai speso <strong>${euro(spesaBolletta)}</strong>. Qui sopra c'è la stima dei prossimi 12 mesi ai prezzi di oggi, come per le altre offerte.</p>`
    : "";
  if (tua) {
    const o = tua.offerta;
    const fonte = origine === "bolletta"
      ? "Non più in vendita: voto calcolato con i prezzi letti nella tua bolletta"
      : "Condizioni ufficiali dal Portale Offerte";
    box.innerHTML = `${chip}<span class="occhiello">Il voto della tua offerta</span>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:22px;font-weight:800;overflow-wrap:anywhere">${h(nomeLeggibile(o.nome))}</span>${origine === "bolletta" ? `<span style="font-size:14px;color:var(--ink-muted)">Prezzi letti in bolletta</span>` : ""}</div>${htmlVoto(tua.pagella.voto)}</div>
      ${htmlMetro(tua.pagella.voto)}
      <strong style="font-size:15px">${h(giudizio(tua.pagella.voto))}</strong>
      ${htmlFatti(tua, true, origine === "bolletta" ? s.bolletta?.quotaFissaMese : undefined)}
      <div class="pe-figures" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="pe-figure"><span class="pe-figure-label">Spesa annua stimata</span><span class="pe-figure-value">${euro(tua.stima.totale)}</span></div><div class="pe-figure"><span class="pe-figure-label">Al mese</span><span class="pe-figure-value">${euro(tua.stima.totale / 12)}</span></div></div>
      ${notaSpesa}
      ${tua.avvisi.length ? htmlAvvisi(tua) : ""}
      <details class="perche"><summary>Perché questo voto</summary>${htmlPagella(tua)}<p class="fonte" style="margin:8px 0 0">${h(fonte)}.</p></details>`;
  } else if (soloPrezzo) {
    const spesa = s.spesa ?? spesaBolletta!;
    box.innerHTML = `${chip}<span class="occhiello">Il voto della tua bolletta</span>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:22px;font-weight:800">${h(s.bolletta?.nomeOfferta ? nomeLeggibile(s.bolletta.nomeOfferta) : "La tua offerta")}</span><span style="font-size:14px;color:var(--ink-muted)">Voto sul solo prezzo</span></div>${htmlVoto(soloPrezzo.voto!)}</div>
      ${htmlMetro(soloPrezzo.voto!)}
      <strong style="font-size:15px">${h(giudizio(soloPrezzo.voto!))}</strong>
      <div class="pe-figures" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="pe-figure"><span class="pe-figure-label">Spendi all'anno</span><span class="pe-figure-value">${euro(spesa)}</span></div><div class="pe-figure"><span class="pe-figure-label">Al mese</span><span class="pe-figure-value">${euro(spesa / 12)}</span></div></div>
      <ul class="motivi" style="margin:0">${soloPrezzo.motivi.map((m) => `<li>${h(m)}</li>`).join("")}</ul>
      <p class="nota-tua">${s.cod ? `Il codice ${h(s.cod)} non è tra le offerte in vendita oggi e non abbiamo trovato i suoi prezzi in bolletta, quindi ` : ""}confrontiamo la spesa annua con quella stimata per le altre offerte. È un confronto approssimato: la tua spesa è passata, le altre sono stime per i prossimi 12 mesi.</p>`;
  } else if (s.cod) {
    box.innerHTML = `${chip}<span class="occhiello">La tua offerta</span><p style="margin:0;font-size:15px;line-height:1.5">Il codice <strong>${h(s.cod)}</strong> non è tra le offerte pubblicate oggi sul Portale Offerte e non abbiamo trovato i suoi prezzi in bolletta. Per avere il voto, scrivi quanto spendi all'anno nel modulo qui sotto.</p>`;
  } else {
    box.innerHTML = `${chip}<span class="occhiello">La tua offerta</span><p style="margin:0;font-size:15px;line-height:1.5">Carica la bolletta, scrivi il codice offerta o quanto spendi all'anno per vedere il voto della tua offerta e quanto risparmi.</p>`;
  }
  const migliore = risultati[0];
  if (migliore && riferimento !== null) {
    const diff = riferimento - migliore.stima.totale;
    risp.hidden = false;
    risp.innerHTML = diff >= 12
      ? `<span class="pe-saving-label">Con la prima in classifica risparmi</span><span class="pe-saving-value">${euro(diff)}<small> l'anno</small></span><span class="pe-saving-sub">cioè ${euro(diff / 12)} in meno ogni mese</span>`
      : `<span class="pe-saving-label">La tua offerta è tra le più convenienti</span><span class="pe-saving-sub">Per i tuoi consumi nessuna offerta con un voto migliore costa meno.</span>`;
  } else risp.hidden = true;
}

/** Consumo e comune sono obbligatori: senza, la classifica sarebbe fuorviante. */
const completo = (s: Stato) => s.cons > 0 && !!s.comune;

/** Senza consumo o comune si passa dal percorso guidato, che parte da cosa manca. */
const URL_GUIDATO = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}inserisci/`;
function mostraIncompleto(_s: Stato) {
  location.replace(`${URL_GUIDATO}${location.hash}`);
}

function segnaErrori(s: Stato): boolean {
  const campi: Array<[string, string, string | null]> = [
    ["cons", "err-cons", s.cons > 0 ? null : "Inserisci il consumo annuo, oppure stimalo con il link qui sotto."],
    ["comune", "err-comune", s.comune ? null : "Scegli il comune dall'elenco che compare mentre scrivi."],
  ];
  let primo: HTMLInputElement | null = null;
  for (const [nome, id, msg] of campi) {
    const input = form.elements.namedItem(nome) as HTMLInputElement;
    const err = $(`#${id}`);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    err.hidden = !msg;
    err.textContent = msg ?? "";
    if (msg && !primo) primo = input;
  }
  primo?.focus();
  return !primo;
}

function calcola(s: Stato) {
  if (!completo(s)) return mostraIncompleto(s);
  $(".filtri").hidden = false;
  const profilo = profiloDa(s);
  risultati = classifica(offerte, profilo, mercato.parametri, mercato.scenari);
  const propria = s.cod ? offerte.find((o) => o.codice.toUpperCase() === s.cod!.toUpperCase()) : undefined;
  tua = propria ? valutaOfferta(propria, profilo, mercato.parametri, mercato.scenari, risultati) : null;
  origine = tua ? "portale" : null;
  soloPrezzo = null;
  if (!tua && s.bolletta?.prezzoVendita !== undefined) {
    const ricostruita = offertaDaBolletta({ ...s.bolletta, commodity: s.c, ...(s.cod ? { codiceOfferta: s.cod } : {}), trovati: [] }, mercato.indici, mercato.parametri);
    tua = ricostruita ? valutaOfferta(ricostruita, profilo, mercato.parametri, mercato.scenari, risultati) : null;
    if (tua) origine = "bolletta";
  }
  if (tua) risultati = risultati.filter((r) => r.offerta.codice !== tua!.offerta.codice);
  const spesaDichiarata = s.spesa ?? s.bolletta?.spesaAnnua;
  if (!tua && spesaDichiarata && risultati.length) {
    soloPrezzo = votoPrezzo(spesaDichiarata, [...risultati.map((r) => r.stima.totale), spesaDichiarata]);
    origine = "spesa";
  }
  riferimento = tua ? tua.stima.totale : spesaDichiarata ?? null;
  ultimo = s;
  $<HTMLAnchorElement>("#link-stima").href = `${URL_GUIDATO}${location.hash}`;
  mostrate = 10;
  aperte = new Set();
  chiuse = new Set();
  disegnaTua(s);
  disegnaLista();
  const ind = s.c === "luce" ? "PUN" : "PSV";
  const val = mercato.scenari.centrale.valori[ind];
  const com = comuni.find((c) => c.codice === s.comune);
  const vai = $("#vai-dati");
  vai.innerHTML = `<span>${h(numero(s.cons))} ${s.c === "gas" ? "Smc" : "kWh"}${s.c === "luce" ? ` · ${h(String(s.kw).replace(".", ","))} kW` : ` · zona ${h(s.zona)}`}${com ? ` · ${h(com.nome)}` : " · tutta Italia"}</span><strong>Modifica</strong>`;
  $("#fonte").textContent = `Stima per ${numero(s.cons)} ${s.c === "gas" ? "Smc" : "kWh"} l'anno${s.c === "luce" ? `, ${String(s.kw).replace(".", ",")} kW, ${s.res ? "residente" : "non residente"}` : `, zona climatica ${s.zona}`}${com ? `, ${com.nome}` : ", offerte disponibili in tutta Italia"}. Variabili stimate con ${ind} ${val ? prezzoKwh(val, s.c === "gas" ? "Smc" : "kWh") : "n.d."}, ${mercato.scenari.centrale.descrizione.toLowerCase()}. Fonte: Portale Offerte ARERA, dati del ${new Date(mercato.data).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}.`;
}

async function avvia() {
  const iniziale = leggiHash();
  if (!completo(iniziale)) return mostraIncompleto(iniziale);
  $("#lista").innerHTML = `<div class="vuoto">Sto confrontando le offerte sul tuo dispositivo…</div>`;
  [mercato, offerte, comuni] = await Promise.all([caricaMercato(), caricaOfferte(), caricaComuni()]);
  const lista = $<HTMLDataListElement>("#elenco-comuni");
  lista.innerHTML = comuni.map((c) => `<option value="${h(etichettaComune(c))}"></option>`).join("");
  const s = leggiHash();
  const com = comuni.find((c) => c.codice === s.comune);
  if (com && !new URLSearchParams(location.hash.slice(1)).get("zona")) s.zona = ZONA_CLIMATICA_TIPICA[com.regione] ?? "D";
  riempiModulo(s);
  calcola(s);

  form.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === "commodity") {
      aggiornaCampi(t.value as "luce" | "gas");
      (form.elements.namedItem("cons") as HTMLInputElement).value = "";
      (form.elements.namedItem("cod") as HTMLInputElement).value = "";
    }
  });
  // Il comune scelto propone la zona climatica tipica della sua regione.
  (form.elements.namedItem("comune") as HTMLInputElement).addEventListener("change", () => {
    const t = (form.elements.namedItem("comune") as HTMLInputElement).value.trim().toLowerCase();
    const c = comuni.find((x) => etichettaComune(x).toLowerCase() === t);
    if (c) (form.elements.namedItem("zona") as HTMLSelectElement).value = ZONA_CLIMATICA_TIPICA[c.regione] ?? "D";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nuovo = leggiModulo();
    if (!segnaErrori(nuovo)) return;
    scriviHash(nuovo);
    calcola(nuovo);
    $("#lista").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-filtro]").forEach((b) =>
    b.addEventListener("click", () => {
      filtro = b.dataset.filtro as Filtro;
      document.querySelectorAll("[data-filtro]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      mostrate = 10;
      disegnaLista();
    }),
  );
  $("#altre").addEventListener("click", () => { mostrate += 10; disegnaLista(); });
  $("#lista").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-scheda]");
    if (!b) return;
    const codice = b.dataset.scheda!;
    const scheda = b.closest("article")!;
    if (b.getAttribute("aria-expanded") === "true") { aperte.delete(codice); chiuse.add(codice); }
    else { aperte.add(codice); chiuse.delete(codice); }
    const indice = [...$("#lista").children].indexOf(scheda);
    disegnaLista();
    // Dopo la chiusura riporta in vista la scheda, così non si perde il punto della lista.
    const nuova = $("#lista").children[indice] as HTMLElement | undefined;
    nuova?.querySelector<HTMLButtonElement>("[data-scheda]")?.focus({ preventScroll: true });
    if (nuova && nuova.getBoundingClientRect().top < 0) nuova.scrollIntoView({ block: "start" });
  });
  window.addEventListener("hashchange", () => { const n = leggiHash(); riempiModulo(n); calcola(n); });
}

collegaCaricatore($("#caricatore"), $<HTMLInputElement>("#file"), $("#stato"));
avvia().catch((err) => {
  $("#lista").innerHTML = `<div class="vuoto">Non siamo riusciti a caricare le offerte di oggi. Ricarica la pagina tra qualche minuto. (${h(err instanceof Error ? err.message : err)})</div>`;
});
