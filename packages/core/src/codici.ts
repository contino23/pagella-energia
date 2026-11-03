/**
 * Tabelle di decodifica dei codici del tracciato open data del Portale Offerte.
 *
 * Fonte di ogni voce:
 *  - "regole"   → "Regole per il calcolo della Spesa" v3.02 (AU, 22/12/2022)
 *  - "manuale"  → Manuale operativo compilazione offerte ML v1.0 (AU, 2018) + osservazioni AIGET
 *  - "dedotto"  → ricavato incrociando codici e descrizioni nei dati (da confermare)
 *
 * I codici sconosciuti non devono mai far fallire la lettura: vengono conservati
 * così come sono e segnalati nel report di qualità.
 */

export type Fonte = "regole" | "manuale" | "dedotto";

export interface VoceCodice {
  etichetta: string;
  fonte: Fonte;
}

export type TabellaCodici = Readonly<Record<string, VoceCodice>>;

const v = (etichetta: string, fonte: Fonte): VoceCodice => ({ etichetta, fonte });

export const TIPO_MERCATO: TabellaCodici = {
  "01": v("Energia elettrica", "dedotto"),
  "02": v("Gas naturale", "dedotto"),
  "03": v("Dual fuel", "dedotto"),
};

export const TIPO_CLIENTE: TabellaCodici = {
  "01": v("Domestico", "dedotto"),
  "02": v("Altri usi", "dedotto"),
  "03": v("Condominio uso domestico", "dedotto"),
};

export const DOMESTICO_RESIDENTE: TabellaCodici = {
  "01": v("Solo residenti", "dedotto"),
  "02": v("Solo non residenti", "dedotto"),
  "03": v("Residenti e non residenti", "dedotto"),
};

export const TIPO_OFFERTA: TabellaCodici = {
  "01": v("Prezzo fisso", "regole"),
  "02": v("Prezzo variabile", "regole"),
  "04": v("Prezzo misto", "dedotto"),
};

export const TIPOLOGIA_ATT_CONTR: TabellaCodici = {
  "01": v("Cambio fornitore", "dedotto"),
  "02": v("Prima attivazione", "dedotto"),
  "03": v("Riattivazione / subentro", "dedotto"),
  "04": v("Voltura", "dedotto"),
  "99": v("Sempre", "manuale"),
};

export const MODALITA_ATTIVAZIONE: TabellaCodici = {
  "01": v("Solo web", "manuale"),
  "02": v("Qualsiasi canale", "manuale"),
  "03": v("Punto vendita", "manuale"),
  "04": v("Teleselling", "dedotto"),
  "05": v("Agenzia / porta a porta", "dedotto"),
  "99": v("Altro", "manuale"),
};

export const MODALITA_PAGAMENTO: TabellaCodici = {
  "01": v("Domiciliazione bancaria", "dedotto"),
  "02": v("Domiciliazione postale", "dedotto"),
  "03": v("Domiciliazione su carta di credito", "dedotto"),
  "04": v("Bollettino precompilato", "dedotto"),
  "99": v("Altro", "dedotto"),
};

/** Struttura per fasce del prezzo (TipoPrezzo/TIPOLOGIA_FASCE). */
export const TIPOLOGIA_FASCE: TabellaCodici = {
  "01": v("Monoraria", "regole"),
  "02": v("F1, F2", "dedotto"),
  "03": v("Fasce F1, F2, F3", "regole"),
  "04": v("F1, F2, F3, F4", "dedotto"),
  "05": v("F1, F2, F3, F4, F5", "dedotto"),
  "06": v("F1, F2, F3, F4, F5, F6", "dedotto"),
  "07": v("Peak / Off-peak", "dedotto"),
  "91": v("Bioraria F1, F23", "regole"),
  "92": v("Bioraria F2, F13", "dedotto"),
  "93": v("Bioraria F3, F12", "dedotto"),
};

