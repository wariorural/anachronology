// Ett kort haptisk tikk der plattformen støtter det (Android Chrome m.fl.).
// iOS Safari mangler navigator.vibrate — da skjer ingenting, med vilje.
export function tikk(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // vibrate kan kaste i innbygde webviews med strenge policies — ignorer.
  }
}

/** Dobbel puls — grensepasseringer (NÅ-linja). */
export function dobbelTikk() {
  try {
    navigator.vibrate?.([15, 40, 15]);
  } catch {
    // som over
  }
}
