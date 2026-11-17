import { asc, eq } from 'drizzle-orm';

import { db } from './index';
import { matieres } from './schema';

export type Matiere = typeof matieres.$inferSelect;

/** Toutes les matières, triées par nom — pour le gestionnaire et le sélecteur. */
export function selectMatieres() {
  return db.select().from(matieres).orderBy(asc(matieres.nom));
}

/** Crée une matière ; renvoie son id. Lève si le nom existe déjà (unique). */
export async function creerMatiere(nom: string, couleur: string) {
  const [creee] = await db
    .insert(matieres)
    .values({ nom: nom.trim(), couleur })
    .returning({ id: matieres.id });
  return creee.id;
}

export async function majMatiere(id: number, champs: { nom: string; couleur: string }) {
  await db
    .update(matieres)
    .set({ nom: champs.nom.trim(), couleur: champs.couleur })
    .where(eq(matieres.id, id));
}

/** Supprime une matière. Les cours qui l'utilisaient repassent à matiereId null. */
export async function supprimerMatiere(id: number) {
  await db.delete(matieres).where(eq(matieres.id, id));
}
