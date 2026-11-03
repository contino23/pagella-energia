/** Esegue la stima su tutte le offerte luce domestiche di una fotografia (uso: tsx src/prova-calcolo.ts <offerte.json.gz> <indici.csv>). */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { scenarioMedia12Mesi, stimaSpesaLuce, type Fotografia } from "@pagella/core";
import { leggiIndiciCsv } from "./leggi-indici.js";

const [, , fotoPath, indiciPath] = process.argv;
const foto = JSON.parse(gunzipSync(readFileSync(fotoPath!)).toString()) as Fotografia;
const scenario = scenarioMedia12Mesi(leggiIndiciCsv(readFileSync(indiciPath!, "utf8")));
console.log(scenario.descrizione, scenario.valori);
const profilo = { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true };
const offerte = foto.offerte.filter((o) => o.commodity === "luce" && o.cliente === "domestico" && o.residenza !== "non_residenti");
const stime = offerte.map((o) => ({ o, s: stimaSpesaLuce(o, profilo, foto.parametri.luce, scenario) }));
const ok = stime.filter((x) => x.s.calcolabile);
const tot = ok.map((x) => x.s.totale).sort((a, b) => a - b);
const pct = (p: number) => tot[Math.floor((tot.length - 1) * p)];
console.log(`offerte ${offerte.length}, calcolabili ${ok.length}`);
console.log(`spesa annua 2700 kWh/3 kW residente: min ${pct(0)} p10 ${pct(0.1)} mediana ${pct(0.5)} p90 ${pct(0.9)} max ${pct(1)}`);
const avv: Record<string, number> = {};
for (const x of stime) for (const a of x.s.avvisi) avv[a.replace(/"[^"]*"/, '"…"')] = (avv[a.replace(/"[^"]*"/, '"…"')] ?? 0) + 1;
console.log("avvisi:", avv);
const ord = ok.sort((a, b) => a.s.totale - b.s.totale);
for (const x of [...ord.slice(0, 5), ...ord.slice(-3)]) console.log(x.s.totale, x.o.prezzo, x.o.nome, "|", x.s.prezzoMedioEnergiaKwh, JSON.stringify(x.s.voci.map((v) => v.importo)));
const fisse = ord.filter((x) => x.o.prezzo === "fisso").map((x) => x.s.totale), varr = ord.filter((x) => x.o.prezzo === "variabile").map((x) => x.s.totale);
console.log("mediana fisse", fisse[fisse.length >> 1], "mediana variabili", varr[varr.length >> 1]);
