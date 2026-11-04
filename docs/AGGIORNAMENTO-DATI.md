# Aggiornamento quotidiano dei dati

Il Portale Offerte rifiuta i download che arrivano dai datacenter, compresi i server di GitHub (403). Per questo il download gira su un computer "di casa", registrato come **runner self-hosted** di GitHub. Il resto non cambia: il workflow scarica i file, crea la fotografia del giorno, prova i calcoli, salva i dati nel repository, e il sito si ripubblica da solo.

- Workflow: `.github/workflows/aggiorna-dati.yml`, due giri al giorno (circa 9:20 e 14:20) più l'avvio a mano da *Actions → Aggiorna dati → Run workflow*.
- Se il computer è spento, quel giorno il sito resta ai dati precedenti. Nessun dato va perso: il Portale pubblica ogni giorno la fotografia completa.

## Che computer serve

Uno qualsiasi che resti acceso in quelle ore e abbia Internet di casa o d'ufficio: un PC, un Mac, un mini PC, un Raspberry Pi 4/5 o una macchina virtuale. Il lavoro dura un paio di minuti e usa circa 300 MB di RAM.

Requisiti: Git (su Windows "Git for Windows", che include bash). Node 22 lo installa il workflow.

## Sicurezza

Il repository è pubblico, quindi un runner self-hosted va isolato:

1. **Utente dedicato** senza privilegi di amministratore, oppure una VM o un container, senza accesso a file personali o di lavoro.
2. In GitHub: *Settings → Actions → General → Fork pull request workflows* → **Require approval for all external contributors**. Così nessuna pull request esterna può far girare codice sul runner senza la tua approvazione.
3. Il runner ha l'etichetta `pagella` e solo `aggiorna-dati.yml` la usa; test e sito continuano a girare sui server di GitHub.

## Registrazione (una volta, circa 10 minuti)

1. GitHub → repository → *Settings → Actions → Runners → New self-hosted runner*, scegli il sistema operativo.
2. Esegui i comandi "Download" mostrati dalla pagina, nella cartella dell'utente dedicato.
3. Nel comando `config`, aggiungi l'etichetta: `--labels pagella` (alla domanda sulle etichette aggiuntive puoi anche scrivere `pagella`).
4. Avvialo come servizio, così riparte da solo dopo un riavvio:
   - Windows (PowerShell da amministratore, nella cartella del runner): `./config.cmd --runasservice` in fase di configurazione, oppure rispondi "Y" alla domanda sul servizio;
   - Linux e Raspberry: `sudo ./svc.sh install <utente> && sudo ./svc.sh start`;
   - macOS: `./svc.sh install && ./svc.sh start`.
5. Prova: *Actions → Aggiorna dati → Run workflow*. Alla fine compare un commit "Dati del AAAA-MM-GG" e il sito si aggiorna.

## Se qualcosa va storto

- **Il download fallisce con 403** anche da casa: la rete è riconosciuta come datacenter (succede con alcune VPN). Disattiva la VPN per quel computer.
- **"Nessun file di offerte trovato"**: il Portale ha cambiato la pagina Open Data. Il log elenca i link trovati: con quelli si aggiorna `pipeline/src/scarica.ts`.
- **I test falliscono con i dati nuovi**: il workflow non salva nulla e il sito resta ai dati del giorno prima. Il log dice quale controllo non è passato.
