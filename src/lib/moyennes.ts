/**
 * Calcul des moyennes. Fonctions pures, sans accès base : c'est la partie qu'on
 * veut pouvoir tester et relire sans lancer l'appli.
 */

export type NotePourMoyenne = {
  valeur: number | null;
  absent: boolean;
  bareme: number;
  coef: number;
};

/**
 * Moyenne pondérée ramenée sur 20.
 * Les absences et les notes non saisies sont exclues (et non comptées comme 0).
 * Retourne null si l'élève n'a aucune note exploitable.
 */
export function moyenne(notes: NotePourMoyenne[]): number | null {
  let total = 0;
  let sommeCoef = 0;

  for (const n of notes) {
    if (n.absent || n.valeur === null) continue;
    if (n.bareme <= 0 || n.coef <= 0) continue;
    total += (n.valeur / n.bareme) * 20 * n.coef;
    sommeCoef += n.coef;
  }

  return sommeCoef === 0 ? null : total / sommeCoef;
}

/** Moyenne de classe = moyenne des moyennes des élèves qui en ont une. */
export function moyenneClasse(moyennesEleves: (number | null)[]): number | null {
  const valides = moyennesEleves.filter((m): m is number => m !== null);
  if (valides.length === 0) return null;
  return valides.reduce((a, b) => a + b, 0) / valides.length;
}

/** "12,5" — affichage à la française, tiret si pas de note. */
export function formatMoyenne(m: number | null, decimales = 1): string {
  if (m === null) return '—';
  return m.toFixed(decimales).replace('.', ',');
}
