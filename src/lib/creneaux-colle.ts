/**
 * Recherche des créneaux possibles pour une colle. Fonction pure : aucune
 * dépendance à React ni à la base — on lui passe l'EDT complet de l'année et
 * elle rend les créneaux triés.
 *
 * Règle : c'est le trou de l'ÉLÈVE qui décide. Quand sa classe X n'a pas cours
 * (dans l'enveloppe horaire réelle de la journée), le créneau est classé selon
 * ce que fait le prof à ce moment :
 *   - prof libre            → 🏫 surveillance vie scolaire (permanence)
 *   - prof en cours avec Y≠X → 👥 l'élève est reçu dans la salle du prof
 *
 * Demi-groupes : seuls les cours de X qui concernent l'élève (toute la classe,
 * ou SON groupe) l'occupent. Un cours réservé à l'autre groupe le laisse libre.
 */

import type { GroupeEdt, SemaineEdt, Surveillance } from '@/db/schema';
import { ajouterJours } from './calendrier';
import {
  coursActifCetteSemaine,
  heureEnMinutes,
  jourSemaine,
  typeSemaine,
  type AncreSemaine,
} from './semaine-ab';

export type CoursPourCreneau = {
  classeId: number;
  classeNom: string;
  jour: number; // 1 = lundi … 6 = samedi
  heureDebut: string; // "HH:MM"
  heureFin: string;
  semaine: SemaineEdt;
  groupe: GroupeEdt;
  estMonCours: boolean;
};

export type Creneau = {
  date: string; // "YYYY-MM-DD"
  jour: number;
  heureDebut: string; // "HH:MM"
  heureFin: string;
  dureeMin: number;
  surveillance: Surveillance;
  /** pour 'ma_salle' : la classe avec qui je suis à ce moment */
  classe: string | null;
};

type Intervalle = { debut: number; fin: number };

// une journée d'école s'étend de 8h à 18h (élargie si un cours déborde)
const DEBUT_JOURNEE = 8 * 60;
const FIN_JOURNEE = 18 * 60;
const PAS_CRENEAU = 60; // on propose des créneaux d'1h plutôt qu'une fenêtre entière

