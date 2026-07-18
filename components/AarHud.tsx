"use client";

// Årstall-HUD (kun mobil): stort «SET IN»-årstall + epokekontekst som følger
// scrollen. Oppdateres IMPERATIVT fra Tidslinjes scroll-håndterer (textContent
// via refs) — aldri React-state per frame; SVG-treet skal ikke re-rendres av
// at man blar gjennom tid. aria-hidden: sr-only-sammendraget dekker AT, og en
// live-region som fyrer per scroll-frame ville vært fiendtlig.

interface Props {
  hudRef: React.RefObject<HTMLDivElement | null>;
  aarRef: React.RefObject<HTMLSpanElement | null>;
  kontekstRef: React.RefObject<HTMLSpanElement | null>;
}

export default function AarHud({ hudRef, aarRef, kontekstRef }: Props) {
  return (
    <div className="tm-hud" ref={hudRef} aria-hidden="true">
      <span className="tm-hud-merke">Set in</span>
      <span className="tm-hud-aar" ref={aarRef} />
      <span className="tm-hud-kontekst" ref={kontekstRef} />
    </div>
  );
}
