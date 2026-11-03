/**
 * Stima della spesa annua per un'offerta gas del mercato libero, cliente domestico.
 *
 * Segue le "Regole per il calcolo della Spesa" v3.02 (cap. 4.1.2–4.1.4 e 4.3), con queste scelte dichiarate:
 *  - Variabili: indice mensile degli ultimi 12 mesi, pesato sul profilo di prelievo mensile
 *    (il Portale usa valori elaborati da AU non pubblicati negli open data).
 *  - Distribuzione (τ3), UG2, accise e addizionale regionale sono applicati per scaglioni progressivi,
 *    come avviene in bolletta (il documento AU usa la sola fascia del consumo totale).
 *  - IVA: 10% sulla quota corrispondente ai primi 480 Smc, 22% sul resto (ripartizione proporzionale).
 *  - Accise e addizionali regionali non sono negli open data: tabelle in questo file, aggiornate a ottobre 2026.
 */
import { AMBITO_GAS_PER_REGIONE } from "./codici.js";
import { mappaParametri, prezzoEffettivo, type ScenarioIndici, type StimaSpesa, type VoceSpesa } from "./calcolo-luce.js";
import type { Offerta, Parametro } from "./modello.js";

export type ZonaClimatica = "A" | "B" | "C" | "D" | "E" | "F";

export interface ProfiloGas {
  consumoAnnuoSmc: number;
  /** Codice ISTAT della regione (01–20): serve per ambito tariffario, accise e addizionale. */
  regione: string;
  zonaClimatica: ZonaClimatica;
  /** Usi del gas: per il profilo mensile delle variabili. Default: riscaldamento + cottura/acqua calda. */
  usi?: { riscaldamento: boolean; cotturaAcquaCalda: boolean };
  /** Se omesso è dedotto dalla regione (regioni interamente ex Cassa del Mezzogiorno). */
  cassaMezzogiorno?: boolean;
}

/** Profili di prelievo AU (anno termico 2022-23), ottobre → settembre, in percentuale. */
const PROFILO_RISCALDAMENTO: Record<Exclude<ZonaClimatica, "A">, number[]> = {
  B: [0, 0, 24.323744, 31.698887, 25.126184, 18.851183, 0, 0, 0, 0, 0, 0],
  C: [0, 9.594662, 21.370092, 26.896058, 21.327359, 16.433414, 4.378412, 0, 0, 0, 0, 0],
  D: [0, 12.613843, 20.059088, 26.254768, 19.814041, 14.447358, 6.810899, 0, 0, 0, 0, 0],
  E: [4.764595, 13.905756, 21.547432, 24.52109, 18.374008, 12.022932, 4.864186, 0, 0, 0, 0, 0],
  F: [5.442036, 13.00326, 19.826967, 23.042104, 17.565794, 11.78966, 5.058456, 2.744122, 0.423156, 0, 0, 1.104441],
};
const PROFILO_COTTURA = [7.163684, 8.780829, 11.818173, 13.536809, 11.384587, 11.357431, 8.029119, 6.268512, 5.539913, 5.182234, 5.145513, 5.793195];
/** Quota del consumo annuo attribuita al riscaldamento quando ci sono entrambi gli usi (convenzione nostra). */
const QUOTA_RISCALDAMENTO = 0.8;

/** Pesi mensili (somma 1), indicizzati per mese di calendario 1–12. */
export function pesiMensiliGas(p: ProfiloGas): Record<number, number> {
  const usi = p.usi ?? { riscaldamento: true, cotturaAcquaCalda: true };
  const zona = p.zonaClimatica === "A" ? "B" : p.zonaClimatica;
  const risc = PROFILO_RISCALDAMENTO[zona];
  const qr = usi.riscaldamento && usi.cotturaAcquaCalda ? QUOTA_RISCALDAMENTO : usi.riscaldamento ? 1 : 0;
  const pesi: Record<number, number> = {};
  for (let i = 0; i < 12; i++) {
    const meseCalendario = ((i + 9) % 12) + 1; // indice 0 = ottobre
    pesi[meseCalendario] = (qr * risc[i]! + (1 - qr) * PROFILO_COTTURA[i]!) / 100;
  }
  return pesi;
}

