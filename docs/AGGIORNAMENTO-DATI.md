# Aggiornamento quotidiano dei dati

Il Portale Offerte rifiuta i download che arrivano da molti datacenter, compresi i server di GitHub (403). Il download quindi gira in un piccolo container Docker (`raccoglitore/`) su una macchina la cui rete il Portale accetta.

Ogni giorno, alle 9:20 e alle 14:20 ora italiana, il container:

1. scarica dalla pagina Open Data i file di offerte, parametri e prezzi storici degli indici;
2. crea la fotografia del giorno in `data/fotografie/`;
3. esegue i test e prepara i dati del sito, per controllare che i dati nuovi funzionino;
4. pubblica i dati nel repository con un commit "Dati del AAAA-MM-GG". Il push riavvia il workflow *Sito*, che ripubblica il sito.

Se un giro fallisce non si pubblica niente e il sito resta ai dati del giorno prima. Il giro successivo riprova.

## Sicurezza

- Il container non apre porte e non riceve comandi dall'esterno. Esce solo verso il Portale Offerte e GitHub.
- Gira senza privilegi (`cap_drop: ALL`, `no-new-privileges`, utente `node`), con limiti di memoria e CPU.
- Il token GitHub è *fine-grained*: vale solo sul repository `pagella-energia`, con il solo permesso **Contents: Read and write**, e ha una scadenza. Non viene scritto su disco: passa a git solo come intestazione.

## Installazione

Serve Docker con Compose.

```bash
git clone https://github.com/contino23/pagella-energia.git
cd pagella-energia/raccoglitore
docker compose build

# 1. Questa rete va bene per il Portale?
docker compose run --rm raccoglitore prova.sh
#    OK (200)        → si può continuare
#    BLOCCATO (403)  → serve un'altra macchina (rete di casa o d'ufficio)

# 2. Token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
#    Repository access: Only select repositories → pagella-energia
#    Permissions → Repository → Contents: Read and write. Scadenza: 1 anno.
cp .env.example .env    # e incolla il token in GITHUB_TOKEN

# 3. Avvio, con un primo giro subito
docker compose up -d
docker compose logs -f
```

Per un giro a mano: `docker compose exec raccoglitore aggiorna.sh`.

## Controllo

**Uptime Kuma (consigliato).** Due monitor:

1. *Sito*: tipo **HTTP(s) - Keyword**, URL del sito, parola chiave `Pagella Energia`, intervallo 300 secondi.
2. *Dati*: tipo **Push**, intervallo di heartbeat **90000 secondi** (25 ore), tentativi 0. Copia l'indirizzo Push nel file `.env` come `KUMA_PUSH_URL=...` e riavvia con `docker compose up -d`. Dopo ogni giro il raccoglitore manda "up" con l'esito, oppure "down" subito se il giro fallisce. Se per 25 ore non arriva niente (container fermo o server spento), Kuma va in allarme da solo.

Se Kuma gira sullo stesso server ed è esposto solo su `127.0.0.1`, il container non lo vede all'indirizzo del server. In quel caso si collega il raccoglitore alla rete di Kuma con un file `compose.override.yaml`, che resta solo sul server:

```yaml
services:
  raccoglitore:
    networks: [default, kuma]
networks:
  kuma:
    external: true
    name: uptime-kuma_default
```

e nel Push URL si usa `http://uptime-kuma:3001` al posto dell'indirizzo mostrato da Kuma.

Altri controlli:

- `docker ps` mostra il container *unhealthy* se l'ultimo aggiornamento riuscito ha più di 36 ore.
- Su GitHub, nella cronologia dei commit, compare un "Dati del …" al giorno.

## Se qualcosa va storto

- **403 nella prova**: il Portale rifiuta quella rete. Si sposta il container su un'altra macchina, oppure si chiede ad Acquirente Unico di abilitare l'indirizzo IP.
- **"Nessun file di offerte trovato"**: il Portale ha cambiato la pagina Open Data. Il log elenca i link trovati: con quelli si aggiorna `pipeline/src/scarica.ts`.
- **Test falliti**: non viene pubblicato niente. Il log dice quale controllo non è passato.
- **Errore 403 da GitHub sul push**: il token è scaduto o ha permessi sbagliati. Va rigenerato.
