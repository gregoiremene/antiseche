import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

type Contexte = { visibles: boolean; basculer: () => void };

const AmenagementsContext = createContext<Contexte>({ visibles: false, basculer: () => {} });

/**
 * Contrôle l'affichage des badges d'aménagement dans les listes.
 *
 * Volontairement NON persisté, et remis à « masqué » dès que l'appli passe en
 * arrière-plan : ce sont des données de santé, et l'intérêt du réglage est
 * qu'il faille un geste délibéré pour les révéler. Une préférence sauvegardée
 * les rendrait visibles en permanence après un seul appui.
 */
export function AmenagementsProvider({ children }: { children: React.ReactNode }) {
  const [visibles, setVisibles] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') setVisibles(false);
    });
    return () => sub.remove();
  }, []);

  return (
    <AmenagementsContext value={{ visibles, basculer: () => setVisibles((v) => !v) }}>
      {children}
    </AmenagementsContext>
  );
}

export function useAmenagementsVisibles() {
  return useContext(AmenagementsContext);
}
