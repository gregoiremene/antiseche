import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Stack, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  analyserSauvegarde,
  construireSauvegarde,
  resumerSauvegarde,
  restaurerSauvegarde,
  SauvegardeInvalide,
  serialiserSauvegarde,
  type Sauvegarde,
} from '@/db/sauvegarde';
import { aujourdhuiISO } from '@/lib/calendrier';

/**
 * Écrit une sauvegarde dans un fichier temporaire et ouvre la feuille de
 * partage pour que l'utilisateur la range où il veut (Fichiers, mail, Drive…).
 * On passe par le cache : le fichier ne sert qu'à alimenter le partage.
 */
async function partagerSauvegarde(sauvegarde: Sauvegarde, nomFichier: string, titre: string) {
  const fichier = new File(Paths.cache, nomFichier);
  if (fichier.exists) fichier.delete();
  fichier.create();
  fichier.write(serialiserSauvegarde(sauvegarde));

  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Partage indisponible', `Le fichier a été créé mais ne peut pas être partagé ici.`);
    return;
  }
  await Sharing.shareAsync(fichier.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: titre,
  });
}

export default function EcranSauvegarde() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [occupe, setOccupe] = useState<null | 'export' | 'import'>(null);

  async function exporter() {
    setOccupe('export');
    try {
      const sauvegarde = await construireSauvegarde();
      await partagerSauvegarde(sauvegarde, `antiseche-${aujourdhuiISO()}.json`, 'Exporter mes données');
    } catch (e) {
      Alert.alert('Export impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(null);
    }
  }

  /** Garde-fou + restauration effective, une fois la confirmation obtenue. */
  async function lancerRestauration(sauvegarde: Sauvegarde) {
    setOccupe('import');
    try {
      // Garde-fou : on sauvegarde d'abord l'état actuel (l'utilisateur le range
      // via la feuille de partage) avant de l'écraser.
      const secours = await construireSauvegarde();
      await partagerSauvegarde(
        secours,
        `antiseche-avant-restauration-${aujourdhuiISO()}.json`,
        'Sauvegarde de sécurité (avant restauration)',
      );

      await restaurerSauvegarde(sauvegarde);
      Alert.alert('Restauration terminée', 'Tes données ont été remplacées par la sauvegarde.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Restauration impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(null);
    }
  }

  async function importer() {
    setOccupe('import');
    try {
      const choix = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (choix.canceled) return;

      const texte = await new File(choix.assets[0].uri).text();
      const sauvegarde = analyserSauvegarde(texte);
      const r = resumerSauvegarde(sauvegarde);

      Alert.alert(
        'Restaurer cette sauvegarde ?',
        `Elle contient ${r.classes} classe(s), ${r.eleves} élève(s), ${r.evaluations} éval(s) et ${r.notes} note(s).\n\n` +
          'Toutes tes données actuelles seront remplacées. On te proposera d’abord d’enregistrer une sauvegarde de secours.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Remplacer', style: 'destructive', onPress: () => lancerRestauration(sauvegarde) },
        ],
      );
    } catch (e) {
      const message =
        e instanceof SauvegardeInvalide
          ? e.message
          : 'Impossible de lire ce fichier. Choisis un fichier de sauvegarde Antisèche (.json).';
      Alert.alert('Fichier invalide', message);
    } finally {
      // l'état 'import' est repris par lancerRestauration si l'utilisateur confirme
      setOccupe((prev) => (prev === 'import' ? null : prev));
    }
  }

  return (
    <ThemedView style={styles.page}>
      <Stack.Screen options={{ title: 'Sauvegarde' }} />

      <View style={[styles.contenu, { paddingBottom: insets.bottom + Spacing.four }]}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          Tes données sont stockées uniquement sur ce téléphone. Exporte-les
          régulièrement pour ne rien perdre lors d’un changement d’appareil ou de
          version, et restaure-les au besoin.
        </ThemedText>

        <View style={[styles.bloc, { backgroundColor: c.backgroundElement }]}>
          <ThemedText style={styles.titreBloc}>Exporter</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Crée un fichier de sauvegarde de toutes tes classes, élèves, notes,
            observations, colles et emplois du temps.
          </ThemedText>
          <PressableScale
            onPress={exporter}
            disabled={occupe !== null}
            style={[styles.bouton, { backgroundColor: c.accent, opacity: occupe ? 0.5 : 1 }]}>
            {occupe === 'export' ? (
              <ActivityIndicator color={c.accentText} />
            ) : (
              <ThemedText style={[styles.boutonTexte, { color: c.accentText }]}>
                Exporter mes données
              </ThemedText>
            )}
          </PressableScale>
        </View>

        <View style={[styles.bloc, { backgroundColor: c.backgroundElement }]}>
          <ThemedText style={styles.titreBloc}>Restaurer</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Remplace toutes les données actuelles par celles d’un fichier de
            sauvegarde. Une sauvegarde de secours de l’état actuel te sera
            proposée avant.
          </ThemedText>
          <PressableScale
            onPress={importer}
            disabled={occupe !== null}
            style={[styles.bouton, styles.boutonSecondaire, { borderColor: c.border, opacity: occupe ? 0.5 : 1 }]}>
            {occupe === 'import' ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <ThemedText style={[styles.boutonTexte, { color: c.text }]}>
                Importer une sauvegarde
              </ThemedText>
            )}
          </PressableScale>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { padding: Spacing.three, gap: Spacing.three },
  bloc: { borderRadius: Radius.m, padding: Spacing.three, gap: Spacing.two },
  titreBloc: { fontSize: 17, fontWeight: '700' },
  bouton: { padding: Spacing.three, borderRadius: Radius.s, alignItems: 'center', marginTop: Spacing.one },
  boutonSecondaire: { backgroundColor: 'transparent', borderWidth: 1 },
  boutonTexte: { fontSize: 15, fontWeight: '600' },
});
