export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiSource = 'local' | 'nube';

export type AiOptions = {
  // Datos sensibles (finanzas, documentos) nunca salen del celular.
  privado?: boolean;
  maxTokens?: number;
  // 0 para extraer datos (siempre la misma respuesta); un poco más para redactar.
  temperature?: number;
  // JSON Schema: la IA local queda obligada a responder JSON válido con esta forma.
  json?: object;
  // Recibo el texto a medida que se escribe, para mostrarlo sin esperar al final.
  onToken?: (textoHastaAhora: string) => void;
};
