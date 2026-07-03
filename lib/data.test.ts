import { describe, expect, it } from "vitest";
import seed from "../data/seed.json";
import type { Datasett, Medium } from "./typer";

// page.tsx gjør `seed as Datasett` — en påstand, ikke validering. Denne testen
// er valideringen: en bidragsyter som følger README og skriver et ukjent medium
// eller snudde årstall får rød test, ikke en stille feilmerket markør.

const data = seed as Datasett;
const MEDIER: Medium[] = ["film", "bok", "tv"];
const ANKER_TYPER = ["epoke", "hendelse", "oppfinnelse", "person"];

describe("seed.json", () => {
  it("alle verk har gyldig medium", () => {
    for (const v of data.verk) {
      expect(MEDIER, `«${v.tittel}» har ukjent medium «${v.medium}»`).toContain(
        v.medium,
      );
    }
  });

  it("foregaarFra ≤ foregaarTil for alle verk", () => {
    for (const v of data.verk) {
      expect(
        v.foregaarFra,
        `«${v.tittel}» har snudd tidsspenn`,
      ).toBeLessThanOrEqual(v.foregaarTil);
    }
  });

  it("alle ankere har gyldig type og fra ≤ til", () => {
    for (const a of data.ankere) {
      expect(ANKER_TYPER, `«${a.tittel}» har ukjent type`).toContain(a.type);
      expect(a.fra, `«${a.tittel}» har snudd spenn`).toBeLessThanOrEqual(a.til);
    }
  });

  it("titler er unike (slug-baserte permalinks krever det)", () => {
    const sett = new Set<string>();
    for (const v of data.verk) {
      expect(sett.has(v.tittel), `duplikat tittel: «${v.tittel}»`).toBe(false);
      sett.add(v.tittel);
    }
  });
});
