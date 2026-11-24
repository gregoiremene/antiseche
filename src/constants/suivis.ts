import type { TypeSuivi } from '@/db/schema';

/**
 * Métadonnées d'affichage des « à vérifier ». L'ordre est celui proposé à la
 * création. Le rattrapage de DS n'est PAS un type de suivi (il se déduit des
 * notes), mais on lui donne ici une icône/couleur pour l'afficher de la même
 * façon sur la page séance.
 */
export const SUIVIS: { type: TypeSuivi; label: string; emoji: string; couleur: string }[] = [
  { type: 'rattrapage_cours', label: 'Rattrapage de cours', emoji: '🔁', couleur: '#0D9BA5' },
  { type: 'cahier', label: 'Cahier au propre', emoji: '📓', couleur: '#8E4EC6' },
  { type: 'exo', label: 'Exo à rattraper', emoji: '📕', couleur: '#E5484D' },
  { type: 'autre', label: 'Autre', emoji: '📌', couleur: '#F76B15' },
];

export function infosSuivi(type: TypeSuivi) {
  return SUIVIS.find((s) => s.type === type) ?? SUIVIS[SUIVIS.length - 1];
}

/** Affichage des rattrapages de DS/interro (source dérivée des notes). */
export const RATTRAPAGE_EVAL = { label: 'DS à rattraper', emoji: '📝', couleur: '#D6409F' };
