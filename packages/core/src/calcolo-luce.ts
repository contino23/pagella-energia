/**
 * Stima della spesa annua per un'offerta luce del mercato libero, cliente domestico.
 *
 * Segue le "Regole per il calcolo della Spesa" v3.02 di Acquirente Unico (§3.1.4–3.1.6 e §3.3),
 * con queste differenze dichiarate:
 *  - Variabili: il Portale usa le quotazioni forward dei 4 trimestri successivi, che non sono
 *    negli open data. Usiamo lo scenario passato dal chiamante (di norma media degli ultimi
 *    3 mesi, con forchetta min/max 12 mesi: vedi scenari.ts) e lo dichiariamo.
 *  - L'indice è un valore unico per tutte le fasce (gli open data storici sono monorari).
 *  - Dispacciamento: il tracciato attuale ha codici (09–14) successivi al documento v3.02;
 *    li mappiamo sui parametri regolati corrispondenti.
 *
 * La funzione è pura e senza dipendenze: gira identica in pipeline, sito e app.
 */
import type { Componente, Offerta, Parametro, Prezzo } from "./modello.js";

export interface ProfiloLuce {
  consumoAnnuoKwh: number;
  potenzaKw: number;
  residente: boolean;
  /** Ripartizione per fasce F1/F2/F3; default del Portale per i domestici: 33/31/36. */
  quote?: { F1: number; F2: number; F3: number };
}

export interface ScenarioIndici {
  /** Valore in €/kWh usato per l'indice dell'offerta variabile, per codice indice. */
  valori: Record<string, number>;
  descrizione: string;
}

export interface VoceSpesa {
  voce: "energia" | "commercializzazione" | "dispacciamento" | "rete" | "oneri" | "una_tantum" | "sconti" | "accise" | "iva";
  importo: number;
}

export interface StimaSpesa {
  codiceOfferta: string;
  /** Totale con i soli sconti incondizionati, come il Portale. */
  totale: number;
  /** Totale includendo anche gli sconti per bolletta online / domiciliazione. */
  totaleConScontiCondizionati: number;
  voci: VoceSpesa[];
  /** Prezzo medio dell'energia (materia prima + spread) in €/kWh, IVA esclusa. */
  prezzoMedioEnergiaKwh: number;
  avvisi: string[];
  calcolabile: boolean;
  /** I tre numeri "a colpo d'occhio" della scheda, IVA e imposte escluse. */
  sintesi: SintesiPrezzo;
}

export interface SintesiPrezzo {
  /** Prezzo medio dell'energia per unità (€/kWh o €/Smc): per le variabili include l'indice dello scenario. */
  prezzoUnita: number;
  /** Solo variabili: quanto il venditore aggiunge all'indice, per unità. */
  spreadUnita?: number;
  /** Quota fissa del venditore, € al mese. */
  quotaFissaMese: number;
}

const QUOTE_DOMESTICO = { F1: 0.33, F2: 0.31, F3: 0.36 };

/** Mappa codice indice luce → nome colonna del file prezzi storici. */
export const COLONNA_INDICE_LUCE: Record<string, string> = { "01": "PUN", "08": "PUN", "12": "PUN", "05": "PE" };

export function mappaParametri(parametri: Parametro[]): (nome: string) => number {
  const m = new Map(parametri.map((p) => [p.nome, p.valore]));
  return (nome) => {
    const v = m.get(nome);
    if (v === undefined) throw new Error(`Parametro regolato mancante: ${nome}`);
    return v;
  };
}

/** kWh per fascia oraria richiesta (F0, F1, F2, F3, F23, F12, F13). */
function consumoFascia(fascia: string | undefined, c: { F1: number; F2: number; F3: number; tot: number }): number | undefined {
  switch (fascia) {
    case undefined:
    case "F0": return c.tot;
    case "F1": return c.F1;
    case "F2": return c.F2;
    case "F3": return c.F3;
    case "F23": return c.F2 + c.F3;
    case "F12": return c.F1 + c.F2;
    case "F13": return c.F1 + c.F3;
    // Peak/off-peak (lun-ven 8-20 / resto): approssimate con F1 e F2+F3.
    case "PEAK": return c.F1;
    case "OFFPEAK": return c.F2 + c.F3;
    default: return undefined;
  }
}

