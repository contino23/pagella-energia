/** Sul web l'app serve solo per l'anteprima: la lettura dei PDF c'è già sul sito. */
import { createContext, useContext, type ReactNode } from "react";

type Lettore = (base64: string, avanzamento?: (p: number, t: number) => void) => Promise<string>;
const nonDisponibile: Lettore = () => Promise.reject(new Error("Nell'anteprima web la lettura del PDF non è disponibile: usa il sito."));
const Contesto = createContext<Lettore>(nonDisponibile);

export const LettorePdfProvider = ({ children }: { children: ReactNode }) => <Contesto.Provider value={nonDisponibile}>{children}</Contesto.Provider>;
export const useLettorePdf = () => useContext(Contesto);
