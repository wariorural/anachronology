import { describe, expect, it } from "vitest";
import {
  LAG_Z,
  lagOffset,
  tiltVinkel,
  fjaerSteg,
  iRo,
  hastighet,
  TILT_MAKS,
} from "./relieff";

describe("lagOffset", () => {
  it("henger etter bevegelsen, proporsjonalt med z", () => {
    expect(lagOffset(1, LAG_Z.grunn)).toBe(-0);
    expect(Math.abs(lagOffset(1, LAG_Z.naa))).toBeGreaterThan(
      Math.abs(lagOffset(1, LAG_Z.epoker)),
    );
    expect(lagOffset(1, 20)).toBeLessThan(0); // positiv fart → negativt heng
    expect(lagOffset(-1, 20)).toBeGreaterThan(0);
  });
  it("klemmes til ±z/4", () => {
    expect(lagOffset(100, 40)).toBe(-10);
    expect(lagOffset(-100, 40)).toBe(10);
  });
});

describe("tiltVinkel", () => {
  it("metter mykt mot TILT_MAKS og nuller småverdier", () => {
    expect(tiltVinkel(0)).toBe(0);
    expect(tiltVinkel(100)).toBeCloseTo(TILT_MAKS, 1);
    expect(Math.abs(tiltVinkel(0.5))).toBeLessThan(TILT_MAKS);
  });
});

describe("fjaerSteg", () => {
  it("konvergerer kritisk dempet mot målet uten oversving av betydning", () => {
    let pos = 10;
    let vel = 0;
    for (let i = 0; i < 60; i++) [pos, vel] = fjaerSteg(pos, vel, 0, 16);
    expect(Math.abs(pos)).toBeLessThan(0.05);
    expect(Math.abs(vel)).toBeLessThan(0.01);
  });
  it("takler lange dt (tab-bytte) uten å eksplodere", () => {
    const [pos] = fjaerSteg(10, 0, 0, 5000);
    expect(Math.abs(pos)).toBeLessThan(10);
  });
});

describe("iRo", () => {
  it("sant kun når alt er under terskelen", () => {
    expect(iRo([0.01, -0.02])).toBe(true);
    expect(iRo([0.01, 0.2])).toBe(false);
  });
});

describe("hastighet", () => {
  it("lavpasser rå delta og overlever dt=0", () => {
    const v = hastighet({ pos: 0, t: 0 }, { pos: 100, t: 100 }, 0);
    expect(v).toBeCloseTo(0.3, 5);
    expect(hastighet({ pos: 0, t: 5 }, { pos: 9, t: 5 }, 0.7)).toBe(0.7);
  });
});
