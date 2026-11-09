/** Inserimento manuale come percorso guidato: una domanda per schermata, come sul sito. */
import { stimaConsumoGas, stimaConsumoLuce, type Persone } from "@pagella/core";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pulsante, Tenue } from "../components/ui";
import { zonaPerComune, type Profilo, type Zona } from "../lib/calcolo";
import { numero } from "../lib/formato";
import { useStato } from "../lib/stato";
import { C, F, R } from "../lib/tema";

type Passo = "fornitura" | "comune" | "sai" | "persone" | "usi" | "stima" | "dettagli";
const GRUPPO: Record<Passo, number> = { fornitura: 1, comune: 2, sai: 3, persone: 3, usi: 3, stima: 3, dettagli: 4 };
const NOMI = ["Fornitura", "Comune", "Consumo", "Dettagli"];
const USI_LUCE = [
  ["induzione", "Piano a induzione o forno elettrico", "Si cucina a corrente"],
  ["scaldabagno", "Scaldabagno elettrico", "L'acqua calda la fa la corrente, non il gas"],
  ["condizionatore", "Condizionatore", "Acceso d'estate"],
  ["pompaDiCalore", "Riscaldamento elettrico", "Pompa di calore o stufette elettriche d'inverno"],
  ["autoElettrica", "Auto elettrica", "Ricaricata a casa"],
] as const;
const USI_GAS = [
  ["cucina", "Fornelli", "Per cucinare"],
  ["acquaCalda", "Acqua calda", "Caldaia o scaldabagno a gas"],
  ["riscaldamento", "Riscaldamento", "Caldaia autonoma, non centralizzato"],
] as const;
const ZONE: Array<[Zona, string]> = [["B", "molto calda"], ["C", "calda"], ["D", "temperata"], ["E", "fredda"], ["F", "molto fredda"]];
const num = (x: string) => Number(x.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));