/** minutes depuis minuit -> "HH:MM" zéro-paddé */
function minutesEnHeure(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Fusionne les intervalles qui se chevauchent ou se touchent. */
function fusionner(intervalles: Intervalle[]): Intervalle[] {
  const tri = [...intervalles].sort((a, b) => a.debut - b.debut);
  const out: Intervalle[] = [];
  for (const it of tri) {
    const dernier = out[out.length - 1];
    if (dernier && it.debut <= dernier.fin) dernier.fin = Math.max(dernier.fin, it.fin);
    else out.push({ ...it });
  }
  return out;
}

/** Parties de `base` non couvertes par `occupe` (les trous). */
function soustraire(base: Intervalle, occupe: Intervalle[]): Intervalle[] {
  const libres: Intervalle[] = [];
  let curseur = base.debut;
  for (const o of fusionner(occupe)) {
    if (o.fin <= base.debut || o.debut >= base.fin) continue;
    const debut = Math.max(o.debut, base.debut);
    if (debut > curseur) libres.push({ debut: curseur, fin: debut });
    curseur = Math.max(curseur, Math.min(o.fin, base.fin));
  }
  if (curseur < base.fin) libres.push({ debut: curseur, fin: base.fin });
  return libres;
}

export function trouverCreneaux(params: {
  /** classe de l'élève à coller */
  classeXId: number;
  /** demi-groupe de l'élève dans sa classe (1 ou 2) */
  groupeEleve: 1 | 2;
  /** EDT complet de l'année (toutes les classes) */
  cours: CoursPourCreneau[];
  ancre: AncreSemaine;
  aujourdISO: string;
  /** nombre de jours explorés à partir de demain (défaut 14) */
  horizonJours?: number;
  /** durée minimale d'un créneau retenu, en minutes (défaut 30) */
  dureeMinMin?: number;
}): Creneau[] {
  const { classeXId, groupeEleve, cours, ancre, aujourdISO, horizonJours = 14, dureeMinMin = 30 } = params;
  const groupeDeLEleve: GroupeEdt = groupeEleve === 1 ? 'g1' : 'g2';
  /** un cours de la classe X occupe-t-il CET élève (toute la classe, ou son groupe) ? */
  const occupeLEleve = (co: CoursPourCreneau) =>
    co.groupe === 'classe' || co.groupe === groupeDeLEleve;
  const creneaux: Creneau[] = [];

  for (let d = 1; d <= horizonJours; d++) {
    const date = ajouterJours(aujourdISO, d);
    const jour = jourSemaine(date);
    if (jour > 6) continue; // dimanche : pas de cours modélisés

    const w = typeSemaine(date, ancre);
    const actifs = cours.filter((co) => co.jour === jour && coursActifCetteSemaine(co.semaine, w));
    if (actifs.length === 0) continue; // journée sans cours connu → rien à proposer

    // enveloppe : la journée 8h–18h, élargie si un cours commence avant / finit après
    const enveloppe: Intervalle = {
      debut: Math.min(DEBUT_JOURNEE, ...actifs.map((co) => heureEnMinutes(co.heureDebut))),
      fin: Math.max(FIN_JOURNEE, ...actifs.map((co) => heureEnMinutes(co.heureFin))),
    };

    // heures où la classe X a cours POUR CET ÉLÈVE → il n'est pas libre
    // (un cours réservé à l'autre demi-groupe ne le bloque pas)
    const xOccupee = actifs
      .filter((co) => co.classeId === classeXId && occupeLEleve(co))
      .map((co) => ({ debut: heureEnMinutes(co.heureDebut), fin: heureEnMinutes(co.heureFin) }));

    const fenetresLibres = soustraire(enveloppe, xOccupee);

    // mes cours du jour (avec quelle classe) — servent à classer les fenêtres
    const mesCours = actifs
      .filter((co) => co.estMonCours)
      .map((co) => ({
        debut: heureEnMinutes(co.heureDebut),
        fin: heureEnMinutes(co.heureFin),
        classe: co.classeNom,
      }));

    for (const fen of fenetresLibres) {
      // mes cours qui tombent DANS cette fenêtre (donc avec une classe ≠ X,
      // puisque les cours de X sont déjà exclus des fenêtres libres)
      const dedans = mesCours
        .map((mc) => ({ debut: Math.max(mc.debut, fen.debut), fin: Math.min(mc.fin, fen.fin), classe: mc.classe }))
        .filter((mc) => mc.fin > mc.debut)
        .sort((a, b) => a.debut - b.debut);

      const segments: { debut: number; fin: number; surveillance: Surveillance; classe: string | null }[] = [];
      let curseur = fen.debut;
      for (const mc of dedans) {
        const debut = Math.max(mc.debut, curseur);
        if (debut >= mc.fin) continue;
        if (debut > curseur) segments.push({ debut: curseur, fin: debut, surveillance: 'vie_scolaire', classe: null });
        segments.push({ debut, fin: mc.fin, surveillance: 'ma_salle', classe: mc.classe });
        curseur = mc.fin;
      }
      if (curseur < fen.fin) segments.push({ debut: curseur, fin: fen.fin, surveillance: 'vie_scolaire', classe: null });

      // chaque segment est débité en tranches d'1h (la dernière peut être plus
      // courte) ; on garde le type de surveillance de la fenêtre pour chaque tranche
      for (const seg of segments) {
        for (let debut = seg.debut; debut < seg.fin; debut += PAS_CRENEAU) {
          const fin = Math.min(debut + PAS_CRENEAU, seg.fin);
          const dureeMin = fin - debut;
          if (dureeMin < dureeMinMin) continue;
          creneaux.push({
            date,
            jour,
            heureDebut: minutesEnHeure(debut),
            heureFin: minutesEnHeure(fin),
            dureeMin,
            surveillance: seg.surveillance,
            classe: seg.classe,
          });
        }
      }
    }
  }

  creneaux.sort((a, b) => (a.date === b.date ? a.heureDebut.localeCompare(b.heureDebut) : a.date.localeCompare(b.date)));
  return creneaux;
}
