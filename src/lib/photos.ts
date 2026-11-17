import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Photos des élèves.
 *
 * On stocke dans `eleves.photoUri` le NOM DE FICHIER (relatif), jamais le chemin
 * absolu : le dossier Documents change d'un build à l'autre (nouveau conteneur
 * applicatif), donc un chemin absolu deviendrait invalide au moindre changement
 * de version. Le nom est résolu en URI seulement au moment de l'affichage.
 *
 * Les photos sont redimensionnées à une taille d'avatar (JPEG ~512 px) dès la
 * capture : elles restent légères sur le disque ET dans la sauvegarde, où elles
 * sont embarquées en base64 (cf. `@/db/sauvegarde`) pour survivre à un transfert
 * entre appareils / installations (Expo Go → APK, par ex.).
 */

const SOUS_DOSSIER = 'photos-eleves';
const LARGEUR_MAX = 512;

function dossierPhotos(): Directory {
  const dossier = new Directory(Paths.document, SOUS_DOSSIER);
  dossier.create({ intermediates: true, idempotent: true });
  return dossier;
}

function fichierPhoto(nomFichier: string): File {
  return new File(Paths.document, SOUS_DOSSIER, nomFichier);
}

/** URI affichable d'une photo, ou `null` si le nom est vide ou le fichier absent. */
export function uriPhotoEleve(nomFichier: string | null | undefined): string | null {
  if (!nomFichier) return null;
  const fichier = fichierPhoto(nomFichier);
  return fichier.exists ? fichier.uri : null;
}

/**
 * Redimensionne l'image choisie (max 512 px, JPEG compressé), l'enregistre dans
 * le sandbox de l'appli et renvoie son nom de fichier. `largeurSource` évite
 * d'agrandir une image déjà plus petite que la cible.
 */
export async function enregistrerPhotoEleve(
  eleveId: number,
  sourceUri: string,
  largeurSource?: number,
): Promise<string> {
  const cible = Math.min(LARGEUR_MAX, largeurSource ?? LARGEUR_MAX);
  const contexte = ImageManipulator.manipulate(sourceUri);
  contexte.resize({ width: cible });
  const rendu = await contexte.renderAsync();
  const image = await rendu.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });

  const nom = `eleve-${eleveId}-${Date.now()}.jpg`;
  const dest = new File(dossierPhotos(), nom);
  if (dest.exists) dest.delete();
  new File(image.uri).copy(dest);
  return nom;
}

/** Supprime le fichier photo s'il existe (best-effort : une absence n'est pas une erreur). */
export function supprimerPhotoEleve(nomFichier: string | null | undefined): void {
  if (!nomFichier) return;
  const fichier = fichierPhoto(nomFichier);
  if (!fichier.exists) return;
  try {
    fichier.delete();
  } catch {
    // fichier déjà supprimé ou inaccessible : sans conséquence
  }
}

/** Contenu base64 d'une photo (pour l'export), ou `null` si le fichier est absent. */
export function lirePhotoBase64(nomFichier: string): string | null {
  const fichier = fichierPhoto(nomFichier);
  return fichier.exists ? fichier.base64Sync() : null;
}

/** (Ré)écrit une photo depuis son base64 (pour la restauration). */
export function ecrirePhotoBase64(nomFichier: string, base64: string): void {
  const fichier = new File(dossierPhotos(), nomFichier);
  if (fichier.exists) fichier.delete();
  fichier.create();
  fichier.write(base64, { encoding: 'base64' });
}

/** Efface toutes les photos : la restauration remplace l'intégralité des données. */
export function viderPhotosEleves(): void {
  const dossier = new Directory(Paths.document, SOUS_DOSSIER);
  if (dossier.exists) dossier.delete();
}