/**
 * Sceglie il prezzo da applicare tra più IntervalloPrezzi della stessa fascia:
 * - scaglioni di consumo: quello che contiene il consumo annuo;
 * - validità temporale (prime N mesi): media pesata con il prezzo di default.
 */
export function prezzoEffettivo(prezzi: Prezzo[], consumoAnnuo: number): Prezzo | undefined {
  if (prezzi.length === 0) return undefined;
  const base = prezzi.find((p) => p.consumoDa === undefined && p.consumoA === undefined && p.durataMesi === undefined && p.validoFinoMese === undefined) ?? prezzi[0]!;
  const scaglione = prezzi.find((p) => (p.consumoDa !== undefined || p.consumoA !== undefined) &&
    consumoAnnuo >= (p.consumoDa ?? 0) && consumoAnnuo <= (p.consumoA ?? Infinity));
  const conDurata = prezzi.find((p) => p.durataMesi !== undefined && p.durataMesi < 12);
  if (conDurata) {
    const m = conDurata.durataMesi!;
    return { ...base, valore: (conDurata.valore * m + base.valore * (12 - m)) / 12 };
  }
  return scaglione ?? base;
}

/** Raggruppa i prezzi di una componente per fascia. */
function perFascia(c: Componente): Map<string, Prezzo[]> {
  const g = new Map<string, Prezzo[]>();
  for (const p of c.prezzi) {
    const k = p.fascia ?? "F0";
    g.set(k, [...(g.get(k) ?? []), p]);
  }
  return g;
}

