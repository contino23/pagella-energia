import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creaPagella, avvisoPenale, costoNelTesto, penaleRecesso, stimaSpesaLuce, votoPrezzo, votoVincoli, type Offerta } from "@pagella/core";
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

describe("penale di uscita", () => {
  const base = (testo: string, extra: Partial<Offerta> = {}): Offerta => ({
    nome: "Prova", descrizione: "", durataMesi: null,
    condizioni: [{ tipo: "ONERI_RECESSO_ANTICIPATO", codice: "05", limitante: false, testo }],
    derivati: { haPenaleRecesso: true, haCondizioniLimitanti: false, haServiziAggiuntivi: false, disponibileOvunque: true },
    ...extra,
  }) as unknown as Offerta;

  it("scrive il costo solo quando il venditore lo indica", () => {
    const p = penaleRecesso(base("In caso di recesso durante i primi due anni (24 mesi) di fornitura a prezzo fisso ... pari a 138€ nel primo mese di fornitura, 132€ nel secondo"))!;
    expect(avvisoPenale(p)).toEqual({ titolo: "Penale di uscita", testo: "se cambi fornitore nei primi 24 mesi (2 anni): fino a 138 €, che cala ogni mese" });
    const vaga = penaleRecesso(base("Oneri di Recesso Anticipato", { descrizione: "Prezzo fisso bloccato per dieci anni." }))!;
    expect(avvisoPenale(vaga).titolo).toBe("Possibile penale di uscita:");
  });
  it("riconosce i modi più comuni di scrivere il costo", () => {
    expect(costoNelTesto("non potrà essere superiore al valore massimo di 300 euro per il primo anno di fornitura, 200 euro per il secondo anno di fornitura e 100 euro per il terzo anno")).toBe("fino a 300 € il 1° anno, 200 € il 2° anno, 100 € il 3° anno");
    expect(costoNelTesto("importo massimo = 8 € × n° mesi, dove n° mesi = numero di mesi residui. L'importo indicato è da intendersi iva esclusa.")).toBe("fino a 8 € per ogni mese che manca alla scadenza + IVA");
    expect(costoNelTesto("fino a un massimo di 90,00€ IVA esclusa")).toBe("fino a 90 € + IVA");
    expect(costoNelTesto("penale pari al 100% del valore annuale della CCV pari ad € 240,00 ... pari al 50% del valore annuale della CCV pari ad € 120,00")).toBe("fino a 240 €");
    expect(costoNelTesto("Oneri per il recesso anticipato.")).toBeUndefined();
  });
  it("preferisce la durata dell'offerta agli scaglioni del testo", () => {
    expect(penaleRecesso(base("massimo di 300 euro per il primo anno di fornitura, 200 euro per il secondo anno", { durataMesi: 36 }))!.mesi).toBe(36);
  });
  it("usa la descrizione e le date quando la durata manca", () => {
    expect(penaleRecesso(base("Oneri di Recesso Anticipato", { descrizione: "Prezzo fisso bloccato per dieci anni." }))!.mesi).toBe(120);
    expect(penaleRecesso(base("anticipatamente rispetto alla durata", { descrizione: "prezzo fisso e invariabile fino al 31/12/2031, con energia" }))!.finoAl).toBe("31/12/2031");
  });
  it("nella descrizione conta la durata del blocco, non altri mesi", () => {
    expect(penaleRecesso(base("Per quest'offerta e' previsto un onere di recesso anticipato", { descrizione: "il prezzo che l'offerta NeN Dieci ti permette di bloccare per 10 anni. Dopo 12 mesi, ricalcoleremo la tua rata" }))!.mesi).toBe(120);
  });
  it("riconosce chi dichiara di non avere penali", () => {
    expect(penaleRecesso(base("Octopus Energy non applica alcun onere di recesso, quindi anche questa offerta non ne prevede."))).toBeNull();
  });
  it("riconosce un importo per ogni mese che manca", () => {
    expect(penaleRecesso(base("pari a 1,99 € (uno/99 euro) per ogni mese residuo", { durataMesi: 26 }))!.costo).toBe("fino a 1,99 € per ogni mese che manca alla scadenza");
  });
});
