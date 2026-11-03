import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { perScaglioni, pesiMensiliGas, stimaSpesaGas } from "@pagella/core";
import { leggiOfferteXml } from "../src/leggi-offerte.js";
import { leggiParametriCsv } from "../src/leggi-parametri.js";

const leggi = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const { offerte } = leggiOfferteXml(leggi("gas-2-offerte.xml"), "gas");
const parametri = leggiParametriCsv(leggi("PO_Parametri_Mercato_Libero_G_20261103.csv")).parametri;
const fissa = offerte.find((o) => o.codice === "025767GSVML01XXXXXGASDOMFWEB1126")!;
const deca = offerte.find((o) => o.codice === "007970GSVML01XX00000000GASDECAV2")!;
const toscana = { consumoAnnuoSmc: 1000, regione: "09", zonaClimatica: "D" as const };
const voce = (s: ReturnType<typeof stimaSpesaGas>, n: string) => s.voci.find((v) => v.voce === n)!.importo;

describe("stima spesa gas domestico", () => {
  it("scaglioni progressivi", () => {
    expect(perScaglioni(1000, [120, 480, 1560, Infinity], [0.044, 0.175, 0.17, 0.186])).toBeCloseTo(120 * 0.044 + 360 * 0.175 + 520 * 0.17, 8);
    expect(perScaglioni(100, [120, 480], [1, 2])).toBe(100);
  });

  it("offerta a prezzo fisso, 1000 Smc in Toscana: coincide con il calcolo a mano", () => {
    const s = stimaSpesaGas(fissa, toscana, parametri, { valori: {}, descrizione: "" });
    expect(fissa.prezzo).toBe("fisso");
    // Calcolo indipendente con i parametri del 3/11/2026 (ambito centrale a3):
    // rete = τ1 73,59 + τ3 (360×0,111183 + 520×0,101763) + (QT+RS+UG1)×1000 = 309,21
    expect(voce(s, "rete")).toBe(309.21);
    // oneri = UG2'' −21,63 + (RE+UG3)×1000 + UG2' (360×0,0496 + 520×0,0293) = 48,17
    expect(voce(s, "oneri")).toBe(48.17);
    // accise 156,68 + addizionale regionale Toscana 29,91
    expect(voce(s, "accise")).toBe(186.59);
    expect(s.totale).toBe(2543.29);
  });

  it("offerta variabile: indice mensile pesato sul profilo di prelievo", () => {
    const psv = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0.5]));
    const s = stimaSpesaGas(deca, toscana, parametri, { valori: { PSV: 0.5 }, mensili: { PSV: psv }, descrizione: "test" });
    expect(deca.indice?.codice).toBe("14");
    expect(voce(s, "energia")).toBeCloseTo(500, 2); // spread 0
    expect(s.calcolabile).toBe(true);
  });

  it("il profilo mensile pesa di più l'inverno e somma a 1", () => {
    const pesi = pesiMensiliGas(toscana);
    const somma = Object.values(pesi).reduce((a, b) => a + b, 0);
    expect(somma).toBeCloseTo(1, 6);
    expect(pesi[1]!).toBeGreaterThan(pesi[7]! * 3);
  });

  it("Sardegna: nessun ambito negli open data, stima dichiarata non calcolabile", () => {
    const s = stimaSpesaGas(fissa, { ...toscana, regione: "20" }, parametri, { valori: {}, descrizione: "" });
    expect(s.calcolabile).toBe(false);
  });
});
