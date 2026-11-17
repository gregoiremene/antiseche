/**
 * Palette pour colorer les matières (et réutilisable ailleurs). Teintes assez
 * saturées pour se distinguer dans la grille d'emploi du temps, sur fond clair
 * comme sombre.
 */
export const PALETTE = [
  '#175895', // bleu
  '#ff686d', // rouge
  '#12623c', // vert
  '#ff995a', // orange
  '#b786e2', // violet
  '#34ccd7', // cyan
  '#cf6dab', // rose
  '#ffe081', // jaune
  '#646b76', // gris ardoise
  '#c1a28e', // brun
] as const;

/**
 * Couleur de texte lisible sur une pastille : foncé sur les teintes claires,
 * blanc sur les foncées. Basé sur la luminance perçue, donc valable pour
 * n'importe quelle couleur de la palette (seuil empirique ~155).
 */
export function texteSurCouleur(couleur: string): string {
  const hex = couleur.replace('#', '');
  if (hex.length < 6) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 155 ? '#18181B' : '#FFFFFF';
}
