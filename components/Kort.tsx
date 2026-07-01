import { useEffect, useRef, useState } from "react";
import type { Verk } from "@/lib/typer";
import { fmtAar, foregaarTekst, mediumNavn, skaperLabel, wikiUrl } from "@/lib/format";

// Tre presise statuser i stedet for det tvetydige "innhentet". Bruker lagetÅr vs
// foregår-år: en historisk film (lagt til fortid da den ble laget) er noe annet enn
// sci-fi som forestilte en framtid vi nå har passert.
function status(v: Verk, naa: number): string {
  if (v.foregaarFra > naa) return "Unfulfilled future";
  if (v.lagetAar != null && v.lagetAar < v.foregaarFra) return "Overtaken future";
  return "Historical";
}

interface Props {
  verk: Verk | null;
  naa: number;
  onLukk: () => void;
}

// Klikk på en markør åpner dette. Her — og bare her — bor "når det ble laget".
export default function Kort({ verk, naa, onLukk }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  // Behold forrige innhold mens kortet toner UT, ellers blir panelet tomt.
  const [vist, setVist] = useState<Verk | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (verk) {
      setVist(verk);
      if (!d.open) {
        d.showModal();
        // showModal() autofokuserer lukkeknappen → synlig fokus-ring ved åpning.
        // Flytt fokus til selve arket (fokuserbart, men uten ring) i stedet.
        artRef.current?.focus();
      }
    } else if (d.open) {
      d.close();
    }
  }, [verk]);

  const v = verk ?? vist;

  return (
    <dialog
      ref={ref}
      className="tm-kort"
      aria-labelledby="tm-kort-tittel"
      onClose={onLukk}
      onClick={(e) => {
        if (e.target === ref.current) onLukk(); // klikk på backdrop
      }}
    >
      {v && (
        <article ref={artRef} tabIndex={-1}>
          <button
            type="button"
            className="tm-kort-lukk"
            aria-label="Close"
            onClick={onLukk}
          >
            ×
          </button>

          <p className="tm-kort-medium">
            {mediumNavn(v.medium)}
            {v.foregaarFra > naa && <span className="tm-kort-tag">future</span>}
          </p>

          {v.bilde && (
            <img className="tm-kort-bilde" src={v.bilde} alt="" loading="lazy" />
          )}

          <h2 id="tm-kort-tittel" className="tm-kort-tittel">{v.tittel}</h2>

          <dl className="tm-kort-fakta">
            {v.skaper && (
              <div>
                <dt>{skaperLabel(v.medium)}</dt>
                <dd>{v.skaper}</dd>
              </div>
            )}
            <div>
              <dt>Made</dt>
              <dd>{v.lagetAar != null ? fmtAar(v.lagetAar) : "unknown"}</dd>
            </div>
            <div>
              <dt>Set in</dt>
              <dd>
                {foregaarTekst(v.foregaarFra, v.foregaarTil)}
                {v.usikker && <span className="tm-kort-usikker"> (disputed)</span>}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{status(v, naa)}</dd>
            </div>
          </dl>

          {v.merknad && <p className="tm-kort-merknad">{v.merknad}</p>}

          <footer className="tm-kort-foot">
            <a href={wikiUrl(v.tittel, v.wiki)} target="_blank" rel="noopener noreferrer">
              Wikipedia ↗
            </a>
            {v.kilde && <span className="tm-kort-kilde">{v.kilde}</span>}
          </footer>
        </article>
      )}
    </dialog>
  );
}
