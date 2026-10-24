import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { onDataChanged, type DataTopic } from '@/lib/events';

// Carga datos de una pantalla de forma segura:
// - nunca deja el spinner girando para siempre (try/finally),
// - si se piden dos cargas seguidas, solo aplica la última,
// - recarga al entrar a la pestaña y cuando otra parte de la app cambia esos datos.
export function useLoader(load: () => Promise<void>, topics: DataTopic[] = []) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      await loadRef.current();
      if (my === seq.current) setError(null);
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const topicsKey = topics.join(',');
  useEffect(() => {
    if (!topicsKey) return;
    return onDataChanged(topicsKey.split(',') as DataTopic[], () => {
      reload();
    });
  }, [topicsKey, reload]);

  return { loading, error, reload };
}
