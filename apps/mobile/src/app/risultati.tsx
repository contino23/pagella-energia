/** Il voto della tua offerta e la classifica delle alternative. */
import type { RisultatoOfferta } from "@pagella/core";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Avvisi, Pagella } from "../components/scheda";
import { Scheda } from "../components/scheda";
import { Caricamento, Chip, Cifra, Metro, Occhiello, Pulsante, Riquadro, T, Tenue, Voto } from "../components/ui";
import { calcola, type Esito } from "../lib/calcolo";
import { decimali, descriviPrezzo, euro, giudizio, nomeLeggibile, numero } from "../lib/formato";
import { useStato } from "../lib/stato";
import { C, F, R } from "../lib/tema";

type Filtro = "tutte" | "fisso" | "variabile" | "pulite";
const FILTRI: Array<[Filtro, string]> = [["tutte", "Tutte"], ["fisso", "Prezzo fisso"], ["variabile", "Variabile"], ["pulite", "Senza penali né costi extra"]];

export default function Risultati() {
  const { dati, profilo: p } = useStato();
  const [esito, setEsito] = useState<Esito | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [mostrate, setMostrate] = useState(10);
  const [perche, setPerche] = useState(false);

  // Il calcolo su migliaia di offerte richiede un attimo: lo facciamo dopo aver mostrato la schermata.
  useEffect(() => {
    if (!dati) return;
    setEsito(null);
    const t = setTimeout(() => setEsito(calcola(p, dati)), 30);
    return () => clearTimeout(t);
  }, [p, dati]);

  const lista = useMemo(() => (esito?.risultati ?? []).filter((r) =>
    filtro === "fisso" ? r.offerta.prezzo === "fisso" : filtro === "variabile" ? r.offerta.prezzo === "variabile" : filtro === "pulite" ? r.avvisi.every((a) => a.tipo !== "warn") : true,
  ), [esito, filtro]);

  if (!dati || !esito) return <Caricamento testo="Confronto le offerte sul tuo telefono…" />;

  const com = dati.comuni.find((c) => c.codice === p.comune);
  const u = p.c === "gas" ? "Smc" : "kWh";
  const migliore = esito.risultati[0];
  const diff = migliore && esito.riferimento !== null ? esito.riferimento - migliore.stima.totale : null;

  const intestazione = (
    <View style={{ gap: 16, marginBottom: 16 }}>
      <TuaOfferta esito={esito} perche={perche} setPerche={setPerche} />
      {diff !== null ? (
        <View style={st.risparmio}>
          {diff >= 12 ? (
            <>
              <Text style={st.risparmioEtichetta}>Con la prima in classifica risparmi</Text>
              <Text style={st.risparmioValore}>{euro(diff)}<Text style={st.risparmioPiccolo}> l'anno</Text></Text>
              <Text style={st.risparmioEtichetta}>cioè {euro(diff / 12)} in meno ogni mese</Text>
            </>
          ) : (
            <>
              <Text style={st.risparmioEtichetta}>La tua offerta è tra le più convenienti</Text>
              <Text style={[st.risparmioEtichetta, { fontFamily: F.regular }]}>Per i tuoi consumi nessuna offerta con un voto migliore costa meno.</Text>
            </>
          )}
        </View>
      ) : null}
      <Riquadro style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Chip testo={p.c === "luce" ? "Luce" : "Gas"} tipo={p.c} />
          <Pulsante titolo="Modifica i dati" tipo="link" onPress={() => router.push("/dati")} />
        </View>
        <Tenue>
          {numero(p.cons)} {u} l'anno{p.c === "luce" ? ` · ${String(p.kw).replace(".", ",")} kW · ${p.res ? "residente" : "non residente"}` : ` · zona ${p.zona}`}
          {com ? ` · ${com.nome}` : " · solo offerte nazionali"}
        </Tenue>
      </Riquadro>
      <View style={{ gap: 4 }}>
        <Text style={st.h2}>Offerte per te</Text>
        <Tenue>{numero(esito.risultati.length)} confrontate · ordinate per voto</Tenue>
      </View>
      <FlatList
        horizontal
        data={FILTRI}
        keyExtractor={([k]) => k}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item: [k, t] }) => (
          <Pressable onPress={() => { setFiltro(k); setMostrate(10); }} accessibilityRole="button" accessibilityState={{ selected: filtro === k }}
            style={[st.filtro, filtro === k && st.filtroAttivo]}>
            <Text style={[st.filtroTesto, filtro === k && { color: C.onInk }]}>{t}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  return (
    <FlatList
      data={lista.slice(0, mostrate)}
      keyExtractor={(r) => r.offerta.codice}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={intestazione}
      renderItem={({ item, index }) => <Scheda r={item} pos={index + 1} riferimento={esito.riferimento} />}
      ListEmptyComponent={<Tenue>Nessuna offerta con questo filtro per i tuoi dati.</Tenue>}
      ListFooterComponent={
        <View style={{ gap: 14, marginTop: 16 }}>
          {lista.length > mostrate ? <Pulsante titolo={`Mostra altre ${Math.min(10, lista.length - mostrate)} offerte`} tipo="secondario" onPress={() => setMostrate(mostrate + 10)} /> : null}
          <Tenue style={{ fontSize: 12.5 }}>
            Variabili stimate con {p.c === "gas" ? "PSV" : "PUN"} {decimali(dati.mercato.scenari.centrale.valori[p.c === "gas" ? "PSV" : "PUN"] ?? 0, 3)} €/{u}, {dati.mercato.scenari.centrale.descrizione.toLowerCase()}. Fonte: Portale Offerte ARERA, dati del {dati.mercato.data.split("-").reverse().join("/")}.
          </Tenue>
        </View>
      }
    />
  );
}

