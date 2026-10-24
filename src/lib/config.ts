// Solo este correo puede entrar a la app.
export const ALLOWED_EMAIL = 'abner.gonzales.work@gmail.com';

export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
// Modelo principal (chat, menú, respuestas largas).
export const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-flash-latest';
// Modelo ligero para tareas cortas (clasificar, convertir a JSON): responde en 1-2 s.
export const GEMINI_FAST_MODEL = process.env.EXPO_PUBLIC_GEMINI_FAST_MODEL ?? 'gemini-flash-lite-latest';

// Tiempos límite de la nube: si Gemini no empieza a responder a tiempo, caigo a la IA local.
export const CLOUD_FIRST_BYTE_MS = 12000;
export const CLOUD_TOTAL_MS = 45000;

// Modelos locales (GGUF) que se descargan una sola vez al celular.
export type LocalModelId = 'rapida' | 'precisa';

export type LocalModelInfo = {
  id: LocalModelId;
  name: string;
  file: string;
  url: string;
  bytes: number;
  descripcion: string;
};

export const LOCAL_MODELS: Record<LocalModelId, LocalModelInfo> = {
  rapida: {
    id: 'rapida',
    name: 'Qwen2.5-1.5B Instruct Q4_K_M',
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    bytes: 1.0e9,
    descripcion: '~1 GB · unas 2× más rápida, ideal para registrar gastos y clasificar',
  },
  precisa: {
    id: 'precisa',
    name: 'Qwen2.5-3B Instruct Q4_K_M',
    file: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    bytes: 2.1e9,
    descripcion: '~2 GB · más lenta pero entiende mejor textos largos',
  },
};

// Compatibilidad: el modelo que ya tenías descargado.
export const LOCAL_MODEL = LOCAL_MODELS.precisa;

// Minutos en segundo plano antes de volver a pedir la huella.
export const LOCK_AFTER_MINUTES = 1;
