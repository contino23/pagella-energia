import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { classifica, creaScenari, type Fotografia } from "@pagella/core";
import { leggiIndiciCsv } from "./leggi-indici.js";
const dir = "../data/fotografie/" + process.argv[2];
const foto = JSON.parse(gunzipSync(readFileSync(dir + "/offerte.json.gz")).toString()) as Fotografia;
const scen = creaScenari(leggiIndiciCsv(readFileSync("../data/indici/prezzi-storici-indici.csv", "utf8")));
for (const c of ["luce", "gas"] as const) {
  const prof = c === "luce" ? { commodity: c, luce: { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true } } : { commodity: c, gas: { consumoAnnuoSmc: 1400, regione: "09", zonaClimatica: "D" as const } };
  const r = classifica(foto.offerte, prof as any, foto.parametri, scen);
  for (const x of [...r.slice(0, 3), r.find((y) => y.offerta.prezzo === "variabile")!]) console.log(c, x.offerta.nome, x.offerta.prezzo, JSON.stringify(x.stima.sintesi), Math.round(x.stima.totale));
  const plen = r.find((y) => /fixa time/i.test(y.offerta.nome));
  if (plen) console.log("PLENITUDE", plen.offerta.nome, JSON.stringify(plen.stima.sintesi));
}
