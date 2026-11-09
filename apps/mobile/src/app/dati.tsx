/** I dati per il confronto: restano sul telefono e si possono sempre correggere. */
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { StimaConsumo } from "../components/stima";
import { Pulsante, Tenue } from "../components/ui";
import { zonaPerComune, type Profilo, type Zona } from "../lib/calcolo";
import { useStato } from "../lib/stato";
import { C, F, R } from "../lib/tema";

const ZONE: Array<[Zona, string]> = [["B", "molto calda"], ["C", "calda"], ["D", "temperata"], ["E", "fredda"], ["F", "molto fredda"]];
const num = (x: string) => Number(x.replace(/\./g, "").replace(",", "."));

export default function DatiScreen() {
  const { dati, profilo, impostaProfilo } = useStato();
  const [c, setC] = useState(profilo.c);
  const [cons, setCons] = useState(profilo.cons > 0 ? String(profilo.cons) : "");
  const [errori, setErrori] = useState<{ cons?: string; comune?: string }>({});
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
    setCons("");
    setCod("");
  }

  function salva() {
    const e: { cons?: string; comune?: string } = {};
    if (!(num(cons) > 0)) e.cons = "Inserisci il consumo annuo, oppure stimalo con le domande qui sotto.";
    if (!comune) e.comune = "Scegli il comune dall'elenco che compare mentre scrivi.";
    setErrori(e);
    if (e.cons || e.comune) return;
    const stessaBolletta = profilo.c === c && (profilo.cod ?? "") === cod.trim().toUpperCase();
    const p: Profilo = {
      c,
      cons: num(cons),
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

        <Campo etichetta={`Consumo annuo (${c === "gas" ? "Smc" : "kWh"})`} obbligatorio errore={errori.cons} aiuto={`Lo trovi in bolletta, alla voce "consumo annuo".`}>
          <TextInput style={[st.input, errori.cons ? st.inputErrore : null]} value={cons} onChangeText={(t) => { setCons(t); setErrori({ ...errori, cons: undefined }); }} keyboardType="number-pad" />
        </Campo>
        <StimaConsumo c={c} zona={zona} onUsa={(v) => { setCons(String(v)); setErrori({ ...errori, cons: undefined }); }} />

        {c === "luce" ? (
          <>
            <Campo etichetta="Potenza impegnata (kW)" aiuto="3 kW è la più comune; la trovi in bolletta.">
              <TextInput style={st.input} value={kw} onChangeText={setKw} keyboardType="decimal-pad" />
            </Campo>
            <View style={st.interruttore}>
              <View style={{ flex: 1 }}>
                <Text style={st.etichetta}>Residente nell'abitazione</Text>
                <Tenue style={{ fontSize: 13 }}>Togli la spunta se è una seconda casa</Tenue>
              </View>
              <Switch value={res} onValueChange={setRes} trackColor={{ true: C.good, false: C.lineStrong }} thumbColor={C.surface} />
            </View>
          </>
        ) : null}

        <Campo etichetta="Comune della fornitura" obbligatorio errore={errori.comune} aiuto="Serve per le offerte disponibili nella tua zona e, per il gas, per tasse e clima.">
          <TextInput style={st.input} value={cercaComune} placeholder="Es. Quarrata" placeholderTextColor={C.inkMuted}
            onChangeText={(t) => { setCercaComune(t); setComune(undefined); }} autoCorrect={false} />
          {suggerimenti.map((k) => (
            <Pressable key={k.codice} style={st.suggerimento} onPress={() => {
              setComune(k.codice);
              setErrori({ ...errori, comune: undefined });
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

        <Text style={st.sezione}>Per avere anche il voto della tua offerta <Text style={{ fontFamily: F.regular, color: C.inkMuted }}>(facoltativo)</Text></Text>
        <Campo etichetta="Codice della tua offerta" aiuto={`Nel riquadro "Box dell'offerta" della bolletta.`}>
          <TextInput style={[st.input, { fontSize: 14 }]} value={cod} onChangeText={setCod} autoCapitalize="characters" autoCorrect={false} />
        </Campo>
        <Campo etichetta="Quanto spendi all'anno, in euro">
          <TextInput style={st.input} value={spesa} onChangeText={setSpesa} keyboardType="number-pad" />
        </Campo>

        <Pulsante titolo="Vedi le offerte" onPress={salva} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({ etichetta, aiuto, obbligatorio, errore, children }: { etichetta: string; aiuto?: string; obbligatorio?: boolean; errore?: string | undefined; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.etichetta}>{etichetta}{obbligatorio ? <Text style={st.obbl}>  obbligatorio</Text> : null}</Text>
      {children}
      {aiuto ? <Tenue style={{ fontSize: 13 }}>{aiuto}</Tenue> : null}
      {errore ? <Text style={st.errore}>{errore}</Text> : null}
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
  inputErrore: { borderColor: C.warn },
  obbl: { fontFamily: F.bold, fontSize: 12, color: C.inkMuted },
  errore: { fontFamily: F.bold, fontSize: 13.5, color: C.warn },
  sezione: { fontFamily: F.bold, fontSize: 15, color: C.ink, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 },
  interruttore: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44 },
  suggerimento: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  suggerimentoTesto: { fontFamily: F.medium, fontSize: 15, color: C.ink },
  zona: { height: 38, paddingHorizontal: 12, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.lineStrong, justifyContent: "center" },
  zonaTesto: { fontFamily: F.semibold, fontSize: 13.5, color: C.ink },
});
