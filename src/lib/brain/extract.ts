import NetInfo from '@react-native-community/netinfo';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import PdfThumbnail from 'react-native-pdf-thumbnail';

import { askAi } from '@/lib/ai';
import { extractPdfTextCloud, hasCloudKey } from '@/lib/ai/cloud';
import { CATEGORIAS_DOC } from '@/lib/brain/classify';
import { findExpiration } from '@/lib/brain/dates';

export { CATEGORIAS_DOC } from '@/lib/brain/classify';

export type PickedFile = { uri: string; nombre: string; mime: string };

export type ExtractedDocument = {
  nombre: string;
  ruta: string;
  texto: string;
  categoria: string;
  resumen: string;
  fecha_vencimiento: string | null;
};

// Pregunta al usuario si puede mandar el PDF a la nube cuando el OCR local no alcanza.
export type AskCloud = (nombre: string) => Promise<boolean>;

const DOCS_DIR = `${FileSystem.documentDirectory}docs/`;
// Con menos de esto asumo que el OCR no pudo leer el PDF (letra muy chica o escaneo borroso).
const MIN_TEXTO_UTIL = 80;

export async function scanWithCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Necesito permiso de cámara para escanear.');
  const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
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

// PDF → una imagen por página (lector nativo de Android) → OCR de ML Kit.
// Sirve igual para PDF con texto y para PDF escaneados (fotos), y todo pasa dentro del celular.
async function readPdfLocal(ruta: string) {
  const paginas = await PdfThumbnail.generateAllPages(ruta, { quality: 95 });
  const textos: string[] = [];
  for (const [i, pagina] of paginas.entries()) {
    const { text } = await TextRecognition.recognize(pagina.uri);
    if (text.trim()) textos.push(`[Página ${i + 1}]\n${text}`);
    await FileSystem.deleteAsync(pagina.uri, { idempotent: true });
  }
  return textos.join('\n\n');
}

async function readPdf(ruta: string, nombre: string, askCloud?: AskCloud) {
  const local = await readPdfLocal(ruta).catch(() => '');
  if (local.replace(/\s/g, '').length >= MIN_TEXTO_UTIL || !askCloud || !hasCloudKey()) return local;

  const net = await NetInfo.fetch();
  if (!net.isConnected || !(await askCloud(nombre))) return local;
  const base64 = await FileSystem.readAsStringAsync(ruta, { encoding: FileSystem.EncodingType.Base64 });
  return extractPdfTextCloud(base64);
}

async function readText(mime: string, ruta: string, nombre: string, askCloud?: AskCloud) {
  if (mime.startsWith('image/')) return (await TextRecognition.recognize(ruta)).text;
  if (mime === 'text/plain') return FileSystem.readAsStringAsync(ruta);
  if (mime === 'application/pdf' || ruta.toLowerCase().endsWith('.pdf')) return readPdf(ruta, nombre, askCloud);
  return '';
}

const SYSTEM = `Clasifica un documento personal peruano. Responde SOLO con JSON:
{"categoria": string, "resumen": string}
categoria debe ser una de: ${CATEGORIAS_DOC.join(', ')}.
Pistas: SOAT, póliza o seguro → Seguros; tarjeta de propiedad o brevete → Vehículos; DNI o pasaporte → Identidad y trámites.
resumen: una línea con qué es el documento, de quién y lo más importante (montos, número de póliza solo últimos 4 dígitos).
No inventes datos que no estén en el texto. No des interpretaciones legales.`;

async function classify(nombre: string, texto: string) {
  if (!texto.trim()) return { categoria: 'Notas personales', resumen: 'Sin texto leído todavía' };
  try {
    // Clasifico siempre con IA local: el texto de mis papeles no sale del celular para esto.
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

export async function extractFromStored(
  nombre: string,
  ruta: string,
  mime: string,
  askCloud?: AskCloud,
): Promise<ExtractedDocument> {
  const texto = await readText(mime, ruta, nombre, askCloud);
  const { categoria, resumen } = await classify(nombre, texto);
  return { nombre, ruta, texto, categoria, resumen, fecha_vencimiento: findExpiration(texto) };
}

export async function processFile(file: PickedFile, askCloud?: AskCloud): Promise<ExtractedDocument> {
  const ruta = await storePrivately(file);
  return extractFromStored(file.nombre, ruta, file.mime, askCloud);
}

export function mimeFromPath(ruta: string) {
  const ext = ruta.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'txt') return 'text/plain';
  return 'image/jpeg';
}
