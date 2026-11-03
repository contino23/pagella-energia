import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { creaPagella, scenarioMedia12Mesi, stimaSpesaLuce, type Fotografia, type Offerta } from "@pagella/core";
import { leggiIndiciCsv } from "./leggi-indici.js";
const foto = JSON.parse(gunzipSync(readFileSync(process.argv[2]!)).toString()) as Fotografia;
const scen = scenarioMedia12Mesi(leggiIndiciCsv(readFileSync(process.argv[3]!, "utf8")));
const regione = "09"; // Toscana
const inZona = (o: Offerta) => !o.zone || o.zone.regioni.includes(regione);
const prof = { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true };
const off = foto.offerte.filter((o) => o.commodity === "luce" && o.cliente === "domestico" && o.residenza !== "non_residenti" && inZona(o) && o.offertaSingola);
const st = off.map((o) => ({ o, s: stimaSpesaLuce(o, prof, foto.parametri.luce, scen) })).filter((x) => x.s.calcolabile);
const spese = st.map((x) => x.s.totale);
const pag = st.map((x) => ({ ...x, p: creaPagella(x.o, x.s, spese) })).sort((a, b) => b.p.voto - a.p.voto);
console.log(`Toscana, ${pag.length} offerte. Distribuzione voti:`, [0, 2, 4, 6, 8].map((d) => `${d}-${d + 2}: ${pag.filter((x) => x.p.voto >= d && x.p.voto < d + 2 || (d === 8 && x.p.voto === 10)).length}`).join(", "));
for (const x of pag.slice(0, 6)) {
  console.log(`\n${x.p.voto} | ${x.o.nome} | ${x.s.totale} €  [${x.o.prezzo}]`);
  for (const v of x.p.voci) console.log(`   ${v.voce} ${v.voto ?? "-"}: ${v.motivi.join("; ")}`);
  if (x.p.note.length) console.log(`   note: ${x.p.note.join("; ")}`);
}
