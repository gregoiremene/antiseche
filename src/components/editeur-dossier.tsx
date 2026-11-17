import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarEleve } from '@/components/avatar-eleve';
import { ModaleCentree } from '@/components/modale-centree';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { AMENAGEMENTS_COURANTS } from '@/constants/amenagements';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { definirPhotoEleve, mettreAJourDossier } from '@/db/eleves';
import { enregistrerPhotoEleve, supprimerPhotoEleve, uriPhotoEleve } from '@/lib/photos';

type Props = {
  visible: boolean;
  eleveId: number;
  nomComplet: string;
  photoUri: string | null;
  amenagements: string[];
  infos: string | null;
  mailsParents: string | null;
  onFermer: () => void;
};

/** Deux premières lettres pour l'avatar de repli, depuis "Prénom NOM". */
function initialesDe(nomComplet: string): string {
  return nomComplet
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toLocaleUpperCase('fr-FR') ?? '')
    .join('');
}

/**
 * Édition du dossier d'un élève : aménagements (tags) et notes libres.
 *
 * Les tags courants sont proposés en un tap, mais le champ libre reste ouvert :
 * aucune liste figée ne couvrira tous les cas réels d'un établissement.
 */
export function EditeurDossier({
  visible,
  eleveId,
  nomComplet,
  photoUri,
  amenagements,
  infos,
  mailsParents,
  onFermer,
}: Props) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  const [selection, setSelection] = useState<string[]>(amenagements);
  const [texte, setTexte] = useState(infos ?? '');
  const [mails, setMails] = useState(mailsParents ?? '');
  const [nouveauTag, setNouveauTag] = useState('');
  // La photo est un fichier : on l'applique immédiatement (hors bouton
  // « Enregistrer », qui ne concerne que les champs texte), d'où un état local.
  const [photo, setPhoto] = useState<string | null>(photoUri);
  // aperçu plein écran de la photo (tap sur l'avatar quand une photo existe)
  const [apercuOuvert, setApercuOuvert] = useState(false);
  // menu de choix de la photo (caméra / galerie / supprimer)
  const [menuOuvert, setMenuOuvert] = useState(false);

  // resynchronise à l'ouverture : le composant reste monté entre deux fiches
  useEffect(() => {
    if (visible) {
      setSelection(amenagements);
      setTexte(infos ?? '');
      setMails(mailsParents ?? '');
      setNouveauTag('');
      setPhoto(photoUri);
      setApercuOuvert(false);
      setMenuOuvert(false);
    }
  }, [visible, amenagements, infos, mailsParents, photoUri]);

  async function choisirPhoto(source: 'camera' | 'galerie') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Autorisation refusée',
        source === 'camera'
          ? 'Autorise l’accès à l’appareil photo dans les réglages du téléphone.'
          : 'Autorise l’accès aux photos dans les réglages du téléphone.',
      );
      return;
    }

    const options = { mediaTypes: ['images'] as ['images'], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.6 };
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled) return;

    const ancien = photo;
    const nom = await enregistrerPhotoEleve(eleveId, res.assets[0].uri, res.assets[0].width);
    await definirPhotoEleve(eleveId, nom);
    if (ancien && ancien !== nom) supprimerPhotoEleve(ancien);
    setPhoto(nom);
  }

  async function retirerPhoto() {
    const ancien = photo;
    await definirPhotoEleve(eleveId, null);
    supprimerPhotoEleve(ancien);
    setPhoto(null);
  }

  // Menu de choix maison plutôt qu'`Alert.alert` : sous Android un Alert à plus
  // de 3 boutons perd le « Annuler » et devient impossible à fermer.
  function lancer(action: () => void) {
    setMenuOuvert(false);
    action();
  }

  function basculerTag(tag: string) {
    setSelection((s) => (s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]));
  }

  function ajouterTagLibre() {
    const propre = nouveauTag.trim();
    if (!propre || selection.includes(propre)) {
      setNouveauTag('');
      return;
    }
    setSelection((s) => [...s, propre]);
    setNouveauTag('');
  }

  async function enregistrer() {
    await mettreAJourDossier(eleveId, selection, texte, mails);
    onFermer();
  }

  // tags personnalisés déjà posés, absents de la liste courante
  const tagsPersonnalises = selection.filter(
    (t) => !AMENAGEMENTS_COURANTS.includes(t as (typeof AMENAGEMENTS_COURANTS)[number]),
  );

  return (
    <ModaleCentree visible={visible} onClose={onFermer}>
      <ThemedText type="subtitle">Dossier</ThemedText>
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        {nomComplet}
      </ThemedText>

      <View style={styles.lignePhoto}>
        {/* tap sur l'avatar : agrandit la photo si elle existe, sinon propose
            d'en ajouter une — le menu d'action reste sur le bouton dédié */}
        <Pressable onPress={() => (photo ? setApercuOuvert(true) : setMenuOuvert(true))}>
          <AvatarEleve photoUri={photo} initiales={initialesDe(nomComplet)} taille={64} couleur={c.backgroundSelected} />
        </Pressable>
        <Pressable onPress={() => setMenuOuvert(true)} style={[styles.boutonPhoto, { borderColor: c.border }]}>
          <ThemedText type="small">{photo ? 'Modifier la photo' : 'Ajouter une photo'}</ThemedText>
        </Pressable>
      </View>

      <ThemedText style={styles.section}>Aménagements</ThemedText>
      <View style={styles.tags}>
        {AMENAGEMENTS_COURANTS.map((tag) => {
          const actif = selection.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => basculerTag(tag)}
              style={[
                styles.tag,
                {
                  backgroundColor: actif ? c.text : 'transparent',
                  borderColor: actif ? c.text : c.border,
                },
              ]}>
              <ThemedText type="small" style={{ color: actif ? c.background : c.text }}>
                {tag}
              </ThemedText>
            </Pressable>
          );
        })}

        {tagsPersonnalises.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => basculerTag(tag)}
            style={[styles.tag, { backgroundColor: c.text, borderColor: c.text }]}>
            <ThemedText type="small" style={{ color: c.background }}>
              {tag} ✕
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.ligneAjout}>
        <TextInput
          value={nouveauTag}
          onChangeText={setNouveauTag}
          placeholder="Autre aménagement…"
          placeholderTextColor={c.textSecondary}
          returnKeyType="done"
          onSubmitEditing={ajouterTagLibre}
          style={[styles.champ, { flex: 1, color: c.text, borderColor: c.border }]}
        />
        <Pressable
          onPress={ajouterTagLibre}
          style={[styles.boutonAjout, { backgroundColor: c.backgroundSelected }]}>
          <ThemedText>+</ThemedText>
        </Pressable>
      </View>

      <ThemedText style={styles.section}>Mail(s) des parents</ThemedText>
      <TextInput
        value={mails}
        onChangeText={setMails}
        placeholder="parent1@mail.com, parent2@mail.com"
        placeholderTextColor={c.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.champ, { color: c.text, borderColor: c.border }]}
      />
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        Séparés par des virgules. Servent à pré-remplir le mail lors d’une colle.
      </ThemedText>

      <ThemedText style={styles.section}>Notes</ThemedText>
      <TextInput
        value={texte}
        onChangeText={setTexte}
        placeholder="Suivi, contacts famille, points d’attention…"
        placeholderTextColor={c.textSecondary}
        multiline
        style={[styles.champ, styles.champLong, { color: c.text, borderColor: c.border }]}
      />

      <PressableScale onPress={enregistrer} style={[styles.bouton, { backgroundColor: c.accent }]}>
        <ThemedText style={[styles.boutonTexte, { color: c.accentText }]}>Enregistrer</ThemedText>
      </PressableScale>

      {/* Menu de choix de la photo : se ferme au retour Android (onRequestClose)
          et au tap sur le fond. Le tap sur la carte est absorbé (onPress vide)
          pour ne pas fermer le menu. */}
      <Modal visible={menuOuvert} transparent animationType="fade" onRequestClose={() => setMenuOuvert(false)}>
        <Pressable style={styles.menuFond} onPress={() => setMenuOuvert(false)}>
          <Pressable
            style={[styles.menuCarte, { backgroundColor: c.backgroundElement, borderColor: c.border, paddingBottom: insets.bottom + Spacing.two }]}
            onPress={() => {}}>
            <ThemedText type="small" style={[styles.menuTitre, { color: c.textSecondary }]}>
              Photo de l’élève
            </ThemedText>
            <Pressable onPress={() => lancer(() => choisirPhoto('camera'))} style={styles.menuItem}>
              <ThemedText>Prendre une photo</ThemedText>
            </Pressable>
            <Pressable onPress={() => lancer(() => choisirPhoto('galerie'))} style={[styles.menuItem, styles.menuSep, { borderTopColor: c.border }]}>
              <ThemedText>Choisir dans la galerie</ThemedText>
            </Pressable>
            {photo && (
              <Pressable onPress={() => lancer(retirerPhoto)} style={[styles.menuItem, styles.menuSep, { borderTopColor: c.border }]}>
                <ThemedText style={{ color: '#E5484D' }}>Supprimer la photo</ThemedText>
              </Pressable>
            )}
            <Pressable onPress={() => setMenuOuvert(false)} style={[styles.menuItem, styles.menuSep, { borderTopColor: c.border }]}>
              <ThemedText style={{ color: c.textSecondary }}>Annuler</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Aperçu plein écran : se ferme au retour Android (onRequestClose) et au
          tap n'importe où (le fond couvre tout l'écran). */}
      <Modal
        visible={apercuOuvert && !!photo}
        transparent
        animationType="fade"
        onRequestClose={() => setApercuOuvert(false)}>
        <Pressable style={styles.apercuFond} onPress={() => setApercuOuvert(false)}>
          {photo && (
            <Image source={{ uri: uriPhotoEleve(photo) ?? '' }} style={styles.apercuImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </ModaleCentree>
  );
}

const styles = StyleSheet.create({
  lignePhoto: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  boutonPhoto: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  apercuFond: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  apercuImage: { width: '100%', height: '100%' },
  menuFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuCarte: {
    borderTopLeftRadius: Radius.l,
    borderTopRightRadius: Radius.l,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  menuTitre: { textAlign: 'center', paddingVertical: Spacing.two },
  menuItem: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, alignItems: 'center' },
  menuSep: { borderTopWidth: StyleSheet.hairlineWidth },
  section: { fontSize: 15, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tag: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  ligneAjout: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  champ: {
    borderWidth: 1,
    borderRadius: Radius.s,
    padding: Spacing.three,
    fontSize: 16,
  },
  champLong: { minHeight: 110, textAlignVertical: 'top' },
  boutonAjout: {
    width: 46,
    height: 46,
    borderRadius: Radius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bouton: {
    padding: Spacing.three,
    borderRadius: Radius.s,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  boutonTexte: { fontSize: 15, fontWeight: '600' },
});
