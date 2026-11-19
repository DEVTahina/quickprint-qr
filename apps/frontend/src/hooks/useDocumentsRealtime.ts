import { useEffect, useRef, useState } from 'react';

import { supabase } from '../services/supabase/client';

/**
 * S'abonne aux changements de `public.documents` pour un administrateur.
 *
 * Les evenements sont regroupes pendant 300 ms puis un seul rappel est emis :
 * une salve d'envois ne declenche qu'un rafraichissement. La RLS de Supabase
 * filtre deja les lignes visibles par l'administrateur connecte.
 *
 * Retourne l'horodatage du dernier evenement recu, ou null.
 */
export function useDocumentsRealtime(
  onChange: () => void,
  enabled = true,
): number | null {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timer: number | undefined;
    // Un nom unique par abonnement evite les collisions entre le tableau de
    // bord et la liste des documents ouverts dans le meme onglet.
    const channelName = `documents-admin-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        () => {
          setLastEventAt(Date.now());
          window.clearTimeout(timer);
          timer = window.setTimeout(() => callbackRef.current(), 300);
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return lastEventAt;
}
