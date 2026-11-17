/**
 * Génération des textes d'une colle : le motif (résumé des observations) et le
 * mail aux parents. Fonctions pures, sans accès base ni React.
 */

import { formatJourCourt } from './calendrier';
import { formatHeure } from './semaine-ab';
import { formatDateCourte } from './trimestre';

/**
 * type accepte n'importe quelle observation : seuls exo/matériel sont traités,
 * les autres sont ignorés. Ça évite d'avoir à filtrer/caster au point d'appel.
 */
export type ObsPourMotif = { type: string; date: string };

const LIBELLES = {
  exo_non_fait: { sing: 'exercice non fait', plur: 'exercices non faits' },
  materiel_oublie: { sing: 'oubli de matériel', plur: 'oublis de matériel' },
} as const;

/**
 * Motif synthétique à partir des observations cochées.
 * Ex. « 4 exercices non faits (3, 5, 12 et 18 nov.) + 2 oublis de matériel ».
 */
export function genererMotif(observations: ObsPourMotif[]): string {
  const parType = new Map<ObsPourMotif['type'], string[]>();
  for (const o of observations) {
    const dates = parType.get(o.type) ?? [];
    dates.push(o.date);
    parType.set(o.type, dates);
  }

  const morceaux: string[] = [];
  // ordre stable : exos d'abord, puis matériel
  for (const type of ['exo_non_fait', 'materiel_oublie'] as const) {
    const dates = parType.get(type);
    if (!dates || dates.length === 0) continue;
    const lib = LIBELLES[type];
    const nom = dates.length > 1 ? lib.plur : lib.sing;
    morceaux.push(`${dates.length} ${nom} (${formatDates(dates)})`);
  }

  return morceaux.join(' + ');
}

/**
 * Liste de dates compacte. Si toutes tombent le même mois, on ne l'écrit
 * qu'une fois : « 3, 5 et 18 nov. ». Sinon, chaque date porte son mois.
 */
function formatDates(dates: string[]): string {
  const triees = dates.slice().sort();
  const memeMois = new Set(triees.map((d) => d.slice(0, 7))).size === 1;
  if (memeMois) {
    const jours = triees.map((d) => String(Number(d.slice(8, 10))));
    const mois = formatDateCourte(triees[0]).split(' ').slice(1).join(' ');
    return `${enumererFr(jours)} ${mois}`;
  }
  return enumererFr(triees.map(formatDateCourte));
}

/** "a, b et c" — énumération à la française. */
function enumererFr(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Objet et corps du mail aux parents pour une colle. */
export function genererMailColle(params: {
  prenom: string;
  nom: string;
  classe: string;
  date: string;
  motif: string;
  heureDebut?: string | null;
  heureFin?: string | null;
}): { objet: string; corps: string } {
  const { prenom, nom, classe, date, motif, heureDebut, heureFin } = params;
  const eleve = `${prenom} ${nom.toLocaleUpperCase('fr-FR')}`;
  const creneau = heureDebut && heureFin ? ` de ${formatHeure(heureDebut)} à ${formatHeure(heureFin)}` : '';
  const objet = `Retenue de ${eleve} (${classe}) le ${formatJourCourt(date)}`;
  const corps = [
    'Bonjour,',
    '',
    `Je vous informe que ${eleve} est en retenue le ${formatJourCourt(date)}${creneau}.`,
    motif ? `Motif : ${motif}.` : '',
    '',
    'Cordialement,',
  ]
    .filter((ligne, i, arr) => !(ligne === '' && arr[i - 1] === ''))
    .join('\n');

  return { objet, corps };
}

/** Construit l'URL mailto complète, destinataires + objet + corps encodés. */
export function construireMailto(
  mailsParents: string | null,
  objet: string,
  corps: string,
): string {
  // les emails ne sont pas encodés : « @ » et « . » sont valides tels quels
  // dans un mailto, et les encoder casse certains clients mail.
  const destinataires = (mailsParents ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
    .join(',');
  const params = `subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
  return `mailto:${destinataires}?${params}`;
}
