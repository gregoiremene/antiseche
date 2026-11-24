import { and, eq, notInArray } from 'drizzle-orm';

import { type Colonne, slotsDuPlan } from '@/lib/plan-classe';
import { db } from './index';
import { classes, eleves, inscriptions, places } from './schema';

/**
 * Plan de classe : disposition (sur la classe) et placements (table `places`).
 * Cf. `@/lib/plan-classe` pour la géométrie et le format des `slot`.
 */

/** Placements d'une classe : slot → élève (avec nom/photo pour l'affichage). */
export function selectPlaces(classeId: number) {
  return db
    .select({
      inscriptionId: places.inscriptionId,
      slot: places.slot,
      nom: eleves.nom,
      prenom: eleves.prenom,
      photoUri: eleves.photoUri,
    })
    .from(places)
    .innerJoin(inscriptions, eq(inscriptions.id, places.inscriptionId))
    .innerJoin(eleves, eq(eleves.id, inscriptions.eleveId))
    .where(eq(places.classeId, classeId));
}

/**
 * Enregistre (ou remplace) la disposition et purge les placements dont la table
 * n'existe plus (colonne raccourcie / supprimée). Transaction synchrone :
 * contrainte du driver expo-sqlite (cf. sauvegarde.ts).
 */
export async function definirDisposition(classeId: number, colonnes: Colonne[]) {
  const valides = slotsDuPlan(colonnes);
  db.transaction((tx) => {
    tx.update(classes).set({ planColonnes: colonnes }).where(eq(classes.id, classeId)).run();
    if (valides.length === 0) {
      tx.delete(places).where(eq(places.classeId, classeId)).run();
    } else {
      tx.delete(places)
        .where(and(eq(places.classeId, classeId), notInArray(places.slot, valides)))
        .run();
    }
  });
}

/**
 * Place un élève sur une table. Gère les trois cas :
 *   - table libre          → l'élève s'y installe (en quittant son ancienne place) ;
 *   - table occupée, élève déjà placé ailleurs → ÉCHANGE des deux places ;
 *   - table occupée, élève non placé → l'occupant est sorti du plan.
 * Les lectures se font avant la transaction (écritures synchrones only).
 */
export async function placerEleve(classeId: number, inscriptionId: number, slot: string) {
  const [occupant] = await db
    .select({ id: places.id, inscriptionId: places.inscriptionId })
    .from(places)
    .where(and(eq(places.classeId, classeId), eq(places.slot, slot)));
  if (occupant?.inscriptionId === inscriptionId) return; // déjà à cette table

  const [mien] = await db
    .select({ id: places.id, slot: places.slot })
    .from(places)
    .where(eq(places.inscriptionId, inscriptionId));
  const oldSlot = mien?.slot ?? null;

  db.transaction((tx) => {
    if (occupant) {
      if (mien && oldSlot) {
        // échange : on passe l'occupant par un slot temporaire pour ne pas violer
        // l'unicité (classeId, slot) le temps de la permutation
        const tmp = `tmp:${occupant.inscriptionId}`;
        tx.update(places).set({ slot: tmp }).where(eq(places.id, occupant.id)).run();
        tx.update(places).set({ slot }).where(eq(places.id, mien.id)).run();
        tx.update(places).set({ slot: oldSlot }).where(eq(places.id, occupant.id)).run();
      } else {
        // élève non placé : l'occupant quitte le plan, l'élève prend la table
        tx.delete(places).where(eq(places.id, occupant.id)).run();
        tx.insert(places).values({ classeId, inscriptionId, slot }).run();
      }
    } else if (mien) {
      tx.update(places).set({ slot }).where(eq(places.id, mien.id)).run();
    } else {
      tx.insert(places).values({ classeId, inscriptionId, slot }).run();
    }
  });
}

/** Sort un élève du plan (sa table redevient libre). */
export async function retirerEleve(inscriptionId: number) {
  await db.delete(places).where(eq(places.inscriptionId, inscriptionId));
}