function TuaOfferta({ esito, perche, setPerche }: { esito: Esito; perche: boolean; setPerche: (x: boolean) => void }) {
  const { profilo: p } = useStato();
  const tua: RisultatoOfferta | null = esito.tua;
  const chip = <Chip testo={p.daBolletta ? `Bolletta ${p.c} letta` : p.c === "luce" ? "Luce" : "Gas"} tipo={p.c} />;
  const spesaBolletta = p.bolletta?.spesaAnnua;

  if (tua) {
    return (
      <Riquadro>
        {chip}
        <Occhiello>Il voto della tua offerta</Occhiello>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.nomeTua}>{nomeLeggibile(tua.offerta.nome)}</Text>
            <Tenue>{descriviPrezzo(tua.offerta)}</Tenue>
          </View>
          <Voto v={tua.pagella.voto} grande />
        </View>
        <Metro v={tua.pagella.voto} />
        <T style={{ fontFamily: F.bold }}>{giudizio(tua.pagella.voto)}</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Cifra etichetta="Spesa annua stimata" valore={euro(tua.stima.totale)} />
          <Cifra etichetta="Al mese" valore={euro(tua.stima.totale / 12)} />
        </View>
        {spesaBolletta ? (
          <Tenue>Nell'ultimo anno hai speso <Text style={{ fontFamily: F.bold, color: C.ink }}>{euro(spesaBolletta)}</Text> (dato della bolletta). La spesa qui sopra è la stima per i prossimi 12 mesi ai prezzi di oggi, come per tutte le altre offerte.</Tenue>
        ) : null}
        {tua.avvisi.length ? <Avvisi r={tua} /> : null}
        <Pressable onPress={() => setPerche(!perche)} accessibilityRole="button" accessibilityState={{ expanded: perche }} style={{ minHeight: 40, justifyContent: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{perche ? "▾" : "▸"} Perché questo voto</Text>
        </Pressable>
        {perche ? (
          <View style={{ gap: 8 }}>
            <Pagella r={tua} />
            <Tenue style={{ fontSize: 12.5 }}>{esito.origine === "bolletta" ? "Non più in vendita: voto calcolato con i prezzi letti nella tua bolletta." : "Condizioni ufficiali dal Portale Offerte."}</Tenue>
          </View>
        ) : null}
      </Riquadro>
    );
  }

  if (esito.soloPrezzo) {
    const spesa = p.spesa ?? spesaBolletta!;
    const v = esito.soloPrezzo.voto!;
    return (
      <Riquadro>
        {chip}
        <Occhiello>Il voto della tua bolletta</Occhiello>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.nomeTua}>{p.bolletta?.nomeOfferta ? nomeLeggibile(p.bolletta.nomeOfferta) : "La tua offerta"}</Text>
            <Tenue>Voto sul solo prezzo</Tenue>
          </View>
          <Voto v={v} grande />
        </View>
        <Metro v={v} />
        <T style={{ fontFamily: F.bold }}>{giudizio(v)}</T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Cifra etichetta="Spendi all'anno" valore={euro(spesa)} />
          <Cifra etichetta="Al mese" valore={euro(spesa / 12)} />
        </View>
        {esito.soloPrezzo.motivi.map((m) => <Tenue key={m}>• {m}</Tenue>)}
        <Tenue style={{ fontSize: 13 }}>Confrontiamo la tua spesa annua con quella stimata per le altre offerte: è un confronto approssimato, la tua spesa è passata, le altre sono stime per i prossimi 12 mesi.</Tenue>
      </Riquadro>
    );
  }

  return (
    <Riquadro>
      {chip}
      <Occhiello>La tua offerta</Occhiello>
      <T>
        {p.cod
          ? `Il codice ${p.cod} non è tra le offerte in vendita oggi e non abbiamo trovato i suoi prezzi in bolletta. Per avere il voto, scrivi quanto spendi all'anno nei tuoi dati.`
          : "Carica la bolletta, oppure scrivi il codice offerta o quanto spendi all'anno nei tuoi dati, per vedere il voto della tua offerta e quanto risparmi."}
      </T>
      <Pulsante titolo="Modifica i dati" tipo="secondario" onPress={() => router.push("/dati")} />
    </Riquadro>
  );
}

const st = StyleSheet.create({
  nomeTua: { fontFamily: F.extrabold, fontSize: 21, lineHeight: 26, color: C.ink },
  risparmio: { backgroundColor: C.luce, borderRadius: R.lg, padding: 18, gap: 2 },
  risparmioEtichetta: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  risparmioValore: { fontFamily: F.extrabold, fontSize: 40, color: C.ink, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  risparmioPiccolo: { fontFamily: F.bold, fontSize: 18, letterSpacing: 0 },
  h2: { fontFamily: F.extrabold, fontSize: 22, color: C.ink },
  filtro: { height: 38, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.lineStrong, justifyContent: "center" },
  filtroAttivo: { backgroundColor: C.ink, borderColor: C.ink },
  filtroTesto: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
});
