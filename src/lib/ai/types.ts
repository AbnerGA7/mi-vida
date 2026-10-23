export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiSource = 'local' | 'nube';

export type AiOptions = {
  // Datos sensibles (finanzas, documentos) nunca salen del celular.
  privado?: boolean;
  maxTokens?: number;
};
