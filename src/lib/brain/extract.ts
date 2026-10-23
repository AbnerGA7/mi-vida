import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { askAi } from '@/lib/ai';
import { findExpiration } from '@/lib/brain/dates';

export const CATEGORIAS_DOC = [
  'Seguros',
  'Contratos',
  'Identidad y trámites',
  'Salud',
  'Vehículos',
  'Hogar',
  'Finanzas e impuestos',
  'Estudios',
  'Notas personales',
] as const;

export type PickedFile = { uri: string; nombre: string; mime: string };

export type ExtractedDocument = {
  nombre: string;
  ruta: string;
  texto: string;
  categoria: string;
  resumen: string;
  fecha_vencimiento: string | null;
};

const DOCS_DIR = `${FileSystem.documentDirectory}docs/`;

export async function scanWithCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Necesito permiso de cámara para escanear.');
  const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (res.canceled) return null;
  const asset = res.assets[0];
  return { uri: asset.uri, nombre: `Escaneo ${new Date().toLocaleDateString('es-PE')}`, mime: 'image/jpeg' };
}

export async function pickFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'text/plain', 'application/pdf'],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  return { uri: asset.uri, nombre: asset.name, mime: asset.mimeType ?? 'application/octet-stream' };
}

// Copio el archivo al almacenamiento privado de la app: no queda en la galería ni en Descargas.
async function storePrivately(file: PickedFile) {
  await FileSystem.makeDirectoryAsync(DOCS_DIR, { intermediates: true }).catch(() => {});
  const safe = file.nombre.replace(/[^\w.\- ]/g, '_');
  const ruta = `${DOCS_DIR}${Date.now()}-${safe}`;
  await FileSystem.copyAsync({ from: file.uri, to: ruta });
  return ruta;
}

async function readText(file: PickedFile, ruta: string) {
  if (file.mime.startsWith('image/')) return (await TextRecognition.recognize(ruta)).text;
  if (file.mime === 'text/plain') return FileSystem.readAsStringAsync(ruta);
  // PDF: por ahora lo guardo sin texto; para leerlo, lo escaneo con la cámara.
  return '';
}

const SYSTEM = `Clasifica un documento personal peruano. Responde SOLO con JSON:
{"categoria": string, "resumen": string}
categoria debe ser una de: ${CATEGORIAS_DOC.join(', ')}.
resumen: una línea con qué es el documento, de quién y lo más importante (montos, número de póliza solo últimos 4 dígitos).
No inventes datos que no estén en el texto. No des interpretaciones legales.`;

async function classify(nombre: string, texto: string) {
  if (!texto.trim()) return { categoria: 'Notas personales', resumen: nombre };
  try {
    // Documentos siempre con IA local: mis papeles no salen del celular.
    const { text } = await askAi(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Nombre: ${nombre}\n\n${texto.slice(0, 3000)}` },
      ],
      { privado: true, maxTokens: 160 },
    );
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return {
      categoria: CATEGORIAS_DOC.includes(json.categoria) ? json.categoria : 'Notas personales',
      resumen: String(json.resumen || nombre),
    };
  } catch {
    return { categoria: 'Notas personales', resumen: nombre };
  }
}

export async function processFile(file: PickedFile): Promise<ExtractedDocument> {
  const ruta = await storePrivately(file);
  const texto = await readText(file, ruta);
  const { categoria, resumen } = await classify(file.nombre, texto);
  return { nombre: file.nombre, ruta, texto, categoria, resumen, fecha_vencimiento: findExpiration(texto) };
}