/** Mappa codice indice gas → colonna del file prezzi storici. */
export const COLONNA_INDICE_GAS: Record<string, string> = { "03": "PSV", "10": "PSV", "14": "PSV", "15": "PSBIL", "06": "CMEM" };

/** Regioni interamente nei territori ex Cassa del Mezzogiorno (Lazio e Marche lo sono solo in parte). */
const REGIONI_CMZ = new Set(["13", "14", "15", "16", "17", "18", "19", "20"]);

const SCAGLIONI_IMPOSTE = [120, 480, 1560, Infinity];
/** Accisa usi domestici €/Smc per scaglione [0-120, 121-480, 481-1560, oltre]. */
const ACCISA = { normale: [0.044, 0.175, 0.17, 0.186], cmz: [0.038, 0.135, 0.12, 0.15] };
/** Addizionale regionale €/Smc per scaglione, per codice ISTAT. Assente = non applicata. */
const ADDIZIONALE: Record<string, number[]> = {
  "01": [0.022, 0.0258, 0.0258, 0.0258],
  "05": [0.007747, 0.023241, 0.025823, 0.030987],
  "07": [0.022, 0.0258, 0.0258, 0.0258], // zone C e D; per E ed F vedi sotto
  "08": [0.022, 0.0309874, 0.0309874, 0.0309874],
  "09": [0.022, 0.030987, 0.030987, 0.030987],
  "10": [0.005165, 0.005165, 0.005165, 0.005165],
  "11": [0.0155, 0.0181, 0.0207, 0.0258],
  "12": [0.022, 0.03099, 0.03099, 0.03099],
  "13": [0.019, 0.023241, 0.025823, 0.025823], // zone E ed F: vedi sotto
  "14": [0.019, 0.030987, 0.030987, 0.030987],
  "15": [0.019, 0.031, 0.031, 0.031],
  "16": [0.019, 0.03098, 0.03098, 0.03098],
  "17": [0.019, 0.0258228, 0.0258228, 0.0258228],
  "18": [0.019, 0.02582, 0.02582, 0.03099],
};

/** Somma progressiva per scaglioni: ogni aliquota vale solo per la quota di consumo nel suo scaglione. */
export function perScaglioni(consumo: number, limiti: number[], aliquote: number[]): number {
  let tot = 0, prec = 0;
  for (let i = 0; i < limiti.length && consumo > prec; i++) {
    tot += (Math.min(consumo, limiti[i]!) - prec) * aliquote[i]!;
    prec = limiti[i]!;
  }
  return tot;
}

