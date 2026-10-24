import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { today } from '@/lib/finance/quick-capture';
import { parseReceipt } from '@/lib/finance/receipt';
import type { NewTransaction } from '@/lib/finance/repository';

// Foto de la boleta → OCR de ML Kit dentro del celular → movimiento listo para confirmar.
// La foto no se guarda: la borro apenas leo el texto.
export async function scanReceipt(): Promise<NewTransaction | 'cancelado' | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Necesito permiso de cámara para leer la boleta.');
  const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
  if (res.canceled) return 'cancelado';
  const uri = res.assets[0].uri;
  try {
    const { text } = await TextRecognition.recognize(uri);
    const boleta = parseReceipt(text);
    if (!boleta) return null;
    return {
      fecha: boleta.fecha ?? today(),
      monto: boleta.monto,
      tipo: 'gasto',
      descripcion: boleta.comercio,
      categoria: boleta.categoria,
      cuenta: 'efectivo',
    };
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