export default function Guidato() {
  const { dati, profilo, impostaProfilo } = useStato();
  const scroll = useRef<{ scrollTo: (o: { y: number; animated: boolean }) => void } | null>(null);
  const [c, setC] = useState<"luce" | "gas">(profilo.c);
  const [comune, setComune] = useState(profilo.comune);
  const [cerca, setCerca] = useState(() => {
    const x = dati?.comuni.find((k) => k.codice === profilo.comune);
    return x ? `${x.nome} (${x.sigla})` : "";
  });
  const [sai, setSai] = useState<"si" | "no" | undefined>(profilo.cons > 0 ? "si" : undefined);
  const [cons, setCons] = useState(profilo.cons > 0 ? String(profilo.cons) : "");
  const [persone, setPersone] = useState<Persone | undefined>();
  const [usi, setUsi] = useState<Record<string, boolean>>({ cucina: true, acquaCalda: true, riscaldamento: true });
  const [mq, setMq] = useState("80");
  const [consStima, setConsStima] = useState("");
  const [kw, setKw] = useState(profilo.kw || 3);
  const [res, setRes] = useState(profilo.res);
  const [zona, setZona] = useState<Zona>(profilo.zona);
  const [spesa, setSpesa] = useState(profilo.spesa ? String(profilo.spesa) : "");
  const [cod, setCod] = useState(profilo.cod ?? "");
  const [facoltativo, setFacoltativo] = useState(!!(profilo.spesa || profilo.cod));
  const [errore, setErrore] = useState<string | null>(null);
  // Si parte dalla prima cosa che manca (per esempio dopo una bolletta letta a metà).
  const [storia, setStoria] = useState<Passo[]>(() => [!profilo.daBolletta ? "fornitura" : !profilo.comune ? "comune" : !(profilo.cons > 0) ? "sai" : "dettagli"]);
  const passo = storia[storia.length - 1]!;
  const u = c === "gas" ? "Smc" : "kWh";

  const suggerimenti = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!dati || q.length < 2 || comune) return [];
    return [...dati.comuni.filter((k) => k.nome.toLowerCase() === q), ...dati.comuni.filter((k) => k.nome.toLowerCase().startsWith(q) && k.nome.toLowerCase() !== q)].slice(0, 6);
  }, [cerca, comune, dati]);

  const stima = useMemo(() => c === "gas"
    ? stimaConsumoGas({ persone: persone ?? 3, cucina: !!usi.cucina, acquaCalda: !!usi.acquaCalda, riscaldamento: !!usi.riscaldamento, metriQuadri: num(mq) || 80, zona })
    : stimaConsumoLuce({ persone: persone ?? 3, induzione: !!usi.induzione, scaldabagno: !!usi.scaldabagno, condizionatore: !!usi.condizionatore, pompaDiCalore: !!usi.pompaDiCalore, autoElettrica: !!usi.autoElettrica }),
  [c, persone, usi, mq, zona]);

  const indietro = () => {
    if (storia.length <= 1) return false;
    setErrore(null);
    setStoria(storia.slice(0, -1));
    return true;
  };
  useEffect(() => {
    const h = BackHandler.addEventListener("hardwareBackPress", indietro);
    return () => h.remove();
  });
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [passo]);

  function percorso(conSai = sai): Passo[] {
    return ["fornitura", "comune", "sai", ...(conSai === "no" ? (["persone", "usi", "stima"] as Passo[]) : []), "dettagli"];
  }

  function avanti(da: Passo = passo, conSai = sai) {
    if (da === "comune" && !comune) return setErrore("Scegli il tuo comune dall'elenco: scrivi le prime lettere e toccalo.");
    if (da === "sai" && conSai === "si" && !(num(cons) > 0)) return setErrore(`Scrivi il consumo annuo in ${u}, oppure scegli "No, aiutami a stimarlo".`);
    if (da === "stima" && !(num(consStima) > 0)) return setErrore(`Scrivi un consumo in ${u}.`);
    setErrore(null);
    if (da === "dettagli") return fine();
    const p = percorso(conSai);
    const prossimo = p[p.indexOf(da) + 1]!;
    if (prossimo === "stima") setConsStima(String(stima));
    setStoria([...storia, prossimo]);
  }

  function fine() {
    const cambiata = c !== profilo.c;
    const tieni = profilo.daBolletta && !cambiata;
    const codice = cod.trim().toUpperCase();
    const p: Profilo = {
      c,
      cons: sai === "no" ? num(consStima) : num(cons),
      kw: c === "luce" ? kw : 3,
      res: c === "luce" ? res : true,
      zona,
      ...(comune ? { comune } : {}),
      ...(codice ? { cod: codice } : {}),
      ...(num(spesa) > 0 ? { spesa: num(spesa) } : {}),
      ...(tieni && profilo.bolletta ? { bolletta: profilo.bolletta } : {}),
      daBolletta: tieni,
    };
    impostaProfilo(p);
    router.replace("/risultati");
  }

  const Carta = ({ scelta, titolo, sotto, onPress, spunta }: { scelta: boolean; titolo: string; sotto?: string; onPress: () => void; spunta?: boolean }) => (
    <Pressable onPress={onPress} accessibilityRole={spunta ? "checkbox" : "radio"} accessibilityState={spunta ? { checked: scelta } : { selected: scelta }}
      style={[st.carta, scelta && st.cartaScelta]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={st.cartaTitolo}>{titolo}</Text>
        {sotto ? <Text style={st.cartaSotto}>{sotto}</Text> : null}
      </View>
      {spunta ? <View style={[st.spunta, scelta && st.spuntaScelta]}>{scelta ? <Text style={{ color: C.onInk, fontFamily: F.bold, fontSize: 14 }}>✓</Text> : null}</View> : null}
    </Pressable>
  );
  const Pillola = ({ scelta, testo, onPress }: { scelta: boolean; testo: string; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: scelta }} style={[st.pillola, scelta && st.pillolaScelta]}>
      <Text style={[st.pillolaTesto, scelta && { color: C.onInk }]}>{testo}</Text>
    </Pressable>
  );
  // Funzione, non componente: così il campo non viene ricreato a ogni lettera e la tastiera resta aperta.
  const campoUnita = (value: string, onChangeText: (t: string) => void, unita: string, auto?: boolean) => (
    <View>
      <TextInput style={[st.input, { paddingRight: 64 }, errore ? { borderColor: C.warn } : null]} value={value} onChangeText={(t) => { onChangeText(t); setErrore(null); }} keyboardType="number-pad" autoFocus={auto} />
      <Text style={st.unita}>{unita}</Text>
    </View>
  );

  const nascondiAvanti = passo === "fornitura" || passo === "persone" || (passo === "sai" && !sai);
  const gruppo = GRUPPO[passo];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={st.testa}>
          <View style={st.barra}><View style={[st.barraPiena, { width: `${(gruppo / NOMI.length) * 100}%` }]} /></View>
          <Text style={st.passoN}>Passo {gruppo} di {NOMI.length} · {NOMI[gruppo - 1]}</Text>
        </View>
        <ScrollView ref={scroll as never} contentContainerStyle={st.pagina} keyboardShouldPersistTaps="handled">
          {passo === "fornitura" ? (
            <>
              <Text style={st.h1}>Cosa vuoi confrontare?</Text>
              {(["luce", "gas"] as const).map((k) => (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: c === k && profilo.daBolletta }}
                  onPress={() => { if (k !== c) { setC(k); setCons(""); setSai(undefined); setCod(""); } avanti("fornitura"); }}
                  style={[st.carta, st.cartaGrande]}>
                  <View style={[st.icona, { backgroundColor: k === "luce" ? C.luce : C.gas }]}><Text style={{ fontSize: 24 }}>{k === "luce" ? "⚡" : "🔥"}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.cartaTitolo, { fontSize: 20 }]}>{k === "luce" ? "Luce" : "Gas"}</Text>
                    <Text style={st.cartaSotto}>{k === "luce" ? "Bolletta dell'elettricità" : "Bolletta del gas metano"}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}

          {passo === "comune" ? (
            <>
              <Text style={st.h1}>In che comune è la casa?</Text>
              <Tenue style={st.aiuto}>Ci serve per mostrarti le offerte disponibili dove abiti.</Tenue>
              <TextInput style={[st.input, errore ? { borderColor: C.warn } : null]} value={cerca} placeholder="Scrivi il nome del comune" placeholderTextColor={C.inkMuted}
                onChangeText={(t) => { setCerca(t); setComune(undefined); setErrore(null); }} autoCorrect={false} autoFocus={!comune} />
              {suggerimenti.length ? (
                <View style={st.elenco}>
                  {suggerimenti.map((k, i) => (
                    <Pressable key={k.codice} style={[st.suggerimento, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]} onPress={() => {
                      setComune(k.codice);
                      setCerca(`${k.nome} (${k.sigla})`);
                      if (dati) setZona(zonaPerComune(dati, k.codice) ?? zona);
                      setErrore(null);
                      setStoria([...storia, "sai"]);
                    }}>
                      <Text style={st.suggerimentoTesto}>{k.nome} <Text style={{ color: C.inkMuted, fontFamily: F.regular }}>({k.sigla})</Text></Text>
                    </Pressable>
                  ))}
                </View>
              ) : cerca.trim().length >= 2 && !comune ? <Tenue>Nessun comune trovato con questo nome</Tenue> : null}
            </>
          ) : null}

          {passo === "sai" ? (
            <>
              <Text style={st.h1}>Sai quanto consumi in un anno?</Text>
              <Tenue style={st.aiuto}>È scritto in bolletta, di solito alla voce "consumo annuo". Se non lo sai, nessun problema: lo stimiamo insieme.</Tenue>
              <Carta scelta={sai === "si"} titolo="Sì, lo so" sotto="Lo scrivo io" onPress={() => { setSai("si"); setErrore(null); }} />
              {sai === "si" ? campoUnita(cons, setCons, u, true) : null}
              <Carta scelta={sai === "no"} titolo="No, aiutami a stimarlo" sotto="Tre domande veloci" onPress={() => { setSai("no"); avanti("sai", "no"); }} />
            </>
          ) : null}

          {passo === "persone" ? (
            <>
              <Text style={st.h1}>Quante persone vivono in casa?</Text>
              <View style={st.pillole}>
                {([1, 2, 3, 4, 5] as Persone[]).map((n) => <Pillola key={n} scelta={persone === n} testo={n === 5 ? "5 o più" : String(n)} onPress={() => { setPersone(n); avanti("persone"); }} />)}
              </View>
            </>
          ) : null}

          {passo === "usi" ? (
            <>
              <Text style={st.h1}>{c === "gas" ? "Per cosa usi il gas?" : "Cosa c'è in casa che va a corrente?"}</Text>
              <Tenue style={st.aiuto}>{c === "gas" ? "Tocca quelli che hai." : "Tocca quelli che hai. Frigo, lavatrice, luci e TV li contiamo già. Se non hai niente di questi, vai avanti."}</Tenue>
              {(c === "gas" ? USI_GAS : USI_LUCE).map(([k, t, s]) => (
                <Carta key={k} spunta scelta={!!usi[k]} titolo={t} sotto={s} onPress={() => setUsi({ ...usi, [k]: !usi[k] })} />
              ))}
              {c === "gas" && usi.riscaldamento ? (
                <View style={{ gap: 8 }}>
                  <Text style={st.etichetta}>Quanti metri quadri riscaldi, più o meno?</Text>
                  {campoUnita(mq, setMq, "m²")}
                </View>
              ) : null}
            </>
          ) : null}

          {passo === "stima" ? (
            <>
              <Text style={st.occhiello}>LA NOSTRA STIMA</Text>
              <Text style={st.h1}>Consumi circa {numero(stima)} {u} all'anno</Text>
              <Tenue style={st.aiuto}>Lo usiamo per calcolare la spesa con ogni offerta.</Tenue>
              <Text style={st.etichetta}>Se vuoi, correggilo</Text>
              {campoUnita(consStima, setConsStima, u)}
              <Tenue style={{ fontSize: 14 }}>È una stima indicativa: se un giorno trovi il consumo in bolletta, usa quello.</Tenue>
            </>
          ) : null}

          {passo === "dettagli" ? (
            <>
              <Text style={st.h1}>{c === "luce" ? "Ultimi due dettagli" : "Un ultimo dettaglio"}</Text>
              <Tenue style={st.aiuto}>Li abbiamo già impostati sul caso più comune: cambiali solo se sai che per te è diverso.</Tenue>
              {c === "luce" ? (
                <>
                  <Text style={st.etichetta}>Potenza del contatore</Text>
                  <View style={st.pillole}>{[1.5, 3, 4.5, 6].map((k) => <Pillola key={k} scelta={kw === k} testo={`${String(k).replace(".", ",")} kW`} onPress={() => setKw(k)} />)}</View>
                  <Tenue style={{ fontSize: 14 }}>Quasi tutte le case hanno 3 kW. Se non lo sai, lascia così.</Tenue>
                  <Text style={[st.etichetta, { marginTop: 8 }]}>È la casa dove hai la residenza?</Text>
                  <View style={st.pillole}>
                    <Pillola scelta={res} testo="Sì" onPress={() => setRes(true)} />
                    <Pillola scelta={!res} testo="No, è una seconda casa" onPress={() => setRes(false)} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={st.etichetta}>Zona climatica</Text>
                  <View style={st.pillole}>{ZONE.map(([z, d]) => <Pillola key={z} scelta={zona === z} testo={`${z} · ${d}`} onPress={() => setZona(z)} />)}</View>
                  <Tenue style={{ fontSize: 14 }}>L'abbiamo proposta in base al tuo comune: cambiala solo se la conosci.</Tenue>
                </>
              )}
              <View style={st.facoltativo}>
                <Pressable onPress={() => setFacoltativo(!facoltativo)} accessibilityRole="button" accessibilityState={{ expanded: facoltativo }} style={st.facoltativoTesta}>
                  <View style={st.piu}><Text style={st.piuTesto}>{facoltativo ? "−" : "+"}</Text></View>
                  <Text style={[st.etichetta, { flex: 1 }]}>Vuoi anche il voto della tua offerta attuale? <Text style={st.facTag}>FACOLTATIVO</Text></Text>
                </Pressable>
                {facoltativo ? (
                  <View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
                    <Tenue style={{ fontSize: 14 }}>Se lo salti, ti mostriamo comunque le offerte migliori.</Tenue>
                    <Text style={st.etichetta}>Quanto spendi all'anno, più o meno?</Text>
                    {campoUnita(spesa, setSpesa, "€")}
                    <Text style={[st.etichetta, { marginTop: 4 }]}>Codice della tua offerta <Text style={{ fontFamily: F.regular, color: C.inkMuted }}>(se ce l'hai sotto mano)</Text></Text>
                    <TextInput style={st.input} value={cod} onChangeText={setCod} autoCapitalize="characters" autoCorrect={false} />
                    <Tenue style={{ fontSize: 14 }}>Lo trovi in bolletta nel riquadro "Box dell'offerta". Con il codice il voto è più preciso.</Tenue>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {errore ? <Text style={st.errore}>{errore}</Text> : null}
        </ScrollView>
        <View style={st.azioni}>
          {storia.length > 1 ? <Pressable onPress={indietro} style={st.indietro} accessibilityRole="button"><Text style={st.indietroTesto}>← Indietro</Text></Pressable> : null}
          {!nascondiAvanti ? (
            <Pulsante titolo={passo === "dettagli" ? "Vedi le offerte" : passo === "stima" ? "Va bene, avanti" : "Avanti"} onPress={() => avanti()} stile={{ flex: 1 }} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  testa: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  barra: { height: 6, borderRadius: 3, backgroundColor: C.surfaceMuted, overflow: "hidden" },
  barraPiena: { height: 6, borderRadius: 3, backgroundColor: C.ink },
  passoN: { fontFamily: F.bold, fontSize: 13, color: C.inkMuted },
  pagina: { padding: 20, paddingBottom: 32, gap: 14 },
  h1: { fontFamily: F.extrabold, fontSize: 27, lineHeight: 32, color: C.ink, letterSpacing: -0.4 },
  occhiello: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1, color: C.inkMuted, marginBottom: -6 },
  aiuto: { fontSize: 16, lineHeight: 23 },
  etichetta: { fontFamily: F.bold, fontSize: 15.5, color: C.ink },
  carta: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.surface },
  cartaScelta: { borderColor: C.ink, borderWidth: 2.5, padding: 15, backgroundColor: C.surfaceMuted },
  cartaGrande: { paddingVertical: 18 },
  cartaTitolo: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  cartaSotto: { fontFamily: F.regular, fontSize: 14, color: C.inkMuted },
  icona: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  spunta: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
  spuntaScelta: { backgroundColor: C.ink, borderColor: C.ink },
  pillole: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pillola: { minWidth: 60, height: 52, paddingHorizontal: 20, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  pillolaScelta: { backgroundColor: C.ink, borderColor: C.ink },
  pillolaTesto: { fontFamily: F.bold, fontSize: 16.5, color: C.ink },
  input: { height: 56, borderWidth: 1.5, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 16, fontFamily: F.medium, fontSize: 18, color: C.ink, backgroundColor: C.surface },
  unita: { position: "absolute", right: 16, top: 17, fontFamily: F.bold, fontSize: 16, color: C.inkMuted },
  elenco: { borderWidth: 1.5, borderColor: C.line, borderRadius: 12, overflow: "hidden" },
  suggerimento: { minHeight: 52, justifyContent: "center", paddingHorizontal: 16 },
  suggerimentoTesto: { fontFamily: F.semibold, fontSize: 17, color: C.ink },
  facoltativo: { marginTop: 10, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, backgroundColor: C.surfaceMuted },
  facoltativoTesta: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, minHeight: 56 },
  piu: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  piuTesto: { fontFamily: F.bold, fontSize: 16, color: C.ink, lineHeight: 18 },
  facTag: { fontFamily: F.bold, fontSize: 11, color: C.inkMuted, letterSpacing: 0.6 },
  errore: { fontFamily: F.bold, fontSize: 15, color: C.warn },
  azioni: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface },
  indietro: { minHeight: 48, justifyContent: "center", paddingHorizontal: 4 },
  indietroTesto: { fontFamily: F.bold, fontSize: 16, color: C.inkMuted },
});
