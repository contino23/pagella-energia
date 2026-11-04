// Genera src/styles/tokens.css da design/tokens.json (unica fonte dei valori).
import { readFileSync, writeFileSync } from "node:fs";
const t = JSON.parse(readFileSync(new URL("../../../design/tokens.json", import.meta.url), "utf8"));
const righe = [];
const valore = (v) => (typeof v === "string" ? v : v.light);
const css = (v) => (/^\{.+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
for (const c of t.color.tokens) righe.push(`  --${c.name}: ${css(valore(c.value))};`);
for (const fam of ["spacing", "radius", "size"]) for (const x of t[fam]?.tokens ?? []) righe.push(`  --${x.name}: ${x.value};`);
for (const [k, v] of Object.entries(t.type.families)) righe.push(`  --font-${k}: ${v};`);
writeFileSync(new URL("../src/styles/tokens.css", import.meta.url), `/* Generato da design/tokens.json: non modificare a mano */\n:root {\n${righe.join("\n")}\n}\n`);
console.log(`tokens.css: ${righe.length} variabili`);
