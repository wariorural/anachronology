import { describe, expect, it } from "vitest";
import seed from "../data/seed.json";
import type { Datasett, Verk } from "./typer";
import { temporalitet, sprang, bueHoyde, buePath, slicePunkt, tellere } from "./chrono";

const v = (lagetAar: number | undefined, fra: number, til = fra): Verk => ({
  tittel: "t",
  medium: "bok",
  lagetAar,
  foregaarFra: fra,
  foregaarTil: til,
});

describe("temporalitet", () => {
  it("profeti når foregår etter laget", () => {
    expect(temporalitet(v(1927, 2026))).toBe("profeti");
  });
  it("minne når foregår før laget", () => {
    expect(temporalitet(v(1844, 1815, 1839))).toBe("minne");
  });
  it("samtid når spennet omslutter laget-året eller laget-år mangler", () => {
    expect(temporalitet(v(1999, 1999))).toBe("samtid");
    expect(temporalitet(v(undefined, 1500))).toBe("samtid");
    expect(temporalitet(v(2017, 1888, 2053))).toBe("samtid"); // Dark: knuten omslutter 2017
  });
});

describe("sprang", () => {
  it("positivt for profetier, negativt for minner", () => {
    expect(sprang(v(1927, 2026))).toBe(99);
    expect(sprang(v(2023, 1981))).toBe(-42);
    expect(sprang(v(1999, 1999))).toBe(0);
  });
});

describe("bueHoyde", () => {
  it("vokser med kvadratrot og klemmes mot maks", () => {
    const lav = bueHoyde(99, 1000);
    const hoy = bueHoyde(800675, 1000);
    expect(lav).toBeGreaterThan(14);
    expect(hoy).toBe(1000);
    expect(bueHoyde(400, 1000)).toBeCloseTo(14 + 20 * 13, 5);
  });
});

describe("buePath", () => {
  it("buer opp for profetier (negativ kontroll-y)", () => {
    expect(buePath(10, 110, 50, true)).toBe("M 10 0 Q 60 -50 110 0");
    expect(buePath(10, 110, 50, false)).toBe("M 10 0 Q 60 50 110 0");
  });
});

describe("slicePunkt", () => {
  it("andel langs akseprojeksjonen, retningsuavhengig", () => {
    expect(slicePunkt(0, 100, 25)).toBe(0.25);
    expect(slicePunkt(100, 0, 25)).toBe(0.25); // minne-bue (p0 > p1)
    expect(slicePunkt(0, 100, 100)).toBeNull();
    expect(slicePunkt(0, 100, -5)).toBeNull();
  });
});

describe("tellere (mot ekte datasett)", () => {
  const data = seed as Datasett;
  const t = tellere(data.verk, 2026);
  it("teller kun profetier, og summen stemmer", () => {
    const profetier = data.verk.filter((x) => temporalitet(x) === "profeti");
    expect(t.innhentet + t.gjenstaar).toBe(profetier.length);
    expect(t.innhentet).toBeGreaterThan(0);
    expect(t.gjenstaar).toBeGreaterThan(0);
  });
});
