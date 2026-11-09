/** "Non sai il consumo? Stimalo con poche domande": stessa stima del sito (@pagella/core). */
import { stimaConsumoGas, stimaConsumoLuce, type Persone } from "@pagella/core";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { numero } from "../lib/formato";
import { C, F, R } from "../lib/tema";
import { Pulsante, Tenue } from "./ui";

const VOCI_LUCE = [
  ["induzione", "Piano a induzione o forno elettrico"],
  ["scaldabagno", "Scaldabagno elettrico per l'acqua calda"],
  ["condizionatore", "Condizionatore d'estate"],
  ["pompaDiCalore", "Riscaldamento con pompa di calore o stufe elettriche"],
  ["autoElettrica", "Auto elettrica ricaricata a casa"],
] as const;
const VOCI_GAS = [["cucina", "Cucina"], ["acquaCalda", "Acqua calda"], ["riscaldamento", "Riscaldamento autonomo"]] as const;

export function StimaConsumo({ c, zona, onUsa }: { c: "luce" | "gas"; zona: string; onUsa: (valore: number) => void }) {
  const [aperta, setAperta] = useState(false);
  const [persone, setPersone] = useState<Persone>(3);
  const [luce, setLuce] = useState<Record<string, boolean>>({});
  const [gas, setGas] = useState<Record<string, boolean>>({ cucina: true, acquaCalda: true, riscaldamento: true });
  const [mq, setMq] = useState("80");

  const stima = useMemo(() => c === "gas"
    ? stimaConsumoGas({ persone, cucina: !!gas.cucina, acquaCalda: !!gas.acquaCalda, riscaldamento: !!gas.riscaldamento, metriQuadri: Number(mq.replace(/\D/g, "")) || 0, zona: zona as "D" })
    : stimaConsumoLuce({ persone, ...luce }), [c, persone, luce, gas, mq, zona]);

  return (
    <View style={st.box}>
      <Pressable onPress={() => setAperta(!aperta)} accessibilityRole="button" accessibilityState={{ expanded: aperta }} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={st.titolo}>{aperta ? "▾" : "▸"} Non lo sai? Stimalo con poche domande</Text>
      </Pressable>
      {aperta ? (
        <View style={{ gap: 14 }}>
          <Text style={st.domanda}>Quante persone vivono in casa?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([1, 2, 3, 4, 5] as Persone[]).map((n) => (
              <Pressable key={n} onPress={() => setPersone(n)} accessibilityRole="radio" accessibilityState={{ selected: persone === n }}
                style={[st.pillola, persone === n && { backgroundColor: C.ink, borderColor: C.ink }]}>
                <Text style={[st.pillolaTesto, persone === n && { color: C.onInk }]}>{n === 5 ? "5 o più" : n}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={st.domanda}>{c === "gas" ? "Per cosa usi il gas?" : "Cosa usi a corrente?"}</Text>
          {(c === "gas" ? VOCI_GAS : VOCI_LUCE).map(([k, t]) => {
            const val = c === "gas" ? !!gas[k] : !!luce[k];
            const cambia = (v: boolean) => (c === "gas" ? setGas({ ...gas, [k]: v }) : setLuce({ ...luce, [k]: v }));
            return (
              <View key={k} style={st.voce}>
                <Text style={st.voceTesto}>{t}</Text>
                <Switch value={val} onValueChange={cambia} trackColor={{ true: C.good, false: C.lineStrong }} thumbColor={C.surface} />
              </View>
            );
          })}
          {c === "gas" && gas.riscaldamento ? (
            <View style={{ gap: 6 }}>
              <Text style={st.domanda}>Metri quadri da riscaldare</Text>
              <TextInput style={st.input} value={mq} onChangeText={setMq} keyboardType="number-pad" />
              <Tenue style={{ fontSize: 12.5 }}>La zona climatica la prendiamo dal comune.</Tenue>
            </View>
          ) : null}
          <View style={st.risultato}>
            <Text style={st.risultatoTesto}>Stima: <Text style={{ fontFamily: F.extrabold, fontSize: 19 }}>{numero(stima)} {c === "gas" ? "Smc" : "kWh"}</Text> l'anno</Text>
            <Pulsante titolo="Usa questa stima" tipo="secondario" onPress={() => { onUsa(stima); setAperta(false); }} />
          </View>
          <Tenue style={{ fontSize: 12.5 }}>È una stima indicativa: se trovi il consumo in bolletta, usa quello.</Tenue>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  box: { backgroundColor: C.surfaceMuted, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14, paddingBottom: 6 },
  titolo: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  domanda: { fontFamily: F.bold, fontSize: 14.5, color: C.ink },
  pillola: { minWidth: 46, height: 40, paddingHorizontal: 12, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  pillolaTesto: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  voce: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 },
  voceTesto: { flex: 1, fontFamily: F.medium, fontSize: 14.5, color: C.ink },
  input: { height: 46, borderWidth: 1.5, borderColor: C.lineStrong, borderRadius: R.sm, paddingHorizontal: 12, fontFamily: F.medium, fontSize: 16, color: C.ink, backgroundColor: C.surface },
  risultato: { backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1, borderColor: C.line, padding: 12, gap: 10 },
  risultatoTesto: { fontFamily: F.medium, fontSize: 15, color: C.ink },
});
