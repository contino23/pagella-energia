import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scenarioMedia12Mesi, stimaSpesaLuce, type Offerta } from "@pagella/core";
import { leggiOfferteXml } from "../src/leggi-offerte.js";
import { leggiParametriCsv } from "../src/leggi-parametri.js";

const xml = readFileSync(new URL("./fixtures/luce-3-offerte.xml", import.meta.url), "utf8");
const { offerte } = leggiOfferteXml(xml, "luce");
const parametri = leggiParametriCsv(readFileSync(new URL("./fixtures/PO_Parametri_Mercato_Libero_E_20261103.csv", import.meta.url), "utf8")).parametri;
const beeFlat = offerte.find((o) => o.codice === "000432ESFML01XXAPEBEEFLAT2026V04")!;
const famiglia = { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true };
const nessunIndice = { valori: {}, descrizione: "" };

describe("stima spesa luce domestica", () => {
  it("offerta fissa monoraria: coincide con il calcolo a mano (Bee Flat, 2700 kWh, 3 kW)", () => {
    const s = stimaSpesaLuce(beeFlat, famiglia, parametri, nessunIndice);
    // Calcolo indipendente in Python con le formule v3.02 e i parametri del 3/11/2026.
    expect(s.totale).toBe(1166.2);
    const voce = (n: string) => s.voci.find((v) => v.voce === n)!.importo;
    expect(voce("energia")).toBe(624.51); // 0,2313 €/kWh × 2700
    expect(voce("commercializzazione")).toBe(145.11); // 144 €/anno + DISPbt
    expect(voce("accise")).toBe(21.79); // 960 kWh tassati: esenzione ridotta a 1740 kWh
    expect(s.calcolabile).toBe(true);
  });

  it("accise: nessuna sotto 1.800 kWh, piena oltre 3 kW o per non residenti", () => {
    const acc = (p: Partial<typeof famiglia>) =>
      stimaSpesaLuce(beeFlat, { ...famiglia, ...p }, parametri, nessunIndice).voci.find((v) => v.voce === "accise")!.importo;
    expect(acc({ consumoAnnuoKwh: 1500 })).toBe(0);
    expect(acc({ consumoAnnuoKwh: 2000 })).toBe(Math.round(0.0227 * 200 * 100) / 100);
    expect(acc({ potenzaKw: 4.5 })).toBe(Math.round(0.0227 * 2700 * 100) / 100);
    expect(acc({ residente: false })).toBe(Math.round(0.0227 * 2700 * 100) / 100);
  });

  it("offerta variabile: indice × (1+λ) + spread", () => {
    const variabile = offerte.find((o) => o.codice === "001686ESVFL00XXPI1026AU000000000")!;
    // È un'offerta per altri usi: la usiamo solo per verificare la meccanica dell'energia.
    const s = stimaSpesaLuce(variabile, famiglia, parametri, { valori: { PUN: 0.1 }, descrizione: "test" });
    const energia = s.voci.find((v) => v.voce === "energia")!.importo;
    expect(energia).toBeCloseTo(0.1 * 1.1 * 2700 + 0.033 * 2700, 2);
    expect(s.prezzoMedioEnergiaKwh).toBeCloseTo(0.143, 5);
  });

  it("variabile senza indice disponibile: dichiarata non calcolabile", () => {
    const variabile = offerte.find((o) => o.prezzo === "variabile")!;
    const s = stimaSpesaLuce(variabile, famiglia, parametri, nessunIndice);
    expect(s.calcolabile).toBe(false);
  });

  it("sconti mensili e a scaglioni: conta solo il mese e lo scaglione giusti", () => {
    const o: Offerta = structuredClone(beeFlat);
    o.sconti = [
      { nome: "primo mese", descrizione: "", validita: "ENTRO_12_MESI", condizione: "NESSUNA", primaIva: true, meseValidita: 1,
        importi: [{ tipo: "VENDITA", valore: 0.12, unita: "EUR_KWH" }] },
      { nome: "scaglioni", descrizione: "", validita: "INGRESSO", condizione: "NESSUNA", primaIva: true,
        importi: [
          { tipo: "VENDITA", valore: 0.5, unita: "EUR_KWH", validoDa: 0, validoFino: 1000 },
          { tipo: "VENDITA", valore: 0.01, unita: "EUR_KWH", validoDa: 1001, validoFino: 3000 },
        ] },
    ];
    const s = stimaSpesaLuce(o, famiglia, parametri, nessunIndice);
    expect(s.voci.find((v) => v.voce === "sconti")!.importo).toBeCloseTo(-(0.12 * 2700 / 12 + 0.01 * 2700), 2);
  });

  it("scenario indici: media degli ultimi 12 mesi", () => {
    const storico = Array.from({ length: 14 }, (_, i) => ({ mese: `2025-${String(i + 1).padStart(2, "0")}`, indici: { PUN: i < 2 ? 9 : 0.1 } }));
    expect(scenarioMedia12Mesi(storico).valori.PUN).toBeCloseTo(0.1, 10);
  });
});