/** Fascia a cui si riferisce un prezzo (IntervalloPrezzi/FASCIA_COMPONENTE). */
export const FASCIA_COMPONENTE: Readonly<Record<string, string>> = {
  "01": "F1",
  "02": "F2",
  "03": "F3",
  "04": "F4",
  "05": "F5",
  "06": "F6",
  "07": "PEAK",
  "08": "OFFPEAK",
  "91": "F23",
  "92": "F13",
  "93": "F12",
};

export const MACROAREA_COMPONENTE: TabellaCodici = {
  "01": v("Quota fissa di commercializzazione", "regole"),
  "02": v("Commercializzazione a consumo", "regole"),
  "04": v("Prezzo dell'energia", "regole"),
  "05": v("Una tantum", "regole"),
  "06": v("Componente energia verde", "regole"),
};

export const TIPOLOGIA_COMPONENTE: TabellaCodici = {
  "01": v("Standard", "dedotto"),
  "02": v("Opzionale", "dedotto"),
};

export type Unita = "EUR_ANNO" | "EUR_KW_ANNO" | "EUR_KWH" | "EUR_SMC" | "EUR" | "PERCENTUALE" | "SCONOSCIUTA";

/** Unità di misura dei prezzi delle componenti impresa. */
export function unitaComponente(codice: string): Unita {
  switch (codice) {
    case "01": return "EUR_ANNO";
    case "02": return "EUR_KW_ANNO";
    case "03": return "EUR_KWH";
    case "04": return "EUR_SMC";
    case "05": return "EUR";
    default: return "SCONOSCIUTA";
  }
}

/** Unità di misura degli sconti (Sconto/PrezziSconto/UNITA_MISURA). */
export function unitaSconto(codice: string): Unita {
  switch (codice) {
    case "01": return "EUR_ANNO";
    case "02": return "EUR_KW_ANNO";
    case "03": return "EUR_KWH";
    case "04": return "EUR_SMC";
    case "05": return "EUR";
    case "06": return "PERCENTUALE";
    default: return "SCONOSCIUTA";
  }
}

export const TIPO_DISPACCIAMENTO: TabellaCodici = {
  "01": v("Dispacciamento (del. 111/06)", "regole"),
  "02": v("Come il servizio di tutela", "regole"),
  "03": v("MSD (art. 44 del. 111/06)", "dedotto"),
  "04": v("Modulazione eolica (art. 44 bis)", "dedotto"),
  "05": v("Unità essenziali (art. 45)", "dedotto"),
  "06": v("Funzionamento Terna (art. 46)", "dedotto"),
  "07": v("Capacità produttiva (art. 48)", "dedotto"),
  "08": v("Interrompibilità (art. 73)", "dedotto"),
  "09": v("Corrispettivo mercato capacità", "dedotto"),
  "10": v("Corrispettivo mercato capacità MT", "dedotto"),
  "11": v("Reintegro salvaguardia", "dedotto"),
  "12": v("Perequazione tutele graduali", "dedotto"),
  "13": v("DispBT", "dedotto"),
  "14": v("CdispD", "dedotto"),
  "99": v("Altro (valore indicato dal venditore)", "regole"),
};

/**
 * Indice di riferimento delle offerte variabili.
 * Gli stessi codici hanno significato diverso per luce e gas: la decodifica
 * definitiva va confermata col file dei prezzi storici degli indici.
 */
export const IDX_PREZZO_ENERGIA_LUCE: TabellaCodici = {
  "01": v("PUN (trimestrale)", "dedotto"),
  "05": v("Prezzo energia del servizio di tutela", "dedotto"),
  "08": v("PUN (altro)", "dedotto"),
  "12": v("PUN Index GME (mensile)", "dedotto"),
  "99": v("Altro indice", "manuale"),
};

export const IDX_PREZZO_ENERGIA_GAS: TabellaCodici = {
  "03": v("PSV (trimestrale)", "dedotto"),
  "06": v("CMEM", "dedotto"),
  "10": v("PSV day-ahead", "dedotto"),
  "14": v("PSV (mensile)", "dedotto"),
  "15": v("PSBIL", "dedotto"),
  "99": v("Altro indice", "manuale"),
};

