/**
 * Uso: npm run leggi -- <cartella-file-grezzi> [cartella-fotografie]
 * Esempio: npm run leggi -- ../data/raw/2026-11-03 ../data/fotografie
 */
import { resolve } from "node:path";
import { creaFotografia } from "./fotografia.js";

const [, , raw, out = "../data/fotografie"] = process.argv;
if (!raw) {
  console.error("Uso: npm run leggi -- <cartella-file-grezzi> [cartella-fotografie]");
  process.exit(2);
}

const t0 = Date.now();
const { foto, qualita } = await creaFotografia(resolve(raw), resolve(out));
console.log(`Fotografia del ${foto.data} creata in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.table(foto.conteggi);
const anomalie = Object.entries(qualita.anomaliePerTipo);
console.log(`Anomalie: ${anomalie.reduce((n, [, c]) => n + c, 0)} in ${anomalie.length} tipi`);
for (const [k, c] of anomalie.slice(0, 15)) console.log(`  ${String(c).padStart(5)}  ${k}`);
for (const a of qualita.avvisi) console.warn(`AVVISO: ${a}`);
// Esce con errore se manca qualcosa di essenziale: la pipeline quotidiana se ne accorge.
if (qualita.avvisi.some((a) => a.startsWith("Manca") || a.includes("nessuna offerta"))) process.exit(1);
