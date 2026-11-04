import { describe, expect, it } from "vitest";
import { estraiDatiBolletta, offertaDaBolletta, stimaSpesaLuce, type Parametro } from "@pagella/core";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

// Testo d'esempio costruito sul modello ARERA del 2025 (frontespizio, Box dell'offerta), non una bolletta reale.
const ESEMPIO_LUCE = `
BOLLETTA LUCE
Cliente: [NOME COGNOME]
Indirizzo di fornitura: Via [INDIRIZZO] 1, 51039 Quarrata (PT)
Tipologia cliente: Domestico residente
Potenza impegnata: 3 kW
BOX DELL'OFFERTA
Nome offerta: Bee Flat
Codice offerta: 000432ESFML01XXAPEBEEFLAT2026V04
Tipo di prezzo: fisso
Consumo annuo: 2.700 kWh
`;

const noti = new Set(["000432ESFML01XXAPEBEEFLAT2026V04", "025767GSVML01XXXXXGASDOMFWEB1126"]);

describe("lettura della bolletta", () => {
  it("bolletta luce: trova codice, consumo, potenza, residenza e CAP", () => {
    const d = estraiDatiBolletta(ESEMPIO_LUCE, noti);
    expect(d).toMatchObject({ codiceOfferta: "000432ESFML01XXAPEBEEFLAT2026V04", commodity: "luce", consumoAnnuo: 2700, potenzaKw: 3, residente: true, cap: "51039" });
    expect(d.trovati).toEqual(expect.arrayContaining(["codice offerta", "consumo annuo", "potenza", "residenza", "CAP di fornitura", "nome offerta"]));
    expect(d.tipoPrezzo).toBe("fisso");
  });

  it("codice spezzato da uno spazio nell'estrazione del PDF", () => {
    const d = estraiDatiBolletta("Codice offerta 025767GSVML01XXXX XGASDOMFWEB1126 Consumo annuo 1.400 Smc", noti);
    expect(d.codiceOfferta).toBe("025767GSVML01XXXXXGASDOMFWEB1126");
    expect(d.commodity).toBe("gas");
    expect(d.consumoAnnuo).toBe(1400);
    expect(d.potenzaKw).toBeUndefined();
  });

  it("non residente e codice non presente nel Portale di oggi", () => {
    const d = estraiDatiBolletta("Domestico non residente. Codice offerta: ABC123DEF456GHI789 Consumo annuo 900 kWh", noti);
    expect(d.residente).toBe(false);
    expect(d.codiceOfferta).toBe("ABC123DEF456GHI789");
    expect(d.consumoAnnuo).toBe(900);
  });

  it("testo senza dati utili: nessun campo inventato", () => {
    const d = estraiDatiBolletta("Gentile cliente, grazie per averci scelto.", noti);
    expect(d.trovati).toEqual([]);
    expect(d.codiceOfferta).toBeUndefined();
  });
});

// Estratto anonimizzato di una bolletta reale (testo come lo estrae pdf.js nel browser):
// nomi, indirizzo, codici cliente e POD sostituiti; prezzi e struttura invariati.
const REALE_VARIABILE = `Servizio: Energia Elettrica - Mercato Libero - Domestici
Periodo oggetto di fatturazione: 01/08/2026 - 30/09/2026
DENOMINAZIONE DELL'OFFERTA
COMMERCIALE
Devra Friends Luce
Consumo annuo aggiornato: 2.890 kWh
Periodo: Dal 01/10/2025 al 30/09/2026
SCONTRINO DELL'ENERGIA
Indirizzo di fornitura: VIA [INDIRIZZO] 1 50121 FIRENZE FI
POD: IT000E00000000 - Potenza Impegnata: 3,00 kW
Quota per consumi
585 kWh  x  0,292974 €/kWh  171,39 €
di cui spesa per la vendita di energia elettrica  0,245077 €/kWh  143,37 €
di cui spesa per la rete e gli oneri generali di sistema  0,047897 €/kWh  28,02 €
Quota fissa e Quota potenza
2 mesi  x  6,970000 €/mese  13,94 €
di cui spesa per la vendita di energia elettrica  5,050000 €/mese  10,10 €
di cui spesa per la rete e gli oneri generali di sistema  1,920000 €/mese  3,84 €
La spesa per la vendita di energia elettrica è determinata in base ai corrispettivi di vendita previsti dal contratto.
BOX DELL'OFFERTA
Denominazione commerciale dell'offerta  Devra Friends Luce
Codice offerta  042441ENVML01XX000000FRIENDSLUCE
Tipologia offerta  Prezzo variabile
Tipologia prezzo  Fasce orarie di prezzo
Oneri di recesso anticipato  Non presenti
Tipologia Cliente  DOMESTICO RESIDENTE
Spesa annua sostenuta: 830,42 € (periodo: Dal 01/10/2025 al 30/09/2026)`;