export function stimaSpesaLuce(o: Offerta, profilo: ProfiloLuce, parametri: Parametro[], indici: ScenarioIndici): StimaSpesa {
  const P = mappaParametri(parametri);
  const avvisi: string[] = [];
  const C = profilo.consumoAnnuoKwh;
  const pot = profilo.potenzaKw;
  const q = profilo.quote ?? QUOTE_DOMESTICO;
  const cons = { F1: C * q.F1, F2: C * q.F2, F3: C * q.F3, tot: C };
  const lambda = P("lambda");
  let calcolabile = true;

  // ---------- Energia (§3.3.1): componenti macroarea 04 (prezzo) e 06 (verde) ----------
  let energia = 0;
  let energiaKwh = 0; // solo parte a consumo, per il prezzo medio
  let quotaIndice = 0;
  let fissaVenditore = 0; // €/anno di quote fisse del venditore
  const compEnergia = o.componenti.filter((c) => c.ruolo === "energia" || c.ruolo === "energia_verde");

  if (o.prezzo === "variabile" || o.prezzo === "misto") {
    const col = o.indice ? COLONNA_INDICE_LUCE[o.indice.codice] : undefined;
    const idx = col ? indici.valori[col] : undefined;
    if (idx === undefined) {
      avvisi.push(`Indice ${o.indice?.codice ?? "assente"} non disponibile: spesa energia non calcolabile`);
      calcolabile = false;
    } else {
      const coeff = o.indice?.coefficiente ?? 1;
      quotaIndice = idx * coeff * (1 + lambda) * C;
      energia += quotaIndice;
      energiaKwh += quotaIndice;
    }
  }

  for (const c of compEnergia) {
    for (const [fascia, prezzi] of perFascia(c)) {
      const p = prezzoEffettivo(prezzi, C);
      if (!p) continue;
      switch (p.unita) {
        case "EUR_KWH": {
          const kwh = consumoFascia(fascia, cons);
          if (kwh === undefined) { avvisi.push(`Fascia ${fascia} non gestita in "${c.nome}"`); calcolabile = false; break; }
          if (p.valore > 1) { avvisi.push(`Prezzo fuori scala in "${c.nome}": ${p.valore} €/kWh (forse €/MWh)`); calcolabile = false; }
          energia += p.valore * kwh;
          energiaKwh += p.valore * kwh;
          break;
        }
        case "EUR_ANNO": if (fascia === "F0" || fascia === "F1") { energia += p.valore; fissaVenditore += p.valore; } break;
        case "EUR_KW_ANNO": if (fascia === "F0" || fascia === "F1") { energia += p.valore * pot; fissaVenditore += p.valore * pot; } break;
        case "EUR": break; // una tantum in macroarea energia: non previsto, ignorato
        default: avvisi.push(`Unità ${p.unita} inattesa in "${c.nome}"`);
      }
    }
  }
  if (o.componentiRegolate.includes("02")) avvisi.push("Componente regolata PPE dichiarata: non inclusa (parametro non pubblicato)");

  // ---------- Commercializzazione (§3.3.2): macroarea 01 e 02, + DISPbt, + PCV se dichiarata ----------
  let commercializzazione = P("dispbt_d");
  let unaTantum = 0;
  for (const c of o.componenti.filter((x) => x.ruolo === "quota_fissa" || x.ruolo === "commercializzazione_consumo" || x.ruolo === "una_tantum")) {
    for (const [fascia, prezzi] of perFascia(c)) {
      const p = prezzoEffettivo(prezzi, C);
      if (!p) continue;
      const solaVolta = fascia === "F0" || fascia === "F1";
      switch (p.unita) {
        case "EUR_ANNO": if (solaVolta) { commercializzazione += p.valore; fissaVenditore += p.valore; } break;
        case "EUR_KW_ANNO": if (solaVolta) { commercializzazione += p.valore * pot; fissaVenditore += p.valore * pot; } break;
        case "EUR": if (solaVolta) unaTantum += p.valore; break;
        case "EUR_KWH": {
          const kwh = consumoFascia(fascia, cons);
          if (kwh !== undefined) commercializzazione += p.valore * kwh;
          if (p.valore > 1) { avvisi.push(`Prezzo fuori scala in "${c.nome}": ${p.valore} €/kWh`); calcolabile = false; }
          break;
        }
        default: avvisi.push(`Unità ${p.unita} inattesa in "${c.nome}"`);
      }
    }
  }
  if (o.componentiRegolate.includes("01")) { commercializzazione += P("pcv_c"); fissaVenditore += P("pcv_c"); }

  // ---------- Dispacciamento (§3.3.3) ----------
  let dispacciamento = 0;
  const codiciDisp = new Set(o.dispacciamento.map((d) => d.codice));
  const pacchetto111 = P("msd") + P("modeol") + P("uniess") + P("terna") + P("capprod") + P("interr");
  const mercatoCapacita = (P("cpty_mrkt_1") + P("cpty_mrkt_2") + P("cpty_mrkt_3")) / 3;
  if (codiciDisp.has("01")) dispacciamento += pacchetto111 * (1 + lambda) * C;
  else {
    const singoli: Record<string, string> = { "03": "msd", "04": "modeol", "05": "uniess", "06": "terna", "07": "capprod", "08": "interr" };
    for (const [cod, nome] of Object.entries(singoli)) if (codiciDisp.has(cod)) dispacciamento += P(nome) * (1 + lambda) * C;
  }
  if (codiciDisp.has("09")) dispacciamento += mercatoCapacita * C;
  if (codiciDisp.has("12")) dispacciamento += P("cpstgd") * C;
  if (codiciDisp.has("14")) dispacciamento += P("cdispd") * C;
  for (const d of o.dispacciamento) if (d.codice === "99" && d.valore !== undefined) dispacciamento += d.valore * C;
  if (codiciDisp.has("02")) avvisi.push("Dispacciamento 'come la tutela': valore PD non pubblicato, non incluso");

  // ---------- Trasporto e gestione contatore (§3.1.4.1) ----------
  const rete = P("sigma1") + P("sigma2") * pot + P("sigma3") * C + P("uc3") * C + P("uc6p_d") * C + P("uc6s_d") * pot;

  // ---------- Oneri di sistema (§3.1.5.1) ----------
  const oneri = profilo.residente
    ? (P("asos_dr") + P("arim_dr")) * C
    : P("asos_dnr_f") + P("arim_dnr_f") + (P("asos_dnr_v") + P("arim_dnr_v")) * C;

  // ---------- Sconti (§3.3.7) ----------
  const scontoValore = (soloIncondizionati: boolean) => {
    let primaIva = 0, dopoIva = 0;
    for (const s of o.sconti) {
      if (s.validita !== "INGRESSO" && s.validita !== "ENTRO_12_MESI") continue;
      if (soloIncondizionati && s.condizione !== "NESSUNA") continue;
      if (!soloIncondizionati && s.condizione === "ALTRO") continue; // condizioni non verificabili
      const mesi = s.meseValidita !== undefined ? 1 / 12 : s.durataMesi && s.durataMesi < 12 ? s.durataMesi / 12 : 1;
      // Gli importi con validoDa/validoFino sono scaglioni di consumo: vale solo quello che contiene C.
      const importi = s.importi.filter((i) => i.validoDa === undefined && i.validoFino === undefined
        || (C >= (i.validoDa ?? 0) && C <= (i.validoFino ?? Infinity)));
      for (const imp of importi) {
        let v = 0;
        if (imp.tipo === "FISSO" && imp.unita === "EUR") v = imp.valore;
        else if (imp.tipo === "FISSO" && imp.unita === "EUR_ANNO") v = imp.valore * mesi;
        else if (imp.tipo === "VENDITA" && imp.unita === "EUR_KWH") v = imp.valore * C * mesi;
        else if (imp.tipo === "VENDITA" && imp.unita === "PERCENTUALE") v = (energiaKwh * imp.valore) / 100 * mesi;
        else continue;
        if (s.primaIva) primaIva += v; else dopoIva += v;
      }
    }
    return { primaIva, dopoIva };
  };

  // ---------- Imposte (§3.1.6.1) ----------
  let accise: number;
  if (!profilo.residente) accise = P("acc_c_nr") * C;
  else if (pot <= 3) {
    // Esenzione sui primi 1.800 kWh/anno, che si riduce fino ad annullarsi tra 1.800 e 2.640 kWh.
    const esenti = C <= 1800 ? C : C <= 2640 ? 1800 : Math.max(1800 - (C - 2640), 0);
    accise = C <= 1800 ? 0 : P("acc_c_r_l") * (C - esenti);
  } else accise = P("acc_c_r_h") * C;

  const totale = (soloIncond: boolean) => {
    const sc = scontoValore(soloIncond);
    const imponibile = energia + commercializzazione + dispacciamento + rete + oneri + unaTantum - sc.primaIva + accise;
    const iva = P("iva_c") * imponibile;
    return { tot: imponibile + iva - sc.dopoIva, iva, sconti: sc.primaIva + sc.dopoIva };
  };
  const base = totale(true);
  const conCond = totale(false);

  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    codiceOfferta: o.codice,
    totale: r2(base.tot),
    totaleConScontiCondizionati: r2(conCond.tot),
    voci: [
      { voce: "energia", importo: r2(energia) },
      { voce: "commercializzazione", importo: r2(commercializzazione) },
      { voce: "dispacciamento", importo: r2(dispacciamento) },
      { voce: "rete", importo: r2(rete) },
      { voce: "oneri", importo: r2(oneri) },
      { voce: "una_tantum", importo: r2(unaTantum) },
      { voce: "sconti", importo: r2(-base.sconti) },
      { voce: "accise", importo: r2(accise) },
      { voce: "iva", importo: r2(base.iva) },
    ],
    prezzoMedioEnergiaKwh: C > 0 ? Math.round((energiaKwh / C) * 1e5) / 1e5 : 0,
    avvisi,
    calcolabile,
    sintesi: {
      prezzoUnita: C > 0 ? Math.round((energiaKwh / C) * 1e5) / 1e5 : 0,
      ...(o.prezzo === "variabile" || o.prezzo === "misto" ? { spreadUnita: C > 0 ? Math.round(((energiaKwh - quotaIndice) / C) * 1e5) / 1e5 : 0 } : {}),
      quotaFissaMese: Math.round((fissaVenditore / 12) * 100) / 100,
    },
  };
}

/** Scenario standard: media degli ultimi 12 mesi disponibili di ciascun indice. */
export function scenarioMedia12Mesi(storico: Array<{ mese: string; indici: Record<string, number> }>): ScenarioIndici {
  const ultimi = [...storico].sort((a, b) => a.mese.localeCompare(b.mese)).slice(-12);
  const valori: Record<string, number> = {};
  for (const nome of new Set(ultimi.flatMap((r) => Object.keys(r.indici)))) {
    const v = ultimi.map((r) => r.indici[nome]).filter((x): x is number => x !== undefined);
    if (v.length) valori[nome] = v.reduce((a, b) => a + b, 0) / v.length;
  }
  const da = ultimi[0]?.mese, a = ultimi.at(-1)?.mese;
  return { valori, descrizione: `Media degli indici da ${da} a ${a}` };
}