import { creaScenari, forchetta } from "@pagella/core";
describe("scenari", () => {
  const storico = Array.from({ length: 14 }, (_, i) => ({ mese: `2025-${String((i % 12) + 1).padStart(2, "0")}`.replace(/^2025-(0[1-2])$/, (m) => (i >= 12 ? m.replace("2025", "2026") : m)), indici: { PUN: 0.1 + i * 0.01 } }));
  it("centrale = media ultimi 3 mesi, forchetta = min/max ultimi 12", () => {
    const s = creaScenari(storico);
    expect(s.centrale.valori.PUN).toBeCloseTo((0.21 + 0.22 + 0.23) / 3, 10);
    expect(s.basso.valori.PUN).toBeCloseTo(0.12, 10);
    expect(s.alto.valori.PUN).toBeCloseTo(0.23, 10);
    expect(s.centrale.descrizione).toBe("Media dicembre 2025 – febbraio 2026");
  });
  it("forchetta di un'offerta fissa: tre valori uguali", () => {
    const s = creaScenari(storico);
    const f = forchetta((sc) => stimaSpesaLuce(beeFlat, famiglia, parametri, sc), s);
    expect(f.minimo).toBe(f.centrale.totale);
    expect(f.massimo).toBe(f.centrale.totale);
  });
});

describe("sconti per fascia oraria", () => {
  it("uno sconto per fascia F1/F2/F3 vale una volta sola sul totale, non tre", async () => {
    const { stimaSpesaLuce, scontiPerUnita } = await import("@pagella/core");
    const { readFileSync } = await import("node:fs");
    const { gunzipSync } = await import("node:zlib");
    const foto = JSON.parse(gunzipSync(readFileSync(new URL("../../data/fotografie/2026-11-03/offerte.json.gz", import.meta.url))).toString());
    const base = foto.offerte.find((o: any) => o.commodity === "luce" && o.prezzo === "fisso" && o.sconti.length === 0 && o.componenti.some((c: any) => c.ruolo === "energia"));
    const prof = { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true };
    const sc = (nome: string, cf: string) => ({ nome, descrizione: "", validita: "INGRESSO", condizione: "NESSUNA", primaIva: true, componenteFascia: cf, importi: [{ tipo: "VENDITA", valore: 0.02, unita: "EUR_KWH" }] });
    const conFasce = { ...base, sconti: [sc("Sconto F1", "11"), sc("Sconto F2", "12"), sc("Sconto F3", "13")] };
    const unico = { ...base, sconti: [{ ...sc("Sconto", ""), componenteFascia: undefined }] };
    const scenario = { valori: {}, descrizione: "" };
    const a = stimaSpesaLuce(conFasce, prof, foto.parametri.luce, scenario);
    const b = stimaSpesaLuce(unico, prof, foto.parametri.luce, scenario);
    expect(a.totale).toBeCloseTo(b.totale, 1);
    expect(scontiPerUnita(conFasce, 2700, 0.15, { F1: 0.33, F2: 0.31, F3: 0.36 })).toHaveLength(1);
    expect(scontiPerUnita(conFasce, 2700, 0.15, { F1: 0.33, F2: 0.31, F3: 0.36 })[0]!.perUnita).toBeCloseTo(0.02, 5);
  });
});
