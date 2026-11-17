/**
 * Utilitaires de calendrier, en semaine française (lundi → dimanche).
 * Fonctions pures : aucune dépendance à React ni à la base.
 *
 * Les dates circulent partout sous forme de chaînes `YYYY-MM-DD`, jamais
 * d'objets Date : ça évite les décalages de fuseau horaire, qui feraient
 * basculer une observation saisie à 23 h au lendemain (ou à la veille).
 */

export type Mois = { annee: number; mois: number }; // mois : 1-12

const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function moisCourant(date = new Date()): Mois {
  return { annee: date.getFullYear(), mois: date.getMonth() + 1 };
}

export function moisPrecedent({ annee, mois }: Mois): Mois {
  return mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 };
}

export function moisSuivant({ annee, mois }: Mois): Mois {
  return mois === 12 ? { annee: annee + 1, mois: 1 } : { annee, mois: mois + 1 };
}

/** "juillet 2026" */
export function formatMois({ annee, mois }: Mois): string {
  return `${NOMS_MOIS[mois - 1]} ${annee}`;
}

export function cleDate(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/** Bornes du mois, incluses, au format `YYYY-MM-DD`. */
export function bornesMois({ annee, mois }: Mois): { debut: string; fin: string } {
  return {
    debut: cleDate(annee, mois, 1),
    fin: cleDate(annee, mois, new Date(annee, mois, 0).getDate()),
  };
}

/**
 * Grille du mois découpée en semaines de 7 cases.
 * Les cases hors du mois valent `null`, pour aligner les colonnes sur les jours.
 */
export function grilleMois({ annee, mois }: Mois): (string | null)[][] {
  const nbJours = new Date(annee, mois, 0).getDate();
  // getDay() : 0 = dimanche ; on veut 0 = lundi
  const decalage = (new Date(annee, mois - 1, 1).getDay() + 6) % 7;

  const cases: (string | null)[] = Array(decalage).fill(null);
  for (let jour = 1; jour <= nbJours; jour++) {
    cases.push(cleDate(annee, mois, jour));
  }
  while (cases.length % 7 !== 0) cases.push(null);

  const semaines: (string | null)[][] = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

/** "12 mars" — pour les listes chronologiques. */
export function formatJourCourt(date: string): string {
  const [, mois, jour] = date.split('-');
  return `${Number(jour)} ${NOMS_MOIS[Number(mois) - 1]}`;
}

const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** "mercredi 29 juillet" — quand le jour de la semaine compte (créneaux). */
export function formatJourAvecSemaine(date: string): string {
  const [a, m, j] = date.split('-').map(Number);
  const idx = (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7; // 0 = lundi
  return `${NOMS_JOURS[idx]} ${formatJourCourt(date)}`;
}

/** aujourd'hui en `YYYY-MM-DD`, heure locale. */
export function aujourdhuiISO(ref = new Date()): string {
  return cleDate(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
}

/**
 * Décale une date `YYYY-MM-DD` de `n` jours (n peut être négatif). Calcul en
 * UTC pour ne pas glisser d'un jour selon le fuseau.
 */
export function ajouterJours(dateISO: string, n: number): string {
  const [a, m, j] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

/**
 * Résout un jour/mois (sans année) en la date `YYYY-MM-DD` la plus proche
 * d'aujourd'hui. Une colle se saisit à quelques jours/semaines : « 3/1 » saisi
 * fin décembre doit tomber en janvier prochain, pas en janvier dernier.
 * Renvoie null si le jour/mois ne forme pas une date valide.
 */
export function dateDepuisJourMois(jour: number, mois: number, ref = new Date()): string | null {
  if (!Number.isInteger(jour) || !Number.isInteger(mois) || mois < 1 || mois > 12 || jour < 1 || jour > 31) {
    return null;
  }
  const refUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let meilleure: string | null = null;
  let meilleurEcart = Infinity;
  for (const annee of [ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1]) {
    const d = new Date(Date.UTC(annee, mois - 1, jour));
    if (d.getUTCMonth() + 1 !== mois || d.getUTCDate() !== jour) continue; // 31/02…
    const ecart = Math.abs(d.getTime() - refUTC);
    if (ecart < meilleurEcart) {
      meilleurEcart = ecart;
      meilleure = d.toISOString().slice(0, 10);
    }
  }
  return meilleure;
}
