/** Metodo in breve; la versione completa è sul sito. */
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { Pulsante, Sottotitolo, T, Tenue } from "../components/ui";
import { DONAZIONI_URL } from "../lib/config";
import { SITO } from "../lib/dati";

const VOCI: Array<[string, string]> = [
  ["Prezzo · 60%", "Quanto costa in più della più economica per i tuoi consumi e il tuo comune. 10 alla più economica, 6 a +10%, 0 da +50% in su."],
  ["Vincoli · 20%", "Parte da 10: −4 se c'è una penale per chi cambia prima della scadenza, −1 se può essere chiesto un deposito."],
  ["Trasparenza · 10%", "Toglie punti se la convenienza viene da sconti solo iniziali, se ci sono costi una tantum o servizi aggiuntivi."],
  ["Venditore · 10%", "In arrivo: servirà lo storico delle offerte. Finché manca, il suo peso si divide sulle altre voci."],
];

export default function Metodo() {
  return (
    <ScrollView contentContainerStyle={st.pagina}>
      <T>Usiamo i dati aperti del Portale Offerte di ARERA, aggiornati ogni giorno, e le regole ufficiali del Portale per stimare la spesa annua di ogni offerta. Le offerte a prezzo variabile sono stimate con la media degli ultimi 3 mesi dell'indice (PUN per la luce, PSV per il gas).</T>
      <Sottotitolo>Come nasce il voto</Sottotitolo>
      {VOCI.map(([t, d]) => (
        <View key={t} style={{ gap: 4 }}>
          <T style={{ fontFamily: "DMSans_700Bold" }}>{t}</T>
          <Tenue>{d}</Tenue>
        </View>
      ))}
      <Tenue>Prezzo fisso e variabile non sono premiati né penalizzati in sé: è una scelta tua.</Tenue>
      <Pulsante titolo="Metodo completo sul sito" tipo="secondario" onPress={() => Linking.openURL(`${SITO}metodo/`)} />
      <Sottotitolo>Sostieni il progetto</Sottotitolo>
      <T>Pagella Energia è gratuito, senza pubblicità e senza commissioni dai venditori. Se ti ha fatto risparmiare, offrimi una birra.</T>
      <Pulsante titolo="🍺  Offrimi una birra" tipo="birra" stile={{ alignSelf: "flex-start" }} onPress={() => Linking.openURL(DONAZIONI_URL || `${SITO}metodo/#sostieni`)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({ pagina: { padding: 20, paddingBottom: 48, gap: 16 } });
