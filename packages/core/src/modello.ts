/**
 * Modello normalizzato di un'offerta, indipendente dal tracciato XML.
 * È il formato che la pipeline salva nello storico e che sito e app leggono.
 */
import type { CondizioneSconto, TipoCondizione, TipoSconto, Unita, ValiditaSconto } from "./codici.js";

export type Commodity = "luce" | "gas" | "dual";
export type TipoCliente = "domestico" | "altri_usi" | "condominio" | "sconosciuto";
export type TipoPrezzo = "fisso" | "variabile" | "misto" | "sconosciuto";

export interface Prezzo {
  valore: number;
  unita: Unita;
  /** Fascia oraria (F1, F2, F3, F23…); assente se il prezzo vale per tutte. */
  fascia?: string;
  /** Scaglione di consumo, se il prezzo vale solo in un intervallo. */
  consumoDa?: number;
  consumoA?: number;
  /** Validità limitata nel tempo dall'attivazione. */
  durataMesi?: number;
  validoFinoMese?: number;
}

export type RuoloComponente =
  | "quota_fissa"
  | "commercializzazione_consumo"
  | "energia"
  | "una_tantum"
  | "energia_verde"
  | "sconosciuto";

export interface Componente {
  nome: string;
  descrizione: string;
  ruolo: RuoloComponente;
  /** true se è lo SPREAD sommato all'indice, secondo le regole del Portale. */
  isSpread: boolean;
  /** Codice TIPOLOGIA del tracciato (01/02): significato non documentato, non usato nel calcolo. */
  tipologia: string;
  prezzi: Prezzo[];
}

export interface Condizione {
  tipo: TipoCondizione;
  codice: string;
  /** La condizione restringe chi può sottoscrivere l'offerta. */
  limitante: boolean;
  testo: string;
}

export interface Sconto {
  nome: string;
  descrizione: string;
  validita: ValiditaSconto;
  condizione: CondizioneSconto;
  condizioneTesto?: string;
  /** Lo sconto si applica prima dell'IVA. */
  primaIva: boolean;
  /** validoDa/validoFino: scaglione di consumo annuo (kWh o Smc) a cui si applica l'importo. */
  importi: Array<{ tipo: TipoSconto; valore: number; unita: Unita; validoDa?: number; validoFino?: number }>;
  durataMesi?: number;
  /** Mese (1–12) dall'attivazione in cui vale lo sconto, se limitato a un solo mese. */
  meseValidita?: number;
  /** CODICE_COMPONENTE_FASCIA del tracciato: 11/12/13 = sconto solo in fascia F1/F2/F3, altri = componente regolata. */
  componenteFascia?: string;
}

export interface Dispacciamento {
  codice: string;
  nome: string;
  valore?: number;
}

export interface Offerta {
  codice: string;
  pivaVenditore: string;
  commodity: Commodity;
  nome: string;
  descrizione: string;
  cliente: TipoCliente;
  /** Solo per domestici: a chi è rivolta rispetto alla residenza. */
  residenza?: "residenti" | "non_residenti" | "tutti";
  prezzo: TipoPrezzo;
  /** Durata in mesi; null = indeterminata (-1 nel tracciato). 99 = "oltre/altro". */
  durataMesi: number | null;
  /** Codice indice per le variabili, con etichetta. */
  indice?: { codice: string; etichetta: string; nota?: string; coefficiente?: number };
  fasce: string;
  validaDal: string;
  validaAl: string;
  consumoMin?: number;
  consumoMax?: number;
  potenzaMin?: number;
  potenzaMax?: number;
  offertaSingola: boolean;
  offerteCongiunte: string[];
  attivazione: string[];
  operazioniContrattuali: string[];
  pagamenti: string[];
  garanzie: string;
  contatti: { telefono: string; sito?: string; urlOfferta?: string };
  componenti: Componente[];
  componentiRegolate: string[];
  dispacciamento: Dispacciamento[];
  condizioni: Condizione[];
  sconti: Sconto[];
  servizi: Array<{ nome: string; dettaglio: string; macroarea?: string }>;
  zone: { regioni: string[]; province: string[]; comuni: string[] } | null;
  /** Campi derivati utili a pagella e filtri. */
  derivati: {
    haPenaleRecesso: boolean;
    /** Mesi di vincolo della penale e importo, se ricavabili dai testi (vedi penale.ts). */
    penaleMesi?: number;
    penaleImporto?: number;
    penaleFinoAl?: string;
    penaleMassimo?: boolean;
    /** Per quanto resta bloccato un prezzo fisso, se l'offerta non ha una durata ma lo scrive nella descrizione. */
    bloccoMesi?: number;
    bloccoFinoAl?: string;
    /** true se i campi penale* e blocco* sono già stati ricavati dai testi completi (in pipeline). */
    penaleCalcolata?: boolean;
    haCondizioniLimitanti: boolean;
    haServiziAggiuntivi: boolean;
    disponibileOvunque: boolean;
  };
}

export interface Parametro {
  nome: string;
  valore: number;
  descrizione: string;
}

export interface Fotografia {
  data: string;
  generataIl: string;
  versioneLettore: string;
  fonte: string;
  licenza: string;
  file: Array<{ nome: string; sha256: string; byte: number }>;
  conteggi: Record<string, number>;
  offerte: Offerta[];
  parametri: { luce: Parametro[]; gas: Parametro[] };
}
