import { describe, expect, it } from "vitest";
import { estraiDatiBolletta } from "@pagella/core";

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
    expect(d.trovati).toHaveLength(5);
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
