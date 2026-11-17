/**
 * Découpage en trimestres, piloté par deux dates de bascule (fin T1, fin T2)
 * propres à l'année scolaire. Fonctions pures, sans accès base.
 *
 * Les dates circulent en `YYYY-MM-DD` : comparables comme des chaînes, sans
 * objet Date ni fuseau horaire.
 */

export const TRIMESTRES = [1, 2, 3] as const;
export type Trimestre = (typeof TRIMESTRES)[number];

export type BornesTrimestres = { finT1: string; finT2: string };

/** startYear / endYear depuis "2026-2027". */
function anneesDuLibelle(libelle: string): [number, number] {
  const [a, b] = libelle.split('-').map(Number);
  return [a, b];
}

/**
 * Bornes par défaut si l'utilisateur ne les a pas encore saisies.
 * Fin novembre et mi-mars : approximation courante, à ajuster par établissement.
 */
export function bornesParDefaut(libelleAnnee: string): BornesTrimestres {
  const [debut, fin] = anneesDuLibelle(libelleAnnee);
  return { finT1: `${debut}-11-30`, finT2: `${fin}-03-15` };
}

/** Complète les bornes manquantes par les valeurs par défaut. */
export function bornesEffectives(
  libelleAnnee: string,
  finT1: string | null,
  finT2: string | null,
): BornesTrimestres {
  const defaut = bornesParDefaut(libelleAnnee);
  return { finT1: finT1 ?? defaut.finT1, finT2: finT2 ?? defaut.finT2 };
}

export function trimestreDeDate(date: string, bornes: BornesTrimestres): Trimestre {
  if (date <= bornes.finT1) return 1;
  if (date <= bornes.finT2) return 2;
  return 3;
}

/**
 * Jour suivant une date `YYYY-MM-DD` (pour enchaîner les bornes sans trou).
 * Calcul en UTC : construire la date en heure locale puis repasser en ISO
 * décalait d'un jour dans les fuseaux à l'est de Greenwich.
 */
function jourSuivant(date: string): string {
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + 1));
  return d.toISOString().slice(0, 10);
}

/** Intervalle [debut, fin] d'un trimestre, bornes incluses. */
export function bornesTrimestre(
  t: Trimestre,
  libelleAnnee: string,
  bornes: BornesTrimestres,
): { debut: string; fin: string } {
  const [debut, fin] = anneesDuLibelle(libelleAnnee);
  const rentree = `${debut}-08-01`; // large : couvre une pré-rentrée en août
  const finAnnee = `${fin}-07-31`;
  if (t === 1) return { debut: rentree, fin: bornes.finT1 };
  if (t === 2) return { debut: jourSuivant(bornes.finT1), fin: bornes.finT2 };
  return { debut: jourSuivant(bornes.finT2), fin: finAnnee };
}

const NOMS_MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** "30 nov." — pour afficher une borne. */
export function formatDateCourte(date: string): string {
  const [, mois, jour] = date.split('-');
  return `${Number(jour)} ${NOMS_MOIS_COURTS[Number(mois) - 1]}`;
}
