import { describe, expect, it } from "vitest";
import seed from "../data/seed.json";
import type { Datasett, Verk } from "./typer";
import { temporalitet, sprang, bueHoyde, gapRang, buePath, slicePunkt, tellere } from "./chrono";

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

describe("bueHoyde + gapRang", () => {
  it("mapper andel til [12 %, 100 %] av maks", () => {
    expect(bueHoyde(0, 1000)).toBeCloseTo(120, 5);
    expect(bueHoyde(1, 1000)).toBeCloseTo(1000, 5);
    expect(bueHoyde(0.5, 1000)).toBeCloseTo(560, 5);
  });
  it("gapRang er persentil: outliere knuser ikke resten", () => {
    const r = gapRang([10, 30, 99, 500, 800675]);
    expect(r[0]).toBe(0);
    expect(r[4]).toBe(1);
    expect(r[2]).toBeCloseTo(0.5, 5); // midterste gap = midt på — tross outlier
    // like gap → samme rang; fortegn ignoreres
    const r2 = gapRang([-50, 50, 100]);
    expect(r2[0]).toBe(r2[1]);
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
