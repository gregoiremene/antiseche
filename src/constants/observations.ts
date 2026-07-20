import type { TypeObservation } from '@/db/schema';

/**
 * L'ordre compte : c'est celui des boutons de saisie rapide, du plus fréquent
 * au moins fréquent. « Exo non fait » est le premier parce que c'est le geste
 * qu'on fait plusieurs fois par jour.
 */
export const OBSERVATIONS: {
  type: TypeObservation;
  label: string;
  emoji: string;
  couleur: string;
}[] = [
  { type: 'exo_non_fait', label: 'Exo non fait', emoji: '📕', couleur: '#E5484D' },
  { type: 'materiel_oublie', label: 'Matériel oublié', emoji: '🎒', couleur: '#F76B15' },
  { type: 'retard', label: 'Retard', emoji: '⏰', couleur: '#8E4EC6' },
  { type: 'comportement', label: 'Comportement', emoji: '💬', couleur: '#0D9BA5' },
  { type: 'positif', label: 'Positif', emoji: '⭐', couleur: '#30A46C' },
];

export function infosObservation(type: TypeObservation) {
  return OBSERVATIONS.find((o) => o.type === type) ?? OBSERVATIONS[0];
}

/** Date du jour au format stocké en base (YYYY-MM-DD, heure locale). */
export function aujourdhui(): string {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}
