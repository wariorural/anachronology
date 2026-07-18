// Ett kort haptisk tikk der plattformen støtter det (Android Chrome m.fl.).
// iOS Safari mangler navigator.vibrate — da skjer ingenting, med vilje.
export function tikk(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // vibrate kan kaste i innbygde webviews med strenge policies — ignorer.
  }
}
