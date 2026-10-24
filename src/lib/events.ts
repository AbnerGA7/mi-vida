// Aviso simple entre pantallas: cuando el asistente registra un gasto o una tarea,
// las pestañas abiertas se refrescan solas sin tener que salir y volver a entrar.
export type DataTopic = 'finanzas' | 'tareas' | 'documentos' | 'coach';

const listeners = new Map<DataTopic, Set<() => void>>();

export function emitDataChanged(topic: DataTopic) {
  listeners.get(topic)?.forEach((l) => {
    try {
      l();
    } catch {
      // una pantalla con error no debe romper a las demás
    }
  });
}

export function onDataChanged(topics: DataTopic[], l: () => void) {
  for (const t of topics) {
    if (!listeners.has(t)) listeners.set(t, new Set());
    listeners.get(t)!.add(l);
  }
  return () => {
    for (const t of topics) listeners.get(t)?.delete(l);
  };
}
