/**
 * Notifications locales des colles (hors ligne, sans serveur) :
 *   - un digest le soir à 19h tant qu'il reste des étapes à traiter (une seule
 *     notif, pas une par étape) ;
 *   - un rappel le lendemain de chaque colle datée pour la pointer (« faite ? »).
 *
 * On (re)programme tout d'un bloc : on annule les notifs existantes puis on les
 * recrée depuis l'état courant des colles. C'est idempotent, donc appelable à
 * volonté (démarrage, retour au premier plan, modif d'une colle).
 *
 * Local uniquement : fonctionne dans Expo Go ; seul le push distant exigerait
 * un dev build. Android 13+ demande la permission POST_NOTIFICATIONS.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { selectCollesDetaillees } from '@/db/colles';
import { aujourdhuiISO } from '@/lib/calendrier';

const CANAL_ANDROID = 'colles';
const HEURE_DIGEST = 19; // 19h
const HEURE_RAPPEL = 9; // rappel de vérification à 9h le lendemain

// Bannière visible même app au premier plan (sinon on ne verrait rien en test).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Demande la permission (et crée le canal Android). Renvoie true si accordée. */
export async function demanderPermissionNotifs(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
      name: 'Colles',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const actuelle = await Notifications.getPermissionsAsync();
  if (actuelle.granted) return true;
  const demande = await Notifications.requestPermissionsAsync();
  return demande.granted;
}

/** Prochaine occurrence de `heure:00` en heure locale (aujourd'hui ou demain). */
function prochaineHeure(heure: number): Date {
  const d = new Date();
  d.setHours(heure, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/** Lendemain d'une date `YYYY-MM-DD` à `heure:00`, en heure locale. */
function lendemainA(dateISO: string, heure: number): Date {
  const [a, m, j] = dateISO.split('-').map(Number);
  return new Date(a, m - 1, j + 1, heure, 0, 0, 0);
}

/**
 * Annule puis reprogramme toutes les notifs de colles depuis l'état courant.
 * Ne fait rien si la permission n'est pas accordée.
 */
export async function reprogrammerNotifications(): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const colles = await selectCollesDetaillees();
  const jourJ = aujourdhuiISO();

  // --- Digest du soir : compte les étapes en attente ---
  let aPoser = 0;
  let aPrevenir = 0;
  let aVerifier = 0;
  for (const c of colles) {
    if (c.statut !== 'a_faire' || !c.date) continue;
    if (c.date < jourJ) {
      aVerifier++;
    } else {
      if (!c.poseePronote) aPoser++;
      if (c.mailsParents && !c.parentsPrevenus) aPrevenir++;
    }
  }
  const morceaux: string[] = [];
  if (aPoser) morceaux.push(`${aPoser} à poser sur Pronote`);
  if (aPrevenir) morceaux.push(`${aPrevenir} parent${aPrevenir > 1 ? 's' : ''} à prévenir`);
  if (aVerifier) morceaux.push(`${aVerifier} à vérifier`);
  if (morceaux.length > 0) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Colles à traiter', body: `${morceaux.join(', ')}.` },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: prochaineHeure(HEURE_DIGEST),
        channelId: CANAL_ANDROID,
      },
    });
  }

  // --- Rappel de vérification le lendemain de chaque colle datée ---
  for (const c of colles) {
    if (c.statut !== 'a_faire' || !c.date) continue;
    const quand = lendemainA(c.date, HEURE_RAPPEL);
    if (quand.getTime() <= Date.now()) continue; // colle déjà passée : gérée par le digest
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Colle à vérifier',
        body: `${c.prenom} : la retenue d’hier a-t-elle été faite ?`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: quand,
        channelId: CANAL_ANDROID,
      },
    });
  }
}

/**
 * Notif de test : s'affiche dans ~5 s pour vérifier sur l'appareil que les
 * notifications locales fonctionnent (utile car le digest/les rappels sont
 * calés sur des heures fixes, donc pas observables sur le moment). Renvoie
 * false si la permission est refusée.
 */
export async function envoyerNotifTest(): Promise<boolean> {
  const ok = await demanderPermissionNotifs();
  if (!ok) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Test ✅', body: 'Si tu vois ceci, les notifications locales marchent.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: CANAL_ANDROID,
    },
  });
  return true;
}
