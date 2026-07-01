import { describe, it, expect } from "vitest";
import { dodge, type DodgeItem, type DodgeOpts } from "./dodge";

const OPTS: DodgeOpts = { radius: 5, laneBredde: 12, maxLanes: 10 };

// Sjekk-invariant: ingen to verk i SAMME lane overlapper (senter-avstand ≥ 2·radius).
function ingenOverlappISammeLane(
  items: DodgeItem[],
  plassering: Map<string, { lane: number }>,
  radius: number,
) {
  const perLane = new Map<number, DodgeItem[]>();
  for (const it of items) {
    const lane = plassering.get(it.id)!.lane;
    const liste = perLane.get(lane) ?? [];
    liste.push(it);
    perLane.set(lane, liste);
  }
  for (const liste of perLane.values()) {
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const a = liste[i];
        const b = liste[j];
        const aLo = Math.min(a.y0, a.y1) - radius;
        const aHi = Math.max(a.y0, a.y1) + radius;
        const bLo = Math.min(b.y0, b.y1) - radius;
        const bHi = Math.max(b.y0, b.y1) + radius;
        const overlapper = aLo < bHi && aHi > bLo;
        expect(overlapper).toBe(false);
      }
    }
  }
}

describe("dodge", () => {
  it("gir ingen overlapp innen en lane, og lar fjerne verk dele lane", () => {
    const items: DodgeItem[] = [
      { id: "a", y0: 0, y1: 0 },
      { id: "b", y0: 3, y1: 3 },
      { id: "c", y0: 100, y1: 100 },
      { id: "d", y0: 103, y1: 103 },
    ];
    const p = dodge(items, OPTS);
    ingenOverlappISammeLane(items, p, OPTS.radius);
    // a og c (langt fra hverandre) deler lane 0; b og d havner i lane 1.
    expect(p.get("a")!.lane).toBe(0);
    expect(p.get("c")!.lane).toBe(0);
    expect(p.get("b")!.lane).toBe(1);
    expect(p.get("d")!.lane).toBe(1);
  });

  it("legger ikke-overlappende verk i samme lane (0)", () => {
    const items: DodgeItem[] = [
      { id: "a", y0: 0, y1: 0 },
      { id: "b", y0: 50, y1: 50 },
      { id: "c", y0: 100, y1: 100 },
    ];
    const p = dodge(items, OPTS);
    expect([...p.values()].every((v) => v.lane === 0)).toBe(true);
  });

  it("bruker hele båndets høyde i kollisjonssjekken", () => {
    const items: DodgeItem[] = [
      { id: "band", y0: 0, y1: 100 }, // dekker 0–100
      { id: "punkt", y0: 50, y1: 50 }, // midt inni → må vike
    ];
    const p = dodge(items, OPTS);
    expect(p.get("band")!.lane).toBe(0);
    expect(p.get("punkt")!.lane).toBe(1);
  });

  it("er deterministisk uavhengig av input-rekkefølge", () => {
    const a: DodgeItem[] = [
      { id: "a", y0: 0, y1: 0 },
      { id: "b", y0: 2, y1: 2 },
      { id: "c", y0: 4, y1: 4 },
    ];
    const b = [...a].reverse();
    expect(dodge(a, OPTS)).toEqual(dodge(b, OPTS));
  });

  it("bryter likt y0 deterministisk på id", () => {
    const items: DodgeItem[] = [
      { id: "c", y0: 10, y1: 10 },
      { id: "a", y0: 10, y1: 10 },
      { id: "b", y0: 10, y1: 10 },
    ];
    const p = dodge(items, OPTS);
    // sortert a,b,c → lane 0,1,2
    expect(p.get("a")!.lane).toBe(0);
    expect(p.get("b")!.lane).toBe(1);
    expect(p.get("c")!.lane).toBe(2);
  });

  it("degraderer pent når maxLanes er nådd (stabler i siste lane)", () => {
    const items: DodgeItem[] = [
      { id: "a", y0: 0, y1: 0 },
      { id: "b", y0: 1, y1: 1 },
      { id: "c", y0: 2, y1: 2 },
    ];
    const p = dodge(items, { ...OPTS, maxLanes: 2 });
    expect(p.get("a")!.lane).toBe(0);
    expect(p.get("b")!.lane).toBe(1);
    expect(p.get("c")!.lane).toBe(1); // cappet til siste lane, ingen kræsj
  });
});
