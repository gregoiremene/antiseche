import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { uriPhotoEleve } from '@/lib/photos';

/**
 * Avatar d'un élève : sa photo si elle existe, sinon ses initiales sur un fond
 * coloré. Réutilisé sur la fiche, le trombinoscope et l'éditeur de dossier —
 * pour que l'affichage (et le repli quand la photo manque) reste cohérent.
 */
export function AvatarEleve({
  photoUri,
  initiales,
  taille,
  couleur,
}: {
  photoUri: string | null | undefined;
  initiales: string;
  taille: number;
  couleur: string;
}) {
  const uri = uriPhotoEleve(photoUri);
  const forme = { width: taille, height: taille, borderRadius: taille / 2 };

  if (uri) {
    return <Image source={{ uri }} style={forme} />;
  }
  return (
    <View style={[forme, styles.repli, { backgroundColor: couleur }]}>
      <ThemedText style={[styles.initiales, { fontSize: Math.round(taille * 0.36) }]}>
        {initiales}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  repli: { alignItems: 'center', justifyContent: 'center' },
  initiales: { color: '#fff', fontWeight: '700' },
});
