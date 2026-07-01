import { describe, it, expect } from "vitest";
import { lagSkala, type SkalaOpts } from "./skala";

const ELASTISK: SkalaOpts = {
  modus: "elastisk",
  pxPerAar: 4,
  zoom: 1,
  kollapsTerskel: 80,
  kollapsPx: 28,
  pad: 5,
};

// Et sett med fem spredte regioner og fire store tomrom → tvinger fram
// kollapsede segmenter og nok segmenter til å trene binærsøket.
const SPREDT = [
  { fra: -73, til: -71 },
  { fra: 180, til: 180 },
  { fra: 1805, til: 1812 },
  { fra: 2019, til: 2019 },
  { fra: 20000, til: 20000 },
];

describe("lagSkala", () => {
  it("kaster på tomt datasett", () => {
    expect(() => lagSkala([], ELASTISK)).toThrow(/tomt datasett/);
  });

  it("er monotont stigende for alle distinkte år i vinduet", () => {
    const s = lagSkala(SPREDT, ELASTISK);
    const aar = [-73, -71, 0, 180, 1805, 1812, 1900, 2019, 5000, 20000];
    for (let i = 1; i < aar.length; i++) {
      expect(s.yearToY(aar[i])).toBeGreaterThan(s.yearToY(aar[i - 1]));
    }
  });

  it("håndterer negative år og 20000 uten NaN", () => {
    const s = lagSkala(SPREDT, ELASTISK);
    expect(Number.isNaN(s.yearToY(-73))).toBe(false);
    expect(Number.isNaN(s.yearToY(20000))).toBe(false);
    expect(Number.isFinite(s.hoyde)).toBe(true);
  });

  it("kollapser tomme strekk til fast høyde, ikke år·px", () => {
    const s = lagSkala(SPREDT, ELASTISK);
    const kollapsede = s.segmenter.filter((seg) => seg.kollapset);
    expect(kollapsede.length).toBe(4);
    for (const seg of kollapsede) {
      expect(seg.y1 - seg.y0).toBe(ELASTISK.kollapsPx);
    }
  });

  it("lar små gap (≤ terskel) være lineære, ikke kollapset", () => {
    const s = lagSkala(
      [
        { fra: 1900, til: 1905 },
        { fra: 1950, til: 1955 },
      ],
      ELASTISK,
    );
    // Regioner [1895,1910] og [1945,1960] → gap 35 år ≤ 80 → lineært.
    const gap = s.segmenter.find((seg) => seg.fra === 1910 && seg.til === 1945);
    expect(gap?.kollapset).toBe(false);
    expect(gap!.y1 - gap!.y0).toBe(35 * ELASTISK.pxPerAar * ELASTISK.zoom);
  });

  it("lineær modus gir konstant px/år og ingen kollaps", () => {
    const s = lagSkala(SPREDT, { ...ELASTISK, modus: "lineaer" });
    expect(s.segmenter.some((seg) => seg.kollapset)).toBe(false);
    const stigning1 = (s.yearToY(1000) - s.yearToY(0)) / 1000;
    const stigning2 = (s.yearToY(10000) - s.yearToY(5000)) / 5000;
    expect(stigning1).toBeCloseTo(stigning2, 6);
  });

  it("yToYear er invers av yearToY i ikke-kollapsede segment", () => {
    const s = lagSkala(SPREDT, ELASTISK);
    for (const aar of [-72, 180, 1808, 2019]) {
      expect(s.yToYear(s.yearToY(aar))).toBeCloseTo(aar, 0);
    }
  });

  it("klemmer år utenfor vinduet til kantene", () => {
    const s = lagSkala(SPREDT, ELASTISK);
    expect(s.yearToY(-99999)).toBe(0);
    expect(s.yearToY(99999)).toBe(s.hoyde);
    // og y utenfor [0, hoyde] klemmes i inversen
    expect(s.yToYear(-50)).toBeCloseTo(s.yToYear(0), 6);
    expect(s.yToYear(s.hoyde + 50)).toBeCloseTo(s.yToYear(s.hoyde), 6);
  });

  it("er deterministisk: samme input → identiske segmenter", () => {
    const a = lagSkala(SPREDT, ELASTISK);
    const b = lagSkala(SPREDT, ELASTISK);
    expect(a.segmenter).toEqual(b.segmenter);
    expect(a.hoyde).toBe(b.hoyde);
  });

  it("tåler omvendt fra/til og slår sammen overlappende regioner", () => {
    // Omvendt intervall + to overlappende (etter pad) → én region, ett segment.
    const s = lagSkala(
      [
        { fra: 2010, til: 2000 },
        { fra: 2012, til: 2020 },
      ],
      ELASTISK,
    );
    expect(s.segmenter.length).toBe(1);
    expect(s.segmenter[0].kollapset).toBe(false);
  });

  it("slår sammen et nøstet intervall uten å krympe regionen", () => {
    const s = lagSkala(
      [
        { fra: 2000, til: 2050 },
        { fra: 2010, til: 2020 },
      ],
      { ...ELASTISK, pad: 0 },
    );
    expect(s.segmenter.length).toBe(1);
    expect(s.segmenter[0].til).toBe(2050);
  });

  it("tåler et nullbredt punkt (pad 0) uten å dele på null", () => {
    const s = lagSkala([{ fra: 2000, til: 2000 }], { ...ELASTISK, pad: 0 });
    expect(s.hoyde).toBe(0);
    expect(s.yearToY(2000)).toBe(0);
    expect(s.yToYear(0)).toBe(2000);
  });
});
