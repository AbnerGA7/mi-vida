import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import PdfThumbnail from 'react-native-pdf-thumbnail';

import { askAi, parseJson } from '@/lib/ai';
import { extractPdfTextCloud, hasCloudKey } from '@/lib/ai/cloud';
import { CATEGORIAS_DOC, classifyByRules, resumenPorReglas } from '@/lib/brain/classify';
import { isOnline } from '@/lib/ai/net';
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
const ESCANEO = 'Escaneo';

export async function scanWithCamera(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Necesito permiso de cámara para escanear.');
  // 0.8 basta para el OCR y procesa más rápido que 0.9.
  const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (res.canceled) return null;
  const asset = res.assets[0];
  return { uri: asset.uri, nombre: `${ESCANEO} ${new Date().toLocaleDateString('es-PE')}`, mime: 'image/jpeg' };
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

const SYSTEM = `Clasificas documentos personales peruanos leídos con OCR (puede haber errores de lectura).
Responde SOLO con JSON {"categoria": string, "resumen": string}.
categoria es una de: ${CATEGORIAS_DOC.join(', ')}.
Guía: SOAT, póliza, EPS o seguro → Seguros; brevete, tarjeta de propiedad o revisión técnica → Vehículos;
DNI, pasaporte, carné de extranjería o antecedentes → Identidad y trámites; contrato de alquiler o de trabajo → Contratos;
receta, análisis o descanso médico → Salud; recibos de luz, agua o internet y títulos de propiedad → Hogar;
SUNAT, boletas de pago, estados de cuenta y facturas → Finanzas e impuestos; títulos, diplomas y constancias → Estudios.
resumen: máximo 12 palabras: qué es, de qué entidad y el dato clave (placa, monto; números de póliza o cuenta solo últimos 4 dígitos).
No inventes datos que no estén en el texto.

Ejemplo: "RIMAC SEGUROS CERTIFICADO SOAT PLACA ABC-123 VIGENCIA DESDE 01/02/2026 HASTA 01/02/2027"
→ {"categoria": "Seguros", "resumen": "SOAT Rímac del vehículo placa ABC-123"}`;

const SCHEMA = {
  type: 'object',
  properties: {
    categoria: { type: 'string', enum: [...CATEGORIAS_DOC] },
    resumen: { type: 'string' },
  },
  required: ['categoria', 'resumen'],
};

// Primero reglas en código (instantáneo y sin IA). Si no están seguras, le pregunto a la IA local
// pasándole lo que creen las reglas; si la IA no está descargada, me quedo con la mejor pista.
async function classify(nombre: string, texto: string) {
  if (!texto.trim()) return { categoria: 'Notas personales', resumen: 'Sin texto leído todavía', tipo: null, vigenciaAnios: undefined };
  const reglas = classifyByRules(nombre, texto);
  const porReglas = { categoria: reglas.categoria, resumen: resumenPorReglas(reglas.tipo, texto, nombre), tipo: reglas.tipo, vigenciaAnios: reglas.vigenciaAnios };
  if (reglas.seguro) return porReglas;
  try {
    // Clasifico siempre con IA local: el texto de mis papeles no sale del celular para esto.
    const pista = reglas.tipo ? `\nPista (puede estar mal): parece ${reglas.tipo}.` : '';
    const { text } = await askAi(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Nombre del archivo: ${nombre}${pista}\n\n${texto.slice(0, 2000)}` },
      ],
      { privado: true, maxTokens: 96, temperature: 0, rapido: true, json: true, jsonSchema: SCHEMA },
    );
    const json = parseJson(text);
    const categoria = CATEGORIAS_DOC.find((c) => c === json.categoria);
    return {
      categoria: categoria ?? porReglas.categoria,
      resumen: String(json.resumen || porReglas.resumen).slice(0, 120),
      tipo: reglas.tipo,
      vigenciaAnios: reglas.vigenciaAnios,
    };
  } catch {
    return porReglas;
  }
}

async function extract(nombre: string, ruta: string, mime: string, askCloud?: AskCloud) {
  const texto = await readText(mime, ruta, nombre, askCloud);
  const { categoria, resumen, tipo, vigenciaAnios } = await classify(nombre, texto);
  const doc: ExtractedDocument = { nombre, ruta, texto, categoria, resumen, fecha_vencimiento: findExpiration(texto, { vigenciaAnios }) };
  return { doc, tipo };
}

export async function extractFromStored(nombre: string, ruta: string, mime: string, askCloud?: AskCloud) {
  return (await extract(nombre, ruta, mime, askCloud)).doc;
}

// Lectura rápida: OCR + reglas en código (categoría, resumen y vencimiento). Lo guardo al toque
// y, si las reglas no están seguras, la IA mejora la categoría y el resumen en segundo plano.
export async function extractFast(
  nombre: string,
  ruta: string,
  mime: string,
  askCloud?: AskCloud,
): Promise<ExtractedDocument & { pendienteIa: boolean; tipo: string | null }> {
  const texto = (await readText(mime, ruta, nombre, askCloud)) ?? '';
  if (!texto.trim()) {
    return { nombre, ruta, texto, categoria: 'Notas personales', resumen: 'Sin texto leído todavía', fecha_vencimiento: null, pendienteIa: false, tipo: null };
  }
  const reglas = classifyByRules(nombre, texto);
  return {
    nombre,
    ruta,
    texto,
    categoria: reglas.categoria,
    resumen: resumenPorReglas(reglas.tipo, texto, nombre),
    fecha_vencimiento: findExpiration(texto, { vigenciaAnios: reglas.vigenciaAnios }),
    pendienteIa: !reglas.seguro,
    tipo: reglas.tipo,
  };
}

// La IA solo corrige categoría y resumen; el vencimiento lo sacan las reglas.
export async function classifyWithAi(nombre: string, texto: string) {
  const { categoria, resumen } = await classify(nombre, texto);
  return { categoria, resumen };
}

export async function processFileFast(file: PickedFile, askCloud?: AskCloud) {
  const ruta = await storePrivately(file);
  const fast = await extractFast(file.nombre, ruta, file.mime, askCloud);
  if (fast.tipo && file.nombre.startsWith(ESCANEO)) fast.nombre = file.nombre.replace(ESCANEO, fast.tipo);
  return fast;
}

export async function processFile(file: PickedFile, askCloud?: AskCloud): Promise<ExtractedDocument> {
  const ruta = await storePrivately(file);
  const { doc, tipo } = await extract(file.nombre, ruta, file.mime, askCloud);
  // "Escaneo 24/10/2026" no dice nada: si reconocí el documento le pongo su nombre ("SOAT 24/10/2026").
  if (tipo && file.nombre.startsWith(ESCANEO)) doc.nombre = file.nombre.replace(ESCANEO, tipo);
  return doc;
}

export function mimeFromPath(ruta: string) {
  const ext = ruta.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'txt') return 'text/plain';
  return 'image/jpeg';
}
