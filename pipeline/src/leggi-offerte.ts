/**
 * Lettore dei file XML "PO_Offerte_{E|G|D}_MLIBERO_AAAAMMGG.xml" del Portale Offerte.
 * Trasforma ogni <offerta> nel modello normalizzato di @pagella/core.
 *
 * Principio: non fallire mai per un dato inatteso. Ogni anomalia finisce
 * nell'elenco `anomalie`, che alimenta il report di qualità.
 */
import { XMLParser } from "fast-xml-parser";
import {
  FASCIA_COMPONENTE,
  IDX_PREZZO_ENERGIA_GAS,
  IDX_PREZZO_ENERGIA_LUCE,
  LIMITANTE_SI,
  TIPOLOGIA_CONDIZIONE,
  TIPOLOGIA_FASCE,
  condizioneSconto,
  etichetta,
  tipoSconto,
  unitaComponente,
  unitaSconto,
  validitaSconto,
  type Commodity,
  type Componente,
  type Condizione,
  type Offerta,
  type Prezzo,
  type RuoloComponente,
  type Sconto,
  type TipoCliente,
  type TipoPrezzo,
} from "@pagella/core";

export interface Anomalia {
  codiceOfferta: string;
  campo: string;
  valore: string;
  messaggio: string;
}

export interface RisultatoLettura {
  offerte: Offerta[];
  anomalie: Anomalia[];
}

/** Elementi che possono ripetersi: vanno sempre letti come array. */
const RIPETIBILI = new Set([
  "offerta",
  "TIPOLOGIA_ATT_CONTR",
  "MODALITA",
  "MetodoPagamento",
  "Dispacciamento",
  "ComponenteImpresa",
  "IntervalloPrezzi",
  "CondizioniContrattuali",
  "Sconto",
  "PrezziSconto",
  "ProdottiServiziAggiuntivi",
  "ComponentiRegolate",
  "CODICE",
  "REGIONE",
  "PROVINCIA",
  "COMUNE",
  "OFFERTE_CONGIUNTE_EE",
  "OFFERTE_CONGIUNTE_GAS",
]);

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false, // tutto come stringa: "01" deve restare "01"
  trimValues: true,
  isArray: (nome) => RIPETIBILI.has(nome),
});

type Nodo = Record<string, unknown>;

const s = (x: unknown): string => (x === undefined || x === null ? "" : String(x).trim());
const arr = <T = Nodo>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : x === undefined || x === null ? [] : [x as T]);
const nodo = (x: unknown): Nodo => (x && typeof x === "object" ? (x as Nodo) : {});

