import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataIso, leggiOfferteXml } from "../src/leggi-offerte.js";
import { campiCsv, leggiParametriCsv } from "../src/leggi-parametri.js";

const xml = readFileSync(new URL("./fixtures/luce-3-offerte.xml", import.meta.url), "utf8");
const { offerte, anomalie } = leggiOfferteXml(xml, "luce");
const per = (cod: string) => offerte.find((o) => o.codice === cod)!;

describe("lettore offerte", () => {
  it("legge tutte le offerte del campione senza anomalie", () => {
    expect(offerte).toHaveLength(3);
    expect(anomalie).toEqual([]);
  });

  it("offerta variabile per altri usi (+ IMPRESA)", () => {
    const o = per("001686ESVFL00XXPI1026AU000000000");
    expect(o.commodity).toBe("luce");
    expect(o.cliente).toBe("altri_usi");
    expect(o.prezzo).toBe("variabile");
    expect(o.durataMesi).toBeNull(); // -1 = indeterminata
    expect(o.indice?.codice).toBe("12");
    expect(o.validaDal).toBe("2026-10-13T16:27:02");
    expect(o.consumoMin).toBe(10001);
    expect(o.consumoMax).toBe(80000);
    const spread = o.componenti.find((c) => c.nome === "SPREAD")!;
    expect(spread.isSpread).toBe(true);
    expect(spread.ruolo).toBe("energia");
    expect(spread.prezzi.map((p) => p.fascia)).toEqual(["F1", "F2", "F3"]);
    expect(spread.prezzi.every((p) => p.valore === 0.033 && p.unita === "EUR_KWH")).toBe(true);
    const fissa = o.componenti.find((c) => c.ruolo === "quota_fissa")!;
    expect(fissa.prezzi[0]).toEqual({ valore: 192, unita: "EUR_ANNO" });
    expect(o.dispacciamento).toContainEqual({ codice: "99", nome: "Capacity market", valore: 0.011 });
  });

  it("offerta domestica fissa monoraria con penale di recesso (Bee Flat)", () => {
    const o = per("000432ESFML01XXAPEBEEFLAT2026V04");
    expect(o.cliente).toBe("domestico");
    expect(o.prezzo).toBe("fisso");
    expect(o.durataMesi).toBe(39);
    expect(o.fasce).toBe("Monoraria");
    expect(o.pagamenti).toEqual(["01", "02", "04"]);
    const pe = o.componenti.find((c) => c.nome === "PE")!;
    expect(pe.prezzi[0]).toMatchObject({ valore: 0.2313, unita: "EUR_KWH", fascia: "F0" });
    expect(o.derivati.haPenaleRecesso).toBe(true);
    const penale = o.condizioni.find((c) => c.tipo === "ONERI_RECESSO_ANTICIPATO")!;
    expect(penale.testo.length).toBeGreaterThan(20);
    expect(o.sconti.length).toBeGreaterThan(0);
    expect(o.derivati.disponibileOvunque).toBe(true);
  });

  it("offerta limitata a zone geografiche", () => {
    const o = per("000502ESVFL01XXPNPCCLS1709260200");
    expect(o.zone).not.toBeNull();
    expect(o.zone!.comuni.length).toBeGreaterThan(0);
    expect(o.zone!.comuni.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(o.derivati.disponibileOvunque).toBe(false);
  });

  it("non fallisce su codici sconosciuti e li segnala", () => {
    const strano = xml.replace("<MACROAREA>04</MACROAREA>", "<MACROAREA>77</MACROAREA>");
    const r = leggiOfferteXml(strano, "luce");
    expect(r.offerte).toHaveLength(3);
    expect(r.anomalie.some((a) => a.campo === "MACROAREA" && a.valore === "77")).toBe(true);
  });

  it("scarta i codici duplicati", () => {
    const doppio = xml.replace("</ListaOfferteMercatoLibero>", xml.split("<offerta>")[1]!.replace(/^/, "<offerta>").split("</offerta>")[0] + "</offerta></ListaOfferteMercatoLibero>");
    const r = leggiOfferteXml(doppio, "luce");
    expect(r.offerte).toHaveLength(3);
    expect(r.anomalie.some((a) => a.messaggio.includes("duplicato"))).toBe(true);
  });
});

describe("utilità", () => {
  it("converte le date del Portale", () => {
    expect(dataIso("10/01/2027_23:59:59")).toBe("2027-01-10T23:59:59");
  });

  it("legge il CSV dei parametri con campi tra virgolette", () => {
    expect(campiCsv('qt,0.105049,"Trasporto (QT) con PCS 0,03852 GJ/Smc"')).toEqual(["qt", "0.105049", "Trasporto (QT) con PCS 0,03852 GJ/Smc"]);
    const { parametri, scartate } = leggiParametriCsv('nome_parametro,valore,descrizione\niva_c,0.100000,IVA DOMESTICO\nrotto,abc,x\n');
    expect(parametri).toEqual([{ nome: "iva_c", valore: 0.1, descrizione: "IVA DOMESTICO" }]);
    expect(scartate).toHaveLength(1);
  });
});
