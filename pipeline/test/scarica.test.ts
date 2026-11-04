import { describe, expect, it } from "vitest";
import { estraiCollegamenti, scegliFile, scegliIndici } from "../src/scarica.js";

const BASE = "https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page";
const HTML = `
<a href="/portaleOfferte/resources/opendata/csv/offerteML/2026_11/PO_Offerte_E_MLIBERO_20261103.xml">Offerte luce</a>
<a href="/portaleOfferte/resources/opendata/csv/offerteML/2026_11/PO_Offerte_E_MLIBERO_20261104.xml">Offerte luce</a>
<a href="/portaleOfferte/resources/opendata/csv/offerteML/2026_11/PO_Offerte_G_MLIBERO_20261104.xml">Offerte gas</a>
<a href="/portaleOfferte/resources/opendata/csv/offerteML/2026_11/PO_Offerte_D_MLIBERO_20261104.xml">Dual</a>
<a href="../resources/opendata/csv/parametriML/2026_11/PO_Parametri_Mercato_Libero_E_20261104.csv">Parametri luce</a>
<a href="/portaleOfferte/resources/cms/documents/0c916785cbc1c33483b3dee7fc53c7a5.csv"><span>Prezzi storici</span> degli indici</a>
<a href="/portaleOfferte/resources/cms/documents/manuale.pdf">Manuale</a>`;

describe("scaricamento dalla pagina Open Data", () => {
  const link = estraiCollegamenti(HTML, BASE);

  it("prende i file della data più recente con luce e gas, con indirizzi assoluti", () => {
    const s = scegliFile(link)!;
    expect(s.data).toBe("2026-11-04");
    expect(s.file.map((f) => f.nome).sort()).toEqual([
      "PO_Offerte_D_MLIBERO_20261104.xml", "PO_Offerte_E_MLIBERO_20261104.xml", "PO_Offerte_G_MLIBERO_20261104.xml", "PO_Parametri_Mercato_Libero_E_20261104.csv",
    ]);
    expect(s.file.find((f) => f.nome.startsWith("PO_Parametri"))!.url).toBe("https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/parametriML/2026_11/PO_Parametri_Mercato_Libero_E_20261104.csv");
  });

  it("riconosce il CSV dei prezzi storici dal testo del link", () => {
    expect(scegliIndici(link)).toBe("https://www.ilportaleofferte.it/portaleOfferte/resources/cms/documents/0c916785cbc1c33483b3dee7fc53c7a5.csv");
  });

  it("senza file di offerte non sceglie nulla", () => {
    expect(scegliFile(estraiCollegamenti('<a href="/x.pdf">x</a>', BASE))).toBeNull();
  });
});
