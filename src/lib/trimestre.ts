/**
 * Trimestre scolaire déduit d'une date.
 *
 * Découpage volontairement approximatif : les dates exactes de conseil varient
 * d'un établissement à l'autre et d'une année sur l'autre. Ce n'est qu'une
 * valeur par défaut proposée à la création d'une évaluation — elle reste
 * modifiable à la main.
 */
export function trimestreDeDate(date = new Date()): 1 | 2 | 3 {
  const mois = date.getMonth() + 1; // 1-12
  if (mois >= 9) return 1; // septembre → décembre
  if (mois <= 3) return 2; // janvier → mars
  return 3; // avril → août
}

export const TRIMESTRES = [1, 2, 3] as const;
