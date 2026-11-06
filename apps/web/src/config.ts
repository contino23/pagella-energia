/**
 * Link per le donazioni: PayPal.me con importo proposto di 4 € (chi dona può cambiarlo).
 * Se vuoto, i pulsanti portano alla sezione "Sostieni il progetto" del metodo.
 */
export const DONAZIONI_URL = "https://www.paypal.me/lucacolosimo23/4EUR";

/**
 * Modulo contatti: invio tramite Web3Forms (web3forms.com) con hCaptcha, che inoltra la mail
 * all'indirizzo collegato alla chiave (info@slashservices.it). La chiave di accesso è pubblica per
 * costruzione: identifica il modulo, non dà accesso alla casella.
 * Finché è vuota il modulo mostra un avviso e il pulsante resta disattivato.
 */
export const WEB3FORMS_CHIAVE = "";
