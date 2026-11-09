/** Lettura della bolletta passo per passo, poi il riepilogo di cosa abbiamo letto da confermare. */
import { estraiDatiBolletta, type DatiBolletta } from "@pagella/core";
import { File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avviso, Chip, Pulsante, Sottotitolo, T, Tenue } from "../components/ui";
import { profiloIniziale, zonaPerComune } from "../lib/calcolo";
import type { Comune } from "../lib/dati";
import { decimali, euro, numero } from "../lib/formato";
import { useLettorePdf } from "../lib/lettore";
import { useStato } from "../lib/stato";
import { C, F } from "../lib/tema";

type Passo = 0 | 1 | 2 | 3;
const PASSI = ["Apro il PDF sul telefono", "Leggo il testo della bolletta", "Riconosco la tua offerta"];

export default function Lettura() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { dati, impostaProfilo } = useStato();
  const leggiPdf = useLettorePdf();
  const [passo, setPasso] = useState<Passo>(0);
  const [dettaglio, setDettaglio] = useState("");
  const [esito, setEsito] = useState<{ d: DatiBolletta; comune?: Comune; nelPortale: boolean } | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!dati || !uri) return;
    let vivo = true;
    (async () => {
      try {
        const base64 = await new File(uri).base64();
        if (!vivo) return;
        setPasso(1);
        const testo = await leggiPdf(base64, (p, tot) => vivo && setDettaglio(`pagina ${p} di ${tot}`));
        if (!vivo) return;
        setPasso(2);
        setDettaglio(`${numero(dati.offerte.length)} offerte di oggi`);
        const codici = new Set(dati.offerte.map((o) => o.codice));
        const d = estraiDatiBolletta(testo, codici);
        if (d.trovati.length === 0) throw new Error("Non abbiamo trovato i dati in questa bolletta. Puoi inserirli a mano: servono pochi secondi.");
        const comune = d.cap ? dati.comuni.find((c) => c.cap.includes(d.cap!)) : undefined;
        setEsito({ d, ...(comune ? { comune } : {}), nelPortale: !!d.codiceOfferta && codici.has(d.codiceOfferta) });
        setPasso(3);
      } catch (e) {
        if (vivo) setErrore(e instanceof Error ? e.message : "Non siamo riusciti a leggere il file.");
      }
    })();
    return () => { vivo = false; };
  }, [dati, uri, leggiPdf]);

  function conferma() {
    if (!esito) return;
    const { d, comune } = esito;
    const c = d.commodity ?? "luce";
    impostaProfilo({
      c,
      cons: d.consumoAnnuo ?? 0,
      kw: d.potenzaKw ?? 3,
      res: d.residente ?? true,
      zona: (comune && dati ? zonaPerComune(dati, comune.codice) : undefined) ?? "D",
      ...(comune ? { comune: comune.codice } : {}),
      ...(d.codiceOfferta ? { cod: d.codiceOfferta } : {}),
      bolletta: {
        ...(d.nomeOfferta ? { nomeOfferta: d.nomeOfferta } : {}),
        ...(d.tipoPrezzo ? { tipoPrezzo: d.tipoPrezzo } : {}),
        ...(d.prezzoVendita !== undefined ? { prezzoVendita: d.prezzoVendita } : {}),
        ...(d.quotaFissaMese !== undefined ? { quotaFissaMese: d.quotaFissaMese } : {}),
        ...(d.periodo ? { periodo: d.periodo } : {}),
        ...(d.penaleRecesso !== undefined ? { penaleRecesso: d.penaleRecesso } : {}),
        ...(d.spesaAnnua ? { spesaAnnua: d.spesaAnnua } : {}),
      },
      daBolletta: true,
    });
    // Se in bolletta mancano consumo o comune, li chiediamo prima di mostrare le offerte.
    router.replace(d.consumoAnnuo && comune ? "/risultati" : "/guidato");
  }

  if (errore) {
    return (
      <View style={st.pagina}>
        <Avviso tipo="warn" testo={errore} />
        <Pulsante titolo="Inserisci i dati a mano" onPress={() => { impostaProfilo(profiloIniziale()); router.replace("/guidato"); }} />
        <Pulsante titolo="Torna indietro" tipo="secondario" onPress={() => router.back()} />
      </View>
    );
  }

  if (!esito) {
    return (
      <View style={st.pagina}>
        <Sottotitolo>Sto leggendo la bolletta…</Sottotitolo>
        <View style={{ gap: 14 }}>
          {PASSI.map((t, i) => (
            <View key={t} style={st.passo}>
              <View style={[st.segno, i < passo && st.segnoFatto]}>
                {i < passo ? <Text style={{ color: "#fff", fontFamily: F.bold }}>✓</Text> : i === passo ? <ActivityIndicator size="small" color={C.ink} /> : null}
              </View>
              <Text style={[st.passoTesto, i > passo && { color: C.inkMuted }]}>
                {t}{i === passo && dettaglio ? <Text style={{ color: C.inkMuted, fontFamily: F.regular }}> · {dettaglio}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
        <Tenue>Il file non viene caricato su nessun server.</Tenue>
      </View>
    );
  }

  const { d, comune, nelPortale } = esito;
  const gas = d.commodity === "gas";
  const u = gas ? "Smc" : "kWh";
  const righe: Array<[string, string | undefined, string?]> = [
    ["Fornitura", d.commodity ? (gas ? "Gas" : "Luce") : undefined],
    ["Offerta", d.nomeOfferta ?? d.codiceOfferta, d.nomeOfferta ? d.codiceOfferta : undefined],
    ["Prezzo", d.prezzoVendita !== undefined ? `${d.tipoPrezzo === "variabile" ? "Variabile · " : d.tipoPrezzo === "fisso" ? "Fisso · " : ""}${decimali(d.prezzoVendita, 4)} €/${u}` : undefined,
      d.quotaFissaMese !== undefined ? `più ${decimali(d.quotaFissaMese, 2)} € al mese di quota fissa` : undefined],
    ["Consumo annuo", d.consumoAnnuo ? `${numero(d.consumoAnnuo)} ${u}` : undefined],
    ...(!gas ? [["Potenza", d.potenzaKw ? `${String(d.potenzaKw).replace(".", ",")} kW` : undefined] as [string, string | undefined]] : []),
    ["Comune", comune ? `${comune.nome} (${comune.sigla})` : d.cap ? `CAP ${d.cap}` : undefined],
    ...(!gas ? [["Residente", d.residente === undefined ? undefined : d.residente ? "Sì" : "No"] as [string, string | undefined]] : []),
    ["Spesa ultimo anno", d.spesaAnnua ? euro(d.spesaAnnua) : undefined],
  ];
  const nota = nelPortale
    ? { tipo: "ok" as const, t: "La tua offerta è tra quelle pubblicate oggi nel Portale Offerte: il voto usa le sue condizioni ufficiali." }
    : d.prezzoVendita !== undefined
      ? { tipo: "ok" as const, t: "La tua offerta non è più in vendita, ma abbiamo letto i suoi prezzi in bolletta: il voto è calcolato con quelli." }
      : { tipo: "warn" as const, t: d.spesaAnnua ? "Non abbiamo trovato i prezzi della tua offerta: il voto sarà sul solo prezzo, partendo da quanto hai speso nell'ultimo anno." : "Non abbiamo trovato prezzi né spesa annua: per avere il voto inserisci quanto spendi all'anno." };

  return (
    <ScrollView contentContainerStyle={st.pagina}>
      <Chip testo="Bolletta letta" tipo={gas ? "gas" : "luce"} />
      <Sottotitolo>Ecco cosa abbiamo letto</Sottotitolo>
      <View style={{ borderTopWidth: 1, borderTopColor: C.line }}>
        {righe.map(([etichetta, valore, nota2]) => (
          <View key={etichetta} style={st.riga}>
            <Text style={st.etichetta}>{etichetta}</Text>
            <View style={{ flex: 1.6 }}>
              <Text style={[st.valore, !valore && { color: C.warn, fontFamily: F.medium }]}>{valore ?? "Non trovato, lo potrai inserire tu"}</Text>
              {valore && nota2 ? <Tenue style={{ fontSize: 12.5 }}>{nota2}</Tenue> : null}
            </View>
          </View>
        ))}
      </View>
      <Avviso tipo={nota.tipo} testo={nota.t} />
      <Pulsante titolo="Vedi il voto e le offerte" onPress={conferma} />
      <T style={{ color: C.inkMuted, fontSize: 14 }}>Se qualcosa non torna, potrai correggerlo dopo. Se manca qualcosa, te lo chiediamo noi.</T>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pagina: { padding: 20, paddingBottom: 48, gap: 18 },
  passo: { flexDirection: "row", alignItems: "center", gap: 12 },
  segno: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
  segnoFatto: { backgroundColor: C.good, borderColor: C.good },
  passoTesto: { flex: 1, fontFamily: F.semibold, fontSize: 15.5, color: C.ink },
  riga: { flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  etichetta: { flex: 1, fontFamily: F.regular, fontSize: 15, color: C.inkMuted },
  valore: { fontFamily: F.bold, fontSize: 15, color: C.ink },
});
