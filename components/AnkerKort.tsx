import { useEffect, useRef, useState } from "react";
import type { Anker } from "@/lib/typer";
import { fmtAar, wikiUrl } from "@/lib/format";

// Detaljkort for et anker (epoke/kunstretning, person, hendelse, oppfinnelse).
// Gjenbruker .tm-kort-stilen så det leses som samme familie som verk-kortet,
// men er bevisst grunt: ingen snap/drag — dette er et oppslag, ikke et dokument.

const TYPE_NAVN: Record<Anker["type"], string> = {
  epoke: "Era",
  hendelse: "Event",
  oppfinnelse: "Invention",
  person: "Person",
};

interface Props {
  anker: Anker | null;
  onLukk: () => void;
}

export default function AnkerKort({ anker, onLukk }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  // Behold forrige innhold mens kortet toner ut (samme grep som Kort).
  const [vist, setVist] = useState<Anker | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (anker) {
      setVist(anker);
      if (!d.open) {
        d.showModal();
        artRef.current?.focus();
      }
    } else if (d.open) {
      d.close();
    }
  }, [anker]);

  const a = anker ?? vist;
  const spenn = a ? a.til - a.fra : 0;

  return (
    <dialog
      ref={ref}
      className="tm-kort"
      aria-labelledby="tm-anker-tittel"
      onClose={onLukk}
      onClick={(e) => {
        if (e.target === ref.current) onLukk(); // klikk på backdrop
      }}
    >
      {a && (
        <article ref={artRef} tabIndex={-1}>
          <button
            type="button"
            className="tm-kort-lukk"
            aria-label="Close"
            onClick={onLukk}
          >
            ×
          </button>

          <p className="tm-kort-medium">{TYPE_NAVN[a.type]}</p>

          <h2 id="tm-anker-tittel" className="tm-kort-tittel">
            {a.tittel}
          </h2>

          <dl className="tm-kort-fakta">
            {a.fra === a.til ? (
              <div>
                <dt>Year</dt>
                <dd>{fmtAar(a.fra)}</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>{a.type === "person" ? "Lived" : "Span"}</dt>
                  <dd>
                    {fmtAar(a.fra)}–{fmtAar(a.til)}
                  </dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{spenn.toLocaleString("en-US")} years</dd>
                </div>
              </>
            )}
          </dl>

          {a.merknad && <p className="tm-kort-merknad">{a.merknad}</p>}

          <footer className="tm-kort-foot">
            <a href={wikiUrl(a.tittel, a.wiki)} target="_blank" rel="noopener noreferrer">
              Wikipedia {"\u2197\uFE0E"}
            </a>
          </footer>
        </article>
      )}
    </dialog>
  );
}
