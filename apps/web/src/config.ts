/**
 * Link per le donazioni: PayPal.me con importo proposto di 4 € (chi dona può cambiarlo).
 * Se vuoto, i pulsanti portano alla sezione "Sostieni il progetto" del metodo.
 */
export const DONAZIONI_URL = "https://www.paypal.me/lucacolosimo23/4EUR";

/**
 * Modulo contatti: invio tramite FormSubmit (formsubmit.co), che inoltra la mail a info@slashservices.it.
 * Al primo invio FormSubmit manda una mail di attivazione a quell'indirizzo; dopo l'attivazione
 * si può sostituire l'indirizzo con l'alias casuale che FormSubmit fornisce, per non esporlo nel codice.
 */
export const CONTATTI_ENDPOINT = "https://formsubmit.co/ajax/info@slashservices.it";