export type TipoCondizione =
  | "ATTIVAZIONE"
  | "DISATTIVAZIONE"
  | "RECESSO"
  | "DURATA_RINNOVO"
  | "ONERI_RECESSO_ANTICIPATO"
  | "ALTRO";

export const TIPOLOGIA_CONDIZIONE: Readonly<Record<string, { tipo: TipoCondizione; fonte: Fonte }>> = {
  "01": { tipo: "ATTIVAZIONE", fonte: "dedotto" },
  "02": { tipo: "DISATTIVAZIONE", fonte: "manuale" },
  "03": { tipo: "RECESSO", fonte: "dedotto" },
  "04": { tipo: "DURATA_RINNOVO", fonte: "dedotto" },
  "05": { tipo: "ONERI_RECESSO_ANTICIPATO", fonte: "dedotto" },
  "99": { tipo: "ALTRO", fonte: "dedotto" },
};

/** LIMITANTE = 01: la condizione limita chi può sottoscrivere l'offerta. */
export const LIMITANTE_SI = "01";

export type ValiditaSconto = "INGRESSO" | "ENTRO_12_MESI" | "OLTRE_12_MESI" | "SCONOSCIUTA";
export function validitaSconto(codice: string): ValiditaSconto {
  switch (codice) {
    case "01": return "INGRESSO";
    case "02": return "ENTRO_12_MESI";
    case "03": return "OLTRE_12_MESI";
    default: return "SCONOSCIUTA";
  }
}

export type CondizioneSconto = "NESSUNA" | "BOLLETTA_ONLINE" | "DOMICILIAZIONE" | "DOMICILIAZIONE_E_ONLINE" | "ALTRO" | "SCONOSCIUTA";
export function condizioneSconto(codice: string): CondizioneSconto {
  switch (codice) {
    case "00": return "NESSUNA";
    case "01": return "BOLLETTA_ONLINE";
    case "02": return "DOMICILIAZIONE";
    case "03": return "DOMICILIAZIONE_E_ONLINE";
    case "99": return "ALTRO";
    default: return "SCONOSCIUTA";
  }
}

export type TipoSconto = "FISSO" | "VENDITA" | "SU_TUTELA" | "SCONOSCIUTO";
export function tipoSconto(codice: string): TipoSconto {
  switch (codice) {
    case "01": return "FISSO";
    case "03": return "VENDITA";
    case "04": return "SU_TUTELA";
    default: return "SCONOSCIUTO";
  }
}

export const MACROAREA_SERVIZIO: TabellaCodici = {
  "01": v("Caldaia / impianti termici", "dedotto"),
  "06": v("Assicurazione / assistenza", "dedotto"),
  "99": v("Altro", "dedotto"),
};

/**
 * Ambiti tariffari gas (a1…a6 nei parametri del Portale) per regione ISTAT,
 * secondo la suddivisione ARERA della distribuzione gas:
 * a1 Nord-occidentale, a2 Nord-orientale, a3 Centrale,
 * a4 Centro-sud orientale, a5 Centro-sud occidentale, a6 Meridionale.
 * La Sardegna (20) non rientra in questi ambiti: da gestire a parte.
 */
export const AMBITO_GAS_PER_REGIONE: Readonly<Record<string, string>> = {
  "01": "a1", "02": "a1", "07": "a1",
  "03": "a2", "04": "a2", "05": "a2", "06": "a2", "08": "a2",
  "09": "a3", "10": "a3", "11": "a3",
  "13": "a4", "14": "a4", "16": "a4", "17": "a4",
  "12": "a5", "15": "a5",
  "18": "a6", "19": "a6",
};

export function etichetta(tab: TabellaCodici, codice: string | undefined): string {
  if (codice === undefined) return "";
  return tab[codice]?.etichetta ?? `Codice ${codice}`;
}
