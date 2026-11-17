/**
 * Alternance des semaines A/B et manipulation des heures "HH:MM".
 * Fonctions pures : aucune dépendance à React ni à la base.
 *
 * Le type d'une semaine se déduit d'une ancre (un lundi connu + son type) par
 * parité du nombre de semaines écoulées. Les calculs passent par UTC pour ne
 * pas dériver d'un jour selon le fuseau (même précaution qu'ailleurs).
 */

export type TypeSemaine = 'A' | 'B';
export type AncreSemaine = { ancreLundi: string; ancreType: TypeSemaine };

const JOUR_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` -> instant UTC de minuit ce jour-là. */
function versUTC(dateISO: string): number {
  const [a, m, j] = dateISO.split('-').map(Number);
  return Date.UTC(a, m - 1, j);
}

/**
 * Lundi de la semaine contenant `dateISO`, au format `YYYY-MM-DD`.
 * getUTCDay : 0 = dimanche … 6 = samedi ; on recule jusqu'au lundi.
 */
export function lundiDeLaSemaine(dateISO: string): string {
  const t = versUTC(dateISO);
  const jour = new Date(t).getUTCDay(); // 0=dim … 6=sam
  const reculJours = (jour + 6) % 7; // lundi -> 0, dimanche -> 6
  return new Date(t - reculJours * JOUR_MS).toISOString().slice(0, 10);
}

/**
 * Jour de semaine ISO : 1 = lundi … 7 = dimanche. Notre EDT ne gère que 1–6
 * (lundi–samedi), mais on renvoie 7 pour dimanche afin que l'appelant décide.
 */
export function jourSemaine(dateISO: string): number {
  const jour = new Date(versUTC(dateISO)).getUTCDay();
  return jour === 0 ? 7 : jour;
}

/** Nombre de semaines entières entre deux lundis (peut être négatif). */
function semainesEntre(lundiA: string, lundiB: string): number {
  return Math.round((versUTC(lundiB) - versUTC(lundiA)) / (7 * JOUR_MS));
}

/**
 * Type de semaine (A ou B) d'une date donnée, selon l'ancre. Parité du nombre
 * de semaines depuis le lundi d'ancrage : pair -> même type que l'ancre.
 */
export function typeSemaine(dateISO: string, ancre: AncreSemaine): TypeSemaine {
  const ecart = semainesEntre(ancre.ancreLundi, lundiDeLaSemaine(dateISO));
  const pair = ((ecart % 2) + 2) % 2 === 0;
  return pair ? ancre.ancreType : autre(ancre.ancreType);
}

export function autre(type: TypeSemaine): TypeSemaine {
  return type === 'A' ? 'B' : 'A';
}

/**
 * Un cours de semaine `semaineCours` a-t-il lieu une semaine de type `type` ?
 * 'toutes' tombe toujours ; sinon il faut que les types coïncident.
 */
export function coursActifCetteSemaine(
  semaineCours: 'toutes' | TypeSemaine,
  type: TypeSemaine,
): boolean {
  return semaineCours === 'toutes' || semaineCours === type;
}

// --- Heures "HH:MM" -------------------------------------------------------

/**
 * Assemble une heure "HH:MM" zéro-paddée à partir d'heures/minutes, ou null si
 * les valeurs ne forment pas une heure valide (0–23 h, 0–59 min).
 */
export function construireHeure(heures: number, minutes: number): string | null {
  if (!Number.isInteger(heures) || !Number.isInteger(minutes)) return null;
  if (heures < 0 || heures > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** "HH:MM" -> minutes depuis minuit (pour les calculs de durée / chevauchement). */
export function heureEnMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** "08:00" -> "8h", "13:30" -> "13h30" — affichage à la française. */
export function formatHeure(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return Number(m) === 0 ? `${Number(h)}h` : `${Number(h)}h${m}`;
}
