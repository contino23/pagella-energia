/**
 * Prepara i file statici letti dal sito e dall'app:
 *   offerte.json  offerte domestiche luce e gas, solo i campi usati nel calcolo e nelle schede
 *   mercato.json  data, parametri regolati, indici, scenari, conteggi, classifiche nazionali
 *   comuni.json   comuni ISTAT con provincia, regione e CAP, per scegliere il luogo
 *
 * Uso: tsx src/esporta-web.ts <offerte.json.gz> <indici.csv> <comuni.json> <cartella-uscita>
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { classifica, conPenaleCalcolata, creaScenari, type Fotografia, type Offerta, type RisultatoOfferta } from "@pagella/core";
import { leggiIndiciCsv } from "./leggi-indici.js";

const [, , fotoPath, indiciPath, comuniPath, outDir] = process.argv;
if (!fotoPath || !indiciPath || !comuniPath || !outDir) {
  console.error("Uso: tsx src/esporta-web.ts <offerte.json.gz> <indici.csv> <comuni.json> <cartella-uscita>");
  process.exit(2);
}

const foto = JSON.parse(gunzipSync(await readFile(fotoPath)).toString()) as Fotografia;
const storico = leggiIndiciCsv(await readFile(indiciPath, "utf8"));
const scenari = creaScenari(storico);

/** Toglie i testi lunghi che il browser non usa; tiene il testo delle penali (accorciato). */
function snella(intera: Offerta): Offerta {
  // Durata e importo della penale si ricavano dai testi completi, prima di accorciarli.
  const o = conPenaleCalcolata(intera);
  return {
    ...o,
    descrizione: o.descrizione.slice(0, 160),
    garanzie: o.garanzie.slice(0, 240),
    condizioni: o.condizioni
      .filter((c) => c.tipo === "ONERI_RECESSO_ANTICIPATO" || c.limitante)
      .map((c) => ({ ...c, testo: c.testo.slice(0, 280) })),
    sconti: o.sconti.map((s) => ({ ...s, descrizione: s.descrizione.slice(0, 120), ...(s.condizioneTesto ? { condizioneTesto: s.condizioneTesto.slice(0, 120) } : {}) })),
    servizi: o.servizi.map((s) => ({ nome: s.nome.slice(0, 80), dettaglio: "" })),
  };
}

const domestiche = foto.offerte.filter((o) => (o.commodity === "luce" || o.commodity === "gas") && o.cliente === "domestico").map(snella);

const famigliaLuce = { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true };
const famigliaGas = { consumoAnnuoSmc: 1400, regione: "09", zonaClimatica: "D" as const };
const opz = { unaPerVenditore: true, escludiRiservate: true, limite: 3 };
const riassunto = (r: RisultatoOfferta) => ({
  codice: r.offerta.codice,
  nome: r.offerta.nome,
  sito: r.offerta.contatti.sito ?? null,
  prezzo: r.offerta.prezzo,
  durataMesi: r.offerta.durataMesi,
  voto: r.pagella.voto,
  spesaAnnua: r.stima.totale,
  avvisi: r.avvisi.length,
});
const topLuce = classifica(domestiche, { commodity: "luce", luce: famigliaLuce }, foto.parametri, scenari, opz).map(riassunto);
const topGas = classifica(domestiche, { commodity: "gas", gas: famigliaGas }, foto.parametri, scenari, opz).map(riassunto);

const ultimi12 = storico.slice(-12);
const mercato = {
  data: foto.data,
  fonte: foto.fonte,
  licenza: foto.licenza,
  conteggi: { offerte: foto.conteggi.offerte, venditori: foto.conteggi.venditori, luceFisseDomestiche: domestiche.filter((o) => o.commodity === "luce" && o.prezzo === "fisso").length, luceFisseConPenale: foto.conteggi.domesticheLuceFisseConPenale },
  parametri: foto.parametri,
  scenari,
  indici: ultimi12.map((r) => ({ mese: r.mese, PUN: r.indici.PUN ?? null, PSV: r.indici.PSV ?? null })),
  famigliaTipo: { luce: famigliaLuce, gas: { consumoAnnuoSmc: famigliaGas.consumoAnnuoSmc } },
  migliori: { luce: topLuce, gas: topGas },
};

type ComuneIstat = { nome: string; codice: string; regione: { codice: string }; provincia: { codice: string }; sigla: string; cap: string[] };
const comuni = (JSON.parse(await readFile(comuniPath, "utf8")) as ComuneIstat[])
  .map((c) => [c.codice, c.nome, c.sigla, c.provincia.codice, c.regione.codice, c.cap.join(" ")])
  .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "it"));

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "offerte.json"), JSON.stringify({ data: foto.data, offerte: domestiche }));
await writeFile(join(outDir, "mercato.json"), JSON.stringify(mercato));
await writeFile(join(outDir, "comuni.json"), JSON.stringify({ campi: ["codice", "nome", "sigla", "provincia", "regione", "cap"], comuni }));
console.log(`Dati del ${foto.data}: ${domestiche.length} offerte domestiche, ${comuni.length} comuni`);
console.log("Migliori luce:", topLuce.map((x) => `${x.nome} ${x.voto} ${x.spesaAnnua}`).join(" | "));
console.log("Migliori gas:", topGas.map((x) => `${x.nome} ${x.voto} ${x.spesaAnnua}`).join(" | "));
