import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { classifica, creaScenari, estraiDatiBolletta, offertaDaBolletta, valutaOfferta, type Fotografia } from "@pagella/core";
import { leggiIndiciCsv } from "./leggi-indici.js";
const foto = JSON.parse(gunzipSync(readFileSync("../data/fotografie/2026-11-03/offerte.json.gz")).toString()) as Fotografia;
const storico = leggiIndiciCsv(readFileSync("../data/indici/prezzi-storici-indici.csv", "utf8"));
const scen = creaScenari(storico);
const testo = process.argv[2] ? readFileSync(process.argv[2], "utf8") : "";
const d = estraiDatiBolletta(testo, new Set(foto.offerte.map((o) => o.codice)));
console.log(JSON.stringify(d));
const prof = { commodity: "luce" as const, luce: { consumoAnnuoKwh: d.consumoAnnuo ?? 2700, potenzaKw: d.potenzaKw ?? 3, residente: true }, luogo: { regione: "09", provincia: "047" } };
const ris = classifica(foto.offerte, prof, foto.parametri, scen);
const v = ris.map((r) => r.pagella.voto);
const quota = (k: number) => `${Math.round((100 * v.filter((x) => x >= k).length) / v.length)}%`;
console.log(`${ris.length} offerte · voto ≥9 ${quota(9)} · ≥8 ${quota(8)} · ≥6 ${quota(6)} · mediana ${v.sort((a, b) => a - b)[Math.floor(v.length / 2)]}`);
for (const r of ris.slice(0, 5)) console.log(r.pagella.voto, Math.round(r.stima.totale), r.offerta.nome);
const o = offertaDaBolletta(d, storico.map((r) => ({ mese: r.mese, PUN: r.indici.PUN ?? null, PSV: r.indici.PSV ?? null })), foto.parametri);
if (o) {
  const t = valutaOfferta(o, prof, foto.parametri, scen, ris)!;
  console.log("TUA:", t.pagella.voto, t.stima.totale, JSON.stringify(t.pagella.voci.map((x) => [x.voce, x.voto, x.motivi])), "posizione", ris.filter((r) => r.pagella.voto > t.pagella.voto).length + 1);
}
