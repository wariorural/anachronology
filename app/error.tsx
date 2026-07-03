"use client";

// Feilgrense i appens eget formspråk — Nexts umerkede default-skjerm er det
// motsatte av papir/blekk-estetikken. Hele UI-et er ÉN klientkomponent full av
// peker/zoom-matematikk; ett uventet kast skal ikke bli en hvit side.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="tm-feil">
      <h1>Something broke in the timeline</h1>
      <p>The clockwork slipped a gear. Your data is fine — try again.</p>
      <button type="button" onClick={reset}>
        Rewind
      </button>
    </main>
  );
}
