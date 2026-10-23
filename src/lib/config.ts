// Solo este correo puede entrar a la app.
export const ALLOWED_EMAIL = 'abner.gonzales.work@gmail.com';

export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
export const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-flash-latest';

// Modelo local (GGUF) que se descarga una sola vez al celular.
export const LOCAL_MODEL = {
  name: 'Qwen2.5-3B-Instruct Q4_K_M',
  file: 'qwen2.5-3b-instruct-q4_k_m.gguf',
  url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
};

// Minutos en segundo plano antes de volver a pedir la huella.
export const LOCK_AFTER_MINUTES = 1;
