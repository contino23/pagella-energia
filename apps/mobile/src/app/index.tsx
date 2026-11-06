import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chip, Pulsante, Riquadro, s as ui, T, Tenue, Titolo, Sottotitolo, Voto } from "../components/ui";
import { DONAZIONI_URL } from "../lib/config";
import { SITO } from "../lib/dati";
import { descriviPrezzo, euro, nomeLeggibile, numero } from "../lib/formato";
import { profiloIniziale } from "../lib/calcolo";
import { useStato } from "../lib/stato";
import { C, F, R } from "../lib/tema";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const dataLunga = (d: string) => `${Number(d.slice(8, 10))} ${MESI[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

export default function Home() {
  const { dati, errore, ricarica, impostaProfilo } = useStato();

  async function caricaBolletta() {
    const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets[0]) return;
    router.push({ pathname: "/lettura", params: { uri: r.assets[0].uri } });
  }

  function aMano() {
    impostaProfilo(profiloIniziale());
    router.push("/dati");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={st.pagina}>
        <View style={st.marchio}>
          <View style={st.tessera}><Text style={{ fontSize: 18 }}>⚡</Text></View>
          <Text style={st.nomeApp}>Pagella Energia</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Chip testo="Luce" tipo="luce" />
          <Chip testo="Gas" tipo="gas" />
          {dati ? <Tenue style={{ fontSize: 13 }}>● Dati del {dataLunga(dati.mercato.data)}</Tenue> : null}
        </View>

        <Titolo>Diamo un voto alla tua bolletta e ti mostriamo le offerte per risparmiare.</Titolo>
        <T style={{ color: C.inkMuted, fontSize: 17, lineHeight: 25 }}>
          Carica il PDF della bolletta della luce o del gas: vedi il voto della tua offerta e tutte le alternative del mercato libero, con quanto risparmi all'anno e al mese.
        </T>

        <View style={{ gap: 10 }}>
          <Pulsante titolo="Carica la bolletta" onPress={caricaBolletta} disabilitato={!dati} />
          <Pulsante titolo="Inserisci i dati a mano" tipo="secondario" onPress={aMano} disabilitato={!dati} />
        </View>
        <View style={{ gap: 6 }}>
          {["Gratis per tutti", "Nessuna registrazione, nessuna email", "La bolletta resta sul tuo telefono"].map((g) => (
            <Text key={g} style={st.garanzia}><Text style={{ color: C.good }}>✓ </Text>{g}</Text>
          ))}
        </View>

        {errore ? (
          <Riquadro style={{ borderColor: C.warn }}>
            <T>{errore}</T>
            <Pulsante titolo="Riprova" tipo="secondario" onPress={ricarica} />
          </Riquadro>
        ) : null}

        {dati ? (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 4 }}>
              <Sottotitolo>Le migliori di oggi in tutta Italia</Sottotitolo>
              <Tenue>{numero(dati.mercato.conteggi.offerte)} offerte di {dati.mercato.conteggi.venditori} venditori. Voto per una famiglia tipo.</Tenue>
            </View>
            {(["luce", "gas"] as const).map((c) => (
              <Riquadro key={c} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Chip testo={c === "luce" ? "Luce" : "Gas"} tipo={c} />
                  <Tenue style={{ fontSize: 12.5 }}>
                    {c === "luce" ? `${numero(dati.mercato.famigliaTipo.luce.consumoAnnuoKwh)} kWh · ${dati.mercato.famigliaTipo.luce.potenzaKw} kW` : `${numero(dati.mercato.famigliaTipo.gas.consumoAnnuoSmc)} Smc`}
                  </Tenue>
                </View>
                {dati.mercato.migliori[c].map((m, i) => (
                  <View key={m.codice} style={st.riga}>
                    <Text style={st.rigaPos}>{i + 1}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={st.rigaNome} numberOfLines={1}>{nomeLeggibile(m.nome)}</Text>
                      <Tenue style={{ fontSize: 13 }} numberOfLines={1}>{euro(m.spesaAnnua)}/anno · {descriviPrezzo({ prezzo: m.prezzo, durataMesi: m.durataMesi, commodity: c })}</Tenue>
                    </View>
                    <Voto v={m.voto} />
                  </View>
                ))}
              </Riquadro>
            ))}
            <Tenue>Il risparmio per te dipende dai tuoi consumi e dalla tua zona: carica la bolletta per il calcolo esatto.</Tenue>
          </View>
        ) : !errore ? <Tenue>Scarico le offerte di oggi…</Tenue> : null}

        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 18 }}>
          <Pulsante titolo="Come calcoliamo il voto" tipo="link" onPress={() => router.push("/metodo")} />
          <Pulsante titolo="🍺  Offrimi una birra" tipo="birra" stile={{ alignSelf: "flex-start" }} onPress={() => Linking.openURL(DONAZIONI_URL || `${SITO}metodo/#sostieni`)} />
          <Tenue style={{ fontSize: 13 }}>Servizio gratuito, senza registrazione · Dati aperti del Portale Offerte ARERA · Nessuna commissione dai venditori · Codice open source</Tenue>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.inkMuted }}>
            Creato per passione da{" "}
            <Text style={{ fontFamily: F.bold, color: C.ink, textDecorationLine: "underline" }} accessibilityRole="link" onPress={() => Linking.openURL("https://www.slashservices.it")}>Slash Services</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  pagina: { padding: 20, paddingBottom: 48, gap: 20 },
  marchio: { flexDirection: "row", alignItems: "center", gap: 10 },
  tessera: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  nomeApp: { fontFamily: F.extrabold, fontSize: 19, color: C.ink },
  garanzia: { ...ui.testo, fontSize: 15 },
  riga: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  rigaPos: { width: 26, height: 26, borderRadius: R.pill, backgroundColor: C.surfaceMuted, textAlign: "center", lineHeight: 26, fontFamily: F.bold, fontSize: 13, color: C.ink, overflow: "hidden" },
  rigaNome: { fontFamily: F.bold, fontSize: 15.5, color: C.ink },
});
