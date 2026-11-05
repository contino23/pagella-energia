/** Stato condiviso dell'app: dati del mercato, profilo dell'utente, ultima bolletta letta. Tutto resta sul telefono. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { caricaDati, type Dati } from "./dati";
import { profiloIniziale, type Profilo } from "./calcolo";

interface Stato {
  dati: Dati | null;
  errore: string | null;
  ricarica: () => void;
  profilo: Profilo;
  impostaProfilo: (p: Profilo) => void;
}

const Contesto = createContext<Stato | null>(null);

export function StatoProvider({ children }: { children: ReactNode }) {
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [profilo, impostaProfilo] = useState<Profilo>(profiloIniziale());
  const ricarica = useCallback(() => {
    setErrore(null);
    caricaDati().then(setDati).catch((e) => setErrore(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(ricarica, [ricarica]);
  return <Contesto.Provider value={{ dati, errore, ricarica, profilo, impostaProfilo }}>{children}</Contesto.Provider>;
}

export function useStato(): Stato {
  const s = useContext(Contesto);
  if (!s) throw new Error("useStato fuori da StatoProvider");
  return s;
}
