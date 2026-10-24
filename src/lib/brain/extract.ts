import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import PdfThumbnail from 'react-native-pdf-thumbnail';

import { askAi, parseJsonLoose } from '@/lib/ai';
import { extractPdfTextCloud, hasCloudKey } from '@/lib/ai/cloud';
import { isOnline } from '@/lib/ai/net';
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

// Pregunta al usuario si puede mandar el PDF a la nube cuando el OCR local no alcanza.
export type AskCloud = (nombre: string) => Promise<boolean>;

const DOCS_DIR = `${FileSystem.documentDirectory}docs/`;
// Con menos de esto asumo que el OCR no pudo leer el PDF (letra muy chica o escaneo borroso).
const MIN_TEXTO_UTIL = 80;

export async function scanWithCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Necesito permiso de cámara para escanear.');
  // 0.8 basta para el OCR y procesa más rápido que 0.9.
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

// PDF → una imagen por página (lector nativo de Android) → OCR de ML Kit.
// Sirve igual para PDF con texto y para PDF escaneados (fotos), y todo pasa dentro del celular.
const MAX_PAGINAS = 15;

async function readPdfLocal(ruta: string) {
  const paginas = await PdfThumbnail.generateAllPages(ruta, { quality: 90 });
  const textos: string[] = [];
  for (const [i, pagina] of paginas.entries()) {
    // Con PDFs enormes leo las primeras páginas: ahí suele estar lo importante (vigencia, partes, montos).
    if (i < MAX_PAGINAS) {
      const { text } = await TextRecognition.recognize(pagina.uri).catch(() => ({ text: '' }));
      if (text.trim()) textos.push(`[Página ${i + 1}]\n${text}`);
    }
    await FileSystem.deleteAsync(pagina.uri, { idempotent: true }).catch(() => {});
  }
  return textos.join('\n\n');
}

async function readPdf(ruta: string, nombre: string, askCloud?: AskCloud) {
  const local = await readPdfLocal(ruta).catch(() => '');
  if (local.replace(/\s/g, '').length >= MIN_TEXTO_UTIL || !askCloud || !hasCloudKey()) return local;

  if (!(await isOnline()) || !(await askCloud(nombre))) return local;
  const base64 = await FileSystem.readAsStringAsync(ruta, { encoding: FileSystem.EncodingType.Base64 });
  return extractPdfTextCloud(base64);
}

async function readText(mime: string, ruta: string, nombre: string, askCloud?: AskCloud) {
  if (mime.startsWith('image/')) return (await TextRecognition.recognize(ruta).catch(() => ({ text: '' }))).text;
  if (mime === 'text/plain') return FileSystem.readAsStringAsync(ruta);
  if (mime === 'application/pdf' || ruta.toLowerCase().endsWith('.pdf')) return readPdf(ruta, nombre, askCloud);
  return '';
}

const SYSTEM = `Clasifica un documento personal peruano. Responde SOLO con JSON:
{"categoria": string, "resumen": string}
categoria debe ser una de: ${CATEGORIAS_DOC.join(', ')}.
resumen: una línea (máx. 15 palabras) con qué es, de quién y lo más importante (montos; números de póliza o documento solo últimos 4 dígitos).
No inventes datos que no estén en el texto.`;

const SCHEMA = {
  type: 'object',
  properties: {
    categoria: { type: 'string', enum: [...CATEGORIAS_DOC] },
    resumen: { type: 'string' },
  },
  required: ['categoria', 'resumen'],
};

// Pistas que resuelvo en código, al instante (sin IA).
const PISTAS: [RegExp, (typeof CATEGORIAS_DOC)[number]][] = [
  [/\b(soat|poliza|seguro|aseguradora|rimac|pacifico|mapfre|la positiva|interseguro|cobertura)\b/, 'Seguros'],
  [/\b(tarjeta de propiedad|brevete|licencia de conducir|placa|vehiculo|revision tecnica|sunarp vehicular)\b/, 'Vehículos'],
  [/\b(dni|documento nacional de identidad|pasaporte|reniec|carnet de extranjeria|partida de nacimiento|migraciones)\b/, 'Identidad y trámites'],
  [/\b(contrato|arrendamiento|arrendador|arrendatario|clausula|las partes|locacion de servicios)\b/, 'Contratos'],
  [/\b(receta|diagnostico|clinica|hospital|essalud|minsa|laboratorio|resultado de analisis|vacuna|historia clinica)\b/, 'Salud'],
  [/\b(sunat|ruc|declaracion jurada|impuesto|boleta de pago|estado de cuenta|banco|bcp|interbank|bbva|scotiabank|recibo por honorarios|factura)\b/, 'Finanzas e impuestos'],
  [/\b(universidad|instituto|certificado de estudios|constancia de estudios|diploma|titulo|bachiller|matricula|notas)\b/, 'Estudios'],
  [/\b(recibo de luz|recibo de agua|sedapal|enel|luz del sur|predial|arbitrios|mantenimiento|inmueble|hipoteca)\b/, 'Hogar'],
];

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function classifyByKeywords(nombre: string, texto: string) {
  const t = sinTildes(`${nombre}\n${texto.slice(0, 4000)}`);
  return PISTAS.find(([re]) => re.test(t))?.[1] ?? null;
}

// Resumen sin IA: la primera línea con contenido útil del documento.
function quickSummary(nombre: string, texto: string) {
  const linea = texto
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length >= 12 && /[a-záéíóúñ]{3}/i.test(l));
  return linea ? linea.slice(0, 90) : nombre;
}

export async function classifyWithAi(nombre: string, texto: string) {
  if (!texto.trim()) return { categoria: 'Notas personales', resumen: 'Sin texto leído todavía' };
  const { text } = await askAi(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Nombre: ${nombre}\n\n${texto.slice(0, 1800)}` },
    ],
    { privado: true, maxTokens: 120, rapido: true, json: true, jsonSchema: SCHEMA },
  );
  const json = parseJsonLoose(text);
  return {
    categoria: (CATEGORIAS_DOC as readonly string[]).includes(json.categoria)
      ? (json.categoria as string)
      : classifyByKeywords(nombre, texto) ?? 'Notas personales',
    resumen: String(json.resumen || nombre).slice(0, 160),
  };
}

// Lectura rápida: OCR + fecha + categoría por palabras clave. Lo guardo al toque
// y la IA mejora la categoría y el resumen después, en segundo plano.
export async function extractFast(
  nombre: string,
  ruta: string,
  mime: string,
  askCloud?: AskCloud,
): Promise<ExtractedDocument & { pendienteIa: boolean }> {
  const texto = (await readText(mime, ruta, nombre, askCloud)) ?? '';
  const categoria = classifyByKeywords(nombre, texto) ?? 'Notas personales';
  return {
    nombre,
    ruta,
    texto,
    categoria,
    resumen: texto.trim() ? quickSummary(nombre, texto) : 'Sin texto leído todavía',
    fecha_vencimiento: findExpiration(texto),
    pendienteIa: texto.trim().length > 0,
  };
}

export async function extractFromStored(
  nombre: string,
  ruta: string,
  mime: string,
  askCloud?: AskCloud,
): Promise<ExtractedDocument> {
  const fast = await extractFast(nombre, ruta, mime, askCloud);
  if (!fast.pendienteIa) return fast;
  const ai = await classifyWithAi(nombre, fast.texto).catch(() => null);
  return { ...fast, ...(ai ?? {}) };
}

export async function processFileFast(file: PickedFile, askCloud?: AskCloud) {
  const ruta = await storePrivately(file);
  return extractFast(file.nombre, ruta, file.mime, askCloud);
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
