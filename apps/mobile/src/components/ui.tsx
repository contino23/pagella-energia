/** Componenti di base dell'app, con gli stessi colori e la stessa tipografia del sito. */
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { C, F, R, tabellari } from "../lib/tema";
import { voto as fmtVoto } from "../lib/formato";

type PropsTesto = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export const T = ({ children, style, numberOfLines }: PropsTesto) => (
  <Text style={[s.testo, style]} numberOfLines={numberOfLines}>{children}</Text>
);
export const Titolo = ({ children, style }: PropsTesto) => <Text style={[s.titolo, style]} accessibilityRole="header">{children}</Text>;
export const Sottotitolo = ({ children, style }: PropsTesto) => <Text style={[s.sottotitolo, style]} accessibilityRole="header">{children}</Text>;
export const Tenue = ({ children, style, numberOfLines }: PropsTesto) => <Text style={[s.tenue, style]} numberOfLines={numberOfLines}>{children}</Text>;
export const Occhiello = ({ children }: { children: ReactNode }) => <Text style={s.occhiello}>{children}</Text>;

export function Pulsante({ titolo, onPress, tipo = "primario", disabilitato, icona, stile }: {
  titolo: string; onPress: () => void; tipo?: "primario" | "secondario" | "birra" | "link"; disabilitato?: boolean; icona?: ReactNode; stile?: StyleProp<ViewStyle>;
}) {
  const st = tipo === "primario" ? s.btnPrimario : tipo === "secondario" ? s.btnSecondario : tipo === "birra" ? s.btnBirra : s.btnLink;
  const testo = tipo === "primario" ? s.btnTestoPrimario : tipo === "link" ? s.btnTestoLink : s.btnTestoSecondario;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabilitato}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabilitato }}
      style={({ pressed }) => [st, pressed && { opacity: 0.85 }, disabilitato && { opacity: 0.5 }, stile]}
    >
      {icona}
      <Text style={testo}>{titolo}</Text>
    </Pressable>
  );
}

export function Chip({ testo, tipo }: { testo: string; tipo: "luce" | "gas" | "neutro" }) {
  const sfondo = tipo === "luce" ? C.luceTint : tipo === "gas" ? C.gasTint : C.surfaceMuted;
  const colore = tipo === "luce" ? C.onLuce : tipo === "gas" ? C.onGas : C.ink;
  return (
    <View style={[s.chip, { backgroundColor: sfondo }]}>
      <Text style={[s.chipTesto, { color: colore }]}>{tipo === "luce" ? "⚡ " : tipo === "gas" ? "🔥 " : ""}{testo}</Text>
    </View>
  );
}

export const coloreVoto = (v: number) => (v >= 6 ? C.good : C.warn);

export function Voto({ v, grande }: { v: number; grande?: boolean }) {
  return (
    <Text style={[s.voto, { color: coloreVoto(v), fontSize: grande ? 44 : 28 }]} accessibilityLabel={`Voto ${fmtVoto(v)} su 10`}>
      {fmtVoto(v)}{grande ? <Text style={s.votoDi}>/10</Text> : null}
    </Text>
  );
}

/** Barra a 10 tacche, come sul sito. */
export function Metro({ v }: { v: number }) {
  return (
    <View style={s.metro} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 10 }, (_, i) => {
        const pieno = Math.max(0, Math.min(1, v - i));
        return (
          <View key={i} style={s.tacca}>
            <View style={{ width: `${pieno * 100}%`, height: "100%", backgroundColor: coloreVoto(v) }} />
          </View>
        );
      })}
    </View>
  );
}

export function Cifra({ etichetta, valore, risparmio }: { etichetta: string; valore: string; risparmio?: boolean }) {
  return (
    <View style={[s.cifra, risparmio && { backgroundColor: C.goodTint }]}>
      <Text style={[s.cifraEtichetta, risparmio && { color: C.onGood }]}>{etichetta}</Text>
      <Text style={[s.cifraValore, risparmio && { color: C.onGood }]}>{valore}</Text>
    </View>
  );
}

