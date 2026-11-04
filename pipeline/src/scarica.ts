/**
 * Scarica i file di oggi dalla pagina Open Data del Portale Offerte.
 *
 * Il Portale rifiuta le richieste dai datacenter (403 da GitHub Actions e dai server cloud),
 * per questo gira su un computer "di casa" registrato come runner di GitHub (vedi docs/AGGIORNAMENTO-DATI.md).
 *
 * Non indoviniamo gli indirizzi: leggiamo la pagina Open Data e prendiamo i link che contiene.
 *  - offerte:   PO_Offerte_{E|G|D}_MLIBERO_AAAAMMGG.xml
 *  - parametri: PO_Parametri_Mercato_Libero_{E|G}_AAAAMMGG.csv
 *  - indici:    il CSV dei prezzi storici (nome non fisso: lo riconosciamo dal testo del link)
 *
 * Uso: tsx src/scarica.ts [cartella-raw] [file-indici]
 * Scrive in cartella-raw/AAAA-MM-GG/ e stampa la data trovata (anche in GITHUB_OUTPUT come "data").
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { leggiIndiciCsv } from "./leggi-indici.js";

const PAGINA = "https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page";
const UA = "PagellaEnergia/0.1 (+https://github.com/contino23/pagella-energia)";
const [, , rawArg = "../data/raw", indiciArg = "../data/indici/prezzi-storici-indici.csv"] = process.argv;

async function scaricaTesto(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} su ${url}`);
  return r.text();
}

async function scaricaByte(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} su ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

export interface Collegamento { url: string; testo: string }

/** Tutti i link della pagina (href + testo), più gli indirizzi di file citati altrove nel sorgente. */
export function estraiCollegamenti(html: string, base: string): Collegamento[] {
  const out: Collegamento[] = [];
  const visti = new Set<string>();
  const aggiungi = (href: string, testo: string) => {
    let url: string;
    try { url = new URL(href.replace(/&amp;/g, "&"), base).toString(); } catch { return; }
    if (visti.has(url)) return;
    visti.add(url);
    out.push({ url, testo: testo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
  };
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) aggiungi(m[1]!, m[2]!);
  for (const m of html.matchAll(/["'(]([^"'()\s]+\.(?:xml|csv|zip))["')]/gi)) aggiungi(m[1]!, "");
  return out;
}

const RE_FILE = /(PO_Offerte_([EGD])_MLIBERO|PO_Parametri_Mercato_Libero_([EG]))_(\d{8})\.(xml|csv)/i;

export function scegliFile(link: Collegamento[]): { data: string; file: Array<{ nome: string; url: string }> } | null {
  const perData = new Map<string, Map<string, string>>();
  for (const l of link) {
    const m = RE_FILE.exec(decodeURIComponent(l.url));
    if (!m) continue;
    const nome = m[0]!;
    const d = m[4]!;
    if (!perData.has(d)) perData.set(d, new Map());
    perData.get(d)!.set(nome, l.url);
  }
  // La data più recente che ha almeno le offerte luce e gas.
  const date = [...perData.keys()].sort().reverse();
  const d = date.find((x) => [...perData.get(x)!.keys()].some((n) => /_E_MLIBERO/.test(n)) && [...perData.get(x)!.keys()].some((n) => /_G_MLIBERO/.test(n)));
  if (!d) return null;
  return { data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, file: [...perData.get(d)!].map(([nome, url]) => ({ nome, url })) };
}

export function scegliIndici(link: Collegamento[]): string | undefined {
  const csv = link.filter((l) => /\.csv(\?|$)/i.test(l.url) && !RE_FILE.test(l.url));
  return (csv.find((l) => /storic/i.test(l.testo)) ?? csv.find((l) => /indic|pun|psv/i.test(l.testo)) ?? csv.find((l) => /storic|indic/i.test(l.url)))?.url;
}

async function principale() {
  const html = await scaricaTesto(PAGINA);
  const link = estraiCollegamenti(html, PAGINA);
  const scelta = scegliFile(link);
  if (!scelta) {
    console.error(`Nessun file di offerte trovato nella pagina Open Data (${link.length} link). Primi link:`);
    for (const l of link.slice(0, 60)) console.error(`  ${l.testo.slice(0, 50).padEnd(50)} ${l.url}`);
    process.exit(1);
  }
  const cartella = resolve(rawArg, scelta.data);
  await mkdir(cartella, { recursive: true });
  for (const f of scelta.file) {
    const b = await scaricaByte(f.url);
    if (b.length < 1000) throw new Error(`${f.nome}: file troppo piccolo (${b.length} byte)`);
    await writeFile(join(cartella, f.nome), b);
    console.log(`${f.nome.padEnd(48)} ${(b.length / 1e6).toFixed(1)} MB`);
  }

  const urlIndici = scegliIndici(link);
  if (!urlIndici) console.warn("AVVISO: link ai prezzi storici degli indici non trovato: tengo il file attuale");
  else {
    const b = await scaricaByte(urlIndici);
    const utf8 = b.toString("utf8");
    const testo = utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(b) : utf8;
    const conta = (t: string) => { try { return leggiIndiciCsv(t); } catch { return []; } };
    const nuovi = conta(testo);
    const attuali = conta(await readFile(resolve(indiciArg), "utf8").catch(() => ""));
    if (nuovi.length >= Math.max(12, attuali.length)) {
      await writeFile(resolve(indiciArg), testo, "utf8");
      console.log(`Indici: ${nuovi.length} mesi, ultimo ${nuovi.at(-1)?.mese}`);
    } else console.warn(`AVVISO: il CSV degli indici scaricato ha ${nuovi.length} mesi (attuale ${attuali.length}): non lo sostituisco`);
  }

  console.log(`Data dei file: ${scelta.data}`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `data=${scelta.data}\n`);
}

if (process.argv[1] && /scarica\.ts$/.test(process.argv[1])) await principale();
