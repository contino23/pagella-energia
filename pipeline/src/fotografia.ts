/**
 * Crea la "fotografia" di un giorno: legge tutti i file open data di una cartella,
 * li normalizza e produce i file dello storico più un report di qualità.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Commodity, Fotografia, Offerta, Parametro } from "@pagella/core";
import { leggiOfferteXml, type Anomalia } from "./leggi-offerte.js";
import { leggiParametriCsv } from "./leggi-parametri.js";

export const VERSIONE_LETTORE = "0.1.0";
const FONTE = "Portale Offerte (ARERA / Acquirente Unico) – sezione Open Data";
const LICENZA = "Dati open data del Portale Offerte, riuso libero con citazione della fonte \"Portale Offerte\"";

const RE_OFFERTE = /^PO_Offerte_([EGD])_MLIBERO_(\d{8})\.xml$/;
const RE_PARAMETRI = /^PO_Parametri_Mercato_Libero_([EG])_(\d{8})\.csv$/;
const COMMODITY: Record<string, Commodity> = { E: "luce", G: "gas", D: "dual" };

export interface ReportQualita {
  data: string;
  offertePerFile: Record<string, number>;
  anomaliePerTipo: Record<string, number>;
  esempi: Anomalia[];
  avvisi: string[];
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export async function creaFotografia(cartellaRaw: string, cartellaOut: string): Promise<{ foto: Fotografia; qualita: ReportQualita }> {
  const nomi = (await readdir(cartellaRaw)).sort();
  const file: Fotografia["file"] = [];
  const offerte: Offerta[] = [];
  const anomalie: Anomalia[] = [];
  const parametri: { luce: Parametro[]; gas: Parametro[] } = { luce: [], gas: [] };
  const offertePerFile: Record<string, number> = {};
  const avvisi: string[] = [];
  const date = new Set<string>();

  for (const nome of nomi) {
    const mo = RE_OFFERTE.exec(nome);
    const mp = RE_PARAMETRI.exec(nome);
    if (!mo && !mp) continue;
    const buf = await readFile(join(cartellaRaw, nome));
    file.push({ nome, sha256: sha256(buf), byte: buf.length });
    if (mo) {
      date.add(mo[2]!);
      const r = leggiOfferteXml(buf.toString("utf8"), COMMODITY[mo[1]!]!);
      offerte.push(...r.offerte);
      anomalie.push(...r.anomalie);
      offertePerFile[nome] = r.offerte.length;
      if (r.offerte.length === 0) avvisi.push(`${nome}: nessuna offerta letta`);
    } else if (mp) {
      date.add(mp[2]!);
      const r = leggiParametriCsv(buf.toString("utf8"));
      parametri[mp[1] === "E" ? "luce" : "gas"] = r.parametri;
      if (r.scartate.length) avvisi.push(`${nome}: ${r.scartate.length} righe scartate`);
    }
  }

  for (const atteso of ["E", "G"]) {
    if (!file.some((f) => f.nome.startsWith(`PO_Offerte_${atteso}_`))) avvisi.push(`Manca il file offerte ${COMMODITY[atteso]}`);
  }
  if (date.size > 1) avvisi.push(`I file hanno date diverse: ${[...date].join(", ")}`);
  const dataCompatta = [...date][0] ?? "00000000";
  const data = `${dataCompatta.slice(0, 4)}-${dataCompatta.slice(4, 6)}-${dataCompatta.slice(6, 8)}`;

  const conta = (f: (o: Offerta) => boolean) => offerte.filter(f).length;
  const conteggi: Record<string, number> = {
    offerte: offerte.length,
    venditori: new Set(offerte.map((o) => o.pivaVenditore)).size,
    luce: conta((o) => o.commodity === "luce"),
    gas: conta((o) => o.commodity === "gas"),
    dual: conta((o) => o.commodity === "dual"),
    domestiche: conta((o) => o.cliente === "domestico"),
    fisse: conta((o) => o.prezzo === "fisso"),
    variabili: conta((o) => o.prezzo === "variabile"),
    conPenaleRecesso: conta((o) => o.derivati.haPenaleRecesso),
    domesticheLuceFisseConPenale: conta((o) => o.commodity === "luce" && o.cliente === "domestico" && o.prezzo === "fisso" && o.derivati.haPenaleRecesso),
    conCondizioniLimitanti: conta((o) => o.derivati.haCondizioniLimitanti),
    disponibiliOvunque: conta((o) => o.derivati.disponibileOvunque),
  };

  const foto: Fotografia = {
    data,
    generataIl: new Date().toISOString(),
    versioneLettore: VERSIONE_LETTORE,
    fonte: FONTE,
    licenza: LICENZA,
    file,
    conteggi,
    offerte,
    parametri,
  };

  const anomaliePerTipo: Record<string, number> = {};
  for (const a of anomalie) {
    const k = `${a.campo}: ${a.messaggio}${a.valore ? ` (${a.valore})` : ""}`;
    anomaliePerTipo[k] = (anomaliePerTipo[k] ?? 0) + 1;
  }
  const qualita: ReportQualita = {
    data,
    offertePerFile,
    anomaliePerTipo: Object.fromEntries(Object.entries(anomaliePerTipo).sort((a, b) => b[1] - a[1])),
    esempi: anomalie.slice(0, 50),
    avvisi,
  };

  const dir = join(cartellaOut, data);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "offerte.json.gz"), gzipSync(JSON.stringify(foto)));
  await writeFile(join(dir, "qualita.json"), JSON.stringify(qualita, null, 2));
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ data, generataIl: foto.generataIl, versioneLettore: VERSIONE_LETTORE, fonte: FONTE, licenza: LICENZA, file, conteggi }, null, 2));
  return { foto, qualita };
}
