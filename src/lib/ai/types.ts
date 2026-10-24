export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiSource = 'local' | 'nube';

export type AiOptions = {
  // Datos sensibles (finanzas, documentos): no salen del celular si la privacidad estricta está activa.
  privado?: boolean;
  maxTokens?: number;
  // Tarea corta (clasificar, JSON): usa el modelo ligero de la nube y temperatura baja.
  rapido?: boolean;
  // Pide salida JSON (en la local se fuerza con gramática, así nunca sale roto).
  json?: boolean;
  // Esquema JSON opcional (solo la IA local lo usa como gramática estricta).
  jsonSchema?: object;
  temperature?: number;
  // Recibe el texto acumulado mientras se genera (para mostrar la respuesta palabra por palabra).
  onPartial?: (textoHastaAhora: string, source: AiSource) => void;
  // Para cancelar desde la UI (botón "Detener").
  signal?: AbortSignal;
};

export class AiCancelled extends Error {
  constructor() {
    super('Cancelado');
    this.name = 'AiCancelled';
  }
}
