/** Colori e misure dal design system (design/tokens.json), unica fonte con il sito. */
import tokens from "../../../../design/tokens.json";

type Token = { name: string; value: string | { light: string } };
const colori = Object.fromEntries(
  (tokens.color.tokens as Token[]).map((t) => [t.name, typeof t.value === "string" ? t.value : t.value.light]),
) as Record<string, string>;

export const C = {
  surface: colori.surface!,
  surfaceMuted: colori["surface-muted"]!,
  line: colori.line!,
  lineStrong: colori["line-strong"]!,
  ink: colori.ink!,
  inkMuted: colori["ink-muted"]!,
  onInk: colori["on-ink"]!,
  luce: colori.luce!,
  luceTint: colori["luce-tint"]!,
  onLuce: colori["on-luce"]!,
  gas: colori.gas!,
  gasTint: colori["gas-tint"]!,
  onGas: colori["on-gas"]!,
  birra: colori.birra!,
  birraTint: colori["birra-tint"]!,
  onBirra: colori["on-birra"]!,
  good: colori.good!,
  goodTint: colori["good-tint"]!,
  onGood: colori["on-good"]!,
  warn: colori.warn!,
  warnTint: colori["warn-tint"]!,
  onWarn: colori["on-warn"]!,
  infoTint: colori["info-tint"]!,
  onInfo: colori["on-info"]!,
};

export const F = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
  extrabold: "DMSans_800ExtraBold",
};

export const R = { sm: 10, md: 14, lg: 18, pill: 999 };
/** Cifre tabellari: i numeri non "ballano" tra una riga e l'altra. */
export const tabellari = { fontVariant: ["tabular-nums" as const] };