function numero(x: unknown): number | undefined {
  const t = s(x).replace(",", ".");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** "13/10/2026_16:27:02" → "2026-10-13T16:27:02" (ora italiana, senza fuso). */
export function dataIso(x: unknown): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})_(\d{2}:\d{2}:\d{2})$/.exec(s(x));
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}` : s(x);
}

function commodityDaMercato(codice: string): Commodity | undefined {
  return codice === "01" ? "luce" : codice === "02" ? "gas" : codice === "03" ? "dual" : undefined;
}

function cliente(codice: string): TipoCliente {
  return codice === "01" ? "domestico" : codice === "02" ? "altri_usi" : codice === "03" ? "condominio" : "sconosciuto";
}

function tipoPrezzo(codice: string): TipoPrezzo {
  return codice === "01" ? "fisso" : codice === "02" ? "variabile" : codice === "04" ? "misto" : "sconosciuto";
}

function ruolo(macroarea: string): RuoloComponente {
  switch (macroarea) {
    case "01": return "quota_fissa";
    case "02": return "commercializzazione_consumo";
    case "04": return "energia";
    case "05": return "una_tantum";
    case "06": return "energia_verde";
    default: return "sconosciuto";
  }
}

/**
 * Le unità 04/05 cambiano significato tra file: nel gas "04" è €/Smc.
 * Nella luce "04" non è previsto per i prezzi: lo segnaliamo come anomalia.
 */
function prezzi(ci: Nodo, commodity: Commodity, cod: string, anomalie: Anomalia[], monoraria: boolean): Prezzo[] {
  return arr<Nodo>(ci.IntervalloPrezzi).flatMap((ip) => {
    const valore = numero(ip.PREZZO);
    if (valore === undefined) {
      anomalie.push({ codiceOfferta: cod, campo: "PREZZO", valore: s(ip.PREZZO), messaggio: "prezzo non numerico" });
      return [];
    }
    const um = s(ip.UNITA_MISURA);
    const unita = unitaComponente(um);
    if (unita === "SCONOSCIUTA" || (commodity === "luce" && unita === "EUR_SMC")) {
      anomalie.push({ codiceOfferta: cod, campo: "UNITA_MISURA", valore: um, messaggio: `unità inattesa per ${commodity}` });
    }
    const p: Prezzo = { valore, unita };
    const f = s(ip.FASCIA_COMPONENTE);
    if (f) {
      // Nelle offerte monorarie il prezzo unico viene trasmesso come fascia "01":
      // lo trattiamo come F0 (tutte le ore), come fa il Portale nel calcolo.
      const fascia = monoraria && f === "01" ? "F0" : FASCIA_COMPONENTE[f];
      if (!fascia) anomalie.push({ codiceOfferta: cod, campo: "FASCIA_COMPONENTE", valore: f, messaggio: "fascia sconosciuta" });
      p.fascia = fascia ?? `?${f}`;
    }
    const da = numero(ip.CONSUMO_DA);
    const a = numero(ip.CONSUMO_A);
    if (da !== undefined) p.consumoDa = da;
    if (a !== undefined) p.consumoA = a;
    const pv = nodo(ip.PeriodoValidita);
    const durata = numero(pv.DURATA);
    const fino = numero(pv.VALIDO_FINO);
    if (durata !== undefined) p.durataMesi = durata;
    if (fino !== undefined) p.validoFinoMese = fino;
    return [p];
  });
}

function componenti(o: Nodo, commodity: Commodity, cod: string, anomalie: Anomalia[]): Componente[] {
  const monoraria = s(nodo(o.TipoPrezzo).TIPOLOGIA_FASCE) === "01";
  return arr<Nodo>(o.ComponenteImpresa).map((ci) => {
    const nome = s(ci.NOME);
    const r = ruolo(s(ci.MACROAREA));
    if (r === "sconosciuto") {
      anomalie.push({ codiceOfferta: cod, campo: "MACROAREA", valore: s(ci.MACROAREA), messaggio: "macroarea sconosciuta" });
    }
    return {
      nome,
      descrizione: s(ci.DESCRIZIONE),
      ruolo: r,
      // Le regole del Portale riconoscono lo spread dal nome esatto "SPREAD";
      // i venditori lo scrivono in molti modi, quindi confrontiamo senza maiuscole.
      isSpread: r === "energia" && /^spread\b/i.test(nome),
      opzionale: s(ci.TIPOLOGIA) === "02",
      prezzi: prezzi(ci, commodity, cod, anomalie, monoraria),
    };
  });
}

function condizioni(o: Nodo, cod: string, anomalie: Anomalia[]): Condizione[] {
  return arr<Nodo>(o.CondizioniContrattuali).map((c) => {
    const codice = s(c.TIPOLOGIA_CONDIZIONE);
    const voce = TIPOLOGIA_CONDIZIONE[codice];
    if (!voce) anomalie.push({ codiceOfferta: cod, campo: "TIPOLOGIA_CONDIZIONE", valore: codice, messaggio: "tipo condizione sconosciuto" });
    const altro = s(c.ALTRO);
    const descr = s(c.DESCRIZIONE);
    return {
      tipo: voce?.tipo ?? "ALTRO",
      codice,
      limitante: s(c.LIMITANTE) === LIMITANTE_SI,
      testo: altro && altro !== descr ? `${altro}: ${descr}` : descr,
    };
  });
}

function sconti(o: Nodo): Sconto[] {
  return arr<Nodo>(o.Sconto).map((sc) => {
    const cond = nodo(sc.Condizione);
    const pv = nodo(sc.PeriodoValidita);
    const durata = numero(pv.DURATA);
    const condTesto = s(cond.DESCRIZIONE_CONDIZIONE);
    const r: Sconto = {
      nome: s(sc.NOME),
      descrizione: s(sc.DESCRIZIONE),
      validita: validitaSconto(s(sc.VALIDITA)),
      condizione: condizioneSconto(s(cond.CONDIZIONE_APPLICAZIONE)),
      primaIva: s(sc.IVA_SCONTO) === "01",
      importi: arr<Nodo>(sc.PrezziSconto).flatMap((p) => {
        const valore = numero(p.PREZZO);
        if (valore === undefined) return [];
        const voce: Sconto["importi"][number] = { tipo: tipoSconto(s(p.TIPOLOGIA)), valore, unita: unitaSconto(s(p.UNITA_MISURA)) };
        const da = numero(p.VALIDO_DA);
        const fino = numero(p.VALIDO_FINO);
        if (da !== undefined) voce.validoDa = da;
        if (fino !== undefined) voce.validoFino = fino;
        return [voce];
      }),
    };
    if (condTesto) r.condizioneTesto = condTesto;
    if (durata !== undefined) r.durataMesi = durata;
    return r;
  });
}

function residenza(codice: string): Offerta["residenza"] {
  return codice === "01" ? "residenti" : codice === "02" ? "non_residenti" : codice === "03" ? "tutti" : undefined;
}

export function leggiOfferta(o: Nodo, commodityFile: Commodity, anomalie: Anomalia[]): Offerta | null {
  const id = nodo(o.IdentificativiOfferta);
  const det = nodo(o.DettaglioOfferta);
  const cod = s(id.COD_OFFERTA);
  if (!cod) {
    anomalie.push({ codiceOfferta: "", campo: "COD_OFFERTA", valore: "", messaggio: "offerta senza codice: scartata" });
    return null;
  }

  const mercato = s(det.TIPO_MERCATO);
  const commodity = commodityDaMercato(mercato) ?? commodityFile;
  if (commodityDaMercato(mercato) !== commodityFile) {
    anomalie.push({ codiceOfferta: cod, campo: "TIPO_MERCATO", valore: mercato, messaggio: `non coerente con il file (${commodityFile})` });
  }

  const durataRaw = numero(det.DURATA);
  const rif = nodo(o.RiferimentiPrezzoEnergia);
  const idx = s(rif.IDX_PREZZO_ENERGIA);
  // Le offerte dual possono riferirsi a indici della luce o del gas.
  const tabIdx =
    commodity === "gas" ? IDX_PREZZO_ENERGIA_GAS
    : commodity === "dual" ? { ...IDX_PREZZO_ENERGIA_GAS, ...IDX_PREZZO_ENERGIA_LUCE }
    : IDX_PREZZO_ENERGIA_LUCE;
  if (idx && !tabIdx[idx]) {
    anomalie.push({ codiceOfferta: cod, campo: "IDX_PREZZO_ENERGIA", valore: idx, messaggio: "indice non ancora decodificato" });
  }

  const car = nodo(o.CaratteristicheOfferta);
  const zone = o.ZoneOfferta ? nodo(o.ZoneOfferta) : null;
  const contatti = nodo(det.Contatti);
  const dual = nodo(o.OffertaDual);
  const fasce = s(nodo(o.TipoPrezzo).TIPOLOGIA_FASCE);

  const comps = componenti(o, commodity, cod, anomalie);
  const conds = condizioni(o, cod, anomalie);
  const servizi = arr<Nodo>(o.ProdottiServiziAggiuntivi)
    .map((p) => {
      const r: { nome: string; dettaglio: string; macroarea?: string } = { nome: s(p.NOME), dettaglio: s(p.DETTAGLIO) };
      if (s(p.MACROAREA)) r.macroarea = s(p.MACROAREA);
      return r;
    })
    .filter((p) => p.nome && !/^nessun/i.test(p.nome));

  const offerta: Offerta = {
    codice: cod,
    pivaVenditore: s(id.PIVA_UTENTE),
    commodity,
    nome: s(det.NOME_OFFERTA),
    descrizione: s(det.DESCRIZIONE),
    cliente: cliente(s(det.TIPO_CLIENTE)),
    prezzo: tipoPrezzo(s(det.TIPO_OFFERTA)),
    durataMesi: durataRaw === undefined || durataRaw < 0 ? null : durataRaw,
    fasce: fasce ? etichetta(TIPOLOGIA_FASCE, fasce) : "Non indicata",
    validaDal: dataIso(nodo(o.ValiditaOfferta).DATA_INIZIO),
    validaAl: dataIso(nodo(o.ValiditaOfferta).DATA_FINE),
    offertaSingola: s(det.OFFERTA_SINGOLA) !== "NO",
    offerteCongiunte: [...arr<string>(dual.OFFERTE_CONGIUNTE_EE), ...arr<string>(dual.OFFERTE_CONGIUNTE_GAS)].map(s),
    attivazione: arr<string>(nodo(det.ModalitaAttivazione).MODALITA).map(s),
    operazioniContrattuali: arr<string>(det.TIPOLOGIA_ATT_CONTR).map(s),
    pagamenti: arr<Nodo>(o.MetodoPagamento).map((m) => s(m.MODALITA_PAGAMENTO)),
    garanzie: s(det.GARANZIE),
    contatti: { telefono: s(contatti.TELEFONO) },
    componenti: comps,
    componentiRegolate: arr<Nodo>(o.ComponentiRegolate).flatMap((c) => arr<string>(c.CODICE).map(s)),
    dispacciamento: arr<Nodo>(o.Dispacciamento).map((d) => {
      const r: { codice: string; nome: string; valore?: number } = { codice: s(d.TIPO_DISPACCIAMENTO), nome: s(d.NOME) };
      const val = numero(d.VALORE_DISP);
      if (val !== undefined) r.valore = val;
      return r;
    }),
    condizioni: conds,
    sconti: sconti(o),
    servizi,
    zone: zone
      ? {
          regioni: arr<string>(zone.REGIONE).map(s),
          province: arr<string>(zone.PROVINCIA).map(s),
          comuni: arr<string>(zone.COMUNE).map(s),
        }
      : null,
    derivati: {
      haPenaleRecesso: conds.some((c) => c.tipo === "ONERI_RECESSO_ANTICIPATO"),
      haCondizioniLimitanti: conds.some((c) => c.limitante),
      haServiziAggiuntivi: servizi.length > 0,
      disponibileOvunque: !zone,
    },
  };

  const res = residenza(s(det.DOMESTICO_RESIDENTE));
  if (res) offerta.residenza = res;
  else if (s(det.DOMESTICO_RESIDENTE)) {
    anomalie.push({ codiceOfferta: cod, campo: "DOMESTICO_RESIDENTE", valore: s(det.DOMESTICO_RESIDENTE), messaggio: "valore sconosciuto" });
  }
  if (idx) {
    offerta.indice = { codice: idx, etichetta: etichetta(tabIdx, idx) };
    if (s(rif.ALTRO)) offerta.indice.nota = s(rif.ALTRO);
    const coeff = numero(rif.COEFFICIENTE);
    if (coeff !== undefined) offerta.indice.coefficiente = coeff;
  }
  if (s(contatti.URL_SITO_VENDITORE)) offerta.contatti.sito = s(contatti.URL_SITO_VENDITORE);
  if (s(contatti.URL_OFFERTA)) offerta.contatti.urlOfferta = s(contatti.URL_OFFERTA);
  const cmin = numero(car.CONSUMO_MIN), cmax = numero(car.CONSUMO_MAX);
  const pmin = numero(car.POTENZA_MIN), pmax = numero(car.POTENZA_MAX);
  if (cmin !== undefined) offerta.consumoMin = cmin;
  if (cmax !== undefined) offerta.consumoMax = cmax;
  if (pmin !== undefined) offerta.potenzaMin = pmin;
  if (pmax !== undefined) offerta.potenzaMax = pmax;

  if (offerta.prezzo === "variabile" && !offerta.indice) {
    anomalie.push({ codiceOfferta: cod, campo: "IDX_PREZZO_ENERGIA", valore: "", messaggio: "offerta variabile senza indice" });
  }
  // Le dual non hanno prezzi propri: rimandano alle offerte luce e gas collegate.
  if (comps.length === 0 && commodity !== "dual") {
    anomalie.push({ codiceOfferta: cod, campo: "ComponenteImpresa", valore: "", messaggio: "nessuna componente di prezzo" });
  }
  return offerta;
}

export function leggiOfferteXml(xml: string, commodityFile: Commodity): RisultatoLettura {
  const doc = parser.parse(xml) as Nodo;
  const radice = nodo(doc.ListaOfferteMercatoLibero);
  const anomalie: Anomalia[] = [];
  const offerte: Offerta[] = [];
  const visti = new Set<string>();
  for (const o of arr<Nodo>(radice.offerta)) {
    const off = leggiOfferta(o, commodityFile, anomalie);
    if (!off) continue;
    if (visti.has(off.codice)) {
      anomalie.push({ codiceOfferta: off.codice, campo: "COD_OFFERTA", valore: off.codice, messaggio: "codice duplicato nello stesso file" });
      continue;
    }
    visti.add(off.codice);
    offerte.push(off);
  }
  return { offerte, anomalie };
}
