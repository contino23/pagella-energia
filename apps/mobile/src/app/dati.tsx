/** I dati per il confronto: restano sul telefono e si possono sempre correggere. */
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Pulsante, Tenue } from "../components/ui";
import { zonaPerComune, type Profilo, type Zona } from "../lib/calcolo";
import { useStato } from "../lib/stato";
import { C, F, R } from "../lib/tema";

const ZONE: Array<[Zona, string]> = [["B", "molto calda"], ["C", "calda"], ["D", "temperata"], ["E", "fredda"], ["F", "molto fredda"]];
const num = (x: string) => Number(x.replace(/\./g, "").replace(",", "."));

export default function DatiScreen() {
  const { dati, profilo, impostaProfilo } = useStato();
  const [c, setC] = useState(profilo.c);
  const [cons, setCons] = useState(String(profilo.cons));
  const [kw, setKw] = useState(String(profilo.kw).replace(".", ","));
  const [res, setRes] = useState(profilo.res);
  const [zona, setZona] = useState<Zona>(profilo.zona);
  const [comune, setComune] = useState(profilo.comune);
  const [cercaComune, setCercaComune] = useState(() => {
    const x = dati?.comuni.find((k) => k.codice === profilo.comune);
    return x ? `${x.nome} (${x.sigla})` : "";
  });
  const [cod, setCod] = useState(profilo.cod ?? "");
  const [spesa, setSpesa] = useState(profilo.spesa ? String(profilo.spesa) : "");

  const suggerimenti = useMemo(() => {
    const q = cercaComune.trim().toLowerCase();
    if (!dati || q.length < 2) return [];
    const sel = dati.comuni.find((k) => k.codice === comune);
    if (sel && `${sel.nome} (${sel.sigla})`.toLowerCase() === q) return [];
    return dati.comuni.filter((k) => k.nome.toLowerCase().startsWith(q)).slice(0, 6);
  }, [cercaComune, comune, dati]);

  function cambiaFornitura(nuova: "luce" | "gas") {
    if (nuova === c) return;
    setC(nuova);
    setCons(nuova === "gas" ? "1400" : "2700");
    setCod("");
  }

  function salva() {
    const stessaBolletta = profilo.c === c && (profilo.cod ?? "") === cod.trim().toUpperCase();
    const p: Profilo = {
      c,
      cons: num(cons) || (c === "gas" ? 1400 : 2700),
      kw: num(kw) || 3,
      res,
      zona,
      ...(comune ? { comune } : {}),
      ...(cod.trim() ? { cod: cod.trim().toUpperCase() } : {}),
      ...(num(spesa) > 0 ? { spesa: num(spesa) } : {}),
      ...(stessaBolletta && profilo.bolletta ? { bolletta: profilo.bolletta } : {}),
      daBolletta: stessaBolletta && profilo.daBolletta,
    };
    impostaProfilo(p);
    router.dismissTo("/risultati");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={st.pagina} keyboardShouldPersistTaps="handled">
        <Tenue>Restano su questo telefono. Correggili se serve.</Tenue>

        <View style={st.schede} accessibilityRole="radiogroup">
          {(["luce", "gas"] as const).map((k) => (
            <Pressable key={k} onPress={() => cambiaFornitura(k)} accessibilityRole="radio" accessibilityState={{ selected: c === k }}
              style={[st.scheda, c === k && { backgroundColor: k === "luce" ? C.luceTint : C.gasTint }]}>
              <Text style={[st.schedaTesto, c === k && { color: k === "luce" ? C.onLuce : C.onGas }]}>{k === "luce" ? "⚡ Luce" : "🔥 Gas"}</Text>
            </Pressable>
          ))}
        </View>

        <Campo etichetta={`Consumo annuo (${c === "gas" ? "Smc" : "kWh"})`} aiuto={`Lo trovi in bolletta, alla voce "consumo annuo".`}>
          <TextInput style={st.input} value={cons} onChangeText={setCons} keyboardType="number-pad" />
        </Campo>

        {c === "luce" ? (
          <>
            <Campo etichetta="Potenza impegnata (kW)">
              <TextInput style={st.input} value={kw} onChangeText={setKw} keyboardType="decimal-pad" />
            </Campo>
            <View style={st.interruttore}>
              <Text style={st.etichetta}>Residente nell'abitazione</Text>
              <Switch value={res} onValueChange={setRes} trackColor={{ true: C.good, false: C.lineStrong }} thumbColor={C.surface} />
            </View>
          </>
        ) : null}

        <Campo etichetta="Comune della fornitura" aiuto="Serve a includere le offerte locali. Senza comune vedi solo quelle nazionali.">
          <TextInput style={st.input} value={cercaComune} placeholder="Es. Quarrata" placeholderTextColor={C.inkMuted}
            onChangeText={(t) => { setCercaComune(t); if (!t) setComune(undefined); }} autoCorrect={false} />
          {suggerimenti.map((k) => (
            <Pressable key={k.codice} style={st.suggerimento} onPress={() => {
              setComune(k.codice);
              setCercaComune(`${k.nome} (${k.sigla})`);
              if (dati) setZona(zonaPerComune(dati, k.codice) ?? zona);
            }}>
              <Text style={st.suggerimentoTesto}>{k.nome} <Text style={{ color: C.inkMuted }}>({k.sigla})</Text></Text>
            </Pressable>
          ))}
        </Campo>

        {c === "gas" ? (
          <Campo etichetta="Zona climatica" aiuto="Proposta in base alla regione: cambiala se la conosci.">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ZONE.map(([z, d]) => (
                <Pressable key={z} onPress={() => setZona(z)} accessibilityRole="radio" accessibilityState={{ selected: zona === z }}
                  style={[st.zona, zona === z && { backgroundColor: C.ink, borderColor: C.ink }]}>
                  <Text style={[st.zonaTesto, zona === z && { color: C.onInk }]}>{z} · {d}</Text>
                </Pressable>
              ))}
            </View>
          </Campo>
        ) : null}

        <Campo etichetta="Codice della tua offerta (facoltativo)" aiuto={`Nel riquadro "Box dell'offerta" della bolletta.`}>
          <TextInput style={[st.input, { fontSize: 14 }]} value={cod} onChangeText={setCod} autoCapitalize="characters" autoCorrect={false} />
        </Campo>
        <Campo etichetta="Quanto spendi all'anno, in euro (facoltativo)">
          <TextInput style={st.input} value={spesa} onChangeText={setSpesa} keyboardType="number-pad" />
        </Campo>

        <Pulsante titolo="Vedi le offerte" onPress={salva} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({ etichetta, aiuto, children }: { etichetta: string; aiuto?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.etichetta}>{etichetta}</Text>
      {children}
      {aiuto ? <Tenue style={{ fontSize: 13 }}>{aiuto}</Tenue> : null}
    </View>
  );
}

const st = StyleSheet.create({
  pagina: { padding: 20, paddingBottom: 48, gap: 18 },
  schede: { flexDirection: "row", backgroundColor: C.surfaceMuted, borderRadius: R.md, padding: 4, gap: 4 },
  scheda: { flex: 1, height: 44, borderRadius: R.sm, alignItems: "center", justifyContent: "center" },
  schedaTesto: { fontFamily: F.bold, fontSize: 15, color: C.inkMuted },
  etichetta: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  input: { height: 50, borderWidth: 1.5, borderColor: C.lineStrong, borderRadius: R.sm, paddingHorizontal: 14, fontFamily: F.medium, fontSize: 16, color: C.ink, backgroundColor: C.surface },
  interruttore: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44 },
  suggerimento: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  suggerimentoTesto: { fontFamily: F.medium, fontSize: 15, color: C.ink },
  zona: { height: 38, paddingHorizontal: 12, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.lineStrong, justifyContent: "center" },
  zonaTesto: { fontFamily: F.semibold, fontSize: 13.5, color: C.ink },
});
