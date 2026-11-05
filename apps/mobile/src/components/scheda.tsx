/** Scheda di un'offerta nella classifica: risparmio, spesa annua e mensile, voto, avvisi, pagella apribile. */
import { memo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { RisultatoOfferta } from "@pagella/core";
import { C, F, R, tabellari } from "../lib/tema";
import { dominio, euro, fattiOfferta, nomeLeggibile, prezzoUnita, voto } from "../lib/formato";
import { Avviso, Cifra, coloreVoto, Metro, T, Tenue, Voto } from "./ui";

const NOMI: Record<string, string> = { prezzo: "Prezzo", vincoli: "Vincoli", trasparenza: "Trasparenza", affidabilita: "Venditore" };
const PESI: Record<string, string> = { prezzo: "60%", vincoli: "20%", trasparenza: "10%", affidabilita: "10%" };

export function Avvisi({ r }: { r: RisultatoOfferta }) {
  if (r.avvisi.length === 0) return <Text style={st.ok}>✓ Nessuna penale, nessun costo extra</Text>;
  return (
    <View style={{ gap: 8 }}>
      {r.avvisi.map((a, i) => <Avviso key={i} tipo={a.tipo} titolo={a.titolo} testo={a.testo} />)}
    </View>
  );
}

/** Prezzo, quota fissa e tipo di prezzo: in riga nelle schede, in colonna nel riquadro della tua offerta. */
export function Fatti({ r, colonna, quotaLetta }: { r: RisultatoOfferta; colonna?: boolean; quotaLetta?: number }) {
  const fatti = fattiOfferta(r, quotaLetta);
  if (colonna) {
    return (
      <View style={st.fattiBox}>
        {fatti.map((f, i) => (
          <View key={f.etichetta} style={[st.fattoRiga, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <Text style={st.fattoEtichetta}>{f.etichetta}</Text>
            <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
              <Text style={st.fattoValore}>{f.valore}</Text>
              {f.nota ? <Text style={st.fattoNota}>{f.nota}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[st.fattiBox, { flexDirection: "row" }]}>
      {fatti.map((f, i) => (
        <View key={f.etichetta} style={[st.fattoCella, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
          <Text style={st.fattoEtichetta}>{f.etichetta}</Text>
          <Text style={st.fattoValore} adjustsFontSizeToFit numberOfLines={1}>{f.valore}</Text>
          {f.nota ? <Text style={st.fattoNota}>{f.nota}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function Pagella({ r }: { r: RisultatoOfferta }) {
  const motivi = r.pagella.voci.filter((v) => v.voto !== null).flatMap((v) => v.motivi);
  return (
    <View style={{ gap: 10 }}>
      {r.pagella.voci.map((v) => (
        <View key={v.voce} style={st.voce}>
          <Text style={[st.voceNome, v.voto === null && { color: C.inkMuted }]}>{NOMI[v.voce]} <Text style={st.peso}>{PESI[v.voce]}</Text></Text>
          <View style={st.barra}>
            {v.voto !== null ? <View style={{ width: `${v.voto * 10}%`, height: "100%", borderRadius: 4, backgroundColor: coloreVoto(v.voto) }} /> : null}
          </View>
          <Text style={st.voceVoto}>{v.voto === null ? "presto" : voto(v.voto)}</Text>
        </View>
      ))}
      <View style={{ gap: 4, marginTop: 4 }}>
        {motivi.map((m, i) => <Tenue key={i}>• {m}</Tenue>)}
      </View>
    </View>
  );
}

export function PrezzoSpiegato({ r }: { r: RisultatoOfferta }) {
  const v = Object.fromEntries(r.stima.voci.map((x) => [x.voce, x.importo]));
  const energia = v.energia ?? 0;
  const venditore = (v.commercializzazione ?? 0) + (v.una_tantum ?? 0) + (v.sconti ?? 0);
  const rete = (v.dispacciamento ?? 0) + (v.rete ?? 0) + (v.oneri ?? 0);
  const imposte = (v.accise ?? 0) + (v.iva ?? 0);
  const unita = r.offerta.commodity === "gas" ? "Smc" : "kWh";
  const sito = r.offerta.contatti.urlOfferta || r.offerta.contatti.sito;
  const righe: Array<[string, number, boolean]> = [
    [`Energia · ${prezzoUnita(r.stima.prezzoMedioEnergiaKwh, unita)}`, energia, false],
    ["Costi del venditore", venditore, false],
    ["Rete e oneri, uguali per tutti", rete, true],
    ["Imposte", imposte, true],
  ];
  return (
    <View style={{ gap: 8 }}>
      {righe.map(([n, x, tenue]) => (
        <View key={n} style={st.riga}>
          <Text style={[st.rigaNome, tenue && { color: C.inkMuted }]}>{n}</Text>
          <Text style={[st.rigaValore, tenue && { color: C.inkMuted, fontFamily: F.medium }]}>{euro(x)}</Text>
        </View>
      ))}
      <Tenue style={{ fontSize: 12.5 }}>Codice offerta {r.offerta.codice}</Tenue>
      {sito ? (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(sito.startsWith("http") ? sito : `https://${sito}`)} style={st.link}>
          <Text style={st.linkTesto}>Vai all'offerta sul sito del venditore ↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SchedaBase({ r, pos, riferimento }: { r: RisultatoOfferta; pos: number; riferimento: number | null }) {
  const [aperta, setAperta] = useState(false);
  const o = r.offerta;
  const spesa = r.stima.totale;
  const diff = riferimento !== null ? riferimento - spesa : null;
  const venditore = dominio(o.contatti.sito);
  return (
    <View style={[st.scheda, pos === 1 && { borderColor: C.ink }]}>
      <View style={st.testa}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={st.pos}>#{pos}</Text>
          <Text style={st.nome}>{nomeLeggibile(o.nome)}</Text>
          {venditore ? <Tenue numberOfLines={1}>{venditore}</Tenue> : null}
        </View>
        <Voto v={r.pagella.voto} />
      </View>
      <Fatti r={r} />
      <View style={st.cifre}>
        {diff !== null ? (diff >= 1 ? <Cifra etichetta="Risparmio annuo" valore={euro(diff)} risparmio /> : <Cifra etichetta="Rispetto alla tua" valore={`+${euro(-diff)}`} />) : null}
        <Cifra etichetta="Spesa annua" valore={euro(spesa)} />
        <Cifra etichetta="Al mese" valore={euro(spesa / 12)} />
      </View>
      <Avvisi r={r} />
      {aperta ? (
        <View style={{ gap: 16, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 }}>
          <T style={st.sezione}>Pagella</T>
          <Metro v={r.pagella.voto} />
          <Pagella r={r} />
          <T style={st.sezione}>Il prezzo spiegato</T>
          <PrezzoSpiegato r={r} />
        </View>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aperta }} onPress={() => setAperta(!aperta)} style={st.apri}>
        <Text style={st.apriTesto}>{aperta ? "Nascondi pagella e prezzo spiegato" : "Vedi pagella e prezzo spiegato"}</Text>
      </Pressable>
    </View>
  );
}

export const Scheda = memo(SchedaBase);

const st = StyleSheet.create({
  scheda: { borderWidth: 1.5, borderColor: C.line, borderRadius: R.lg, padding: 16, gap: 12, backgroundColor: C.surface },
  testa: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  pos: { fontFamily: F.bold, fontSize: 13, color: C.inkMuted },
  nome: { fontFamily: F.extrabold, fontSize: 18, lineHeight: 23, color: C.ink },
  cifre: { flexDirection: "row", gap: 8 },
  ok: { fontFamily: F.semibold, fontSize: 14, color: C.onGood },
  sezione: { fontFamily: F.extrabold, fontSize: 16 },
  voce: { flexDirection: "row", alignItems: "center", gap: 10 },
  voceNome: { width: 118, fontFamily: F.semibold, fontSize: 14, color: C.ink },
  peso: { fontFamily: F.medium, fontSize: 12, color: C.inkMuted },
  barra: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.line, overflow: "hidden" },
  voceVoto: { width: 44, textAlign: "right", fontFamily: F.bold, fontSize: 14, color: C.ink, ...tabellari },
  riga: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rigaNome: { flex: 1, fontFamily: F.medium, fontSize: 14.5, color: C.ink },
  rigaValore: { fontFamily: F.bold, fontSize: 14.5, color: C.ink, ...tabellari },
  link: { minHeight: 44, justifyContent: "center" },
  linkTesto: { fontFamily: F.bold, fontSize: 15, color: C.ink, textDecorationLine: "underline" },
  fattiBox: { borderWidth: 1, borderColor: C.line, borderRadius: R.sm, overflow: "hidden" },
  fattoCella: { flex: 1, paddingVertical: 9, paddingHorizontal: 10, gap: 1 },
  fattoRiga: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  fattoEtichetta: { fontFamily: F.medium, fontSize: 12, color: C.inkMuted },
  fattoValore: { fontFamily: F.extrabold, fontSize: 17, color: C.ink, ...tabellari },
  fattoNota: { fontFamily: F.regular, fontSize: 11.5, color: C.inkMuted },
  apri: { alignSelf: "flex-start", minHeight: 40, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.lineStrong, justifyContent: "center" },
  apriTesto: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
});
