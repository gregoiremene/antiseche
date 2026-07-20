import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Délai pendant lequel un retour dans l'appli ne redemande pas la biométrie.
 *
 * Compromis assumé : en cours on sort et on revient sans arrêt (Pronote, une
 * notification, l'heure). Reverrouiller à chaque aller-retour rendait l'appli
 * pénible, surtout avec un capteur d'empreinte capricieux. Au-delà de ce délai,
 * on redemande.
 */
const DELAI_GRACE_MS = 5 * 60 * 1000;

/**
 * Verrou désactivé en développement : recharger l'appli vingt fois par heure
 * avec une authentification à chaque fois est intenable.
 *
 * On s'appuie sur `__DEV__` plutôt que sur un booléen à basculer à la main :
 * un build de production réactive le verrou automatiquement, sans dépendre de
 * quelqu'un qui pense à remettre l'interrupteur.
 */
const VERROU_ACTIF = !__DEV__;

/**
 * Verrouille l'application derrière la biométrie (ou le code de l'appareil).
 *
 * L'appli contient des PAP, PAI et notes de dossier : ce sont des données de
 * santé. Un téléphone posé sur un bureau ne doit pas les exposer.
 *
 * Si l'appareil n'a ni biométrie ni code configuré, on laisse passer : mieux
 * vaut une appli utilisable qu'un prof enfermé dehors avec ses données.
 */
export function Verrou({ children }: { children: React.ReactNode }) {
  const [deverrouille, setDeverrouille] = useState(false);
  const [verrouillable, setVerrouillable] = useState<boolean | null>(null);
  const [echec, setEchec] = useState(false);
  const etatApp = useRef(AppState.currentState);
  /** instant du dernier passage en arrière-plan */
  const sortieA = useRef<number | null>(null);

  const authentifier = useCallback(async () => {
    setEchec(false);
    const resultat = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Déverrouiller Antisèche',
      cancelLabel: 'Annuler',
      // false = on autorise le repli sur le code de l'appareil
      disableDeviceFallback: false,
    });
    if (resultat.success) setDeverrouille(true);
    else setEchec(true);
  }, []);

  useEffect(() => {
    (async () => {
      if (!VERROU_ACTIF) {
        setVerrouillable(false);
        setDeverrouille(true);
        return;
      }
      const materiel = await LocalAuthentication.hasHardwareAsync();
      const configure = await LocalAuthentication.isEnrolledAsync();
      const possible = materiel && configure;
      setVerrouillable(possible);
      if (possible) authentifier();
      else setDeverrouille(true);
    })();
  }, [authentifier]);

  // reverrouille au retour, mais seulement après le délai de grâce
  useEffect(() => {
    const sub = AppState.addEventListener('change', (etat: AppStateStatus) => {
      const precedent = etatApp.current;
      etatApp.current = etat;
      if (!verrouillable) return;

      if (etat === 'background' || etat === 'inactive') {
        sortieA.current = Date.now();
        return;
      }

      if (etat === 'active' && precedent !== 'active') {
        const sorti = sortieA.current;
        // sorti === null : premier passage, l'authentification initiale gère
        if (sorti !== null && Date.now() - sorti > DELAI_GRACE_MS) {
          setDeverrouille(false);
          authentifier();
        }
      }
    });
    return () => sub.remove();
  }, [verrouillable, authentifier]);

  if (verrouillable === null) return <ThemedView style={styles.plein} />;
  if (deverrouille) return <>{children}</>;

  return (
    <ThemedView style={[styles.plein, styles.centre]}>
      <ThemedText type="title">🔒</ThemedText>
      <ThemedText type="subtitle">Antisèche</ThemedText>
      {echec && <ThemedText type="small">Authentification annulée</ThemedText>}
      <Pressable onPress={authentifier} style={styles.bouton}>
        <ThemedText type="smallBold">Déverrouiller</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  bouton: { padding: Spacing.three, marginTop: Spacing.three },
});