export function stimaSpesaGas(o: Offerta, profilo: ProfiloGas, parametri: Parametro[], indici: ScenarioIndici & { mensili?: Record<string, Record<number, number>> }): StimaSpesa {
  const P = mappaParametri(parametri);
  const avvisi: string[] = [];
  let calcolabile = true;
  const C = profilo.consumoAnnuoSmc;
  const ambito = AMBITO_GAS_PER_REGIONE[profilo.regione];
  if (!ambito) {
    avvisi.push(`Regione ${profilo.regione} senza ambito tariffario gas negli open data (es. Sardegna)`);
    calcolabile = false;
  }
  const a = ambito ?? "a3";

  // ---------- Energia (§4.3.1) ----------
  let energia = 0;
  if (o.prezzo === "variabile" || o.prezzo === "misto") {
    const col = o.indice ? COLONNA_INDICE_GAS[o.indice.codice] : undefined;
    const coeff = o.indice?.coefficiente ?? 1;
    const mensile = col ? indici.mensili?.[col] : undefined;
    if (col && mensile && Object.keys(mensile).length === 12) {
      const pesi = pesiMensiliGas(profilo);
      for (let m = 1; m <= 12; m++) energia += C * pesi[m]! * mensile[m]! * coeff;
    } else if (col && indici.valori[col] !== undefined) {
      energia += C * indici.valori[col]! * coeff;
    } else {
      avvisi.push(`Indice ${o.indice?.codice ?? "assente"} non disponibile: spesa energia non calcolabile`);
      calcolabile = false;
    }
  }
  for (const c of o.componenti.filter((x) => x.ruolo === "energia" || x.ruolo === "energia_verde")) {
    const p = prezzoEffettivo(c.prezzi, C);
    if (!p) continue;
    if (p.unita === "EUR_SMC") {
      if (p.valore > 5) { avvisi.push(`Prezzo fuori scala in "${c.nome}": ${p.valore} €/Smc`); calcolabile = false; }
      energia += p.valore * C;
    } else if (p.unita === "EUR_ANNO") energia += p.valore;
    else avvisi.push(`Unità ${p.unita} inattesa in "${c.nome}"`);
  }
  const energiaVolume = energia;
  // Componenti regolate in quota energia: CPR e GRAD (oggi entrambe 0 €/Smc).
  if (o.componentiRegolate.includes("03")) energia += P("cpr") * C;
  if (o.componentiRegolate.includes("06")) energia += P("grad") * C;
  if (o.componentiRegolate.includes("07")) avvisi.push("Componente regolata 07 (CCR) non pubblicata negli open data: non inclusa");

  // ---------- Commercializzazione (§4.3.2) ----------
  let commercializzazione = 0;
  let unaTantum = 0;
  for (const c of o.componenti.filter((x) => x.ruolo === "quota_fissa" || x.ruolo === "commercializzazione_consumo" || x.ruolo === "una_tantum")) {
    const p = prezzoEffettivo(c.prezzi, C);
    if (!p) continue;
    switch (p.unita) {
      case "EUR_ANNO": commercializzazione += p.valore; break;
      case "EUR": unaTantum += p.valore; break;
      case "EUR_SMC": commercializzazione += p.valore * C; break;
      default: avvisi.push(`Unità ${p.unita} inattesa in "${c.nome}"`);
    }
  }
  if (o.componentiRegolate.includes("09")) commercializzazione += P("qvd_f_d");
  if (["04", "05", "10"].some((k) => o.componentiRegolate.includes(k))) commercializzazione += P("qvd_v_d") * C;

  // ---------- Trasporto e gestione contatore (§4.1.2), contatore < G6 ----------
  const limitiDistr = [120, 480, 1560, 5000, 80000, 200000];
  const tau3 = limitiDistr.map((_, i) => P(`tau3_f${i + 1}_${a}`));
  const rete = P(`tau1_cc1_${a}`) + P(`st_${a}`) + P(`vr_${a}`) + perScaglioni(C, limitiDistr, tau3) + (P("qt") + P("rs") + P("ug1")) * C;

  // ---------- Oneri di sistema (§4.1.3.1) ----------
  const ug2 = limitiDistr.map((_, i) => P(`ug2p_d_f${i + 1}`));
  const oneri = P("ug2s") + (P("re") + P("ug3")) * C + perScaglioni(C, limitiDistr, ug2);

  // ---------- Sconti (§4.3.6), stesse regole della luce ----------
  const sconti = (soloIncond: boolean) => {
    let prima = 0, dopo = 0;
    for (const s of o.sconti) {
      if (s.validita !== "INGRESSO" && s.validita !== "ENTRO_12_MESI") continue;
      if (soloIncond && s.condizione !== "NESSUNA") continue;
      if (!soloIncond && s.condizione === "ALTRO") continue;
      const mesi = s.meseValidita !== undefined ? 1 / 12 : s.durataMesi && s.durataMesi < 12 ? s.durataMesi / 12 : 1;
      for (const imp of s.importi.filter((i) => (i.validoDa === undefined && i.validoFino === undefined) || (C >= (i.validoDa ?? 0) && C <= (i.validoFino ?? Infinity)))) {
        let v = 0;
        if (imp.tipo === "FISSO" && imp.unita === "EUR") v = imp.valore;
        else if (imp.tipo === "FISSO" && imp.unita === "EUR_ANNO") v = imp.valore * mesi;
        else if (imp.tipo === "VENDITA" && imp.unita === "EUR_SMC") v = imp.valore * C * mesi;
        else if (imp.tipo === "VENDITA" && imp.unita === "PERCENTUALE") v = (energiaVolume * imp.valore) / 100 * mesi;
        else continue;
        if (s.primaIva) prima += v; else dopo += v;
      }
    }
    return { prima, dopo };
  };

  // ---------- Imposte (§4.1.4.1) ----------
  const cmz = profilo.cassaMezzogiorno ?? REGIONI_CMZ.has(profilo.regione);
  const accise = perScaglioni(C, SCAGLIONI_IMPOSTE, cmz ? ACCISA.cmz : ACCISA.normale);
  let addizionale = 0;
  const zonaFredda = profilo.zonaClimatica === "E" || profilo.zonaClimatica === "F";
  if (profilo.regione === "07" && zonaFredda) addizionale = C * (profilo.zonaClimatica === "E" ? 0.0155 : 0.0103);
  else if (profilo.regione === "13" && zonaFredda) addizionale = C * 0.01033;
  else if (ADDIZIONALE[profilo.regione]) addizionale = perScaglioni(C, SCAGLIONI_IMPOSTE, ADDIZIONALE[profilo.regione]!);
  if (profilo.regione === "12" || profilo.regione === "11") avvisi.push("Lazio e Marche sono in parte ex Cassa del Mezzogiorno: accisa stimata con l'aliquota ordinaria");

  const quota10 = C > 0 ? Math.min(C, 480) / C : 1;
  const ivaMedia = P("iva_f1") * quota10 + P("iva_f3") * (1 - quota10);
  const totale = (soloIncond: boolean) => {
    const sc = sconti(soloIncond);
    const imponibile = energia + commercializzazione + rete + oneri + unaTantum - sc.prima + accise + addizionale;
    const iva = imponibile * ivaMedia;
    return { tot: imponibile + iva - sc.dopo, iva, sconti: sc.prima + sc.dopo };
  };
  const base = totale(true);
  const conCond = totale(false);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const voci: VoceSpesa[] = [
    { voce: "energia", importo: r2(energia) },
    { voce: "commercializzazione", importo: r2(commercializzazione) },
    { voce: "dispacciamento", importo: 0 },
    { voce: "rete", importo: r2(rete) },
    { voce: "oneri", importo: r2(oneri) },
    { voce: "una_tantum", importo: r2(unaTantum) },
    { voce: "sconti", importo: r2(-base.sconti) },
    { voce: "accise", importo: r2(accise + addizionale) },
    { voce: "iva", importo: r2(base.iva) },
  ];
  return {
    codiceOfferta: o.codice,
    totale: r2(base.tot),
    totaleConScontiCondizionati: r2(conCond.tot),
    voci,
    prezzoMedioEnergiaKwh: C > 0 ? Math.round((energiaVolume / C) * 1e5) / 1e5 : 0, // per il gas è €/Smc
    avvisi,
    calcolabile,
  };
}

/** Scenario indici con i valori mensili degli ultimi 12 mesi (per calendario), per pesare il profilo gas. */
export function scenarioMensile12Mesi(storico: Array<{ mese: string; indici: Record<string, number> }>): Record<string, Record<number, number>> {
  const ultimi = [...storico].sort((x, y) => x.mese.localeCompare(y.mese)).slice(-12);
  const out: Record<string, Record<number, number>> = {};
  for (const r of ultimi) {
    const m = Number(r.mese.slice(5, 7));
    for (const [k, v] of Object.entries(r.indici)) (out[k] ??= {})[m] = v;
  }
  return out;
}
