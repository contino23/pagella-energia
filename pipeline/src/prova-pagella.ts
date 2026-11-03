import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { creaPagella, creaScenari, forchetta, stimaSpesaLuce, type Fotografia, type Offerta } from "@pagella/core";
import { leggiIndiciCsv } from "./leggi-indici.js";
const foto = JSON.parse(gunzipSync(readFileSync(process.argv[2]!)).toString()) as Fotografia;
const scen = creaScenari(leggiIndiciCsv(readFileSync(process.argv[3]!, "utf8")));
console.log("Scenario:", scen.centrale.descrizione, scen.centrale.valori.PUN?.toFixed(4));
const inZona = (o: Offerta) => !o.zone || o.zone.regioni.includes("09");
const prof = { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true };
const off = foto.offerte.filter((o) => o.commodity === "luce" && o.cliente === "domestico" && o.residenza !== "non_residenti" && inZona(o) && o.offertaSingola);
const st = off.map((o) => ({ o, f: forchetta((sc) => stimaSpesaLuce(o, prof, foto.parametri.luce, sc), scen) })).filter((x) => x.f.centrale.calcolabile);
const spese = st.map((x) => x.f.centrale.totale);
const pag = st.map((x) => ({ ...x, p: creaPagella(x.o, x.f.centrale, spese, undefined, x.f) })).sort((a, b) => b.p.voto - a.p.voto);
console.log(`Toscana, ${pag.length} offerte; fisse nelle prime 10 per voto: ${pag.slice(0, 10).filter((x) => x.o.prezzo === "fisso").length}`);
for (const x of [...pag.slice(0, 3), pag.find((y) => y.o.prezzo === "variabile")!]) {
  console.log(`\n${x.p.voto} | ${x.o.nome} | ${x.f.centrale.totale} €  [${x.o.prezzo}]`);
  for (const v of x.p.voci) console.log(`   ${v.voce} ${v.voto ?? "-"}: ${v.motivi.join("; ")}`);
  if (x.p.note.length) console.log(`   note: ${x.p.note.join("; ")}`);
}
