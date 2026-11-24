/**
 * Géométrie du plan de classe. Fonctions pures, partagées entre la base (nettoyage
 * des placements orphelins) et l'écran (rendu de la grille).
 *
 * Une disposition est une liste de colonnes (gauche → droite, vue du prof). Chaque
 * colonne a une largeur (nb de tables collées) et une hauteur (nb de rangs). Une
 * table est repérée par un `slot` "colonne:x:y" : x = position dans la largeur,
 * y = rang (0 = devant, près du tableau).
 */

export type Colonne = { largeur: number; hauteur: number };

export function slotId(colonne: number, x: number, y: number): string {
  return `${colonne}:${x}:${y}`;
}

/** Tous les slots valides d'une disposition (sert à purger les orphelins). */
export function slotsDuPlan(colonnes: Colonne[]): string[] {
  const out: string[] = [];
  colonnes.forEach((col, c) => {
    for (let x = 0; x < col.largeur; x++) {
      for (let y = 0; y < col.hauteur; y++) out.push(slotId(c, x, y));
    }
  });
  return out;
}

export function nbTables(colonnes: Colonne[]): number {
  return colonnes.reduce((n, c) => n + c.largeur * c.hauteur, 0);
}
