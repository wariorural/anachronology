// Papirrelieffets bevegelsesmatte: hastighets-parallakse + tilt.
// Ren og testet (huskonvensjon). Ekte translateZ ble forkastet — det krever
// per-frame perspective-origin på scener som kan bli enorme (lineær modus) og
// brekker pinch-ankermatten. I stedet: hvert lag henger ETTER scrollen
// proporsjonalt med sin høyde (z), kritisk dempet mot 0 i ro — perfekt
// registrering når du står stille, dybdeproporsjonal skjær når du beveger deg.

/** Lagenes «høyde over papiret». Driver både parallakse-styrke og skygge-lesning. */
export const LAG_Z: Record<string, number> = {
  grunn: 0,
  epoker: 12,
  personer: 20,
  verk: 38,
  naa: 70,
};

/** Maks tilt (grader) og hastigheten (px/ms) som gir den. */
export const TILT_MAKS = 4.5;
export const TILT_VED_V = 2.2;

/** Parallakse-offset (px) for et lag ved gitt scrollhastighet (px/ms).
 *  Laget HENGER ETTER: offset er mot bevegelsesretningen, klemt til ±z/4
 *  (planens tak) så høye lag aldri sklir mer enn en synlig antydning. */
export function lagOffset(vPxMs: number, z: number): number {
  const raa = -vPxMs * z * 0.35;
  const tak = z / 4;
  return Math.max(-tak, Math.min(tak, raa));
}

/** Tilt (grader) ved gitt hastighet — myk metning mot TILT_MAKS. */
export function tiltVinkel(vPxMs: number): number {
  const t = Math.tanh(vPxMs / TILT_VED_V) * TILT_MAKS;
  return Math.abs(t) < 0.01 ? 0 : t;
}

/** Ett kritisk dempet fjærsteg mot mål. Returnerer [nyPos, nyVel].
 *  dt i ms; stiv nok til å følge fingeren, dempet nok til aldri å dirre. */
export function fjaerSteg(
  pos: number,
  vel: number,
  maal: number,
  dt: number,
): [number, number] {
  const omega = 0.018; // rad/ms — settler på ~250 ms
  const dtC = Math.min(dt, 64); // tab-bytte/hikke skal ikke sprenge integratoren
  const x = pos - maal;
  const eksp = Math.exp(-omega * dtC);
  const nyX = (x + (vel + omega * x) * dtC) * eksp;
  const nyV = (vel - omega * (vel + omega * x) * dtC) * eksp;
  return [nyX + maal, nyV];
}

/** Er hele systemet i ro (alle posisjoner/hastigheter under terskel)? */
export function iRo(verdier: number[], terskel = 0.05): boolean {
  return verdier.every((v) => Math.abs(v) < terskel);
}

/** Glidende hastighetsestimat (px/ms) fra to scroll-prøver, med lavpass. */
export function hastighet(
  forrige: { pos: number; t: number },
  naa: { pos: number; t: number },
  gammelV: number,
): number {
  const dt = naa.t - forrige.t;
  if (dt <= 0) return gammelV;
  const raa = (naa.pos - forrige.pos) / dt;
  return gammelV * 0.7 + raa * 0.3; // lavpass mot scroll-event-jitter
}