describe("bolletta reale con offerta non più in vendita", () => {
  const d = estraiDatiBolletta(REALE_VARIABILE, noti);

  it("legge box dell'offerta, scontrino e spesa annua", () => {
    expect(d).toMatchObject({
      codiceOfferta: "042441ENVML01XX000000FRIENDSLUCE", commodity: "luce", consumoAnnuo: 2890, potenzaKw: 3, residente: true, cap: "50121",
      nomeOfferta: "Devra Friends Luce", tipoPrezzo: "variabile", prezzoVendita: 0.245077, quotaFissaMese: 5.05,
      periodo: { da: "2026-08", a: "2026-09" }, penaleRecesso: false, spesaAnnua: 830.42,
    });
  });

  it("ricostruisce l'offerta: spread = prezzo pagato − PUN dei mesi fatturati", () => {
    const parametri = { luce: [{ nome: "lambda", valore: 0.1, descrizione: "" }, { nome: "dispbt_d", valore: 1.107, descrizione: "" }] as Parametro[], gas: [] };
    const storico = [{ mese: "2026-08", PUN: 0.18 }, { mese: "2026-09", PUN: 0.2 }];
    const o = offertaDaBolletta(d, storico, parametri)!;
    expect(o.prezzo).toBe("variabile");
    expect(o.indice?.codice).toBe("01");
    expect(o.componenti[0]!.prezzi[0]!.valore).toBeCloseTo(0.245077 - 0.19 * 1.1, 6);
    expect(o.componenti[1]!.prezzi[0]!.valore).toBeCloseTo(5.05 * 12 - 1.107, 6);
    expect(o.derivati.haPenaleRecesso).toBe(false);
    // Senza l'indice dei mesi fatturati non si ricostruisce.
    expect(offertaDaBolletta(d, [{ mese: "2025-01", PUN: 0.1 }], parametri)).toBeNull();
  });

  it("con l'indice dei mesi fatturati, il motore ritrova il prezzo pagato in bolletta", () => {
    const foto = JSON.parse(gunzipSync(readFileSync(new URL("../../data/fotografie/2026-11-03/offerte.json.gz", import.meta.url))).toString());
    const storico = [{ mese: "2026-08", PUN: 0.179999 }, { mese: "2026-09", PUN: 0.207542 }];
    const o = offertaDaBolletta(d, storico, foto.parametri)!;
    const pun = (0.179999 + 0.207542) / 2;
    const s = stimaSpesaLuce(o, { consumoAnnuoKwh: 2890, potenzaKw: 3, residente: true }, foto.parametri.luce, { valori: { PUN: pun }, descrizione: "" });
    expect(s.calcolabile).toBe(true);
    expect(s.voci.find((v) => v.voce === "energia")!.importo).toBeCloseTo(0.245077 * 2890, 0);
    expect(s.voci.find((v) => v.voce === "commercializzazione")!.importo).toBeCloseTo(5.05 * 12, 1);
  });
});
