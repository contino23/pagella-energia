import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creaPagella, stimaSpesaLuce, votoPrezzo, votoVincoli } from "@pagella/core";
import { leggiOfferteXml } from "../src/leggi-offerte.js";
import { leggiParametriCsv } from "../src/leggi-parametri.js";

const leggi = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const { offerte } = leggiOfferteXml(leggi("luce-3-offerte.xml"), "luce");
const parametri = leggiParametriCsv(leggi("PO_Parametri_Mercato_Libero_E_20261103.csv")).parametri;
const beeFlat = offerte.find((o) => o.codice === "000432ESFML01XXAPEBEEFLAT2026V04")!;
const stima = stimaSpesaLuce(beeFlat, { consumoAnnuoKwh: 2700, potenzaKw: 3, residente: true }, parametri, { valori: {}, descrizione: "" });

describe("pagella", () => {
  it("voto prezzo: scala sullo scarto dalla più economica (+10% → 6, +50% → 0)", () => {
    const spese = [800, 840, 880, 1000, 1200];
    expect(votoPrezzo(800, spese).voto).toBe(10);
    expect(votoPrezzo(840, spese).voto).toBe(8); // +5%
    expect(votoPrezzo(880, spese).voto).toBe(6); // +10%
    expect(votoPrezzo(1000, spese).voto).toBe(3.8); // +25%
    expect(votoPrezzo(1200, spese).voto).toBe(0); // +50%
    expect(votoPrezzo(1000, spese).motivi[0]).toContain("200 €");
    // Una spesa assurdamente bassa (errore nei dati) non diventa il riferimento.
    expect(votoPrezzo(840, [100, 800, 840, 900, 1000]).voto).toBe(8);
  });

  it("vincoli: la penale di recesso toglie 4 punti", () => {
    expect(beeFlat.derivati.haPenaleRecesso).toBe(true);
    const v = votoVincoli(beeFlat);
    expect(v.voto).toBeLessThanOrEqual(6);
    expect(v.motivi.join(" ")).toContain("Penale");
  });

  it("voto complessivo: pesi 60/20/10 ridistribuiti senza la voce affidabilità", () => {
    const p = creaPagella(beeFlat, stima, [stima.totale, stima.totale + 100, stima.totale + 200]);
    const pesi = Object.fromEntries(p.voci.map((v) => [v.voce, v.peso]));
    expect(pesi).toEqual({ prezzo: 0.667, vincoli: 0.222, trasparenza: 0.111, affidabilita: 0 });
    const atteso = p.voci.reduce((s, v) => s + (v.voto ?? 0) * v.peso, 0);
    expect(p.voto).toBeCloseTo(atteso, 1);
    expect(p.voto).toBeGreaterThanOrEqual(0);
    expect(p.voto).toBeLessThanOrEqual(10);
    expect(p.note.join(" ")).toContain("bloccato per 39 mesi");
  });

  it("con lo storico, l'affidabilità entra con il suo 10%", () => {
    const p = creaPagella(beeFlat, stima, [stima.totale], { voto: 8, motivi: ["test"] });
    expect(p.voci.find((v) => v.voce === "affidabilita")!.peso).toBe(0.1);
    expect(p.voci.find((v) => v.voce === "prezzo")!.peso).toBe(0.6);
  });
});

describe("vincoli: lettura del testo sulle garanzie", () => {
  const con = (garanzie: string) => votoVincoli({ ...beeFlat, garanzie, derivati: { ...beeFlat.derivati, haPenaleRecesso: false } }).voto;
  it("riconosce le frasi che escludono il deposito", () => {
    expect(con("Per accettare l'offerta non c'è bisogno di lasciare depositi cauzionali.")).toBe(10);
    expect(con("SEPA")).toBe(10);
    expect(con("DEPOSITO CAUZIONALE")).toBe(9);
  });
});

describe("stima dei consumi per chi non li conosce", () => {
  it("luce: 3 persone senza apparecchi particolari è vicina alla famiglia tipo ARERA", async () => {
    const { stimaConsumoLuce } = await import("@pagella/core");
    expect(stimaConsumoLuce({ persone: 3 })).toBe(2500);
    expect(stimaConsumoLuce({ persone: 4, induzione: true, condizionatore: true })).toBe(3700);
    expect(stimaConsumoLuce({ persone: 1, pompaDiCalore: true, autoElettrica: true })).toBe(5900);
  });
  it("gas: cucina + acqua calda + riscaldamento di 90 m² a Roma (zona D) è vicino alla simulazione del Portale", async () => {
    const { stimaConsumoGas } = await import("@pagella/core");
    const smc = stimaConsumoGas({ persone: 2, cucina: true, acquaCalda: true, riscaldamento: true, metriQuadri: 90, zona: "D" });
    expect(smc).toBeGreaterThan(1500);
    expect(smc).toBeLessThan(1800);
    expect(stimaConsumoGas({ persone: 3, cucina: true, acquaCalda: false, riscaldamento: false, zona: "E" })).toBe(170);
  });
});
