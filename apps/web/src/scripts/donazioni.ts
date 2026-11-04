/**
 * Banner "Offrimi una birra": compare dopo 2 minuti di navigazione (tempo con la pagina visibile,
 * sommato tra le pagine della visita). Se lo chiudi non torna per 30 giorni; se doni, per 6 mesi.
 * Solo localStorage/sessionStorage del browser: nessun dato esce dal dispositivo.
 */
const SOGLIA_MS = 2 * 60 * 1000;
const CHIAVE_TEMPO = "pe-tempo-visita";
const CHIAVE_PAUSA = "pe-banner-birra-fino";
const GIORNO = 24 * 60 * 60 * 1000;

const leggi = (s: Storage, k: string) => { try { return Number(s.getItem(k)) || 0; } catch { return 0; } };
const scrivi = (s: Storage, k: string, v: number) => { try { s.setItem(k, String(v)); } catch { /* archiviazione non disponibile */ } };

export function collegaBannerBirra(banner: HTMLElement): void {
  const pausa = (giorni: number) => scrivi(localStorage, CHIAVE_PAUSA, Date.now() + giorni * GIORNO);
  document.querySelectorAll("[data-donazione]").forEach((a) => a.addEventListener("click", () => { pausa(180); chiudi(); }));
  banner.querySelectorAll("[data-chiudi]").forEach((b) => b.addEventListener("click", () => { pausa(30); chiudi(); }));
  function chiudi() { banner.classList.remove("visibile"); setTimeout(() => (banner.hidden = true), 250); }

  if (leggi(localStorage, CHIAVE_PAUSA) > Date.now()) return;
  let accumulato = leggi(sessionStorage, CHIAVE_TEMPO);
  let dal = document.visibilityState === "visible" ? Date.now() : 0;
  let timer = 0;

  const salva = () => {
    if (dal) { accumulato += Date.now() - dal; dal = document.visibilityState === "visible" ? Date.now() : 0; }
    scrivi(sessionStorage, CHIAVE_TEMPO, accumulato);
  };
  const mostra = () => {
    if (leggi(localStorage, CHIAVE_PAUSA) > Date.now()) return;
    banner.hidden = false;
    requestAnimationFrame(() => banner.classList.add("visibile"));
  };
  const programma = () => {
    clearTimeout(timer);
    if (!dal) return;
    timer = window.setTimeout(mostra, Math.max(0, SOGLIA_MS - accumulato));
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") dal = Date.now();
    else salva();
    programma();
  });
  addEventListener("pagehide", salva);
  programma();
}