export function Avviso({ tipo, titolo, testo }: { tipo: "warn" | "info" | "ok"; titolo?: string; testo: string }) {
  const sfondo = tipo === "warn" ? C.warnTint : tipo === "info" ? C.infoTint : C.goodTint;
  const colore = tipo === "warn" ? C.onWarn : tipo === "info" ? C.onInfo : C.onGood;
  const segno = tipo === "warn" ? "⚠︎" : tipo === "info" ? "↗" : "✓";
  return (
    <View style={[s.avviso, { backgroundColor: sfondo }]}>
      <Text style={[s.avvisoSegno, { color: colore }]}>{segno}</Text>
      <Text style={[s.avvisoTesto, { color: colore }]}>{titolo ? <Text style={{ fontFamily: F.bold }}>{titolo} </Text> : null}{testo}</Text>
    </View>
  );
}

export const Riquadro = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.riquadro, style]}>{children}</View>;

export function Caricamento({ testo }: { testo: string }) {
  return (
    <View style={s.caricamento}>
      <ActivityIndicator color={C.ink} />
      <Tenue>{testo}</Tenue>
    </View>
  );
}

export const s = StyleSheet.create({
  testo: { fontFamily: F.regular, fontSize: 16, lineHeight: 23, color: C.ink },
  titolo: { fontFamily: F.extrabold, fontSize: 30, lineHeight: 34, color: C.ink, letterSpacing: -0.6 },
  sottotitolo: { fontFamily: F.extrabold, fontSize: 20, lineHeight: 25, color: C.ink },
  tenue: { fontFamily: F.regular, fontSize: 14.5, lineHeight: 21, color: C.inkMuted },
  occhiello: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: C.inkMuted },
  btnPrimario: { minHeight: 56, borderRadius: R.md, backgroundColor: C.ink, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  btnSecondario: { minHeight: 50, borderRadius: R.md, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.surface, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnBirra: { minHeight: 46, borderRadius: R.sm, backgroundColor: C.birra, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  btnTestoPrimario: { fontFamily: F.bold, fontSize: 17, color: C.onInk },
  btnTestoSecondario: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  btnTestoLink: { fontFamily: F.bold, fontSize: 15, color: C.ink, textDecorationLine: "underline" },
  chip: { alignSelf: "flex-start", borderRadius: R.pill, paddingHorizontal: 12, height: 30, justifyContent: "center" },
  chipTesto: { fontFamily: F.bold, fontSize: 13.5 },
  voto: { fontFamily: F.extrabold, letterSpacing: -1, ...tabellari },
  votoDi: { fontFamily: F.semibold, fontSize: 16, color: C.inkMuted, letterSpacing: 0 },
  metro: { flexDirection: "row", gap: 4, height: 9 },
  tacca: { flex: 1, borderRadius: 3, backgroundColor: C.line, overflow: "hidden" },
  cifra: { flex: 1, backgroundColor: C.surfaceMuted, borderRadius: R.sm, padding: 12, gap: 2 },
  cifraEtichetta: { fontFamily: F.medium, fontSize: 13, color: C.inkMuted },
  cifraValore: { fontFamily: F.extrabold, fontSize: 21, color: C.ink, ...tabellari },
  avviso: { flexDirection: "row", gap: 8, borderRadius: R.sm, padding: 12 },
  avvisoSegno: { fontFamily: F.bold, fontSize: 15, lineHeight: 21 },
  avvisoTesto: { flex: 1, fontFamily: F.medium, fontSize: 14.5, lineHeight: 21 },
  riquadro: { borderWidth: 1.5, borderColor: C.line, borderRadius: R.lg, padding: 18, gap: 12, backgroundColor: C.surface },
  caricamento: { padding: 32, alignItems: "center", gap: 12 },
});
