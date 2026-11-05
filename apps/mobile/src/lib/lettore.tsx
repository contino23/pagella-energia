/**
 * Lettura del testo di un PDF sul telefono: una WebView invisibile carica la pagina /lettore-pdf/ del sito
 * (pdf.js), riceve il file e restituisce il testo. Il file non viene inviato a nessun server.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewProps } from "react-native-webview";

// I tipi di react-native-webview non sono ancora allineati a React 19.3: usiamo la firma delle props.
const Vista = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;
import { SITO } from "./dati";

type Avanzamento = (pagina: number, totale: number) => void;
type Lettore = (base64: string, avanzamento?: Avanzamento) => Promise<string>;

const Contesto = createContext<Lettore | null>(null);

export function LettorePdfProvider({ children }: { children: ReactNode }) {
  const vista = useRef<WebView>(null);
  const [pronto, setPronto] = useState(false);
  const attese = useRef(new Map<string, { ok: (t: string) => void; ko: (e: Error) => void; avanzamento?: Avanzamento }>());
  const coda = useRef<Array<() => void>>([]);

  const alMessaggio = useCallback((e: WebViewMessageEvent) => {
    let m: { id: string; tipo: string; pagina?: number; totale?: number; testo?: string; errore?: string };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.tipo === "pronto") {
      setPronto(true);
      coda.current.splice(0).forEach((f) => f());
      return;
    }
    const a = attese.current.get(m.id);
    if (!a) return;
    if (m.tipo === "pagina") a.avanzamento?.(m.pagina ?? 0, m.totale ?? 0);
    else if (m.tipo === "testo") { attese.current.delete(m.id); a.ok(m.testo ?? ""); }
    else if (m.tipo === "errore") { attese.current.delete(m.id); a.ko(new Error(m.errore || "PDF non leggibile")); }
  }, []);

  const leggi: Lettore = useCallback((base64, avanzamento) => new Promise<string>((ok, ko) => {
    const id = Math.random().toString(36).slice(2);
    attese.current.set(id, { ok, ko, ...(avanzamento ? { avanzamento } : {}) });
    const avvia = () => vista.current?.injectJavaScript(`window.leggiPdf(${JSON.stringify({ id, base64 })}); true;`);
    if (pronto) avvia(); else coda.current.push(avvia);
    setTimeout(() => {
      if (attese.current.delete(id)) ko(new Error("La lettura ha impiegato troppo: controlla la connessione e riprova."));
    }, 60_000);
  }), [pronto]);

  return (
    <Contesto.Provider value={leggi}>
      {children}
      <View style={{ width: 0, height: 0, overflow: "hidden", position: "absolute" }} pointerEvents="none">
        <Vista
          ref={vista}
          source={{ uri: `${SITO}lettore-pdf/` }}
          onMessage={alMessaggio}
          javaScriptEnabled
          originWhitelist={["https://*"]}
          style={{ width: 1, height: 1 }}
        />
      </View>
    </Contesto.Provider>
  );
}

export function useLettorePdf(): Lettore {
  const l = useContext(Contesto);
  if (!l) throw new Error("useLettorePdf fuori da LettorePdfProvider");
  return l;
}
