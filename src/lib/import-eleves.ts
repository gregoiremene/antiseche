/**
 * Parsing d'une liste d'élèves collée depuis Pronote, un tableur ou un mail.
 * Fonction pure : c'est la partie qu'on veut pouvoir corriger sans lancer l'appli.
 */

export type EleveImporte = { nom: string; prenom: string };

const SEPARATEURS_COLONNE = /[\t;]/;

/** Un token est un nom de famille s'il est en capitales (DUPONT, LE GALL). */
function estCapitales(token: string): boolean {
  const lettres = token.replace(/[^\p{L}]/gu, '');
  return lettres.length > 0 && lettres === lettres.toLocaleUpperCase('fr-FR');
}

/** "jean-pierre" -> "Jean-Pierre", "DUPONT" -> "Dupont" */
function capitaliser(mot: string): string {
  return mot
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[-'’ ])(\p{L})/gu, (_, sep, lettre) => sep + lettre.toLocaleUpperCase('fr-FR'));
}

/** Ordre des mots quand aucune capitale ne permet de trancher. */
export type Convention = 'nom-prenom' | 'prenom-nom';

/**
 * Découpe une ligne en nom / prénom. Formats reconnus :
 *   "DUPONT Jean"        -> nom en capitales
 *   "Dupont, Jean"       -> séparé par une virgule
 *   "DUPONT<TAB>Jean"    -> colonnes d'un tableur
 *   "jean dupont"        -> ambigu : tranché par `convention`
 */
export function parseLigneEleve(
  ligne: string,
  convention: Convention = 'prenom-nom',
): EleveImporte | null {
  // on retire un éventuel numéro de liste en tête ("1. ", "12 - ")
  const propre = ligne.trim().replace(/^\d+\s*[.)\-–]?\s*/, '');
  if (!propre) return null;

  const colonnes = propre.split(SEPARATEURS_COLONNE).map((c) => c.trim()).filter(Boolean);
  if (colonnes.length >= 2) {
    return { nom: capitaliser(colonnes[0]), prenom: capitaliser(colonnes[1]) };
  }

  const virgule = propre.indexOf(',');
  if (virgule !== -1) {
    const nom = propre.slice(0, virgule).trim();
    const prenom = propre.slice(virgule + 1).trim();
    if (nom && prenom) return { nom: capitaliser(nom), prenom: capitaliser(prenom) };
  }

  const mots = propre.split(/\s+/).filter(Boolean);
  if (mots.length === 1) return { nom: capitaliser(mots[0]), prenom: '' };

  // "LE GALL Marie-Claire" : tous les mots en capitales forment le nom
  const nbCapitales = mots.findIndex((m) => !estCapitales(m));
  if (nbCapitales > 0) {
    return {
      nom: capitaliser(mots.slice(0, nbCapitales).join(' ')),
      prenom: capitaliser(mots.slice(nbCapitales).join(' ')),
    };
  }

  // aucune capitale distinctive : on suit la convention du bloc
  if (convention === 'nom-prenom') {
    return {
      nom: capitaliser(mots[0]),
      prenom: capitaliser(mots.slice(1).join(' ')),
    };
  }
  return {
    nom: capitaliser(mots.slice(1).join(' ')),
    prenom: capitaliser(mots[0]),
  };
}

/**
 * Devine la convention du bloc : si au moins une ligne porte un nom en
 * capitales, c'est que la liste est au format "NOM Prénom" et on l'applique
 * aussi aux lignes ambiguës. Sans ça, "DUPONT Jean" et "dupont jean" dans la
 * même liste produisent deux élèves différents.
 */
export function detecterConvention(texte: string): Convention {
  for (const ligne of texte.split(/\r?\n/)) {
    const mots = ligne.trim().replace(/^\d+\s*[.)\-–]?\s*/, '').split(/\s+/).filter(Boolean);
    if (mots.length >= 2 && estCapitales(mots[0]) && !estCapitales(mots[mots.length - 1])) {
      return 'nom-prenom';
    }
  }
  return 'prenom-nom';
}

/** Parse un bloc collé, ignore les lignes vides et les doublons. */
export function parseListeEleves(texte: string): EleveImporte[] {
  const convention = detecterConvention(texte);
  const vus = new Set<string>();
  const eleves: EleveImporte[] = [];

  for (const ligne of texte.split(/\r?\n/)) {
    const eleve = parseLigneEleve(ligne, convention);
    if (!eleve) continue;
    const cle = `${eleve.nom}|${eleve.prenom}`.toLocaleLowerCase('fr-FR');
    if (vus.has(cle)) continue;
    vus.add(cle);
    eleves.push(eleve);
  }

  return eleves;
}
